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

const PROPOSAL_TYPES = ['Pocket park', 'Community garden', 'Street tree planting', 'Greenway / green street', 'Playground', 'Green roof', 'Rain garden / bioswale'];
const STORAGE_KEY = 'gsp-proposals-v1';

const state = {
  zip: null,
  zipFeature: null,
  parks: [],
  gardens: [],
  natural: [],
  samples: [],
  metrics: null,
  layers: {},
  visible: { parks: true, natural: true, gardens: true, trees: false, gaps: false },
  proposing: false,
  loadToken: 0,
};

// ---------------- Proposals (saved in this browser) ----------------

const Proposals = {
  all() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  },
  save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  },
  forZip(zip) { return this.all().filter(p => p.zip === zip); },
  add(p) { const list = this.all(); list.push(p); this.save(list); },
  update(id, patch) { this.save(this.all().map(p => (p.id === id ? { ...p, ...patch } : p))); },
  remove(id) { this.save(this.all().filter(p => p.id !== id)); },
  clearZip(zip) { this.save(this.all().filter(p => p.zip !== zip)); },
};

// ---------------- Map ----------------

let map;

function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([40.71, -73.95], 11);
  L.control.zoom({ position: 'topright' }).addTo(map);

  const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Imagery &copy; Esri',
  });
  L.control.layers({ Map: streets, Satellite: satellite }, null, { position: 'topright' }).addTo(map);
  L.control.scale({ position: 'bottomright', imperial: true, metric: false }).addTo(map);

  map.createPane('gaps').style.zIndex = 390;
  map.createPane('mask').style.zIndex = 395;

  map.on('click', e => { if (state.proposing) addProposal(e.latlng); });
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
  for (const key of ['parks', 'natural', 'gardens', 'trees', 'gaps']) {
    const layer = state.layers[key];
    if (!layer) continue;
    if (state.visible[key] && !map.hasLayer(layer)) layer.addTo(map);
    if (!state.visible[key] && map.hasLayer(layer)) map.removeLayer(layer);
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
      $('#profile').innerHTML = `<div class="card error-card"><h2>ZIP ${esc(zip)} not found</h2><p>That doesn't look like a residential NYC ZIP code. Try another, like 10027 or 11211.</p></div>`;
      return;
    }
    state.zipFeature = zipFeature;

    // Pull in nearby features too, so parks just across the ZIP line count toward walk access.
    const bbox = turf.bbox(turf.buffer(zipFeature, 0.9, { units: 'kilometers' }));
    const interior = turf.pointOnFeature(zipFeature).geometry.coordinates;

    setLoading('Loading parks, gardens, trees and air quality…');
    const [parks, natural, gardens, trees, cd] = await Promise.all([
      Data.parks(bbox),
      Data.naturalAreas(bbox).catch(() => []),
      Data.gardens(zip, bbox).catch(() => []),
      Data.treeSummary(zip).catch(() => null),
      Data.communityDistrict(interior).catch(() => null),
    ]);
    const air = await Data.airQuality(cd).catch(() => null);
    if (token !== state.loadToken) return;

    state.parks = parks;
    state.natural = natural;
    state.gardens = gardens;

    drawBaseLayers();

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
  return `<div class="profile-head"><div class="kicker">Neighborhood profile</div><h2>ZIP ${esc(zip)}</h2><p class="muted">Loading…</p></div>
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

  let aqiTile = statTile('—', 'Air quality index', 'No data for this district');
  if (m.air?.pm25) {
    const aqi = Analysis.pm25ToAqi(m.air.pm25.value);
    const cat = Analysis.aqiCategory(aqi);
    aqiTile = statTile(`<span class="aqi-badge aqi-${cat.tone}">${aqi}</span>`, 'Air quality index', `${cat.label} · from ${m.air.pm25.period} PM2.5`);
  }

  const proposals = Proposals.forZip(m.zip);
  const withProposals = proposals.length && m.access ? Analysis.accessShare(state.samples, proposals) : null;

  $('#profile').innerHTML = `
    <div class="profile-head">
      <div class="kicker">Neighborhood profile</div>
      <h2>ZIP ${esc(m.zip)} <span class="place">${esc(placeName)}</span></h2>
      <p class="muted">${m.population ? `${fmt(m.population)} residents · ` : ''}${fmt(m.zipAcres)} acres${t?.place?.nta ? ` · ${esc(t.place.nta)}` : ''}</p>
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

    ${m.air ? `
    <section class="card">
      <h3>Air quality</h3>
      <p class="muted small">${esc(m.air.district)}</p>
      <dl class="air">
        ${airRow('Fine particles (PM2.5)', m.air.pm25, 'annual mean')}
        ${airRow('Nitrogen dioxide (NO₂)', m.air.no2, 'annual mean')}
        ${airRow('Ozone (O₃)', m.air.o3, 'summer mean')}
      </dl>
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

function airRow(label, v, measure) {
  if (!v) return '';
  return `<div><dt>${esc(label)}</dt><dd>${fmt(v.value, 1)} <small>${esc(v.unit)} · ${esc(measure)}, ${esc(v.period)}</small></dd></div>`;
}

// ---------------- Proposal tool ----------------

function setProposing(on) {
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
  const icon = L.divIcon({ className: 'proposal-pin', html: '<span><i>+</i></span>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
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
    ${inside ? '' : `<div class="muted small">⚠ Outside ZIP ${esc(state.zip)}</div>`}
    <div class="pf-actions"><span class="muted small">Drag the pin to move it</span><button class="pf-delete" type="button">Delete</button></div>`;
  el.querySelector('.pf-name').addEventListener('change', e => { Proposals.update(id, { name: e.target.value.trim() || p.name }); renderProposals(); });
  el.querySelector('.pf-type').addEventListener('change', e => { Proposals.update(id, { type: e.target.value }); renderProposals(); });
  el.querySelector('.pf-notes').addEventListener('change', e => Proposals.update(id, { notes: e.target.value }));
  el.querySelector('.pf-delete').addEventListener('click', () => { map.closePopup(); Proposals.remove(id); refreshAfterProposalChange(); });
  return el;
}

function openProposal(id) {
  const marker = state.layers.proposals?.getLayers().find(m => m.proposalId === id);
  if (marker) { map.panTo(marker.getLatLng()); marker.openPopup(); }
}

function refreshAfterProposalChange() {
  renderProposalMarkers();
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
      <ol class="proposal-list">${list.map(p => `<li><button type="button" data-open="${p.id}"><span>${esc(p.name)}</span><small>${esc(p.type)}</small></button></li>`).join('')}</ol>
      <div class="row-actions">
        <button type="button" class="btn-secondary" id="export-btn">Export GeoJSON</button>
        <button type="button" class="btn-link" id="clear-btn">Clear all</button>
      </div>` : `<p class="muted">Use <strong>＋ Propose a green space</strong> on the map to drop candidate sites. Each one shows its walk-access impact, and the access meters update. Proposals are saved in this browser.</p>`}`;
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
  document.title = 'NYC Green Space Planner';
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
    document.title = `${zip} · NYC Green Space Planner`;
    loadZip(zip);
  } else {
    showLanding();
  }
}

function submitZip(value, errorEl) {
  const zip = value.trim();
  if (!/^\d{5}$/.test(zip)) {
    if (errorEl) errorEl.textContent = 'Enter a 5-digit ZIP code.';
    return;
  }
  if (!/^1(0[0-4]|1[0-6])\d{2}$/.test(zip)) {
    if (errorEl) errorEl.textContent = 'That ZIP is outside New York City (NYC ZIPs start with 100–104 or 110–116).';
    return;
  }
  if (errorEl) errorEl.textContent = '';
  if (location.hash === `#zip=${zip}`) route();
  else location.hash = `zip=${zip}`;
}

$('#landing-form').addEventListener('submit', e => { e.preventDefault(); submitZip($('#landing-zip').value, $('#landing-error')); });
$('#top-form').addEventListener('submit', e => { e.preventDefault(); submitZip($('#top-zip').value, null); });
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => submitZip(c.dataset.zip, $('#landing-error'))));
$('#home-link').addEventListener('click', e => { e.preventDefault(); location.hash = ''; });
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== name; });
  if (name === 'map' && map) setTimeout(() => map.invalidateSize(), 0);
  if (name === 'build') Advisor.show();
  if (name === 'community') Community.show();
}

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
$('#propose-btn').addEventListener('click', () => setProposing(!state.proposing));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setProposing(false); });

$('#sidebar').addEventListener('change', e => {
  const key = e.target.dataset?.layer;
  if (!key) return;
  state.visible[key] = e.target.checked;
  syncLayerVisibility();
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
route();
