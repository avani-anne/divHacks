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

## Deploy

The site is deployed on **Vercel** from this GitHub repo, with no build command and the output in the repo root. Every push to `main` redeploys. It also works on any static host, such as GitHub Pages or Netlify.

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

Libraries (loaded from CDNs): [Leaflet](https://leafletjs.com/) for 2D maps, [MapLibre GL](https://maplibre.org/) for 3D, [Turf.js](https://turfjs.org/) for geometry, and [supabase-js](https://supabase.com/docs/reference/javascript) for accounts and data. Fonts: DM Sans, Fraunces and Dancing Script (Google Fonts).

## Next steps

- **Organization accounts,** so schools, senior centers and shelters can post their own volunteer needs.
- **Live updates** through Supabase Realtime, so discussions and signatures update without a refresh.
- **Email digests** of the updates feed, from a scheduled Supabase Edge Function.
- **Free-text questions in Build Ideas,** answered with the Claude API using the same site data.
- **Newer tree data** from the live Forestry Tree Points dataset instead of the 2015 census.
