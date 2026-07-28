# Licenses, APIs & attributions

This file documents third-party software and data sources used by SeamlessShop.
It is for transparency and compliance hygiene — **not legal advice**. Review each
project’s own license/terms if you redistribute or commercialize.

## This project

SeamlessShop application source code is licensed under the **MIT License**.
See [`LICENSE`](./LICENSE).

## Open-source dependencies (npm)

Installed packages keep their own licenses (typically MIT/Apache-2.0). Full texts
ship inside `node_modules/<package>/LICENSE*` after `npm install`.

| Package | Role | Common license |
|---|---|---|
| [React](https://react.dev) / react-dom | UI | MIT |
| [Vite](https://vitejs.dev) | Build tool | MIT |
| [TypeScript](https://www.typescriptlang.org) | Types | Apache-2.0 |
| [date-fns](https://date-fns.org) | Dates | MIT |
| [Tesseract.js](https://tesseract.projectnaptha.com) | On-device OCR | Apache-2.0 |
| [html5-qrcode](https://github.com/mebjas/html5-qrcode) | Barcode camera | Apache-2.0 |
| [@supabase/supabase-js](https://supabase.com) | Optional sync client | MIT |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | PWA / service worker | MIT |
| [Workbox](https://developer.chrome.com/docs/workbox) (via PWA plugin) | Offline caching | MIT |
| [oxlint](https://oxc.rs) | Lint (dev) | MIT |

Tesseract.js uses the **Tesseract OCR** engine / traineddata (Apache-2.0). OCR runs
in the user’s browser; no OCR text is sent to our servers by this app.

## Fonts

| Font | Source | License |
|---|---|---|
| [Fraunces](https://fonts.google.com/specimen/Fraunces) | Google Fonts | SIL Open Font License 1.1 |
| [Manrope](https://fonts.google.com/specimen/Manrope) | Google Fonts | SIL Open Font License 1.1 |

## Third-party APIs & data

### Open Food Facts (barcode product lookup)

- Site: https://world.openfoodfacts.org  
- Data license: **Open Database License (ODbL)**  
- Contents of individual fields may have additional terms; see their wiki/legal pages.  
- **Attribution:** Product information © Open Food Facts contributors.  
- This app uses the **free public API** for barcode lookups. No API key is required for basic use; respect their rate limits and attribution guidelines:  
  https://world.openfoodfacts.org/data  
  https://world.openfoodfacts.org/terms-of-use  

### TheMealDB (recipe suggestions)

- Site: https://www.themealdb.com  
- Free public API (`/api/json/v1/1/…`) for non-commercial / open use as described by TheMealDB.  
- **Attribution:** Recipe data provided by [TheMealDB](https://www.themealdb.com).  
- API docs: https://www.themealdb.com/api.php  
- If you commercialize or need higher limits, check their current terms / Patreon offerings.

### Supabase (optional account sync)

- Site: https://supabase.com  
- Client library: MIT  
- Hosted service: subject to **Supabase Terms of Service** and your project plan (including Free tier limits).  
- You must configure your own project URL + anon/publishable key; do not commit secrets.  
- Auth magic links and stored pantry JSON are handled under *your* Supabase project’s policies.

### Vercel (optional hosting)

- Deployments of this app may run on Vercel; subject to **Vercel Terms of Service**.  
- Environment variables (`VITE_SUPABASE_*`) are build-time public client config — treat the publishable/anon key as public but never commit service-role secrets.

## Browser features

- **Notifications API** — optional expiry alerts; requires user permission.  
- **Camera / file input** — used only for receipt/barcode/package photos on-device.  
- **localStorage** — pantry data stored locally in the browser unless the user enables sync.

## What this app does *not* do

- Does not use paid OpenAI / Anthropic / Google Maps / Twilio APIs.  
- Does not claim ownership of Open Food Facts or TheMealDB content.  
- Does not ship a proprietary license for those datasets.

## Keeping attributions up to date

After changing dependencies, re-check licenses:

```bash
npx license-checker --summary
```

(Or any equivalent SPDX audit tool.)

## Contact / responsibility

Operators of a deployed SeamlessShop instance are responsible for complying with
hosting provider terms, privacy laws in their region, and third-party API rules.
