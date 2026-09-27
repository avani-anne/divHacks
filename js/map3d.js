// 3D view for the Map tab: a tilted MapLibre GL map with extruded buildings (OpenFreeMap tiles,
// no API key) showing the ZIP outline, parks, natural areas, gardens and proposed sites.
// MapLibre is only downloaded the first time someone turns the 3D view on.

const MAPLIBRE_VERSION = '4.7.1';
const STYLE_3D = 'https://tiles.openfreemap.org/styles/liberty';

let maplibreLoading = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve();
  if (!maplibreLoading) {
    maplibreLoading = new Promise((resolve, reject) => {
      const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css` });
      const js = Object.assign(document.createElement('script'), { src: `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`, onload: resolve, onerror: reject });
      document.head.append(css, js);
    });
  }
  return maplibreLoading;
}

const Map3D = {
  map: null,
  active: false,
  shownZip: null,

  async enable() {
    if (this.active && this.shownZip === state.zip) { this.syncData(); return; }
    this.active = true;
    $('#map3d').hidden = false;
    $('#propose-btn').hidden = true;
    try {
      await loadMapLibre();
    } catch {
      $('#map3d').innerHTML = '<p class="map3d-error">Couldn\'t load the 3D viewer. Check your connection.</p>';
      return;
    }
    if (!this.active) return;

    const c = map.getCenter();
    const zoom = Math.max(15, map.getZoom() - 0.5);
    if (!this.map) {
      this.map = new maplibregl.Map({
        container: 'map3d', style: STYLE_3D, center: [c.lng, c.lat], zoom, pitch: 60, bearing: -20, antialias: true,
      });
      this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      await new Promise(r => this.map.once('load', r));
      if (!this.active) return;
      this.styleBuildings();
      this.shownZip = state.zip;
      this.syncData();
      this.addPopups();
      return;
    } else {
      this.map.resize();
      this.map.jumpTo({ center: [c.lng, c.lat], zoom, pitch: 60, bearing: -20 });
    }
    this.shownZip = state.zip;
    this.syncData();
  },

  disable() {
    if (!this.active) return;
    this.active = false;
    $('#map3d').hidden = true;
    $('#propose-btn').hidden = false;
    // Hand the 3D camera position back to the 2D map.
    if (this.map) {
      const c = this.map.getCenter();
      map.setView([c.lat, c.lng], Math.round(this.map.getZoom() + 0.5));
    }
  },

  // A new ZIP was loaded: re-center next time the view is shown.
  reset() { this.shownZip = null; },

  styleBuildings() {
    if (!this.map.getLayer('building-3d')) return;
    this.map.setPaintProperty('building-3d', 'fill-extrusion-color', [
      'interpolate', ['linear'], ['get', 'render_height'],
      0, '#ece8df', 40, '#d9d3c7', 120, '#bdb6a9', 300, '#948d81',
    ]);
    this.map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.9);
  },

  setSource(id, data) {
    const src = this.map.getSource(id);
    if (src) src.setData(data);
    else this.map.addSource(id, { type: 'geojson', data });
  },

  // Ground fills go underneath the 3D buildings; markers (onTop) go above everything.
  addLayerOnce(layer, onTop = false) {
    if (this.map.getLayer(layer.id)) return;
    const before = !onTop && this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    this.map.addLayer(layer, before);
  },

  syncData() {
    if (!this.map || !state.zipFeature) return;
    const gardens = state.gardens.map(g => turf.centroid(g, { properties: g.properties }));
    const proposals = Proposals.forZip(state.zip).map(p => turf.point([p.lng, p.lat], { name: p.name, type: p.type, saved: !!p.userId }));

    this.setSource('gsp-zip', state.zipFeature);
    this.setSource('gsp-parks', turf.featureCollection(state.parks));
    this.setSource('gsp-natural', turf.featureCollection(state.natural));
    this.setSource('gsp-gardens', turf.featureCollection(gardens));
    this.setSource('gsp-proposals', turf.featureCollection(proposals));

    this.addLayerOnce({ id: 'gsp-parks-fill', type: 'fill', source: 'gsp-parks', paint: { 'fill-color': COLORS.park, 'fill-opacity': 0.55 } });
    this.addLayerOnce({ id: 'gsp-natural-fill', type: 'fill', source: 'gsp-natural', paint: { 'fill-color': COLORS.natural, 'fill-opacity': 0.6 } });
    this.addLayerOnce({ id: 'gsp-zip-line', type: 'line', source: 'gsp-zip', paint: { 'line-color': '#10261a', 'line-width': 3, 'line-dasharray': [2, 1.5] } });
    this.addLayerOnce({ id: 'gsp-gardens-dot', type: 'circle', source: 'gsp-gardens', paint: {
      'circle-radius': 7, 'circle-color': COLORS.garden, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
    } }, true);
    this.addLayerOnce({ id: 'gsp-proposals-dot', type: 'circle', source: 'gsp-proposals', paint: {
      'circle-radius': 9, 'circle-color': ['case', ['get', 'saved'], COLORS.proposal, '#b9a3ec'],
      'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5,
    } }, true);

    const vis = (id, on) => this.map.getLayer(id) && this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('gsp-parks-fill', state.visible.parks);
    vis('gsp-natural-fill', state.visible.natural);
    vis('gsp-gardens-dot', state.visible.gardens);
  },

  addPopups() {
    const popup = (layer, html) => {
      this.map.on('click', layer, e => new maplibregl.Popup({ offset: 8 }).setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(this.map));
      this.map.on('mouseenter', layer, () => { this.map.getCanvas().style.cursor = 'pointer'; });
      this.map.on('mouseleave', layer, () => { this.map.getCanvas().style.cursor = ''; });
    };
    popup('gsp-parks-fill', p => parkPopup(p));
    popup('gsp-gardens-dot', p => `<div class="pop"><div class="pop-kicker">Community garden</div><strong>${esc(p.name)}</strong><div>${esc(p.address || '')}</div></div>`);
    popup('gsp-proposals-dot', p => `<div class="pop"><div class="pop-kicker">Proposed · ${p.saved ? 'saved' : 'draft'}</div><strong>${esc(p.name)}</strong><div>${esc(p.type)}</div></div>`);
  },
};
