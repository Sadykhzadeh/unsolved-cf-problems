// The line under the results of a repeat lookup: the problems the lookup found solved
// since the saved copy it replaced. Read the first time a repeat lookup finishes (see
// script.js); script.js decides whether the line is shown.
import { problemKey, problemLink } from "./lib.js";
import { solvedSince } from "./lib-since.js";

export const fillSolvedSince = ({ byId, text, fill, anchor, ago, handle, previous, current, solved }) => {
  const line = byId("solvedSince");
  const found = solvedSince(previous.rows, current, solved);
  const when = ago(previous.savedAt);
  line.replaceChildren();
  if (found.length === 0) {
    line.textContent = fill(text.solvedSinceNoneText, { ago: when });
  } else {
    line.textContent = `${fill(text.solvedSinceText, { ago: when, count: String(found.length) })} `;
    found.forEach((row, index) => {
      if (index > 0) line.append(", ");
      line.append(anchor(problemLink(row), problemKey(row)));
    });
  }
  line.dataset.handle = handle;
};
