// The handle's weakest tags, shown above the list: each one a chip that narrows the list
// to it. Read when the first results show (see loadTagsView() in script.js).
import { fillText } from "./lib.js";

// The accessible name of a weak-tag chip: the tag, and how many of the problems
// attempted with it are unsolved.
export const weakTagName = ({ tag, solved, attempted, unsolved }, template) => fillText(template, {
  tag, solved, attempted, unsolved,
});

// The tags of the unsolved problems, each with how many problems carry it, how
// many of the problems tried with it were solved and how many were tried in all.
// The commonest unsolved first, the bogus "*special" tag left out, at most
// `limit` of them.
export const weakTags = (rows, solvedTags, limit = 5) => {
  const unsolved = new Map();
  for (const row of rows) {
    for (const tag of row.tags) {
      if (tag !== "*special") unsolved.set(tag, (unsolved.get(tag) ?? 0) + 1);
    }
  }
  return [...unsolved]
    .map(([tag, count]) => {
      const solved = Object.hasOwn(solvedTags, tag) ? solvedTags[tag] : 0;
      return { tag, solved, attempted: solved + count, unsolved: count };
    })
    .sort((a, b) => b.unsolved - a.unsolved || a.tag.localeCompare(b.tag))
    .slice(0, limit);
};

export const createTags = ({ byId, text, fill, state, chosen, addTag }) => {
  const show = () => {
    const weak = weakTags(state.rows, state.solvedTags);
    byId("weakTags").hidden = !weak.length;
    byId("weakTagsLabel").textContent = text.weakTagsLabel;
    byId("weakTagsList").replaceChildren(...weak.map(({ tag, solved, attempted, unsolved }) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.dataset.tag = tag;
      chip.textContent = `${tag} ${solved}/${attempted}`;
      chip.title = fill(text.weakTagTitle, { solved, attempted, tag });
      chip.setAttribute("aria-label", weakTagName({ tag, solved, attempted, unsolved }, text.weakTagName));
      return chip;
    }));
  };

  byId("weakTagsList").addEventListener("click", (event) => {
    const chip = event.target.closest("button.tag-chip");
    if (!chip || chosen().includes(chip.dataset.tag)) return;
    addTag(chip.dataset.tag);
  });
  return { show };
};
