import { test } from "node:test";
import assert from "node:assert/strict";

import {
  describeFailure,
  findUnsolved,
  problemLink,
  sortRows,
  submissionLink,
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
