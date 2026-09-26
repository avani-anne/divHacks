# NYC Green Space Planner

Enter an NYC ZIP code to see its parks, natural areas, community gardens and street trees on an interactive map, along with a neighborhood profile: plant species, green area, tree count, estimated CO₂ captured, air quality and walk access to parks. Planners can drop proposed green-space sites and see how each one changes park access.

## Run it

It's a static site with no build step. Serve the folder with any web server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Link straight to a ZIP with `http://localhost:8000/#zip=10027`.

## Data (live from NYC Open Data)

| What | Dataset |
| --- | --- |
| ZIP boundaries + population | Modified ZCTA (`pri4-ifjk`) |
| Parks | NYC Parks Properties (`enfh-gkve`) |
| Natural areas | NYC Parks Forever Wild (`48va-85tp`), the data behind the NYC Nature Map |
| Community gardens | GreenThumb Garden Info (`p78i-pat6`) |
| Street trees / species | 2015 Street Tree Census (`uvpi-gqnh`) |
| Air quality | Air Quality (`c3uy-2p5r`), per community district (`5crt-au7u`) |

## How metrics are calculated

- **Green space**: park land clipped to the ZIP boundary.
- **Park access**: the ZIP is sampled on a grid, and each point's distance to the nearest usable park is measured (medians, parkways and cemeteries are excluded). A 5-minute walk is 400 m and a 10-minute walk is 800 m.
- **CO₂ captured**: an estimate of 48 lb CO₂ per street tree per year (USDA Forest Service / Arbor Day figure).
- **Air quality index**: the EPA AQI formula applied to the district's latest annual mean PM2.5.
- **Proposed sites**: saved in the browser's localStorage. Use the export button to download them as GeoJSON.

## Code

- `js/data.js`: NYC Open Data queries
- `js/analysis.js`: area, walk access, AQI and carbon calculations (Turf.js)
- `js/app.js`: map (Leaflet), neighborhood profile and proposal tool
Git 
