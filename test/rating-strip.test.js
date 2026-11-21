import { test } from "node:test";
import assert from "node:assert/strict";
import { createRatingStrip } from "../rating-strip.js";
import en from "../strings-en.js";

// rating-strip.js builds its bands in the page and reads the rating fields. Small
// stand-ins for the elements and for document.createElement are enough to build the
// strip, click a band and read back the fields and the pressed state.
const element = (tag) => ({
  tag,
  children: [],
  attributes: {},
  dataset: new Proxy({}, { set(target, key, value) { target[key] = String(value); return true; } }),
  style: {},
  className: "",
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  },
  append(...nodes) {
    this.children.push(...nodes);
  },
  closest(selector) {
    return selector === "button.rating-band" && this.tag === "button" ? this : null;
  },
});

const page = (rows, { about = false } = {}) => {
  const listeners = {};
  const counts = { applied: 0, synced: 0 };
  const elements = {
    ratingStrip: { hidden: true },
    ratingStripLabel: {},
    ratingBars: {
      children: [],
      replaceChildren(...nodes) {
        this.children = nodes;
      },
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
    },
    minRating: { value: "" },
    maxRating: { value: "" },
  };
  globalThis.document = { createElement: element };
  const strip = createRatingStrip({
    byId: (id) => elements[id],
    text: en,
    listRows: () => rows,
    aboutOpen: () => about,
    applyFilters: () => counts.applied++,
    syncUrl: () => counts.synced++,
  });
  const bandAt = (from) => elements.ratingBars.children.find((band) => band.dataset.from === String(from));
  return { strip, elements, counts, bandAt, click: (band) => listeners.click({ target: band }) };
};

const rows = [{ rating: 1500 }, { rating: 1520 }, { rating: 1700 }, { rating: undefined }];

test("the strip shows one band a hundred wide per rating range, and says how many problems it holds", () => {
  const view = page(rows);
  view.strip.show();
  assert.equal(view.elements.ratingStrip.hidden, false);
  const bands = view.elements.ratingBars.children;
  assert.deepEqual(bands.map((band) => band.dataset.from), ["1500", "1600", "1700"]);
  assert.equal(bands[0].attributes["aria-label"], "Rating 1500 to 1599: 2 unsolved, filter by this range");
  assert.equal(bands[1].attributes["aria-label"], "Rating 1600 to 1699: 0 unsolved, filter by this range");
});

test("a band's bar is as tall as its share of the fullest band, and an empty one has none", () => {
  const view = page([{ rating: 1500 }, { rating: 1501 }, { rating: 1900 }]);
  view.strip.show();
  assert.equal(view.bandAt(1500).children[0].style.height, "100%");
  assert.equal(view.bandAt(1900).children[0].style.height, "50%");
  assert.equal(view.bandAt(1600).children[0].style.height, "0");
});

test("clicking a band keeps only its ratings, and clicking the chosen band again clears the fields", () => {
  const view = page(rows);
  view.strip.show();
  view.click(view.bandAt(1500));
  assert.deepEqual([view.elements.minRating.value, view.elements.maxRating.value], ["1500", "1599"]);
  assert.equal(view.counts.applied, 1);
  assert.equal(view.counts.synced, 1);
  view.strip.mark();
  assert.equal(view.bandAt(1500).attributes["aria-pressed"], "true");
  view.click(view.bandAt(1500));
  assert.deepEqual([view.elements.minRating.value, view.elements.maxRating.value], ["", ""]);
  view.strip.mark();
  assert.equal(view.bandAt(1500).attributes["aria-pressed"], "false");
});

test("the strip stays hidden while the about page is open or no problem is rated", () => {
  const about = page(rows, { about: true });
  about.strip.show();
  assert.equal(about.elements.ratingStrip.hidden, true);
  const unrated = page([{ rating: undefined }]);
  unrated.strip.show();
  assert.equal(unrated.elements.ratingStrip.hidden, true);
});
