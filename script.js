const verdicts = [{
  full: "WRONG_ANSWER",
  short: "WA",
}, {
  full: "TIME_LIMIT_EXCEEDED",
  short: "TLE",
}, {
  full: "COMPILATION_ERROR",
  short: "CE",
}, {
  full: "RUNTIME_ERROR",
  short: "RE",
}, {
  full: "CHALLENGED",
  short: "CHL",
  label: "CHALLENGED / HACKED",
}, {
  full: "MEMORY_LIMIT_EXCEEDED",
  short: "MLE",
}, {
  full: "IDLENESS_LIMIT_EXCEEDED",
  short: "ILE",
}, {
  full: "PRESENTATION_ERROR",
  short: "PE",
}, {
  full: "SKIPPED",
  short: "SKIPPED",
}, {
  full: "TESTING",
  short: "TESTING",
}, {
  full: "PARTIAL",
  short: "PARTIAL",
}, {
  full: "FAILED",
  short: "FAILED",
}];

const localize = [{
  "en": {
    searchHandleButton: "Search unsolved tasks",
    showTagsChexBox: " Show problem's tags",
    counterOfProblems: `😱 Count of problems: `,
    nameTD: "Name ",
    tagsTD: "Tags",
    ratingTD: "Rating",
    lastTD: "Last Verdict / Submit Link",
    congratsText: "Congratulations, You haven't got any unsolved tasks! 🥳",
    errorText: ":( Error 4xx: Perhaps this handle does not exist",
    networkErrorText: ":( Could not reach Codeforces. Check your connection and try again.",
    aboutButton: "About",
    aboutProject: "More about the Project",
    searchPlaceholder: "Search...",
  },
  "ru": {
    searchHandleButton: "Поиск нерешённых задач",
    showTagsChexBox: " Показывать теги задач",
    counterOfProblems: `😱 Количество задач: `,
    nameTD: "Название ",
    tagsTD: "Теги",
    ratingTD: "Рейтинг",
    lastTD: "Последний вердикт / Последняя отправка",
    congratsText: "Поздравляю, У тебя нет нерешённых задач! 🥳",
    errorText: ":( Ошибка 4xx: Возможно данного хендла не существует",
    networkErrorText: ":( Не удалось связаться с Codeforces. Проверьте соединение и попробуйте снова.",
    aboutButton: "О проекте",
    aboutProject: "Подробнее о проекте",
    searchPlaceholder: "Поиск...",
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
  byId("nameTD").textContent = text.nameTD;
  byId("ratingTD").textContent = text.ratingTD;
  byId("lastTD").textContent = text.lastTD;
  byId("tagsTD").textContent = text.tagsTD;
};

document.addEventListener("DOMContentLoaded", () => {
  onloadFunction(lang);
  byId("start").click();
});

// Exact lookup rather than `full.includes(verdict)`: a substring match maps
// any verdict that happens to sit inside another one onto the wrong row, and
// a submission still being judged has no verdict at all - `includes(undefined)`
// came back false and the table printed the word "undefined".
const verdictsByName = new Map(verdicts.map((v) => [v.full, v]));

const reduction = (verdict) => {
  if (!verdict) return ["?", "not judged yet"];
  const known = verdictsByName.get(verdict);
  if (!known) return [verdict, verdict];
  return [known.short, known.label ?? known.full];
};

byId("handle").addEventListener("keyup", (event) => {
  if (event.key === "Enter") byId("start").click();
});

const problemLink = (problem) => {
  // Gym contests live under a different path.
  return +problem.contestId >= 100000
    ? `https://codeforces.com/problemset/gymProblem/${problem.contestId}/${problem.index}`
    : `https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`;
};

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

const buildRow = (submission, showTags) => {
  const { problem } = submission;
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

  const [short, full] = reduction(submission.verdict);
  row.append(cell(short, full));
  row.append(cell(anchor(
    `https://codeforces.com/contest/${problem.contestId}/submission/${submission.id}`,
    String(submission.id),
  )));

  return row;
};

const UNRATED_SORTS_LAST = 1e6;

const findUnsolved = (submissions) => {
  // This was two passes over a map called allBadSubmissions that in fact held
  // the solved ones, and it read `== null` to mean absent. A Set of the
  // problems that were ever accepted says what it means.
  const solved = new Set();
  for (const item of submissions) {
    if (item.verdict === "OK") solved.add(`${item.problem.contestId}|${item.problem.index}`);
  }

  const unsolved = new Map();
  for (const item of submissions) {
    const key = `${item.problem.contestId}|${item.problem.index}`;
    if (solved.has(key) || unsolved.has(key)) continue;
    unsolved.set(key, item);
  }

  return [...unsolved.values()].sort((left, right) => {
    const a = left.problem.rating ?? UNRATED_SORTS_LAST;
    const b = right.problem.rating ?? UNRATED_SORTS_LAST;
    return a - b;
  });
};

const loadSubmissions = async (handle) => {
  // The handle went into the query unescaped, so one containing & or # built
  // a different request than intended.
  const url = `https://codeforces.com/api/user.status?handle=${
    encodeURIComponent(handle)
  }&lang=${encodeURIComponent(lang)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(text.errorText);
  const payload = await response.json();
  // The API answers 200 with {status: "FAILED"}. payload.result was read
  // regardless, and `for (const item of undefined)` threw.
  if (payload.status !== "OK" || !Array.isArray(payload.result)) {
    throw new Error(text.errorText);
  }
  return payload.result;
};

let searchListenerAttached = false;

const attachSearch = () => {
  const input = byId("searchTask");
  if (!input || searchListenerAttached) return;
  searchListenerAttached = true;
  // searchTasks() used to add a fresh keyup listener on every search, so the
  // filter ran once per search performed so far on every keystroke.
  input.addEventListener("keyup", () => {
    const needle = input.value.toLowerCase();
    for (const row of document.querySelectorAll("#table-list tr")) {
      const name = row.querySelector(".problemName");
      const matches = !name || name.textContent.toLowerCase().includes(needle);
      row.style.display = matches ? "" : "none";
    }
  });
};

byId("start").addEventListener("click", async () => {
  const counter = byId("counter");
  const tableMain = byId("table-main");
  const tableList = byId("table-list");
  const showTags = byId("doNotShowTags").checked;

  byId("nameTD").textContent = text.nameTD;
  byId("tagsTD").hidden = true;
  tableMain.hidden = true;
  counter.hidden = false;
  tableList.replaceChildren();

  const handle = byId("handle").value.trim();
  if (handle === "") {
    counter.hidden = true;
    return;
  }

  localStorage.handle = handle;
  counter.textContent = "Loading...";
  byId("start").disabled = true;
  byId("doNotShowTags").disabled = true;

  try {
    const submissions = await loadSubmissions(handle);
    const unsolved = findUnsolved(submissions);

    if (!unsolved.length) {
      counter.hidden = false;
      counter.textContent = text.congratsText;
      return;
    }

    tableMain.hidden = false;
    counter.textContent = `${text.counterOfProblems} ${unsolved.length}`;

    // Rows used to be appended with `innerHTML +=` inside the loop, which
    // reparses the whole table for every row - quadratic in the number of
    // problems, and problem names from the API landed in markup unescaped.
    // One fragment, one insertion.
    const fragment = document.createDocumentFragment();
    for (const submission of unsolved) fragment.append(buildRow(submission, showTags));
    tableList.append(fragment);

    if (showTags) byId("tagsTD").hidden = false;

    const search = document.createElement("input");
    search.type = "text";
    search.id = "searchTask";
    search.placeholder = text.searchPlaceholder;
    byId("nameTD").append(search);
    attachSearch();
  } catch (error) {
    // Nothing caught a failed fetch, so a dropped connection left the page on
    // "Loading..." with both controls disabled and no way back.
    console.error(error);
    localStorage.handle = "";
    counter.hidden = false;
    counter.textContent = error instanceof TypeError ? text.networkErrorText : error.message;
  } finally {
    // This used to be the last statement of the handler, so anything that
    // threw on the way left the form dead.
    byId("start").disabled = false;
    byId("doNotShowTags").disabled = false;
  }
});

byId("about").addEventListener("click", () => {
  const tableList = byId("table-list");
  byId("table-main").hidden = true;
  byId("counter").hidden = true;

  // The old version decided whether the panel was open by searching the
  // table's markup for the string "sadykhzadeh".
  if (tableList.dataset.showing === "about") {
    tableList.replaceChildren();
    delete tableList.dataset.showing;
    return;
  }

  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
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
