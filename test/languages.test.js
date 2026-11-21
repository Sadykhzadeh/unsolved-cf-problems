import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import en from "../strings-en.js";
import ru from "../strings-ru.js";

// Every language is a strings file the page imports by its code, and a flag on the
// page. A label missing from one language, or a value that names a different {value}
// than the other, would show up only in that language.
const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

const placeholders = (value) => typeof value === "string"
  ? [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort().join()
  : "";

test("both languages have the same labels, with the same values in each sentence", () => {
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.equal(placeholders(ru[key]), placeholders(en[key]), `${key} has different {values} in the two languages`);
  }
  assert.deepEqual(ru.keysHelpRows.map((row) => row.keys), en.keysHelpRows.map((row) => row.keys));
});

test("the language flags, the language list and the strings files name the same languages", () => {
  const flags = [...read("index.html").matchAll(/data-lang="(\w+)"/g)].map(([, lang]) => lang).sort();
  const listed = /const LANGUAGES = \[([^\]]*)\]/.exec(read("script.js"))[1]
    .split(",").map((item) => item.trim().replace(/"/g, "")).sort();
  const files = readdirSync(root).map((file) => /^strings-(\w+)\.js$/.exec(file)?.[1]).filter(Boolean).sort();
  assert.deepEqual(flags, listed);
  assert.deepEqual(files, listed);
});
