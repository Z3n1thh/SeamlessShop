# SeamlessShop

Smart pantry tracker that helps you stop forgetting — and tossing — groceries.

**License:** [MIT](./LICENSE) · **Third-party credits & API terms:** [ATTRIBUTIONS.md](./ATTRIBUTIONS.md)

## Features

- **Pantry tracker** — quantities, categories, expiry dates
- **Scan** — receipt OCR, barcode lookup (Open Food Facts), package date OCR
- **Shopping list** — restock finished items; add missing recipe ingredients
- **Cook** — meals matched to what’s in your kitchen (TheMealDB)
- **Alerts** — expiring soon + optional browser notifications
- **Waste insights** — used vs thrown over the last 30 days
- **Sync** — optional Supabase cloud sync + JSON backup import/export
- **Any device** — responsive installable PWA

## Stack (free & open source)

- React + TypeScript + Vite + vite-plugin-pwa (MIT)
- Tesseract.js (Apache-2.0) — on-device OCR
- html5-qrcode (Apache-2.0) — barcode camera
- Open Food Facts (ODbL data) + TheMealDB (free recipe API)
- Supabase JS client (MIT) + optional Supabase Free hosting (their ToS)
- date-fns (MIT), Fraunces & Manrope fonts (OFL)

Full attribution table: [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).

## Run locally

```bash
npm install
npm run dev
```

### Optional cloud sync

1. Create a free [Supabase](https://supabase.com) project
2. Run `supabase/schema.sql` in the SQL editor
3. Copy `.env.example` → `.env` and set:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. Restart the dev server. In **More → Sync**, email yourself a magic link on each device, then Push/Pull.

Without Supabase, use **Download backup / Import backup** to move data between devices.

## Build & deploy

```bash
npm run build
npm run preview
```

Deploy `dist/` to Vercel, Netlify, or Cloudflare Pages (free tiers). For Vercel:

```bash
npx vercel --prod
```

## Notes

- Receipt OCR works best with clear photos; always confirm items before saving.
- Package-date mode looks for “best before / use by / exp” stamps.
- Barcode data comes from Open Food Facts contributors (please keep attribution).
- Recipe suggestions credit TheMealDB.
- Notifications need browser permission and work best when installed as a PWA.

## Legal / compliance note

`LICENSE` and `ATTRIBUTIONS.md` document this project’s license and third-party
sources for transparency. They are **not a substitute for legal advice**. If you
publish or commercialize the app, review Open Food Facts, TheMealDB, Supabase,
and your host’s current terms yourself.
