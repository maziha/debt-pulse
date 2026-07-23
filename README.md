# DebtPulse

A calm ledger for EMIs, debts, credit cards, and income — log entries in plain English and see your surplus, obligations, and debt-free date.

## Stack

- TanStack Start (React + Vite)
- TypeScript
- Tailwind CSS
- Supabase (auth + Postgres)

## Development

Requires Node.js 20+.

```sh
npm install
npm run dev
```

Copy `.env.example` (or set) these variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` / anon key
- `GROQ_API_KEY` (for plain-English parsing)

## PWA

DebtPulse is installable as a Progressive Web App. The manifest and service worker live in `public/`. On a supported browser, use **Install app** / **Add to Home Screen**.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
