// Reusable 3D view: a tilted MapLibre GL map with extruded buildings (OpenFreeMap tiles, no API
// key) overlaid on a Leaflet map. Each map describes its own GeoJSON layers; View3D keeps the
// camera in sync when switching between 2D and 3D. MapLibre is downloaded on first use.

const MAPLIBRE_VERSION = '4.7.1';
const STYLE_3D = 'https://tiles.openfreemap.org/styles/liberty';

function addBasemaps(map, { control = true } = {}) {
  const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Imagery &copy; Esri',
  });
  if (control) L.control.layers({ Map: streets, Satellite: satellite }, null, { position: 'topright' }).addTo(map);
  return { streets, satellite };
}

let maplibreLoading = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve();
  if (!maplibreLoading) {
    maplibreLoading = new Promise((resolve, reject) => {
      const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css` });
      const js = Object.assign(document.createElement('script'), { src: `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`, onload: resolve, onerror: () => { maplibreLoading = null; reject(); } });
      document.head.append(css, js);
    });
  }
  return maplibreLoading;
}

class View3D {
  // container: element (or id) the 3D map fills, positioned over the Leaflet map.
  // leaflet:   () => the Leaflet map to sync the camera with.
  // layers:    () => [{ id, type: 'fill'|'line'|'circle', data: GeoJSON, paint, visible?, popup?: props => html }]
  // onClick:   optional ([lng, lat]) => void for clicks that don't hit a layer with a popup.
  constructor({ container, leaflet, layers, onClick, onToggle }) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.leaflet = leaflet;
    this.layers = layers;
    this.onClick = onClick;
    this.onToggle = onToggle;
    this.map = null;
    this.active = false;
    this.recenter = true;
    this.popupLayers = new Set();
  }

  async enable() {
    if (this.active && !this.recenter) { this.sync(); return; }
    this.active = true;
    this.container.hidden = false;
    this.leafletContainer()?.classList.add('under-3d');
    this.onToggle?.(true);
    try {
      await loadMapLibre();
    } catch {
      this.container.innerHTML = '<p class="map3d-error">Couldn\'t load the 3D viewer. Check your connection.</p>';
      return;
    }
    if (!this.active) return;

    const lf = this.leaflet();
    const c = lf.getCenter();
    const camera = { center: [c.lng, c.lat], zoom: Math.max(15, lf.getZoom() - 0.5), pitch: 60, bearing: -20 };
    this.recenter = false;
    if (!this.map) {
      this.map = new maplibregl.Map({ container: this.container, style: STYLE_3D, antialias: true, ...camera });
      this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      this.map.on('click', e => {
        const hits = this.map.queryRenderedFeatures(e.point, { layers: [...this.popupLayers].filter(id => this.map.getLayer(id)) });
        if (!hits.length) this.onClick?.([e.lngLat.lng, e.lngLat.lat]);
      });
      await new Promise(r => this.map.once('load', r));
      this.ready = true;
      this.styleBuildings();
      if (!this.active) return;
    } else {
      this.map.resize();
      this.map.jumpTo(camera);
    }
    this.sync();
  }

  disable() {
    if (!this.active) return;
    this.active = false;
    this.container.hidden = true;
    this.leafletContainer()?.classList.remove('under-3d');
    this.onToggle?.(false);
    // Hand the 3D camera position back to the 2D map.
    if (this.map) {
      const c = this.map.getCenter();
      this.leaflet().setView([c.lat, c.lng], Math.round(this.map.getZoom() + 0.5));
    }
  }

  toggle() { return this.active ? this.disable() : this.enable(); }

  // New area loaded: re-center the next time the view is shown.
  reset() { this.recenter = true; }

  destroy() {
    this.map?.remove();
    this.map = null;
    this.ready = false;
    this.active = false;
  }

  flyTo([lng, lat], zoom) {
    this.map?.flyTo({ center: [lng, lat], zoom: zoom ?? Math.max(this.map.getZoom(), 16.5) });
  }

  leafletContainer() {
    try { return this.leaflet()?.getContainer(); } catch { return null; }
  }

  styleBuildings() {
    if (!this.map.getLayer('building-3d')) return;
    this.map.setPaintProperty('building-3d', 'fill-extrusion-color', [
      'interpolate', ['linear'], ['get', 'render_height'],
      0, '#ece8df', 40, '#d9d3c7', 120, '#bdb6a9', 300, '#948d81',
    ]);
    this.map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.9);
  }

  // Pushes the current layer data into the 3D map, adding sources and layers the first time.
  sync() {
    // isStyleLoaded() stays false while tiles stream in, so rely on our own flag from 'load'.
    if (!this.map || !this.ready) return;
    for (const l of this.layers()) {
      const src = this.map.getSource(l.id);
      if (src) src.setData(l.data);
      else this.map.addSource(l.id, { type: 'geojson', data: l.data });
      if (!this.map.getLayer(l.id)) {
        // Ground fills and outlines go under the 3D buildings; dots go on top.
        const before = l.type !== 'circle' && this.map.getLayer('building-3d') ? 'building-3d' : undefined;
        this.map.addLayer({ id: l.id, type: l.type, source: l.id, paint: l.paint }, before);
        if (l.popup) this.addPopup(l.id, l.popup);
      }
      this.map.setLayoutProperty(l.id, 'visibility', l.visible === false ? 'none' : 'visible');
    }
  }

  addPopup(id, html) {
    this.popupLayers.add(id);
    this.map.on('click', id, e => {
      new maplibregl.Popup({ offset: 8, maxWidth: '280px' }).setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(this.map);
    });
    this.map.on('mouseenter', id, () => { this.map.getCanvas().style.cursor = 'pointer'; });
    this.map.on('mouseleave', id, () => { this.map.getCanvas().style.cursor = ''; });
  }
}

// Paint helpers shared by the 3D layers.
const dotPaint = (color, radius = 7) => ({ 'circle-radius': radius, 'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 });
const outlinePaint = { 'line-color': '#10261a', 'line-width': 3, 'line-dasharray': [2, 1.5] };

// ---------------- Map tab ----------------

const Map3D = new View3D({
  container: 'map3d',
  leaflet: () => map,
  onToggle: on => {
    $('#propose-btn').hidden = on;
    if (on) markMapView('3d');
    else markMapView('map');
  },
  layers: () => {
    if (!state.zipFeature) return [];
    const gardens = state.gardens.map(g => turf.centroid(g, { properties: g.properties }));
    const proposals = Proposals.forZip(state.zip).map(p => turf.point([p.lng, p.lat], { name: p.name, type: p.type, saved: !!p.userId }));
    return [
      { id: 'gsp-parks', type: 'fill', data: turf.featureCollection(state.parks), visible: state.visible.parks,
        paint: { 'fill-color': COLORS.park, 'fill-opacity': 0.55 }, popup: p => parkPopup(p) },
      { id: 'gsp-natural', type: 'fill', data: turf.featureCollection(state.natural), visible: state.visible.natural,
        paint: { 'fill-color': COLORS.natural, 'fill-opacity': 0.6 } },
      { id: 'gsp-zip', type: 'line', data: state.zipFeature, paint: outlinePaint },
      { id: 'gsp-gardens', type: 'circle', data: turf.featureCollection(gardens), visible: state.visible.gardens, paint: dotPaint(COLORS.garden),
        popup: p => `<div class="pop"><div class="pop-kicker">Community garden</div><strong>${esc(p.name)}</strong><div>${esc(p.address || '')}</div></div>` },
      { id: 'gsp-proposals', type: 'circle', data: turf.featureCollection(proposals),
        paint: { ...dotPaint(COLORS.proposal, 9), 'circle-color': ['case', ['get', 'saved'], COLORS.proposal, '#b9a3ec'], 'circle-stroke-width': 2.5 },
        popup: p => `<div class="pop"><div class="pop-kicker">Proposed · ${p.saved ? 'saved' : 'draft'}</div><strong>${esc(p.name)}</strong><div>${esc(p.type)}</div></div>` },
    ];
  },
});
// Older call sites use syncData().
Map3D.syncData = Map3D.sync;

// A floating "3D / 2D" button for maps that don't have a layer list.
function add3DToggle(wrap, view) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toggle-3d';
  btn.innerHTML = '🏙️ 3D view';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await view.toggle();
    btn.disabled = false;
    btn.innerHTML = view.active ? '🗺️ 2D map' : '🏙️ 3D view';
    btn.classList.toggle('on', view.active);
  });
  wrap.appendChild(btn);
  return btn;
}
