// The comparison with a friend, in the panel under the weakest tags: the problems both
// handles tried and neither solved, and the problems one of them solved that the other
// tried and did not. Read the first time the panel is opened (see loadCompareView() in
// script.js).
import { compareHandles } from "./lib-compare.js";
import { problemKey, problemLink, solvedCheck } from "./lib.js";

export const createCompare = ({ byId, text, fill, anchor, state, friend }) => {
  // A heading, then the problems under it as a list when there are any.
  const section = (label, rows) => {
    const heading = document.createElement("p");
    heading.textContent = label;
    if (rows.length === 0) return [heading];
    const list = document.createElement("ul");
    for (const row of rows) {
      const item = document.createElement("li");
      item.append(anchor(problemLink(row), `${problemKey(row)} ${row.name}`));
      list.append(item);
    }
    return [heading, list];
  };

  const show = () => {
    const found = compareHandles({
      mine: state.rows,
      theirs: friend.rows,
      mySolved: solvedCheck(state.solved),
      theirSolved: friend.solvedBy,
    });
    const sections = [
      [text.compareBothText, found.both],
      [text.compareTheirsText, found.solvedByTheirs],
      [text.compareMineText, found.solvedByMine],
    ];
    byId("compareBody").replaceChildren(...sections.flatMap(([template, rows]) =>
      section(fill(template, { handle: friend.handle, count: rows.length }), rows)));
  };

  return { show };
};
