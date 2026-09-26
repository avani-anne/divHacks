# NYC Green Space Planner

A web app for deciding where New York City needs more green space, and helping neighbors make it happen.

Enter an NYC ZIP code to see every park, natural area, community garden and street tree in the neighborhood. The app then shows where residents are farthest from a park, suggests what could be built on a specific spot, and lets the community organize around it.

Built for divHacks. All data comes live from [NYC Open Data](https://opendata.cityofnewyork.us/). There is no backend and no API key.

## Features

### 🗺️ Map
- An interactive map with street and satellite views. The chosen ZIP is outlined and everything outside it is dimmed.
- Layers you can switch on or off: parks, natural areas (Forever Wild, the data behind the NYC Nature Map), GreenThumb community gardens, street trees, and **access gaps** (areas more than a 5- or 10-minute walk from a park).
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
- **Propose a green space:** drop pins for candidate sites. Each one shows its impact on park access, and the access figures update live. Proposals can be exported as GeoJSON.

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
- Start or sign **petitions** (with who it's addressed to and a signature goal), or organize **volunteer projects** (with a date and number of volunteers needed).
- A **discussion thread** on every petition and project.
- A **volunteer sign-up** form with interests and availability.
- **Vacant lots in the ZIP** (city-owned first), each with a "Start petition" button.
- Links to official programs: NYC Parks volunteering, GreenThumb, NYC Service and Trees New York.

> **Demo mode:** community data (petitions, signatures, messages, sign-ups) is saved in each visitor's browser only. To make it shared, connect a hosted database in [`js/store.js`](js/store.js). See [Next steps](#next-steps).

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
- **Community data isn't shared** between visitors yet (see demo mode above).

## Project structure

```
index.html          Page layout: landing screen and the three tabs
css/styles.css      All styles
assets/logo.svg     Tree logo
js/data.js          NYC Open Data queries
js/analysis.js      Calculations: area, walk access, AQI, carbon, sunlight (Turf.js)
js/app.js           Map tab, neighborhood profile, proposals, tabs and routing
js/plants.js        Curated NYC plant list and recommender
js/advisor.js       Build Ideas tab
js/store.js         Community data store (localStorage for now)
js/community.js     Community tab
```

Libraries (loaded from CDNs): [Leaflet](https://leafletjs.com/) for maps and [Turf.js](https://turfjs.org/) for geometry. Basemaps are from OpenStreetMap and Esri World Imagery.

## Next steps

- **Shared community data:** replace the method bodies in `js/store.js` with Firebase or Supabase calls. The rest of the app already goes through that interface.
- **Free-text questions in Build Ideas:** a small backend calling the Claude API could answer open-ended questions using the same site data.
- **Newer tree data:** switch tree counts to the live Forestry Tree Points dataset with a spatial query, instead of the 2015 census.
