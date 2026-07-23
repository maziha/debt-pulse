# DebtPulse agent notes

- Prefer small, focused diffs that match existing patterns.
- Do not rewrite published git history (force push / rebase of shared commits) unless the user explicitly asks.
- Keep secrets out of the repo — `.env` is gitignored.
- Supabase schema changes go in `supabase/migrations/`.
