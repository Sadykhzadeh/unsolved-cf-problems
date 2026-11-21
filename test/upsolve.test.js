import { test } from "node:test";
import assert from "node:assert/strict";
import { fillText } from "../lib.js";

// The upsolve view reads the page's Cache API and location, and the API through fetch;
// stand-ins for each let its loading run here.
const installPage = (answer) => {
  const store = new Map();
  const cache = {
    async match(request) {
      const body = store.get(request.url ?? request);
      return body === undefined ? undefined : new Response(body);
    },
    async put(request, response) {
      store.set(request.url ?? request, await response.text());
    },
    async keys() {
      return [...store.keys()].map((url) => ({ url }));
    },
    async delete(url) {
      return store.delete(url);
    },
  };
  globalThis.window = { location: { href: "https://example.test/app/" } };
  globalThis.caches = { open: async () => cache };
  globalThis.fetch = async (url) => new Response(JSON.stringify({ status: "OK", result: answer(url) }), { status: 200 });
  return store;
};

const load = async () => import(`../upsolve.js?${Math.random()}`);

const viewFor = ({ createUpsolve }, state, elements) => createUpsolve({
  state,
  byId: (id) => (elements[id] ??= { checked: true, textContent: "" }),
  text: {
    upsolveLoadingText: "Loading {handle}",
    upsolveNoContestText: "{handle} has not taken part in a contest yet, so there is nothing to add.",
  },
  fill: fillText,
  failureText: String,
  waitForTurn: async () => true,
  lang: "en",
  FRESH_FOR: 600000,
  CLOCK_SLACK: 60000,
  refreshList: () => {},
});

const problemset = { problems: [], problemStatistics: [] };

test("the rated contests kept are those of the latest handles, not every handle ever looked up", async () => {
  const store = installPage((url) => (url.includes("problemset") ? problemset : [{ contestId: 1 }]));
  const upsolve = await load();
  const state = { handle: "", solved: null, rows: [], sort: { key: "rating" } };
  const view = viewFor(upsolve, state, {});
  const realNow = Date.now;
  let stamp = 1700000000000;
  Date.now = () => (stamp += 1000);
  try {
    for (const handle of ["a", "b", "c", "d", "e"]) {
      state.handle = handle;
      state.solved = { keys: [], twins: [], starts: [], taken: [], rows: [] };
      await view.ensure();
    }
  } finally {
    Date.now = realNow;
  }
  assert.deepEqual([...store.keys()].filter((key) => key.includes("/rating.v1/")).sort(), [
    "https://example.test/app/rating.v1/c",
    "https://example.test/app/rating.v1/d",
    "https://example.test/app/rating.v1/e",
  ]);
});

test("a handle that took part in no contest gets a line saying so, also when the view is read from memory", async () => {
  installPage((url) => (url.includes("problemset") ? problemset : []));
  const upsolve = await load();
  const elements = {};
  const state = { handle: "Nobody", solved: { keys: [], twins: [], starts: [], taken: [], rows: [] }, rows: [], sort: { key: "rating" } };
  const view = viewFor(upsolve, state, elements);
  await view.ensure();
  assert.equal(elements.upsolveStatus.textContent, "Nobody has not taken part in a contest yet, so there is nothing to add.");
  elements.upsolveStatus.textContent = "";
  await view.ensure();
  assert.equal(elements.upsolveStatus.textContent, "Nobody has not taken part in a contest yet, so there is nothing to add.");
  state.solved = { ...state.solved, taken: [5] };
  await view.ensure();
  assert.equal(elements.upsolveStatus.textContent, "");
});

test("sorting by the solved counts reads the problem list, not the rated contests", async () => {
  const urls = [];
  const store = new Map();
  const cache = {
    async match(request) {
      const body = store.get(request.url ?? request);
      return body === undefined ? undefined : new Response(body);
    },
    async put(request, response) {
      store.set(request.url ?? request, await response.text());
    },
    async keys() {
      return [...store.keys()].map((url) => ({ url }));
    },
    async delete(url) {
      return store.delete(url);
    },
  };
  globalThis.window = { location: { href: "https://example.test/app/" } };
  globalThis.caches = { open: async () => cache };
  globalThis.fetch = async (url) => {
    urls.push(url);
    const result = url.includes("problemset") ? { problems: [], problemStatistics: [] } : [{ contestId: 1 }];
    return new Response(JSON.stringify({ status: "OK", result }), { status: 200 });
  };
  const upsolve = await load();
  const elements = { upsolve: { checked: false, textContent: "" } };
  let refreshed = 0;
  const view = upsolve.createUpsolve({
    state: { handle: "tourist", solved: { keys: [], twins: [], starts: [], taken: [], rows: [] }, rows: [], sort: { key: "solved" } },
    byId: (id) => (elements[id] ??= { checked: true, textContent: "" }),
    text: { upsolveLoadingText: "Loading {handle}", upsolveNoContestText: "{handle} has not taken part in a contest yet, so there is nothing to add." },
    fill: fillText,
    failureText: String,
    waitForTurn: async () => true,
    lang: "en",
    FRESH_FOR: 600000,
    CLOCK_SLACK: 60000,
    refreshList: () => { refreshed += 1; },
  });
  await view.ensure();
  assert.equal(urls.some((url) => url.includes("user.rating")), false, "the solved counts need no rated contests");
  assert.equal(urls.filter((url) => url.includes("problemset")).length, 1, "the problem list is read once");
  assert.equal(refreshed, 1, "the list is drawn again so the solved counts show");
});
