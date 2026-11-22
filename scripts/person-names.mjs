/**
 * The person-name rule of the leak sweep: a string literal in a test file must not hold a
 * person's name. A test that needs one uses a placeholder (Max Mustermann, Erika Mustermann,
 * John Doe, Jane Doe); anything else that reads as "<given name> <family name>" is a finding.
 *
 * A name is a given name from GIVEN below followed by a capitalised word, inside a quoted
 * literal. The list holds common given names only - it names nobody - so a finding means a
 * test literal reads like a real person, never which person. The finding prints the file,
 * the line and the length, never the name, because the sweep's output goes into a public log.
 */

const GIVEN = [
    // German
    "Alexander", "Andreas", "Anna", "Anja", "Bernd", "Birgit", "Christian", "Christina", "Claudia", "Daniel", "Dieter",
    "Elke", "Erik", "Florian", "Frank", "Franz", "Gabriele", "Georg", "Gerhard", "Hans", "Heike", "Heinz", "Helmut",
    "Ingrid", "Jan", "Jens", "Johann", "Johannes", "Jonas", "Jörg", "Julia", "Jürgen", "Karin", "Karl", "Katharina",
    "Klaus", "Lars", "Laura", "Lea", "Lukas", "Manfred", "Maria", "Marie", "Markus", "Martin", "Martina", "Matthias",
    "Michael", "Monika", "Nicole", "Niklas", "Olaf", "Paul", "Peter", "Petra", "Rainer", "Ralf", "Renate", "Robert",
    "Sabine", "Sandra", "Sarah", "Sebastian", "Simone", "Sophie", "Stefan", "Stephan", "Susanne", "Thomas", "Tim",
    "Tobias", "Torsten", "Ulrich", "Ursula", "Uwe", "Werner", "Wolfgang",
    // English
    "Alice", "Bob", "Charles", "David", "Edward", "Emily", "Emma", "George", "Henry", "James", "Jennifer", "Jessica",
    "John", "Joseph", "Linda", "Mary", "Matthew", "Patricia", "Richard", "Susan", "William",
    // Slavic and others common here
    "Aleksandr", "Alexei", "Andrii", "Dmitri", "Dmytro", "Igor", "Ivan", "Mykola", "Natalia", "Oleg", "Oleksandr",
    "Olga", "Sergei", "Sergej", "Sergey", "Sergii", "Serhii", "Tatiana", "Vladimir", "Volodymyr", "Yuri",
    "Ahmed", "Ali", "Fatima", "Mehmet", "Mohammed", "Mustafa",
];
const PLACEHOLDERS = new Set(["Max Mustermann", "Erika Mustermann", "Erika Musterfrau", "John Doe", "Jane Doe"]);

const NAME = new RegExp(`(?<![\\p{L}\\p{N}_-])(${GIVEN.join("|")}) (\\p{Lu}[\\p{Ll}]+)(?![\\p{L}\\p{N}_-])`, "gu");
const LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/gu;

/** A file whose literals the rule reads: a test, a fixture or a test helper. */
export const isTestPath = (path) => /(^|\/)(test|tests|__tests__|fixtures)\//u.test(path) || /\.test\.(m?[jt]s)$/u.test(path);

/** Findings for one file: `<path>:<line> person name in a test literal (<n> characters)`. */
export function personNameFindings(path, text, label = path) {
    if (!isTestPath(path)) return [];
    const out = [];
    for (const [index, line] of text.split("\n").entries()) {
        LITERAL.lastIndex = 0;
        let lit;
        while ((lit = LITERAL.exec(line)) !== null) {
            NAME.lastIndex = 0;
            let m;
            while ((m = NAME.exec(lit[0])) !== null) {
                if (!PLACEHOLDERS.has(m[0])) out.push(`${label}:${index + 1} person name in a test literal (${m[0].length} characters); use a placeholder such as Max Mustermann`);
            }
        }
    }
    return out;
}
