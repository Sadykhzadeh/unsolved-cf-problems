import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// What a first visit to the English page downloads before a lookup: the page, the
// stylesheet, and every script the page reaches through static imports, plus the
// English sentences, which load beside the page (see script.js). Lazily imported
// modules are not part of it: they are read on first use, and that is the point.
// Raised only on purpose, when a change is worth the bytes. The touch-screen block
// of the stylesheet (a 36px row for the small controls) added 290.
const FIRST_VISIT_GZIP_BUDGET = 35700;

const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root));

// The local files the page names in its markup, and the local modules those files
// import statically, followed through the whole graph. Absolute links, fragments and
// queries are not files of this page.
const firstVisitFiles = () => {
  const html = read("index.html").toString("utf8");
  const named = [...html.matchAll(/<(?:link|script)\b[^>]*?\b(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => !/^([a-z]+:|\/\/|#|\?)/i.test(path))
    .map((path) => path.replace(/^\.\//, ""));
  const files = new Set(["index.html", "strings-en.js"]);
  const queue = [...named];
  while (queue.length > 0) {
    const file = queue.shift();
    if (files.has(file)) continue;
    files.add(file);
    if (!file.endsWith(".js")) continue;
    // Static imports only: a dynamic import("...") has no "from" and is not matched.
    for (const match of read(file).toString("utf8").matchAll(/import\s+[^;]*?\sfrom\s+"\.\/([^"]+)"/g)) {
      queue.push(match[1]);
    }
  }
  return [...files];
};

test("the first visit to the English page downloads no more than its budget", () => {
  const files = firstVisitFiles();
  const sizes = files.map((file) => ({ file, gzip: gzipSync(read(file), { level: 9 }).length }));
  const total = sizes.reduce((sum, { gzip }) => sum + gzip, 0);
  assert.ok(
    total <= FIRST_VISIT_GZIP_BUDGET,
    `first visit is ${total} bytes gzipped, over the budget of ${FIRST_VISIT_GZIP_BUDGET}: ${JSON.stringify(sizes)}`,
  );
});

test("the lazily imported modules are not part of the first visit", () => {
  const files = firstVisitFiles();
  for (const lazy of ["upsolve.js", "lib-upsolve.js", "lib-export.js", "friend.js", "rating-strip.js", "tags.js", "tagtable.js", "about.js", "hide.js", "keys.js", "help.js", "since.js", "lib-since.js", "compare.js", "lib-compare.js", "strings-ru.js"]) {
    assert.equal(files.includes(lazy), false, `${lazy} is read on first use, not on a first visit`);
  }
});
