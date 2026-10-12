// Everything here works on plain data from the Codeforces API and never
// touches the page, so it can be tested under Node.

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

// Exact lookup: a substring match would map a verdict that sits inside
// another one onto the wrong row.
const verdictsByName = new Map(verdicts.map((v) => [v.full, v]));

// Returns [short label, full label].
export const verdictLabel = (verdict) => {
  if (!verdict) return ["?", "not judged yet"];
  const known = verdictsByName.get(verdict);
  if (!known) return [verdict, verdict];
  return [known.short, known.label ?? known.full];
};

// How long a Codeforces call may take. Without a limit a connection that
// stalls leaves the page on "Loading..." for as long as the tab is open.
export const REQUEST_TIMEOUT_MS = 30000;

// AbortSignal.timeout() aborts with a TimeoutError, which is what a stalled
// call looks like to the code that catches it.
export const isTimeout = (error) => Boolean(error) && error.name === "TimeoutError";

// acmsguru problems belong to no contest: they come with a problemsetName
// instead of a contestId, and Codeforces files them under contest 99999.
export const problemKey = (problem) => `${problem.contestId ?? problem.problemsetName}|${problem.index}`;

const isGym = (contestId) => +contestId >= 100000;

export const problemLink = (problem) => {
  if (problem.contestId === undefined) {
    return `https://codeforces.com/problemsets/${problem.problemsetName}/problem/99999/${problem.index}`;
  }
  // Gym contests live under a different path.
  return isGym(problem.contestId)
    ? `https://codeforces.com/problemset/gymProblem/${problem.contestId}/${problem.index}`
    : `https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`;
};

export const submissionLink = (row) => {
  if (row.contestId === undefined) {
    return `https://codeforces.com/problemsets/${row.problemsetName}/submission/99999/${row.submissionId}`;
  }
  return isGym(row.contestId)
    ? `https://codeforces.com/gym/${row.contestId}/submission/${row.submissionId}`
    : `https://codeforces.com/contest/${row.contestId}/submission/${row.submissionId}`;
};

// Sorts a failed user.status call into something a person can act on, so
// that Codeforces being down is not reported as a wrong handle.
export const describeFailure = (httpStatus, payload) => {
  const comment = typeof payload?.comment === "string" ? payload.comment : "";
  // "handle: User with handle X not found" - in English whatever the lang
  // parameter says, unlike the validation messages.
  if (/not found/i.test(comment)) return { kind: "notFound", detail: comment };
  if (/call limit/i.test(comment) || httpStatus === 429) {
    return { kind: "rateLimited", detail: comment };
  }
  if (comment.startsWith("handle:")) {
    return { kind: "badHandle", detail: comment.slice("handle:".length).trim() };
  }
  if (httpStatus >= 500 || !payload) return { kind: "unavailable", detail: `HTTP ${httpStatus}` };
  return { kind: "otherError", detail: comment || `HTTP ${httpStatus}` };
};

const NO_CONTEST_SORTS_LAST = 1e9;

// What each sortable column compares, and which way a first click sorts it:
// easiest, most fought over and most recent first.
const SORTS = {
  problem: {
    compare: (a, b) => (a.contestId ?? NO_CONTEST_SORTS_LAST) - (b.contestId ?? NO_CONTEST_SORTS_LAST)
      || a.index.localeCompare(b.index, "en", { numeric: true }),
    descending: true,
  },
  name: { compare: (a, b) => a.name.localeCompare(b.name), descending: false },
  rating: { compare: (a, b) => a.rating - b.rating, descending: false },
  tries: { compare: (a, b) => a.tries - b.tries, descending: true },
  last: { compare: (a, b) => a.lastTime - b.lastTime, descending: true },
};

export const SORT_KEYS = Object.keys(SORTS);
export const defaultDescending = (key) => SORTS[key].descending;

// A new array; the rows keep their order among equals, so ties stay easiest
// first. Unrated problems have nothing to compare and stay at the bottom
// whichever way the ratings run.
export const sortRows = (rows, key, descending) => {
  const { compare } = SORTS[key] ?? SORTS.rating;
  const sign = descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (key === "rating" && (a.rating === undefined || b.rating === undefined)) {
      return (a.rating === undefined) - (b.rating === undefined);
    }
    return sign * compare(a, b);
  });
};

const bound = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// Normalises what the filter fields hold: an empty or unreadable bound is no
// bound, and the search is case-insensitive.
export const makeFilter = ({ query = "", min = "", max = "", tag = "" } = {}) => ({
  query: String(query).trim().toLowerCase(),
  min: bound(min),
  max: bound(max),
  tag: String(tag),
});

// The search matches the name or the problem id, written either way the
// table shows it ("1520F2" or "1520|F2").
export const matchesFilter = (row, filter) => {
  if (filter.query) {
    const id = problemKey(row).toLowerCase();
    const haystack = `${row.name.toLowerCase()}\n${id.replace("|", "")}\n${id}`;
    if (!haystack.includes(filter.query)) return false;
  }
  if (filter.tag && !row.tags.includes(filter.tag)) return false;
  if (filter.min !== null || filter.max !== null) {
    // An unrated problem cannot be said to sit inside a range.
    if (row.rating === undefined) return false;
    if (filter.min !== null && row.rating < filter.min) return false;
    if (filter.max !== null && row.rating > filter.max) return false;
  }
  return true;
};

// Every tag among the rows with how many rows carry it, commonest first.
export const tagCounts = (rows) => {
  const counts = new Map();
  for (const row of rows) {
    for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

// The page state that belongs in a link: whose list, and how it is sorted
// and filtered. Defaults are left out so links stay short.
export const readParams = (search) => {
  const params = new URLSearchParams(search);
  const sort = params.get("sort") ?? "";
  const descending = sort.startsWith("-");
  const key = descending ? sort.slice(1) : sort;
  return {
    handle: (params.get("handle") ?? "").trim(),
    sort: Object.hasOwn(SORTS, key) ? { key, descending } : null,
    query: params.get("q") ?? "",
    min: params.get("min") ?? "",
    max: params.get("max") ?? "",
    tag: params.get("tag") ?? "",
    showTags: params.get("tags") === "1",
  };
};

export const writeParams = ({ lang, handle, sort, query = "", min = "", max = "", tag = "", showTags = false }) => {
  const params = new URLSearchParams();
  if (lang) params.set("lang", lang);
  if (handle) params.set("handle", handle);
  if (sort && !(sort.key === "rating" && !sort.descending)) {
    params.set("sort", `${sort.descending ? "-" : ""}${sort.key}`);
  }
  if (query.trim()) params.set("q", query.trim());
  if (bound(min) !== null) params.set("min", String(bound(min)));
  if (bound(max) !== null) params.set("max", String(bound(max)));
  if (tag) params.set("tag", tag);
  if (showTags) params.set("tags", "1");
  return params.toString();
};

// Rows as arrays for localStorage: the field names would otherwise be most of
// the bytes, and the storage is shared with every other page on the origin.
const PACKED_FIELDS = [
  "contestId", "index", "name", "rating", "tags", "verdict", "submissionId", "lastTime", "tries", "problemsetName",
];

export const packRows = (rows) => rows.map((row) => PACKED_FIELDS.map((field) => row[field] ?? null));

// Anything that does not look like a packed row is a sign the stored copy is
// not ours or not this version's, so the whole thing is refused.
export const unpackRows = (packed) => {
  if (!Array.isArray(packed)) return null;
  const rows = [];
  for (const item of packed) {
    if (!Array.isArray(item) || item.length !== PACKED_FIELDS.length) return null;
    const row = {};
    PACKED_FIELDS.forEach((field, i) => {
      if (item[i] !== null) row[field] = item[i];
    });
    const contest = Number.isFinite(row.contestId) || typeof row.problemsetName === "string";
    if (!contest || typeof row.index !== "string" || typeof row.name !== "string") {
      return null;
    }
    row.tags = Array.isArray(row.tags) ? row.tags : [];
    rows.push(row);
  }
  return rows;
};

// How long ago, as the [value, unit] Intl.RelativeTimeFormat wants: "now"
// under a minute, then minutes, hours and days.
export const ageParts = (ms) => {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 60) return [0, "second"];
  if (seconds < 3600) return [-Math.floor(seconds / 60), "minute"];
  if (seconds < 86400) return [-Math.floor(seconds / 3600), "hour"];
  return [-Math.floor(seconds / 86400), "day"];
};

const UNRATED_SORTS_LAST = 1e6;

// One row per unsolved problem: the problem, its newest attempt, and how many
// attempts there were. user.status lists submissions newest first, so the
// first one seen for a problem is the latest.
//
// A problem shared by a Div. 1 and a Div. 2 round is submitted to under either
// contest, so one solved in one counts as solved in the other: same name and
// rating, in a contest one or two numbers away (parallel rounds are numbered
// side by side). Only the user's own submissions are needed for that.
export const findUnsolved = (submissions) => {
  const solved = new Set();
  const solvedByName = new Map();
  for (const item of submissions) {
    if (item.verdict !== "OK") continue;
    const { problem } = item;
    solved.add(problemKey(problem));
    if (!solvedByName.has(problem.name)) solvedByName.set(problem.name, []);
    solvedByName.get(problem.name).push(problem);
  }
  const solvedInTwin = (problem) => solvedByName.get(problem.name)?.some((other) => {
    const apart = Math.abs(other.contestId - problem.contestId);
    return apart >= 1 && apart <= 2 && other.rating === problem.rating;
  });

  const unsolved = new Map();
  for (const item of submissions) {
    const key = problemKey(item.problem);
    if (solved.has(key) || solvedInTwin(item.problem)) continue;
    const seen = unsolved.get(key);
    if (seen) {
      seen.tries += 1;
      continue;
    }
    const { problem } = item;
    unsolved.set(key, {
      contestId: problem.contestId,
      problemsetName: problem.problemsetName,
      index: problem.index,
      name: problem.name,
      rating: problem.rating,
      tags: problem.tags ?? [],
      verdict: item.verdict,
      submissionId: item.id,
      lastTime: item.creationTimeSeconds,
      tries: 1,
    });
  }

  return [...unsolved.values()].sort((left, right) => {
    const a = left.rating ?? UNRATED_SORTS_LAST;
    const b = right.rating ?? UNRATED_SORTS_LAST;
    return a - b;
  });
};
