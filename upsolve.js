// The upsolve view: the problems of the contests a handle took part in that it has not
// tried, the solved counts, and the notes on the problem ids. Read on first use (see
// loadUpsolve() in script.js), so a visit that does not use the view does not read it.
import { LookupFailure, describeFailure, fetchApi } from "./lib.js";
import {
  attachSolvedCounts, contestNote, contestProgress, listedCheck, packProblemset, ratedContestIds,
  shareInFlight, tookPartIn, unpackProblemset, untriedRows,
} from "./lib-upsolve.js";

export const createUpsolve = ({ state, byId, text, fill, failureText, waitForTurn, lang, FRESH_FOR, refreshList: refreshHost }) => {
  const refreshList = () => refreshHost();

// Upsolve: the problems of the contests the handle was rated in that it never
// tried. The problem list is the same for everyone and comes in one language per
// name, so it is kept per language for six hours; the rated contests are kept per
// handle for as long as a lookup is. Both are read in the Cache API, the same
// way as the friend, with the same call spacing and retries.
  const PROBLEMSET_CACHE = "unsolved-cf-problemset";
  const PROBLEMSET_FRESH = 6 * 60 * 60 * 1000;

  const readKept = async (key) => {
    try {
      const response = await (await caches.open(PROBLEMSET_CACHE)).match(new URL(key, window.location.href).href);
      const entry = await response?.json();
      return Number.isFinite(entry?.savedAt) ? entry : null;
    } catch {
      return null;
    }
  };

  const writeKept = async (key, value) => {
    try {
      const cache = await caches.open(PROBLEMSET_CACHE);
      await cache.put(new URL(key, window.location.href).href, new Response(JSON.stringify({ savedAt: Date.now(), value }), {
        headers: { "Content-Type": "application/json" },
      }));
    } catch {
      // Not kept; the next visit reads it again.
    }
  };

  // One answer from the API, once the call spacing allows it. Null when nothing
  // wants the answer by then.
  const callApi = async (url, wanted) => {
    if (!await waitForTurn(wanted)) return null;
    const { response, payload } = await fetchApi(url, { again: () => waitForTurn(wanted) });
    if (response.ok && payload?.status === "OK" && payload.result !== undefined) return payload.result;
    throw new LookupFailure(describeFailure(response.status, payload));
  };

  // Every lookup that overlaps another asks for the same list, so they share one
  // request. The request is not tied to the lookup that started it: the list is the
  // same for all of them, and each lookup decides for itself whether to use it.
  const problemsetOnce = shareInFlight((url) => callApi(url, () => true));

  const loadProblemset = async () => {
    const key = `problemset.v1/${lang}`;
    const kept = await readKept(key);
    const usable = kept ? unpackProblemset(kept.value) : null;
    if (usable && Date.now() - kept.savedAt < PROBLEMSET_FRESH) return usable;
    let result;
    try {
      result = await problemsetOnce(`https://codeforces.com/api/problemset.problems?lang=${encodeURIComponent(lang)}`);
    } catch (error) {
      if (usable) return usable;
      throw error;
    }
    const packed = packProblemset(result);
    await writeKept(key, packed);
    return unpackProblemset(packed);
  };

  // The ids of the contests the handle was rated in.
  const loadRatedContests = async (handle, wanted) => {
    const key = `rating.v1/${handle.toLowerCase()}`;
    const kept = await readKept(key);
    if (kept && Date.now() - kept.savedAt < FRESH_FOR && Array.isArray(kept.value)) return new Set(kept.value);
    let changes;
    try {
      changes = await callApi(`https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`, wanted);
    } catch (error) {
      if (kept && Array.isArray(kept.value)) return new Set(kept.value);
      throw error;
    }
    if (!changes) return null;
    const ids = [...ratedContestIds(changes)];
    await writeKept(key, ids);
    return new Set(ids);
  };

  // The problem list read this visit, and the contests of the handle it was read for.

  let upsolveNumber = 0;
  const upsolveData = { problems: null, handle: "", contests: null };
  let check = null;
  let checkFor = null;
  let notesFor = null;
  let progress = new Map();

  // The check is built once per history, and kept while the history is the same:
  // a refresh that only changes the view reuses it.
  const listedCheckFor = () => {
    if (checkFor !== state.solved) {
      check = listedCheck(state.solved, state.rows);
      checkFor = state.solved;
    }
    return check;
  };

  // The solved counts come with the problem list. They show in the upsolve view,
  // and when the list is sorted by them.
  const countsShown = () => (byId("upsolve").checked || state.sort.key === "solved")
    && Boolean(upsolveData.problems);

  // The history the notes on the problem ids belong to, or null while none show.
  const shownFor = () => (countsShown() ? state.solved : null);

  // Per contest, how many problems the handle has solved, for the notes on the problem ids.
  const progressFor = () => {
    const want = shownFor();
    if (want !== notesFor) {
      notesFor = want;
      progress = want ? contestProgress(upsolveData.problems, want) : new Map();
    }
    return progress;
  };

  const extraRows = () => {
    if (countsShown()) attachSolvedCounts(state.rows, upsolveData.problems);
    progressFor();
    const ready = byId("upsolve").checked && state.solved && upsolveData.problems && upsolveData.contests
      && upsolveData.handle === state.handle.toLowerCase();
    return ready ? untriedRows(upsolveData.problems, tookPartIn(upsolveData.contests, state.solved.taken), listedCheckFor()) : [];
  };

  const note = (contestId, template) => contestNote(progressFor(), contestId, template);

  // Reads what the upsolve view needs for the handle on screen, once, and then
  // shows the list with it. A newer call, or the box being unticked, drops this one.
  const ensure = async () => {
    const number = ++upsolveNumber;
    const handle = state.handle;
    const wanted = () => number === upsolveNumber;
    if (!(byId("upsolve").checked || state.sort.key === "solved") || !state.solved || !handle) return;
    if (upsolveData.problems && upsolveData.contests && upsolveData.handle === handle.toLowerCase()) {
      refreshList();
      return;
    }
    byId("upsolveStatus").textContent = fill(text.upsolveLoadingText, { handle });
    try {
      const problems = upsolveData.problems ?? await loadProblemset();
      upsolveData.problems = problems;
      const contests = await loadRatedContests(handle, wanted);
      if (!contests) return;
      upsolveData.contests = contests;
      upsolveData.handle = handle.toLowerCase();
    } catch (error) {
      if (!wanted()) return;
      console.error(error);
      byId("upsolveStatus").textContent = failureText(error, handle);
      return;
    }
    if (!wanted()) return;
    byId("upsolveStatus").textContent = "";
    refreshList();
  };

  // The box was unticked: a request still on its way is dropped.
  const off = () => {
    upsolveNumber++;
    byId("upsolveStatus").textContent = "";
  };

  return { ensure, off, extraRows, note, shown: countsShown, shownFor };
};
