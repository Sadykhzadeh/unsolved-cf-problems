import {
  ageParts,
  defaultDescending,
  describeFailure,
  findUnsolved,
  makeFilter,
  matchesFilter,
  packRows,
  problemLink,
  readParams,
  sortRows,
  submissionLink,
  tagCounts,
  unpackRows,
  verdictLabel,
  writeParams,
} from "./lib.js";

const localize = [{
  "en": {
    searchHandleButton: "Search unsolved tasks",
    showTagsChexBox: " Show problem's tags",
    counterOfProblems: `😱 Count of problems: `,
    nameTD: "Name ",
    tagsTD: "Tags",
    ratingTD: "Rating",
    triesTD: "Tries",
    verdictTD: "Last verdict",
    lastTriedTD: "Last attempt",
    congratsText: "Congratulations, You haven't got any unsolved tasks! 🥳",
    loadingText: "Loading the submissions of {handle}...",
    notFoundText: ":( There is no Codeforces user called \"{handle}\".",
    badHandleText: ":( Codeforces did not accept this handle: {detail}",
    rateLimitedText: ":( Codeforces is limiting requests right now. Wait a few seconds and try again.",
    unavailableText: ":( Codeforces is not answering ({detail}). It may be down for maintenance; try again later.",
    otherErrorText: ":( Codeforces returned an error: {detail}",
    networkErrorText: ":( Could not reach Codeforces. Check your connection and try again.",
    aboutButton: "About",
    aboutProject: "More about the Project",
    searchPlaceholder: "Search by name or id",
    maxRating: "Maximum rating",
    anyTag: "Any tag",
    shownText: "Showing {shown} of {total}",
    updatedText: "Updated {ago}.",
    justNow: "just now",
    refreshingText: "Checking Codeforces for changes...",
    refreshButton: "Refresh",
    showingSavedText: "Showing what was saved {ago}.",
  },
  "ru": {
    searchHandleButton: "Поиск нерешённых задач",
    showTagsChexBox: " Показывать теги задач",
    counterOfProblems: `😱 Количество задач: `,
    nameTD: "Название ",
    tagsTD: "Теги",
    ratingTD: "Рейтинг",
    triesTD: "Попытки",
    verdictTD: "Последний вердикт",
    lastTriedTD: "Последняя попытка",
    congratsText: "Поздравляю, У тебя нет нерешённых задач! 🥳",
    loadingText: "Загружаю посылки {handle}...",
    notFoundText: ":( На Codeforces нет пользователя «{handle}».",
    badHandleText: ":( Codeforces не принял этот хендл: {detail}",
    rateLimitedText: ":( Codeforces сейчас ограничивает число запросов. Подождите несколько секунд и попробуйте снова.",
    unavailableText: ":( Codeforces не отвечает ({detail}). Возможно, идут технические работы; попробуйте позже.",
    otherErrorText: ":( Codeforces вернул ошибку: {detail}",
    networkErrorText: ":( Не удалось связаться с Codeforces. Проверьте соединение и попробуйте снова.",
    aboutButton: "О проекте",
    aboutProject: "Подробнее о проекте",
    searchPlaceholder: "Поиск по названию или номеру",
    maxRating: "Максимальный рейтинг",
    anyTag: "Любой тег",
    shownText: "Показано {shown} из {total}",
    updatedText: "Обновлено {ago}.",
    justNow: "только что",
    refreshingText: "Проверяю, что изменилось на Codeforces...",
    refreshButton: "Обновить",
    showingSavedText: "Показаны данные, сохранённые {ago}.",
  },
}];

const byId = (id) => document.getElementById(id);

// Anything the generator cannot read is not a language. localStorage.lang used
// to be trusted as-is, so one bad value left every label undefined until it
// was cleared by hand.
const LANGUAGES = ["en", "ru"];
const isLanguage = (value) => LANGUAGES.includes(value);

const pickLanguage = () => {
  const fromUrl = new URL(window.location.href).searchParams.get("lang");
  if (isLanguage(fromUrl)) return fromUrl;
  if (isLanguage(localStorage.lang)) return localStorage.lang;
  return "en";
};

const lang = pickLanguage();
const text = localize[0][lang];

const onloadFunction = (lang) => {
  localStorage.lang = lang;
  // The page is bilingual, so the document has to say which one it is in.
  document.documentElement.lang = lang;
  byId("handle").value = localStorage.handle ?? "";
  byId("doNotShowTags-label").textContent = text.showTagsChexBox;
  byId("about").textContent = text.aboutButton;
  byId("refresh").textContent = text.refreshButton;
  byId("nameLabel").textContent = text.nameTD;
  byId("searchTask").placeholder = text.searchPlaceholder;
  byId("searchTask").setAttribute("aria-label", text.searchPlaceholder);
  byId("ratingFilterLabel").textContent = text.ratingTD;
  byId("maxRating").setAttribute("aria-label", text.maxRating);
  byId("ratingLabel").textContent = text.ratingTD;
  byId("triesLabel").textContent = text.triesTD;
  byId("verdictTD").textContent = text.verdictTD;
  byId("lastTriedLabel").textContent = text.lastTriedTD;
  byId("tagsTD").textContent = text.tagsTD;
};

// A link can name the handle, the sort and the filters; anything it leaves
// out falls back to the remembered handle and the defaults.
const applyParams = () => {
  const params = readParams(window.location.search);
  if (params.handle) byId("handle").value = params.handle;
  if (params.sort) state.sort = params.sort;
  byId("searchTask").value = params.query;
  byId("minRating").value = params.min;
  byId("maxRating").value = params.max;
  pendingTag = params.tag;
  byId("doNotShowTags").checked = params.showTags;
};

const currentParams = () => ({
  handle: state.handle || byId("handle").value.trim(),
  sort: state.sort,
  query: byId("searchTask").value,
  min: byId("minRating").value,
  max: byId("maxRating").value,
  tag: byId("tagFilter").value || pendingTag,
  showTags: byId("doNotShowTags").checked,
});

// Keeps the address bar a link to what is on screen, and the language flags
// pointing at the same view in the other language. Typing is debounced:
// browsers throttle pages that rewrite history on every keystroke.
let urlTimer = 0;
const syncUrl = () => {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const params = currentParams();
    const search = writeParams(params);
    history.replaceState(history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    for (const link of document.querySelectorAll("#flags a[data-lang]")) {
      link.href = `?${writeParams({ ...params, lang: link.dataset.lang })}`;
    }
  }, 250);
};

document.addEventListener("DOMContentLoaded", () => {
  onloadFunction(lang);
  applyParams();
  byId("start").click();
});

byId("handle").addEventListener("keyup", (event) => {
  if (event.key === "Enter") byId("start").click();
});

const anchor = (href, label) => {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  // A _blank target with no rel hands the opened page a handle back to this
  // one through window.opener.
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
};

const cell = (content, title) => {
  const td = document.createElement("td");
  if (title) td.title = title;
  if (content instanceof Node) td.append(content);
  else td.textContent = content;
  return td;
};

const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });

const buildRow = (problem, showTags) => {
  const href = problemLink(problem);
  const row = document.createElement("tr");

  row.append(cell(anchor(href, `${problem.contestId}|${problem.index}`)));

  const name = anchor(href, problem.name);
  // Every row used to carry id="problemName", so the document had as many
  // elements with that id as it had rows. A class is what this wanted.
  name.className = "problemName";
  row.append(cell(name));

  if (showTags) {
    row.append(cell(problem.tags.length ? problem.tags.join(", ") : "-"));
  }

  row.append(cell(problem.rating === undefined ? "-" : String(problem.rating), "Rating"));
  row.append(cell(String(problem.tries)));

  const [short, full] = verdictLabel(problem.verdict);
  row.append(cell(short, full));

  const when = anchor(submissionLink(problem), dateFormat.format(problem.lastTime * 1000));
  when.title = `#${problem.submissionId}`;
  const whenCell = cell(when);
  whenCell.className = "when";
  row.append(whenCell);

  return row;
};

const loadSubmissions = async (handle) => {
  // The handle went into the query unescaped, so one containing & or # built
  // a different request than intended.
  const url = `https://codeforces.com/api/user.status?handle=${
    encodeURIComponent(handle)
  }&lang=${encodeURIComponent(lang)}`;
  const response = await fetch(url);
  // Errors come back as JSON with a comment saying what went wrong, except
  // when Codeforces itself is down and an HTML page answers instead.
  const payload = await response.json().catch(() => null);
  // The API answers 200 with {status: "FAILED"}. payload.result was read
  // regardless, and `for (const item of undefined)` threw.
  if (response.ok && payload?.status === "OK" && Array.isArray(payload.result)) {
    return payload.result;
  }
  throw new LookupFailure(describeFailure(response.status, payload));
};

class LookupFailure extends Error {
  constructor(failure) {
    super(failure.detail);
    this.failure = failure;
  }
}

const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);

const failureText = (error, handle) => {
  // fetch rejects with a TypeError when the request never got an answer.
  if (!(error instanceof LookupFailure)) {
    return error instanceof TypeError ? text.networkErrorText : String(error.message || error);
  }
  const { kind, detail } = error.failure;
  return fill(text[`${kind}Text`], { handle, detail });
};

// The last lookup, kept so that showing tags or filtering redraws from memory
// instead of asking Codeforces for every submission again.
const state = { handle: "", rows: [], savedAt: null, sort: { key: "rating", descending: false } };

// Each drawn <tr> with the row it shows, so filtering only flips `hidden`
// instead of rebuilding the table.
let drawn = [];
let built = new WeakMap();
let builtWithTags = false;

const applyFilters = () => {
  const filter = makeFilter({
    query: byId("searchTask").value,
    min: byId("minRating").value,
    max: byId("maxRating").value,
    tag: byId("tagFilter").value,
  });
  let shown = 0;
  for (const [tr, row] of drawn) {
    const keep = matchesFilter(row, filter);
    tr.hidden = !keep;
    if (keep) shown += 1;
  }
  byId("shown").textContent = shown === drawn.length
    ? ""
    : fill(text.shownText, { shown, total: drawn.length });
};

// The tag list offers only tags that occur among the rows, with counts.
// A tag named by the link waits here until the list has tags to pick from.
let pendingTag = "";

const fillTagFilter = () => {
  const select = byId("tagFilter");
  const chosen = pendingTag || select.value;
  pendingTag = "";
  const any = new Option(text.anyTag, "");
  const options = tagCounts(state.rows).map(([tag, count]) => new Option(`${tag} (${count})`, tag));
  select.replaceChildren(any, ...options);
  select.value = options.some((option) => option.value === chosen) ? chosen : "";
};

const render = () => {
  const showTags = byId("doNotShowTags").checked;
  byId("tagsTD").hidden = !showTags;
  // Rows used to be appended with `innerHTML +=` inside the loop, which
  // reparses the whole table for every row - quadratic in the number of
  // problems, and problem names from the API landed in markup unescaped.
  // One fragment, one insertion.
  const fragment = document.createDocumentFragment();
  const { key, descending } = state.sort;
  // A re-sort moves the rows already built rather than building them again:
  // 2500 rows took 64 ms to rebuild.
  if (builtWithTags !== showTags) {
    built = new WeakMap();
    builtWithTags = showTags;
  }
  drawn = sortRows(state.rows, key, descending).map((problem) => {
    let tr = built.get(problem);
    if (!tr) {
      tr = buildRow(problem, showTags);
      built.set(problem, tr);
    }
    return [tr, problem];
  });
  for (const [tr] of drawn) fragment.append(tr);
  byId("table-list").replaceChildren(fragment);
  applyFilters();

  for (const button of document.querySelectorAll("button.sort")) {
    const th = button.closest("th");
    if (button.dataset.sort === key) th.setAttribute("aria-sort", descending ? "descending" : "ascending");
    else th.removeAttribute("aria-sort");
  }
};

// Clicking a header sorts by it; clicking it again reverses the order.
for (const button of document.querySelectorAll("button.sort")) {
  button.addEventListener("click", () => {
    const key = button.dataset.sort;
    state.sort = state.sort.key === key
      ? { key, descending: !state.sort.descending }
      : { key, descending: defaultDescending(key) };
    if (state.rows.length) render();
    syncUrl();
  });
}

// The search box used to be created anew in the Name header on every lookup,
// while its listener was attached only to the first one, so after a second
// lookup typing in it did nothing. The filters are in the page once.
for (const id of ["searchTask", "minRating", "maxRating", "tagFilter"]) {
  byId(id).addEventListener("input", () => {
    applyFilters();
    syncUrl();
  });
}

// "/" jumps to the search box from anywhere but another field, as on most
// sites with a search.
document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
  if (byId("filters").hidden) return;
  event.preventDefault();
  byId("searchTask").focus();
  byId("searchTask").select();
});

// Showing tags used to take effect only on the next lookup, which meant
// downloading every submission again.
byId("doNotShowTags").addEventListener("change", () => {
  if (state.rows.length) render();
  syncUrl();
});

// Lookups are kept in localStorage, so a revisit, a reload or a language
// switch shows the list at once instead of after a multi-megabyte download.
// A copy younger than FRESH_FOR is used as it is; an older one is shown
// while a fresh one loads. Only the last few handles are kept, because the
// storage is shared with every other page on this origin.
const SAVED_KEY = "unsolved-cf-problems:lookups";
const SAVED_VERSION = 1;
const FRESH_FOR = 10 * 60 * 1000;
const KEEP_HANDLES = 3;

const savedId = (handle) => `${lang}:${handle.toLowerCase()}`;

const readStore = () => {
  try {
    const store = JSON.parse(localStorage.getItem(SAVED_KEY));
    if (store?.version === SAVED_VERSION && store.entries && typeof store.entries === "object") return store;
  } catch {
    // Unreadable or blocked storage is the same as an empty one.
  }
  return { version: SAVED_VERSION, entries: {} };
};

const readSaved = (handle) => {
  const entry = readStore().entries[savedId(handle)];
  const rows = entry && Number.isFinite(entry.savedAt) ? unpackRows(entry.rows) : null;
  return rows ? { handle: entry.handle ?? handle, savedAt: entry.savedAt, rows } : null;
};

const writeStore = (store) => {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
};

const save = (handle, rows, savedAt) => {
  const store = readStore();
  const id = savedId(handle);
  store.entries[id] = { handle, savedAt, rows: packRows(rows) };
  const newestFirst = Object.keys(store.entries)
    .sort((a, b) => store.entries[b].savedAt - store.entries[a].savedAt);
  for (const old of newestFirst.slice(KEEP_HANDLES)) delete store.entries[old];
  // Over quota: keep just this lookup, and failing that, nothing.
  if (!writeStore(store)) writeStore({ version: SAVED_VERSION, entries: { [id]: store.entries[id] } });
};

const forget = (handle) => {
  const store = readStore();
  delete store.entries[savedId(handle)];
  writeStore(store);
};

const relativeTime = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
const ago = (savedAt) => {
  const [value, unit] = ageParts(Date.now() - savedAt);
  return value === 0 ? text.justNow : relativeTime.format(value, unit);
};

const showFreshness = (refreshing) => {
  const line = byId("freshness");
  line.hidden = !state.savedAt;
  if (!state.savedAt) return;
  byId("savedAgo").textContent = refreshing
    ? text.refreshingText
    : fill(text.updatedText, { ago: ago(state.savedAt) });
  byId("refresh").disabled = refreshing;
};

// Keeps "updated 3 minutes ago" true while the page stays open.
setInterval(() => {
  if (!byId("freshness").hidden && !byId("refresh").disabled) showFreshness(false);
}, 30 * 1000);

const showResults = () => {
  const counter = byId("counter");
  showFreshness(false);
  if (!state.rows.length) {
    byId("table-main").hidden = true;
    byId("filters").hidden = true;
    byId("table-list").replaceChildren();
    drawn = [];
    counter.textContent = state.handle ? text.congratsText : "";
    return;
  }
  byId("table-main").hidden = false;
  byId("filters").hidden = false;
  counter.textContent = `${text.counterOfProblems} ${state.rows.length}`;
  render();
};

const clearResults = () => {
  state.handle = "";
  state.rows = [];
  state.savedAt = null;
  drawn = [];
  byId("table-main").hidden = true;
  byId("filters").hidden = true;
  byId("freshness").hidden = true;
  byId("table-list").replaceChildren();
  delete byId("table-list").dataset.showing;
};

const setBusy = (busy) => {
  byId("start").disabled = busy;
  byId("refresh").disabled = busy;
};

// A response that arrives after a newer lookup started is dropped.
let lookupNumber = 0;

const lookup = async (handle, { force = false } = {}) => {
  const number = ++lookupNumber;
  const counter = byId("counter");
  delete byId("table-list").dataset.showing;
  const sameHandle = state.savedAt !== null && state.handle.toLowerCase() === handle.toLowerCase();

  if (!sameHandle) {
    clearResults();
    if (handle === "") {
      counter.textContent = "";
      syncUrl();
      return;
    }
    const saved = readSaved(handle);
    if (saved) {
      Object.assign(state, saved);
      fillTagFilter();
      showResults();
    }
  }

  try {
    localStorage.handle = handle;
  } catch {
    // Remembering the handle is a convenience, not a requirement.
  }
  syncUrl();
  if (!force && state.savedAt !== null && Date.now() - state.savedAt < FRESH_FOR) return;

  setBusy(true);
  if (state.savedAt !== null) showFreshness(true);
  else counter.textContent = fill(text.loadingText, { handle });

  try {
    const submissions = await loadSubmissions(handle);
    if (number !== lookupNumber) return;
    state.handle = handle;
    state.rows = findUnsolved(submissions);
    state.savedAt = Date.now();
    save(handle, state.rows, state.savedAt);
    fillTagFilter();
    showResults();
  } catch (error) {
    if (number !== lookupNumber) return;
    // Nothing caught a failed fetch, so a dropped connection left the page on
    // "Loading..." with both controls disabled and no way back.
    console.error(error);
    // Only forget the handle when it is the handle that was wrong. A dropped
    // connection or a busy Codeforces used to wipe it too, so the next visit
    // opened on an empty form.
    const kind = error.failure?.kind;
    if (kind === "notFound" || kind === "badHandle") {
      try {
        localStorage.handle = "";
      } catch {
        // See above.
      }
      forget(handle);
      clearResults();
    }
    const message = failureText(error, handle);
    if (state.savedAt !== null) {
      // What was saved is still worth seeing; say how old it is.
      showFreshness(false);
      counter.textContent = `${message} ${fill(text.showingSavedText, { ago: ago(state.savedAt) })}`;
    } else {
      counter.textContent = message;
    }
  } finally {
    // This used to be the last statement of the handler, so anything that
    // threw on the way left the form dead.
    if (number === lookupNumber) setBusy(false);
  }
};

// Searching for the handle already on screen means "check again", so it
// skips the saved copy; any other handle starts from its saved copy if there
// is one.
byId("start").addEventListener("click", () => {
  const handle = byId("handle").value.trim();
  const again = state.savedAt !== null && state.handle.toLowerCase() === handle.toLowerCase();
  lookup(handle, { force: again });
});

byId("refresh").addEventListener("click", () => {
  if (state.handle) lookup(state.handle, { force: true });
});

byId("about").addEventListener("click", () => {
  const tableList = byId("table-list");
  byId("table-main").hidden = true;
  byId("filters").hidden = true;
  byId("counter").textContent = "";

  // The old version decided whether the panel was open by searching the
  // table's markup for the string "sadykhzadeh". Closing it used to leave an
  // empty page; the last results come back instead.
  if (tableList.dataset.showing === "about") {
    tableList.replaceChildren();
    delete tableList.dataset.showing;
    showResults();
    return;
  }

  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 7;
  td.append(anchor(
    `https://codeforces.com/blog/entry/79960?locale=${encodeURIComponent(lang)}`,
    text.aboutProject,
  ));
  td.append(document.createElement("br"));
  const credits = document.createElement("small");
  credits.append(anchor("https://got.az/azer/unsolved-cf-problems", "Source"));
  credits.append(document.createTextNode(" | "));
  credits.append(anchor("https://azer.one", "Azer Sadykhzadeh"));
  td.append(credits);
  row.append(td);

  tableList.replaceChildren(row);
  tableList.dataset.showing = "about";
});
