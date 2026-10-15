# Unsolved Codeforces Problems

Every problem a Codeforces user has tried and not solved, in one table.

**Live:** https://azer.is-a.dev/unsolved-cf-problems/

## What it does

- Lists each unsolved problem once, with its rating, how many times it was
  tried, the last verdict and the date of the last attempt (linking to that
  submission).
- Takes a handle, or a link to a profile pasted from the address bar
  (`https://codeforces.com/profile/tourist`).
- Sorts by problem, name, rating, tries or last attempt: click a header,
  click again to reverse.
- Filters by name or problem id (`1520F2` or `1520|F2`), by a rating range
  and by tag, and can leave out the gym and the problems tagged `*special`
  (April Fools, Kotlin Heroes, Q# rounds and such). Press `/` (or the key in
  its place on a Russian layout) to jump to the search box.
- Hides a problem you do not mean to come back to (a submission to the
  wrong problem, a marathon round) with the button at the end of its row;
  "Show hidden" brings them back. Hidden problems are remembered per handle
  in this browser and are not part of links.
- Picks one of the problems on screen at random, for when the list is too
  long to choose from; filter first to pick among, say, the 1800-2000 dp
  problems.
- Narrows the list to the problems a friend has solved, their parallel
  rounds included: the ones worth asking them about.
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
| `q` | `q=tree` | name contains this, or problem id starts with it |
| `min`, `max` | `min=1600&max=2000` | rating range, inclusive |
| `tag` | `tag=dp` | has this tag |
| `nogym` | `nogym=1` | leave out the gym |
| `nospecial` | `nospecial=1` | leave out problems tagged `*special` |
| `friend` | `friend=jiangly` | only problems this handle has solved |
| `tags` | `tags=1` | show the tags column |
| `lang` | `lang=ru` | `en` or `ru`; remembered |

## How it works

It asks the Codeforces API for every submission a handle has made
(`user.status`), sets aside the problems that were ever accepted, including
ones accepted in the parallel Div. 1 or Div. 2 round (same name and rating, in
a contest that started at the same moment or is numbered one or two away), and
lists what is left - sorted by rating,
with unrated problems last. Everything runs
in the browser; there is no backend and nothing is stored outside it:
`localStorage` keeps the last handle, the chosen language, the problems
hidden for each handle and the results of the last three lookups. A lookup
younger than ten minutes is
shown without asking Codeforces again; an older one is shown at once while a
fresh copy loads, and "Refresh" (or searching for the same handle) always
asks again. A friend's submissions are boiled down to the problems they
solved and kept the same way, the latest friend only, in Cache Storage,
which has room for them. Calls to the API are spaced two seconds apart, as Codeforces asks.

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
