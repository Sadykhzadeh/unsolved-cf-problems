# Unsolved Codeforces Problems

Every problem a Codeforces user has tried and not solved, in one table.

**Live:** https://azer.is-a.dev/unsolved-cf-problems/

## What it does

- Lists each unsolved problem once, with its rating, how many times it was
  tried, the last verdict and the test it failed on (`WA 37`), and the date
  of the last attempt (linking to that submission), with how long ago it was in
  the tooltip.
- Takes a handle, or a link to a profile pasted from the address bar
  (`https://codeforces.com/profile/tourist`). The handles looked up lately are
  offered again in the handle and friend fields.
- Sorts by problem, name, rating, tries, last attempt or how many people solved
  it ("Solved by", shown once the problem list is read for the upsolve view): click a header,
  click again to reverse.
- Filters by name or problem id (`1520F2`, `1520|F2` or a link to the
  problem), by a rating range, by how many times it was tried (at least a
  number), by tags (all of several, or any of them), by the verdict of the last
  attempt, as the table labels it (`TLE`, `WA` and so on), and by how long ago the last
  attempt was (within a number of days), and can leave out the gym and the
  problems tagged `*special` (April Fools, Kotlin Heroes, Q# rounds and
  such), and can keep just the problems tried during a round, live or
  virtual, rather than only in practice: the ones left to upsolve. Press
  `/` (or the key in its place on a Russian layout) to jump to the search
  box, `P` to pick a problem at random, `j` and `k` to move a highlight down
  and up the list, `Enter` or `o` to open the highlighted problem in a new tab,
  and Escape to clear the tag filter; `?` lists these keys in a dialog.
- Hides a problem you do not mean to come back to (a submission to the
  wrong problem, a marathon round) with the button at the end of its row;
  "Show hidden" brings them back. Hidden problems are remembered per handle
  in this browser and are not part of links.
- Picks one of the problems on screen at random, for when the list is too
  long to choose from; filter first to pick among, say, the 1800-2000 dp
  problems.
- Narrows the list to the problems a friend has solved, their parallel
  rounds included: the ones worth asking them about. Ticking "Mark instead of
  filtering" keeps the whole list instead, marks those problems with "✓ friend",
  and says how many there are in the counter line.
- Compares the list with the friend's, in a panel under the weakest tags (opened
  by its summary, "Compare with ..."): the problems both tried and neither
  solved, the ones the friend solved that you tried, and the ones you solved
  that the friend tried. Each list is in rating order, and a parallel round
  counts as the same problem, as it does for the friend filter.
- Shows the five tags the handle is weakest on above the list: how many of
  its unsolved problems carry each tag, and solved out of attempted for it.
  A click on one narrows the list to that tag.
- Opens a "By tag" table under them: every tag of the attempted problems, with how
  many are unsolved, how many were attempted with it, and the median rating of its
  unsolved problems. Its columns sort it, and a click on a tag narrows the list.
- Adds the problems never tried from the contests the handle was rated in, with
  0 tries and no verdict, marked "never tried"; the problem list is read once
  per language and kept for six hours, and the rated contests are read again
  after ten minutes. A contest counts as one the handle took part in when it is in
  its rating history, or when the handle has a submission in it as a contestant,
  a virtual participant or out of competition; practice submissions do not count,
  so an unrated round or a virtual run is covered, and a contest only practised is not.
  The counter line says how many of the listed problems were never tried.
  Hovering a problem id says how many problems of its contest are solved.
- Shows the unsolved problems by rating as a strip of bars above the list: a
  click on a band keeps only its hundred ratings, and a click on the chosen band
  again clears it. The bands are buttons, so Tab and Enter or Space do the same.
- Shows or hides the problem tags without reloading anything.
- Copies the list on screen as a Markdown table, or downloads it as CSV; both
  follow the filters and the sort, and the CSV opens in a spreadsheet with
  cells that start like a formula left as text.
- Keeps the view in the address bar, so a link opens the same list, sorted
  and filtered the same way, and Back returns to the handle looked up before.
- Remembers the sort, the tags column, the gym and special-round switches, the
  upsolve box and the friend marks for the next visit, for a link that says
  nothing about them; a link that does is that view, with the rest at their
  defaults. The links the page writes
  always name the sort (`sort=rating` for the default), so they open the same
  list whatever view the visitor remembers.
- Shows the last lookup instantly on the next visit (see below).
- When a lookup replaces a saved copy of the same handle (searching it again, or
  a visit once the copy is ten minutes old), says which problems the handle
  solved since that copy, with links to them. A visit to a copy younger than ten
  minutes does not look the handle up again, so there is nothing to compare.
- Says why a lookup failed: no such user, an invalid handle, the API rate
  limit, Codeforces being down, or no connection.
- English and Russian; follows the system's light or dark theme; fits a
  phone.

## Link parameters

| Parameter | Example | Meaning |
| --- | --- | --- |
| `handle` | `handle=tourist` | whose problems to list |
| `sort` | `sort=-tries` | `problem`, `name`, `rating`, `tries`, `last` or `solved`; a leading `-` sorts descending |
| `q` | `q=tree` | name contains this, or problem id starts with it |
| `min`, `max` | `min=1600&max=2000` | rating range, inclusive |
| `triesmin` | `triesmin=3` | tried at least this many times |
| `tag` | `tag=dp` | has this tag; repeat it for several, `tag=dp&tag=graphs` |
| `tagany` | `tagany=1` | with several tags, has any of them rather than all of them |
| `verdict` | `verdict=TLE` | the last attempt ended with this verdict, as the table labels it |
| `days` | `days=30` | the last attempt is within this many days |
| `nogym` | `nogym=1` | leave out the gym |
| `nospecial` | `nospecial=1` | leave out problems tagged `*special` |
| `friend` | `friend=jiangly` | only problems this handle has solved |
| `friendmode` | `friendmode=mark` | with a friend, mark the problems they solved instead of keeping only those |
| `round` | `round=1` | only problems tried during a round, live or virtual |
| `upsolve` | `upsolve=1` | also the problems never tried from the contests the handle was rated in |
| `tags` | `tags=1` | show the tags column |
| `lang` | `lang=ru` | `en` or `ru`; left out of the link for English, remembered |

## How it works

It asks the Codeforces API for every submission a handle has made
(`user.status`), sets aside the problems that were ever accepted, including
ones accepted in the parallel Div. 1 or Div. 2 round (same name and rating, in
a contest that started at the same moment or is numbered up to seven away), and
lists what is left - sorted by rating,
with unrated problems last. Everything runs
in the browser; there is no backend and nothing is stored outside it:
`localStorage` keeps the last handle, the eight handles offered again in the
fields, the chosen language, the view the last visit left (sort, tags column,
gym and special switches, upsolve box and friend marks), the problems hidden
for each handle and the results of the last three lookups. A lookup
younger than ten minutes is
shown without asking Codeforces again; an older one is shown at once while a
fresh copy loads, and "Refresh" (or searching for the same handle) always
asks again. A friend's submissions are boiled down to the problems they
solved and the ones they tried and did not solve, kept the same way, the
latest friend only, in Cache Storage, which has room for them. What the submissions older than a day add up to is
kept there too, for the latest three handles, so asking again takes the 300
newest submissions only (about 15 KB instead of 240 to 500 KB) and adds them;
the whole history is read again when nothing is kept, when the newest 300 do
not reach back to the part that was, and every three days. The problem list
of the upsolve view is kept there as well, one per language for six hours, and
so are the contests each of the latest three handles was rated in, for ten
minutes. Calls to the API are spaced two seconds apart, as Codeforces asks. A call
refused for the rate limit, or by a busy gateway, is made once more after the next
two seconds.

## Running it locally

Any static file server will do; the page loads its scripts as ES modules,
which browsers refuse to do from `file://`:

```sh
npx http-server -p 4340
```

Then open http://localhost:4340/ in the browser. The lookups need the internet,
since they read the Codeforces API.

The logic that does not touch the page lives in `lib.js` and the `lib-*.js`
modules, and is tested with Node's built-in runner (CI uses Node 24), with no
dependencies to install:

```sh
npm test
```

### Author - [Azer Sadykhzadeh](https://github.com/sadykhzadeh).
