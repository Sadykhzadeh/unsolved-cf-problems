import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SORT_KEYS } from "../lib.js";

// The README states the limits the code sets: how long a saved copy is trusted, how
// far apart the API calls are, how many submissions a refresh asks for. Each one is
// read from its declaration and checked against the words the README gives it.
const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const readme = read("README.md").replace(/\s+/g, " ");

const declared = (file, name) => {
  const [, expression] = new RegExp(`const ${name} = ([^;]+);`).exec(read(file)) ?? [];
  assert.ok(expression, `${name} is declared in ${file}`);
  return Function(`return (${expression});`)();
};

test("the README states the limits the code sets", () => {
  const limits = [
    ["ten minutes", "script.js", "FRESH_FOR", 10 * 60 * 1000],
    ["six hours", "upsolve.js", "PROBLEMSET_FRESH", 6 * 60 * 60 * 1000],
    ["two seconds apart", "script.js", "API_GAP", 2000],
    ["up to seven away", "lib.js", "PARALLEL_GAP", 7],
    ["the 300 newest submissions", "lib.js", "NEWEST_COUNT", 300],
    ["older than a day", "lib.js", "SETTLE_SECONDS", 24 * 60 * 60],
    ["every three days", "lib.js", "REBUILD_AFTER_SECONDS", 3 * 24 * 60 * 60],
    ["the last three lookups", "lib.js", "KEEP_HANDLES", 3],
  ];
  for (const [phrase, file, name, value] of limits) {
    assert.ok(readme.includes(phrase), `the README does not say "${phrase}"`);
    assert.equal(declared(file, name), value, `${name} in ${file} is not what the README says`);
  }
});

test("the sort keys the README and the column headers name are the ones the code sorts by", () => {
  const row = /^\| `sort` \|.*$/m.exec(read("README.md"))[0];
  const documented = [...row.split("|")[3].matchAll(/`([a-z]+)`/g)].map(([, key]) => key);
  const headers = [...read("index.html").matchAll(/data-sort="(\w+)"/g)].map(([, key]) => key);
  assert.deepEqual(documented.sort(), [...SORT_KEYS].sort());
  assert.deepEqual(headers.sort(), [...SORT_KEYS].sort());
});
