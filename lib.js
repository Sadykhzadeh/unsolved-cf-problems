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

// Exact lookup rather than `full.includes(verdict)`: a substring match maps
// any verdict that happens to sit inside another one onto the wrong row, and
// a submission still being judged has no verdict at all - `includes(undefined)`
// came back false and the table printed the word "undefined".
const verdictsByName = new Map(verdicts.map((v) => [v.full, v]));

// Returns [short label, full label].
export const verdictLabel = (verdict) => {
  if (!verdict) return ["?", "not judged yet"];
  const known = verdictsByName.get(verdict);
  if (!known) return [verdict, verdict];
  return [known.short, known.label ?? known.full];
};

export const problemKey = (problem) => `${problem.contestId}|${problem.index}`;

export const problemLink = (problem) => {
  // Gym contests live under a different path.
  return +problem.contestId >= 100000
    ? `https://codeforces.com/problemset/gymProblem/${problem.contestId}/${problem.index}`
    : `https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`;
};

export const submissionLink = (row) =>
  `https://codeforces.com/contest/${row.contestId}/submission/${row.submissionId}`;

// Sorts a failed user.status call into something a person can act on. Every
// failure used to read "Error 4xx: Perhaps this handle does not exist",
// including Codeforces being down or rate-limiting, which sent people off to
// check a handle that was fine.
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

// What each sortable column compares, and which way a first click sorts it:
// easiest, most fought over and most recent first.
const SORTS = {
  problem: {
    compare: (a, b) => a.contestId - b.contestId || a.index.localeCompare(b.index, "en", { numeric: true }),
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

const UNRATED_SORTS_LAST = 1e6;

// One row per unsolved problem: the problem, its newest attempt, and how many
// attempts there were. user.status lists submissions newest first, so the
// first one seen for a problem is the latest.
export const findUnsolved = (submissions) => {
  // This was two passes over a map called allBadSubmissions that in fact held
  // the solved ones, and it read `== null` to mean absent. A Set of the
  // problems that were ever accepted says what it means.
  const solved = new Set();
  for (const item of submissions) {
    if (item.verdict === "OK") solved.add(problemKey(item.problem));
  }

  const unsolved = new Map();
  for (const item of submissions) {
    const key = problemKey(item.problem);
    if (solved.has(key)) continue;
    const seen = unsolved.get(key);
    if (seen) {
      seen.tries += 1;
      continue;
    }
    const { problem } = item;
    unsolved.set(key, {
      contestId: problem.contestId,
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
