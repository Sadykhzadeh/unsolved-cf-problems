# Unsolved Codeforces Problems

[Site link is here](https://sadykhzadeh.github.io/unsolved-cf-problems/)

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

Any static file server will do, because the page loads `script.js` as a
separate file:

```sh
npx http-server -p 4340
```

`?lang=en` and `?lang=ru` switch language; the choice is remembered.

### Author - [Azer Sadykhzadeh](https://github.com/sadykhzadeh).
