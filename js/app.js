// UI: landing page, map, neighborhood profile and the site-proposal tool.

const $ = sel => document.querySelector(sel);
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = n => `${Math.round(n * 100)}%`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const COLORS = {
  park: '#3f9b4f',
  natural: '#1b5e3b',
  garden: '#e0892b',
  tree: '#2f7d3a',
  gap5: '#f2c14e',
  gap10: '#d9534f',
  proposal: '#7b4fd6',
};

// Choropleth scales for the overlay layers.
const AIR_SCALE = {
  breaks: [6, 6.5, 7, 8],
  colors: ['#fef0d9', '#fdcc8a', '#fc8d59', '#e34a33', '#b30000'],
  labels: ['< 6', '6–6.5', '6.5–7', '7–8', '8+'],
};
// EPA AQI colors (softened slightly for the map).
const AQI_SCALE = {
  breaks: [51, 101, 151, 201, 301],
  colors: ['#3fbf5f', '#f2d635', '#f28c28', '#e0413a', '#8f3f97', '#7e0023'],
  labels: ['0–50 Good', '51–100 Moderate', '101–150 Sensitive', '151–200 Unhealthy', '201–300 Very unhealthy', '301+ Hazardous'],
};
const INCOME_SCALE = {
  breaks: [40000, 60000, 90000, 130000],
  colors: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  labels: ['< $40k', '$40–60k', '$60–90k', '$90–130k', '$130k+'],
};
const scaleColor = (scale, v) => (v == null ? '#d9d9d9' : scale.colors[scale.breaks.filter(b => v >= b).length]);
const money = n => `$${fmt(n)}`;

const PROPOSAL_TYPES = ['Pocket park', 'Community garden', 'Street tree planting', 'Greenway / green street', 'Playground', 'Green roof', 'Rain garden / bioswale'];
const STORAGE_KEY = 'gsp-proposals-v1';
const EXPLORE_PARKS = [
  { name: 'Fort Tryon Park', borough: 'Manhattan', route: 'Heather Garden and Linden Terrace', terrain: ['paved', 'unpaved'], experiences: ['views', 'historic'], known: 'Clifftop gardens, sweeping Hudson River views, and the medieval Met Cloisters.', facilities: 'Heather Garden, public restrooms, benches, and the Met Cloisters nearby.', expect: 'Hilly paths and stone steps; the garden is especially vivid in spring.', prep: 'Comfortable walking shoes for steep paths and stairs.', spots: 'The Met Cloisters, Heather Garden, and the New Leaf Cafe.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/9800.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-9800/', photoCredit: 'NYC Parks', imageAlt: 'Heather Gardens at Fort Tryon Park', tags: ['Clifftop views', 'Gardens', 'Architecture'] },
  { name: 'Inwood Hill Park', borough: 'Manhattan', route: 'Water-Edge Inlet Loop', terrain: ['unpaved', 'steep'], experiences: ['woods', 'wildlife'], known: 'Manhattan’s last natural forest, salt marshes, and a tucked-away tidal inlet.', facilities: 'Nature Center, ball fields, kayak launch, and marked woodland trails.', expect: 'Roots, mud, and changing trail conditions around the inlet and forest.', prep: 'Tick repellent, water, and shoes with reliable grip.', spots: 'Inwood Hill Nature Center and the Dyckman Farmhouse Museum.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/9727.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-9727/', photoCredit: 'NYC Parks', imageAlt: 'A view toward the bridge at Inwood Hill Park', tags: ['Old-growth forest', 'Tidal inlet', 'Wildlife'] },
  { name: 'Highbridge Park', borough: 'Manhattan', route: 'High Bridge and Water Tower', terrain: ['paved', 'steep'], experiences: ['views', 'historic'], known: 'The High Bridge, New York City’s oldest surviving bridge, above the Harlem River.', facilities: 'High Bridge, Highbridge Water Tower, playgrounds, and recreation areas.', expect: 'A steep climb connects the park’s upper paths to the river-level bridge.', prep: 'Walking shoes and a little extra time for the hill.', spots: 'High Bridge, the Water Tower, and nearby Highbridge Recreation Center.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/25656.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-25656/', photoCredit: 'NYC Parks', imageAlt: 'Highbridge Park in Manhattan', tags: ['Historic bridge', 'River views', 'Architecture'] },
  { name: 'Prospect Park', borough: 'Brooklyn', route: 'Main Loop and Long Meadow', terrain: ['paved', 'unpaved'], experiences: ['woods', 'wildlife', 'views'], known: 'A long open meadow framed by woodland, waterways, and classic park scenery.', facilities: 'Audubon Center, boathouse, public restrooms, picnic areas, and paved loop.', expect: 'The full loop is long; paths are busy around major entrances on weekends.', prep: 'Bring water and plan a route before heading into the larger park.', spots: 'Prospect Park Zoo, LeFrak Center at Lakeside, and the Boathouse.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/25062.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-25062/', photoCredit: 'NYC Parks', imageAlt: 'Prospect Park in Brooklyn', tags: ['Long Meadow', 'Woodland', 'Lake'] },
  { name: 'Marine Park', borough: 'Brooklyn', route: 'Gerritsen Creek Nature Trail', terrain: ['unpaved'], experiences: ['beach', 'wildlife', 'woods'], known: 'Salt marsh, tidal creek, and wide-open grassland on Brooklyn’s southern shore.', facilities: 'Salt Marsh Nature Center, nature trails, ball fields, and picnic areas.', expect: 'Exposed boardwalk and meadow sections with little shade; check tide and weather.', prep: 'Sun protection, water, and insect repellent in warm months.', spots: 'Salt Marsh Nature Center and the Gerritsen Creek shoreline.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/27389.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-27389/', photoCredit: 'NYC Parks', imageAlt: 'Salt marsh viewed from the Marine Park Nature Center', tags: ['Salt marsh', 'Birding', 'Tidal creek'] },
  { name: 'Shirley Chisholm State Park', borough: 'Brooklyn', route: 'Peninsula trails and overlook', terrain: ['paved', 'unpaved'], experiences: ['views', 'wildlife'], known: 'Rolling hills built on a former landfill, with big harbor and skyline views.', facilities: 'Fishing piers, bike paths, picnic areas, kayak launch, and visitor center.', expect: 'Long, exposed paths across open hills with limited shade.', prep: 'Water, sun protection, and comfortable shoes for a long walk.', spots: 'Harbor overlooks, fishing piers, and the park’s visitor center.', image: 'https://parks.ny.gov/sites/default/files/styles/1x1_450/public/2025-10/Shirley%20Chisholm-Drone-060225-6.jpg.webp?h=3e8da8cb&itok=NOXJXacw', photoSource: 'https://parks.ny.gov/visit/state-parks/shirley-chisholm-state-park', photoCredit: 'New York State Parks', imageAlt: 'Aerial view of Shirley Chisholm State Park beside the water', tags: ['Harbor views', 'Fishing', 'Open hills'] },
  { name: 'Flushing Meadows Corona Park', borough: 'Queens', route: 'World’s Fair grounds and Meadow Lake', terrain: ['paved'], experiences: ['views', 'historic', 'wildlife'], known: 'The Unisphere, World’s Fair landmarks, and broad lakeside paths.', facilities: 'Queens Museum, New York Hall of Science, boating, sports fields, and restrooms.', expect: 'A large, mostly level park with long distances between landmarks.', prep: 'Comfortable shoes and a transit or park map to plan your route.', spots: 'Queens Museum, New York Hall of Science, and the Unisphere.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/25085.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-25085/', photoCredit: 'NYC Parks', imageAlt: 'Flushing Meadows Corona Park in Queens', tags: ['World’s Fair', 'Unisphere', 'Meadow Lake'] },
  { name: 'Alley Pond Park', borough: 'Queens', route: 'Environmental Center trails', terrain: ['unpaved', 'steep'], experiences: ['woods', 'wildlife'], known: 'Glacial kettle ponds, dense forest, and a quiet network of natural trails.', facilities: 'Alley Pond Environmental Center, nature trails, playgrounds, and picnic areas.', expect: 'Uneven, sometimes muddy trails; trail markings can be easy to miss.', prep: 'Tick repellent, water, and sturdy shoes; check trail conditions after rain.', spots: 'Alley Pond Environmental Center and the Queens Giant tulip tree.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/24913.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-24913/', photoCredit: 'NYC Parks', imageAlt: 'Alley Pond Park in Queens', tags: ['Forest trails', 'Glacial ponds', 'Queens Giant'] },
  { name: 'Forest Park', borough: 'Queens', route: 'Yellow-Blazed Trail', terrain: ['unpaved', 'steep'], experiences: ['woods', 'wildlife'], known: 'A deep woodland ridge with a marked trail through one of the city’s largest forests.', facilities: 'Nature trails, bridle paths, golf course, carousel, and picnic areas.', expect: 'Rooted, hilly trail sections and limited facilities inside the woods.', prep: 'Tick repellent, a trail map, and sturdy hiking shoes.', spots: 'Forest Park Carousel, the bandshell, and the park’s nature trails.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/27509.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-27509/', photoCredit: 'NYC Parks', imageAlt: 'Forest Park in Queens', tags: ['Woodland ridge', 'Yellow trail', 'Birding'] },
  { name: 'Ferry Point Park', borough: 'Bronx', route: 'East River waterfront paths', terrain: ['paved'], experiences: ['views', 'wildlife'], known: 'Open waterfront grassland and broad views of the Whitestone and Throgs Neck bridges.', facilities: 'Golf course, soccer fields, playground, and waterfront paths.', expect: 'Open, breezy paths with little shade and long stretches between facilities.', prep: 'Sun and wind protection, water, and comfortable walking shoes.', spots: 'The waterfront promenade and Ferry Point Park Golf Course.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/10494.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-10494/', photoCredit: 'NYC Parks · Malcolm Pinckney · archival (2008)', imageAlt: 'An archival view of the future Ferry Point Park golf course site', tags: ['Bridge views', 'Waterfront', 'Open meadow'] },
  { name: 'Van Cortlandt Park', borough: 'Bronx', route: 'The Putnam Trail', terrain: ['paved', 'unpaved'], experiences: ['woods', 'historic', 'wildlife'], known: 'A former railroad corridor through wetlands, forest, and the city’s third-largest park.', facilities: 'Van Cortlandt House Museum, golf, riding stables, and sports fields.', expect: 'Mostly gentle grades with natural-surface sections that can be muddy.', prep: 'Water and shoes suited to dirt or gravel after rain.', spots: 'Van Cortlandt House Museum, the Nature Center, and the lake.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/27234.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-27234/', photoCredit: 'NYC Parks', imageAlt: 'Walkers in Van Cortlandt Park on a fall day', tags: ['Rail trail', 'Wetlands', 'Historic house'] },
  { name: 'Pelham Bay Park', borough: 'Bronx', route: 'Kazimiroff Nature Trail on Hunter Island', terrain: ['unpaved', 'steep'], experiences: ['beach', 'woods', 'wildlife', 'historic'], known: 'A wooded peninsula with rocky shoreline, salt marsh, and traces of the old Hunter mansion.', facilities: 'Orchard Beach, Bartow-Pell Mansion Museum, picnic areas, and nature trails.', expect: 'Rocky, uneven trail segments near the shore; the park is very large.', prep: 'Sturdy shoes, water, and tick repellent for wooded paths.', spots: 'Orchard Beach and Bartow-Pell Mansion Museum.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/9864.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-9864/', photoCredit: 'NYC Parks', imageAlt: 'Pelham Bay Park in the Bronx', tags: ['Island forest', 'Rocky shore', 'Historic ruins'] },
  { name: 'Silver Lake Park', borough: 'Staten Island', route: 'Silver Lake Reservoir paths', terrain: ['paved'], experiences: ['views', 'wildlife'], known: 'A reservoir-side retreat with mature trees, a lake, and open views across the water.', facilities: 'Paved walking paths, golf course, playground, and fishing areas.', expect: 'A calm, mostly level loop shared with local walkers and runners.', prep: 'Comfortable walking shoes; observe posted fishing and reservoir rules.', spots: 'The reservoir overlook and Silver Lake Golf Course.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/19929.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-19929/', photoCredit: 'NYC Parks', imageAlt: 'Looking out on Silver Lake in Staten Island', tags: ['Reservoir', 'Lake loop', 'Birding'] },
  { name: 'Conference House Park', borough: 'Staten Island', route: 'Blue Loop and shoreline', terrain: ['unpaved', 'steep'], experiences: ['beach', 'views', 'historic'], known: 'A historic shoreline at the island’s southern tip, where the 1776 peace conference took place.', facilities: 'Conference House Museum, marked trails, beach access, and picnic areas.', expect: 'Quiet, exposed shoreline paths with muddy or uneven sections after rain.', prep: 'Sturdy shoes, wind protection, and check museum hours before visiting.', spots: 'Conference House Museum and the southern shoreline overlook.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/10160.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-10160/', photoCredit: 'NYC Parks', imageAlt: 'The Conference House in September', tags: ['Colonial history', 'Shoreline', 'Blue Loop'] },
  { name: 'Staten Island Greenbelt', borough: 'Staten Island', route: 'Yellow Trail', terrain: ['unpaved', 'steep'], experiences: ['woods', 'wildlife'], known: 'A connected woodland network with wetlands, quiet ravines, and deep forest canopy.', facilities: 'Greenbelt Nature Center, trailheads, visitor programs, and restrooms at select sites.', expect: 'Natural trails with roots, hills, and limited cell service in some sections.', prep: 'Tick repellent, water, sturdy hiking shoes, and an offline trail map.', spots: 'Greenbelt Nature Center and the High Rock Park ponds.', image: 'https://www.nycgovparks.org/photo_gallery/full_size/25030.jpg', photoSource: 'https://www.nycgovparks.org/photo/photo-25030/', photoCredit: 'NYC Parks', imageAlt: 'Blood Root Valley, part of the Staten Island Greenbelt', tags: ['Forest network', 'Wetlands', 'Yellow Trail'] },
];
const NEARBY_SPOTS = {
  'Fort Tryon Park': [
    { type: 'Food', name: 'The Bonnefont', detail: 'Park café in Fort Tryon’s former concession building; check its current service days.' },
    { type: 'Culture', name: 'The Met Cloisters', detail: 'Medieval art and architecture museum inside the park.' },
  ],
  'Inwood Hill Park': [
    { type: 'Food', name: 'Indian Road Cafe', detail: 'Neighborhood café near the park’s north end.' },
    { type: 'Culture', name: 'Dyckman Farmhouse Museum', detail: 'An 18th-century farmhouse museum in Inwood.' },
  ],
  'Highbridge Park': [
    { type: 'Food', name: 'Malecon', detail: 'Long-running Dominican restaurant near 175th Street.' },
    { type: 'Culture', name: 'The High Bridge', detail: 'Historic aqueduct bridge above the Harlem River.' },
  ],
  'Prospect Park': [
    { type: 'Food', name: 'Parkside Restaurant', detail: 'Neighborhood Italian restaurant near the park’s southeast side.' },
    { type: 'Culture', name: 'Brooklyn Botanic Garden', detail: 'Garden collections beside Prospect Park’s northeast corner.' },
  ],
  'Marine Park': [
    { type: 'Food', name: 'Roll-N-Roaster', detail: 'A Brooklyn classic for roast beef and seafood near Sheepshead Bay.' },
    { type: 'Culture', name: 'Salt Marsh Nature Center', detail: 'Ranger programs and exhibits about Jamaica Bay habitats.' },
  ],
  'Shirley Chisholm State Park': [
    { type: 'Food', name: 'Gateway Center', detail: 'Nearby shops and casual dining; check Maps for current options.' },
    { type: 'Culture', name: 'Brooklyn Terminal Market', detail: 'A long-running produce market in the surrounding neighborhood.' },
  ],
  'Flushing Meadows Corona Park': [
    { type: 'Food', name: 'Queens Night Market', detail: 'Seasonal outdoor food market on select evenings in the park.' },
    { type: 'Culture', name: 'Queens Museum', detail: 'See the Panorama of the City of New York and rotating exhibitions.' },
  ],
  'Alley Pond Park': [
    { type: 'Culture', name: 'Alley Pond Environmental Center', detail: 'Nature exhibits and public programs beside the park trails.' },
    { type: 'Culture', name: 'Queens County Farm Museum', detail: 'Historic working farm and seasonal programs a short drive away.' },
  ],
  'Forest Park': [
    { type: 'Food', name: 'Eddie’s Sweet Shop', detail: 'Old-fashioned ice cream parlor in nearby Forest Hills.' },
    { type: 'Culture', name: 'Forest Park Carousel', detail: 'Historic carousel and bandshell within the park.' },
  ],
  'Ferry Point Park': [
    { type: 'Food', name: 'City Island seafood row', detail: 'A short drive away for Bronx seafood restaurants; check routes before you go.' },
    { type: 'Culture', name: 'Bronx-Whitestone Bridge overlook', detail: 'Waterfront views of the landmark bridge from the park.' },
  ],
  'Van Cortlandt Park': [
    { type: 'Food', name: 'Lloyd’s Carrot Cake', detail: 'Beloved neighborhood bakery on Broadway near the park.' },
    { type: 'Culture', name: 'Van Cortlandt House Museum', detail: 'Historic house museum within the park.' },
  ],
  'Pelham Bay Park': [
    { type: 'Food', name: 'City Island seafood row', detail: 'Local seafood restaurants a short drive from Hunter Island.' },
    { type: 'Culture', name: 'Bartow-Pell Mansion Museum', detail: 'A restored 19th-century mansion and gardens in the park.' },
  ],
  'Silver Lake Park': [
    { type: 'Food', name: 'DOUGH Pizzeria', detail: 'Neighborhood pizzeria in the Silver Lake area.' },
    { type: 'Culture', name: 'Snug Harbor Cultural Center', detail: 'Museums, historic buildings, and botanical gardens a short drive away.' },
  ],
  'Conference House Park': [
    { type: 'Food', name: 'DeLuca’s Italian Restaurant', detail: 'Neighborhood Italian dining in Tottenville.' },
    { type: 'Culture', name: 'Conference House Museum', detail: 'Historic house and grounds at Staten Island’s southern tip.' },
  ],
  'Staten Island Greenbelt': [
    { type: 'Food', name: 'Killmeyer’s Old Bavaria Inn', detail: 'Long-running German restaurant and beer garden near the Greenbelt.' },
    { type: 'Culture', name: 'High Rock Park Nature Center', detail: 'Greenbelt trailhead, ponds, and nature programs.' },
  ],
};
const PARK_GUIDE = {
  'Fort Tryon Park': {
    why: 'Come for the rare city combination of a formal garden, a cliff-edge river vista, and a world-class medieval collection a few paths apart.',
    explore: [
      { name: 'Heather Garden', detail: 'Wander through a large public garden with seasonal beds and Hudson-facing views.' },
      { name: 'Linden Terrace', detail: 'Pause at the stone balustrade for a broad look over the Hudson and Palisades.' },
      { name: 'Billings Arcade', detail: 'Step through the vaulted stone passage built into the park’s hillside.' },
    ],
    notes: [
      { label: 'Paths + grades', detail: 'The park drops steeply from Broadway to the river. Expect stairs and hills between the Heather Garden and lower paths.' },
      { label: 'Museum visit', detail: 'The Met Cloisters is a separate museum destination; check admission and opening hours before planning your loop.' },
    ],
  },
  'Inwood Hill Park': {
    why: 'This is a chance to trade Manhattan blocks for a tidal marsh, glacial ridges, and forest canopy without leaving the city.',
    explore: [
      { name: 'Muscota Marsh', detail: 'Look for water birds from the Hudson-side marsh overlook.' },
      { name: 'Shorakkopoch Rock', detail: 'Find the park’s landmark rock and pause to read its posted interpretation.' },
      { name: 'Inwood Hill Nature Center', detail: 'Start here for ranger programs and a sense of the park’s natural history.' },
    ],
    notes: [
      { label: 'Forest trails', detail: 'Roots, rocks, and muddy sections are common after rain. Use marked paths and sturdy shoes.' },
      { label: 'At the water edge', detail: 'The inlet and marsh are tidal habitats, not swimming areas. Bring tick repellent for woodland trails.' },
    ],
  },
  'Highbridge Park': {
    why: 'Pair a dramatic Harlem River crossing with the city’s oldest standing bridge, then climb back into a surprisingly wild hillside park.',
    explore: [
      { name: 'The High Bridge', detail: 'Walk the historic aqueduct crossing between Manhattan and the Bronx.' },
      { name: 'Highbridge Water Tower', detail: 'See the Gothic Revival tower that once supported the city’s water system.' },
      { name: 'Coogan’s Bluff', detail: 'Take in the elevated Harlem River views from the park’s historic overlook.' },
    ],
    notes: [
      { label: 'Hills + stairs', detail: 'The bridge sits well below some park entrances; plan for a steep return climb.' },
      { label: 'Historic structures', detail: 'Bridge and tower access can vary with maintenance or events. Check current park notices before traveling.' },
    ],
  },
  'Prospect Park': {
    why: 'Follow an easy-to-customize loop from open meadow into quieter woodland, with the boathouse and lake as a memorable finish.',
    explore: [
      { name: 'Long Meadow', detail: 'Stretch out on one of the country’s longest continuously maintained meadows.' },
      { name: 'The Ravine', detail: 'Take a woodland detour through the park’s stream valley and forest paths.' },
      { name: 'Lullwater + Boathouse', detail: 'Circle the lake for the park’s most storied landscape architecture.' },
    ],
    notes: [
      { label: 'Choose a loop', detail: 'The full park is large; pick a few landmarks first and leave time for the return walk.' },
      { label: 'Busy entrances', detail: 'The main paths and Long Meadow get busy on weekends. Check the Alliance map for restrooms and seasonal concessions.' },
    ],
  },
  'Marine Park': {
    why: 'Explore a salt-marsh landscape that feels far from the city, with tidal creeks and bird habitat rather than a manicured waterfront.',
    explore: [
      { name: 'Gerritsen Creek', detail: 'Watch the creek edge and its shifting salt-marsh channels from marked paths.' },
      { name: 'Salt Marsh Nature Trail', detail: 'Use the boardwalk and trail viewpoints to notice marsh plants and shorebirds.' },
      { name: 'Grassland preserve', detail: 'The open interior is valuable bird habitat; keep to established paths.' },
    ],
    notes: [
      { label: 'Tide + weather', detail: 'Water levels and trail conditions change. Check forecasts and stay on marked boardwalks.' },
      { label: 'Shade + insects', detail: 'Much of the route is exposed. Bring water, sun protection, and insect repellent in warm weather.' },
    ],
  },
  'Shirley Chisholm State Park': {
    why: 'Climb the reclaimed hills for a wide-open view across Jamaica Bay, then follow a waterfront path past piers and native meadow.',
    explore: [
      { name: 'Penn Pier', detail: 'Take in the bay and skyline from the park’s waterfront edge.' },
      { name: 'Hendrix Creek Patio', detail: 'Pause at the creekside overlook and look for birds moving along the water.' },
      { name: 'Fountain Pier', detail: 'Follow the shoreline path to another open-water viewpoint.' },
    ],
    notes: [
      { label: 'Open hills', detail: 'The paths are long and exposed with limited shade. Carry water and sun protection.' },
      { label: 'Bike Library', detail: 'Bike loans are seasonal and weather-dependent; check the state park’s current schedule before counting on one.' },
    ],
  },
  'Flushing Meadows Corona Park': {
    why: 'Move between World’s Fair landmarks, city-scale art, museums, and a quiet lake loop in one expansive Queens park.',
    explore: [
      { name: 'The Unisphere', detail: 'See the monumental steel globe built for the 1964 World’s Fair.' },
      { name: 'Meadow Lake', detail: 'Take a quieter waterside walk away from the park’s busiest plazas.' },
      { name: 'New York State Pavilion', detail: 'Spot the surviving 1964 World’s Fair towers and saucer-shaped observation deck.' },
    ],
    notes: [
      { label: 'Distances', detail: 'Landmarks are spread across a very large park. Group stops by area and allow extra walking time.' },
      { label: 'Museums + events', detail: 'Queens Museum and other venues have their own hours, admission, and event schedules; verify before visiting.' },
    ],
  },
  'Alley Pond Park': {
    why: 'Trade the city grid for a glacial landscape of kettle ponds, old trees, and the Queens Giant, one of the city’s most remarkable trees.',
    explore: [
      { name: 'The Queens Giant', detail: 'Visit the tulip tree estimated to be among the oldest and tallest trees in New York City.' },
      { name: 'Oakland Lake', detail: 'Walk the waterside path through a freshwater wetland habitat.' },
      { name: 'Kettle ponds + woodland trails', detail: 'Look for glacially formed ponds and varied forest on the marked natural trails.' },
    ],
    notes: [
      { label: 'Trail conditions', detail: 'Natural paths can be muddy and trail markers are easy to miss. Download a route map before setting out.' },
      { label: 'Environmental Center', detail: 'Programs and building hours vary; confirm the schedule before making it a planned stop.' },
    ],
  },
  'Forest Park': {
    why: 'The Yellow-Blazed Trail gives you a genuine woodland walk over a forested ridge, with a historic carousel and summer bandshell nearby.',
    explore: [
      { name: 'Yellow-Blazed Trail', detail: 'Follow the park’s marked hiking route through the eastern woods.' },
      { name: 'Oak forest ridge', detail: 'Notice the mature oak canopy and rolling terrain that divide the park’s natural and open areas.' },
      { name: 'Carousel + Bandshell', detail: 'Finish near the historic carousel or catch a seasonal performance at the bandshell.' },
    ],
    notes: [
      { label: 'Blazes + terrain', detail: 'The wooded trail has roots, slopes, and turns. Follow yellow markings and carry an offline map.' },
      { label: 'Visitor Center', detail: 'The Nature Center is not always open to walk-ins; verify hours and programs before planning around it.' },
    ],
  },
  'Ferry Point Park': {
    why: 'Choose this trip for open sky and water: the bridge views are the main event, with long waterfront paths to slow the pace.',
    explore: [
      { name: 'Whitestone Bridge waterfront', detail: 'Follow the shoreline path for close views of the bridge and East River.' },
      { name: 'Ferry landing', detail: 'Check the current ferry schedule and watch the Bronx waterfront from the landing area.' },
      { name: 'Waterfront greenway', detail: 'Walk or roll the open path between lawn, harbor, and recreation areas.' },
    ],
    notes: [
      { label: 'Wind + shade', detail: 'The waterfront is exposed, with long stretches between facilities. Bring water and sun or wind protection.' },
      { label: 'Photo context', detail: 'The Ferry Point image on this guide is archival from 2008, before the current golf course was built.' },
    ],
  },
  'Van Cortlandt Park': {
    why: 'Trace the route of an old railway through wetlands and forest, then step into Bronx history at the Van Cortlandt House.',
    explore: [
      { name: 'The Putnam Trail', detail: 'Follow the former rail corridor through the park’s northern landscape.' },
      { name: 'Van Cortlandt Lake', detail: 'Loop by the lake and look for water birds along the shore.' },
      { name: 'Croton Woods', detail: 'Take a marked woodland detour to see one of the park’s natural areas.' },
    ],
    notes: [
      { label: 'Shared trail', detail: 'The Putnam is a multi-use route; expect cyclists and other trail users. Natural sections can be muddy after rain.' },
      { label: 'Nature Center + museum', detail: 'The Nature Center and Van Cortlandt House have separate schedules. Check both before planning a visit.' },
    ],
  },
  'Pelham Bay Park': {
    why: 'Hunter Island brings together rocky shoreline, coastal forest, and traces of a vanished estate inside New York City’s largest park.',
    explore: [
      { name: 'Kazimiroff Nature Trail', detail: 'Follow the loop over Hunter Island through woodland and coastal habitats.' },
      { name: 'Orchard Beach', detail: 'See the historic promenade and Long Island Sound shoreline.' },
      { name: 'Hunter Island shoreline', detail: 'Look for rocky coves and salt-marsh views along the peninsula.' },
    ],
    notes: [
      { label: 'Trail surface', detail: 'The Hunter Island path has uneven, rocky sections. Wear shoes with grip and stay on marked routes.' },
      { label: 'Park scale', detail: 'Pelham Bay is exceptionally large; confirm your trailhead and transit or parking plan before entering.' },
    ],
  },
  'Silver Lake Park': {
    why: 'A calm reservoir loop makes this a restorative, low-key walk, with a distinct view of Staten Island’s historic water landscape.',
    explore: [
      { name: 'Silver Lake Reservoir', detail: 'Follow the public paths around the lake and look across the water from the overlook.' },
      { name: 'Audre Lorde Walk', detail: 'Find the park’s memorial walk honoring the poet and activist.' },
      { name: 'Silver Lake Golf Course edge', detail: 'See how the park’s open fairways meet its older tree canopy.' },
    ],
    notes: [
      { label: 'Shared paths', detail: 'The loop is popular with runners and local walkers. Keep to public paths around the reservoir.' },
      { label: 'Reservoir rules', detail: 'Fishing and water access are controlled; follow signs and do not enter restricted areas.' },
    ],
  },
  'Conference House Park': {
    why: 'Pair shoreline walking with the site of a failed 1776 peace meeting, then reach the southernmost point of New York State.',
    explore: [
      { name: 'Blue Loop', detail: 'Follow the marked route through the park’s coastal woodland.' },
      { name: 'The South Pole', detail: 'Visit the marker for New York State’s southernmost point.' },
      { name: 'Raritan Bay shoreline', detail: 'Walk the exposed shore for broad views toward New Jersey.' },
    ],
    notes: [
      { label: 'Museum hours', detail: 'Conference House Museum hours are limited and seasonal; verify the schedule before you go.' },
      { label: 'Coastal paths', detail: 'Shoreline weather changes quickly and trails may be muddy. Bring layers and grippy shoes.' },
    ],
  },
  'Staten Island Greenbelt': {
    why: 'The Yellow Trail opens onto one of the city’s largest connected forests, where ponds, ridgelines, and quiet ravines feel far from town.',
    explore: [
      { name: 'Yellow Trail', detail: 'Follow the marked route through forest and wetland pockets.' },
      { name: 'High Rock ponds', detail: 'Pause at the quiet ponds and watch for turtles, herons, and waterfowl.' },
      { name: 'Mount Moses', detail: 'Climb to a wooded high point for a panoramic view over the Greenbelt.' },
    ],
    notes: [
      { label: 'Navigation', detail: 'Trail intersections can be confusing and reception may fade. Download the Greenbelt map before leaving home.' },
      { label: 'Trail conditions', detail: 'Expect roots, hills, and wet ground in the woods; tick protection and sturdy shoes are a good idea.' },
    ],
  },
};
const exploreState = { matches: [], index: 0, selected: null, touchX: null };

const state = {
  zip: null,
  zipFeature: null,
  parks: [],
  gardens: [],
  natural: [],
  samples: [],
  metrics: null,
  layers: {},
  visible: { parks: true, natural: true, gardens: true, trees: false, gaps: false, airnow: false, airquality: false, income: false, view3d: false },
  pendingOpen: null,
  proposing: false,
  loadToken: 0,
};

// ---------------- Proposals ----------------
// New pins are drafts kept in this browser. Pressing Save stores them in the logged-in user's
// Supabase `proposals` table (private to them). Reads are synchronous from these caches;
// writes to saved sites go to Supabase in the background.

const Proposals = {
  saved: [],  // the logged-in user's saved sites

  _drafts() {
    try {
      // Anything in local storage is a draft (older builds kept saved sites here too).
      return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(p => ({ ...p, userId: null }));
    } catch { return []; }
  },
  _saveDrafts(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  },
  _isSaved(id) { return this.saved.some(p => p.id === id); },

  all() { return [...this._drafts(), ...this.saved]; },
  forZip(zip) { return this.all().filter(p => p.zip === zip); },
  savedBy() { return this.saved; },

  async loadSaved(user) {
    if (!user) { this.saved = []; return; }
    const { data, error } = await sb.from('proposals').select('*').order('saved_at', { ascending: false });
    if (error) { console.error(error); return; }
    this.saved = data.map(r => ({
      id: r.id, zip: r.zip, lat: r.lat, lng: r.lng, name: r.name, type: r.type, notes: r.notes,
      userId: r.user_id, savedAt: Date.parse(r.saved_at),
    }));
  },

  add(p) { this._saveDrafts([...this._drafts(), p]); },

  update(id, patch) {
    if (!this._isSaved(id)) {
      this._saveDrafts(this._drafts().map(p => (p.id === id ? { ...p, ...patch } : p)));
      return;
    }
    this.saved = this.saved.map(p => (p.id === id ? { ...p, ...patch } : p));
    const row = {};
    for (const k of ['lat', 'lng', 'name', 'type', 'notes']) if (k in patch) row[k] = patch[k];
    sb.from('proposals').update(row).eq('id', id).then(({ error }) => error && toast(`Couldn't save your change: ${error.message}`));
  },

  remove(id) {
    if (!this._isSaved(id)) { this._saveDrafts(this._drafts().filter(p => p.id !== id)); return; }
    this.saved = this.saved.filter(p => p.id !== id);
    sb.from('proposals').delete().eq('id', id).then(({ error }) => error && toast(`Couldn't delete: ${error.message}`));
  },

  // Moves a draft into the user's account. Returns the saved site's new id.
  async saveDraft(id, patch) {
    const draft = this._drafts().find(p => p.id === id);
    if (!draft) return id;
    const p = { ...draft, ...patch };
    const { data, error } = await sb.from('proposals')
      .insert({ zip: p.zip, lat: p.lat, lng: p.lng, name: p.name, type: p.type, notes: p.notes || '' })
      .select().single();
    if (error) throw new Error(error.message);
    this._saveDrafts(this._drafts().filter(x => x.id !== id));
    const saved = { id: data.id, zip: data.zip, lat: data.lat, lng: data.lng, name: data.name, type: data.type, notes: data.notes, userId: data.user_id, savedAt: Date.parse(data.saved_at) };
    this.saved = [saved, ...this.saved];
    return saved.id;
  },

  clearZip(zip) {
    this._saveDrafts(this._drafts().filter(p => p.zip !== zip));
    for (const p of this.saved.filter(p => p.zip === zip)) this.remove(p.id);
  },
};

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 5000);
}

// ---------------- Map ----------------

// Esri basemaps (no API key). We avoid the OpenStreetMap standard style because it draws every
// NYC street tree as a green dot, which looks like our Street trees layer is always on.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community';

function basemapLayers() {
  const tile = (path, opts = {}) => L.tileLayer(`${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, attribution: ESRI_ATTRIBUTION, ...opts });
  return {
    Streets: tile('World_Street_Map'),
    Light: L.layerGroup([tile('Canvas/World_Light_Gray_Base', { maxNativeZoom: 16 }), tile('Canvas/World_Light_Gray_Reference', { maxNativeZoom: 16 })]),
    Satellite: tile('World_Imagery', { attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }),
  };
}

// Adds the default basemap and, optionally, a switcher control.
function addBasemaps(target, { control = true } = {}) {
  const layers = basemapLayers();
  layers.Streets.addTo(target);
  if (control) L.control.layers(layers, null, { position: 'topright' }).addTo(target);
  return layers;
}

let map;

function initMap() {
  if (map) return;
  // Double-click clears the ZIP selection, so it doesn't zoom here (use +/− or the scroll wheel).
  map = L.map('map', { zoomControl: false, preferCanvas: true, doubleClickZoom: false }).setView([40.71, -73.95], 11);
  L.control.zoom({ position: 'topright' }).addTo(map);

  addBasemaps(map);
  L.control.scale({ position: 'bottomright', imperial: true, metric: false }).addTo(map);

  map.createPane('choropleth').style.zIndex = 385;
  map.createPane('gaps').style.zIndex = 390;
  map.createPane('mask').style.zIndex = 395;

  // Single click outside the current ZIP loads the ZIP there; double click clears the selection.
  // The single click waits briefly so it can be cancelled if it turns out to be a double click.
  map.on('click', e => {
    if (state.proposing) { addProposal(e.latlng); return; }
    clearTimeout(state.clickTimer);
    state.clickTimer = setTimeout(() => selectZipAt(e.latlng), 260);
  });
  map.on('dblclick', () => {
    clearTimeout(state.clickTimer);
    if (!state.proposing) clearZipSelection();
  });
  // A click that opened a park/garden/tree popup shouldn't also switch ZIPs.
  map.on('popupopen', () => { state.popupOpenedAt = Date.now(); });
}

function clearLayers() {
  for (const layer of Object.values(state.layers)) layer && map.removeLayer(layer);
  state.layers = {};
}

function outerRings(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.map(poly => poly[0].map(([x, y]) => [y, x]));
}

function drawBaseLayers() {
  const { zipFeature } = state;

  // Dim everything outside the ZIP so the neighborhood stands out.
  const world = [[90, -180], [90, 180], [-90, 180], [-90, -180]];
  state.layers.mask = L.polygon([world, ...outerRings(zipFeature.geometry)], {
    pane: 'mask', stroke: false, fillColor: '#10261a', fillOpacity: 0.28, interactive: false,
  }).addTo(map);
  state.layers.outline = L.geoJSON(zipFeature, {
    style: { color: '#10261a', weight: 2.5, dashArray: '6 5', fill: false },
    interactive: false,
  }).addTo(map);

  state.layers.parks = L.geoJSON(turf.featureCollection(state.parks), {
    style: { color: '#2c7a3b', weight: 1, fillColor: COLORS.park, fillOpacity: 0.45 },
    onEachFeature: (f, layer) => layer.bindPopup(parkPopup(f.properties)),
  });

  state.layers.natural = L.geoJSON(turf.featureCollection(state.natural), {
    style: { color: COLORS.natural, weight: 1, fillColor: COLORS.natural, fillOpacity: 0.55 },
    onEachFeature: (f, layer) => layer.bindPopup(
      `<div class="pop"><div class="pop-kicker">Natural area · Forever Wild</div><strong>${esc(f.properties.name)}</strong><div>${fmt(f.properties.acres, 1)} acres of protected habitat</div></div>`),
  });

  state.layers.gardens = L.layerGroup(state.gardens.map(f => {
    const [lng, lat] = turf.centroid(f).geometry.coordinates;
    return L.circleMarker([lat, lng], {
      radius: 7, color: '#fff', weight: 2, fillColor: COLORS.garden, fillOpacity: 1,
    }).bindPopup(
      `<div class="pop"><div class="pop-kicker">Community garden · GreenThumb</div><strong>${esc(f.properties.name)}</strong><div>${esc(f.properties.address)}</div>${f.properties.status ? `<div class="muted">${esc(f.properties.status)}</div>` : ''}${f.properties.hours ? `<div class="muted">${esc(f.properties.hours)}</div>` : ''}</div>`);
  }));

  state.layers.proposals = L.layerGroup().addTo(map);
  renderProposalMarkers();

  syncLayerVisibility();
  map.fitBounds(L.geoJSON(zipFeature).getBounds(), { padding: [30, 30] });
}

function parkPopup(p) {
  return `<div class="pop"><div class="pop-kicker">${esc(p.category)}</div><strong>${esc(p.name)}</strong><div>${fmt(p.acres, 2)} acres</div>${p.address ? `<div class="muted">${esc(p.address)}</div>` : ''}</div>`;
}

async function ensureTreeLayer() {
  if (state.layers.trees) return;
  const token = state.loadToken;
  setLoading('Loading street trees…');
  try {
    const rows = await Data.treePoints(state.zip);
    if (token !== state.loadToken) return;
    const renderer = L.canvas({ padding: 0.5 });
    state.layers.trees = L.layerGroup(rows.filter(r => r.latitude).map(r =>
      L.circleMarker([+r.latitude, +r.longitude], {
        renderer, radius: 2.5, stroke: false, fillColor: COLORS.tree, fillOpacity: 0.8,
      }).bindPopup(`<div class="pop"><div class="pop-kicker">Street tree · 2015 census</div><strong>${esc(r.spc_common || 'Unknown species')}</strong><div>Trunk ${esc(r.tree_dbh)}″ diameter · ${esc(r.health || '—')} health</div></div>`)
    ));
  } finally {
    setLoading(null);
  }
}

function drawGapLayer() {
  if (state.layers.gaps) map.removeLayer(state.layers.gaps);
  const proposals = Proposals.forZip(state.zip);
  const half = (state.cellKm * 1000) / 2;
  const renderer = L.canvas({ pane: 'gaps' });
  const cells = [];
  for (const s of state.samples) {
    let d = s.dist;
    for (const p of proposals) d = Math.min(d, map.distance([s.lat, s.lng], [p.lat, p.lng]));
    if (d <= WALK_5_MIN) continue;
    const dLat = half / 111320;
    const dLng = half / (111320 * Math.cos((s.lat * Math.PI) / 180));
    cells.push(L.rectangle([[s.lat - dLat, s.lng - dLng], [s.lat + dLat, s.lng + dLng]], {
      renderer, pane: 'gaps', stroke: false, interactive: false,
      fillColor: d > WALK_10_MIN ? COLORS.gap10 : COLORS.gap5, fillOpacity: 0.42,
    }));
  }
  state.layers.gaps = L.layerGroup(cells);
}

async function syncLayerVisibility() {
  if (state.visible.trees) await ensureTreeLayer();
  if (state.visible.airquality) await ensureAirLayer();
  if (state.visible.airnow) await ensureAirNowLayer();
  if (state.visible.income) await ensureIncomeLayer();
  for (const key of ['parks', 'natural', 'gardens', 'trees', 'gaps', 'airnow', 'airquality', 'income']) {
    const layer = state.layers[key];
    if (!layer) continue;
    if (state.visible[key] && !map.hasLayer(layer)) layer.addTo(map);
    if (!state.visible[key] && map.hasLayer(layer)) map.removeLayer(layer);
  }
  if (state.visible.view3d) Map3D.enable();
  else Map3D.disable();
}

// Overlays cover a wider area than the ZIP so neighbors can be compared.
const overlayBbox = () => turf.bbox(turf.buffer(state.zipFeature, 3, { units: 'kilometers' }));

async function ensureAirLayer() {
  if (state.layers.airquality) return;
  const token = state.loadToken;
  setLoading('Loading air quality by district…');
  try {
    const districts = await Data.airQualityDistricts(overlayBbox());
    if (token !== state.loadToken) return;
    state.layers.airquality = L.geoJSON(turf.featureCollection(districts), {
      pane: 'choropleth',
      style: f => ({ color: '#fff', weight: 1, fillColor: scaleColor(AIR_SCALE, f.properties.pm25), fillOpacity: 0.6 }),
      onEachFeature: (f, layer) => {
        const p = f.properties;
        const aqi = p.pm25 != null ? Analysis.pm25ToAqi(p.pm25) : null;
        popupInsideZip(layer, `<div class="pop"><div class="pop-kicker">Air quality · ${esc(p.period || '')}</div><strong>${esc(p.name)}</strong>
          ${p.pm25 != null ? `<div>PM2.5: <b>${fmt(p.pm25, 1)}</b> µg/m³ (AQI ~${aqi}, ${Analysis.aqiCategory(aqi).label.toLowerCase()})</div>` : '<div class="muted">No PM2.5 reading</div>'}
          ${p.no2 != null ? `<div>NO₂: <b>${fmt(p.no2, 1)}</b> ppb</div>` : ''}</div>`);
      },
    });
  } catch (err) {
    console.error(err);
    state.visible.airquality = false;
  } finally {
    setLoading(null);
  }
}

// Area-shading layers cover neighboring ZIPs too. Inside the current ZIP a click shows the
// layer's details; outside it the click falls through to "load the ZIP here".
function popupInsideZip(layer, html) {
  layer.on('click', e => {
    if (!state.zipFeature || !turf.booleanPointInPolygon(turf.point([e.latlng.lng, e.latlng.lat]), state.zipFeature)) return;
    L.popup().setLatLng(e.latlng).setContent(html).openOn(map);
  });
}

// Live AQI sampled on a grid over the area (one Open-Meteo request for all points).
async function ensureAirNowLayer() {
  if (state.layers.airnow) return;
  const token = state.loadToken;
  setLoading('Loading live air quality…');
  try {
    const [minX, minY, maxX, maxY] = overlayBbox();
    const step = 0.03;
    const points = [];
    for (let x = minX; x < maxX; x += step) for (let y = minY; y < maxY; y += step) points.push([x + step / 2, y + step / 2]);
    const readings = await Data.currentAir(points.slice(0, 60));
    if (token !== state.loadToken) return;
    state.airNowTime = readings[0]?.time;
    state.layers.airnow = L.layerGroup(readings.filter(r => r.aqi != null).map(r => {
      const [x, y] = r.point;
      const cell = L.rectangle([[y - step / 2, x - step / 2], [y + step / 2, x + step / 2]], {
        pane: 'choropleth', color: '#fff', weight: 0.5, fillColor: scaleColor(AQI_SCALE, r.aqi), fillOpacity: 0.45,
      });
      const cat = Analysis.aqiCategory(r.aqi);
      popupInsideZip(cell, `<div class="pop"><div class="pop-kicker">Air quality now · ${esc(airTime(r.time))}</div><strong>US AQI ${r.aqi}: ${esc(cat.label)}</strong>
        <div>PM2.5 ${fmt(r.pm25, 1)} · Ozone ${fmt(r.ozone, 0)} · NO₂ ${fmt(r.no2, 1)} <span class="muted">µg/m³</span></div>
        <div class="muted small">Open-Meteo / CAMS regional model</div></div>`);
      return cell;
    }));
  } catch (err) {
    console.error(err);
    state.visible.airnow = false;
    toast("Couldn't load live air quality right now.");
  } finally {
    setLoading(null);
  }
}

async function ensureIncomeLayer() {
  if (state.layers.income) return;
  const token = state.loadToken;
  setLoading('Loading median household income…');
  try {
    const areas = await Data.incomeAreas(overlayBbox());
    if (token !== state.loadToken) return;
    state.incomeRelease = areas[0]?.properties.release;
    state.layers.income = L.geoJSON(turf.featureCollection(areas), {
      pane: 'choropleth',
      style: f => ({ color: '#fff', weight: 1, fillColor: scaleColor(INCOME_SCALE, f.properties.income), fillOpacity: 0.6 }),
      onEachFeature: (f, layer) => {
        const p = f.properties;
        popupInsideZip(layer, `<div class="pop"><div class="pop-kicker">Median household income</div><strong>ZIP ${esc(p.zip)}</strong>
          ${p.income != null ? `<div><b>${money(p.income)}</b>${p.moe ? ` <span class="muted">± ${money(p.moe)}</span>` : ''}</div>` : '<div class="muted">No estimate</div>'}
          <div class="muted small">${p.population ? `${fmt(p.population)} residents · ` : ''}Census ACS ${esc(p.release || '5-year')}</div></div>`);
      },
    });
  } catch (err) {
    console.error(err);
    state.visible.income = false;
  } finally {
    setLoading(null);
  }
}

// ---------------- Loading a ZIP ----------------

async function loadZip(zip) {
  const token = ++state.loadToken;
  showPlanner();
  showTab('map');
  initMap();
  $('#top-zip').value = zip;
  clearLayers();
  Map3D.reset();
  setProposing(false);
  state.zip = zip;
  state.samples = [];
  state.metrics = null;
  $('#profile').innerHTML = skeletonProfile(zip);
  setLoading('Finding ZIP boundary…');

  try {
    const zipFeature = await Data.zipBoundary(zip);
    if (token !== state.loadToken) return;
    if (!zipFeature) {
      setLoading(null);
      $('#profile').innerHTML = `<div class="card error-card"><h2>ZIP ${esc(zip)} not found</h2><p>That doesn't look like a residential NYC ZIP code. Try another, like 10027 or 11211.</p>${zipForm('')}<p class="form-error" data-zip-error></p></div>`;
      return;
    }
    state.zipFeature = zipFeature;

    // Pull in nearby features too, so parks just across the ZIP line count toward walk access.
    const bbox = turf.bbox(turf.buffer(zipFeature, 0.9, { units: 'kilometers' }));
    const interior = turf.pointOnFeature(zipFeature).geometry.coordinates;

    setLoading('Loading parks, gardens, trees and air quality…');
    const [parks, natural, gardens, trees, cd, income, airNow] = await Promise.all([
      Data.parks(bbox),
      Data.naturalAreas(bbox).catch(() => []),
      Data.gardens(zip, bbox).catch(() => []),
      Data.treeSummary(zip).catch(() => null),
      Data.communityDistrict(interior).catch(() => null),
      Data.medianIncome([zipFeature.properties.modzcta]).catch(() => null),
      Data.currentAir([interior]).then(r => r[0]).catch(() => null),
    ]);
    const air = await Data.airQuality(cd).catch(() => null);
    if (token !== state.loadToken) return;

    state.parks = parks;
    state.natural = natural;
    state.gardens = gardens;

    drawBaseLayers();
    if (state.pendingOpen) { openProposal(state.pendingOpen); state.pendingOpen = null; }

    const parksInZip = parks.filter(p => Analysis.isInside(p, zipFeature));
    const gardensInZip = gardens.filter(g =>
      g.properties.zip === zip || turf.booleanPointInPolygon(turf.centroid(g), zipFeature));
    const naturalInZip = natural.filter(n => Analysis.isInside(n, zipFeature));
    const zipAcres = turf.area(zipFeature) / SQM_PER_ACRE;
    const parkAcres = Analysis.areaInside(parksInZip, zipFeature);
    const naturalAcres = Analysis.areaInside(naturalInZip, zipFeature);
    const population = zipFeature.properties.population;

    state.metrics = {
      zip, trees, air, population, zipAcres, parkAcres, naturalAcres,
      income: income?.values[zipFeature.properties.modzcta] || null,
      airNow,
      incomeRelease: income?.release || null,
      parkCount: parksInZip.length,
      gardenCount: gardensInZip.length,
      naturalCount: naturalInZip.length,
      largestParks: parksInZip.slice().sort((a, b) => b.properties.acres - a.properties.acres).slice(0, 4),
      access: null,
    };
    renderProfile();

    setLoading('Measuring walking distance to parks…');
    await nextFrame();
    const { samples, cellKm } = Analysis.accessGrid(zipFeature, parks);
    if (token !== state.loadToken) return;
    state.samples = samples;
    state.cellKm = cellKm;
    state.metrics.access = Analysis.accessShare(samples);
    drawGapLayer();
    syncLayerVisibility();
    renderProfile();
  } catch (err) {
    console.error(err);
    if (token !== state.loadToken) return;
    $('#profile').innerHTML = `<div class="card error-card"><h2>Couldn't load data</h2><p>NYC Open Data didn't respond. Check your connection and try again.</p><p class="muted">${esc(err.message)}</p></div>`;
  } finally {
    if (token === state.loadToken) setLoading(null);
  }
}

const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

function setLoading(text) {
  const el = $('#map-loading');
  el.hidden = !text;
  if (text) $('#loading-text').textContent = text;
}

// ---------------- Profile rendering ----------------

function skeletonProfile(zip) {
  return `<div class="profile-head"><div class="profile-top"><div class="kicker">Neighborhood profile</div>${zipForm(zip)}</div><h2>ZIP ${esc(zip)}</h2><p class="muted">Loading…</p></div>
    <div class="stats">${'<div class="stat skeleton"></div>'.repeat(6)}</div>`;
}

function renderProfile() {
  const m = state.metrics;
  if (!m) return;
  const t = m.trees;
  const placeName = !t?.place ? 'New York City'
    : t.place.city === t.place.borough ? t.place.borough : `${t.place.city}, ${t.place.borough}`;
  const greenPct = m.zipAcres ? (m.parkAcres / m.zipAcres) : 0;
  const perThousand = m.population ? (m.parkAcres / m.population) * 1000 : null;
  const co2 = t ? Analysis.co2TonsPerYear(t.count) : null;

  let aqiTile = statTile('—', 'Air quality now', 'Live reading unavailable');
  if (m.airNow?.aqi != null) {
    const cat = Analysis.aqiCategory(m.airNow.aqi);
    aqiTile = statTile(`<span class="aqi-badge aqi-${cat.tone}">${m.airNow.aqi}</span>`, 'Air quality now', `${cat.label} · as of ${airTime(m.airNow.time)}`,
      'US AQI right now, updated hourly, from the Open-Meteo / CAMS air-quality model. It covers roughly 10 km areas, so it shows the air across this part of the city, not block by block.');
  } else if (m.air?.pm25) {
    const aqi = Analysis.pm25ToAqi(m.air.pm25.value);
    const cat = Analysis.aqiCategory(aqi);
    aqiTile = statTile(`<span class="aqi-badge aqi-${cat.tone}">${aqi}</span>`, 'Air quality (yearly)', `${cat.label} · ${m.air.pm25.period} average`);
  }

  const proposals = Proposals.forZip(m.zip);
  const withProposals = proposals.length && m.access ? Analysis.accessShare(state.samples, proposals) : null;

  $('#profile').innerHTML = `
    <div class="profile-head">
      <div class="profile-top"><div class="kicker">Neighborhood profile</div>${zipForm(m.zip)}</div>
      <h2>ZIP ${esc(m.zip)} <span class="place">${esc(placeName)}</span></h2>
      <p class="muted">${m.population ? `${fmt(m.population)} residents · ` : ''}${fmt(m.zipAcres)} acres${t?.place?.nta ? ` · ${esc(t.place.nta)}` : ''}</p>
      ${m.income ? `<p class="muted">Median household income <strong class="ink">${money(m.income.income)}</strong> <span class="small">(Census ACS ${esc(m.incomeRelease || '')})</span></p>` : ''}
    </div>

    <div class="stats">
      ${statTile(t ? fmt(t.species) : '—', 'Plant species', 'Distinct street-tree species')}
      ${statTile(`${fmt(m.parkAcres, m.parkAcres < 10 ? 1 : 0)}<small> ac</small>`, 'Green space', `${pct(greenPct)} of the ZIP · ${fmt(m.parkCount)} park properties`)}
      ${statTile(t ? fmt(t.count) : '—', 'Street trees', '2015 Street Tree Census')}
      ${statTile(co2 != null ? `${fmt(co2)}<small> t</small>` : '—', 'CO₂ captured / yr', 'Estimate from street trees', 'Rough estimate: 48 lb of CO₂ per tree per year, a widely cited USDA Forest Service / Arbor Day figure for mature urban trees. Park trees are not included.')}
      ${aqiTile}
      ${statTile(fmt(m.gardenCount), 'Community gardens', 'GreenThumb sites')}
    </div>

    <section class="card">
      <h3>Park access</h3>
      ${m.access ? `
        ${meter('Within a 10-minute walk of a park', m.access.within10, withProposals?.within10)}
        ${meter('Within a 5-minute walk of a park', m.access.within5, withProposals?.within5)}
        ${withProposals ? proposalImpactNote(proposals.length, m.access, withProposals) : ''}
        <p class="note">Turn on <em>Access gaps</em> below to see where residents are farthest from a park.</p>
        <p class="note">Tip: click a neighboring area on the map to switch ZIPs, or double-click to clear the selection.</p>
      ` : '<p class="muted"><span class="spinner spinner-sm"></span> Measuring walking distances…</p>'}
      ${perThousand != null ? `
        <div class="goal">
          <div class="goal-row"><span>Park acres per 1,000 residents</span><strong>${fmt(perThousand, 2)}</strong></div>
          <div class="bar"><span style="width:${Math.min(100, (perThousand / ACRES_PER_1000_GOAL) * 100)}%" class="${perThousand >= ACRES_PER_1000_GOAL ? 'ok' : 'low'}"></span><i style="left:100%"></i></div>
          <div class="muted small">${perThousand >= ACRES_PER_1000_GOAL ? 'Meets' : 'Below'} the city's 2.5-acre planning goal</div>
        </div>` : ''}
    </section>

    <section class="card">
      <h3>Map layers</h3>
      <div class="layer-list">
        ${layerToggle('parks', COLORS.park, 'Parks', `${fmt(m.parkCount)} in ZIP`)}
        ${layerToggle('natural', COLORS.natural, 'Natural areas', `${fmt(m.naturalAcres, 1)} ac · Forever Wild`)}
        ${layerToggle('gardens', COLORS.garden, 'Community gardens', `${fmt(m.gardenCount)} in ZIP`, true)}
        ${layerToggle('trees', COLORS.tree, 'Street trees', t ? `${fmt(t.count)} trees` : '', true)}
        ${layerToggle('gaps', `linear-gradient(90deg, ${COLORS.gap5} 50%, ${COLORS.gap10} 50%)`, 'Access gaps', '5–10 min · 10+ min to a park')}
        ${layerToggle('airnow', `linear-gradient(90deg, ${AQI_SCALE.colors.slice(0, 4).join(',')})`, 'Air quality now', m.airNow?.aqi != null ? `AQI ${m.airNow.aqi} · live, updated hourly` : 'Live US AQI, updated hourly')}
        ${state.visible.airnow ? legend(AQI_SCALE, `US AQI as of ${airTime(state.airNowTime || m.airNow?.time)} (regional model, ~10 km)`) : ''}
        ${layerToggle('airquality', `linear-gradient(90deg, ${AIR_SCALE.colors.join(',')})`, 'Air pollution, yearly average', 'PM2.5 by community district (NYC survey)')}
        ${state.visible.airquality ? legend(AIR_SCALE, 'PM2.5, µg/m³ annual mean') : ''}
        ${layerToggle('income', `linear-gradient(90deg, ${INCOME_SCALE.colors.join(',')})`, 'Median income', m.income ? `${money(m.income.income)} in this ZIP` : 'Household income by ZIP')}
        ${state.visible.income ? legend(INCOME_SCALE, `Median household income, ACS ${state.incomeRelease || m.incomeRelease || ''}`) : ''}
        ${layerToggle('view3d', 'linear-gradient(160deg, #e8e4da, #9a9388)', '3D view', 'Tilted map with 3D buildings')}
      </div>
    </section>

    ${m.largestParks.length ? `
    <section class="card">
      <h3>Largest parks</h3>
      <ul class="rank">${m.largestParks.map(p => `<li><span>${esc(p.properties.name)}<small>${esc(p.properties.category)}</small></span><strong>${fmt(p.properties.acres, p.properties.acres < 10 ? 1 : 0)} ac</strong></li>`).join('')}</ul>
    </section>` : ''}

    ${t?.top?.length ? `
    <section class="card">
      <h3>Most common street trees</h3>
      <ul class="rank">${t.top.map(s => `<li><span class="cap">${esc(s.name)}</span><strong>${fmt(s.count)}</strong></li>`).join('')}</ul>
    </section>` : ''}

    ${m.airNow || m.air ? `
    <section class="card">
      <h3>Air quality</h3>
      ${m.airNow?.aqi != null ? `
        <div class="air-now">
          <span class="aqi-badge aqi-${Analysis.aqiCategory(m.airNow.aqi).tone}">${m.airNow.aqi}</span>
          <div><strong>Right now: ${esc(Analysis.aqiCategory(m.airNow.aqi).label)}</strong><span class="muted small">US AQI as of ${esc(airTime(m.airNow.time))} · updates hourly</span></div>
        </div>
        <dl class="air">
          ${nowRow('Fine particles (PM2.5)', m.airNow.pm25, 'µg/m³')}
          ${nowRow('Ozone (O₃)', m.airNow.ozone, 'µg/m³')}
          ${nowRow('Nitrogen dioxide (NO₂)', m.airNow.no2, 'µg/m³')}
        </dl>
        <p class="muted small">Live data: Open-Meteo / Copernicus CAMS model (about 10 km areas).</p>` : ''}
      ${m.air ? `
        <div class="air-sub">Yearly average for ${esc(m.air.district)}</div>
        <dl class="air">
          ${airRow('Fine particles (PM2.5)', m.air.pm25, 'annual mean')}
          ${airRow('Nitrogen dioxide (NO₂)', m.air.no2, 'annual mean')}
          ${airRow('Ozone (O₃)', m.air.o3, 'summer mean')}
        </dl>
        <p class="muted small">NYC Community Air Survey. This is the best source for comparing neighborhoods.</p>` : ''}
    </section>` : ''}

    <section class="card" id="proposals-card"></section>

    <p class="footnote">Sources: NYC Parks Properties, NYC Parks Forever Wild (NYC Nature Map), GreenThumb gardens, 2015 Street Tree Census, NYC Air Quality survey and Modified ZCTA boundaries, all from NYC Open Data. Park area counts only land inside the ZIP.</p>
  `;
  renderProposals();
}

function proposalImpactNote(n, before, after) {
  const sites = `${n} proposed site${n > 1 ? 's' : ''}`;
  const up = key => Math.round(after[key] * 100) > Math.round(before[key] * 100);
  if (up('within10')) {
    return `<p class="note good-note">Your ${sites} would raise 10-minute park access from ${pct(before.within10)} to <strong>${pct(after.within10)}</strong>.</p>`;
  }
  if (up('within5')) {
    return `<p class="note good-note">Your ${sites} would raise 5-minute park access from ${pct(before.within5)} to <strong>${pct(after.within5)}</strong>.</p>`;
  }
  return `<p class="note">Your ${sites} ${n > 1 ? 'are' : 'is'} in areas that already have park access. Try placing sites in the red and yellow access gaps.</p>`;
}

// A compact "change ZIP" form, handled by the #sidebar submit listener.
function zipForm(current) {
  return `<form class="profile-zip" autocomplete="off" data-zip-form>
    <input name="zip" inputmode="numeric" pattern="\\d{5}" maxlength="5" placeholder="ZIP" value="${esc(current)}" aria-label="Change ZIP code" required>
    <button type="submit">Change ZIP</button>
  </form>`;
}

function statTile(value, label, sub, info) {
  return `<div class="stat"${info ? ` title="${esc(info)}"` : ''}>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${esc(label)}${info ? ' <span class="info">ⓘ</span>' : ''}</div>
    <div class="stat-sub">${esc(sub)}</div>
  </div>`;
}

function meter(label, value, projected) {
  return `<div class="meter">
    <div class="goal-row"><span>${esc(label)}</span><strong>${pct(value)}${projected != null && pct(projected) !== pct(value) ? ` → ${pct(projected)}` : ''}</strong></div>
    <div class="bar">${projected != null ? `<span class="projected" style="width:${projected * 100}%"></span>` : ''}<span class="ok" style="width:${value * 100}%"></span></div>
  </div>`;
}

function layerToggle(key, color, label, sub, dot) {
  return `<label class="layer">
    <input type="checkbox" data-layer="${key}" ${state.visible[key] ? 'checked' : ''}>
    <span class="swatch${dot ? ' dot' : ''}" style="background:${color}"></span>
    <span class="layer-text">${esc(label)}<small>${esc(sub)}</small></span>
  </label>`;
}

function legend(scale, title) {
  return `<div class="legend"><div class="legend-title">${esc(title)}</div><div class="legend-row">${scale.colors.map((c, i) =>
    `<span><i style="background:${c}"></i>${esc(scale.labels[i])}</span>`).join('')}</div></div>`;
}

function nowRow(label, value, unit) {
  if (value == null) return '';
  return `<div><dt>${esc(label)}</dt><dd>${fmt(value, 1)} <small>${esc(unit)} · now</small></dd></div>`;
}

// "2026-09-26T22:00" → "10 PM"
function airTime(t) {
  if (!t) return 'the latest hour';
  const [, hh] = String(t).split('T');
  const h = Number(hh?.slice(0, 2));
  return Number.isFinite(h) ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` : t;
}

function airRow(label, v, measure) {
  if (!v) return '';
  return `<div><dt>${esc(label)}</dt><dd>${fmt(v.value, 1)} <small>${esc(v.unit)} · ${esc(measure)}, ${esc(v.period)}</small></dd></div>`;
}

// ---------------- Proposal tool ----------------

function setProposing(on) {
  if (on && !state.zipFeature) {
    toast('Pick a ZIP first: click an area on the map or enter a ZIP code.');
    on = false;
  }
  state.proposing = on;
  $('#propose-btn').classList.toggle('active', on);
  $('#propose-btn').textContent = on ? 'Click the map to place a site · Esc to stop' : '＋ Propose a green space';
  $('#map').classList.toggle('proposing', on);
}

function addProposal(latlng) {
  if (!state.zipFeature) return;
  const existing = Proposals.forZip(state.zip);
  const p = {
    id: `p${Date.now().toString(36)}`,
    zip: state.zip,
    lat: +latlng.lat.toFixed(6),
    lng: +latlng.lng.toFixed(6),
    name: `Proposed site ${existing.length + 1}`,
    type: PROPOSAL_TYPES[0],
    notes: '',
  };
  Proposals.add(p);
  setProposing(false);
  refreshAfterProposalChange();
  openProposal(p.id);
}

function proposalMarker(p) {
  const icon = L.divIcon({ className: `proposal-pin${p.userId ? '' : ' draft'}`, html: '<span><i>+</i></span>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
  const marker = L.marker([p.lat, p.lng], { icon, draggable: true, zIndexOffset: 1000 });
  marker.proposalId = p.id;
  marker.bindPopup(() => proposalPopup(p.id), { minWidth: 250 });
  marker.on('dragend', () => {
    const { lat, lng } = marker.getLatLng();
    Proposals.update(p.id, { lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
    refreshAfterProposalChange();
  });
  return marker;
}

function proposalPopup(id) {
  const p = Proposals.all().find(x => x.id === id);
  if (!p) return '';
  const nearest = Analysis.nearestPark(p.lng, p.lat, state.parks);
  const inside = turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), state.zipFeature);
  const d = nearest.dist;
  const verdict = d > WALK_10_MIN ? ['High impact', 'Fills a gap: no park within a 10-minute walk.', 'high']
    : d > WALK_5_MIN ? ['Good impact', 'Nearest park is 5–10 minutes away.', 'mid']
    : ['Lower impact', 'Already within a 5-minute walk of a park.', 'low'];
  const el = document.createElement('div');
  el.className = 'pop proposal-form';
  el.innerHTML = `
    <div class="pop-kicker">Proposed green space</div>
    <input class="pf-name" value="${esc(p.name)}" aria-label="Site name">
    <select class="pf-type" aria-label="Type">${PROPOSAL_TYPES.map(t => `<option ${t === p.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
    <textarea class="pf-notes" rows="2" placeholder="Notes (lot owner, size, community input…)">${esc(p.notes)}</textarea>
    <div class="impact impact-${verdict[2]}"><strong>${verdict[0]}</strong>${verdict[1]}</div>
    <div class="muted small">Nearest park: ${esc(nearest.name || '—')} (${Number.isFinite(d) ? `${fmt(d)} m, ~${Math.max(1, Math.round(d / 80))} min walk` : 'none nearby'})</div>
    <a class="small sv-link" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lng}" target="_blank" rel="noopener">See it in Street View ↗</a>
    ${inside ? '' : `<div class="muted small">⚠ Outside ZIP ${esc(state.zip)}</div>`}
    <div class="pf-save">${p.userId
      ? '<span class="saved-note">✓ Saved to your account</span>'
      : '<button class="btn-primary pf-save-btn" type="button">Save</button><span class="muted small">Draft, not saved yet</span>'}</div>
    <div class="pf-actions"><span class="muted small">Drag the pin to move it</span><button class="pf-delete" type="button">Delete</button></div>`;
  el.querySelector('.pf-name').addEventListener('change', e => { Proposals.update(id, { name: e.target.value.trim() || p.name }); renderProposals(); });
  el.querySelector('.pf-type').addEventListener('change', e => { Proposals.update(id, { type: e.target.value }); renderProposals(); });
  el.querySelector('.pf-notes').addEventListener('change', e => Proposals.update(id, { notes: e.target.value }));
  el.querySelector('.pf-delete').addEventListener('click', () => { map.closePopup(); Proposals.remove(id); refreshAfterProposalChange(); });
  el.querySelector('.pf-save-btn')?.addEventListener('click', () => saveProposal(id));
  return el;
}

async function saveProposal(id) {
  const me = await Auth.require('Log in or create an account to save your proposed green spaces.');
  if (!me) return;
  // Pick up any edits typed into the popup before it closes.
  const form = document.querySelector('.proposal-form');
  const patch = {};
  if (form) {
    patch.name = form.querySelector('.pf-name').value.trim() || undefined;
    patch.type = form.querySelector('.pf-type').value;
    patch.notes = form.querySelector('.pf-notes').value;
    if (!patch.name) delete patch.name;
  }
  const btn = form?.querySelector('.pf-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const newId = await Proposals.saveDraft(id, patch);
    refreshAfterProposalChange();
    AuthUI.renderAccount();
    openProposal(newId);
  } catch (err) {
    toast(`Couldn't save: ${err.message}`);
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}

// Jump to a saved site from the account menu, loading its ZIP first if needed.
function goToProposal(zip, id) {
  if (zip === state.zip && state.layers.proposals) {
    showTab('map');
    openProposal(id);
    return;
  }
  state.pendingOpen = id;
  submitZip(zip, null);
}

function openProposal(id) {
  const marker = state.layers.proposals?.getLayers().find(m => m.proposalId === id);
  if (marker) { map.panTo(marker.getLatLng()); marker.openPopup(); }
}

function refreshAfterProposalChange() {
  renderProposalMarkers();
  if (Map3D.active) Map3D.syncData();
  if (state.samples.length) drawGapLayer();
  syncLayerVisibility();
  renderProfile();
}

function renderProposalMarkers() {
  if (!state.layers.proposals) return;
  state.layers.proposals.clearLayers();
  Proposals.forZip(state.zip).forEach(p => state.layers.proposals.addLayer(proposalMarker(p)));
}

function renderProposals() {
  const list = state.zip ? Proposals.forZip(state.zip) : [];
  const card = $('#proposals-card');
  if (!card) return;
  card.innerHTML = `
    <h3>Your proposed sites</h3>
    ${list.length ? `
      <ol class="proposal-list">${list.map(p => `<li><button type="button" data-open="${p.id}"><span>${esc(p.name)}</span><small>${p.userId ? '<b class="saved-tag">Saved</b>' : '<b class="draft-tag">Draft</b>'} ${esc(p.type)}</small></button></li>`).join('')}</ol>
      <div class="row-actions">
        <button type="button" class="btn-secondary" id="export-btn">Export GeoJSON</button>
        <button type="button" class="btn-link" id="clear-btn">Clear all</button>
      </div>` : `<p class="muted">Use <strong>＋ Propose a green space</strong> on the map to drop candidate sites. Each one shows its walk-access impact, and the access meters update. Press <strong>Save</strong> on a pin to keep it in your account.</p>`}`;
}

function exportProposals() {
  const list = Proposals.forZip(state.zip);
  const fc = turf.featureCollection(list.map(p => turf.point([p.lng, p.lat], {
    name: p.name, type: p.type, notes: p.notes, zip: p.zip,
    nearest_park_m: Math.round(Analysis.nearestPark(p.lng, p.lat, state.parks).dist),
  })));
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `green-space-proposals-${state.zip}.geojson` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------- Routing & events ----------------

function showLanding() {
  $('#planner').hidden = true;
  $('#landing').hidden = false;
  document.title = 'Greenify NYC';
  $('#landing-zip').focus();
}

function showPlanner() {
  $('#landing').hidden = true;
  $('#planner').hidden = false;
  if (map) setTimeout(() => map.invalidateSize(), 0);
}

function route() {
  const zip = new URLSearchParams(location.hash.slice(1)).get('zip');
  if (zip && /^\d{5}$/.test(zip)) {
    document.title = `${zip} · Greenify NYC`;
    loadZip(zip);
  } else if (location.hash === '#explore') {
    showOpenMap();
  } else {
    showLanding();
  }
}

// ---------------- Selecting ZIPs from the map ----------------

async function selectZipAt(latlng) {
  if (Date.now() - (state.popupOpenedAt || 0) < 500) return;
  const here = turf.point([latlng.lng, latlng.lat]);
  if (state.zipFeature && turf.booleanPointInPolygon(here, state.zipFeature)) return;
  setLoading('Finding the ZIP code here…');
  let zip = null;
  try {
    zip = await Data.zipAt([latlng.lng, latlng.lat]);
  } catch (err) {
    console.error(err);
  }
  setLoading(null);
  if (!zip) {
    toast('No NYC ZIP code here. Click on land within the five boroughs.');
    return;
  }
  submitZip(zip, null);
}

function clearZipSelection() {
  if (location.hash === '#explore') return;
  location.hash = 'explore';
}

// The map with no ZIP selected: no highlight or neighborhood layers, just the basemap.
function showOpenMap() {
  state.loadToken++;          // cancel any ZIP still loading
  showPlanner();
  showTab('map');
  initMap();
  clearTimeout(state.clickTimer);
  setProposing(false);
  if (state.visible.view3d) { state.visible.view3d = false; Map3D.disable(); }
  Map3D.reset();
  clearLayers();
  map.closePopup();
  Object.assign(state, { zip: null, zipFeature: null, parks: [], gardens: [], natural: [], samples: [], metrics: null });
  $('#top-zip').value = '';
  setLoading(null);
  document.title = 'Map · Greenify NYC';
  $('#profile').innerHTML = `
    <div class="profile-head">
      <div class="profile-top"><div class="kicker">Map</div>${zipForm('')}</div>
      <h2>No ZIP selected</h2>
    </div>
    <p class="form-error" data-zip-error></p>
    <div class="card open-map-card">
      <div class="empty-icon">🗺️</div>
      <p><strong>Click anywhere on the map</strong> to load that neighborhood's profile, parks and green-space data, or enter a ZIP code above.</p>
      <p class="muted small">Tip: with a ZIP selected, click a neighboring area to switch to it, or double-click to clear the selection again.</p>
    </div>`;
}

function submitZip(value, errorEl) {
  const zip = value.trim();
  const fail = msg => (errorEl ? (errorEl.textContent = msg) : toast(msg));
  if (!/^\d{5}$/.test(zip)) return fail('Enter a 5-digit ZIP code.');
  if (!/^1(0[0-4]|1[0-6])\d{2}$/.test(zip)) return fail('That ZIP is outside New York City (NYC ZIPs start with 100–104 or 110–116).');
  if (errorEl) errorEl.textContent = '';
  if (location.hash === `#zip=${zip}`) route();
  else location.hash = `zip=${zip}`;
}

$('#landing-form').addEventListener('submit', e => { e.preventDefault(); submitZip($('#landing-zip').value, $('#landing-error')); });
$('#top-form').addEventListener('submit', e => { e.preventDefault(); submitZip($('#top-zip').value, null); });
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => submitZip(c.dataset.zip, $('#landing-error'))));
$('#home-link').addEventListener('click', e => { e.preventDefault(); location.hash = ''; });
function showTab(name) {
  if (name !== 'build' && Advisor.designerSize !== 'normal') Advisor.setDesignerSize('normal');
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== name; });
  if (name === 'map' && map) setTimeout(() => map.invalidateSize(), 0);
  if (name === 'build') Advisor.show();
  if (name === 'community') Community.show();
  if (name === 'explore' && !explorePanel.innerHTML) renderExploreQuiz();
}

const explorePanel = $('#explore-panel');

function renderExploreQuiz() {
  explorePanel.innerHTML = `
    <div class="explore-shell">
      <header class="explore-heading">
        <div><span class="kicker">A different side of New York</span><h1>Find your next outside.</h1><p>Pick a borough, a pace, and the kind of wild you want. We’ll find a park worth the trip.</p></div>
        <span class="explore-index">NYC / FIELD GUIDE</span>
      </header>
      <form id="explore-form" class="explore-form">
        <fieldset class="quiz-step"><legend><span>01</span> Where are you headed?</legend><p class="quiz-hint">Choose one or more boroughs.</p>
          <div class="choice-grid borough-choices">${['Bronx', 'Manhattan', 'Queens', 'Brooklyn', 'Staten Island'].map((name, i) => `<label class="choice-card"><input type="checkbox" name="borough" value="${name}"><span class="choice-check"></span><span class="choice-name">${name}</span><span class="choice-number">0${i + 1}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset class="quiz-step"><legend><span>02</span> Choose your pace.</legend><div class="choice-grid pace-choices">
          ${[['paved', 'Stroll', 'Paved paths, an easy-going pace'], ['unpaved', 'Nature walk', 'Natural surfaces, a little wandering'], ['steep', 'Hike', 'Uneven trails and steeper climbs']].map(([value, title, desc]) => `<label class="choice-card"><input type="radio" name="terrain" value="${value}" required><span class="choice-check"></span><span class="choice-name">${title}</span><span class="choice-desc">${desc}</span></label>`).join('')}
        </div></fieldset>
        <fieldset class="quiz-step"><legend><span>03</span> What do you want to find?</legend><div class="choice-grid experience-choices">
          ${[['beach', 'A beach'], ['views', 'Breathtaking views'], ['woods', 'Deep-woods canopy'], ['wildlife', 'Wildlife & hidden wetlands'], ['historic', 'Historic ruins & architecture']].map(([value, title]) => `<label class="choice-card"><input type="radio" name="experience" value="${value}" required><span class="choice-check"></span><span class="choice-name">${title}</span></label>`).join('')}
        </div></fieldset>
        <div class="quiz-submit"><p id="explore-error" class="form-error" role="alert"></p><button class="explore-button" type="submit">Show me the parks <span aria-hidden="true">→</span></button></div>
      </form>
    </div>`;
}

function parkScore(park, preferences) {
  let score = preferences.boroughs.includes(park.borough) ? 5 : 0;
  if (park.terrain.includes(preferences.terrain)) score += 3;
  if (park.experiences.includes(preferences.experience)) score += 4;
  return score;
}

function parkDirections(park) {
  const destination = encodeURIComponent(`${park.name}, ${park.borough}, NY`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

function renderExploreMatches() {
  const park = exploreState.matches[exploreState.index];
  if (!park) return;
  const guide = PARK_GUIDE[park.name];
  const position = exploreState.index + 1;
  explorePanel.innerHTML = `
    <div class="explore-shell">
      <div class="results-topline"><div><span class="kicker">Your field guide</span><h1>Somewhere new.</h1></div><button type="button" class="text-button" data-explore-restart>Start over</button></div>
      <div class="results-meta"><span>${exploreState.matches.length} parks picked for you</span><span>${String(position).padStart(2, '0')} <i>/</i> ${String(exploreState.matches.length).padStart(2, '0')}</span></div>
      <article class="park-card" data-swipe-card>
        <div class="park-photo"><img src="${esc(park.image)}" alt="${esc(park.imageAlt)}"><a class="photo-credit" href="${esc(park.photoSource)}" target="_blank" rel="noopener">Photo: ${esc(park.photoCredit)} ↗</a><span class="park-borough">${esc(park.borough)}</span></div>
        <div class="park-copy"><div class="park-route">FIELD NOTE / ${esc(park.route)}</div><h2>${esc(park.name)}</h2>
          <p class="park-known">${esc(park.known)}</p>
          <p class="park-why"><span>WHY GO</span>${esc(guide.why)}</p>
          <div class="park-details"><div><h3>On the ground</h3><p>${esc(park.expect)}</p></div><div><h3>Facilities</h3><p>${esc(park.facilities)}</p></div></div>
          <div class="park-tags">${park.tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div>
          <div class="park-actions"><button type="button" class="button-outline" data-match-prev ${position === 1 ? 'disabled' : ''} aria-label="Previous park">← <span>Previous</span></button><span class="swipe-hint">Swipe to explore</span><button type="button" class="button-outline" data-match-next ${position === exploreState.matches.length ? 'disabled' : ''} aria-label="Next park"><span>Next</span> →</button></div>
          <button type="button" class="explore-button choose-park" data-choose-park>Make this the trip <span aria-hidden="true">↗</span></button>
        </div>
      </article>
    </div>`;
}

function nearbySpotDirections(park, spot) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name} near ${park.name}, ${park.borough}, New York`)}`;
}

function itineraryText(park) {
  const guide = PARK_GUIDE[park.name];
  const stops = [
    ...guide.explore.map(spot => ({ ...spot, type: 'In the park' })),
    ...(NEARBY_SPOTS[park.name] || []),
  ].map(spot => `${spot.type}: ${spot.name}\n${spot.detail}\nMaps: ${nearbySpotDirections(park, spot)}`
  ).join('\n');
  const notes = guide.notes.map(note => `${note.label}: ${note.detail}`).join('\n');
  return `NYC GREEN SPACE / TRIP RECEIPT\n${park.name} · ${park.borough}\nSuggested route: ${park.route}\n\nWHY THIS PARK\n${guide.why}\n\nGETTING THERE\nGoogle Maps: ${parkDirections(park)}\n\nSPACES TO EXPLORE\n${stops}\n\nFIELD NOTES\n${notes}\n\nPACK FOR THE PATH\n${park.prep}\n\nCheck current hours and access before setting out.`;
}

function renderExploreItinerary() {
  const park = exploreState.selected;
  if (!park) return;
  const guide = PARK_GUIDE[park.name];
  const stops = [
    ...guide.explore.map(spot => ({ ...spot, type: 'In the park' })),
    ...(NEARBY_SPOTS[park.name] || []),
  ];
  const issued = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  explorePanel.innerHTML = `
    <div class="explore-shell itinerary-shell is-printing">
      <div class="receipt-topline"><span class="kicker">Your day outside / ${esc(park.borough)}</span><button type="button" class="text-button" data-explore-restart>Start a new search</button></div>
      <div class="receipt-printer is-printing">
        <div class="printer-casing"><span class="printer-status" role="status" aria-live="polite"><span class="printer-lights" aria-hidden="true"><i></i><i></i><i></i></span><span class="printer-status-label">PRINTING RECEIPT</span></span><span class="printer-slot" aria-hidden="true"></span></div>
      <article id="itinerary-receipt" class="itinerary-receipt is-printing" aria-hidden="true">
        <header class="receipt-header"><div class="receipt-brand"><span>NYC / OUTSIDE</span><strong>FIELD RECEIPT</strong></div><div class="receipt-number"><span>TRIP NOTE</span><strong>${String(exploreState.index + 1).padStart(2, '0')} / ${String(exploreState.matches.length).padStart(2, '0')}</strong></div></header>
        <div class="receipt-body">
          <p class="receipt-date">ISSUED ${esc(issued)} · ${esc(park.borough.toUpperCase())}</p>
          <h1>${esc(park.name)}</h1><p class="receipt-route">${esc(park.route)}</p>
          <p class="receipt-why">${esc(guide.why)}</p>
          <div class="receipt-stickers" aria-label="Park highlights"><span class="receipt-sticker sticker-sun"><b aria-hidden="true">✦</b> FIELD PICK</span><span class="receipt-sticker sticker-leaf">${esc(park.tags[0])}</span><span class="receipt-sticker sticker-sky">${esc(park.tags[1])}</span></div>
          <section class="receipt-destination"><div><span class="receipt-label">DESTINATION</span><p>${esc(park.name)}, ${esc(park.borough)}, New York</p><a class="map-link" href="${parkDirections(park)}" target="_blank" rel="noopener">Open Google Maps directions <span aria-hidden="true">↗</span></a></div><div id="receipt-qr" class="receipt-qr" role="img" aria-label="QR code for directions to ${esc(park.name)}"></div></section>
          <section class="receipt-section"><div class="receipt-section-heading"><span>01</span><h2>Spaces to explore</h2></div><p class="receipt-section-intro">A few ways to shape the day, from the trail itself to neighborhood culture.</p>
            <ul class="nearby-stops">${stops.map(spot => `<li><span class="stop-type">${esc(spot.type)}</span><div class="stop-copy"><strong>${esc(spot.name)}</strong><p>${esc(spot.detail)}</p></div><a href="${nearbySpotDirections(park, spot)}" target="_blank" rel="noopener">Map <span aria-hidden="true">↗</span></a></li>`).join('')}</ul>
          </section>
          <div class="receipt-lower">
            <section class="receipt-field prep-block"><div class="receipt-section-heading"><span>02</span><h2>Pack for the path</h2></div><p>${esc(park.prep)}</p></section>
            <section class="receipt-field receipt-know"><div class="receipt-section-heading"><span>03</span><h2>Know before you go</h2></div><ul class="field-notes">${guide.notes.map(note => `<li><strong>${esc(note.label)}</strong><p>${esc(note.detail)}</p></li>`).join('')}</ul></section>
          </div>
        </div>
        <footer class="receipt-footer"><span>TAKE THE LONG WAY HOME</span><span>NYC GREEN SPACE FIELD GUIDE</span></footer>
      </article>
      </div>
      <div class="receipt-actions" data-html2canvas-ignore><button type="button" class="explore-button" data-download-itinerary disabled>Download receipt PNG <span aria-hidden="true">↓</span></button><button type="button" class="button-outline" data-email-itinerary disabled>Email itinerary <span aria-hidden="true">↗</span></button></div>
      <p id="receipt-export-status" class="receipt-export-status" role="status" aria-live="polite"></p>
      <button type="button" class="text-button back-to-matches" data-back-matches>← Back to park matches</button>
    </div>`;
  const receipt = $('#itinerary-receipt');
  const printer = $('.receipt-printer');
  const printControls = explorePanel.querySelectorAll('[data-download-itinerary], [data-email-itinerary]');
  receipt.setAttribute('aria-hidden', 'true');
  let printFallback;
  let printFinished = false;
  const finishPrinting = () => {
    if (printFinished) return;
    printFinished = true;
    clearTimeout(printFallback);
    receipt.classList.remove('is-printing');
    receipt.classList.add('is-printed');
    receipt.removeAttribute('aria-hidden');
    printer.classList.remove('is-printing');
    explorePanel.querySelector('.itinerary-shell').classList.remove('is-printing');
    printer.querySelector('.printer-status-label').textContent = 'READY / TEAR TO TAKE';
    printControls.forEach(control => { control.disabled = false; });
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishPrinting();
  else {
    const duration = Number.parseFloat(getComputedStyle(receipt).animationDuration) * 1000;
    printFallback = setTimeout(finishPrinting, duration + 500);
    receipt.addEventListener('animationend', event => {
      if (event.animationName === 'receipt-feed') finishPrinting();
    }, { once: true });
  }
  if (window.QRCode) {
    new QRCode($('#receipt-qr'), { text: parkDirections(park), width: 84, height: 84, colorDark: '#10261a', colorLight: '#fffdf8', correctLevel: QRCode.CorrectLevel.M });
  }
}

async function tearReceipt() {
  const printer = $('.receipt-printer');
  if (!printer || printer.classList.contains('is-torn')) return;
  const buttons = explorePanel.querySelectorAll('[data-download-itinerary], [data-email-itinerary]');
  buttons.forEach(button => { button.disabled = true; });
  printer.classList.add('is-tearing');
  printer.querySelector('.printer-status-label').textContent = 'TEARING RECEIPT';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  await new Promise(resolve => setTimeout(resolve, reducedMotion ? 0 : 760));
  printer.classList.remove('is-tearing');
  printer.classList.add('is-torn');
  printer.querySelector('.printer-status-label').textContent = 'TICKET DETACHED';
}

async function downloadItineraryPng() {
  const receipt = $('#itinerary-receipt');
  const status = $('#receipt-export-status');
  if (!receipt || !window.html2canvas) {
    status.textContent = 'Receipt image export is unavailable. Check your connection and try again.';
    return;
  }
  try {
    const canvas = await html2canvas(receipt, { backgroundColor: '#fffdf8', scale: 2, logging: false });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG export did not complete.');
    await tearReceipt();
    const href = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), {
      href,
      download: `${exploreState.selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-itinerary.png`,
    });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    status.textContent = 'Receipt torn free and saved as a PNG.';
  } catch (error) {
    console.error(error);
    status.textContent = 'Could not create the receipt image. Try again after the page finishes loading.';
  }
}

explorePanel.addEventListener('submit', event => {
  if (event.target.id !== 'explore-form') return;
  event.preventDefault();
  const form = new FormData(event.target);
  const boroughs = form.getAll('borough');
  if (!boroughs.length) {
    $('#explore-error').textContent = 'Choose at least one borough to see your matches.';
    return;
  }
  const preferences = { boroughs, terrain: form.get('terrain'), experience: form.get('experience') };
  exploreState.matches = EXPLORE_PARKS.map(park => ({ park, score: parkScore(park, preferences) }))
    .filter(result => preferences.boroughs.includes(result.park.borough))
    .sort((a, b) => b.score - a.score)
    .map(result => result.park);
  exploreState.index = 0;
  exploreState.selected = null;
  renderExploreMatches();
});

explorePanel.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.matches('[data-explore-restart]')) { exploreState.selected = null; renderExploreQuiz(); }
  if (target.matches('[data-match-prev]') && exploreState.index > 0) { exploreState.index--; renderExploreMatches(); }
  if (target.matches('[data-match-next]') && exploreState.index < exploreState.matches.length - 1) { exploreState.index++; renderExploreMatches(); }
  if (target.matches('[data-choose-park]')) { exploreState.selected = exploreState.matches[exploreState.index]; renderExploreItinerary(); }
  if (target.matches('[data-back-matches]')) renderExploreMatches();
  if (target.matches('[data-download-itinerary]')) downloadItineraryPng();
  if (target.matches('[data-email-itinerary]')) {
    const subject = encodeURIComponent(`My NYC park day: ${exploreState.selected.name}`);
    const email = `mailto:?subject=${subject}&body=${encodeURIComponent(itineraryText(exploreState.selected))}`;
    tearReceipt().then(() => { location.href = email; });
  }
});

explorePanel.addEventListener('pointerdown', event => {
  if (event.target.closest('button, a')) return;
  exploreState.touchX = event.clientX;
});
explorePanel.addEventListener('pointerup', event => {
  if (exploreState.touchX === null || !explorePanel.querySelector('[data-swipe-card]')) return;
  const delta = event.clientX - exploreState.touchX;
  exploreState.touchX = null;
  if (Math.abs(delta) < 55) return;
  if (delta < 0 && exploreState.index < exploreState.matches.length - 1) exploreState.index++;
  if (delta > 0 && exploreState.index > 0) exploreState.index--;
  renderExploreMatches();
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
$('#propose-btn').addEventListener('click', () => setProposing(!state.proposing));
// Map / 3D switch. 3D is the same as the "3D view" checkbox in Map layers.
function markMapView(view) {
  document.querySelectorAll('[data-map-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapView === view)));
}

function setMapView(view) {
  setProposing(false);
  if (view === '3d' && !state.zipFeature) { toast('Pick a ZIP first to see it in 3D.'); view = 'map'; }
  const want3d = view === '3d';
  if (state.visible.view3d !== want3d) {
    state.visible.view3d = want3d;
    syncLayerVisibility();
    if (state.metrics) renderProfile();
  }
  $('#propose-btn').hidden = view !== 'map';
  markMapView(view);
  if (view === 'map') setTimeout(() => map.invalidateSize(), 0);
}

document.querySelectorAll('[data-map-view]').forEach(b => b.addEventListener('click', () => setMapView(b.dataset.mapView)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setProposing(false); });

$('#sidebar').addEventListener('submit', e => {
  if (!e.target.matches('[data-zip-form]')) return;
  e.preventDefault();
  submitZip(e.target.zip.value, $('[data-zip-error]'));
});
$('#sidebar').addEventListener('change', e => {
  const key = e.target.dataset?.layer;
  if (!key) return;
  state.visible[key] = e.target.checked;
  // Air quality and income both shade whole areas, so show one at a time.
  // Area-shading layers cover the same ground, so show one at a time.
  const SHADING = ['airnow', 'airquality', 'income'];
  if (e.target.checked && SHADING.includes(key)) SHADING.filter(k => k !== key).forEach(k => { state.visible[k] = false; });
  syncLayerVisibility().then(() => {
    if (['airnow', 'airquality', 'income'].includes(key)) renderProfile();
    if (key === 'view3d') $('#propose-btn').hidden = state.visible.view3d;
  });
});
$('#sidebar').addEventListener('click', e => {
  const open = e.target.closest('[data-open]');
  if (open) openProposal(open.dataset.open);
  if (e.target.id === 'export-btn') exportProposals();
  if (e.target.id === 'clear-btn' && confirm(`Remove all proposed sites in ${state.zip}?`)) {
    Proposals.clearZip(state.zip);
    refreshAfterProposalChange();
  }
});

window.addEventListener('hashchange', route);
