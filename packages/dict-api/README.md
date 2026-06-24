# dict-api

Remote dictionary API for puzzledict. Backed by Cloudflare D1.

## Data source

Dictionary entries are imported from
[ECDICT](https://github.com/skywind3000/ECDICT) (MIT). See
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Import

1. Obtain `ecdict.db` from ECDICT (`stardict.py` / release).
2. `pnpm db:generate [path-to-ecdict.db]` — writes `scripts/sql/batch_*.sql`
3. Apply schema and batches to D1 (see output of import script).

Source script: `scripts/import-ecdict.ts`.
