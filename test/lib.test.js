import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ageParts,
  countText,
  describeFailure,
  NEWEST_COUNT,
  SETTLE_SECONDS,
  advance,
  emptyDigest,
  emptyKind,
  failedTest,
  fetchApi,
  fetchJson,
  emptyState,
  findUnsolved,
  foldSubmissions,
  hasTagCounts,
  fillText,
  isFresh,
  solvedFor,
  isClearTagsKey,
  isHelpKey,
  isPickKey,
  isSearchKey,
  isUsableDigest,
  reachesDigest,
  relativeAge,
  rowKeyAction,
  rememberHandle,
  rememberedView,
  isTimeout,
  makeFilter,
  matchesFilter,
  packRows,
  parseHandle,
  pickOne,
  problemKey,
  problemLink,
  rankClass,
  readParams,
  solvedCheck,
  solvedSummary,
  sortRows,
  submissionLink,
  summarizeSolved,
  tagCounts,
  unpackRows,
  unsolvedRows,
  verdictLabel,
  viewOf,
  writeParams,
} from "../lib.js";
import { sortTags, tagSummary } from "../tagtable.js";
import { countSolvedBy } from "../friend.js";
import { isBucket, ratingBandName, ratingBuckets } from "../rating-strip.js";
import { weakTagName, weakTags } from "../tags.js";
import {
  attachSolvedCounts, contestNote, contestProgress, listedCheck, packProblemset, ratedContestIds, ratedKey,
  shareInFlight, tookPartIn, unpackProblemset, untriedRows,
} from "../lib-upsolve.js";
import { csvTable, markdownTable } from "../lib-export.js";
import { createKeys } from "../keys.js";

// Trimmed copies of the API answers, in the shape the API returns them.
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

let nextId = 1000;
let clock = 2_000_000_000;
// Built in the order user.status returns them: newest first.
const submission = (contestId, index, verdict, rating) => ({
  id: nextId++,
  creationTimeSeconds: clock--,
  verdict,
  problem: { contestId, index, name: `${contestId}${index}`, tags: [], rating },
});

test("a problem accepted once is solved, however many attempts failed", () => {
  const rows = findUnsolved([
    submission(1, "A", "WRONG_ANSWER", 800),
    submission(1, "A", "OK", 800),
    submission(1, "A", "TIME_LIMIT_EXCEEDED", 800),
  ]);
  assert.deepEqual(rows, []);
});

test("each unsolved problem appears once, with its newest attempt and the count", () => {
  const newest = submission(2, "B", "TIME_LIMIT_EXCEEDED", 1200);
  newest.author = { participantType: "PRACTICE", startTimeSeconds: 1_266_000_000 };
  newest.passedTestCount = 36;
  newest.testset = "TESTS";
  const rows = findUnsolved([
    newest,
    submission(2, "B", "WRONG_ANSWER", 1200),
    submission(2, "B", "COMPILATION_ERROR", 1200),
  ]);
  assert.deepEqual(rows, [{
    contestId: 2,
    problemsetName: undefined,
    index: "B",
    name: "2B",
    rating: 1200,
    tags: [],
    verdict: "TIME_LIMIT_EXCEEDED",
    passedTestCount: 36,
    testset: "TESTS",
    submissionId: newest.id,
    lastTime: newest.creationTimeSeconds,
    tries: 3,
    start: 1_266_000_000,
    inRound: false,
  }]);
});

test("a problem tried during a round, live or virtual, can be kept apart from practice", () => {
  const by = (contestId, index, participantType) => {
    const item = submission(contestId, index, "WRONG_ANSWER", 1500);
    item.author = { participantType, startTimeSeconds: 1_600_000_000 };
    return item;
  };
  const rows = findUnsolved([
    by(1, "A", "PRACTICE"),
    by(1, "A", "CONTESTANT"),
    by(2, "A", "PRACTICE"),
    by(3, "A", "OUT_OF_COMPETITION"),
    by(4, "A", "VIRTUAL"),
    submission(5, "A", "WRONG_ANSWER", 1500),
  ]);
  assert.deepEqual(rows.map((r) => [r.contestId, r.inRound]), [[1, true], [2, false], [3, true], [4, true], [5, false]]);
  const kept = rows.filter((r) => matchesFilter(r, makeFilter({ inRound: true })));
  assert.deepEqual(kept.map((r) => r.contestId), [1, 3, 4]);
  assert.equal(rows.filter((r) => matchesFilter(r, makeFilter({ inRound: false }))).length, 5);
  const stored = unpackRows(JSON.parse(JSON.stringify(packRows(rows))));
  assert.deepEqual(stored.map((r) => r.inRound), [true, false, true, true, false]);
});

test("the same index in two contests is two problems", () => {
  const rows = findUnsolved([
    submission(3, "A", "OK", 800),
    submission(4, "A", "WRONG_ANSWER", 800),
  ]);
  assert.deepEqual(rows.map((r) => r.contestId), [4]);
});

test("a problem failed in both copies of a shared round is listed once", () => {
  const copy = (contestId, index, verdict) => {
    const item = submission(contestId, index, verdict, 1500);
    item.problem.name = "Shared Sum";
    return item;
  };
  const rows = findUnsolved([
    copy(1521, "C", "WRONG_ANSWER"),
    copy(1520, "A", "TIME_LIMIT_EXCEEDED"),
    submission(1600, "A", "WRONG_ANSWER", 1500),
  ]);
  assert.deepEqual(rows.map((r) => [r.contestId, r.index, r.tries]), [[1521, "C", 2], [1600, "A", 1]]);
});

test("a problem solved in its parallel round is not unsolved", () => {
  const twin = (contestId, index, verdict, rating = 1900) => {
    const item = submission(contestId, index, verdict, rating);
    item.problem.name = "Shared";
    return item;
  };
  assert.deepEqual(findUnsolved([twin(1500, "C", "WRONG_ANSWER"), twin(1501, "E", "OK")]), []);
  assert.deepEqual(findUnsolved([twin(1501, "E", "OK"), twin(1500, "C", "WRONG_ANSWER")]), []);
  // too far apart, or another rating: a different problem with the same name
  assert.equal(findUnsolved([twin(1500, "C", "WRONG_ANSWER"), twin(1508, "E", "OK")]).length, 1);
  assert.equal(findUnsolved([twin(1500, "C", "WRONG_ANSWER"), twin(1501, "E", "OK", 1200)]).length, 1);
  // The finals of a cup and its online mirror run days apart, a few contests
  // apart: VK Cup 2015 Finals is 562 and the mirror 566, the ABBYY Cup 3.0
  // finals 324 and 331. Matching Names was failed in one and accepted in the other.
  assert.deepEqual(findUnsolved([twin(562, "F", "MEMORY_LIMIT_EXCEEDED", 2300), twin(566, "A", "OK", 2300)]), []);
  assert.deepEqual(findUnsolved([twin(331, "D", "OK", 2400), twin(324, "D", "WRONG_ANSWER", 2400)]), []);
  assert.equal(findUnsolved([twin(324, "D", "WRONG_ANSWER", 2400), twin(331, "D", "WRONG_ANSWER", 2400)]).length, 1);
  // Two rounds that started together but are numbered too far apart for the
  // numbers to say so (the halves of Round 942, 1967 and 1972, are close enough)
  const inRound = (contestId, index, verdict, participantType, startTimeSeconds) => {
    const item = twin(contestId, index, verdict, 1400);
    item.author = { participantType, startTimeSeconds };
    return item;
  };
  assert.deepEqual(findUnsolved([
    inRound(1972, "D1", "WRONG_ANSWER", "PRACTICE", 1714487700),
    inRound(1950, "B1", "OK", "PRACTICE", 1714487700),
  ]), []);
  // a virtual run of the Div. 2 round says nothing about when it started
  assert.equal(findUnsolved([
    inRound(1972, "D1", "WRONG_ANSWER", "VIRTUAL", 1714487700),
    inRound(1950, "B1", "OK", "VIRTUAL", 1714487700),
  ]).length, 1);
  assert.equal(findUnsolved([
    inRound(1972, "D1", "WRONG_ANSWER", "CONTESTANT", 1714487700),
    inRound(1950, "B1", "OK", "PRACTICE", 1714400000),
  ]).length, 1);
  // neighbouring gym contests, both unrated, each with a problem called "E"
  const gym = (contestId, verdict) => {
    const item = submission(contestId, "E", verdict, undefined);
    item.problem.name = "E";
    return item;
  };
  assert.equal(findUnsolved([gym(100093, "TIME_LIMIT_EXCEEDED"), gym(100092, "OK")]).length, 1);
});

test("newer submissions fold into a saved state the same as a whole history reads", () => {
  // Tries, a solve that clears a row, the other copy of a shared round and a
  // problem first met only in the newer part.
  const item = (id, contestId, index, verdict, extra = {}) => ({
    id,
    creationTimeSeconds: 1_600_000_000 + id,
    verdict,
    author: { participantType: "PRACTICE", startTimeSeconds: 1_500_000_000 + contestId },
    problem: { contestId, index, name: extra.name ?? `${contestId}${index}`, tags: ["dp"], rating: extra.rating ?? 1500 },
  });
  const history = [
    item(20, 1501, "E", "WRONG_ANSWER", { name: "Shared" }),
    item(19, 30, "A", "OK"),
    item(18, 10, "B", "TIME_LIMIT_EXCEEDED"),
    item(17, 1500, "C", "WRONG_ANSWER", { name: "Shared" }),
    item(16, 20, "A", "WRONG_ANSWER"),
    item(15, 10, "B", "WRONG_ANSWER"),
    item(14, 20, "A", "WRONG_ANSWER"),
    item(13, 30, "A", "WRONG_ANSWER"),
    item(12, 40, "C", "WRONG_ANSWER", { rating: 1200 }),
    item(11, 40, "C", "OK", { rating: 1200 }),
  ];
  // Rows come back from JSON without their undefined fields.
  const stored = (rows) => JSON.parse(JSON.stringify(rows));
  const whole = findUnsolved(history);
  assert.deepEqual(whole.map((r) => [r.contestId, r.index, r.tries]), [[1501, "E", 2], [10, "B", 2], [20, "A", 2]]);
  for (let cut = 0; cut <= history.length; cut += 1) {
    // The saved state goes through JSON, as it does in storage.
    const saved = JSON.parse(JSON.stringify(foldSubmissions(emptyState(), history.slice(cut))));
    assert.deepEqual(stored(unsolvedRows(foldSubmissions(saved, history.slice(0, cut)))), stored(whole), `split after ${cut}`);
  }
});

const DAY = 24 * 60 * 60;
const NOW = 1_700_000_000;
// A submission made `ageDays` before NOW, newest first as user.status lists them.
const aged = (id, ageDays, contestId, index, verdict) => ({
  id,
  creationTimeSeconds: NOW - Math.round(ageDays * DAY),
  verdict,
  problem: { contestId, index, name: `${contestId}${index}`, tags: [], rating: 1500 },
});

test("a refresh from the newest submissions gives the list a full read gives", () => {
  const oldPart = [
    aged(5, 40, 10, "A", "WRONG_ANSWER"),
    aged(4, 41, 20, "B", "WRONG_ANSWER"),
    aged(3, 42, 20, "B", "OK"),
    aged(2, 43, 30, "C", "TIME_LIMIT_EXCEEDED"),
    aged(1, 44, 30, "C", "TIME_LIMIT_EXCEEDED"),
  ];
  const first = advance(emptyDigest(NOW), oldPart, NOW);
  assert.deepEqual(first.rows.map((r) => [r.contestId, r.tries]), [[10, 1], [30, 2]]);
  assert.equal(first.submissions, 5);

  // Two days later: a new attempt at 10A, 30C solved, a new problem failed.
  const later = NOW + 2 * DAY;
  const newest = [
    { ...aged(8, 0, 40, "D", "WRONG_ANSWER"), creationTimeSeconds: later - 100 },
    { ...aged(7, 0, 30, "C", "OK"), creationTimeSeconds: later - 5000 },
    { ...aged(6, 0, 10, "A", "WRONG_ANSWER"), creationTimeSeconds: later - 9000 },
  ];
  const second = advance(first.digest, newest, later);
  assert.deepEqual(second.rows.map((r) => [r.contestId, r.tries]), [[40, 1], [10, 2]]);
  assert.equal(second.submissions, 8);
  assert.deepEqual(second.rows, findUnsolved([...newest, ...oldPart]));
  // and the digest it leaves can be advanced again
  const third = advance(second.digest, newest, later + 60);
  assert.deepEqual(third.rows, second.rows);
  assert.equal(third.submissions, 8);
});

test("the solved problems of a refreshed state are those of a full read", () => {
  const solve = (id, ageDays, contestId, index, startTimeSeconds, participantType = "PRACTICE") => ({
    ...aged(id, ageDays, contestId, index, "OK"),
    author: { participantType, startTimeSeconds },
  });
  // Ages are from NOW + 2 days, when the second read is made.
  const history = [
    solve(6, 0.5, 1972, "D1", 1714487700),
    solve(5, 1.5, 1950, "B1", 1714487700),
    solve(4, 4, 20, "A", 1_000_000, "VIRTUAL"),
    solve(3, 5, 20, "A", 1_000_000),
    aged(2, 6, 7, "C", "WRONG_ANSWER"),
    solve(1, 7, 100093, "E", 1_100_000),
  ].map((item) => ({ ...item, creationTimeSeconds: item.creationTimeSeconds + 2 * DAY }));
  const first = advance(emptyDigest(NOW), history.slice(2), NOW);
  const second = advance(first.digest, history, NOW + 2 * DAY);
  // The order they are listed in does not matter, what is in them does.
  const ordered = ({ keys, twins }) => ({ keys: [...keys].sort(), twins: twins.map(String).sort() });
  assert.deepEqual(ordered(solvedSummary(second.state)), ordered(summarizeSolved(history)));
  assert.deepEqual(ordered(solvedSummary(advance(emptyDigest(NOW), history, NOW).state)), ordered(summarizeSolved(history)));
});

test("a submission still inside the settling window is read again on the next refresh", () => {
  const hour = 3600;
  const accepted = { ...aged(2, 0, 10, "A", "OK"), creationTimeSeconds: NOW - hour };
  const first = advance(emptyDigest(NOW), [accepted], NOW);
  assert.deepEqual(first.rows, []);
  // The system tests failed it afterwards.
  const failed = { ...accepted, verdict: "WRONG_ANSWER" };
  const second = advance(first.digest, [failed], NOW + hour);
  assert.deepEqual(second.rows.map((r) => [r.contestId, r.verdict, r.tries]), [[10, "WRONG_ANSWER", 1]]);
  assert.equal(second.submissions, 1);
  // Once it is older than the window it is part of the digest.
  const third = advance(second.digest, [failed], NOW + SETTLE_SECONDS + 2 * hour);
  assert.equal(third.digest.count, 1);
  assert.equal(third.digest.cutoff, NOW + 2 * hour);
});

test("the newest submissions reach a saved history when they go back past its cutoff or are all there is", () => {
  const digest = { ...emptyDigest(NOW), cutoff: NOW - 10 * DAY };
  const at = (ageDays) => ({ creationTimeSeconds: NOW - ageDays * DAY });
  assert.equal(reachesDigest(digest, [at(1), at(11)], 2), true);
  assert.equal(reachesDigest(digest, [at(1), at(2)], 2), false);
  assert.equal(reachesDigest(digest, [at(1), at(2)], NEWEST_COUNT), true);
  assert.equal(isUsableDigest(digest, NOW + 2 * DAY), true);
  assert.equal(isUsableDigest(digest, NOW + 4 * DAY), false);
  assert.equal(isUsableDigest(null, NOW), false);
});

test("a copy is fresh while younger than its age, and stale when stamped well ahead of the clock", () => {
  const minute = 60;
  assert.equal(isFresh(NOW - 5 * minute, NOW, 10 * minute, minute), true, "an ordinary fresh copy");
  assert.equal(isFresh(NOW - 11 * minute, NOW, 10 * minute, minute), false, "an old copy");
  assert.equal(isFresh(NOW + 30, NOW, 10 * minute, minute), true, "stamped a little ahead, within the slack");
  assert.equal(isFresh(NOW + 400 * DAY, NOW, 10 * minute, minute), false, "stamped far ahead");
  assert.equal(isUsableDigest(emptyDigest(NOW + 400 * DAY), NOW), false, "a digest built far ahead is rebuilt");
  assert.equal(isUsableDigest(emptyDigest(NOW + 30), NOW), true, "a digest built a little ahead is kept");
});

test("a friend's solved problems narrow the list, parallel rounds included", () => {
  const solve = (contestId, index, name, rating, startTimeSeconds) => {
    const item = submission(contestId, index, "OK", rating);
    item.problem.name = name;
    item.author = { participantType: "PRACTICE", startTimeSeconds };
    return item;
  };
  const friend = [
    solve(1950, "B1", "Reverse Card (Easy Version)", 1400, 1714487700),
    solve(1500, "C", "Shared", 1900, 1614000000),
    solve(4, "A", "Watermelon", 800, 1268000000),
    solve(100092, "E", "E", undefined, 1340000000),
  ];
  // what is kept goes through JSON on its way to the cache and back
  const solvedBy = solvedCheck(JSON.parse(JSON.stringify(summarizeSolved(friend))));
  const row = (contestId, index, name, rating, start) => ({ contestId, index, name, rating, start, tags: [] });

  assert.equal(solvedBy(row(4, "A", "Watermelon", 800)), true);
  assert.equal(solvedBy(row(5, "A", "Watermelon", 800)), true, "one contest away, same name and rating");
  assert.equal(solvedBy(row(1501, "E", "Shared", 1900)), true);
  assert.equal(solvedBy(row(1972, "D1", "Reverse Card (Easy Version)", 1400), 1714487700), true);
  assert.equal(solvedBy(row(1972, "D1", "Reverse Card (Easy Version)", 1400), 1714400000), false);
  assert.equal(solvedBy(row(1509, "E", "Shared", 1900)), false);
  assert.equal(solvedBy(row(1501, "E", "Shared", 2100)), false);
  assert.equal(solvedBy(row(100092, "E", "E")), true);
  assert.equal(solvedBy(row(100093, "E", "E")), false, "the gym has no parallel rounds");

  const rows = [
    row(1972, "D1", "Reverse Card (Easy Version)", 1400, 1714487700),
    row(1520, "F2", "Guess the K-th Zero (Hard version)", 2200, 1620000000),
  ];
  // packed for storage, a row keeps its contest's start for the match
  const [kept] = unpackRows(JSON.parse(JSON.stringify(packRows(rows))));
  assert.deepEqual(rows.filter((r) => matchesFilter(r, makeFilter({ solvedBy }))), [rows[0]]);
  assert.equal(matchesFilter(kept, makeFilter({ solvedBy })), true);
});

test("acmsguru problems, which have no contest, are listed, linked and kept", () => {
  // As user.status returns them: a problemsetName and no contestId anywhere.
  const sguru = (index, verdict) => {
    const item = submission(undefined, index, verdict, undefined);
    delete item.problem.contestId;
    item.problem.problemsetName = "acmsguru";
    return item;
  };
  const rows = findUnsolved([sguru("112", "WRONG_ANSWER"), sguru("105", "OK"), submission(4, "A", "WRONG_ANSWER", 800)]);
  assert.deepEqual(rows.map(problemKey), ["4|A", "acmsguru|112"]);

  const [, row] = rows;
  assert.equal(problemLink(row), "https://codeforces.com/problemsets/acmsguru/problem/99999/112");
  assert.equal(
    submissionLink(row),
    `https://codeforces.com/problemsets/acmsguru/submission/99999/${row.submissionId}`,
  );
  assert.deepEqual(sortRows(rows, "problem", false).map(problemKey), ["4|A", "acmsguru|112"]);
  assert.deepEqual(sortRows(rows, "problem", true).map(problemKey), ["acmsguru|112", "4|A"]);
  assert.equal(matchesFilter(row, makeFilter({ query: "acmsguru112" })), true);
  assert.equal(matchesFilter(row, makeFilter({ query: "https://codeforces.com/problemsets/acmsguru/problem/99999/112" })), true);
  assert.deepEqual(unpackRows(JSON.parse(JSON.stringify(packRows(rows)))), JSON.parse(JSON.stringify(rows)));
});

test("rows go easiest first, unrated last", () => {
  const rows = findUnsolved([
    submission(5, "A", "WRONG_ANSWER", undefined),
    submission(6, "A", "WRONG_ANSWER", 2100),
    submission(7, "A", "WRONG_ANSWER", 800),
  ]);
  assert.deepEqual(rows.map((r) => r.rating), [800, 2100, undefined]);
});

test("rows sort by any column either way, unrated staying last", () => {
  const row = (contestId, index, name, rating, tries, lastTime) =>
    ({ contestId, index, name, rating, tries, lastTime });
  const rows = [
    row(10, "B", "Beta", 1500, 1, 300),
    row(10, "A", "alpha", undefined, 7, 100),
    row(2, "C", "Gamma", 900, 3, 200),
    row(10, "A2", "Delta", 1500, 2, 50),
  ];
  const names = (sorted) => sorted.map((r) => r.name);

  assert.deepEqual(names(sortRows(rows, "rating", false)), ["Gamma", "Beta", "Delta", "alpha"]);
  assert.deepEqual(names(sortRows(rows, "rating", true)), ["Beta", "Delta", "Gamma", "alpha"]);
  assert.deepEqual(names(sortRows(rows, "tries", true)), ["alpha", "Gamma", "Delta", "Beta"]);
  assert.deepEqual(names(sortRows(rows, "last", true)), ["Beta", "Gamma", "alpha", "Delta"]);
  assert.deepEqual(names(sortRows(rows, "name", false)), ["alpha", "Beta", "Delta", "Gamma"]);
  // A < A2 < B within a contest, and contest 10 after contest 2.
  assert.deepEqual(names(sortRows(rows, "problem", false)), ["Gamma", "alpha", "Delta", "Beta"]);
  assert.equal(rows[0].name, "Beta", "the input is left alone");
});

test("a blank bound in a link is no bound, rather than zero", () => {
  const row = { contestId: 1, index: "A", name: "x", tags: [], rating: 1500 };
  const filter = makeFilter({ min: " ", max: "\t" });
  assert.equal(filter.min, null);
  assert.equal(filter.max, null);
  assert.equal(matchesFilter(row, filter), true);
  assert.equal(matchesFilter(row, makeFilter({ max: "1000" })), false);
});

test("the filter narrows by name or id, tag, rating range, kind of contest and what is hidden", () => {
  const row = (contestId, index, name, rating, tags) => ({ contestId, index, name, rating, tags });
  const rows = [
    row(1520, "F2", "Guess the K-th Zero (Hard version)", 2200, ["binary search", "interactive"]),
    row(4, "A", "Watermelon", 800, ["brute force", "math"]),
    row(2000, "H", "Fresh One", undefined, ["dp"]),
    row(100092, "E", "E", undefined, []),
    row(1952, "J", "Ordinary Problem", undefined, ["*special"]),
  ];
  const pick = (fields) => rows.filter((r) => matchesFilter(r, makeFilter(fields))).map((r) => r.name);

  assert.equal(pick({}).length, 5, "an empty filter keeps everything");
  assert.deepEqual(pick({ query: "  WATER " }), ["Watermelon"]);
  assert.deepEqual(pick({ query: "1520f2" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ query: "1520|F" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ query: "1520" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ query: "20F2" }), [], "an id matches from its start");
  assert.deepEqual(pick({ query: "https://codeforces.com/contest/1520/problem/F2" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ query: "codeforces.com/problemset/problem/4/A?locale=ru" }), ["Watermelon"]);
  assert.deepEqual(pick({ query: "https://m1.codeforces.com/gym/100092/problem/E" }), ["E"]);
  assert.deepEqual(pick({ query: "https://codeforc.es/contest/1520/problem/F2" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ query: "https://codeforces.com/problemset/gymProblem/100092/E" }), ["E"]);
  assert.deepEqual(pick({ query: "https://codeforces.com/contest/1520/problem/A" }), [], "another problem of the contest");
  // tourist's list: 3C is one problem, not 23C, 273C and 573C as well
  const ids = [row(3, "C", "Tic-tac-toe"), row(23, "C", "Oranges and Apples"), row(273, "C", "Dima and Horses")];
  assert.deepEqual(ids.filter((r) => matchesFilter(r, makeFilter({ query: "3c" }))).map(problemKey), ["3|C"]);
  assert.deepEqual(ids.filter((r) => matchesFilter(r, makeFilter({ query: "3|C" }))).map(problemKey), ["3|C"]);
  assert.deepEqual(pick({ tags: ["math"] }), ["Watermelon"]);
  assert.deepEqual(pick({ tags: ["math", "brute force"] }), ["Watermelon"], "all of the tags");
  assert.deepEqual(pick({ tags: ["math", "dp"] }), [], "no problem has both");
  assert.deepEqual(pick({ tags: ["math", "dp"], tagAny: true }), ["Watermelon", "Fresh One"], "any of the tags");
  assert.equal(pick({ tags: [], tagAny: true }).length, 5, "no tags is no filter, whichever the mode");
  assert.deepEqual(pick({ min: "1000" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ max: 800 }), ["Watermelon"]);
  assert.deepEqual(pick({ min: "800", max: "2200" }).length, 2, "bounds are inclusive; unrated is out");
  assert.equal(pick({ min: "abc" }).length, 5, "an unreadable bound is no bound");
  const all = pick({});
  assert.deepEqual(pick({ noGym: true }), all.filter((name) => name !== "E"));
  assert.deepEqual(pick({ noSpecial: true }), all.filter((name) => name !== "Ordinary Problem"));
  assert.deepEqual(pick({ noGym: true, noSpecial: true, tags: ["dp"] }), ["Fresh One"]);
  assert.deepEqual(pick({ hidden: new Set(["4|A", "100092|E"]) }), all.filter((name) => name !== "Watermelon" && name !== "E"));
  assert.equal(pick({ hidden: new Set() }).length, 5, "nothing hidden");
  assert.equal(pick({ hidden: ["4|A"] }).length, 5, "only a Set of keys counts");
});

test("a pick at random moves on from the last one when it can", () => {
  const rows = [{ name: "a" }, { name: "b" }, { name: "c" }];
  assert.equal(pickOne(rows, null, () => 0), rows[0]);
  assert.equal(pickOne(rows, null, () => 0.99), rows[2]);
  assert.equal(pickOne(rows, rows[0], () => 0), rows[1]);
  assert.equal(pickOne(rows, rows[2], () => 0.99), rows[1]);
  const seen = new Set();
  let last = null;
  for (let i = 0; i < 200; i += 1) {
    const next = pickOne(rows, last);
    assert.notEqual(next, last);
    seen.add(next);
    last = next;
  }
  assert.equal(seen.size, 3);
  assert.equal(pickOne([rows[1]], rows[1]), rows[1], "the only row is picked again");
  assert.equal(pickOne([], null), undefined);
});

test("a rating is shown in the colour of its Codeforces rank, an unrated one in none", () => {
  assert.deepEqual([800, 1199, 1200, 1399, 1400, 1600, 1900, 2100, 2400, 3500].map(rankClass), [
    "rank-newbie", "rank-newbie", "rank-pupil", "rank-pupil", "rank-specialist", "rank-expert", "rank-cm",
    "rank-master", "rank-gm", "rank-gm",
  ]);
  assert.equal(rankClass(undefined), "");
});

test("tags are counted, commonest first", () => {
  const rows = [{ tags: ["dp", "math"] }, { tags: ["math"] }, { tags: ["graphs", "dp", "math"] }];
  assert.deepEqual(tagCounts(rows), [["math", 3], ["dp", 2], ["graphs", 1]]);
});

test("rows survive packing for storage, and foreign data is refused", () => {
  const rows = findUnsolved([
    submission(1520, "F2", "WRONG_ANSWER", 2200),
    submission(1520, "F2", "TIME_LIMIT_EXCEEDED", 2200),
    submission(2000, "H", undefined, undefined),
  ]);
  const stored = JSON.parse(JSON.stringify(packRows(rows)));
  // Missing fields come back missing rather than as explicit undefined.
  assert.deepEqual(unpackRows(stored), JSON.parse(JSON.stringify(rows)));
  assert.equal(unpackRows(stored)[1].rating, undefined);

  assert.equal(unpackRows(null), null);
  assert.equal(unpackRows({ rows: [] }), null);
  assert.equal(unpackRows([["1520", "F2"]]), null);
  assert.equal(unpackRows([[null, "A", "x", null, [], null, 1, 1, 1]]), null);
  assert.deepEqual(unpackRows([]), []);
});

test("ages round down to the largest whole unit", () => {
  assert.deepEqual(ageParts(5_000), [0, "second"]);
  assert.deepEqual(ageParts(-5_000), [0, "second"], "a clock moved back is now");
  assert.deepEqual(ageParts(119_000), [-1, "minute"]);
  assert.deepEqual(ageParts(3 * 3600_000 + 59_000), [-3, "hour"]);
  assert.deepEqual(ageParts(50 * 3600_000), [-2, "day"]);
});

test("a link carries the handle, sort and filters, and nothing at their defaults", () => {
  const state = {
    handle: "tourist",
    sort: { key: "tries", descending: true },
    query: " bear ",
    min: "1200",
    max: "",
    triesMin: "3",
    tags: ["dp"],
    tagAny: false,
    noGym: true,
    noSpecial: true,
    friend: "jiangly",
    inRound: true,
    showTags: true,
    upsolve: true,
    friendMark: true,
  };
  const search = writeParams(state);
  assert.equal(search, "handle=tourist&sort=-tries&q=bear&min=1200&triesmin=3&tag=dp&nogym=1&nospecial=1&friend=jiangly&friendmode=mark&round=1&tags=1&upsolve=1");
  assert.deepEqual(readParams(`?${search}`), { ...state, query: "bear" });

  // Several tags are repeated tag= parameters, and the mode is only written when it matters.
  const several = writeParams({ tags: ["dp", "graphs"], tagAny: true });
  assert.equal(several, "tag=dp&tag=graphs&tagany=1&sort=rating");
  assert.deepEqual(readParams(`?${several}`).tags, ["dp", "graphs"]);
  assert.equal(readParams(`?${several}`).tagAny, true);
  assert.equal(writeParams({ tags: ["dp"], tagAny: true }), "tag=dp&sort=rating");
  assert.equal(writeParams({ tags: ["dp", "dp", ""] }), "tag=dp&sort=rating", "each tag once, none blank");
  assert.deepEqual(readParams("?tag=dp&tag=dp&tag=").tags, ["dp"]);

  assert.equal(writeParams({ handle: "a b&c", sort: { key: "rating", descending: false } }), "handle=a+b%26c&sort=rating");
  assert.equal(writeParams({ lang: "ru", handle: "x", min: "abc" }), "lang=ru&handle=x&sort=rating");
});

test("the filter keeps the problems tried at least the given number of times, and a link names it", () => {
  const rows = [0, 1, 3].map((tries) => ({ contestId: 1, index: "A", name: "a", tags: [], tries }));
  const kept = (triesMin) => rows.filter((row) => matchesFilter(row, makeFilter({ triesMin }))).map((row) => row.tries);
  assert.deepEqual(kept(""), [0, 1, 3], "no bound keeps all");
  assert.deepEqual(kept("1"), [1, 3], "never tried is out once a bound is set");
  assert.deepEqual(kept("3"), [3]);
  assert.deepEqual(kept("abc"), [0, 1, 3], "an unreadable bound is no bound");
  assert.equal(writeParams({ handle: "x", triesMin: "3" }), "handle=x&triesmin=3&sort=rating");
  assert.equal(readParams("?triesmin=3").triesMin, "3");
  assert.equal(writeParams({ triesMin: "abc" }), "", "an unreadable bound is left out of the link");
});

test("a link to the default view names it, so a visitor's remembered view does not replace it", () => {
  const theirs = JSON.stringify({ sort: { key: "tries", descending: true }, noGym: true });
  const link = writeParams({ handle: "tourist", min: "1600" });
  assert.deepEqual(rememberedView(theirs, `?${link}`), {});
  assert.deepEqual(readParams(`?${link}`).sort, { key: "rating", descending: false });
  // Nothing to name when the link carries no list, or already names part of the view.
  assert.equal(writeParams({}), "");
  assert.equal(writeParams({ lang: "ru" }), "lang=ru");
  assert.equal(writeParams({ handle: "x", noGym: true }), "handle=x&nogym=1");
  assert.equal(writeParams({ handle: "x", showTags: true }), "handle=x&tags=1");
});

test("the view is remembered for a link that does not set it, and only then", () => {
  const stored = JSON.stringify(viewOf({
    sort: { key: "tries", descending: true }, showTags: true, noGym: true, noSpecial: false, query: "dp",
  }));
  assert.deepEqual(rememberedView(stored, "?handle=tourist"), {
    sort: { key: "tries", descending: true }, showTags: true, noGym: true, noSpecial: false,
  });
  assert.deepEqual(rememberedView(stored, ""), rememberedView(stored, "?lang=ru&q=tree&min=1600"));
  // a link that says anything about the view is that view, the rest at their defaults
  for (const search of ["?sort=name", "?tags=1", "?nogym=1", "?nospecial=1"]) {
    assert.deepEqual(rememberedView(stored, search), {}, search);
  }
  // nothing kept, unreadable, or not what was written
  assert.deepEqual(rememberedView(null, "?handle=x"), {});
  assert.deepEqual(rememberedView("{oops", "?handle=x"), {});
  assert.deepEqual(rememberedView(JSON.stringify({ sort: { key: "nope", descending: true }, noGym: "yes" }), ""), {});
});

test("looked-up handles are remembered newest first, each once, and a few of them", () => {
  assert.deepEqual(rememberHandle([], "tourist"), ["tourist"]);
  assert.deepEqual(rememberHandle(["jiangly", "tourist", "Petr"], "Tourist"), ["Tourist", "jiangly", "Petr"]);
  assert.deepEqual(rememberHandle(["a", "b", "c"], "d", 3), ["d", "a", "b"]);
  assert.deepEqual(rememberHandle(["a"], ""), ["a"]);
});

test("unknown or broken parameters fall back to the defaults", () => {
  assert.deepEqual(readParams("?sort=-toString&tags=yes"), {
    handle: "",
    sort: null,
    query: "",
    min: "",
    max: "",
    triesMin: "",
    tags: [],
    tagAny: false,
    noGym: false,
    noSpecial: false,
    friend: "",
    inRound: false,
    showTags: false,
    upsolve: false,
    friendMark: false,
  });
  assert.deepEqual(readParams("?sort=name").sort, { key: "name", descending: false });
});

test("verdicts get short labels; unknown and missing ones do not break", () => {
  assert.deepEqual(verdictLabel("WRONG_ANSWER"), ["WA", "WRONG_ANSWER"]);
  assert.deepEqual(verdictLabel("CHALLENGED"), ["CHL", "CHALLENGED / HACKED"]);
  assert.deepEqual(verdictLabel("SOMETHING_NEW"), ["SOMETHING_NEW", "SOMETHING_NEW"]);
  assert.deepEqual(verdictLabel(undefined, "ещё не проверено"), ["?", "ещё не проверено"]);
});

test("a verdict that stops on a test names it, counted from 1", () => {
  const run = (verdict, passedTestCount, testset) => failedTest({ verdict, passedTestCount, testset });
  assert.deepEqual(run("WRONG_ANSWER", 36, "TESTS"), { number: 37, pretest: false });
  assert.deepEqual(run("TIME_LIMIT_EXCEEDED", 0, "PRETESTS"), { number: 1, pretest: true });
  assert.deepEqual(run("RUNTIME_ERROR", 4, "TESTS3"), { number: 5, pretest: false });
  assert.equal(run("WRONG_ANSWER", 2, "CHALLENGES"), null, "judged on a hack");
  assert.equal(run("COMPILATION_ERROR", 0, "TESTS"), null);
  assert.equal(run("PARTIAL", 16, "TESTS"), null);
  assert.equal(run("SKIPPED", 0, "TESTS"), null);
  assert.equal(run("WRONG_ANSWER", undefined, undefined), null, "a row saved without it");
});

test("a pasted profile or submissions link stands for its handle", () => {
  assert.equal(parseHandle("  tourist "), "tourist");
  assert.equal(parseHandle("https://codeforces.com/profile/tourist"), "tourist");
  assert.equal(parseHandle("https://codeforces.com/profile/tourist/?locale=en#top"), "tourist");
  assert.equal(parseHandle("codeforces.com/profile/Um_nik/"), "Um_nik");
  // a handle typed with a stray slash, query or fragment after it
  assert.equal(parseHandle("tourist/"), "tourist");
  assert.equal(parseHandle("tourist/ "), "tourist");
  assert.equal(parseHandle("tourist?lang=ru"), "tourist");
  assert.equal(parseHandle("tourist#top"), "tourist");
  assert.equal(parseHandle("https://m1.codeforces.com/submissions/jiangly/page/2"), "jiangly");
  assert.equal(parseHandle("http://codeforces.com/profile/-is-this-fft-?locale=ru"), "-is-this-fft-");
  // the short address Codeforces keeps for itself
  assert.equal(parseHandle("https://codeforc.es/profile/tourist"), "tourist");
  assert.equal(parseHandle("https://m.codeforc.es/submissions/jiangly/page/2"), "jiangly");
  // anything else is left for Codeforces to judge
  assert.equal(parseHandle("https://example.com/profile/tourist"), "https://example.com/profile/tourist");
  assert.equal(parseHandle("https://codeforces.com/blog/entry/79960"), "https://codeforces.com/blog/entry/79960");
});

test("the search shortcut is / on any layout, or the key in its place on a Russian one", () => {
  assert.equal(isSearchKey("/", "Slash"), true);
  assert.equal(isSearchKey(".", "Slash"), true, "Russian layout");
  assert.equal(isSearchKey("/", "Backslash"), true, "Shift+\\ on a Russian layout");
  assert.equal(isSearchKey("/", "Digit7"), true, "Shift+7 on a German layout");
  assert.equal(isSearchKey("-", "Slash"), false, "German layout: that key is a hyphen");
  assert.equal(isSearchKey("?", "Slash"), false);
  assert.equal(isSearchKey(".", "Period"), false);
});

test("Escape is the key that clears the tag filter", () => {
  assert.equal(isClearTagsKey("Escape"), true);
  assert.equal(isClearTagsKey("Esc"), false);
  assert.equal(isClearTagsKey("Enter"), false);
});

test("? is the key that opens the list of keyboard shortcuts", () => {
  assert.equal(isHelpKey("?"), true);
  assert.equal(isHelpKey("/"), false);
  assert.equal(isHelpKey("h"), false);
});

test("the pick shortcut is P on any layout, or the key in its place on a Russian one", () => {
  assert.equal(isPickKey("p", "KeyP"), true);
  assert.equal(isPickKey("P", "KeyP"), true);
  assert.equal(isPickKey("з", "KeyP"), true);
  assert.equal(isPickKey("p", "KeyL"), true, "P on Dvorak");
  assert.equal(isPickKey("l", "KeyP"), false, "the key that types L on Dvorak");
  assert.equal(isPickKey("Enter", "Enter"), false);
});

test("failures say whether the handle, the limit or Codeforces is to blame", () => {
  const failed = (comment) => ({ status: "FAILED", comment });
  assert.equal(
    describeFailure(400, failed("handle: User with handle nobody not found")).kind,
    "notFound",
  );
  assert.deepEqual(
    describeFailure(400, failed("handle: Field should contain between 3 and 24 characters, inclusive")),
    { kind: "badHandle", detail: "Field should contain between 3 and 24 characters, inclusive" },
  );
  assert.equal(describeFailure(503, failed("Call limit exceeded")).kind, "rateLimited");
  assert.equal(describeFailure(429, null).kind, "rateLimited");
  // An HTML error page parses as nothing.
  assert.deepEqual(describeFailure(502, null), { kind: "unavailable", detail: "HTTP 502" });
  assert.deepEqual(describeFailure(200, failed("Internal error")), {
    kind: "otherError",
    detail: "Internal error",
  });
});

test("gym problems link to the gym", () => {
  assert.equal(
    problemLink({ contestId: 1520, index: "F2" }),
    "https://codeforces.com/contest/1520/problem/F2",
  );
  assert.equal(
    problemLink({ contestId: 103104, index: "J" }),
    "https://codeforces.com/problemset/gymProblem/103104/J",
  );
});

test("submission links point at the submission", () => {
  assert.equal(
    submissionLink({ contestId: 1520, index: "F2", submissionId: 42 }),
    "https://codeforces.com/contest/1520/submission/42",
  );
  assert.equal(
    submissionLink({ contestId: 103104, index: "J", submissionId: 42 }),
    "https://codeforces.com/gym/103104/submission/42",
  );
});

// A stand-in for fetch whose body arrives in `parts`, `gap` milliseconds apart,
// and fails as a real body does when the signal aborts.
const trickle = (parts, gap) => (url, { signal }) => {
  let timer = 0;
  const body = new ReadableStream({
    start(controller) {
      let next = 0;
      const send = () => {
        if (next === parts.length) return controller.close();
        timer = setTimeout(() => {
          controller.enqueue(new TextEncoder().encode(parts[next++]));
          send();
        }, gap);
      };
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        controller.error(signal.reason);
      });
      send();
    },
  });
  return Promise.resolve(new Response(body, { status: 200 }));
};

test("a slow download of a large history is kept, a stalled one is cut off", async () => {
  const parts = Array.from({ length: 12 }, (_, i) => {
    if (i === 0) return '{"status":"OK","result":[';
    if (i === 10) return "1";
    return i === 11 ? "]}" : "1,";
  });
  // Twelve chunks 30 ms apart take longer than the 200 ms limit, yet nothing goes quiet for anything
  // like that long; the wide margin keeps a busy machine's late timers from tripping it.
  const { response, payload } = await fetchJson("x", { idleMs: 200, fetchFn: trickle(parts, 30) });
  assert.equal(response.status, 200);
  assert.equal(payload.status, "OK");
  assert.equal(payload.result.length, 10);

  const keepAlive = setTimeout(() => {}, 1000);
  await assert.rejects(
    fetchJson("x", { idleMs: 40, fetchFn: trickle(['{"status":"OK"', "}"], 400) }),
    isTimeout,
  );
  clearTimeout(keepAlive);
});

test("an error answer keeps its status and comment, and an HTML page parses as nothing", async () => {
  const json = async () => new Response('{"status":"FAILED","comment":"Call limit exceeded"}', { status: 503 });
  const { response, payload } = await fetchJson("x", { fetchFn: json });
  assert.equal(response.status, 503);
  assert.equal(payload.comment, "Call limit exceeded");
  const html = async () => new Response("<html>down</html>", { status: 502 });
  assert.equal((await fetchJson("x", { fetchFn: html })).payload, null);
});

test("a call that never answers is cut off and recognised as a timeout", async () => {
  // A stand-in for fetch that honours the signal and otherwise hangs.
  const hang = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason));
  });
  // Node does not keep the process alive for AbortSignal.timeout() alone.
  const keepAlive = setTimeout(() => {}, 1000);
  await assert.rejects(hang("x", { signal: AbortSignal.timeout(20) }), isTimeout);
  clearTimeout(keepAlive);
  assert.equal(isTimeout(new TypeError("Failed to fetch")), false);
  assert.equal(isTimeout(undefined), false);
});

test("an empty list is told apart: nothing submitted yet, or everything solved", () => {
  assert.equal(emptyKind(0), "noSubmissions");
  assert.equal(emptyKind(1), "allSolved");
  assert.equal(emptyKind(5513), "allSolved");
  assert.deepEqual(findUnsolved([]), []);
});

test("only an accepted submission solves a problem: partial, skipped, hacked and queued ones do not", () => {
  const rows = findUnsolved([
    submission(10, "A", "PARTIAL", 1200),
    submission(10, "B", "SKIPPED", 1300),
    submission(10, "C", "CHALLENGED", 1400),
    submission(10, "D", "COMPILATION_ERROR", 1500),
    submission(10, "E", undefined, 1600),
    submission(10, "F", "OK", 1700),
  ]);
  assert.deepEqual(rows.map((row) => row.index), ["A", "B", "C", "D", "E"]);
  assert.equal(rows[2].verdict, "CHALLENGED");
  assert.equal(rows[4].verdict, undefined);
});

test("a hacked solution does not count once the problem is accepted later", () => {
  // newest first: accepted after having been hacked
  const rows = findUnsolved([submission(20, "A", "OK", 900), submission(20, "A", "CHALLENGED", 900)]);
  assert.deepEqual(rows, []);
  // a hacked solution is a failed attempt like any other: the problem stays open and the attempt is counted
  const hacked = findUnsolved([submission(20, "B", "CHALLENGED", 900), submission(20, "B", "WRONG_ANSWER", 900)]);
  assert.equal(hacked.length, 1);
  assert.equal(hacked[0].tries, 2);
});

test("handles are taken as typed, apart from the whitespace around them", () => {
  assert.equal(parseHandle("\t Tourist\n"), "Tourist");
  assert.equal(parseHandle("  HTTPS://CODEFORCES.COM/profile/Tourist  "), "Tourist");
  assert.equal(parseHandle("https://www.codeforces.com/profile/Um_nik#tab"), "Um_nik");
  assert.equal(parseHandle(""), "");
  assert.equal(readParams("?handle=%20Tourist%20&friend=%20Jiangly%20").handle, "Tourist");
  assert.equal(readParams("?handle=%20Tourist%20&friend=%20Jiangly%20").friend, "Jiangly");
  assert.equal(readParams("?handle=").handle, "");
});

test("a call answered with the rate limit or a busy server is made once more, when the caller wants it to be", async () => {
  const answers = (...list) => {
    const calls = [];
    const fetchFn = async () => {
      calls.push(1);
      return list.shift();
    };
    return { fetchFn, calls };
  };
  const limited = () => new Response('{"status":"FAILED","comment":"Call limit exceeded"}', { status: 503 });
  const ok = () => new Response('{"status":"OK","result":[]}', { status: 200 });

  const first = answers(limited(), ok());
  let paused = 0;
  const again = async () => {
    paused += 1;
    return true;
  };
  const result = await fetchApi("x", { fetchFn: first.fetchFn, again });
  assert.equal(result.payload.status, "OK");
  assert.equal(first.calls.length, 2);
  assert.equal(paused, 1);

  // A gateway error under load passes too.
  const busy = answers(new Response("<html>busy</html>", { status: 504 }), ok());
  assert.equal((await fetchApi("x", { fetchFn: busy.fetchFn, again })).response.status, 200);

  // Only once: a second refusal is the answer.
  const stuck = answers(limited(), limited(), ok());
  assert.equal((await fetchApi("x", { fetchFn: stuck.fetchFn, again })).response.status, 503);
  assert.equal(stuck.calls.length, 2);

  // An answer that will not change is not asked for again.
  const missing = answers(new Response('{"status":"FAILED","comment":"handle: User with handle x not found"}', { status: 400 }));
  assert.equal((await fetchApi("x", { fetchFn: missing.fetchFn, again })).response.status, 400);
  assert.equal(missing.calls.length, 1);

  // The caller can decline, as it does once nobody wants the answer any more.
  const declined = answers(limited(), ok());
  const result2 = await fetchApi("x", { fetchFn: declined.fetchFn, again: async () => false });
  assert.equal(result2.response.status, 503);
  assert.equal(declined.calls.length, 1);

  // Without a way to wait, the first answer stands.
  const alone = answers(limited(), ok());
  assert.equal((await fetchApi("x", { fetchFn: alone.fetchFn })).response.status, 503);
  assert.equal(alone.calls.length, 1);
});

test("the solved problems are counted per tag, once each, and the count survives folding in parts", () => {
  const item = (id, contestId, index, verdict, tags) => ({
    id,
    creationTimeSeconds: 1_600_000_000 + id,
    verdict,
    author: { participantType: "PRACTICE" },
    problem: { contestId, index, name: `${contestId}${index}`, tags, rating: 1500 },
  });
  const history = [
    item(9, 1500, "A", "OK", ["dp", "graphs"]),
    item(8, 1500, "A", "OK", ["dp", "graphs"]),
    item(7, 1501, "B", "OK", ["dp"]),
    item(6, 1502, "C", "WRONG_ANSWER", ["dp"]),
    item(5, 1500, "D", "OK", ["*special"]),
  ];
  const whole = foldSubmissions(emptyState(), history);
  assert.deepEqual(whole.solvedTags, { dp: 2, graphs: 1, "*special": 1 });
  const parts = foldSubmissions(foldSubmissions(emptyState(), history.slice(2)), history.slice(0, 2));
  assert.deepEqual(parts.solvedTags, whole.solvedTags);
});

test("a problem accepted in both copies of a shared round counts once in the tag counts", () => {
  const item = (id, contestId, index, verdict, name) => ({
    id,
    creationTimeSeconds: 1_600_000_000 + id,
    verdict,
    author: { participantType: "PRACTICE" },
    problem: { contestId, index, name, tags: ["math"], rating: 1500 },
  });
  const history = [
    item(4, 1700, "B", "OK", "Other"),
    item(3, 1001, "A", "OK", "Shared"),
    item(2, 1000, "A", "OK", "Shared"),
    item(1, 1000, "A", "WRONG_ANSWER", "Shared"),
  ];
  const whole = foldSubmissions(emptyState(), history);
  assert.deepEqual(whole.solvedTags, { math: 2 });
  const parts = foldSubmissions(foldSubmissions(emptyState(), history.slice(2)), history.slice(0, 2));
  assert.deepEqual(parts.solvedTags, whole.solvedTags);
});

test("a problem in a chain of three copies counts its tags once, whatever order the copies are met in", () => {
  const copy = (contestId, id, start) => ({
    id,
    creationTimeSeconds: 1_600_000_000 + id,
    verdict: "OK",
    author: { participantType: "CONTESTANT", startTimeSeconds: start },
    problem: { contestId, index: "A", name: "Chain", tags: ["dp"], rating: 1500 },
  });
  // 1000 and 1010 are too far apart to be copies of each other; 1005 is a copy of both.
  const [low, middle, high] = [copy(1000, 1, 100), copy(1005, 2, 200), copy(1010, 3, 300)];
  const orders = [[low, middle, high], [low, high, middle], [middle, low, high], [middle, high, low], [high, low, middle], [high, middle, low]];
  for (const order of orders) {
    const whole = foldSubmissions(emptyState(), order);
    assert.deepEqual(whole.solvedTags, { dp: 1 }, order.map((item) => item.problem.contestId).join(","));
    const parts = foldSubmissions(foldSubmissions(emptyState(), order.slice(0, 1)), order.slice(1));
    assert.deepEqual(parts.solvedTags, whole.solvedTags);
  }
  assert.deepEqual(foldSubmissions(emptyState(), [high, low]).solvedTags, { dp: 2 }, "two copies that are not parallel count twice");
});

test("a tag the problems do not have is not counted, whatever its name", () => {
  const solved = foldSubmissions(emptyState(), [
    { id: 1, creationTimeSeconds: 1, verdict: "OK", author: {}, problem: { contestId: 1, index: "A", name: "a", tags: ["constructor"] } },
  ]);
  assert.deepEqual(solved.solvedTags, { constructor: 1 });
  assert.equal(Object.hasOwn(foldSubmissions(emptyState(), []).solvedTags, "constructor"), false);
  assert.deepEqual(weakTags([{ tags: ["constructor"] }], solved.solvedTags), [{ tag: "constructor", solved: 1, attempted: 2, unsolved: 1 }]);
});

test("an old digest, saved before the tag counts, is not taken as complete", () => {
  const old = { cutoff: 1, count: 3, builtAt: 1, state: { keys: [], twins: [], starts: [], rows: [] } };
  assert.equal(hasTagCounts(old), false);
  assert.equal(hasTagCounts({ ...old, state: { ...old.state, solvedTags: {} } }), true);
  assert.equal(hasTagCounts(null), false);
  for (const bad of [[], "dp", { dp: -1 }, { dp: 1.5 }, { dp: "2" }, null]) {
    assert.equal(hasTagCounts({ state: { solvedTags: bad } }), false, JSON.stringify(bad));
  }
});

test("the weakest tags are the ones with the most unsolved problems, with solved and attempted counts", () => {
  const row = (tags) => ({ tags });
  const rows = [row(["dp", "*special"]), row(["dp", "graphs"]), row(["dp"]), row(["graphs"]), row(["trees"])];
  const solvedTags = { dp: 6, graphs: 4, trees: 0, "*special": 9 };
  assert.deepEqual(weakTags(rows, solvedTags), [
    { tag: "dp", solved: 6, attempted: 9, unsolved: 3 },
    { tag: "graphs", solved: 4, attempted: 6, unsolved: 2 },
    { tag: "trees", solved: 0, attempted: 1, unsolved: 1 },
  ]);
  assert.deepEqual(weakTags(rows, solvedTags, 1).map((entry) => entry.tag), ["dp"]);
  assert.deepEqual(weakTags([], solvedTags), []);
});

const exported = [
  {
    contestId: 1520, index: "F2", name: "Cut | the *tree*", rating: 2100, tags: ["dp", "graphs"], tries: 3,
    verdict: "WRONG_ANSWER", passedTestCount: 36, testset: "TESTS", lastTime: 1700000000, submissionId: 555,
  },
  {
    contestId: 103104, index: "J", name: "Gym one", tags: [], tries: 1,
    verdict: "COMPILATION_ERROR", lastTime: 1700000000, submissionId: 556,
  },
];

test("the list copies as a Markdown table, with its links, verdicts and pipes escaped", () => {
  assert.equal(markdownTable(exported), [
    "| Problem | Name | Rating | Solved by | Tags | Tries | Last verdict | Last attempt |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| [1520\\|F2](https://codeforces.com/contest/1520/problem/F2) | Cut \\| the \\*tree\\* | 2100 |  | dp, graphs | 3 | WA 37 | 2023-11-14T22:13:20Z |",
    "| [103104\\|J](https://codeforces.com/problemset/gymProblem/103104/J) | Gym one |  |  |  | 1 | CE | 2023-11-14T22:13:20Z |",
  ].join("\n"));
  assert.equal(markdownTable([]).split("\n").length, 2);
});

test("a name that Markdown would read as markup, or as a line break, stays text", () => {
  const row = { ...exported[1], name: "a_b [c](d)\nnext <x>" };
  const line = markdownTable([row]).split("\n")[2];
  assert.match(line, /\| a\\_b \\\[c\\\]\(d\) next \\<x\\> \|/);
});

test("the list downloads as CSV, one line a problem, quoted where a cell needs it", () => {
  assert.equal(csvTable(exported), [
    "Problem,Name,Rating,Solved by,Tags,Tries,Last verdict,Last attempt,Problem link,Last submission",
    "1520|F2,Cut | the *tree*,2100,,\"dp, graphs\",3,WA 37,2023-11-14T22:13:20Z,"
      + "https://codeforces.com/contest/1520/problem/F2,https://codeforces.com/contest/1520/submission/555",
    "103104|J,Gym one,,,,1,CE,2023-11-14T22:13:20Z,"
      + "https://codeforces.com/problemset/gymProblem/103104/J,https://codeforces.com/gym/103104/submission/556",
    "",
  ].join("\r\n"));
});

test("CSV quotes and doubles quotes, keeps line breaks and Cyrillic, and blocks formulas", () => {
  // The gym row after its name: empty rating, solved count and tags, then the rest of the cells.
  const rest = ",,,,1,CE,2023-11-14T22:13:20Z,https://codeforces.com/problemset/gymProblem/103104/J,"
    + "https://codeforces.com/gym/103104/submission/556";
  const line = (name) => csvTable([{ ...exported[1], name }]).split("\r\n")[1];
  assert.equal(line('He said "hi", twice'), `103104|J,"He said ""hi"", twice"${rest}`);
  assert.equal(line("Треугольники"), `103104|J,Треугольники${rest}`);
  assert.equal(line("=1+1"), `103104|J,'=1+1${rest}`);
  assert.equal(line("@cmd"), `103104|J,'@cmd${rest}`);
  assert.equal(line("-x"), `103104|J,'-x${rest}`);
  assert.equal(line("line\nbreak"), `103104|J,"line\nbreak"${rest}`);
  assert.equal(csvTable([]), "Problem,Name,Rating,Solved by,Tags,Tries,Last verdict,Last attempt,Problem link,Last submission\r\n");
});

test("the rating bands run from the lowest rated row to the highest, empty ones included, unrated left out", () => {
  const rows = [800, 850, 1599, 1600, 3500, undefined].map((rating) => ({ rating }));
  const buckets = ratingBuckets(rows);
  assert.equal(buckets.length, 28);
  assert.deepEqual(buckets[0], { from: 800, to: 899, count: 2 });
  assert.deepEqual(buckets[1], { from: 900, to: 999, count: 0 });
  assert.deepEqual(buckets[7], { from: 1500, to: 1599, count: 1 });
  assert.deepEqual(buckets[8], { from: 1600, to: 1699, count: 1 });
  assert.deepEqual(buckets.at(-1), { from: 3500, to: 3599, count: 1 });
  assert.deepEqual(ratingBuckets([{ rating: undefined }, {}]), []);
  assert.deepEqual(ratingBuckets([]), []);
  assert.deepEqual(ratingBuckets([{ rating: 1200 }]), [{ from: 1200, to: 1299, count: 1 }]);
});

test("a band is the chosen one only when the range fields hold exactly its bounds", () => {
  const band = { from: 1600, to: 1699 };
  assert.equal(isBucket(band, "1600", "1699"), true);
  assert.equal(isBucket(band, 1600, 1699), true);
  assert.equal(isBucket(band, "1600", "1700"), false);
  assert.equal(isBucket(band, "", ""), false);
  assert.equal(isBucket(band, "1600", ""), false);
});

test("upsolve: a problem of a rated contest that was never tried is listed; a solved one, a twin solved, an unentered contest or one already listed is not", () => {
  const problems = unpackProblemset(packProblemset(fixture("problemset.json").result));
  const contests = ratedContestIds(fixture("user-rating.json").result);
  const attempt = (contestId, index, verdict, name, rating) => ({
    id: nextId++,
    creationTimeSeconds: clock--,
    verdict,
    passedTestCount: 0,
    testset: "TESTS",
    problem: { contestId, index, name, tags: [], rating },
    author: { participantType: "CONTESTANT", startTimeSeconds: 1_700_000_000 },
  });
  // Newest first: a failed attempt at 2279F, an accepted one at 2279E, and an accepted one at 420C,
  // the Div. 2 twin of 421D ("Bug in Code", rated 1900 in both).
  const history = [
    attempt(2279, "F", "WRONG_ANSWER", "The Stones of Nim"),
    attempt(2279, "E", "OK", "Save Me!"),
    attempt(420, "C", "OK", "Bug in Code", 1900),
  ];
  const state = foldSubmissions(emptyState(), history);
  const untried = untriedRows(problems, contests, listedCheck(solvedFor(state), state.rows));

  assert.deepEqual(untried.map(problemKey), ["2279|D"]);
  assert.equal(untried[0].tries, 0);
  assert.equal(untried[0].lastTime, undefined);
  assert.equal(untried[0].verdict, undefined);
  // Attempted and listed once: the failed 2279F is the attempted row, not a second one.
  const listed = [...state.rows, ...untried].map(problemKey).sort();
  assert.deepEqual(listed, ["2279|D", "2279|F"]);
});

test("upsolve: without the accepted twin the Div. 1 copy is listed, so the twin is what leaves it out", () => {
  const problems = unpackProblemset(packProblemset(fixture("problemset.json").result));
  const contests = ratedContestIds(fixture("user-rating.json").result);
  const state = foldSubmissions(emptyState(), []);
  const untried = untriedRows(problems, contests, listedCheck(solvedFor(state), state.rows));
  assert.deepEqual(untried.map(problemKey), ["2279|D", "2279|E", "2279|F", "421|D"]);
});

test("upsolve: the rated contests come from user.rating and the problemset is kept with its solved counts", () => {
  assert.deepEqual([...ratedContestIds(fixture("user-rating.json").result)].sort((a, b) => a - b), [421, 2279]);
  const { result } = fixture("problemset.json");
  const packed = packProblemset(result);
  const unpacked = unpackProblemset(packed);
  assert.equal(unpacked.length, result.problems.length);
  const meta = unpacked.find((problem) => problem.contestId === 421);
  assert.deepEqual(meta, { contestId: 421, index: "D", name: "Bug in Code", rating: 1900, tags: meta.tags, solvedCount: meta.solvedCount });
  assert.equal(typeof meta.solvedCount, "number");
  assert.equal(unpacked.find((problem) => problem.contestId === 2279 && problem.index === "D").rating, undefined);
  for (const foreign of [null, "x", [[1, "A"]], [[1, 2, "x", null, [], null]]]) {
    assert.equal(unpackProblemset(foreign), null, JSON.stringify(foreign));
  }
});

test("upsolve: an untried row sorts last by last attempt, and exports with no verdict, date or submission", () => {
  const tried = { contestId: 1, index: "A", name: "a", tags: [], tries: 1, verdict: "OK", lastTime: 1000, submissionId: 9, rating: 800 };
  const untried = { contestId: 2, index: "B", name: "b", tags: [], tries: 0, rating: 900 };
  assert.deepEqual(sortRows([untried, tried], "last", true).map(problemKey), ["1|A", "2|B"]);
  assert.deepEqual(sortRows([untried, tried], "last", false).map(problemKey), ["2|B", "1|A"]);
  assert.match(csvTable([untried]).split("\r\n")[1], /^2\|B,b,900,,,0,,,https:\/\/codeforces\.com\/contest\/2\/problem\/B,\r?$/);
  assert.equal(markdownTable([untried]).split("\n")[2].includes("| 0 |  |  |"), true);
});

test("the solved count sorts both ways, and a problem the problemset does not count goes last", () => {
  const row = (index, solvedCount) => ({ contestId: 1, index, name: index, tags: [], solvedCount });
  const rows = [row("A", 500), row("B", undefined), row("C", 9000), row("D", 500)];
  const order = (sorted) => sorted.map((r) => r.index).join("");
  assert.equal(order(sortRows(rows, "solved", true)), "CADB", "most solved first, ties in list order");
  assert.equal(order(sortRows(rows, "solved", false)), "BADC", "fewest first, uncounted before them");
  assert.deepEqual(readParams("?sort=-solved").sort, { key: "solved", descending: true });
});

test("the problemset's solved counts reach the rows it lists, and a row it does not know keeps none", () => {
  const problems = [{ contestId: 2, index: "B", solvedCount: 42 }, { contestId: 3, index: "A", solvedCount: 7 }];
  const rows = [{ contestId: 2, index: "B" }, { contestId: 9, index: "Z" }];
  const counted = attachSolvedCounts(rows, problems);
  assert.equal(counted[0].solvedCount, 42);
  assert.equal(counted[1].solvedCount, undefined);
});

test("the age of an attempt is given in its largest whole unit, and never a negative one", () => {
  assert.deepEqual(relativeAge(30_000), [0, "second"]);
  assert.deepEqual(relativeAge(90_000), [-1, "minute"]);
  assert.deepEqual(relativeAge(2 * 3600_000 + 5000), [-2, "hour"]);
  assert.deepEqual(relativeAge(364 * 86400_000), [-12, "month"], "a year is 365 days, so 364 is months");
  assert.deepEqual(relativeAge(45 * 86400_000), [-1, "month"]);
  assert.deepEqual(relativeAge(3 * 365 * 86400_000 + 1000), [-3, "year"]);
  assert.deepEqual(relativeAge(-5000), [0, "second"], "a time a little ahead of the clock is now");
});

test("the name of a weak-tag chip says the tag, how many attempted problems are unsolved, and what a click does", () => {
  const template = "{tag}: {unsolved} of {attempted} unsolved, filter by this tag";
  assert.equal(
    weakTagName({ tag: "greedy", solved: 16, attempted: 100, unsolved: 84 }, template),
    "greedy: 84 of 100 unsolved, filter by this tag",
  );
  assert.equal(
    weakTagName({ tag: "*special", solved: 0, attempted: 1, unsolved: 1 }, template),
    "*special: 1 of 1 unsolved, filter by this tag",
  );
});

test("the name of a rating band says its range, how many unsolved problems it holds, and what a click does", () => {
  const template = "Rating {from} to {to}: {count} unsolved, filter by this range";
  assert.equal(ratingBandName({ from: 1600, to: 1699, count: 12 }, template), "Rating 1600 to 1699: 12 unsolved, filter by this range");
  assert.equal(ratingBandName({ from: 800, to: 899, count: 0 }, template), "Rating 800 to 899: 0 unsolved, filter by this range");
});

test("a template keeps a mark it has no value for, rather than printing undefined", () => {
  assert.equal(fillText("{a} and {b}", { a: 1 }), "1 and {b}");
  assert.equal(fillText("no marks", {}), "no marks");
});

test("the list keys are j and k to move, o and Enter to open, on any layout, and left alone with a modifier", () => {
  assert.equal(rowKeyAction("j", "KeyJ"), "next");
  assert.equal(rowKeyAction("J", "KeyJ"), "next", "shift does not change the letter");
  assert.equal(rowKeyAction("k", "KeyK"), "previous");
  assert.equal(rowKeyAction("o", "KeyO"), "open");
  assert.equal(rowKeyAction("Enter", "Enter"), "open");
  // Russian layout: the keys where j, k and o sit type о, л and щ.
  assert.equal(rowKeyAction("о", "KeyJ"), "next");
  assert.equal(rowKeyAction("л", "KeyK"), "previous");
  assert.equal(rowKeyAction("щ", "KeyO"), "open");
  // Dvorak: the letter typed is what counts, whatever key it came from.
  assert.equal(rowKeyAction("j", "KeyC"), "next");
  for (const other of ["x", "p", "/", "Escape", "Tab"]) assert.equal(rowKeyAction(other, "Key" + other.toUpperCase()), null, other);
  assert.equal(rowKeyAction("j", "KeyJ", { ctrlKey: true }), null);
  assert.equal(rowKeyAction("Enter", "Enter", { altKey: true }), null);
  assert.equal(rowKeyAction("o", "KeyO", { metaKey: true }), null);
});

test("the counter says how many problems are listed, and how many of them were never tried", () => {
  const en = { label: "Count of problems:", untriedLabel: "{count} never tried" };
  assert.equal(countText(225, 185, en), "Count of problems: 225, 185 never tried");
  assert.equal(countText(225, 0, en), "Count of problems: 225", "nothing said when all were tried");
  const ru = { label: "Количество задач:", untriedLabel: "{count} не пробовал(а)" };
  assert.equal(countText(225, 185, ru), "Количество задач: 225, 185 не пробовал(а)");
});

test("overlapping lookups share one request to the API, and a later one asks again", async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(JSON.stringify({ status: "OK", result: [calls] }), { status: 200 });
  };
  const shared = shareInFlight((url) => fetchApi(url, { fetchFn }).then(({ payload }) => payload.result));
  const answers = await Promise.all([shared("problemset"), shared("problemset"), shared("problemset")]);
  assert.equal(calls, 1, "three overlapping calls, one request");
  assert.deepEqual(answers, [[1], [1], [1]]);
  assert.deepEqual(await shared("problemset"), [2], "once settled, the next call asks again");
  assert.equal(calls, 2);
  const failing = shareInFlight(async () => { throw new Error("down"); });
  await assert.rejects(Promise.all([failing("x"), failing("x")]), /down/);
});

test("upsolve: a contest counts as taken in when a submission there is a contest, virtual or out-of-competition one, not practice", () => {
  const state = foldSubmissions(emptyState(), fixture("user-status.json").result);
  assert.deepEqual([...state.taken].sort((a, b) => a - b), [1632, 2155, 2279]);
  assert.deepEqual([...tookPartIn(new Set([421]), state.taken)].sort((a, b) => a - b), [421, 1632, 2155, 2279]);
});

test("upsolve: untried problems of an unrated or virtual contest are listed; a practice-only contest adds none", () => {
  const state = foldSubmissions(emptyState(), fixture("user-status.json").result);
  const problems = unpackProblemset(packProblemset(fixture("problemset.json").result));
  // The fixture has no problems of 2155, 1632 or 920: one of each is added here.
  problems.push({ contestId: 2155, index: "A", name: "Unrated round", rating: undefined, tags: [], solvedCount: 3 });
  problems.push({ contestId: 920, index: "B", name: "Practice only", rating: 1200, tags: [], solvedCount: 9 });
  const untried = untriedRows(problems, tookPartIn(new Set(), state.taken), listedCheck(solvedFor(state), state.rows));
  // 2279E and 1632E1 were accepted and 2155F is in the status too; 2279D, 2279F and 2155A are untried.
  assert.deepEqual(untried.map(problemKey).sort(), ["2155|A", "2279|D", "2279|F"]);
});

test("upsolve: a problem id says how many problems of its contest the handle has solved, parallel copies included", () => {
  const state = foldSubmissions(emptyState(), [
    { id: 1, creationTimeSeconds: 3, verdict: "OK", passedTestCount: 0, testset: "TESTS", problem: { contestId: 2279, index: "E", name: "Save Me!", tags: [] }, author: { participantType: "CONTESTANT" } },
    { id: 2, creationTimeSeconds: 2, verdict: "OK", passedTestCount: 0, testset: "TESTS", problem: { contestId: 420, index: "C", name: "Bug in Code", rating: 1900, tags: [] }, author: { participantType: "PRACTICE" } },
  ]);
  const problems = unpackProblemset(packProblemset(fixture("problemset.json").result));
  const progress = contestProgress(problems, solvedFor(state));
  const template = "Solved {solved} of {total} in this contest";
  assert.equal(contestNote(progress, 2279, template), "Solved 1 of 3 in this contest");
  assert.equal(contestNote(progress, 421, template), "Solved 1 of 1 in this contest", "solved through its Div. 2 twin");
  assert.equal(contestNote(progress, 1453, template), "Solved 0 of 1 in this contest");
  assert.equal(contestNote(progress, 9999, template), "", "no note for a contest the problemset does not list");
});

test("the friend marks count the listed problems the friend solved, and the counter line says so", () => {
  const rows = [{ contestId: 1, index: "A" }, { contestId: 2, index: "B" }, { contestId: 3, index: "C" }];
  const solvedBy = (row) => row.contestId !== 2;
  assert.equal(countSolvedBy(rows, solvedBy), 2);
  const en = { label: "Count of problems:", untriedLabel: "{count} never tried", friendLabel: "{count} of these your friend has solved" };
  assert.equal(countText(3, 0, { ...en, friendSolved: 2 }), "Count of problems: 3, 2 of these your friend has solved");
  assert.equal(countText(3, 1, { ...en, friendSolved: 0 }), "Count of problems: 3, 1 never tried, 0 of these your friend has solved");
  assert.equal(countText(3, 0, en), "Count of problems: 3", "no friend part while the marks are off");
});

test("the friend marks are in a link only with a friend, and are remembered as part of the view", () => {
  assert.equal(writeParams({ handle: "x", friend: "jiangly", friendMark: true }), "handle=x&friend=jiangly&friendmode=mark");
  assert.equal(writeParams({ handle: "x", friendMark: true }), "handle=x&sort=rating", "marks mean nothing without a friend");
  assert.equal(readParams("?friend=jiangly&friendmode=mark").friendMark, true);
  assert.equal(readParams("?friend=jiangly").friendMark, false);
  const stored = JSON.stringify(viewOf({ sort: null, showTags: false, noGym: false, noSpecial: false, upsolve: false, friendMark: true }));
  assert.equal(rememberedView(stored, "?handle=tourist").friendMark, true);
  assert.deepEqual(rememberedView(stored, "?friend=x&friendmode=mark"), {}, "a link that names the view is its own");
});

test("the By-tag table counts each tag's unsolved and attempted problems, and takes the median rating of the unsolved ones", () => {
  const rows = [
    { tags: ["dp", "greedy"], rating: 1200 },
    { tags: ["dp", "*special"], rating: 1400 },
    { tags: ["dp"] },
    { tags: ["greedy"], rating: 1900 },
  ];
  const summary = tagSummary(rows, { dp: 3, greedy: 1 });
  assert.deepEqual(summary.find((entry) => entry.tag === "dp"), { tag: "dp", unsolved: 3, attempted: 6, median: 1300 });
  assert.deepEqual(summary.find((entry) => entry.tag === "greedy"), { tag: "greedy", unsolved: 2, attempted: 3, median: 1550 });
  assert.equal(summary.some((entry) => entry.tag === "*special"), false, "the special tag is not a topic");
  assert.equal(tagSummary([{ tags: ["trees"] }], {}).find((entry) => entry.tag === "trees").median, null, "no rated problem, no median");
});

test("the By-tag table sorts by any column, both ways, with a missing median last", () => {
  const entries = [
    { tag: "dp", unsolved: 3, attempted: 6, median: 1300 },
    { tag: "greedy", unsolved: 3, attempted: 4, median: null },
    { tag: "math", unsolved: 1, attempted: 9, median: 1100 },
  ];
  const tags = (sorted) => sorted.map((entry) => entry.tag);
  assert.deepEqual(tags(sortTags(entries, "unsolved", true)), ["dp", "greedy", "math"], "ties go by name");
  assert.deepEqual(tags(sortTags(entries, "unsolved", false)), ["math", "dp", "greedy"]);
  assert.deepEqual(tags(sortTags(entries, "attempted", true)), ["math", "dp", "greedy"]);
  assert.deepEqual(tags(sortTags(entries, "tag", false)), ["dp", "greedy", "math"]);
  assert.deepEqual(tags(sortTags(entries, "median", true)), ["dp", "math", "greedy"], "no median is last");
  assert.deepEqual(tags(sortTags(entries, "median", false)), ["math", "dp", "greedy"], "still last the other way");
});

test("the j and k highlight stays on its problem when the rows are built again", () => {
  // keys.js tests the element it is given, so the browser classes are stood in for.
  globalThis.HTMLButtonElement ??= class {};
  globalThis.HTMLAnchorElement ??= class {};
  const drawnRows = (problems) => problems.map((problem) => {
    const classes = new Set();
    const tr = {
      hidden: false,
      classList: { toggle: (name, on = !classes.has(name)) => (on ? classes.add(name) : classes.delete(name)), has: (name) => classes.has(name) },
      scrollIntoView() {},
    };
    return [tr, problem];
  });
  const problems = [1, 2, 3].map((contestId) => ({ contestId, index: "A", name: `p${contestId}`, tags: [] }));
  let drawn = drawnRows(problems);
  let highlight = null;
  const keys = createKeys({ drawn: () => drawn, highlight: () => highlight, setHighlight: (key) => { highlight = key; } });
  const press = { key: "j", repeat: false, target: {}, preventDefault() {} };
  keys.press("next", press);
  assert.equal(highlight, problemKey(problems[0]));
  drawn = drawnRows(problems.map((problem) => ({ ...problem })));
  keys.press("next", press);
  assert.equal(highlight, problemKey(problems[1]));
  assert.equal(drawn[1][0].classList.has("highlight"), true);
  assert.equal(drawn[0][0].classList.has("highlight"), false);
});

test("the rated contests of a handle are kept under one encoded key per handle", () => {
  assert.equal(ratedKey("Tourist"), "rating.v1/tourist");
  assert.equal(ratedKey("a/b"), "rating.v1/a%2Fb");
  assert.equal(ratedKey("a\\b"), "rating.v1/a%5Cb");
  assert.equal(ratedKey("a?b#c"), "rating.v1/a%3Fb%23c");
});
