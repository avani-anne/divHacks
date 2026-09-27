# NYC Green Space Planner
A web app for deciding where New York City needs more green space, and helping neighbors make it happen.

Enter an NYC ZIP code to see every park, natural area, community garden and street tree in the neighborhood. The app then shows where residents are farthest from a park, suggests what could be built on a specific spot, and lets the community organize around it.

Built for divHacks. Map data comes live from [NYC Open Data](https://opendata.cityofnewyork.us/). Accounts, saved sites, petitions and volunteering are stored in [Supabase](https://supabase.com/).

## Features

### 🗺️ Map
- An interactive map with street and satellite views. The chosen ZIP is outlined and everything outside it is dimmed.
- Layers you can switch on or off: parks, natural areas (Forever Wild, the data behind the NYC Nature Map), GreenThumb community gardens, street trees, and **access gaps** (areas more than a 5- or 10-minute walk from a park).
- **Air quality** layer: fine-particle pollution (PM2.5) shaded by community district.
- **Median income** layer: median household income shaded by ZIP, from the Census Bureau's American Community Survey.
- **3D view**: a tilted map with 3D buildings, parks, gardens and proposed sites.
- A **neighborhood profile** for the ZIP:
  - plant species
  - green space (acres and % of the ZIP)
  - street trees
  - estimated CO₂ captured per year
  - air quality index
  - community gardens
  - share of the ZIP within a 5- or 10-minute walk of a park
  - park acres per 1,000 residents, compared with the city's 2.5-acre goal
  - largest parks, most common trees and pollutant levels
- **Propose a green space:** drop pins for candidate sites. Each one shows its impact on park access, and the access figures update live. Press **Save** to keep a site in your account (you'll be asked to log in). Saved sites are listed in the account menu and can be exported as GeoJSON.

### 🌱 Build Ideas
Ask *"I want to [goal] using [kind of space] at [this spot]."* The answer includes:
- **Estimated sunlight** (full sun, part sun or shade), based on the heights of the buildings to the south.
- **Places to build nearby,** from real city data:
  - empty street-tree beds, with how to request a free tree
  - bus shelters, for green "bee bus stop" roofs
  - vacant lots, with size and whether the city owns them
  - existing community gardens
- **Plant suggestions** from a curated list of about 30 plants that are native to or proven in NYC, matched to the light, the space and the goal.
- A **Start a petition** button that carries the site over to the Community tab.

### ✊ Community
- **Petitions & projects:** start a petition (with who it's addressed to and a signature goal) or a volunteer project (with a date and number of volunteers needed), and pin it on a map or use one of your saved sites. Every item has a discussion thread. The section also lists **vacant lots in the ZIP** (city-owned first), each with a "Start petition" button.
- **Where it's growing:** a map of active projects, petitions gathering signatures, active GreenThumb gardens and your saved sites, with filters.
- **Volunteer:** open volunteer opportunities in the ZIP with one-click sign-up, petitions that need signatures, and your **volunteer profile** (ZIP codes you follow, interests, availability, which updates you want). An **updates feed** covers new projects and petitions in followed ZIPs, reminders before projects you joined, new volunteers on your projects, petition milestones and discussion replies. Unread updates show as a badge on your avatar.
- Links to official programs: NYC Parks volunteering, GreenThumb, NYC Service and Trees New York.

### 🔐 Accounts
- Sign up or log in from the top bar. You need an account to save proposed sites, start petitions or projects, sign petitions, volunteer and post in discussions.
- **Each account can sign a petition only once** and join a project only once.

> Accounts and community data are stored in **Supabase** (Postgres + Auth). Access rules in [`supabase/schema.sql`](supabase/schema.sql) are enforced by the database: one signature and one project sign-up per account, names come from the account, saved sites are private, and volunteer contact details are visible only to the organizer.

## Set up Supabase (once)

1. Create a Supabase project.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). It creates the tables, triggers and row-level security policies, and is safe to re-run.
3. Put the project URL and **publishable (anon) key** in [`js/config.js`](js/config.js). Never use the secret or service_role key in the site.
4. Under **Authentication → URL Configuration**, add the site's address (e.g. `http://localhost:8000` and your hosted URL) so confirmation and password-reset links return to the app.
5. Optional: turn off **Confirm email** under Authentication → Sign In / Providers → Email so new accounts can log in immediately. Supabase's built-in email is heavily rate-limited, so set up custom SMTP before relying on confirmation emails.

Google Street View is an optional map view. To enable it, add a Google Maps Platform API key to `GOOGLE_MAPS_API_KEY` in [`js/config.js`](js/config.js), enable Maps JavaScript API for the key, and restrict it to the site's allowed referrers. Google may require billing to be enabled.

## Run it

It's a static site with no build step. Serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Link straight to a ZIP with `http://localhost:8000/#zip=10027`.

## Data sources

| What | NYC Open Data dataset |
| --- | --- |
| ZIP boundaries + population | Modified ZCTA (`pri4-ifjk`) |
| Parks | NYC Parks Properties (`enfh-gkve`) |
| Natural areas | NYC Parks Forever Wild (`48va-85tp`) |
| Community gardens | GreenThumb Garden Info (`p78i-pat6`) |
| Street trees and species | 2015 Street Tree Census (`uvpi-gqnh`) |
| Air quality | Air Quality (`c3uy-2p5r`), per community district (`5crt-au7u`) |
| Empty street-tree beds | Forestry Planting Spaces (`82zj-84is`) |
| Bus shelters | Bus Stop Shelters (`t4f2-8md7`) |
| Vacant lots | PLUTO (`64uk-42ks`), land use 11 |
| Building heights | Building footprints (`5zhs-2jue`) |
| Median household income | Census ACS 5-year, table B19013, by ZIP, via the [Census Reporter API](https://censusreporter.org/) (no key needed) |
| 3D buildings and basemap | [OpenFreeMap](https://openfreemap.org/) vector tiles (no key needed) |

## How the numbers are calculated

| Metric | Method |
| --- | --- |
| Green space | Park land clipped to the ZIP boundary. |
| Park access | The ZIP is sampled on a grid, and each point's distance to the nearest usable park is measured. Medians, parkways and cemeteries don't count. A 5-minute walk is 400 m and a 10-minute walk is 800 m. |
| CO₂ captured | 48 lb of CO₂ per street tree per year, a widely cited USDA Forest Service / Arbor Day figure. Park trees aren't included. |
| Air quality index | The EPA AQI formula applied to the district's latest annual mean PM2.5. It describes typical air, not a daily reading. |
| Sunlight | The building to the south that rises highest above the horizon, compared with NYC's growing-season sun angle. Full sun means under 30°, part sun 30–55°, and shade above 55°. It ignores trees and awnings. |

## Known limitations

- **Tree data is from 2015.** It's the only tree dataset recorded by ZIP code, and it covers street trees only.
- **Air quality is by community district,** not by ZIP code.
- **Sunlight and carbon figures are estimates,** and the site labels them that way.
- **Updates appear in the app only.** Email or text alerts would need a scheduled server function.
- **Air quality is reported for community districts,** and income for ZIP codes, so both are coarse.

## Project structure

```
supabase/schema.sql Database tables, triggers and access rules
index.html          Page layout: landing screen and the three tabs
css/styles.css      All styles
assets/logo.svg     Tree logo
js/data.js          NYC Open Data queries
js/analysis.js      Calculations: area, walk access, AQI, carbon, sunlight (Turf.js)
js/app.js           Map tab, neighborhood profile, overlays, proposals, tabs and routing
js/map3d.js         3D view (MapLibre GL, loaded on demand)
js/streetview.js    Optional Google Street View panorama (loaded on demand)
js/plants.js        Curated NYC plant list and recommender
js/advisor.js       Build Ideas tab
js/config.js        Supabase URL and publishable key
js/store.js         Community data store (Supabase)
js/auth.js          Accounts, login dialog and account menu (Supabase Auth)
js/community.js     Community tab: petitions, growing map, volunteering and updates
js/main.js          Startup
```

Libraries (loaded from CDNs): [Leaflet](https://leafletjs.com/) for 2D maps, [MapLibre GL](https://maplibre.org/) for the 3D view, and [Turf.js](https://turfjs.org/) for geometry. Basemaps are from OpenStreetMap, OpenFreeMap and Esri World Imagery.

## Next steps

- **Live updates:** subscribe to Supabase Realtime on `messages` and `signatures` so discussions update without a refresh.
- **Email updates:** send the updates-feed events as email digests from a scheduled Supabase Edge Function.
- **Free-text questions in Build Ideas:** a small backend calling the Claude API could answer open-ended questions using the same site data.
- **Newer tree data:** switch tree counts to the live Forestry Tree Points dataset with a spatial query, instead of the 2015 census.
