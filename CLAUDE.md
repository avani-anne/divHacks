# CLAUDE.md

NYC Green Space Planner is a static web app (HTML, CSS and vanilla JS) that maps NYC green space by ZIP code. It has three tabs: **Map** (neighborhood profile + site proposals), **Build Ideas** (site advisor + plant picks) and **Community** (petitions, projects, volunteer sign-up). See README.md for the feature list.

## Running

- No build step and no package.json. Serve the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/#zip=10027`.
- All data is fetched at runtime from NYC Open Data (Socrata SODA API, `https://data.cityofnewyork.us/resource/<id>.json`). Every dataset used sends `Access-Control-Allow-Origin: *`, so no proxy is needed.
- Good test ZIPs: 10027 (Harlem, dense), 10451 (South Bronx), 11375 (Forest Hills, borders big parks), 10314 (Staten Island, large), 10200 (invalid, exercises the error path).

## Architecture

- Plain `<script>` tags, no modules. Load order in `index.html` matters:
  `data.js → analysis.js → plants.js → store.js → app.js → advisor.js → community.js`.
  Top-level `const`s and functions are shared globals across files (e.g. `$`, `esc`, `fmt`, `state`, `COLORS`, `WALK_5_MIN`, `SQM_PER_ACRE`, `titleCase`, `showTab`).
- `data.js` (`Data`): every network call. Keep queries here, not in UI code.
- `analysis.js` (`Analysis`): pure geometry and metric calculations using the global `turf`.
- `app.js`: global `state`, the Leaflet map for the Map tab, the profile, the proposal tool, hash routing (`#zip=NNNNN`) and `showTab()`.
- `advisor.js` (`Advisor`): Build Ideas tab. It has its **own** Leaflet map (`#advisor-map`), created lazily on first show.
- `community.js` (`Community`) and `store.js` (`Store`): Community tab. **All community persistence goes through `Store`'s async methods.** Keep that boundary so a hosted database can replace localStorage without touching UI code.
- `plants.js` (`PLANTS`, `Plants.recommend`): curated plant data. Tags: `sun` ∈ full/part/shade; `spaces` ∈ treepit/busstop/lot/rooftop/yard/planter; `goals` ∈ pollinators/food/cooling/stormwater/lowcare.
- Tabs switch with `hidden` on `[data-panel]` elements. When a Leaflet map becomes visible, call `map.invalidateSize()`, or it renders gray.

## Socrata gotchas (learned the hard way)

- **Don't use `within_box` / `within_circle` on polygon columns.** They only match shapes entirely inside the area, which silently drops large parks and tall buildings. Use `intersects(col, 'POLYGON(...)')`: see `withinBox()` and `circleWkt()` in `data.js`. `within_circle` is fine on **point** columns.
- PLUTO `latitude`/`longitude` are text columns. Cast them with `latitude::number between a and b`.
- The air-quality data isn't keyed by ZIP. It's looked up by community district (`boro_cd`) using a point-in-polygon query.
- Interpolated values go straight into SoQL strings. Only interpolate validated values (5-digit ZIPs, numbers), never free text.

## Conventions

- Escape all data-derived text inserted into HTML with `esc()`.
- Keep estimates labeled as estimates in the UI (sunlight, CO₂, AQI-from-annual-PM2.5), and keep the methods in README.md in sync when a formula changes.
- Wrap every `localStorage` access in try/catch. Keys: `gsp-proposals-v1`, `gsp-community-v1`, `gsp-my-name`.
- Colors and design tokens are CSS variables on `:root` in `css/styles.css`. Map layer colors are in `COLORS` in `app.js`.
- Layout must work at phone width (~390 px). The main breakpoint is 820 px.
- Basemap tiles: OpenStreetMap (`tile.openstreetmap.org`) and Esri World Imagery. CARTO tiles now need an API key, so don't switch back to them.
- nycgovparks.org returns 403 to curl and scripts. That's bot-blocking, not a dead link.

## Testing

There's no test suite. Verify changes in a real browser. The locally installed Google Chrome is v68 and too old for this code (it throws syntax errors on `?.` and `??`). For headless checks, use a current `chrome-headless-shell` via `npx @puppeteer/browsers install chrome-headless-shell@stable` with `puppeteer-core`, and check for `pageerror` events.
