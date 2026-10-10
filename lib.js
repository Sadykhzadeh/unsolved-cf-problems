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

export const submissionLink = (submission) =>
  `https://codeforces.com/contest/${submission.problem.contestId}/submission/${submission.id}`;

const UNRATED_SORTS_LAST = 1e6;

// user.status lists submissions newest first, so the first one seen for a
// problem is the latest attempt at it.
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
    if (solved.has(key) || unsolved.has(key)) continue;
    unsolved.set(key, item);
  }

  return [...unsolved.values()].sort((left, right) => {
    const a = left.problem.rating ?? UNRATED_SORTS_LAST;
    const b = right.problem.rating ?? UNRATED_SORTS_LAST;
    return a - b;
  });
};
