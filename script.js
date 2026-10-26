import {
  ageParts,
  defaultDescending,
  describeFailure,
  emptyKind,
  failedTest,
  fetchJson,
  findUnsolved,
  isSearchKey,
  isTimeout,
  makeFilter,
  matchesFilter,
  packRows,
  parseHandle,
  pickOne,
  problemKey,
  problemLink,
  readParams,
  solvedCheck,
  sortRows,
  submissionLink,
  summarizeSolved,
  tagCounts,
  unpackRows,
  verdictLabel,
  writeParams,
} from "./lib.js";

const localize = [{
  "en": {
    pageTitle: "Unsolved Codeforces Problems",
    searchHandleButton: "Search unsolved tasks",
    handleLabel: "Codeforces handle",
    handlePlaceholder: "Input your handle here.",
    showTagsChexBox: " Show problem's tags",
    counterOfProblems: `😱 Count of problems: `,
    nameTD: "Name ",
    tagsTD: "Tags",
    ratingTD: "Rating",
    triesTD: "Tries",
    verdictTD: "Last verdict",
    notJudgedText: "not judged yet",
    onTestText: "{verdict} on test {test}",
    onPretestText: "{verdict} on pretest {test}",
    lastTriedTD: "Last attempt",
    congratsText: "Congratulations, You haven't got any unsolved tasks! 🥳",
    noSubmissionsText: "There are no submissions from this user yet.",
    loadingText: "Loading the submissions of {handle}...",
    notFoundText: ":( There is no Codeforces user called \"{handle}\".",
    badHandleText: ":( Codeforces did not accept this handle: {detail}",
    rateLimitedText: ":( Codeforces is limiting requests right now. Wait a few seconds and try again.",
    unavailableText: ":( Codeforces is not answering ({detail}). It may be down for maintenance; try again later.",
    otherErrorText: ":( Codeforces returned an error: {detail}",
    networkErrorText: ":( Could not reach Codeforces. Check your connection and try again.",
    timeoutText: ":( Codeforces stopped answering for 30 seconds. Try again in a moment.",
    aboutButton: "About",
    aboutProject: "More about the Project",
    sourceLink: "Source",
    searchPlaceholder: "Search by name or id",
    maxRating: "Maximum rating",
    anyTag: "Any tag",
    noGymLabel: "Hide gym",
    noSpecialLabel: "Hide special rounds",
    noSpecialTitle: "April Fools, Kotlin Heroes, Q# and the rest tagged *special",
    inRoundLabel: "Tried in a round",
    inRoundTitle: "Submitted during the round or a virtual participation, not just in practice",
    friendLabel: "Solved by",
    friendPlaceholder: "a friend's handle",
    shownText: "Showing {shown} of {total}",
    pickButton: "Pick one at random",
    hideTD: "Hide",
    hideButton: "Hide {problem}",
    unhideButton: "Show {problem} again",
    showHiddenLabel: "Show hidden ({count})",
    updatedText: "Updated {ago}.",
    justNow: "just now",
    refreshingText: "Checking Codeforces for changes...",
    refreshButton: "Refresh",
    showingSavedText: "Showing what was saved {ago}.",
  },
  "ru": {
    pageTitle: "Нерешённые задачи Codeforces",
    searchHandleButton: "Поиск нерешённых задач",
    handleLabel: "Хендл на Codeforces",
    handlePlaceholder: "Введите свой хендл.",
    showTagsChexBox: " Показывать теги задач",
    counterOfProblems: `😱 Количество задач: `,
    nameTD: "Название ",
    tagsTD: "Теги",
    ratingTD: "Рейтинг",
    triesTD: "Попытки",
    verdictTD: "Последний вердикт",
    notJudgedText: "ещё не проверено",
    onTestText: "{verdict} на тесте {test}",
    onPretestText: "{verdict} на претесте {test}",
    lastTriedTD: "Последняя попытка",
    congratsText: "Поздравляю, У тебя нет нерешённых задач! 🥳",
    noSubmissionsText: "У этого пользователя пока нет посылок.",
    loadingText: "Загружаю посылки {handle}...",
    notFoundText: ":( На Codeforces нет пользователя «{handle}».",
    badHandleText: ":( Codeforces не принял этот хендл: {detail}",
    rateLimitedText: ":( Codeforces сейчас ограничивает число запросов. Подождите несколько секунд и попробуйте снова.",
    unavailableText: ":( Codeforces не отвечает ({detail}). Возможно, идут технические работы; попробуйте позже.",
    otherErrorText: ":( Codeforces вернул ошибку: {detail}",
    networkErrorText: ":( Не удалось связаться с Codeforces. Проверьте соединение и попробуйте снова.",
    timeoutText: ":( Codeforces перестал отвечать на 30 секунд. Попробуйте ещё раз чуть позже.",
    aboutButton: "О проекте",
    aboutProject: "Подробнее о проекте",
    sourceLink: "Исходный код",
    searchPlaceholder: "Поиск по названию или номеру",
    maxRating: "Максимальный рейтинг",
    anyTag: "Любой тег",
    noGymLabel: "Без тренировок",
    noSpecialLabel: "Без особых раундов",
    noSpecialTitle: "1 апреля, Kotlin Heroes, Q# и остальные задачи с тегом *special",
    inRoundLabel: "Пробовал(а) на раунде",
    inRoundTitle: "Отправлял(а) решение во время раунда или виртуального участия, а не только в дорешивании",
    friendLabel: "Решил(а)",
    friendPlaceholder: "хендл друга",
    shownText: "Показано {shown} из {total}",
    pickButton: "Выбрать наугад",
    hideTD: "Скрыть",
    hideButton: "Скрыть {problem}",
    unhideButton: "Вернуть {problem}",
    showHiddenLabel: "Показать скрытые ({count})",
    updatedText: "Обновлено {ago}.",
    justNow: "только что",
    refreshingText: "Проверяю, что изменилось на Codeforces...",
    refreshButton: "Обновить",
    showingSavedText: "Показаны данные, сохранённые {ago}.",
  },
}];

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
const text = localize[0][lang];

const onloadFunction = (lang) => {
  remember("lang", lang);
  // The page is bilingual, so the document has to say which one it is in.
  document.documentElement.lang = lang;
  byId("heading").textContent = text.pageTitle;
  document.title = text.pageTitle;
  byId("handle").value = recall("handle") ?? "";
  byId("handleLabel").textContent = text.handleLabel;
  byId("handle").placeholder = text.handlePlaceholder;
  byId("start").title = text.searchHandleButton;
  byId("start").setAttribute("aria-label", text.searchHandleButton);
  byId("doNotShowTags-label").textContent = text.showTagsChexBox;
  byId("about").textContent = text.aboutButton;
  byId("refresh").textContent = text.refreshButton;
  byId("pick").textContent = text.pickButton;
  byId("nameLabel").textContent = text.nameTD;
  byId("searchTask").placeholder = text.searchPlaceholder;
  byId("searchTask").setAttribute("aria-label", text.searchPlaceholder);
  byId("ratingFilterLabel").textContent = text.ratingTD;
  byId("maxRating").setAttribute("aria-label", text.maxRating);
  byId("tagFilter").setAttribute("aria-label", text.tagsTD);
  byId("noGymLabel").textContent = text.noGymLabel;
  byId("noSpecialLabel").textContent = text.noSpecialLabel;
  byId("noSpecialLabel").parentElement.title = text.noSpecialTitle;
  byId("inRoundLabel").textContent = text.inRoundLabel;
  byId("inRoundLabel").parentElement.title = text.inRoundTitle;
  byId("friendLabel").textContent = text.friendLabel;
  byId("friend").placeholder = text.friendPlaceholder;
  byId("ratingLabel").textContent = text.ratingTD;
  byId("triesLabel").textContent = text.triesTD;
  byId("verdictTD").textContent = text.verdictTD;
  byId("lastTriedLabel").textContent = text.lastTriedTD;
  byId("tagsTD").textContent = text.tagsTD;
  byId("hideLabel").textContent = text.hideTD;
};

// A link can name the handle, the sort and the filters; anything it leaves
// out falls back to the remembered handle and the defaults.
const applyParams = () => {
  const params = readParams(window.location.search);
  if (params.handle) byId("handle").value = params.handle;
  state.sort = params.sort ?? { key: "rating", descending: false };
  byId("searchTask").value = params.query;
  byId("minRating").value = params.min;
  byId("maxRating").value = params.max;
  byId("tagFilter").value = params.tag;
  pendingTag = params.tag;
  byId("noGym").checked = params.noGym;
  byId("noSpecial").checked = params.noSpecial;
  byId("inRound").checked = params.inRound;
  byId("friend").value = params.friend;
  byId("doNotShowTags").checked = params.showTags;
};

const currentParams = () => ({
  lang: lang === "en" ? "" : lang,
  handle: state.handle || byId("handle").value.trim(),
  sort: state.sort,
  query: byId("searchTask").value,
  min: byId("minRating").value,
  max: byId("maxRating").value,
  tag: byId("tagFilter").value || pendingTag,
  noGym: byId("noGym").checked,
  noSpecial: byId("noSpecial").checked,
  friend: friend.handle,
  inRound: byId("inRound").checked,
  showTags: byId("doNotShowTags").checked,
});

const pageTitle = text.pageTitle;

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

document.addEventListener("DOMContentLoaded", () => {
  onloadFunction(lang);
  applyParams();
  byId("start").click();
  chooseFriend();
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

  row.append(cell(anchor(href, problemKey(problem))));

  const name = anchor(href, problem.name);
  name.className = "problemName";
  row.append(cell(name));

  // Always built, and hidden by a class on the table body, so showing the
  // tags does not build every row again.
  const tags = cell(problem.tags.length ? problem.tags.join(", ") : "-");
  tags.className = "tags";
  row.append(tags);

  row.append(cell(problem.rating === undefined ? "-" : String(problem.rating), text.ratingTD));
  row.append(cell(String(problem.tries)));

  // "WA 37" for a wrong answer on test 37: how close the attempt came.
  const [short, full] = verdictLabel(problem.verdict, text.notJudgedText);
  const test = failedTest(problem);
  row.append(test
    ? cell(`${short} ${test.number}`, fill(test.pretest ? text.onPretestText : text.onTestText, {
      verdict: full, test: test.number,
    }))
    : cell(short, full));

  const when = anchor(submissionLink(problem), dateFormat.format(problem.lastTime * 1000));
  when.title = `#${problem.submissionId}`;
  const whenCell = cell(when);
  whenCell.className = "when";
  row.append(whenCell);

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

const loadSubmissions = async (handle) => {
  // Escaped, so a handle containing & or # cannot change the request.
  const url = `https://codeforces.com/api/user.status?handle=${
    encodeURIComponent(handle)
  }&lang=${encodeURIComponent(lang)}`;
  // Errors come back as JSON with a comment saying what went wrong, except
  // when Codeforces itself is down and an HTML page answers instead.
  const { response, payload } = await fetchJson(url);
  // A failed call can still answer 200, with {status: "FAILED"} and no
  // result, so only an OK status with an array counts as submissions.
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
    if (isTimeout(error)) return text.timeoutText;
    return error instanceof TypeError ? text.networkErrorText : String(error.message || error);
  }
  const { kind, detail } = error.failure;
  return fill(text[`${kind}Text`], { handle, detail });
};

// The last lookup, kept so that showing tags or filtering redraws from memory
// instead of asking Codeforces for every submission again.
const state = { handle: "", rows: [], submissions: 0, savedAt: null, sort: { key: "rating", descending: false } };

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
    tag: byId("tagFilter").value,
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
  byId("table-list").classList.toggle("no-tags", !showTags);
  // Build into one fragment and insert once; names are set as text, never
  // as markup.
  const fragment = document.createDocumentFragment();
  const { key, descending } = state.sort;
  // A re-sort moves the rows already built rather than building them again:
  // 2500 rows took 64 ms to rebuild.
  drawn = sortRows(state.rows, key, descending).map((problem) => {
    let tr = built.get(problem);
    if (!tr) {
      tr = buildRow(problem, hiddenFor(state.handle).has(problemKey(problem)));
      tr.classList.toggle("picked", problem === picked);
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

// The filters exist once in the page, so their listeners are attached once.
for (const id of ["searchTask", "minRating", "maxRating", "tagFilter", "noGym", "noSpecial", "inRound", "showHidden"]) {
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

// Showing tags redraws from memory; it does not ask Codeforces again. With
// About open the rows wait, and are drawn with or without tags on closing.
byId("doNotShowTags").addEventListener("change", () => {
  if (state.rows.length && !aboutOpen()) render();
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
  if (!rows || !Number.isInteger(entry.submissions)) return null;
  return { handle: entry.handle ?? handle, savedAt: entry.savedAt, rows, submissions: entry.submissions };
};

const writeStore = (store) => {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
};

const save = (handle, rows, submissions, savedAt) => {
  const store = readStore();
  const id = savedId(handle);
  store.entries[id] = { handle, savedAt, rows: packRows(rows), submissions };
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
  if (!state.rows.length) {
    byId("table-main").hidden = true;
    byId("filters").hidden = true;
    byId("table-list").replaceChildren();
    drawn = [];
    counter.textContent = !state.handle ? ""
      : emptyKind(state.submissions) === "noSubmissions" ? text.noSubmissionsText : text.congratsText;
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
  state.submissions = 0;
  state.savedAt = null;
  drawn = [];
  byId("table-main").hidden = true;
  byId("filters").hidden = true;
  byId("freshness").hidden = true;
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
    }
  }

  remember("handle", handle);
  syncUrl({ newEntry: true });
  if (!force && state.savedAt !== null && Date.now() - state.savedAt < FRESH_FOR) return;

  setLoading(handle);
  if (state.savedAt !== null) showFreshness(true);
  else counter.textContent = fill(text.loadingText, { handle });

  try {
    if (!await waitForTurn(() => number === lookupNumber)) return;
    const submissions = await loadSubmissions(handle);
    if (number !== lookupNumber) return;
    state.handle = handle;
    state.rows = findUnsolved(submissions);
    state.submissions = submissions.length;
    state.savedAt = Date.now();
    save(handle, state.rows, state.submissions, state.savedAt);
    fillTagFilter();
    showResults();
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
    if (!handle || (friend.savedAt !== null && Date.now() - friend.savedAt < FRESH_FOR)) return;
    if (friend.savedAt === null) status.textContent = fill(text.loadingText, { handle });
    if (!await waitForTurn(() => number === friendNumber)) return;
    const submissions = await loadSubmissions(handle);
    if (number !== friendNumber) return;
    const entry = { savedAt: Date.now(), summary: summarizeSolved(submissions) };
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
  byId("freshness").hidden = true;
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
  const credits = document.createElement("small");
  credits.append(anchor("https://got.az/azer/unsolved-cf-problems", text.sourceLink));
  credits.append(document.createTextNode(" | "));
  credits.append(anchor("https://azer.one", "Azer Sadykhzadeh"));
  td.append(credits);
  row.append(td);

  tableList.replaceChildren(row);
  tableList.dataset.showing = "about";
});
