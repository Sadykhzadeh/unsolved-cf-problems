import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// The page reads most of its modules on first use, and CI only checks the syntax of
// script.js and lib.js. A module that fails to load, or an import of a name its module
// does not export, would leave a feature dead without any test failing, so every
// module is loaded here and every name the page imports from one is checked.
const root = new URL("../", import.meta.url);
const modules = readdirSync(root).filter((file) => file.endsWith(".js"));

// The local imports a module makes, static or on first use: { names, path }.
const importsOf = (source) => [
  ...[...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/([^"]+)"/g)].map(([, names, path]) => ({ names, path })),
  ...[...source.matchAll(/import\(\s*"\.\/([^"]+)"\s*\)\.then\(\(\{\s*([^}]*)\}\)/g)].map(([, path, names]) => ({ names, path })),
  ...[...source.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*"\.\/([^"]+)"\s*\)/g)].map(([, names, path]) => ({ names, path })),
];

test("every module of the page loads", async () => {
  for (const file of modules.filter((name) => name !== "script.js")) {
    await import(new URL(file, root).href);
  }
});

test("every name the page imports from a local module is one that module exports", async () => {
  for (const file of modules) {
    for (const { names, path } of importsOf(readFileSync(new URL(file, root), "utf8"))) {
      const exported = await import(new URL(path, root).href);
      for (const name of names.split(",").map((item) => item.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        assert.ok(name in exported, `${file} imports ${name} from ${path}, which does not export it`);
      }
    }
  }
});
