// The rating strip: the unsolved problems by rating, one bar a hundred wide, and the
// bands that narrow the rating fields. Read when the first results show (see
// loadRatingView() in script.js).
import { bound, fillText } from "./lib.js";

// The rating bands of the rows, each a hundred wide, from the lowest band with
// a rated row to the highest, the empty ones between included. `count` is how
// many rows fall in the band; unrated rows are in no band. Empty for no rated rows.
export const ratingBuckets = (rows) => {
  const counts = new Map();
  for (const row of rows) {
    if (typeof row.rating !== "number") continue;
    const from = Math.floor(row.rating / 100) * 100;
    counts.set(from, (counts.get(from) ?? 0) + 1);
  }
  if (!counts.size) return [];
  const bands = [...counts.keys()];
  const low = Math.min(...bands);
  const high = Math.max(...bands);
  const buckets = [];
  for (let from = low; from <= high; from += 100) {
    buckets.push({ from, to: from + 99, count: counts.get(from) ?? 0 });
  }
  return buckets;
};

// Whether the rating range in the filter fields is exactly this band, so the
// band that is chosen shows as chosen.
export const isBucket = (bucket, min, max) => bucket.from === bound(min) && bucket.to === bound(max);

// The accessible name of a rating band: its range and how many unsolved problems it holds.
export const ratingBandName = ({ from, to, count }, template) => fillText(template, { from, to, count });

export const createRatingStrip = ({ byId, text, listRows, aboutOpen, applyFilters, syncUrl }) => {
  // The unsolved problems by rating, one button a hundred wide, its bar as tall as
  // the band is full. A band narrows the rating fields to itself; the chosen band
  // clears them. Buttons, so Tab and Enter or Space work as a mouse does.
  const showRatingStrip = () => {
    const buckets = listRows().length && !aboutOpen() ? ratingBuckets(listRows()) : [];
    byId("ratingStrip").hidden = !buckets.length;
    byId("ratingStripLabel").textContent = text.ratingStripLabel;
    const tallest = Math.max(1, ...buckets.map((bucket) => bucket.count));
    byId("ratingBars").replaceChildren(...buckets.map(({ from, to, count }) => {
      const band = document.createElement("button");
      band.type = "button";
      band.className = "rating-band";
      band.dataset.from = from;
      band.dataset.to = to;
      const label = ratingBandName({ from, to, count }, text.ratingBandLabel);
      band.title = `${label}. ${text.ratingBandTitle}`;
      band.setAttribute("aria-label", label);
      const bar = document.createElement("span");
      bar.className = "bar";
      // An empty band has no bar; a band with a row keeps a sliver of one.
      bar.style.height = count ? `${Math.max(4, Math.round(count / tallest * 100))}%` : "0";
      band.append(bar);
      return band;
    }));
    markRatingBands();
  };

  const markRatingBands = () => {
    const min = byId("minRating").value;
    const max = byId("maxRating").value;
    for (const band of byId("ratingBars").children) {
      const chosen = isBucket({ from: Number(band.dataset.from), to: Number(band.dataset.to) }, min, max);
      band.setAttribute("aria-pressed", String(chosen));
    }
  };

  byId("ratingBars").addEventListener("click", (event) => {
    const band = event.target.closest("button.rating-band");
    if (!band) return;
    const bucket = { from: Number(band.dataset.from), to: Number(band.dataset.to) };
    const chosen = isBucket(bucket, byId("minRating").value, byId("maxRating").value);
    // Setting the fields does not fire their input event, so the list is updated here.
    byId("minRating").value = chosen ? "" : String(bucket.from);
    byId("maxRating").value = chosen ? "" : String(bucket.to);
    applyFilters();
    syncUrl();
  });
  return { show: showRatingStrip, mark: markRatingBands };
};
