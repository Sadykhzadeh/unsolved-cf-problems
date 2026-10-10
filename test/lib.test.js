import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ageParts,
  describeFailure,
  findUnsolved,
  makeFilter,
  matchesFilter,
  packRows,
  problemLink,
  sortRows,
  submissionLink,
  tagCounts,
  unpackRows,
  verdictLabel,
} from "../lib.js";

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
  const rows = findUnsolved([
    newest,
    submission(2, "B", "WRONG_ANSWER", 1200),
    submission(2, "B", "COMPILATION_ERROR", 1200),
  ]);
  assert.deepEqual(rows, [{
    contestId: 2,
    index: "B",
    name: "2B",
    rating: 1200,
    tags: [],
    verdict: "TIME_LIMIT_EXCEEDED",
    submissionId: newest.id,
    lastTime: newest.creationTimeSeconds,
    tries: 3,
  }]);
});

test("the same index in two contests is two problems", () => {
  const rows = findUnsolved([
    submission(3, "A", "OK", 800),
    submission(4, "A", "WRONG_ANSWER", 800),
  ]);
  assert.deepEqual(rows.map((r) => r.contestId), [4]);
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

test("the filter narrows by name or id, tag and rating range", () => {
  const row = (contestId, index, name, rating, tags) => ({ contestId, index, name, rating, tags });
  const rows = [
    row(1520, "F2", "Guess the K-th Zero (Hard version)", 2200, ["binary search", "interactive"]),
    row(4, "A", "Watermelon", 800, ["brute force", "math"]),
    row(2000, "H", "Fresh One", undefined, ["dp"]),
  ];
  const pick = (fields) => rows.filter((r) => matchesFilter(r, makeFilter(fields))).map((r) => r.name);

  assert.equal(pick({}).length, 3, "an empty filter keeps everything");
  assert.deepEqual(pick({ query: "  WATER " }), ["Watermelon"]);
  assert.deepEqual(pick({ query: "1520f2" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ query: "1520|F" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ tag: "math" }), ["Watermelon"]);
  assert.deepEqual(pick({ min: "1000" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ max: 800 }), ["Watermelon"]);
  assert.deepEqual(pick({ min: "800", max: "2200" }).length, 2, "bounds are inclusive; unrated is out");
  assert.equal(pick({ min: "abc" }).length, 3, "an unreadable bound is no bound");
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

test("verdicts get short labels; unknown and missing ones do not break", () => {
  assert.deepEqual(verdictLabel("WRONG_ANSWER"), ["WA", "WRONG_ANSWER"]);
  assert.deepEqual(verdictLabel("CHALLENGED"), ["CHL", "CHALLENGED / HACKED"]);
  assert.deepEqual(verdictLabel("SOMETHING_NEW"), ["SOMETHING_NEW", "SOMETHING_NEW"]);
  assert.deepEqual(verdictLabel(undefined), ["?", "not judged yet"]);
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
});
