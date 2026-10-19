# SWISCARS

The production website source is `public/`. Netlify publishes only that directory, as configured in the root `netlify.toml`. Edit website pages and assets inside `public/`; the older root-level website files are retained but are not published.

Server functions are in `netlify/functions/`. The FX function also imports `assets/js/fx-reference.js`. The production build uses Node 24 and pnpm, with `pnpm-lock.yaml`. Supabase sources are separate and are not deployed by this website build.

## Production baseline and mobile update

The public source was synchronized with the published Netlify deploy `6ad4d4dc2f4f17449f53d92a` on 20 October 2026, preserving its existing pages and assets. The same update adds the approved compact mobile layout, short work filters, a step-filter dialog, Serbian-only internal workspace, and matching inspection options.

Netlify builds the `main` branch and publishes `public/`. Make future website edits here and deploy through Git so the repository and live site stay aligned. Local preview wrappers and the isolated Stripe production candidate are not part of this release.
