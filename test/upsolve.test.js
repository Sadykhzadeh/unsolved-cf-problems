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
  for (const handle of ["a", "b", "c", "d", "e"]) {
    state.handle = handle;
    state.solved = { keys: [], twins: [], starts: [], taken: [], rows: [] };
    await view.ensure();
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
