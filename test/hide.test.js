import { test } from "node:test";
import assert from "node:assert/strict";
import { createHide } from "../hide.js";
import { problemKey } from "../lib.js";

// hide.js needs a page's storage, window and the list's button clicks. A small stand-in
// for each is enough to hide a row and read the choice back in a new view, as a reload does.
const KEY = "unsolved-cf-problems:hidden";
const stored = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => stored.set(key, String(value)),
  },
});
globalThis.window = { addEventListener() {} };

const problem = { contestId: 1520, index: "A", name: "Problem A" };

const pageView = (handle) => {
  const listeners = {};
  const button = {
    title: "",
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    closest() {
      return this;
    },
  };
  const row = {
    hidden: false,
    classList: { toggle() {} },
    contains: (node) => node === button,
    querySelector: () => button,
  };
  const elements = {
    "table-list": { addEventListener: (type, handler) => { listeners[type] = handler; } },
    searchTask: { focus() {} },
  };
  const view = createHide({
    state: { handle },
    byId: (id) => elements[id],
    text: { hideButton: "Hide {problem}", unhideButton: "Show {problem}" },
    fill: (template, values) => template.replace("{problem}", values.problem),
    problemKey,
    remember: (key, value) => localStorage.setItem(key, value),
    drawn: () => [[row, problem]],
    applyFilters() {},
  });
  return { view, click: () => listeners.click({ target: button }) };
};

test("a row hidden for a handle is hidden again in a new view of the same handle", () => {
  stored.clear();
  pageView("tourist").click();
  assert.equal(stored.get(KEY), JSON.stringify({ tourist: ["1520|A"] }));
  assert.equal(pageView("tourist").view.hiddenFor("tourist").has("1520|A"), true);
});

test("a handle named __proto__ keeps its hidden rows too", () => {
  stored.clear();
  pageView("__proto__").click();
  assert.equal(stored.get(KEY), '{"__proto__":["1520|A"]}');
  assert.equal(pageView("__proto__").view.hiddenFor("__proto__").has("1520|A"), true);
  assert.equal(pageView("tourist").view.hiddenFor("tourist").has("1520|A"), false);
});
