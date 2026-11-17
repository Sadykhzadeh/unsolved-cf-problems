// The "By tag" table under the weakest tags: every tag of the attempted problems with
// how many are unsolved, how many were attempted with it, and the median rating of its
// rated unsolved problems. A column sorts the table, a click on a tag filters the list
// to it. Read the first time the table is opened (see loadTagTable() in script.js).
const medianOf = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// The "*special" tag is left out, as in weakTags(). A tag's attempted count is the
// problems it was solved on plus the unsolved ones.
export const tagSummary = (rows, solvedTags) => {
  const byTag = new Map();
  for (const row of rows) {
    for (const tag of row.tags) {
      if (tag === "*special") continue;
      if (!byTag.has(tag)) byTag.set(tag, { tag, unsolved: 0, ratings: [] });
      const entry = byTag.get(tag);
      entry.unsolved += 1;
      if (typeof row.rating === "number") entry.ratings.push(row.rating);
    }
  }
  return [...byTag.values()].map(({ tag, unsolved, ratings }) => {
    const solved = Object.hasOwn(solvedTags, tag) ? solvedTags[tag] : 0;
    return { tag, unsolved, attempted: solved + unsolved, median: medianOf(ratings) };
  });
};

// The entries in the order of a column. Ties go by the tag's name; a tag with no median
// goes last whichever way the median column runs.
export const sortTags = (entries, key, descending) => {
  const sign = descending ? -1 : 1;
  return [...entries].sort((a, b) => {
    if (key === "median" && (a.median === null || b.median === null)) {
      return (a.median === null) - (b.median === null);
    }
    if (key === "tag") return sign * a.tag.localeCompare(b.tag);
    return sign * (a[key] - b[key]) || a.tag.localeCompare(b.tag);
  });
};

const COLUMNS = [
  ["tag", "tagTableTag"],
  ["unsolved", "tagTableUnsolved"],
  ["attempted", "tagTableAttempted"],
  ["median", "tagTableMedian"],
];

export const createTagTable = ({ byId, text, fill, state, chosen, addTag }) => {
  // The most unsolved first, as the weakest tags are.
  let key = "unsolved";
  let descending = true;

  const show = () => {
    const entries = sortTags(tagSummary(state.rows, state.solvedTags), key, descending);
    const table = document.createElement("table");
    const head = document.createElement("tr");
    for (const [name, label] of COLUMNS) {
      const th = document.createElement("th");
      th.scope = "col";
      if (name === key) th.setAttribute("aria-sort", descending ? "descending" : "ascending");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sort";
      button.dataset.key = name;
      button.textContent = text[label];
      th.append(button);
      head.append(th);
    }
    table.append(head);
    for (const entry of entries) {
      const tr = document.createElement("tr");
      const tagCell = document.createElement("td");
      const tagButton = document.createElement("button");
      tagButton.type = "button";
      tagButton.className = "tag-chip";
      tagButton.dataset.tag = entry.tag;
      tagButton.textContent = entry.tag;
      tagButton.setAttribute("aria-label", fill(text.weakTagName, entry));
      tagCell.append(tagButton);
      tr.append(tagCell);
      const values = [entry.unsolved, entry.attempted, entry.median === null ? "-" : String(Math.round(entry.median))];
      for (const value of values) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      }
      table.append(tr);
    }
    byId("byTagBody").replaceChildren(table);
  };

  byId("byTagBody").addEventListener("click", (event) => {
    const sort = event.target.closest("button.sort");
    if (sort) {
      const name = sort.dataset.key;
      descending = name === key ? !descending : name !== "tag";
      key = name;
      show();
      return;
    }
    const tagButton = event.target.closest("button.tag-chip");
    if (tagButton && !chosen().includes(tagButton.dataset.tag)) addTag(tagButton.dataset.tag);
  });

  return { show };
};
