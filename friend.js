// A friend's view: the friend's solved problems, read from the Cache API and the
// history, and kept as the friend filter needs them. Read the first time a friend
// is chosen (see loadFriend() in script.js).
import { isFresh, solvedCheck, solvedSummary } from "./lib.js";

export const createFriend = ({
  friend, byId, text, fill, failureText, waitForTurn, lang, FRESH_FOR, CLOCK_SLACK,
  applyFilters, syncUrl, loadHistory, noteHandle, forgetHistory,
}) => {
  // A friend's submissions are boiled down to what they solved and kept in the
  // Cache API, which has room for them where localStorage does not: jiangly's
  // 6.3 MB come to 329 KB. Only the latest friend is kept. Problem names come in
  // the page's language and are matched by name, so the copy is per language.
  const CACHE_NAME = "unsolved-cf-problems";
  const friendCacheKey = (handle) =>
    new URL(`friend.v1/${lang}/${encodeURIComponent(handle.toLowerCase())}`, window.location.href).href;

  const openCache = async () => {
    try {
      // Missing outside secure contexts, and throws when site data is blocked.
      return await caches.open(CACHE_NAME);
    } catch {
      return null;
    }
  };

  const readFriend = async (handle) => {
    try {
      const response = await (await openCache())?.match(friendCacheKey(handle));
      const entry = await response?.json();
      const valid = Number.isFinite(entry?.savedAt)
        && Array.isArray(entry.summary?.keys) && Array.isArray(entry.summary.twins);
      return valid ? entry : null;
    } catch {
      return null;
    }
  };

  const saveFriend = async (handle, entry) => {
    const cache = await openCache();
    if (!cache) return;
    try {
      for (const request of await cache.keys()) await cache.delete(request);
      await cache.put(friendCacheKey(handle), new Response(JSON.stringify(entry), {
        headers: { "Content-Type": "application/json" },
      }));
    } catch {
      // Not kept; the next visit downloads it again.
    }
  };

  const forgetFriend = async (handle) => {
    try {
      await (await openCache())?.delete(friendCacheKey(handle));
    } catch {
      // Nothing kept, or no cache to forget it from.
    }
  };

  const useFriend = ({ savedAt, summary }) => {
    friend.savedAt = savedAt;
    friend.solvedBy = solvedCheck(summary);
    applyFilters();
  };

  // A friend is loaded like a lookup: a saved copy at once, a fresh one when
  // it is older than FRESH_FOR, and a newer choice drops an older one's answer.
  // Entering the same friend again tries again after a failure.
  let friendNumber = 0;
  let friendLoading = "";

  const loadFriend = async (handle) => {
    const key = handle.toLowerCase();
    if (friendLoading && friendLoading === key) return;
    const number = ++friendNumber;
    friendLoading = key;
    const status = byId("friendStatus");
    try {
      if (friend.handle.toLowerCase() !== key) {
        Object.assign(friend, { handle, savedAt: null, solvedBy: null });
        status.textContent = "";
        applyFilters();
        syncUrl();
        const saved = handle ? await readFriend(handle) : null;
        if (number !== friendNumber) return;
        if (saved) useFriend(saved);
      }
      if (!handle || (friend.savedAt !== null && isFresh(friend.savedAt, Date.now(), FRESH_FOR, CLOCK_SLACK))) return;
      if (friend.savedAt === null) status.textContent = fill(text.loadingText, { handle });
      if (!await waitForTurn(() => number === friendNumber)) return;
      const history = await loadHistory(handle, () => number === friendNumber);
      if (number !== friendNumber || !history) return;
      const entry = { savedAt: Date.now(), summary: solvedSummary(history.state) };
      noteHandle(handle);
      useFriend(entry);
      status.textContent = "";
      saveFriend(handle, entry);
    } catch (error) {
      if (number !== friendNumber) return;
      console.error(error);
      // A friend who no longer exists narrows nothing, and their copy is not
      // kept: the same as a handle that is not found.
      if (error.failure?.kind === "notFound" || error.failure?.kind === "badHandle") {
        Object.assign(friend, { savedAt: null, solvedBy: null });
        applyFilters();
        forgetFriend(handle);
        forgetHistory(handle);
      }
      status.textContent = failureText(error, handle);
    } finally {
      if (number === friendNumber) friendLoading = "";
    }
  };

  return { load: loadFriend };
};
