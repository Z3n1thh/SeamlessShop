# SeamlessShop setup checklist

## App
- Live: https://seamlessshop.vercel.app
- Repo: https://github.com/Z3n1thh/SeamlessShop

## Supabase (do once)

### 1. Run SQL
1. Open [SQL Editor](https://supabase.com/dashboard/project/uiiyonrascqnsdrmiaud/sql/new)
2. Paste contents of `supabase/schema.sql`
3. Click **Run**

### 2. Auth redirect URLs
1. Open [URL Configuration](https://supabase.com/dashboard/project/uiiyonrascqnsdrmiaud/auth/url-configuration)
2. Site URL: `https://seamlessshop.vercel.app`
3. Redirect URLs add:
   - `https://seamlessshop.vercel.app/**`
   - `http://localhost:5175/**`

### 3. Test sync
1. Open the live app → **More → Sync**
2. Enter email → magic link
3. **Push to cloud**, then on another device **Pull**

## On your phone
1. Open https://seamlessshop.vercel.app
2. Browser menu → **Add to Home Screen** / Install
3. Use **Scan → Barcode** on a real product, or receipt photo

## New features
- **Scan** defaults to barcode
- **Shop** aisle groups + Store mode
- **Cook → Week plan** uses expiring food
- **More → Household** shared pantry invite codes
