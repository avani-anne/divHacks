# 🍁 Greenify NYC

**A green space planner for New York City.** Pick a neighborhood to see its parks, trees, gardens, air quality and income, find the places that are farthest from green space, get ideas for greening a specific spot, and organize neighbors, schools and community partners to build it.

**Live site:** https://greenify-nyc.vercel.app · Built for divHacks

- **Map data** comes live from [NYC Open Data](https://opendata.cityofnewyork.us/) and other open sources. There's no server of our own.
- **Accounts, saved sites, petitions and volunteering** are stored in [Supabase](https://supabase.com/).

---

## At a glance

| Tab | What it's for | Main data |
| --- | --- | --- |
| **🗺️ Map** | Understand a neighborhood's green space and find the gaps | NYC Parks, Forever Wild (Nature Map), GreenThumb, 2015 Street Tree Census, Air Quality, Census income |
| **🌱 Build Ideas** | Ask how to green one specific spot | Forestry Planting Spaces, Bus Stop Shelters, PLUTO vacant lots, building heights, KartaView street photos |
| **✊ Community** | Organize: petitions, projects, partners, volunteers | Supabase (user data), Facilities Database (partner sites), PLUTO, GreenThumb |

---

## 🏠 Landing page

- The **Greenify logo** (a maple leaf with "greenify" in script across it) and a ZIP code search box.
- Example ZIP buttons to try: Harlem, Williamsburg, South Bronx, Forest Hills, St. George.
- The top bar has the smiling-leaf mascot, the three tabs, a ZIP box and the **Log in** button.

## 🗺️ Map tab

**What you can do**
- **Pick a neighborhood** in any of these ways:
  - type a ZIP (top bar, or **Change ZIP** in the sidebar)
  - **click an area outside the current ZIP** to load that ZIP
  - **double-click** to clear the selection and just explore the map, then click anywhere to load a ZIP
  - link straight to one, e.g. `/#zip=10027`
- **Background maps:** Streets, Light (gray) or Satellite.
- **Layers** to switch on or off:
  - **Parks** and **natural areas** (the protected "Forever Wild" areas behind the NYC Nature Map)
  - **Community gardens** and **street trees**
  - **Access gaps:** the parts of the ZIP more than a 5- or 10-minute walk from a usable park
  - **Air quality:** fine-particle pollution (PM2.5) by community district
  - **Median income:** household income by ZIP
  - **3D view:** tilted 3D buildings with parks, gardens and your sites.
- **Map | 3D | Street View** switch on the map. **Street View** opens Google Street View at the map's center, so you can walk the streets like in Google Maps. It needs a Google Maps API key in `js/config.js` (see below).
- **Neighborhood profile** in the sidebar:
  - plant (street-tree) species, street trees, and estimated CO₂ captured per year
  - green space in acres and as a share of the ZIP
  - air quality index, and PM2.5, NO₂ and ozone readings
  - number of community gardens
  - share of the ZIP within a 5- and 10-minute walk of a park
  - park acres per 1,000 residents, against the city's 2.5-acre goal
  - largest parks, most common trees, and median household income
- **Propose a green space:** drop pins on candidate sites. Each pin shows:
  - its access impact ("fills a gap" or not) and the nearest park
  - a **See it in Street View** link

  The walk-access figures update to include your pins. Press **Save** to keep a site in your account; saved sites appear in the account menu and can be exported as GeoJSON.

**Datasets used**

| Feature | Source |
| --- | --- |
| ZIP boundaries, population, click-to-find-ZIP | NYC Modified ZIP Code Tabulation Areas, `pri4-ifjk` |
| Parks | NYC Parks Properties, `enfh-gkve` |
| Natural areas | NYC Parks Forever Wild, `48va-85tp` (the NYC Nature Map's natural-areas data) |
| Community gardens | GreenThumb Garden Info, `p78i-pat6` |
| Street trees, species, CO₂ estimate | 2015 Street Tree Census, `uvpi-gqnh` |
| Air quality | NYC Air Quality, `c3uy-2p5r`, joined to Community Districts, `5crt-au7u` |
| Median household income | Census ACS 5-year (2020–2024), table B19013, via the [Census Reporter API](https://censusreporter.org/) |
| Background maps | Esri World Street Map, Light Gray Canvas and World Imagery |
| 3D buildings | [OpenFreeMap](https://openfreemap.org/) vector tiles, drawn with MapLibre GL |

## 🌱 Build Ideas tab

**What you can do**
- **Ask a question:** "I want to *[attract bees and butterflies / grow food / cool the block / soak up stormwater / keep it low-maintenance]* using *[whatever fits best / a street tree bed / a bus stop / a vacant lot / a rooftop / a yard or schoolyard / a planter]* at *[the pinned spot]*." Pick the spot by clicking the map (in 2D or 3D) or with **Use my location**.
- **Get an answer:**
  - **Estimated sunlight** (full sun, part sun or shade), worked out from the heights of buildings to the south, plus the distance to the nearest park.
  - **Street-level photos** of the spot, with date, distance and camera direction. Click one to enlarge it and see where it was taken. There's also an **Open in Google Street View** button.
  - **Places to build nearby**, with step-by-step how-tos and links:
    - empty street-tree beds (request a free street tree)
    - bus shelters (a green "bee bus stop" roof)
    - vacant lots, with size and whether the city owns them
    - nearby community gardens
    - rooftops, rain gardens and planters
  - **Plant picks** from a curated list of about 30 plants that are native to or proven in NYC, matched to the light, the space and the goal.
  - **Start a petition** for a lot or bus stop, which carries the details over to the Community tab.
- **Map key** in the corner explains each marker color, and the **🏙️ 3D view** button shows everything among 3D buildings.

**Datasets used**

| Feature | Source |
| --- | --- |
| Empty street-tree beds | NYC Parks Forestry Planting Spaces, `82zj-84is` |
| Nearest address | Forestry Planting Spaces, `82zj-84is` |
| Bus shelters | NYC DOT Bus Stop Shelters, `t4f2-8md7` |
| Vacant lots, lot size, owner | PLUTO tax lots, `64uk-42ks` (lots with land use "vacant land") |
| Sunlight estimate | Building footprints with roof heights, `5zhs-2jue` |
| Community gardens, nearest park | GreenThumb, `p78i-pat6`; NYC Parks Properties, `enfh-gkve` |
| Street-level photos | [KartaView](https://kartaview.org) (open, CC BY-SA 4.0), plus links to Google Street View |
| Plants | Curated list in `js/plants.js` |

## ✊ Community tab

Four sections. You can browse everything without an account; starting, signing, joining and posting require logging in.

1. **Petitions & projects**
   - Start a **petition**, with who it's addressed to and a signature goal, or a **volunteer project**, with a date and number of volunteers needed.
   - Pin it on a map, or use one of your saved sites.
   - Every item has a **discussion thread**.
   - **Each account can sign a petition once and join a project once.**
   - Also lists **vacant lots in the ZIP** (city-owned first), each with a "Start petition" button.
2. **Where it's growing:** a map of active projects, petitions gathering signatures, active community gardens, partner sites and your saved sites, with filters and a 3D view.
3. **Partner sites:** schools, senior centers, nursing homes, homeless-services sites (drop-in centers and Homebase offices) and food pantries in the ZIP. Each card:
   - suggests a fitting green space: a schoolyard garden, an accessible sensory garden, shaded seating or a donation garden
   - has **Propose a green space here**, which starts a project pinned at the site and tagged with the partner
   - has **Tag my project**, to link one of your existing projects
   - has **Find contact** to look the site up
4. **Volunteer**
   - Open volunteer opportunities in the ZIP, with one-click sign-up.
   - Petitions that need signatures.
   - Your **volunteer profile**: ZIP codes you follow, interests, availability, and which updates you want.
   - An **updates feed** (also under 🔔 in the account menu): new projects and petitions in followed ZIPs, reminders before projects you joined, new volunteers on your projects, petition milestones and discussion replies.
   - Links to official programs: NYC Parks volunteering, GreenThumb, NYC Service and Trees New York.

**Datasets used**

| Feature | Source |
| --- | --- |
| Petitions, projects, signatures, volunteers, messages, profiles, saved sites | Supabase database (see `supabase/`) |
| Partner sites | NYC City Planning Facilities Database, `ji82-xba5` |
| Vacant lots | PLUTO, `64uk-42ks` |
| Active community gardens | GreenThumb, `p78i-pat6` |

**Privacy:** supportive-housing residences are left out of partner sites, and the city doesn't publish homeless shelter addresses, so they aren't shown. Volunteers' contact details are visible only to the project organizer.

## 🔐 Accounts

- **Sign up and log in** from the top bar, with **Forgot password?** reset by email, powered by Supabase Auth.
- **You need an account to:** save proposed sites (they're private to you), start petitions and projects, sign, volunteer and post.
- **The database enforces the rules itself,** so they hold even if someone bypasses the site:
  - one signature and one sign-up per account
  - names on posts come from the account and can't be faked
  - saved sites are private
  - volunteer contact details are visible only to the organizer

---

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
- **Coarse areas:** air quality is reported by community district and income by ZIP code.
- **Estimates:** sunlight and carbon figures are estimates, and the site labels them that way.
- **Street photos** come from volunteers and may be several years old.
- **Vacant-lot data can lag reality:** some lots may now be parking or construction.
- **Updates appear in the app only.** Email or text alerts would need a scheduled server function.

---

## Run it locally

It's a static site with no build step:

```sh
python3 -m http.server 8765
# open http://localhost:8765
```

## Set up Supabase (once)

1. Create a Supabase project.
2. In the **SQL Editor**, paste and run the contents of [`supabase/schema.sql`](supabase/schema.sql). It creates the tables, triggers and access rules, and is safe to re-run. For projects created before partner sites were added, also run [`supabase/002_partner_sites.sql`](supabase/002_partner_sites.sql).
3. Put the project URL and **publishable key** in [`js/config.js`](js/config.js). Never use the secret or service_role key in the site.
4. Under **Authentication → URL Configuration**:
   - set **Site URL** to the live address
   - add every address the site runs on to **Redirect URLs**, e.g. `https://greenify-nyc.vercel.app/**` and `http://localhost:8765/**`
5. Optional: turn off **Confirm email** so new accounts can log in straight away. Supabase's built-in email is heavily rate-limited, so set up your own email provider (SMTP) before relying on confirmation emails.

## Set up Street View (optional)

1. In the [Google Cloud console](https://console.cloud.google.com/), enable the **Maps JavaScript API** and create an API key. A billing account is required, though there's a free monthly allowance.
2. **Restrict the key** to your site's addresses (HTTP referrers such as `https://greenify-nyc.vercel.app/*` and `http://localhost:8765/*`) and to the Maps JavaScript API only.
3. Put it in `GOOGLE_MAPS_API_KEY` in [`js/config.js`](js/config.js). Without a key, the Street View button explains that it isn't set up yet.

## Deploy

The site is deployed on **Vercel** from this GitHub repo, with no build command and the output in the repo root. Every push to `main` redeploys. It also works on any static host, such as GitHub Pages or Netlify.

## Project structure

```
index.html              Page layout: landing page, three tabs, dialogs
css/styles.css          All styles
assets/leaf-mascot.svg  Smiling maple-leaf mascot (top bar and favicon)
js/config.js            Supabase URL and publishable key
js/data.js              All data queries (NYC Open Data, Census Reporter, KartaView)
js/analysis.js          Calculations: area, walk access, AQI, carbon, sunlight (Turf.js)
js/app.js               Map tab: profile, layers, click-to-select ZIPs, proposals, tabs, routing
js/map3d.js             Reusable 3D view (MapLibre GL, loaded on demand)
js/streetview.js        Google Street View for the Map tab (needs an API key)
js/plants.js            Curated NYC plant list and recommender
js/advisor.js           Build Ideas tab, street photos
js/store.js             Community data store (Supabase)
js/auth.js              Accounts, login dialog, account menu (Supabase Auth)
js/community.js         Community tab: petitions, growing map, partner sites, volunteering
js/main.js              Startup
supabase/schema.sql     Database tables, triggers and access rules
supabase/002_partner_sites.sql  Migration adding partner-site fields
```

Libraries (loaded from CDNs): [Leaflet](https://leafletjs.com/) for 2D maps, [MapLibre GL](https://maplibre.org/) for 3D, [Turf.js](https://turfjs.org/) for geometry, and [supabase-js](https://supabase.com/docs/reference/javascript) for accounts and data. Fonts: DM Sans, Fraunces and Dancing Script (Google Fonts).

## Next steps

- **Organization accounts,** so schools, senior centers and shelters can post their own volunteer needs.
- **Live updates** through Supabase Realtime, so discussions and signatures update without a refresh.
- **Email digests** of the updates feed, from a scheduled Supabase Edge Function.
- **Free-text questions in Build Ideas,** answered with the Claude API using the same site data.
- **Newer tree data** from the live Forestry Tree Points dataset instead of the 2015 census.
