// Which problems two handles compare on: the ones both tried and neither solved, and
// the ones one solved that the other tried and did not. Loaded with the comparison
// panel (see compare.js).
import { hasParallel, problemKey, solvedCheck, sortRows } from "./lib.js";

// Whether a problem was tried, judged from the rows of a handle that tried it and did
// not solve it: the same matching as solvedCheck(), with those rows as the summary.
export const triedCheck = (rows) => solvedCheck({
  keys: rows.map(problemKey),
  twins: rows.filter(hasParallel).map((row) => [row.name, row.rating ?? null, row.contestId, row.start ?? null]),
});

// `mine` and `theirs` are the rows each handle tried and did not solve; `mySolved` and
// `theirSolved` are solvedCheck() answers for what each one solved. Each list is in
// rating order, unrated problems last.
export const compareHandles = ({ mine, theirs, mySolved, theirSolved }) => {
  const theirTried = triedCheck(theirs);
  return {
    both: sortRows(mine.filter((row) => theirTried(row, row.start) && !theirSolved(row, row.start)), "rating", false),
    solvedByTheirs: sortRows(mine.filter((row) => theirSolved(row, row.start)), "rating", false),
    solvedByMine: sortRows(theirs.filter((row) => mySolved(row, row.start)), "rating", false),
  };
};
