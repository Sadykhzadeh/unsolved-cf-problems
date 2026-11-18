// Which problems a repeat lookup found solved: the ones listed in the saved copy it
// replaced that are not listed now, and that the handle has solved. Loaded with the
// line that shows them (see since.js).
import { problemKey, solvedCheck } from "./lib.js";

export const solvedSince = (previous, current, solved) => {
  const listed = new Set(current.map(problemKey));
  const known = solvedCheck(solved);
  return previous.filter((row) => !listed.has(problemKey(row)) && known(row, row.start));
};
