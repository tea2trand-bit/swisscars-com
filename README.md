# SWISCARS

The production website source is `public/`. Netlify publishes only that directory, as configured in the root `netlify.toml`. Edit website pages and assets inside `public/`; the older root-level website files are retained but are not published.

Server functions are in `netlify/functions/`. The FX function also imports `assets/js/fx-reference.js`. The production build uses Node 24 and pnpm, with `pnpm-lock.yaml`. Supabase sources are separate and are not deployed by this website build.

## Recovered production baseline

Restored from Netlify deploy `6ac2fd5d2b86ed850798eedd` (5 October 2026, 03:29 Europe/Berlin). The only website change is the user-supplied `<style id="novi-izgled">` block immediately before `</head>` in `public/intern/index.html`. All other 57 public files and all 5 build input files match that frozen source byte for byte.

Before unlocking automatic publishing, verify the GitHub main deployment against the reviewed production manifest, both Netlify functions, `/api/fx-reference`, and `/intern/`.
