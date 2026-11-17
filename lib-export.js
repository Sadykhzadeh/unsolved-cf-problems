// Copying or downloading the list. Loaded on first use, from the export buttons,
// so a visit that does not export does not download it.

import { failedTest, problemKey, problemLink, submissionLink, verdictLabel } from "./lib.js";
// The list as text, for pasting or a spreadsheet: the rows given, in the order
// given, with the cells the table shows. The verdict reads as the table has it
// ("WA 37"), and the last attempt is in UTC, to the second.
const EXPORT_HEADER = ["Problem", "Name", "Rating", "Solved by", "Tags", "Tries", "Last verdict", "Last attempt"];

// A problem never tried has no submission: its row has no attempt time.
const tried = (row) => row.lastTime !== undefined;

const verdictText = (row) => {
  if (!tried(row)) return "";
  const [short] = verdictLabel(row.verdict, "?");
  const test = failedTest(row);
  return test ? `${short} ${test.number}` : short;
};

const attemptTime = (row) => new Date(row.lastTime * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

const exportCells = (row) => [
  problemKey(row),
  row.name,
  row.rating === undefined ? "" : String(row.rating),
  row.solvedCount === undefined ? "" : String(row.solvedCount),
  row.tags.join(", "),
  String(row.tries),
  verdictText(row),
  tried(row) ? attemptTime(row) : "",
];

// Markdown reads these as markup, and a pipe as the end of a cell.
const MARKDOWN_SPECIAL = /[\\`*_[\]|<>]/g;
const markdownCell = (text) => text.replace(MARKDOWN_SPECIAL, "\\$&").replace(/\r?\n/g, " ");

export const markdownTable = (rows) => {
  const header = `| ${EXPORT_HEADER.join(" | ")} |`;
  const rule = `| ${EXPORT_HEADER.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    const [problem, ...rest] = exportCells(row);
    const cells = [`[${markdownCell(problem)}](${problemLink(row)})`, ...rest.map(markdownCell)];
    return `| ${cells.join(" | ")} |`;
  });
  return [header, rule, ...body].join("\n");
};

// RFC 4180: a cell with a comma, quote or line break is quoted, with its quotes
// doubled. A cell that starts like a formula gets a quote in front of it, so a
// spreadsheet shows the text rather than running it.
const csvCell = (value) => {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, "\"\"")}"` : guarded;
};

export const csvTable = (rows) => {
  const lines = [[...EXPORT_HEADER, "Problem link", "Last submission"]];
  for (const row of rows) {
    lines.push([...exportCells(row), problemLink(row), tried(row) ? submissionLink(row) : ""]);
  }
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
};
