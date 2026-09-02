# Sundgren Realty — Agent Log

---

## Session: 2026-08-31 (Tyler B / Brickley Jr)

### What we built

**Full SCK MLS board expansion**
- Generator was previously locked to boardId 110 (sample data, 9 listings max) with an officeName filter for Sundgren only
- Switched to boardId 254 (South Central Kansas MLS) with no office filter
- Result: 5,809 total listings across 6,350 built pages
  - 4,273 residential
  - 1,468 land
  - 68 commercial
  - 66 Sundgren Realty listings

**Sundgren listings pinned first**
- Added `_isSundgren` flag at fetch time — matched against 10 confirmed agent names
- Index builder sorts: isSundgren → true first, then price desc
- `fix-sundgren-sort.mjs` also re-sorts the JSON in place for immediate effect

**Subtle gold border on Sundgren cards**
- Added `.listing-card--sundgren` CSS modifier in `css/sundgren.css`
- Border: `2px solid rgba(212,175,55,.45)` — brightens to `.75` on hover
- Class applied in `build-listings-index.mjs` card template

**Hero subhead updated**
- Was: "X active properties listed by Jeremy Sundgren in South Central Kansas"
- Now: "X active South Central Kansas MLS listings — Y residential, Z land. Sundgren Realty listings shown first."

**Disclaimer fixed on non-Sundgren listing pages**
- Was: "Listed by [Agent] with Sundgren Realty & Auction" on every page
- Now: "with Sundgren Realty & Auction" only appended for isSundgren listings

**GitHub Actions cron — refresh-listings.yml**
- Runs every 3 hours on a schedule
- Hits Repliers API → regenerates all listing pages → builds site → deploys to staging + main
- `REPLIERS_API_KEY` secret added to repo (confirmed visible)
- Manual trigger available via workflow_dispatch

### Files modified
- `generate-repliers-listings.mjs` — boardId, full pagination, isSundgren flag, sort after normalization, disclaimer fix
- `build-listings-index.mjs` — hero subhead, Sundgren card class
- `build-type-index-pages.mjs` — rebuilt with full dataset
- `build-property-search.mjs` — rebuilt with full dataset
- `css/sundgren.css` — `.listing-card--sundgren` styles added
- `.github/workflows/refresh-listings.yml` — new cron workflow
- `data/repliers-listings.json` — 5,809 listings, Sundgren sorted first
- `data/all-listings.json` — rebuilt from repliers data

### Production deploy
- Pushed to: `main` branch
- Production: https://sundgren-realty.pages.dev
- Staging: https://staging.sundgren-realty.pages.dev

### Known state / next steps
- Commercial listings (68) have pages but no dedicated index page — could add one
- No "Sundgren Only" filter button on the index — could add as a quick toggle
- GitHub Actions auto-refresh will keep data current within 3 hours indefinitely
