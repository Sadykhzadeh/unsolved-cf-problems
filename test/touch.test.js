import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");
const header = "@media (pointer: coarse)";

// The text of the block opened by `header`, up to its matching brace.
const touchBlock = () => {
  const start = css.indexOf(header);
  assert.notEqual(start, -1, "the stylesheet has a block for a coarse pointer");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error("unclosed block");
};

test("on a touch screen the small buttons, links, fields and labels are at least 32px tall", () => {
  const block = touchBlock();
  const rules = block.split("}").map((part) => part.split("{").slice(-2));
  for (const selector of ["#refresh", "#pick", "#copyMarkdown", "#downloadCsv", ".tag-chip", "summary", ".check", "#filters input", "#handle", "td a", ".sort", ".hide"]) {
    const rule = rules.find(([head, body]) => body && head.split(",").some((part) => part.trim() === selector));
    assert.ok(rule, `${selector} is made bigger for a finger`);
    const height = /min-height:\s*(\d+)px/.exec(rule[1]) ?? /padding:\s*(\d+)px 0/.exec(rule[1]);
    assert.ok(height && Number(height[1]) >= 10, `${selector} has a height or padding`);
  }
  assert.ok([...block.matchAll(/min-height:\s*(\d+)px/g)].every((match) => Number(match[1]) >= 32));
});

// The date may wrap on a phone (the narrow-screen rule says so), but the rule that
// keeps it on one line is written after that block and has the same specificity as
// a bare `.when`, so it won and the Russian dates ("13 июл. 2014 г.") held the
// table 22px wider than its box at 360px.
test("the narrow-screen rule that lets a date wrap beats the one that keeps it on a line", () => {
  const narrow = css.slice(css.indexOf("@media only screen and (max-width: 600px)"));
  const wrap = /([^\s{},]*\.when)\s*\{\s*white-space:\s*normal/.exec(narrow);
  assert.ok(wrap, "the narrow-screen block lets a date wrap");
  const base = /(?:^|\n)\.when\s*\{\s*white-space:\s*nowrap/.exec(css);
  assert.ok(base, "the date does not wrap by default");
  const moreSpecific = wrap[1] !== ".when";
  const later = css.indexOf(wrap[0]) > base.index;
  assert.ok(moreSpecific || later, "the wrapping rule is not overridden by the default one");
});

test("the mouse layout does not take the touch sizes", () => {
  assert.ok(!/min-height:\s*36px/.test(css.replace(touchBlock(), "")));
});
