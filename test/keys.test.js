import { test } from "node:test";
import assert from "node:assert/strict";
import { createKeys } from "../keys.js";

// keys.js moves a highlight over the rows of the list and opens the highlighted one. The
// rows are stand-ins with a hidden flag, a class list and a problem name that clicks; the
// event target is a plain object, or a button when the browser would act on Enter itself.
class HTMLButtonElement {}
class HTMLAnchorElement {}
globalThis.HTMLButtonElement = HTMLButtonElement;
globalThis.HTMLAnchorElement = HTMLAnchorElement;

const page = (specs) => {
  const clicked = [];
  let highlighted = null;
  const trs = {};
  const rows = specs.map(([index, hidden]) => {
    const classes = new Set();
    const tr = {
      hidden,
      classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) },
      scrollIntoView() {},
      querySelector: () => ({ click: () => clicked.push(index) }),
    };
    trs[index] = tr;
    return [tr, { contestId: 1520, index, name: `Problem ${index}` }];
  });
  const keys = createKeys({ drawn: () => rows, highlight: () => highlighted, setHighlight: (key) => { highlighted = key; } });
  const press = (action, event = {}) => {
    let prevented = false;
    keys.press(action, { target: {}, key: "", repeat: false, preventDefault: () => { prevented = true; }, ...event });
    return prevented;
  };
  return { press, clicked, highlighted: () => highlighted, hide: (index) => { trs[index].hidden = true; } };
};

test("j and k move the highlight down and up the rows shown, skipping hidden ones", () => {
  const view = page([["A", false], ["B", true], ["C", false]]);
  view.press("next");
  assert.equal(view.highlighted(), "1520|A");
  view.press("next");
  assert.equal(view.highlighted(), "1520|C", "B is hidden");
  view.press("next");
  assert.equal(view.highlighted(), "1520|C", "the last row stays highlighted");
  view.press("previous");
  assert.equal(view.highlighted(), "1520|A");
  view.press("previous");
  assert.equal(view.highlighted(), "1520|A", "the first row stays highlighted");
});

test("o opens the highlighted problem, and a held o opens it only once", () => {
  const view = page([["A", false], ["B", false]]);
  view.press("next");
  view.press("open");
  assert.deepEqual(view.clicked, ["A"]);
  view.press("open", { repeat: true });
  assert.deepEqual(view.clicked, ["A"], "a repeat press is ignored");
});

test("o does not open the highlighted row once it is hidden", () => {
  const view = page([["A", false], ["B", false]]);
  view.press("next");
  view.hide("A");
  view.press("open");
  assert.deepEqual(view.clicked, []);
});

test("Enter on a button or a link is left to the browser, which already acts on it", () => {
  const view = page([["A", false]]);
  view.press("next");
  const button = Object.create(HTMLButtonElement.prototype);
  const prevented = view.press("open", { key: "Enter", target: button });
  assert.deepEqual(view.clicked, [], "no second open");
  assert.equal(prevented, false, "the browser keeps its own action");
  assert.equal(view.press("open", { key: "Enter", target: {} }), true, "elsewhere Enter opens the highlighted problem");
  assert.deepEqual(view.clicked, ["A"]);
});
