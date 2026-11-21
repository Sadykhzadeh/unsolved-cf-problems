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

test("hiding a row moves the focus to the next row still showing, or else the one before it", () => {
  stored.clear();
  const focused = [];
  const make = (index) => {
    const button = {
      title: "",
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      closest() {
        return this;
      },
      focus() {
        focused.push(index);
      },
    };
    const tr = { hidden: false, classList: { toggle() {} }, contains: (node) => node === button, querySelector: () => button };
    return { tr, button, problem: { contestId: 1520, index, name: `Problem ${index}` } };
  };
  const rows = [make("A"), make("B"), make("C")];
  const listeners = {};
  const elements = {
    "table-list": { addEventListener: (type, handler) => { listeners[type] = handler; } },
    searchTask: { focus() { focused.push("search"); } },
  };
  const view = createHide({
    state: { handle: "tourist" },
    byId: (id) => elements[id],
    text: { hideButton: "Hide {problem}", unhideButton: "Show {problem}" },
    fill: (template, values) => template.replace("{problem}", values.problem),
    problemKey,
    remember: (key, value) => localStorage.setItem(key, value),
    drawn: () => rows.map((row) => [row.tr, row.problem]),
    applyFilters() {
      for (const row of rows) row.tr.hidden = view.hiddenFor("tourist").has(problemKey(row.problem));
    },
  });
  const press = (row) => listeners.click({ target: row.button });

  press(rows[1]);
  assert.equal(rows[1].tr.hidden, true);
  press(rows[2]);
  press(rows[1]);
  assert.deepEqual(focused, ["C", "A"], "after B, the next row C; after the last row C, the one before it, A");
  assert.equal(rows[1].tr.hidden, false, "a second press brings B back");
});
