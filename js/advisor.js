// "Build Ideas" tab: pick a spot, ask how to green it, get nearby opportunities and plant picks.

const SPACE_OPTIONS = {
  auto: 'whatever fits best',
  treepit: 'a street tree bed',
  busstop: 'a bus stop',
  lot: 'a vacant lot',
  rooftop: 'a rooftop',
  yard: 'a yard, courtyard or schoolyard',
  planter: 'a sidewalk planter or window box',
};
const SPACE_LABELS = {
  treepit: 'Street tree bed', busstop: 'Bus stop', lot: 'Vacant lot',
  rooftop: 'Rooftop', yard: 'Yard / courtyard', planter: 'Planter / window box',
};
const GOAL_OPTIONS = {
  pollinators: 'attract bees and butterflies',
  food: 'grow food',
  cooling: 'cool the block with shade',
  stormwater: 'soak up stormwater',
  lowcare: 'keep it low-maintenance',
};
const SUN_INFO = {
  full: { label: 'Full sun', hours: '6+ hours of direct sun', icon: '☀️' },
  part: { label: 'Part sun', hours: 'about 3–6 hours of direct sun', icon: '⛅' },
  shade: { label: 'Shade', hours: 'under 3 hours of direct sun', icon: '☁️' },
};

const LINKS = {
  treeRequest: 'https://www.nycgovparks.org/trees/street-tree-planting/request',
  portal311: 'https://portal.311.nyc.gov/',
  greenthumb: 'https://www.nycgovparks.org/greenthumb',
  dep: 'https://www.nyc.gov/site/dep/water/green-infrastructure.page',
};

const Advisor = {
  map: null,
  layers: null,
  point: null,        // [lng, lat]
  context: null,      // data fetched for the point
  space: 'auto',
  goal: 'pollinators',
  token: 0,

  show() {
    if (!this.map) this.init();
    setTimeout(() => this.map.invalidateSize(), 0);
    if (state.zipFeature && this.fittedZip !== state.zip) {
      this.fittedZip = state.zip;
      this.zipOutline?.remove();
      this.zipOutline = L.geoJSON(state.zipFeature, {
        style: { color: '#10261a', weight: 2, dashArray: '6 5', fill: false }, interactive: false,
      }).addTo(this.map);
      if (!this.point) this.map.fitBounds(this.zipOutline.getBounds(), { padding: [20, 20] });
    }
  },

  init() {
    this.map = L.map('advisor-map', { zoomControl: false }).setView([40.73, -73.95], 12);
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagery &copy; Esri',
    });
    L.control.layers({ Map: streets, Satellite: satellite }, null, { position: 'topright' }).addTo(this.map);
    this.layers = L.layerGroup().addTo(this.map);
    this.map.on('click', e => this.select([e.latlng.lng, e.latlng.lat]));

    const panel = $('#advisor-panel');
    panel.addEventListener('change', e => {
      if (e.target.id === 'adv-space') this.space = e.target.value;
      if (e.target.id === 'adv-goal') this.goal = e.target.value;
      if (this.context) this.renderAnswer();
    });
    panel.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'locate') this.locate();
      if (btn.dataset.action === 'petition') Community.startPetition(JSON.parse(btn.dataset.prefill));
      if (btn.dataset.action === 'fly') this.map.flyTo([+btn.dataset.lat, +btn.dataset.lng], 18);
    });
    this.renderAsk();
  },

  locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => this.select([pos.coords.longitude, pos.coords.latitude], true),
      () => { $('#adv-answer').innerHTML = `<p class="muted">Couldn't get your location. Click the map instead.</p>`; },
    );
  },

  renderAsk() {
    const opts = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
    $('#advisor-panel').innerHTML = `
      <div class="kicker">Build ideas</div>
      <h2 class="panel-title">How can I add green space here?</h2>
      <div class="ask">
        <p class="ask-sentence">
          I want to <select id="adv-goal" aria-label="Goal">${opts(GOAL_OPTIONS, this.goal)}</select>
          using <select id="adv-space" aria-label="Kind of space">${opts(SPACE_OPTIONS, this.space)}</select>
          at <span id="adv-where" class="ask-where">${this.point ? 'the pinned spot' : 'a spot on the map'}</span>.
        </p>
        <div class="ask-actions">
          <span class="muted small">Click the map to pick a spot, or</span>
          <button type="button" class="btn-secondary btn-green" data-action="locate">Use my location</button>
        </div>
      </div>
      <div id="adv-answer" class="answer">
        <div class="empty-hint">
          <div class="empty-icon">📍</div>
          <p>Pick a spot to see estimated sunlight, nearby places to build (empty tree beds, bus stops, vacant lots, gardens) and plants that fit.</p>
        </div>
      </div>`;
  },

  async select(point, fly) {
    const token = ++this.token;
    this.point = point;
    const [lng, lat] = point;
    if (fly) this.map.flyTo([lat, lng], 17);
    this.layers.clearLayers();
    L.circle([lat, lng], { radius: 250, color: COLORS.proposal, weight: 1.5, dashArray: '4 4', fillOpacity: 0.04, interactive: false }).addTo(this.layers);
    L.marker([lat, lng], {
      icon: L.divIcon({ className: 'proposal-pin', html: '<span><i>?</i></span>', iconSize: [30, 30], iconAnchor: [15, 30] }),
      zIndexOffset: 1000,
    }).addTo(this.layers);
    $('#adv-where').textContent = 'the pinned spot';
    $('#adv-answer').innerHTML = `<p class="muted"><span class="spinner spinner-sm"></span> Looking at buildings, tree beds, bus stops and lots around this spot…</p>`;

    try {
      const box = turf.bbox(turf.buffer(turf.point(point), 1, { units: 'kilometers' }));
      const [buildings, beds, shelters, lots, gardens, parks, address] = await Promise.all([
        Data.buildingsNear(point).catch(() => []),
        Data.emptyTreeBeds(point).catch(() => []),
        Data.busShelters(point).catch(() => []),
        Data.vacantLots({ center: point }).catch(() => []),
        Data.gardens(null, box).catch(() => []),
        Data.parks(box).catch(() => []),
        Data.nearestAddress(point).catch(() => null),
      ]);
      if (token !== this.token) return;

      const here = turf.point(point);
      const dist = (la, ln) => turf.distance(here, turf.point([ln, la]), { units: 'meters' });
      const bedPts = beds.filter(b => b.location).map(b => ({
        address: `${b.buildingnumber ? `${b.buildingnumber} ` : ''}${titleCase(b.streetname || '')}`.trim(),
        lat: b.location.coordinates[1], lng: b.location.coordinates[0],
      })).map(b => ({ ...b, dist: dist(b.lat, b.lng) })).sort((a, b) => a.dist - b.dist);
      const shelterPts = shelters.map(s => ({
        name: `${titleCase(s.on_street)} & ${titleCase(s.cross_stre)}`, lat: +s.latitude, lng: +s.longitude,
      })).map(s => ({ ...s, dist: dist(s.lat, s.lng) })).sort((a, b) => a.dist - b.dist);
      const lotPts = lots.map(l => ({ ...l, dist: dist(l.lat, l.lng) })).filter(l => l.dist < 450 && l.sqft >= 500).sort((a, b) => a.dist - b.dist);
      const gardenPts = gardens.map(g => {
        const [ln, la] = turf.centroid(g).geometry.coordinates;
        return { name: g.properties.name, address: g.properties.address, lat: la, lng: ln, dist: dist(la, ln) };
      }).sort((a, b) => a.dist - b.dist);

      this.context = {
        sun: Analysis.sunlight(point, buildings),
        beds: bedPts, shelters: shelterPts, lots: lotPts, gardens: gardenPts,
        nearestPark: Analysis.nearestPark(lng, lat, parks),
        address: address ? `${address.buildingnumber ? `${address.buildingnumber} ` : ''}${titleCase(address.streetname)}` : null,
        zip: address?.zipcode ? String(address.zipcode).split('.')[0] : state.zip,
      };
      this.drawContext();
      this.renderAnswer();
    } catch (err) {
      console.error(err);
      if (token === this.token) $('#adv-answer').innerHTML = `<p class="muted">Couldn't load data for this spot. Try again in a moment.</p>`;
    }
  },

  drawContext() {
    const c = this.context;
    const dot = (color, r = 5) => ({ radius: r, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 1 });
    c.beds.forEach(b => L.circleMarker([b.lat, b.lng], dot('#8a5a2b', 4)).bindTooltip(`Empty tree bed · ${esc(b.address)}`).addTo(this.layers));
    c.shelters.forEach(s => L.circleMarker([s.lat, s.lng], dot('#2b6cb0', 6)).bindTooltip(`Bus shelter · ${esc(s.name)}`).addTo(this.layers));
    c.lots.forEach(l => L.circleMarker([l.lat, l.lng], dot('#c0392b', 6)).bindTooltip(`Vacant lot · ${esc(titleCase(l.address))}`).addTo(this.layers));
    c.gardens.slice(0, 10).forEach(g => L.circleMarker([g.lat, g.lng], dot(COLORS.garden, 6)).bindTooltip(`Garden · ${esc(g.name)}`).addTo(this.layers));
  },

  // Guess the kind of space at the pin when the user leaves it on "whatever fits best".
  inferSpace() {
    const c = this.context;
    if (c.sun.roofHeightFt != null) return 'rooftop';
    const lot = c.lots[0];
    if (lot && lot.dist < Math.sqrt(lot.sqft) * 0.3048 * 0.7 + 12) return 'lot';
    if (c.shelters[0]?.dist < 35) return 'busstop';
    if (c.beds[0]?.dist < 30) return 'treepit';
    if (c.beds.length) return 'treepit';
    return 'planter';
  },

  renderAnswer() {
    const c = this.context;
    const space = this.space === 'auto' ? this.inferSpace() : this.space;
    const sun = SUN_INFO[c.sun.level];
    const parkDist = c.nearestPark.dist;
    const gap = Number.isFinite(parkDist) && parkDist > WALK_5_MIN;

    const sunWhy = c.sun.blocker
      ? `The tallest obstruction to the south is a ~${fmt(c.sun.blocker.heightFt)} ft building ${fmt(c.sun.blocker.dist)} m away, rising ${fmt(c.sun.blocker.angle)}° above the horizon.`
      : 'No taller buildings block the sun from the south.';

    const opportunities = this.opportunities(space).sort((a, b) => (b.key === space) - (a.key === space));
    let plants = Plants.recommend({ sun: c.sun.level, space, goals: [this.goal] });
    if (plants.length < 3) plants = Plants.recommend({ sun: c.sun.level, space: 'planter', goals: [this.goal] });
    const goalMatches = plants.filter(p => p.goals.includes(this.goal)).length;
    const goalNote = goalMatches ? '' : `<p class="note-box">Nothing in our plant list that helps ${esc(GOAL_OPTIONS[this.goal])} does well in ${esc(sun.label.toLowerCase())} ${esc(SPACE_LABELS[space].toLowerCase())}s, so these picks suit the light instead.${this.goal === 'food' ? ' Most food crops need at least part sun. Try a sunnier spot, or herbs like mint and chives in containers.' : ''}</p>`;

    $('#adv-answer').innerHTML = `
      <div class="answer-head">
        <div>
          <div class="answer-where">${esc(c.address ? `Near ${c.address}` : 'Pinned spot')}${c.zip ? ` · ${esc(c.zip)}` : ''}</div>
          <div class="muted small">${this.space === 'auto' ? `Best fit here: <strong>${esc(SPACE_LABELS[space])}</strong>` : esc(SPACE_LABELS[space])}</div>
        </div>
      </div>
      <div class="facts">
        <div class="fact sun-${c.sun.level}"><span class="fact-icon">${sun.icon}</span><div><strong>${sun.label}</strong><span>${sun.hours} in the growing season (estimate)</span></div></div>
        <div class="fact ${gap ? 'fact-gap' : ''}"><span class="fact-icon">🌳</span><div><strong>${Number.isFinite(parkDist) ? `${fmt(parkDist)} m to a park` : 'No park nearby'}</strong><span>${gap ? 'Park access gap: new green space here helps most.' : esc(c.nearestPark.name || '')}</span></div></div>
      </div>
      <p class="muted small sun-why">${esc(sunWhy)}${c.sun.roofHeightFt != null ? ` This spot is on a roof about ${fmt(c.sun.roofHeightFt)} ft up.` : ''}</p>

      <h3 class="answer-h">Places to build around here</h3>
      <div class="opps">${opportunities.map(o => this.oppCard(o, o.key === space)).join('')}</div>

      <h3 class="answer-h">Plants for ${esc(sun.label.toLowerCase())} ${esc(SPACE_LABELS[space].toLowerCase())}s that ${esc(GOAL_OPTIONS[this.goal])}</h3>
      ${goalNote}
      <div class="plants">${plants.map(p => `
        <div class="plant">
          <div class="plant-top"><strong>${esc(p.name)}</strong>${p.native ? '<span class="tag tag-native">NYC native</span>' : ''}</div>
          <div class="plant-latin">${esc(p.latin)} · ${esc(p.kind)}</div>
          <p>${esc(p.note)}</p>
          <div class="plant-sun">${p.sun.map(s => `<span title="${SUN_INFO[s].label}">${SUN_INFO[s].icon}</span>`).join('')}</div>
        </div>`).join('') || '<p class="muted">No plants in our list match this combination. Try a different goal.</p>'}
      </div>
      <p class="footnote">Sunlight is estimated from NYC building footprint heights to the south of the pin. It doesn't account for trees, awnings or the direction a wall faces, so check the spot in person. Nearby features come from NYC Open Data: Forestry Planting Spaces, Bus Stop Shelters, PLUTO (vacant land) and GreenThumb.</p>`;
  },

  opportunities(space) {
    const c = this.context;
    const list = [];
    const near = (arr, fmtFn) => arr.slice(0, 3).map(x =>
      `<li><button type="button" class="linkish" data-action="fly" data-lat="${x.lat}" data-lng="${x.lng}">${esc(fmtFn(x))}</button> <span class="muted">${fmt(x.dist)} m</span></li>`).join('');
    const petitionBtn = prefill => `<button type="button" class="btn-secondary" data-action="petition" data-prefill="${esc(JSON.stringify(prefill))}">Start a petition</button>`;

    if (c.beds.length || space === 'treepit') {
      list.push({
        key: 'treepit', icon: '🌱',
        title: c.beds.length ? `Plant a street tree: ${c.beds.length} empty tree bed${c.beds.length > 1 ? 's' : ''} within 250 m` : 'Plant a street tree',
        body: `${c.beds.length ? `<ul>${near(c.beds, b => b.address || 'Tree bed')}</ul>` : '<p>No empty tree beds are mapped right here, but you can still request a tree for a sidewalk in front of a building.</p>'}
          <ol class="steps">
            <li>Request a free street tree from NYC Parks for the address (online or through 311).</li>
            <li>Parks checks the site for utilities and sidewalk width, then plants.</li>
            <li>Care for it: loosen the soil and give it about 20 gallons of water a week in summer.</li>
          </ol>
          <div class="opp-links"><a href="${LINKS.treeRequest}" target="_blank" rel="noopener">Request a street tree ↗</a><a href="${LINKS.portal311}" target="_blank" rel="noopener">NYC 311 ↗</a></div>`,
      });
    }
    if (c.shelters.length || space === 'busstop') {
      const s = c.shelters[0];
      list.push({
        key: 'busstop', icon: '🚏',
        title: c.shelters.length ? `Green a bus stop: ${c.shelters.length} shelter${c.shelters.length > 1 ? 's' : ''} within 300 m` : 'Green a bus stop',
        body: `${c.shelters.length ? `<ul>${near(c.shelters, x => x.name)}</ul>` : ''}
          <p>Shelter roofs can carry a thin sedum mat (a "bee bus stop"), and the curb beside a stop can hold planters or a bioswale that catches runoff.</p>
          <ol class="steps">
            <li>NYC DOT manages bus shelters, so rally riders and neighbors behind the idea.</li>
            <li>Bring it to your Community Board and Council Member with a petition.</li>
          </ol>
          <div class="opp-actions">${petitionBtn({ siteType: 'Bus stop', location: s ? `Bus shelter at ${s.name}` : '', target: 'NYC DOT', title: s ? `Green roof for the ${s.name} bus stop` : 'Green roofs for our bus stops', lat: s?.lat, lng: s?.lng, zip: c.zip })}</div>`,
      });
    }
    if (c.lots.length || space === 'lot') {
      list.push({
        key: 'lot', icon: '🟫',
        title: c.lots.length ? `Transform a vacant lot: ${c.lots.length} within ~400 m` : 'Transform a vacant lot',
        body: c.lots.length ? `<ul class="lots">${c.lots.slice(0, 3).map(l => `
            <li>
              <div><button type="button" class="linkish" data-action="fly" data-lat="${l.lat}" data-lng="${l.lng}">${esc(titleCase(l.address))}</button> <span class="muted">${fmt(l.dist)} m · ${fmt(l.sqft)} sq ft</span></div>
              <div class="small">${l.publicOwner ? '<span class="tag tag-public">Public</span>' : '<span class="tag">Private</span>'} ${esc(titleCase(l.owner))}</div>
              ${petitionBtn({ siteType: 'Vacant lot', location: `${titleCase(l.address)} (${fmt(l.sqft)} sq ft, BBL ${l.bbl})`, target: l.publicOwner ? 'NYC Parks / GreenThumb' : 'Property owner', title: `Turn ${titleCase(l.address)} into a community green space`, lat: l.lat, lng: l.lng, zip: l.zip || c.zip })}
            </li>`).join('')}</ul>
          <p>City-owned lots can become community gardens through GreenThumb. For private lots, ask the owner about a temporary garden agreement.</p>
          <div class="opp-links"><a href="${LINKS.greenthumb}" target="_blank" rel="noopener">GreenThumb ↗</a></div>`
          : '<p>No vacant lots are recorded within walking distance of this pin.</p>',
      });
    }
    if (space === 'rooftop') {
      list.push({
        key: 'rooftop', icon: '🏢', title: 'Build a green roof',
        body: `<ol class="steps">
            <li>Have a structural engineer confirm the roof can carry saturated soil. Sedum systems are the lightest.</li>
            <li>Choose extensive (3–6″ soil, sedums and grasses) or intensive (deeper beds for food gardens).</li>
            <li>Ask about NYC's green roof property tax abatement before you build.</li>
          </ol>`,
      });
    }
    if (space === 'yard' || space === 'planter' || this.goal === 'stormwater') {
      list.push({
        key: space === 'planter' ? 'planter' : 'yard', icon: '💧', title: space === 'planter' ? 'Planters & rain gardens' : 'Rain garden or courtyard planting',
        body: `<p>${space === 'planter' ? 'Planters on the public sidewalk need to follow NYC DOT rules. Keep a clear walking path and check before placing them.' : 'A shallow planted basin that collects roof or pavement runoff keeps water out of the sewers during storms.'}</p>
          <div class="opp-links"><a href="${LINKS.dep}" target="_blank" rel="noopener">DEP green infrastructure ↗</a></div>`,
      });
    }
    if (c.gardens.length) {
      list.push({
        key: 'garden', icon: '🥕', title: `Join a community garden: ${c.gardens[0].name}`,
        body: `<ul>${near(c.gardens, g => g.name)}</ul><p>Existing GreenThumb gardens often have plots, workdays and waitlists. It's the fastest way to start growing.</p>`,
      });
    }
    return list;
  },

  oppCard(o, primary) {
    return `<details class="opp${primary ? ' opp-primary' : ''}" ${primary ? 'open' : ''}>
      <summary><span class="opp-icon">${o.icon}</span><span>${esc(o.title)}</span></summary>
      <div class="opp-body">${o.body}</div>
    </details>`;
  },
};

const KEEP_UPPER = new Set(['NYC', 'NYS', 'HPD', 'DCAS', 'DOT', 'DEP', 'MTA', 'LLC', 'LP', 'II', 'III']);

function titleCase(s) {
  return String(s || '').toLowerCase()
    .replace(/\b([a-z])/g, m => m.toUpperCase())
    .replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (m, n, suf) => n + suf.toLowerCase())
    .replace(/\b[A-Za-z]+\b/g, w => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w))
    .replace(/(?!^)\b(Of|And|The|For|At|On)\b/g, w => w.toLowerCase());
}
