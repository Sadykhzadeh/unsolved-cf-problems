import { test } from "node:test";
import assert from "node:assert/strict";
import { fillText } from "../lib.js";
import { fillSolvedSince } from "../since.js";
import en from "../strings-en.js";

// since.js writes into the page's line under a repeat lookup. A small stand-in for the
// element and its children is enough to read back the text and the links it holds.
const line = () => {
  const children = [];
  return {
    children,
    dataset: {},
    get textContent() {
      return children.map((child) => (typeof child === "string" ? child : child.label)).join("");
    },
    set textContent(value) {
      children.length = 0;
      children.push(String(value));
    },
    replaceChildren() {
      children.length = 0;
    },
    append(...nodes) {
      children.push(...nodes);
    },
  };
};

const row = (contestId, index, rating = 1600) => ({ contestId, index, name: `Problem ${index}`, rating, start: 1700000000 });

const show = (solved, current, saved = [row(1520, "A"), row(1521, "B"), row(1522, "C")]) => {
  const element = line();
  fillSolvedSince({
    byId: (id) => (id === "solvedSince" ? element : undefined),
    text: en,
    fill: fillText,
    anchor: (href, label) => ({ href, label }),
    ago: () => "2 hours ago",
    handle: "tourist",
    previous: { savedAt: 1700000000, rows: saved },
    current,
    solved,
  });
  return element;
};

test("the line says which saved problems the handle solved since, with links to them", () => {
  const solved = { keys: ["1520|A", "1521|B", "1522|C"], twins: [] };
  const element = show(solved, [row(1522, "C")], [row(1520, "A"), row(1521, "B"), row(1522, "C"), row(1523, "D")]);
  assert.equal(element.textContent, "Solved since the saved copy this lookup replaced, saved 2 hours ago: 2. 1520|A, 1521|B");
  assert.deepEqual(element.children.filter((child) => typeof child !== "string").map((link) => link.href), [
    "https://codeforces.com/contest/1520/problem/A",
    "https://codeforces.com/contest/1521/problem/B",
  ]);
  assert.equal(element.dataset.handle, "tourist");
});

test("the line says so when none of the saved problems is solved since", () => {
  const solved = { keys: [], twins: [] };
  const element = show(solved, [row(1521, "B"), row(1522, "C")]);
  assert.equal(element.textContent, "None of the problems unsolved in the saved copy this lookup replaced, saved 2 hours ago, is solved now.");
  assert.equal(element.children.length, 1, "no links");
});
