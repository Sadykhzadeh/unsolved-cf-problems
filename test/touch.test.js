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

test("the mouse layout does not take the touch sizes", () => {
  assert.ok(!/min-height:\s*36px/.test(css.replace(touchBlock(), "")));
});
