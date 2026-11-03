# JS Installations & Closets

The company website and admin dashboard.

| | |
|---|---|
| Live site | https://REPLACE-ME.github.io |
| Admin | https://REPLACE-ME.github.io/admin/ |
| Closet builder | https://REPLACE-ME.github.io/design/ |

## What this is

A static site — no server, no database, no build step. Everything runs in the browser,
which is why it hosts free on GitHub Pages.

- `index.html` — home page, scroll-scrubbed hero (**Option A**)
- `home-video.html` — same site, looping video hero (**Option B**)
- `design/` — the 3D closet builder with live pricing off the real parts catalogue
- `admin/` — the CRM: schedule, clients, jobs, quotes, and the Claude assistant
- `assets/data/catalog.json` — the parts and finish prices everything is priced from

## Updating it

Edit the files, then:

    git add -A && git commit -m "what changed" && git push

GitHub Pages redeploys in under a minute.

## Still to connect

See `04_Delivery/ADMIN-SETUP.md` on the build drive — Anthropic API key, Web3Forms,
Resend and the Google Maps embed.
