// The upsolve view's rules: which problems count, what a contest's progress is, and the
// saved copies of the problem list. Loaded with the view (see upsolve.js), not on a plain lookup.
import { fillText, hasParallel, problemKey, solvedCheck } from "./lib.js";

// The key the rated contests of a handle are kept under, encoded as the history and
// friend keys are, so that a handle cannot change the path it is kept at.
export const ratedKey = (handle) => `rating.v1/${encodeURIComponent(handle.toLowerCase())}`;

// The ids of the contests a handle was rated in, from user.rating. Only rated
// contests are listed there: a virtual run or an unrated round is not.
export const ratedContestIds = (ratingChanges) => new Set(ratingChanges.map((change) => change.contestId));

// The contests a handle took part in: those in its rating history, and those its
// submissions were made in as a contestant, a virtual participant or out of
// competition (see taken in foldSubmissions()).
export const tookPartIn = (ratedIds, taken) => new Set([...ratedIds, ...taken]);

// The problems of the contests a handle was rated in that it has neither solved
// nor tried, as rows for the list: no attempt, zero tries. A problem solved in
// its parallel round counts as solved, as in solvedCheck(). `rows` are the
// problems already listed as attempted, and stay the only row of their problem:
// a copy of one of them in a parallel round is the same problem, as in foldSubmissions().
// The check untriedRows() needs, built once for a history and the rows listed from it,
// as the page keeps it: whether a problem is solved or listed already, and the
// start of each contest the handle entered.
export const listedCheck = (solved, rows) => {
  const startOf = new Map(solved.starts);
  const known = solvedCheck({
    keys: [...solved.keys, ...rows.map(problemKey)],
    twins: [
      ...solved.twins,
      ...rows.filter(hasParallel).map((row) => [row.name, row.rating ?? null, row.contestId, startOf.get(row.contestId) ?? null]),
    ],
  });
  return { startOf, isKnown: (problem) => known(problem, startOf.get(problem.contestId)) };
};

export const untriedRows = (problems, contestIds, check) => {
  const { startOf } = check;
  return problems
    .filter((problem) => contestIds.has(problem.contestId))
    .filter((problem) => !check.isKnown(problem))
    .map((problem) => ({
      contestId: problem.contestId,
      index: problem.index,
      name: problem.name,
      rating: problem.rating,
      solvedCount: problem.solvedCount,
      tags: problem.tags,
      tries: 0,
      start: startOf.get(problem.contestId) ?? null,
      inRound: false,
    }));
};

// The problemset as it is kept between visits: one array per problem, with its
// solved count from problemStatistics, which the call returns beside the list.
export const packProblemset = ({ problems, problemStatistics }) => {
  const solvedCount = new Map(problemStatistics.map((stat) => [`${stat.contestId}|${stat.index}`, stat.solvedCount]));
  return problems.map((problem) => [
    problem.contestId, problem.index, problem.name, problem.rating ?? null, problem.tags ?? [],
    solvedCount.get(`${problem.contestId}|${problem.index}`) ?? null,
  ]);
};

// Anything that does not look like a packed problem refuses the whole copy.
export const unpackProblemset = (packed) => {
  if (!Array.isArray(packed)) return null;
  const problems = [];
  for (const item of packed) {
    if (!Array.isArray(item) || item.length !== 6 || !Number.isInteger(item[0])
      || typeof item[1] !== "string" || typeof item[2] !== "string" || !Array.isArray(item[4])) return null;
    problems.push({
      contestId: item[0],
      index: item[1],
      name: item[2],
      rating: item[3] ?? undefined,
      tags: item[4],
      solvedCount: item[5] ?? undefined,
    });
  }
  return problems;
};

// How many problems of each contest the problemset lists, and how many of them
// the handle has solved (a parallel-round copy counts, as in solvedCheck()), as a
// Map from contest id to { solved, total }.
export const contestProgress = (problems, solved) => {
  const startOf = new Map(solved.starts);
  const known = solvedCheck(solved);
  const progress = new Map();
  for (const problem of problems) {
    const entry = progress.get(problem.contestId) ?? { solved: 0, total: 0 };
    entry.total += 1;
    if (known(problem, startOf.get(problem.contestId) ?? null)) entry.solved += 1;
    progress.set(problem.contestId, entry);
  }
  return progress;
};

// The note on a problem id: its contest's progress, or nothing for a contest the
// progress does not cover.
export const contestNote = (progress, contestId, template) => {
  const entry = progress.get(contestId);
  return entry ? fillText(template, entry) : "";
};

// Overlapping calls with the same key share one run of `load`: a call made while
// a run is still in flight gets that run's answer, and a call made after it has
// settled starts another. Nothing is kept beyond the run itself.
export const shareInFlight = (load) => {
  const inFlight = new Map();
  return (key) => {
    if (!inFlight.has(key)) {
      const run = Promise.resolve().then(() => load(key)).finally(() => inFlight.delete(key));
      inFlight.set(key, run);
    }
    return inFlight.get(key);
  };
};

// Sets each row's solved count from the problemset, for the rows that are listed.
// A problem the problemset does not know keeps no count.
export const attachSolvedCounts = (rows, problems) => {
  const counts = new Map(problems.map((problem) => [problemKey(problem), problem.solvedCount]));
  for (const row of rows) row.solvedCount = counts.get(problemKey(row));
  return rows;
};
