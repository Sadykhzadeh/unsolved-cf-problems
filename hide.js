// Problems put out of sight: a row's button hides it, "Show hidden" brings them back,
// and the choice is kept per handle in localStorage. Read the first time a list with
// rows is shown (see loadHideView() in script.js).

export const createHide = ({ state, byId, text, fill, problemKey, remember, drawn, applyFilters }) => {
  // A hidden row only shows with "Show hidden" ticked, struck through and with
  // a button to bring it back.
  const markHidden = (tr, problem, isHidden) => {
    tr.classList.toggle("dismissed", isHidden);
    const button = tr.querySelector("button.hide");
    const label = fill(isHidden ? text.unhideButton : text.hideButton, { problem: problemKey(problem) });
    button.title = label;
    button.setAttribute("aria-label", label);
  };

  // Problems put out of sight, as a Set of problem keys per handle, kept in
  // localStorage until they are shown again. They are one person's choice, so
  // they stay out of links. A problem that gets solved leaves the list anyway.
  const HIDDEN_KEY = "unsolved-cf-problems:hidden";
  const hiddenSets = new Map();

  const readHiddenStore = () => {
    try {
      const store = JSON.parse(localStorage.getItem(HIDDEN_KEY));
      if (store && typeof store === "object" && !Array.isArray(store)) return Object.assign(Object.create(null), store);
    } catch {
      // Unreadable or blocked storage hides nothing.
    }
    return Object.create(null);
  };

  const hiddenFor = (handle) => {
    const id = handle.toLowerCase();
    if (!hiddenSets.has(id)) {
      const keys = readHiddenStore()[id];
      hiddenSets.set(id, new Set(Array.isArray(keys) ? keys.filter((key) => typeof key === "string") : []));
    }
    return hiddenSets.get(id);
  };

  const saveHidden = (handle) => {
    const store = readHiddenStore();
    const id = handle.toLowerCase();
    const keys = [...hiddenFor(handle)];
    if (keys.length) store[id] = keys;
    else delete store[id];
    remember(HIDDEN_KEY, JSON.stringify(store));
  };

  // Hiding a row moves the focus to the next row still showing, or the one
  // before it, rather than dropping it to the page with the row.
  byId("table-list").addEventListener("click", (event) => {
    const button = event.target.closest("button.hide");
    if (!button) return;
    const at = drawn().findIndex(([tr]) => tr.contains(button));
    if (at === -1) return;
    const [tr, problem] = drawn()[at];
    const hidden = hiddenFor(state.handle);
    const key = problemKey(problem);
    const isHidden = !hidden.has(key);
    if (isHidden) hidden.add(key);
    else hidden.delete(key);
    saveHidden(state.handle);
    markHidden(tr, problem, isHidden);
    applyFilters();
    if (!tr.hidden) return;
    const next = drawn().slice(at + 1).find(([other]) => !other.hidden)
      ?? drawn().slice(0, at).reverse().find(([other]) => !other.hidden);
    (next ? next[0].querySelector("button.hide") : byId("searchTask")).focus();
  });

  // A problem hidden or brought back in another tab is hidden or brought back
  // here too, so that the next change here does not write over it.
  window.addEventListener("storage", (event) => {
    if (event.key !== HIDDEN_KEY && event.key !== null) return;
    hiddenSets.clear();
    const hidden = hiddenFor(state.handle);
    for (const [tr, row] of drawn()) markHidden(tr, row, hidden.has(problemKey(row)));
    applyFilters();
  });

  return { hiddenFor, mark: markHidden };
};
