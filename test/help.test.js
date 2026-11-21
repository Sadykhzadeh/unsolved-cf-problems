import { test } from "node:test";
import assert from "node:assert/strict";
import en from "../strings-en.js";
import { isClearTagsKey, isHelpKey, isPickKey, isSearchKey, rowKeyAction } from "../lib.js";

// The keyboard shortcuts the dialog lists are written out in the strings, apart from the
// keys the page reads. Each listed key has to be one of the predicates script.js reads.
const acts = (key) => [
  isSearchKey(key, ""),
  isPickKey(key, ""),
  rowKeyAction(key, "") !== null,
  isClearTagsKey(key),
  isHelpKey(key),
].some(Boolean);

test("every key the shortcut dialog lists is one the page acts on", () => {
  for (const { keys } of en.keysHelpRows) {
    for (const key of keys) assert.ok(acts(key), `${key} is listed but no key handler reads it`);
  }
});
