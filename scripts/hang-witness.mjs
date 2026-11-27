#!/usr/bin/env node
/**
 * What a hung child of `runTool` was doing, written down just before the deadline kills it.
 *
 * WHY THIS EXISTS (issue #288). On the GitHub ubuntu runner, under Node 24, a gate run was
 * killed at the 120 s deadline about once in a few hundred runs AFTER it had printed
 * "exiting with N" - the line written right before `process.exit`. Its parent is
 * `execFileSync` with stdout and stderr piped, which returns only when the child has
 * exited AND both pipes have reached end-of-file. So the 120 s went to one of three
 * things, and the kill destroys the evidence of which:
 *   1. the child never finished exiting (alive, some thread blocked in its teardown);
 *   2. the child exited but was not reaped (a zombie: the parent missed its exit);
 *   3. the child is gone but another process still holds one of its pipes open.
 * About 750 Linux container runs never reproduced it, so this records the state on the
 * machine where it happens instead of guessing: started beside the child, it sleeps once
 * until a few seconds before the deadline and, if the parent is still waiting, writes
 * for every descendant of the parent its state and wait channel, each thread's name,
 * state and wait channel (a V8 worker or a libuv worker blocked at exit names itself),
 * its open descriptors, and every process on the machine that holds one of the pipes
 * the parent reads. `runTool` appends the file to the timeout's message.
 *
 * It reads /proc and nothing else, so it says so and writes that on any other system.
 * It never kills, signals or writes to anything but its own output file.
 *
 *   node scripts/hang-witness.mjs <parent pid> <fire at, epoch ms> <output file> <call start, epoch ms> [earlier witness pids, comma-separated]
 */

import { readFileSync, readdirSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = path => {
    try {
        return readFileSync(path, 'utf8');
    } catch (error) {
        return `(unreadable: ${error.code ?? error.message})`;
    }
};

const link = path => {
    try {
        return readlinkSync(path);
    } catch {
        return undefined;
    }
};

/** `/proc/<pid>/stat` split after the command name, which may itself hold spaces and parentheses. */
function stat(pid) {
    const text = read(`/proc/${pid}/stat`);
    const close = text.lastIndexOf(')');
    if (close === -1) {
        return undefined;
    }
    const rest = text.slice(close + 2).split(' ');
    // rest[0] is field 3 of stat; rest[19] is field 22, the start in clock ticks after boot.
    return { comm: text.slice(text.indexOf('(') + 1, close), state: rest[0], ppid: Number(rest[1]), start: Number(rest[19]) };
}

const pids = () => readdirSync('/proc').filter(entry => /^\d+$/u.test(entry)).map(Number);

/** Every process whose parent chain reaches `root`, nearest first. */
export function descendants(root, table) {
    const children = new Map();
    for (const [pid, info] of table) {
        if (!children.has(info.ppid)) children.set(info.ppid, []);
        children.get(info.ppid).push(pid);
    }
    const out = [];
    const queue = [...(children.get(root) ?? [])];
    while (queue.length > 0) {
        const pid = queue.shift();
        out.push(pid);
        queue.push(...(children.get(pid) ?? []));
    }
    return out;
}

function fds(pid) {
    let entries;
    try {
        entries = readdirSync(`/proc/${pid}/fd`);
    } catch (error) {
        return [`(fds unreadable: ${error.code ?? error.message})`];
    }
    return entries.map(fd => `${fd} -> ${link(`/proc/${pid}/fd/${fd}`) ?? '?'}`);
}

function threads(pid) {
    let tids;
    try {
        tids = readdirSync(`/proc/${pid}/task`);
    } catch (error) {
        return [`(threads unreadable: ${error.code ?? error.message})`];
    }
    return tids.map(tid => {
        const info = stat(`${pid}/task/${tid}`);
        const wchan = read(`/proc/${pid}/task/${tid}/wchan`).trim();
        return `${tid} ${JSON.stringify(info?.comm ?? '?')} state ${info?.state ?? '?'} wchan ${wchan || '-'}`;
    });
}

/** Boot time in epoch ms, so a process's start (ticks after boot) can be compared with the call's. */
function bootMs() {
    const line = read('/proc/stat').split('\n').find(entry => entry.startsWith('btime '));
    return line === undefined ? undefined : Number(line.split(' ')[1]) * 1000;
}

/** One process, as the report prints it. */
function describe(pid, info, lines) {
    lines.push(`  pid ${pid} (parent ${info.ppid}) ${JSON.stringify(info.comm)} state ${info.state}${info.state === 'Z' ? ' (a zombie: it exited and was not reaped)' : ''}`);
    lines.push(`    cmdline ${JSON.stringify(read(`/proc/${pid}/cmdline`).split('\0').filter(Boolean).join(' '))}`);
    lines.push(`    wchan ${read(`/proc/${pid}/wchan`).trim() || '-'}`);
    for (const thread of threads(pid)) lines.push(`    thread ${thread}`);
    for (const fd of fds(pid)) lines.push(`    fd ${fd}`);
}

/**
 * The report for the processes under `parent` at this moment.
 *
 * `since` is when the call started (epoch ms): a process started after it that is NOT under
 * the parent any more was started by the child and outlived it (reparented), which is the
 * one way a pipe stays open after the child is gone. It is found by start time, not by the
 * pipe's identity, because libuv gives a child its stdio as a socketpair and the two ends of
 * a socketpair carry different inode numbers, so /proc cannot pair them. `ignore` are the
 * parent's earlier witnesses, killed and not yet reaped (the parent's loop is blocked).
 */
export function witness(parent, since = undefined, ignore = new Set()) {
    if (process.platform !== 'linux') {
        return `hang witness: no /proc on ${process.platform}; nothing recorded`;
    }
    const table = new Map();
    for (const pid of pids()) {
        const info = stat(pid);
        if (info !== undefined) table.set(pid, info);
    }
    const lines = [`hang witness at ${new Date().toISOString()}, parent ${parent}`];
    // Not itself: it is a child of the parent too, and the one process known not to be hung.
    const under = descendants(parent, table).filter(pid => pid !== process.pid && !ignore.has(pid));
    if (under.length === 0) {
        lines.push('  no process under the parent: the child is gone and reaped, so the parent waits on a pipe');
    }
    for (const pid of under) {
        describe(pid, table.get(pid), lines);
    }
    const boot = bootMs();
    if (since !== undefined && boot !== undefined) {
        // Ticks to ms at the usual USER_HZ of 100; a second of slack is ample.
        const outlived = [...table.keys()].filter(pid =>
            pid !== process.pid && pid !== parent && !under.includes(pid) && !ignore.has(pid) &&
            boot + table.get(pid).start * 10 >= since - 1000);
        lines.push(outlived.length === 0
            ? '  no process started during the call outlived it outside the parent'
            : `  started during the call and no longer under the parent (reparented): ${outlived.join(' ')}`);
        for (const pid of outlived) describe(pid, table.get(pid), lines);
    }
    // The parent's pipes. A real pipe's two ends share one inode, so a holder of one of
    // them is named here; a socketpair's are told apart above, by start time.
    const parentPipes = new Set(fds(parent).map(entry => /(?:pipe|socket):\[\d+\]/u.exec(entry)?.[0]).filter(Boolean));
    lines.push(`  the parent's pipes: ${[...parentPipes].join(' ') || 'none'}`);
    for (const pid of table.keys()) {
        if (pid === parent || pid === process.pid) continue;
        for (const fd of fds(pid)) {
            const pipe = /(?:pipe|socket):\[\d+\]/u.exec(fd)?.[0];
            if (pipe !== undefined && parentPipes.has(pipe)) {
                lines.push(`  pid ${pid} ${JSON.stringify(table.get(pid).comm)} holds ${pipe} as fd ${fd.split(' ')[0]}`);
            }
        }
    }
    return lines.join('\n');
}

// Through realpath on both sides, as check-tarball.mjs explains: /var is a symlink on macOS.
const real = path => {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
};
if (process.argv[1] !== undefined && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) {
    const [parent, fireAt, out, since, ignore = ''] = process.argv.slice(2);
    setTimeout(() => {
        writeFileSync(out, `${witness(Number(parent), Number(since), new Set(ignore.split(',').filter(Boolean).map(Number)))}\n`);
    }, Math.max(0, Number(fireAt) - Date.now()));
}
