# Sundgren Realty — Site Roadmap

**Last updated:** 2026-08-28
**Site:** sundgrenrealty.com | CF Pages: sundgren-realty
**Client:** Jeremy Sundgren, Sundgren Realty, El Dorado KS

---

## Current State

- 49 MLS listing pages (IDX Broker-sourced — to be replaced)
- 474 BidWrangler auction pages (built, may need refresh)
- Residential, land, commercial, listings index pages live
- Design system locked in (sundgren.css)
- Repliers API connected — 3,856 regional listings, 13 Jeremy's active

---

## Phase 1 — Migrate MLS source from IDX → Repliers ✅ IN PROGRESS

**Goal:** Replace IDX-sourced listing pages with Repliers-powered pages.
- IDX Broker dependency removed
- Images and data pulled directly from Repliers feed
- Jeremy's 13 active listings rebuilt as the canonical source
- Generator script: `generate-repliers-listings.mjs`

**Steps:**
1. Pull all 13 Jeremy listings via `agent=Jeremy+Sundgren`
2. Generate pages for all 13 (residential + land)
3. Retire old IDX-sourced pages or redirect them
4. Rebuild listing index cards from Repliers data

---

## Phase 2 — Design Approval

**Goal:** Tyler B reviews 3 residential + 3 land pages, approves look/feel.
- No design changes planned — just a sanity check before full rollout
- Once approved, all 13 Jeremy listings go live

---

## Phase 3 — Broader MLS Feed Decision

**Goal:** Decide how much of the 3,856-listing regional feed to build.

**Options:**
| Option | Pages | SEO Impact | Complexity |
|--------|-------|------------|------------|
| Jeremy-only | 13 | Low | Low |
| Regional curated (Butler/Sedgwick County) | ~500-800 | High | Medium |
| Full feed | ~3,856 | Very High | High (MLS compliance req'd) |

**MLS display compliance requirements (if going regional):**
- Agent/brokerage attribution on every page
- Required fields: list date, MLS number, status
- IDX disclosure language
- Data recency (listings must reflect current status)

---

## Phase 4 — Search & Sort Functionality

**Goal:** Filterable listing index on sundgrenrealty.com/listings/

**Features:**
- Filter by: property type (residential/land/commercial), city, price range, beds/baths
- Sort by: price (asc/desc), newest, acres
- Jeremy's listings always float to top (featured/pinned)
- Client-side JS for speed (no server round-trip for basic filters)
- Repliers API live search for property-search page (`/property-search/`)

---

## Phase 5 — BidWrangler Refresh & Automation

**Goal:** Keep 474 auction pages current automatically.

**Steps:**
1. Audit existing auction pages for stale data
2. Wire BidWrangler API refresh cron (see `SOP-BIDWRANGLER-INTEGRATION.md`)
3. Auto-expire closed auctions (update status, redirect or archive)
4. Sync upcoming auction dates from BW feed

---

## Phase 6 — SEO & Performance Polish

- OG images per listing (currently using generic fallback)
- Sitemap.xml regeneration after each build
- Schema markup audit (RealEstateListing JSON-LD already on listing pages)
- Core Web Vitals pass — image lazy loading, font optimization
- Google Search Console monitoring

---

## Decisions Log

| Date | Decision | Notes |
|------|----------|-------|
| 2026-08-18 | 9 sample Repliers pages built | Commit a1aa294 |
| 2026-08-28 | IDX → Repliers migration approved | Phase 1 starting |
| 2026-08-28 | Design locked — no changes | Approved as-is |
| 2026-08-28 | Broader feed scope TBD | Decision pending Phase 3 |
