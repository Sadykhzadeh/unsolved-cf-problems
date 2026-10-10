import { test } from "node:test";
import assert from "node:assert/strict";

import {
  describeFailure,
  findUnsolved,
  problemLink,
  submissionLink,
  verdictLabel,
} from "../lib.js";

let nextId = 1000;
const submission = (contestId, index, verdict, rating) => ({
  id: nextId++,
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

test("each unsolved problem appears once, with its newest attempt", () => {
  // user.status lists newest first.
  const newest = submission(2, "B", "TIME_LIMIT_EXCEEDED", 1200);
  const rows = findUnsolved([
    newest,
    submission(2, "B", "WRONG_ANSWER", 1200),
    submission(2, "B", "COMPILATION_ERROR", 1200),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0], newest);
});

test("the same index in two contests is two problems", () => {
  const rows = findUnsolved([
    submission(3, "A", "OK", 800),
    submission(4, "A", "WRONG_ANSWER", 800),
  ]);
  assert.deepEqual(rows.map((r) => r.problem.contestId), [4]);
});

test("rows go easiest first, unrated last", () => {
  const rows = findUnsolved([
    submission(5, "A", "WRONG_ANSWER", undefined),
    submission(6, "A", "WRONG_ANSWER", 2100),
    submission(7, "A", "WRONG_ANSWER", 800),
  ]);
  assert.deepEqual(rows.map((r) => r.problem.rating), [800, 2100, undefined]);
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
    submissionLink({ id: 42, problem: { contestId: 1520, index: "F2" } }),
    "https://codeforces.com/contest/1520/submission/42",
  );
});
