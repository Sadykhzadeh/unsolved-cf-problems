// The About panel: the project's links, shown in place of the results. Read the first
// time it is opened (see the About button in script.js).
export const createAbout = ({ byId, text, lang, anchor, aboutOpen, showResults }) => {
  const toggle = () => {
    const tableList = byId("table-list");
    byId("table-main").hidden = true;
    byId("filters").hidden = true;
    byId("weakTags").hidden = true;
    byId("byTag").hidden = true;
    byId("ratingStrip").hidden = true;
    byId("freshness").hidden = true;
    byId("tableCaption").textContent = "";
    byId("counter").textContent = "";

    // Closing the about panel brings the last results back.
    if (aboutOpen()) {
      tableList.replaceChildren();
      delete tableList.dataset.showing;
      showResults();
      return;
    }

    const row = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.append(anchor(
      `https://codeforces.com/blog/entry/79960?locale=${encodeURIComponent(lang)}`,
      text.aboutProject,
    ));
    td.append(document.createElement("br"));
    const keys = document.createElement("small");
    keys.textContent = text.keysHint;
    td.append(keys, document.createElement("br"));
    const credits = document.createElement("small");
    credits.append(anchor("https://got.az/azer/unsolved-cf-problems", text.sourceLink));
    credits.append(document.createTextNode(" | "));
    credits.append(anchor("https://azer.one", "Azer Sadykhzadeh"));
    td.append(credits);
    row.append(td);

    tableList.replaceChildren(row);
    tableList.dataset.showing = "about";
  };
  return { toggle };
};
