// Neighborhood metrics computed in the browser with Turf.js.

const SQM_PER_ACRE = 4046.86;

// Park types a resident can actually walk into and use. Excludes medians, parkways,
// cemeteries, undeveloped lots and operational sites.
const ACCESSIBLE_PARK_TYPES = new Set([
  'Neighborhood Park', 'Community Park', 'Flagship Park', 'Playground',
  'Jointly Operated Playground', 'Nature Area', 'Recreational Field/Courts',
  'Garden', 'Waterfront Facility', 'Historic House Park', 'Mall', 'Triangle/Plaza',
]);

// Walking-distance thresholds (meters). 800 m ≈ a 10-minute walk, the Nature Map's access metric.
const WALK_5_MIN = 400;
const WALK_10_MIN = 800;

// NYC Parks' long-standing open space planning goal.
const ACRES_PER_1000_GOAL = 2.5;

// Widely cited USDA Forest Service / Arbor Day figure for a mature urban tree.
const CO2_LBS_PER_TREE_YEAR = 48;
const LBS_PER_METRIC_TON = 2204.62;

const FT_TO_M = 0.3048;
// Growing-season thresholds (April–September noon sun is ~50–73° high).
const SUN_FULL_MAX_ANGLE = 30;
const SUN_PART_MAX_ANGLE = 55;

const Analysis = {
  // Acres of the given features that fall inside the ZIP boundary.
  areaInside(features, zipFeature) {
    let sqm = 0;
    for (const f of features) {
      try {
        const clipped = turf.intersect(turf.featureCollection([zipFeature, f]));
        if (clipped) sqm += turf.area(clipped);
      } catch {
        // Malformed geometry: count it if its centroid is inside.
        if (turf.booleanPointInPolygon(turf.centroid(f), zipFeature)) sqm += turf.area(f);
      }
    }
    return sqm / SQM_PER_ACRE;
  },

  isInside(feature, zipFeature) {
    try {
      return turf.booleanIntersects(feature, zipFeature);
    } catch {
      return turf.booleanPointInPolygon(turf.centroid(feature), zipFeature);
    }
  },

  // Samples a grid over the ZIP and measures each sample's distance to the nearest
  // accessible park. Returns samples with their distances plus the grid cell size.
  accessGrid(zipFeature, parks) {
    const zipSqm = turf.area(zipFeature);
    const targetSamples = 1500;
    const cellKm = Math.max(0.06, Math.sqrt(zipSqm / targetSamples) / 1000);
    const grid = turf.pointGrid(turf.bbox(zipFeature), cellKm, { units: 'kilometers', mask: zipFeature });

    const targets = parks
      .filter(p => ACCESSIBLE_PARK_TYPES.has(p.properties.category))
      .map(p => {
        let geom = p;
        try { geom = turf.simplify(p, { tolerance: 0.00005, highQuality: false }); } catch {}
        return { feature: geom, bbox: turf.bbox(geom), name: p.properties.name };
      });

    const samples = grid.features.map(pt => {
      const [x, y] = pt.geometry.coordinates;
      const nearest = nearestPark(x, y, targets);
      return { lng: x, lat: y, dist: nearest.dist, park: nearest.name };
    });
    return { samples, cellKm };
  },

  nearestPark(lng, lat, parks) {
    const targets = parks
      .filter(p => ACCESSIBLE_PARK_TYPES.has(p.properties.category))
      .map(p => ({ feature: p, bbox: turf.bbox(p), name: p.properties.name }));
    return nearestPark(lng, lat, targets);
  },

  // Share of the ZIP within a walk of a park, optionally counting proposed sites as new parks.
  accessShare(samples, proposals = []) {
    if (!samples.length) return { within5: 0, within10: 0 };
    let within5 = 0, within10 = 0;
    for (const s of samples) {
      let d = s.dist;
      for (const p of proposals) d = Math.min(d, metersBetween(s.lng, s.lat, p.lng, p.lat));
      if (d <= WALK_5_MIN) within5++;
      if (d <= WALK_10_MIN) within10++;
    }
    return { within5: within5 / samples.length, within10: within10 / samples.length };
  },

  // EPA AQI for PM2.5 (2024 breakpoints). Applied to the annual mean, so it describes
  // typical conditions rather than a daily forecast.
  pm25ToAqi(c) {
    const bp = [
      [0.0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
      [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 500, 301, 500],
    ];
    const v = Math.round(c * 10) / 10;
    const row = bp.find(([lo, hi]) => v >= lo && v <= hi) || bp[bp.length - 1];
    const [cLo, cHi, iLo, iHi] = row;
    return Math.round(((iHi - iLo) / (cHi - cLo)) * (v - cLo) + iLo);
  },

  // EPA AQI categories.
  aqiCategory(aqi) {
    if (aqi <= 50) return { label: 'Good', tone: 'good' };
    if (aqi <= 100) return { label: 'Moderate', tone: 'moderate' };
    if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', tone: 'usg' };
    if (aqi <= 200) return { label: 'Unhealthy', tone: 'bad' };
    if (aqi <= 300) return { label: 'Very unhealthy', tone: 'vbad' };
    return { label: 'Hazardous', tone: 'hazard' };
  },

  // Estimates growing-season sunlight from the buildings around a point. In NYC (40.7°N) the noon
  // sun is ~73° high at the summer solstice and ~49° at the equinoxes, so a building to the south
  // that rises higher than that above the horizon keeps the spot in shade through midday.
  sunlight([lng, lat], buildings) {
    const pt = turf.point([lng, lat]);
    const roof = buildings.find(b => { try { return turf.booleanPointInPolygon(pt, b); } catch { return false; } });
    const baseM = roof ? roof.properties.heightFt * FT_TO_M : 1.5;
    let worst = { angle: 0, heightFt: 0, dist: 0 };
    for (const b of buildings) {
      if (b === roof) continue;
      const riseM = b.properties.heightFt * FT_TO_M - baseM;
      if (riseM <= 0) continue;
      // Only buildings on the southern side (bearing from ESE through S to WSW) block the sun.
      const bearing = turf.bearing(pt, turf.centroid(b));
      if (Math.abs(bearing) < 100) continue;
      let dist;
      try { dist = turf.pointToPolygonDistance(pt, b, { units: 'meters' }); } catch { continue; }
      dist = Math.max(2, dist);
      const angle = (Math.atan(riseM / dist) * 180) / Math.PI;
      if (angle > worst.angle) worst = { angle, heightFt: b.properties.heightFt, dist };
    }
    const level = worst.angle < SUN_FULL_MAX_ANGLE ? 'full' : worst.angle < SUN_PART_MAX_ANGLE ? 'part' : 'shade';
    return { level, roofHeightFt: roof ? roof.properties.heightFt : null, blocker: worst.angle ? worst : null };
  },

  co2TonsPerYear(treeCount) {
    return (treeCount * CO2_LBS_PER_TREE_YEAR) / LBS_PER_METRIC_TON;
  },
};

function nearestPark(lng, lat, targets) {
  const pt = turf.point([lng, lat]);
  // Check parks in order of bounding-box distance so we can stop early.
  const ranked = targets
    .map(t => ({ t, boxDist: bboxDistance(lng, lat, t.bbox) }))
    .sort((a, b) => a.boxDist - b.boxDist);

  let best = { dist: Infinity, name: null };
  for (const { t, boxDist } of ranked) {
    if (boxDist > best.dist) break;
    let d;
    try {
      d = Math.max(0, turf.pointToPolygonDistance(pt, t.feature, { units: 'meters' }));
    } catch {
      d = boxDist;
    }
    if (d < best.dist) best = { dist: d, name: t.name };
  }
  return best;
}

// Equirectangular distance in meters; accurate to well under 1% at city scale.
function metersBetween(lng1, lat1, lng2, lat2) {
  const k = Math.PI / 180;
  const x = (lng2 - lng1) * k * Math.cos(((lat1 + lat2) / 2) * k);
  const y = (lat2 - lat1) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
}

function bboxDistance(lng, lat, [minX, minY, maxX, maxY]) {
  const cx = Math.min(Math.max(lng, minX), maxX);
  const cy = Math.min(Math.max(lat, minY), maxY);
  return metersBetween(lng, lat, cx, cy);
}
