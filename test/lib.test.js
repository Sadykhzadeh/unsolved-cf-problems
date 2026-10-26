import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ageParts,
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
  assert.equal(findUnsolved([twin(1500, "C", "WRONG_ANSWER"), twin(1503, "E", "OK")]).length, 1);
  assert.equal(findUnsolved([twin(1500, "C", "WRONG_ANSWER"), twin(1501, "E", "OK", 1200)]).length, 1);
  // Round 942: Div. 2 is contest 1972 and Div. 1 is 1967, started together
  const inRound = (contestId, index, verdict, participantType, startTimeSeconds) => {
    const item = twin(contestId, index, verdict, 1400);
    item.author = { participantType, startTimeSeconds };
    return item;
  };
  assert.deepEqual(findUnsolved([
    inRound(1972, "D1", "WRONG_ANSWER", "PRACTICE", 1714487700),
    inRound(1967, "B1", "OK", "PRACTICE", 1714487700),
  ]), []);
  // a virtual run of the Div. 2 round says nothing about when it started
  assert.equal(findUnsolved([
    inRound(1972, "D1", "WRONG_ANSWER", "VIRTUAL", 1714487700),
    inRound(1967, "B1", "OK", "VIRTUAL", 1714487700),
  ]).length, 1);
  assert.equal(findUnsolved([
    inRound(1972, "D1", "WRONG_ANSWER", "CONTESTANT", 1714487700),
    inRound(1967, "B1", "OK", "PRACTICE", 1714400000),
  ]).length, 1);
  // neighbouring gym contests, both unrated, each with a problem called "E"
  const gym = (contestId, verdict) => {
    const item = submission(contestId, "E", verdict, undefined);
    item.problem.name = "E";
    return item;
  };
  assert.equal(findUnsolved([gym(100093, "TIME_LIMIT_EXCEEDED"), gym(100092, "OK")]).length, 1);
});

test("a friend's solved problems narrow the list, parallel rounds included", () => {
  const solve = (contestId, index, name, rating, startTimeSeconds) => {
    const item = submission(contestId, index, "OK", rating);
    item.problem.name = name;
    item.author = { participantType: "PRACTICE", startTimeSeconds };
    return item;
  };
  const friend = [
    solve(1967, "B1", "Reverse Card (Easy Version)", 1400, 1714487700),
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
  assert.equal(solvedBy(row(1503, "E", "Shared", 1900)), false);
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
  assert.deepEqual(pick({ query: "https://codeforces.com/problemset/gymProblem/100092/E" }), ["E"]);
  assert.deepEqual(pick({ query: "https://codeforces.com/contest/1520/problem/A" }), [], "another problem of the contest");
  // tourist's list: 3C is one problem, not 23C, 273C and 573C as well
  const ids = [row(3, "C", "Tic-tac-toe"), row(23, "C", "Oranges and Apples"), row(273, "C", "Dima and Horses")];
  assert.deepEqual(ids.filter((r) => matchesFilter(r, makeFilter({ query: "3c" }))).map(problemKey), ["3|C"]);
  assert.deepEqual(ids.filter((r) => matchesFilter(r, makeFilter({ query: "3|C" }))).map(problemKey), ["3|C"]);
  assert.deepEqual(pick({ tag: "math" }), ["Watermelon"]);
  assert.deepEqual(pick({ min: "1000" }), ["Guess the K-th Zero (Hard version)"]);
  assert.deepEqual(pick({ max: 800 }), ["Watermelon"]);
  assert.deepEqual(pick({ min: "800", max: "2200" }).length, 2, "bounds are inclusive; unrated is out");
  assert.equal(pick({ min: "abc" }).length, 5, "an unreadable bound is no bound");
  const all = pick({});
  assert.deepEqual(pick({ noGym: true }), all.filter((name) => name !== "E"));
  assert.deepEqual(pick({ noSpecial: true }), all.filter((name) => name !== "Ordinary Problem"));
  assert.deepEqual(pick({ noGym: true, noSpecial: true, tag: "dp" }), ["Fresh One"]);
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
    tag: "dp",
    noGym: true,
    noSpecial: true,
    friend: "jiangly",
    inRound: true,
    showTags: true,
  };
  const search = writeParams(state);
  assert.equal(search, "handle=tourist&sort=-tries&q=bear&min=1200&tag=dp&nogym=1&nospecial=1&friend=jiangly&round=1&tags=1");
  assert.deepEqual(readParams(`?${search}`), { ...state, query: "bear" });

  assert.equal(writeParams({ handle: "a b&c", sort: { key: "rating", descending: false } }), "handle=a+b%26c");
  assert.equal(writeParams({ lang: "ru", handle: "x", min: "abc" }), "lang=ru&handle=x");
});

test("unknown or broken parameters fall back to the defaults", () => {
  assert.deepEqual(readParams("?sort=-toString&tags=yes"), {
    handle: "",
    sort: null,
    query: "",
    min: "",
    max: "",
    tag: "",
    noGym: false,
    noSpecial: false,
    friend: "",
    inRound: false,
    showTags: false,
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
  assert.equal(parseHandle("codeforces.com/profile/Um_nik/"), "Um_nik");
  assert.equal(parseHandle("https://m1.codeforces.com/submissions/jiangly/page/2"), "jiangly");
  assert.equal(parseHandle("http://codeforces.com/profile/-is-this-fft-?locale=ru"), "-is-this-fft-");
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
  // Twelve chunks 20 ms apart take far longer than the 60 ms limit, yet nothing goes quiet that long.
  const { response, payload } = await fetchJson("x", { idleMs: 60, fetchFn: trickle(parts, 20) });
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
