# Unsolved Codeforces Problems

Every problem a Codeforces user has tried and not solved, in one table.

**Live:** https://azer.is-a.dev/unsolved-cf-problems/

## What it does

- Lists each unsolved problem once, with its rating, how many times it was
  tried, the last verdict and the date of the last attempt (linking to that
  submission).
- Sorts by problem, name, rating, tries or last attempt: click a header,
  click again to reverse.
- Filters by name or problem id (`1520F2` or `1520|F2`), by a rating range
  and by tag. Press `/` to jump to the search box.
- Shows or hides the problem tags without reloading anything.
- Keeps the view in the address bar, so a link opens the same list, sorted
  and filtered the same way.
- Shows the last lookup instantly on the next visit (see below).
- Says why a lookup failed: no such user, an invalid handle, the API rate
  limit, Codeforces being down, or no connection.
- English and Russian; follows the system's light or dark theme; fits a
  phone.

## Link parameters

| Parameter | Example | Meaning |
| --- | --- | --- |
| `handle` | `handle=tourist` | whose problems to list |
| `sort` | `sort=-tries` | `problem`, `name`, `rating`, `tries` or `last`; a leading `-` sorts descending |
| `q` | `q=tree` | name or problem id contains this |
| `min`, `max` | `min=1600&max=2000` | rating range, inclusive |
| `tag` | `tag=dp` | has this tag |
| `tags` | `tags=1` | show the tags column |
| `lang` | `lang=ru` | `en` or `ru`; remembered |

## How it works

It asks the Codeforces API for every submission a handle has made
(`user.status`), sets aside the problems that were ever accepted, and lists
what is left - sorted by rating, with unrated problems last. Everything runs
in the browser; there is no backend and nothing is stored anywhere but your
own `localStorage`, which keeps the last handle, the chosen language and the
results of the last three lookups. A lookup younger than ten minutes is
shown without asking Codeforces again; an older one is shown at once while a
fresh copy loads, and "Refresh" (or searching for the same handle) always
asks again.

## Running it locally

Any static file server will do; the page loads its scripts as ES modules,
which browsers refuse to do from `file://`:

```sh
npx http-server -p 4340
```

The logic that does not touch the page lives in `lib.js` and is tested with
Node's built-in runner, no dependencies needed:

```sh
npm test
```

### Author - [Azer Sadykhzadeh](https://github.com/sadykhzadeh).
