import { expect } from "vitest";

/**
 * Pins a reviewed answer as a plain text file, test/__snapshots__/<group>/<test name>.txt (a value that is no
 * string as JSON), read in review like code. A changed answer fails the test until the file is updated
 * (`vitest -u`) and the diff reviewed.
 */
export async function pinned(group: string, value: unknown): Promise<void> {
  const name = expect.getState().currentTestName!.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  await expect(typeof value === "string" ? `${value}\n` : `${JSON.stringify(value, null, 2)}\n`).toMatchFileSnapshot(`./__snapshots__/${group}/${name}.txt`);
}
