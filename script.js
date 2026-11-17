import {
  NEWEST_COUNT,
  advance,
  countText,
  ratingBandName,
  weakTagName,
  solvedFor,
  ageParts,
  relativeAge,
  defaultDescending,
  describeFailure,
  emptyDigest,
  emptyKind,
  failedTest,
  fetchApi,
  LookupFailure,
  hasTagCounts,
  isFresh,
  isTagCounts,
  isClearTagsKey,
  isPickKey,
  isSearchKey,
  isTimeout,
  isUsableDigest,
  isBucket,
  makeFilter,
  matchesFilter,
  packRows,
  parseHandle,
  pickOne,
  problemKey,
  problemLink,
  rankClass,
  ratingBuckets,
  rowKeyAction,
  readParams,
  reachesDigest,
  rememberHandle,
  rememberedView,
  solvedCheck,
  solvedSummary,
  sortRows,
  submissionLink,
  tagCounts,
  unpackRows,
  verdictLabel,
  viewOf,
  weakTags,
  writeParams,
} from "./lib.js";


const byId = (id) => document.getElementById(id);

// Remembering the language and the handle is a convenience. Storage can be
// full, or blocked outright (site data turned off), and then even reading
// it throws.
const recall = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const remember = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing is remembered, and the page works the same.
  }
};

// Only a language with labels counts; anything else in the link or in storage
// falls back to English rather than leaving every label undefined.
const LANGUAGES = ["en", "ru"];
const isLanguage = (value) => LANGUAGES.includes(value);

const pickLanguage = () => {
  const fromUrl = new URL(window.location.href).searchParams.get("lang");
  if (isLanguage(fromUrl)) return fromUrl;
  if (isLanguage(recall("lang"))) return recall("lang");
  return "en";
};

const lang = pickLanguage();
// The sentences load beside the page, for this language only. Everything that
// shows text waits for them; they arrive in about one round trip.
let text = null;
let pageTitle = "";
const textReady = import(`./strings-${lang}.js`).then(({ default: strings }) => {
  text = strings;
  pageTitle = strings.pageTitle;
});

const onloadFunction = (lang) => {
  remember("lang", lang);
  // The page is bilingual, so the document has to say which one it is in.
  document.documentElement.lang = lang;
  byId("heading").textContent = text.pageTitle;
  document.title = text.pageTitle;
  byId("handle").value = recall("handle") ?? "";
  showKnownHandles();
  byId("handleLabel").textContent = text.handleLabel;
  byId("handle").placeholder = text.handlePlaceholder;
  byId("start").title = text.searchHandleButton;
  byId("start").setAttribute("aria-label", text.searchHandleButton);
  byId("doNotShowTags-label").textContent = text.showTagsChexBox;
  byId("about").textContent = text.aboutButton;
  byId("refresh").textContent = text.refreshButton;
  byId("pick").textContent = text.pickButton;
  byId("pick").title = `${text.pickButton} (P)`;
  byId("copyMarkdown").textContent = text.copyMarkdownButton;
  byId("downloadCsv").textContent = text.downloadCsvButton;
  // The column is headed "#", which a screen reader would read as a symbol.
  byId("numberLabel").setAttribute("aria-label", text.problemTD);
  byId("nameLabel").textContent = text.nameTD;
  byId("searchTask").placeholder = text.searchPlaceholder;
  byId("searchTask").setAttribute("aria-label", text.searchPlaceholder);
  byId("ratingFilterLabel").textContent = text.ratingTD;
  byId("minRating").setAttribute("aria-label", text.minRating);
  byId("maxRating").setAttribute("aria-label", text.maxRating);
  byId("tagFilter").setAttribute("aria-label", text.tagsTD);
  byId("noGymLabel").textContent = text.noGymLabel;
  byId("noSpecialLabel").textContent = text.noSpecialLabel;
  byId("noSpecialLabel").parentElement.title = text.noSpecialTitle;
  byId("inRoundLabel").textContent = text.inRoundLabel;
  byId("inRoundLabel").parentElement.title = text.inRoundTitle;
  byId("friendLabel").textContent = text.friendLabel;
  byId("upsolveLabel").textContent = text.upsolveLabel;
  byId("friend").placeholder = text.friendPlaceholder;
  byId("ratingLabel").textContent = text.ratingTD;
  byId("triesLabel").textContent = text.triesTD;
  byId("verdictTD").textContent = text.verdictTD;
  byId("lastTriedLabel").textContent = text.lastTriedTD;
  byId("tagsTD").textContent = text.tagsTD;
  byId("hideLabel").textContent = text.hideTD;
  byId("solvedLabel").textContent = text.solvedLabel;
  byId("solvedLabel").parentElement.title = text.solvedTitle;
  for (const link of document.querySelectorAll("#flags a[data-lang]")) {
    if (link.dataset.lang === lang) link.setAttribute("aria-current", "true");
  }
};

// A link can name the handle, the sort and the filters; anything it leaves
// out falls back to the remembered handle and the defaults.
const VIEW_KEY = "unsolved-cf-problems:view";

// The handles looked up lately, offered again by the handle and friend fields.
const HANDLES_KEY = "unsolved-cf-problems:handles";

const knownHandles = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(HANDLES_KEY));
    return Array.isArray(stored) ? stored.filter((handle) => typeof handle === "string") : [];
  } catch {
    return [];
  }
};

const showKnownHandles = () => {
  byId("knownHandles").replaceChildren(...knownHandles().map((handle) => new Option(handle)));
};

const noteHandle = (handle) => {
  remember(HANDLES_KEY, JSON.stringify(rememberHandle(knownHandles(), handle)));
  showKnownHandles();
};

// `fresh` is a visit just begun: the remembered view fills in what the link
// leaves out. Back and Forward go to the view an entry was left in, as it is.
const applyParams = ({ fresh = false } = {}) => {
  const params = {
    ...readParams(window.location.search),
    ...(fresh ? rememberedView(recall(VIEW_KEY), window.location.search) : {}),
  };
  if (params.handle) byId("handle").value = params.handle;
  state.sort = params.sort ?? { key: "rating", descending: false };
  byId("searchTask").value = params.query;
  byId("minRating").value = params.min;
  byId("maxRating").value = params.max;
  chosenTags = params.tags;
  tagAny = params.tagAny;
  showTagChoice();
  byId("noGym").checked = params.noGym;
  byId("noSpecial").checked = params.noSpecial;
  byId("inRound").checked = params.inRound;
  byId("friend").value = params.friend;
  byId("doNotShowTags").checked = params.showTags;
  byId("upsolve").checked = params.upsolve;
};

const currentParams = () => ({
  lang: lang === "en" ? "" : lang,
  handle: state.handle || byId("handle").value.trim(),
  sort: state.sort,
  query: byId("searchTask").value,
  min: byId("minRating").value,
  max: byId("maxRating").value,
  tags: chosenTags,
  tagAny,
  noGym: byId("noGym").checked,
  noSpecial: byId("noSpecial").checked,
  friend: friend.handle,
  inRound: byId("inRound").checked,
  showTags: byId("doNotShowTags").checked,
  upsolve: byId("upsolve").checked,
});


// Keeps the address bar a link to what is on screen, and the language flags
// pointing at the same view in the other language. Typing is debounced:
// browsers throttle pages that rewrite history on every keystroke. The tab
// title names the handle, so tabs, bookmarks and history tell lists apart.
// Looking up another handle is a new history entry, so Back returns to the
// list before it; sorting and filtering only rewrite the current one.
let urlTimer = 0;
let urlNewEntry = false;
const syncUrl = ({ newEntry = false } = {}) => {
  clearTimeout(urlTimer);
  urlNewEntry ||= newEntry;
  urlTimer = setTimeout(() => {
    const params = currentParams();
    remember(VIEW_KEY, JSON.stringify(viewOf(params)));
    const search = writeParams(params);
    const shown = readParams(window.location.search).handle;
    const another = urlNewEntry && shown !== "" && params.handle !== ""
      && shown.toLowerCase() !== params.handle.toLowerCase();
    urlNewEntry = false;
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    if (another) history.pushState(null, "", url);
    else history.replaceState(history.state, "", url);
    document.title = params.handle ? `${params.handle} - ${pageTitle}` : pageTitle;
    for (const link of document.querySelectorAll("#flags a[data-lang]")) {
      link.href = `?${writeParams({ ...params, lang: link.dataset.lang })}`;
    }
  }, 250);
};

document.addEventListener("DOMContentLoaded", () => textReady.then(() => {
  onloadFunction(lang);
  applyParams({ fresh: true });
  byId("start").click();
  chooseFriend();
}));

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

// A hidden row only shows with "Show hidden" ticked, struck through and with
// a button to bring it back.
const markHidden = (tr, problem, isHidden) => {
  tr.classList.toggle("dismissed", isHidden);
  const button = tr.querySelector("button.hide");
  const label = fill(isHidden ? text.unhideButton : text.hideButton, { problem: problemKey(problem) });
  button.title = label;
  button.setAttribute("aria-label", label);
};

const buildRow = (problem, isHidden) => {
  const href = problemLink(problem);
  const row = document.createElement("tr");

  // The id stays on one line on a phone; see the td rule in styles.css.
  const id = cell(anchor(href, problemKey(problem)));
  id.className = "problemId";
  const note = upsolve ? upsolve.note(problem.contestId, text.contestProgressTitle) : "";
  if (note) id.firstChild.title = note;
  row.append(id);

  const name = anchor(href, problem.name);
  name.className = "problemName";
  row.append(cell(name));

  // Always built, and hidden by a class on the table body, so showing the
  // tags does not build every row again.
  const tags = cell(problem.tags.length ? problem.tags.join(", ") : "-");
  tags.className = "tags";
  row.append(tags);

  const rating = cell(problem.rating === undefined ? "-" : String(problem.rating), text.ratingTD);
  rating.className = rankClass(problem.rating);
  row.append(rating);

  // Shown only while the problemset has been read; see upsolveShown().
  const solvedBy = cell(problem.solvedCount === undefined ? "-" : String(problem.solvedCount));
  solvedBy.className = "solved";
  row.append(solvedBy);
  row.append(cell(String(problem.tries)));

  // A problem never tried has no verdict and no attempt: the date says so in words.
  if (problem.lastTime === undefined) {
    row.append(cell(""));
    const never = cell(text.neverTriedText);
    never.className = "when";
    row.append(never);
  } else {
    // "WA 37" for a wrong answer on test 37: how close the attempt came.
    const [short, full] = verdictLabel(problem.verdict, text.notJudgedText);
    const test = failedTest(problem);
    row.append(test
      ? cell(`${short} ${test.number}`, fill(test.pretest ? text.onPretestText : text.onTestText, {
        verdict: full, test: test.number,
      }))
      : cell(short, full));

    const when = anchor(submissionLink(problem), dateFormat.format(problem.lastTime * 1000));
    const [value, unit] = relativeAge(Date.now() - problem.lastTime * 1000);
    const age = relativeTime.format(value, unit);
    when.title = `${age} (#${problem.submissionId})`;
    const whenCell = cell(when, age);
    whenCell.className = "when";
    row.append(whenCell);
  }

  // Both glyphs are in the button, one of them hidden by CSS: changing the
  // text would change the width of the column, and with it the layout of
  // every row.
  const hide = document.createElement("button");
  hide.type = "button";
  hide.className = "hide";
  const keep = document.createElement("span");
  keep.className = "glyph-keep";
  keep.textContent = "×";
  const back = document.createElement("span");
  back.className = "glyph-back";
  back.textContent = "↩";
  hide.append(keep, back);
  row.append(cell(hide));
  markHidden(row, problem, isHidden);

  return row;
};

// `newest` asks for that many of the latest submissions rather than all of
// them: jiangly's 11000 come to 499 KB over the wire, the newest 300 to 11 KB.
const loadSubmissions = async (handle, wanted, newest) => {
  // Escaped, so a handle containing & or # cannot change the request.
  const url = `https://codeforces.com/api/user.status?handle=${
    encodeURIComponent(handle)
  }&lang=${encodeURIComponent(lang)}${newest ? `&from=1&count=${newest}` : ""}`;
  // Errors come back as JSON with a comment saying what went wrong, except
  // when Codeforces itself is down and an HTML page answers instead.
  const { response, payload } = await fetchApi(url, { again: () => waitForTurn(wanted) });
  // A failed call can still answer 200, with {status: "FAILED"} and no
  // result, so only an OK status with an array counts as submissions.
  if (response.ok && payload?.status === "OK" && Array.isArray(payload.result)) {
    return payload.result;
  }
  throw new LookupFailure(describeFailure(response.status, payload));
};

const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);

const failureText = (error, handle) => {
  // fetch rejects with a TypeError when the request never got an answer.
  if (!(error instanceof LookupFailure)) {
    if (isTimeout(error)) return text.timeoutText;
    return error instanceof TypeError ? text.networkErrorText : String(error.message || error);
  }
  const { kind, detail } = error.failure;
  return fill(text[`${kind}Text`], { handle, detail });
};

// The last lookup, kept so that showing tags or filtering redraws from memory
// instead of asking Codeforces for every submission again.
// `rows` are the problems attempted and unsolved; `extra` the problems never tried
// that the upsolve view adds (see ensureUpsolve()), kept apart so that a lookup
// saves only what it read. `solved` says what the handle has solved, for both.
const state = {
  handle: "", rows: [], extra: [], submissions: 0, solvedTags: {}, solved: null, savedAt: null,
  sort: { key: "rating", descending: false },
};

// Every row on the list: the attempted ones and, in the upsolve view, the untried ones.
const listRows = () => state.rows.concat(state.extra);

// The friend whose solved problems narrow the list, and once their
// submissions are in, the check for what they solved.
const friend = { handle: "", savedAt: null, solvedBy: null };

// Each drawn <tr> with the row it shows, so filtering only flips `hidden`
// instead of rebuilding the table.
let drawn = [];
let built = new WeakMap();
// The row last picked at random.
let picked = null;

// Problems put out of sight, as a Set of problem keys per handle, kept in
// localStorage until they are shown again. They are one person's choice, so
// they stay out of links. A problem that gets solved leaves the list anyway.
const HIDDEN_KEY = "unsolved-cf-problems:hidden";
const hiddenSets = new Map();

const readHiddenStore = () => {
  try {
    const store = JSON.parse(localStorage.getItem(HIDDEN_KEY));
    if (store && typeof store === "object" && !Array.isArray(store)) return store;
  } catch {
    // Unreadable or blocked storage hides nothing.
  }
  return {};
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

const applyFilters = () => {
  const filter = makeFilter({
    query: byId("searchTask").value,
    min: byId("minRating").value,
    max: byId("maxRating").value,
    tags: chosenTags,
    tagAny,
    noGym: byId("noGym").checked,
    noSpecial: byId("noSpecial").checked,
    solvedBy: friend.solvedBy,
    inRound: byId("inRound").checked,
    hidden: byId("showHidden").checked ? null : hiddenFor(state.handle),
  });
  let shown = 0;
  for (const [tr, row] of drawn) {
    const keep = matchesFilter(row, filter);
    tr.hidden = !keep;
    if (keep) shown += 1;
  }
  // The box to show hidden problems is there only while there are some.
  const hidden = hiddenFor(state.handle);
  const hiddenCount = drawn.filter(([, row]) => hidden.has(problemKey(row))).length;
  if (!hiddenCount) byId("showHidden").checked = false;
  byId("showHiddenBox").hidden = !hiddenCount;
  byId("showHiddenLabel").textContent = fill(text.showHiddenLabel, { count: hiddenCount });
  byId("shown").textContent = shown === drawn.length
    ? ""
    : fill(text.shownText, { shown, total: drawn.length });
  // An export of nothing is not offered, and a status from before the change is stale.
  byId("copyMarkdown").disabled = shown === 0;
  byId("downloadCsv").disabled = shown === 0;
  byId("exportStatus").textContent = "";
  markRatingBands();
};

// The rows on screen, in the order they show, for the export.
const visibleRows = () => drawn.filter(([tr]) => !tr.hidden).map(([, row]) => row);

byId("copyMarkdown").addEventListener("click", async () => {
  const rows = visibleRows();
  try {
    const { markdownTable } = await import("./lib-export.js");
    await navigator.clipboard.writeText(markdownTable(rows));
    byId("exportStatus").textContent = fill(text.copiedText, { count: rows.length });
  } catch {
    // Clipboard access is refused outside a secure page, or by the browser.
    byId("exportStatus").textContent = text.copyFailedText;
  }
});

// The CSV starts with a byte order mark, so a spreadsheet reads the names as UTF-8.
byId("downloadCsv").addEventListener("click", async () => {
  const { csvTable } = await import("./lib-export.js");
  const blob = new Blob(["﻿", csvTable(visibleRows())], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `unsolved-${state.handle.replace(/[^\w-]/g, "_") || "problems"}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// The tags the list is narrowed to, and whether a problem needs all of them
// or any. The list offers the tags that occur among the rows, with counts, and
// not the ones already chosen. Tags named by the link wait in chosenTags until
// the rows are in and show which of them occur.
let chosenTags = [];
let tagAny = false;

const showTagChoice = () => {
  const select = byId("tagFilter");
  const options = tagCounts(listRows())
    .filter(([tag]) => !chosenTags.includes(tag))
    .map(([tag, count]) => new Option(`${tag} (${count})`, tag));
  select.replaceChildren(new Option(chosenTags.length ? text.addTag : text.anyTag, ""), ...options);
  const chips = chosenTags.map((tag) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-chip";
    chip.dataset.tag = tag;
    chip.textContent = `${tag} ×`;
    chip.setAttribute("aria-label", fill(text.removeTag, { tag }));
    return chip;
  });
  byId("chosenTags").replaceChildren(...chips);
  const mode = byId("tagMode");
  mode.hidden = chosenTags.length < 2;
  mode.textContent = tagAny ? text.tagsAny : text.tagsAll;
  mode.title = text.tagModeTitle;
};

const fillTagFilter = () => {
  state.extra = upsolve ? upsolve.extraRows() : [];
  const present = new Set(listRows().flatMap((row) => row.tags));
  chosenTags = chosenTags.filter((tag) => present.has(tag));
  showTagChoice();
};

// Adds a tag to the filter: the same path whether it was picked from the list
// or from the tags that are weakest for the handle.
const addTag = (tag) => {
  chosenTags = [...chosenTags, tag];
  showTagChoice();
  applyFilters();
  syncUrl();
};

byId("tagFilter").addEventListener("input", (event) => {
  const tag = event.target.value;
  if (!tag) return;
  addTag(tag);
});

// The handle's weakest tags, above the list. Each one narrows the list to it,
// unless it is narrowed to already.
const showWeakTags = () => {
  const weak = state.rows.length && !aboutOpen() ? weakTags(state.rows, state.solvedTags) : [];
  byId("weakTags").hidden = !weak.length;
  byId("weakTagsLabel").textContent = text.weakTagsLabel;
  byId("weakTagsList").replaceChildren(...weak.map(({ tag, solved, attempted, unsolved }) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-chip";
    chip.dataset.tag = tag;
    chip.textContent = `${tag} ${solved}/${attempted}`;
    chip.title = fill(text.weakTagTitle, { solved, attempted, tag });
    chip.setAttribute("aria-label", weakTagName({ tag, solved, attempted, unsolved }, text.weakTagName));
    return chip;
  }));
};

byId("weakTagsList").addEventListener("click", (event) => {
  const chip = event.target.closest("button.tag-chip");
  if (!chip || chosenTags.includes(chip.dataset.tag)) return;
  addTag(chip.dataset.tag);
});

// The unsolved problems by rating, one button a hundred wide, its bar as tall as
// the band is full. A band narrows the rating fields to itself; the chosen band
// clears them. Buttons, so Tab and Enter or Space work as a mouse does.
const showRatingStrip = () => {
  const buckets = listRows().length && !aboutOpen() ? ratingBuckets(listRows()) : [];
  byId("ratingStrip").hidden = !buckets.length;
  byId("ratingStripLabel").textContent = text.ratingStripLabel;
  const tallest = Math.max(1, ...buckets.map((bucket) => bucket.count));
  byId("ratingBars").replaceChildren(...buckets.map(({ from, to, count }) => {
    const band = document.createElement("button");
    band.type = "button";
    band.className = "rating-band";
    band.dataset.from = from;
    band.dataset.to = to;
    const label = ratingBandName({ from, to, count }, text.ratingBandLabel);
    band.title = `${label}. ${text.ratingBandTitle}`;
    band.setAttribute("aria-label", label);
    const bar = document.createElement("span");
    bar.className = "bar";
    // An empty band has no bar; a band with a row keeps a sliver of one.
    bar.style.height = count ? `${Math.max(4, Math.round(count / tallest * 100))}%` : "0";
    band.append(bar);
    return band;
  }));
  markRatingBands();
};

const markRatingBands = () => {
  const min = byId("minRating").value;
  const max = byId("maxRating").value;
  for (const band of byId("ratingBars").children) {
    const chosen = isBucket({ from: Number(band.dataset.from), to: Number(band.dataset.to) }, min, max);
    band.setAttribute("aria-pressed", String(chosen));
  }
};

byId("ratingBars").addEventListener("click", (event) => {
  const band = event.target.closest("button.rating-band");
  if (!band) return;
  const bucket = { from: Number(band.dataset.from), to: Number(band.dataset.to) };
  const chosen = isBucket(bucket, byId("minRating").value, byId("maxRating").value);
  // Setting the fields does not fire their input event, so the list is updated here.
  byId("minRating").value = chosen ? "" : String(bucket.from);
  byId("maxRating").value = chosen ? "" : String(bucket.to);
  applyFilters();
  syncUrl();
});

// A removed tag leaves the focus on the list to add one from, rather than
// dropping it to the page with the button.
byId("chosenTags").addEventListener("click", (event) => {
  const chip = event.target.closest("button.tag-chip");
  if (!chip) return;
  chosenTags = chosenTags.filter((tag) => tag !== chip.dataset.tag);
  showTagChoice();
  applyFilters();
  syncUrl();
  byId("tagFilter").focus();
});

byId("tagMode").addEventListener("click", () => {
  tagAny = !tagAny;
  showTagChoice();
  applyFilters();
  syncUrl();
});

const render = () => {
  const showTags = byId("doNotShowTags").checked;
  byId("tagsTD").hidden = !showTags;
  byId("table-list").classList.toggle("no-tags", !showTags);
  byId("solvedTD").hidden = !upsolveShown();
  byId("table-list").classList.toggle("no-solved", !upsolveShown());
  // Build into one fragment and insert once; names are set as text, never
  // as markup.
  const fragment = document.createDocumentFragment();
  const { key, descending } = state.sort;
  // A re-sort moves the rows already built rather than building them again:
  // 2500 rows took 64 ms to rebuild.
  drawn = sortRows(listRows(), key, descending).map((problem) => {
    let tr = built.get(problem);
    if (!tr) {
      tr = buildRow(problem, hiddenFor(state.handle).has(problemKey(problem)));
      tr.classList.toggle("picked", problem === picked);
      tr.classList.toggle("highlight", problem === highlighted);
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
    if (listRows().length) render();
    syncUrl();
  });
}

// The filters exist once in the page, so their listeners are attached once.
for (const id of ["searchTask", "minRating", "maxRating", "noGym", "noSpecial", "inRound", "showHidden"]) {
  byId(id).addEventListener("input", () => {
    applyFilters();
    syncUrl();
  });
}

// Hiding a row moves the focus to the next row still showing, or the one
// before it, rather than dropping it to the page with the row.
byId("table-list").addEventListener("click", (event) => {
  const button = event.target.closest("button.hide");
  if (!button) return;
  const at = drawn.findIndex(([tr]) => tr.contains(button));
  if (at === -1) return;
  const [tr, problem] = drawn[at];
  const hidden = hiddenFor(state.handle);
  const key = problemKey(problem);
  const isHidden = !hidden.has(key);
  if (isHidden) hidden.add(key);
  else hidden.delete(key);
  saveHidden(state.handle);
  markHidden(tr, problem, isHidden);
  applyFilters();
  if (!tr.hidden) return;
  const next = drawn.slice(at + 1).find(([other]) => !other.hidden)
    ?? drawn.slice(0, at).reverse().find(([other]) => !other.hidden);
  (next ? next[0].querySelector("button.hide") : byId("searchTask")).focus();
});

// A problem hidden or brought back in another tab is hidden or brought back
// here too, so that the next change here does not write over it.
window.addEventListener("storage", (event) => {
  if (event.key !== HIDDEN_KEY && event.key !== null) return;
  hiddenSets.clear();
  const hidden = hiddenFor(state.handle);
  for (const [tr, row] of drawn) markHidden(tr, row, hidden.has(problemKey(row)));
  applyFilters();
});

// Picks one of the rows on screen and moves the focus to its name, so Enter
// opens it. The pick is outlined, since focus moved by a click is not. Hidden
// problems are not picked even while "Show hidden" has them on screen.
byId("pick").addEventListener("click", () => {
  const hidden = hiddenFor(state.handle);
  const choices = drawn.filter(([tr, row]) => !tr.hidden && !hidden.has(problemKey(row)));
  const problem = pickOne(choices.map(([, row]) => row), picked);
  if (!problem) return;
  picked = problem;
  for (const [tr, row] of drawn) tr.classList.toggle("picked", row === problem);
  const link = built.get(problem).querySelector(".problemName");
  link.focus({ preventScroll: true });
  link.scrollIntoView({ block: "center" });
});

// "/" jumps to the search box from anywhere but another field, as on most
// sites with a search. A ticked box keeps the focus but takes no typing, so
// it does not count as a field.
const takesTyping = (target) => (target instanceof HTMLInputElement && target.type !== "checkbox")
  || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target.isContentEditable;

document.addEventListener("keydown", (event) => {
  if (!isSearchKey(event.key, event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (takesTyping(event.target)) return;
  if (byId("filters").hidden) return;
  event.preventDefault();
  byId("searchTask").focus();
  byId("searchTask").select();
});

// P picks a problem from the list on screen, from anywhere but a field.
document.addEventListener("keydown", (event) => {
  if (!isPickKey(event.key, event.code) || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (takesTyping(event.target) || event.target instanceof HTMLButtonElement) return;
  if (byId("filters").hidden) return;
  event.preventDefault();
  byId("pick").click();
});

// The row j and k move through, and that o or Enter opens. Its highlight is a
// class, so focus stays where it was. Enter is left to a button or a link that
// has the focus, since it already acts on it.
let highlighted = null;

const moveHighlight = (step) => {
  const shown = drawn.filter(([tr]) => !tr.hidden);
  if (!shown.length) return;
  const at = shown.findIndex(([, row]) => row === highlighted);
  const next = at === -1 ? (step > 0 ? 0 : shown.length - 1) : Math.min(shown.length - 1, Math.max(0, at + step));
  highlighted = shown[next][1];
  for (const [tr, row] of drawn) tr.classList.toggle("highlight", row === highlighted);
  shown[next][0].scrollIntoView({ block: "nearest" });
};

const openHighlighted = () => {
  const entry = drawn.find(([tr, row]) => row === highlighted && !tr.hidden);
  if (entry) entry[0].querySelector(".problemName").click();
};

document.addEventListener("keydown", (event) => {
  const action = rowKeyAction(event.key, event.code, event);
  if (!action || takesTyping(event.target) || byId("filters").hidden) return;
  const native = event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement;
  if (action === "open" && (event.repeat || (event.key === "Enter" && native))) return;
  event.preventDefault();
  if (action === "open") openHighlighted();
  else moveHighlight(action === "next" ? 1 : -1);
});

// Escape clears the tag filter from anywhere but a field, as the tags can be
// cleared with a click on each of them.
document.addEventListener("keydown", (event) => {
  if (!isClearTagsKey(event.key) || !chosenTags.length || takesTyping(event.target)) return;
  chosenTags = [];
  tagAny = false;
  showTagChoice();
  applyFilters();
  syncUrl();
});

// Showing tags redraws from memory; it does not ask Codeforces again. With
// About open the rows wait, and are drawn with or without tags on closing.
byId("doNotShowTags").addEventListener("change", () => {
  if (listRows().length && !aboutOpen()) render();
  syncUrl();
});

// Lookups are kept in localStorage, so a revisit, a reload or a language
// switch shows the list at once instead of after a multi-megabyte download.
// A copy younger than FRESH_FOR is used as it is; an older one is shown
// while a fresh one loads. Only the last few handles are kept, because the
// storage is shared with every other page on this origin.
const SAVED_KEY = "unsolved-cf-problems:lookups";
const SAVED_VERSION = 6;
const FRESH_FOR = 10 * 60 * 1000;
const CLOCK_SLACK = 60 * 1000;
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
  // A copy saved before the tag counts or the solved problems were kept is looked up again.
  const solved = entry?.solved;
  const solvedKept = Array.isArray(solved?.keys) && Array.isArray(solved?.twins) && Array.isArray(solved?.starts)
    && Array.isArray(solved?.taken);
  if (!rows || !Number.isInteger(entry.submissions) || !isTagCounts(entry.solvedTags) || !solvedKept) return null;
  return {
    handle: entry.handle ?? handle,
    savedAt: entry.savedAt,
    rows,
    submissions: entry.submissions,
    solvedTags: entry.solvedTags,
    solved,
  };
};

const writeStore = (store) => {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
};

const save = (handle, rows, submissions, savedAt, solvedTags, solved) => {
  const store = readStore();
  const id = savedId(handle);
  store.entries[id] = { handle, savedAt, rows: packRows(rows), submissions, solvedTags, solved };
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
  forgetHistory(handle);
};

const relativeTime = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
const ago = (savedAt) => {
  const [value, unit] = ageParts(Date.now() - savedAt);
  return value === 0 ? text.justNow : relativeTime.format(value, unit);
};

// The About panel takes the place of the results, the line saying how old
// they are included.
const aboutOpen = () => byId("table-list").dataset.showing === "about";

const showFreshness = (refreshing) => {
  const line = byId("freshness");
  line.hidden = !state.savedAt || aboutOpen();
  if (line.hidden) return;
  byId("savedAgo").textContent = refreshing
    ? text.refreshingText
    : fill(text.updatedText, { ago: ago(state.savedAt) });
};

// Keeps "updated 3 minutes ago" true while the page stays open.
setInterval(() => {
  if (!byId("freshness").hidden && !loadingHandle) showFreshness(false);
}, 30 * 1000);

// Results that arrive while About is open wait until it is closed.
const showResults = () => {
  if (aboutOpen()) return;
  const counter = byId("counter");
  showFreshness(false);
  showWeakTags();
  showRatingStrip();
  if (!listRows().length) {
    byId("table-main").hidden = true;
    byId("filters").hidden = true;
    byId("table-list").replaceChildren();
    byId("tableCaption").textContent = "";
    drawn = [];
    counter.textContent = !state.handle ? ""
      : emptyKind(state.submissions) === "noSubmissions" ? text.noSubmissionsText : text.congratsText;
    return;
  }
  byId("table-main").hidden = false;
  byId("filters").hidden = false;
  // The face is for the eye; a screen reader would announce it by name.
  const face = document.createElement("span");
  face.setAttribute("aria-hidden", "true");
  face.textContent = "😱 ";
  counter.replaceChildren(face, countText(listRows().length, state.extra.length, {
    label: text.counterOfProblems,
    untriedLabel: text.neverTriedCount,
  }));
  byId("tableCaption").textContent = fill(text.captionText, { handle: state.handle });
  render();
};

const clearResults = () => {
  state.handle = "";
  state.rows = [];
  state.extra = [];
  state.solved = null;
  byId("upsolveStatus").textContent = "";
  state.submissions = 0;
  state.solvedTags = {};
  state.savedAt = null;
  drawn = [];
  byId("table-main").hidden = true;
  byId("filters").hidden = true;
  byId("weakTags").hidden = true;
  byId("ratingStrip").hidden = true;
  byId("freshness").hidden = true;
  byId("tableCaption").textContent = "";
  byId("table-list").replaceChildren();
  delete byId("table-list").dataset.showing;
};

// A response that arrives after a newer lookup started is dropped.
let lookupNumber = 0;

// The handle the newest lookup is downloading, or "". Refresh waits for it,
// and searching for it again does not ask Codeforces a second time; any
// other handle can be searched for meanwhile. Refresh is marked unavailable
// rather than disabled, since disabling the focused button would drop the
// keyboard focus to the page.
let loadingHandle = "";

const setLoading = (handle) => {
  loadingHandle = handle.toLowerCase();
  byId("refresh").setAttribute("aria-disabled", String(handle !== ""));
};

// Codeforces asks for no more than one API call every two seconds, and
// answers "Call limit exceeded" past that. A call waits for its turn, and is
// not made at all if nothing wants it by then.
const API_GAP = 2000;
let lastCallAt = -Infinity;

const waitForTurn = async (wanted) => {
  while (Date.now() < lastCallAt + API_GAP) {
    await new Promise((resolve) => setTimeout(resolve, lastCallAt + API_GAP - Date.now()));
  }
  if (!wanted()) return false;
  lastCallAt = Date.now();
  return true;
};

// What the submissions older than a day add up to, kept in the Cache API so
// that a refresh asks Codeforces for the newest submissions only and adds them
// (see advance() in lib.js). Read from scratch when nothing is kept, when the
// newest ones do not reach back far enough, and every few days. Only the
// latest few handles are kept, per language since the names come in it.
const HISTORY_CACHE = "unsolved-cf-problems-history";
const KEEP_HISTORIES = 3;
const historyKey = (handle) =>
  new URL(`history.v1/${lang}/${encodeURIComponent(handle.toLowerCase())}`, window.location.href).href;

const openHistories = async () => {
  try {
    return await caches.open(HISTORY_CACHE);
  } catch {
    return null;
  }
};

const readHistory = async (handle) => {
  try {
    const response = await (await openHistories())?.match(historyKey(handle));
    const digest = await response?.json();
    // A digest saved before the tag counts were kept is read again from scratch.
    const valid = Number.isFinite(digest?.cutoff) && Number.isFinite(digest.builtAt) && Number.isFinite(digest.count)
      && ["keys", "twins", "starts", "rows", "taken"].every((field) => Array.isArray(digest.state?.[field]))
      && hasTagCounts(digest);
    return valid ? digest : null;
  } catch {
    return null;
  }
};

const saveHistory = async (handle, digest) => {
  const cache = await openHistories();
  if (!cache) return;
  try {
    await cache.put(historyKey(handle), new Response(JSON.stringify(digest), {
      headers: { "Content-Type": "application/json", "X-Saved-At": String(Date.now()) },
    }));
    const kept = [];
    for (const request of await cache.keys()) {
      kept.push({ request, at: Number((await cache.match(request))?.headers.get("X-Saved-At")) || 0 });
    }
    kept.sort((a, b) => b.at - a.at);
    for (const { request } of kept.slice(KEEP_HISTORIES)) await cache.delete(request);
  } catch {
    // Not kept; the next refresh reads everything again.
  }
};

const forgetHistory = async (handle) => {
  try {
    await (await openHistories())?.delete(historyKey(handle));
  } catch {
    // Nothing kept, or no cache to forget it from.
  }
};

// The rows and the count for a handle, from a refresh of what was kept when
// that is possible and from all its submissions when not.
const loadHistory = async (handle, wanted) => {
  const now = () => Math.floor(Date.now() / 1000);
  const keep = (result) => {
    saveHistory(handle, result.digest);
    return result;
  };
  const saved = await readHistory(handle);
  if (isUsableDigest(saved, now())) {
    const newest = await loadSubmissions(handle, wanted, NEWEST_COUNT);
    if (reachesDigest(saved, newest, NEWEST_COUNT)) return keep(advance(saved, newest, now()));
    if (!await waitForTurn(wanted)) return null;
  }
  const everything = await loadSubmissions(handle, wanted);
  return keep(advance(emptyDigest(now()), everything, now()));
};

// The upsolve view has its own code, read the first time the view needs it: the
// box is ticked, a link names it, or the list is sorted by the solved counts.
let upsolve = null;
let upsolveLoad = null;
const loadUpsolve = () => {
  upsolveLoad ??= import("./upsolve.js").then(({ createUpsolve }) => {
    upsolve = createUpsolve({
      state, byId, text, fill, failureText, waitForTurn, lang, FRESH_FOR,
      refreshList: () => refreshList(),
    });
    return upsolve;
  });
  return upsolveLoad;
};

const ensureUpsolve = () => {
  if (!upsolve && !byId("upsolve").checked && state.sort.key !== "solved") return;
  loadUpsolve().then((view) => view.ensure());
};

const upsolveShown = () => Boolean(upsolve?.shown());

// The solved counts and the notes on the problem ids belong to one history: when
// that changes, the rows are built again.
let countsWere = null;

const refreshList = () => {
  if (state.savedAt === null) return;
  const shownKey = upsolve ? upsolve.shownFor() : null;
  if (shownKey !== countsWere) {
    built = new WeakMap();
    countsWere = shownKey;
  }
  fillTagFilter();
  showResults();
};

byId("upsolve").addEventListener("change", () => {
  if (byId("upsolve").checked) {
    ensureUpsolve();
  } else {
    upsolve?.off();
    refreshList();
  }
  syncUrl();
});

const lookup = async (handle, { force = false } = {}) => {
  const number = ++lookupNumber;
  setLoading("");
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
      ensureUpsolve();
    }
  }

  remember("handle", handle);
  syncUrl({ newEntry: true });
  if (!force && state.savedAt !== null && isFresh(state.savedAt, Date.now(), FRESH_FOR, CLOCK_SLACK)) return;

  setLoading(handle);
  if (state.savedAt !== null) showFreshness(true);
  else counter.textContent = fill(text.loadingText, { handle });

  try {
    if (!await waitForTurn(() => number === lookupNumber)) return;
    const history = await loadHistory(handle, () => number === lookupNumber);
    if (number !== lookupNumber || !history) return;
    state.handle = handle;
    state.rows = history.rows;
    state.submissions = history.submissions;
    state.solvedTags = history.state.solvedTags;
    noteHandle(handle);
    state.savedAt = Date.now();
    state.solved = solvedFor(history.state);
    save(handle, state.rows, state.submissions, state.savedAt, state.solvedTags, state.solved);
    fillTagFilter();
    showResults();
    ensureUpsolve();
  } catch (error) {
    if (number !== lookupNumber) return;
    // Every failure ends up here, so the page never stays on "Loading..."
    // with Refresh disabled.
    console.error(error);
    // Only forget the handle when it is the handle that was wrong, so a
    // dropped connection or a busy Codeforces does not leave the next visit
    // on an empty form.
    const kind = error.failure?.kind;
    if (kind === "notFound" || kind === "badHandle") {
      remember("handle", "");
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
    // In finally, so that nothing thrown on the way leaves the form dead.
    if (number === lookupNumber) setLoading("");
  }
};

// Searching for the handle already on screen means "check again", so it
// skips the saved copy; any other handle starts from its saved copy if there
// is one.
byId("start").addEventListener("click", () => {
  const handle = parseHandle(byId("handle").value);
  byId("handle").value = handle;
  if (loadingHandle && handle.toLowerCase() === loadingHandle) return;
  const again = state.savedAt !== null && state.handle.toLowerCase() === handle.toLowerCase();
  lookup(handle, { force: again });
});

byId("refresh").addEventListener("click", () => {
  if (state.handle && !loadingHandle) lookup(state.handle, { force: true });
});

// Back and Forward bring back the handle, sort and filters of that entry,
// from the saved copy when there is one, as a new visit would.
window.addEventListener("popstate", () => {
  applyParams();
  const handle = parseHandle(byId("handle").value);
  if (state.savedAt !== null && state.handle.toLowerCase() === handle.toLowerCase()) {
    fillTagFilter();
    showResults();
    ensureUpsolve();
  } else if (!(loadingHandle && handle.toLowerCase() === loadingHandle)) {
    lookup(handle);
  }
  chooseFriend();
});

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

const chooseFriend = () => {
  const handle = parseHandle(byId("friend").value);
  byId("friend").value = handle;
  loadFriend(handle);
};

byId("friend").addEventListener("change", chooseFriend);
byId("friend").addEventListener("keydown", (event) => {
  if (event.key === "Enter") chooseFriend();
});

byId("about").addEventListener("click", () => {
  const tableList = byId("table-list");
  byId("table-main").hidden = true;
  byId("filters").hidden = true;
  byId("weakTags").hidden = true;
  byId("ratingStrip").hidden = true;
  byId("freshness").hidden = true;
  byId("tableCaption").textContent = "";
  byId("counter").textContent = "";

  // Closing the about panel brings the last results back.
  if (aboutOpen()) {
    tableList.replaceChildren();
    delete tableList.dataset.showing;
    showResults();
    return;
  }

  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 8;
  td.append(anchor(
    `https://codeforces.com/blog/entry/79960?locale=${encodeURIComponent(lang)}`,
    text.aboutProject,
  ));
  td.append(document.createElement("br"));
  const keys = document.createElement("small");
  keys.textContent = text.keysHint;
  td.append(keys, document.createElement("br"));
  const credits = document.createElement("small");
  credits.append(anchor("https://got.az/azer/unsolved-cf-problems", text.sourceLink));
  credits.append(document.createTextNode(" | "));
  credits.append(anchor("https://azer.one", "Azer Sadykhzadeh"));
  td.append(credits);
  row.append(td);

  tableList.replaceChildren(row);
  tableList.dataset.showing = "about";
});
