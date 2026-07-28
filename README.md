# SeamlessShop

Smart pantry tracker that helps you stop forgetting — and tossing — groceries.

## Features

- **Pantry tracker** — quantities, categories, expiry dates
- **Scan** — receipt OCR, barcode lookup (Open Food Facts), package date OCR
- **Shopping list** — restock finished items; add missing recipe ingredients
- **Cook** — meals matched to what’s in your kitchen
- **Alerts** — expiring soon + optional browser notifications
- **Waste insights** — used vs thrown over the last 30 days
- **Sync** — optional Supabase cloud sync + JSON backup import/export
- **Any device** — responsive installable PWA

## Stack (free & open source)

- React + TypeScript + Vite + vite-plugin-pwa
- Tesseract.js (on-device OCR)
- html5-qrcode (barcode camera)
- Open Food Facts + TheMealDB (free APIs, no keys)
- Supabase free tier (optional sync)
- LocalStorage (always works offline)

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
- Barcode data comes from Open Food Facts community database.
- Notifications need browser permission and work best when installed as a PWA.
