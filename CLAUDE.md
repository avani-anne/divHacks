# CLAUDE.md

NYC Green Space Planner is a static web app (HTML, CSS and vanilla JS) that maps NYC green space by ZIP code. It has three tabs: **Map** (neighborhood profile + site proposals), **Build Ideas** (site advisor + plant picks) and **Community** (petitions, projects, volunteer sign-up). See README.md for the feature list.

## Running

- No build step and no package.json. Serve the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/#zip=10027`.
- Accounts and community data live in Supabase (project `ugbbkbgdhdtmubvliese`). The client is `sb` in `js/config.js`. The schema, triggers and RLS policies are in `supabase/schema.sql`; change the database by editing that file and re-running it in the Supabase SQL Editor.
- Map data is fetched at runtime from NYC Open Data (Socrata SODA API, `https://data.cityofnewyork.us/resource/<id>.json`). Every dataset used sends `Access-Control-Allow-Origin: *`, so no proxy is needed.
- Good test ZIPs: 10027 (Harlem, dense), 10451 (South Bronx), 11375 (Forest Hills, borders big parks), 10314 (Staten Island, large), 10200 (invalid, exercises the error path).

## Architecture

- Plain `<script>` tags, no modules. Load order in `index.html` matters:
  `data.js → analysis.js → plants.js → supabase-js (CDN) → config.js → store.js → auth.js → map3d.js → streetview.js → app.js → advisor.js → community.js → main.js`.
  Top-level `const`s and functions are shared globals across files (e.g. `$`, `esc`, `fmt`, `state`, `COLORS`, `WALK_5_MIN`, `SQM_PER_ACRE`, `titleCase`, `showTab`).
- `data.js` (`Data`): every network call. Keep queries here, not in UI code.
- `analysis.js` (`Analysis`): pure geometry and metric calculations using the global `turf`.
- `app.js`: global `state`, the Leaflet map for the Map tab, the profile, the proposal tool, hash routing (`#zip=NNNNN`) and `showTab()`.
- `map3d.js` (`Map3D`): 3D view, a MapLibre GL map overlaid on `#map`. MapLibre is lazy-loaded from unpkg. The camera syncs with the Leaflet map when toggled (MapLibre zoom ≈ Leaflet zoom − 1). Call `Map3D.syncData()` after proposals or layer visibility change.
- `streetview.js` (`StreetView`): optional Google Street View panorama, loaded on demand when a restricted Maps JavaScript API key is configured in `config.js`.
- `auth.js` (`Auth`, `AuthUI`): Supabase Auth plus the `profiles` row, cached in `Auth.user` so `Auth.current()` is synchronous. Handles sign-up (including the "confirm your email" case), login, password reset and profile updates (camelCase fields map to snake_case columns via `PROFILE_COLUMNS`). Use `await Auth.require(reason)` to gate an action. It resolves to the user, or null if the dialog was dismissed.
- `main.js`: startup (binds the account UI, wires `Auth.onChange`, calls `route()`). Must load last.
- `advisor.js` (`Advisor`): Build Ideas tab. It has its **own** Leaflet map (`#advisor-map`), created lazily on first show.
- `community.js` (`Community`) and `store.js` (`Store`): Community tab with three sub-views (`projects`, `map`, `volunteer`). **All community persistence goes through `Store`'s async methods, and all accounts through `Auth`.** Keep those boundaries so hosted services can replace localStorage without touching UI code. The updates feed is derived from items (`Community.activity(user)`); `Community.allItems` caches items so the avatar badge can be computed synchronously.
- Partner sites come from the Facilities Database (`Data.partnerSites`). Items link to one via `partner_uid/name/kind/address` columns (`supabase/002_partner_sites.sql`). Keep residences (supportive housing) out of the query, and never add homeless shelter locations.
- Proposals: drafts live in localStorage (`gsp-proposals-v1`). `Proposals.saveDraft()` inserts into the Supabase `proposals` table and returns the new uuid. Saved sites are cached in `Proposals.saved` (loaded on login) so reads stay synchronous; updates and deletes write through in the background.
- **Security lives in the database, not the client.** RLS enforces who can read and write; triggers (`stamp_author`) set `user_id`, `organizer_id` and display names from the session. Unique constraints enforce one signature and one sign-up per account, and `Store` maps error code `23505` to a friendly message. Never put a service_role key in the client.
- `plants.js` (`PLANTS`, `Plants.recommend`): curated plant data. Tags: `sun` ∈ full/part/shade; `spaces` ∈ treepit/busstop/lot/rooftop/yard/planter; `goals` ∈ pollinators/food/cooling/stormwater/lowcare.
- Tabs switch with `hidden` on `[data-panel]` elements. When a Leaflet map becomes visible, call `map.invalidateSize()`, or it renders gray.

## Socrata gotchas (learned the hard way)

- **Don't use `within_box` / `within_circle` on polygon columns.** They only match shapes entirely inside the area, which silently drops large parks and tall buildings. Use `intersects(col, 'POLYGON(...)')`: see `withinBox()` and `circleWkt()` in `data.js`. `within_circle` is fine on **point** columns.
- PLUTO `latitude`/`longitude` are text columns. Cast them with `latitude::number between a and b`.
- Census Reporter (`api.censusreporter.org`) rejects a whole batch if any ZIP is unknown. Always drop MODZCTA `99999`. `Data.medianIncome` falls back to small batches. The official Census API now requires a key, so don't switch to it without one.
- The air-quality data isn't keyed by ZIP. It's looked up by community district (`boro_cd`) using a point-in-polygon query.
- Interpolated values go straight into SoQL strings. Only interpolate validated values (5-digit ZIPs, numbers), never free text.

## Conventions

- Escape all data-derived text inserted into HTML with `esc()`.
- Keep estimates labeled as estimates in the UI (sunlight, CO₂, AQI-from-annual-PM2.5), and keep the methods in README.md in sync when a formula changes.
- Wrap every `localStorage` access in try/catch. The app's own key is `gsp-proposals-v1` (draft pins). Supabase manages its own session key.
- Leaflet: set a map's view **before** adding vector layers (otherwise `_clipPoints` throws "reading 'min'"), and call `invalidateSize()` after a map's container becomes visible (tabs, dialogs).
- Colors and design tokens are CSS variables on `:root` in `css/styles.css`. Map layer colors are in `COLORS` in `app.js`.
- Layout must work at phone width (~390 px). The main breakpoint is 820 px.
- Basemaps: use `addBasemaps(map)` in `app.js` (Esri Streets / Light / Satellite, no key) for every Leaflet map. Don't use the OpenStreetMap standard style: it draws every NYC street tree as a green dot, which makes the Street trees layer look stuck on (and OSM's tile policy discourages app use). CARTO tiles need an API key.
- nycgovparks.org returns 403 to curl and scripts. That's bot-blocking, not a dead link.

## Testing

Don't create test accounts with fake emails while "Confirm email" is on: bounced confirmation emails can get the project's email sending restricted.

There's no test suite. Verify changes in a real browser. The locally installed Google Chrome is v68 and too old for this code (it throws syntax errors on `?.` and `??`). For headless checks, use a current `chrome-headless-shell` via `npx @puppeteer/browsers install chrome-headless-shell@stable` with `puppeteer-core`, and check for `pageerror` events.
