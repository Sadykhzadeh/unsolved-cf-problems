import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The page's content security policy, and the markup and scripts it has to allow:
// nothing inline, and no evaluation of text as code.
const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const html = read("index.html");
const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1] ?? "";
const directives = Object.fromEntries(policy.split(";").map((part) => part.trim().split(/\s+/))
  .map(([name, ...values]) => [name, values]));

test("the page's policy lets only its own scripts and styles run, and reach the API and its icons", () => {
  assert.deepEqual(directives["default-src"], ["'self'"]);
  assert.deepEqual(directives["script-src"], ["'self'"]);
  assert.deepEqual(directives["style-src"], ["'self'"]);
  assert.deepEqual(directives["connect-src"], ["'self'", "https://codeforces.com"]);
  assert.deepEqual(directives["img-src"], ["'self'", "https://sta.codeforces.com"]);
  assert.equal(policy.includes("unsafe-"), false);
});

test("the markup has no inline style, script or event handler that the policy would block", () => {
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/);
  assert.doesNotMatch(html, /\son[a-z]+="/i);
});

test("the scripts never turn text into code or markup", () => {
  for (const file of ["script.js", "lib.js", "friend.js", "upsolve.js", "lib-upsolve.js", "lib-export.js",
    "hide.js", "keys.js", "tags.js", "tagtable.js", "rating-strip.js", "about.js"]) {
    assert.doesNotMatch(read(file), /\beval\(|new Function\(|\.innerHTML\s*=|insertAdjacentHTML\(/, file);
  }
});
