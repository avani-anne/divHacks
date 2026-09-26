// Data access: all queries go straight to NYC Open Data (Socrata SODA API).
// Every dataset used here sends Access-Control-Allow-Origin: *, so no backend is needed.

const NYC = 'https://data.cityofnewyork.us/resource';

const DATASETS = {
  zips: 'pri4-ifjk',          // Modified ZIP Code Tabulation Areas (boundaries + population)
  parks: 'enfh-gkve',         // NYC Parks Properties
  foreverWild: '48va-85tp',   // NYC Parks Forever Wild natural areas (source of the NYC Nature Map)
  gardens: 'p78i-pat6',       // GreenThumb community gardens
  streetTrees: 'uvpi-gqnh',   // 2015 Street Tree Census (has a zipcode field)
  districts: '5crt-au7u',     // Community District boundaries
  airQuality: 'c3uy-2p5r',    // Air Quality (reported per community district)
  plantingSpaces: '82zj-84is', // Forestry Planting Spaces (street tree beds, incl. empty ones)
  busShelters: 't4f2-8md7',   // Bus Stop Shelters
  pluto: '64uk-42ks',         // PLUTO tax lots (land use 11 = vacant land)
  buildings: '5zhs-2jue',     // Building footprints with roof heights
};

async function soql(id, params) {
  const url = new URL(`${NYC}/${id}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NYC Open Data request failed (${id}): ${res.status}`);
  return res.json();
}

// Matches shapes that overlap the box. (Socrata's within_box only matches shapes that
// fall entirely inside it, which drops large parks that cross the edge.)
function withinBox(field, [minX, minY, maxX, maxY]) {
  return `intersects(${field}, 'POLYGON((${minX} ${minY}, ${maxX} ${minY}, ${maxX} ${maxY}, ${minX} ${maxY}, ${minX} ${minY}))')`;
}

function circleWkt(center, radiusM) {
  const ring = turf.circle(center, radiusM / 1000, { steps: 24, units: 'kilometers' }).geometry.coordinates[0];
  return `POLYGON((${ring.map(([x, y]) => `${x.toFixed(6)} ${y.toFixed(6)}`).join(', ')}))`;
}

const Data = {
  // Returns a GeoJSON Feature for the ZIP, or null if it isn't an NYC ZIP.
  async zipBoundary(zip) {
    const rows = await soql(DATASETS.zips, {
      $where: `modzcta='${zip}' OR label like '%${zip}%' OR zcta like '%${zip}%'`,
      $limit: 1,
    });
    if (!rows.length) return null;
    const r = rows[0];
    return {
      type: 'Feature',
      properties: { zip, modzcta: r.modzcta, population: Number(r.pop_est) || 0 },
      geometry: r.the_geom,
    };
  },

  async parks(bbox) {
    const rows = await soql(DATASETS.parks, {
      $select: 'signname,name311,typecategory,acres,address,borough,gispropnum,multipolygon',
      $where: `${withinBox('multipolygon', bbox)} AND retired=false`,
      $limit: 2000,
    });
    return rows.filter(r => r.multipolygon).map(r => ({
      type: 'Feature',
      properties: {
        name: r.signname || r.name311 || 'Unnamed park',
        category: r.typecategory || 'Park',
        acres: Number(r.acres) || 0,
        address: r.address || '',
        id: r.gispropnum,
      },
      geometry: r.multipolygon,
    }));
  },

  async naturalAreas(bbox) {
    const rows = await soql(DATASETS.foreverWild, {
      $select: 'propertyname,acres,gispropnum,shape',
      $where: withinBox('shape', bbox),
      $limit: 500,
    });
    return rows.filter(r => r.shape).map(r => ({
      type: 'Feature',
      properties: { name: r.propertyname, acres: Number(r.acres) || 0 },
      geometry: r.shape,
    }));
  },

  async gardens(zip, bbox) {
    const rows = await soql(DATASETS.gardens, {
      $select: 'gardenname,address,status,zipcode,juris,multipolygon,openhrssa,openhrssu',
      $where: zip ? `zipcode='${zip}' OR ${withinBox('multipolygon', bbox)}` : withinBox('multipolygon', bbox),
      $limit: 500,
    });
    return rows.filter(r => r.multipolygon).map(r => ({
      type: 'Feature',
      properties: {
        name: r.gardenname,
        address: r.address || '',
        status: r.status || '',
        zip: r.zipcode,
        hours: [r.openhrssa && `Sat ${r.openhrssa}`, r.openhrssu && `Sun ${r.openhrssu}`].filter(Boolean).join(' · '),
      },
      geometry: r.multipolygon,
    }));
  },

  async treeSummary(zip) {
    const where = `zipcode='${zip}' AND status='Alive'`;
    const [[totals], top, [place]] = await Promise.all([
      soql(DATASETS.streetTrees, {
        $select: 'count(*) as n, count(distinct spc_common) as species, avg(tree_dbh) as avg_dbh',
        $where: where,
      }),
      soql(DATASETS.streetTrees, {
        $select: 'spc_common, count(*) as n',
        $where: where,
        $group: 'spc_common',
        $order: 'n DESC',
        $limit: 5,
      }),
      soql(DATASETS.streetTrees, {
        $select: 'zip_city, boroname, nta_name, count(*) as n',
        $where: `zipcode='${zip}'`,
        $group: 'zip_city, boroname, nta_name',
        $order: 'n DESC',
        $limit: 1,
      }),
    ]);
    return {
      count: Number(totals?.n) || 0,
      species: Number(totals?.species) || 0,
      avgDbh: Number(totals?.avg_dbh) || 0,
      top: top.filter(t => t.spc_common).map(t => ({ name: t.spc_common, count: Number(t.n) })),
      place: place ? { city: place.zip_city, borough: place.boroname, nta: place.nta_name } : null,
    };
  },

  async treePoints(zip) {
    return soql(DATASETS.streetTrees, {
      $select: 'latitude,longitude,spc_common,tree_dbh,health',
      $where: `zipcode='${zip}' AND status='Alive'`,
      $limit: 20000,
    });
  },

  async communityDistrict([lng, lat]) {
    const rows = await soql(DATASETS.districts, {
      $select: 'boro_cd',
      $where: `intersects(the_geom, 'POINT(${lng} ${lat})')`,
      $limit: 1,
    });
    return rows[0]?.boro_cd || null;
  },

  // Latest annual PM2.5 / NO2 and summer O3 for a community district.
  async airQuality(cd) {
    if (!cd) return null;
    const rows = await soql(DATASETS.airQuality, {
      $select: 'name,measure,measure_info,time_period,data_value,geo_place_name,start_date',
      $where: `geo_type_name='CD' AND geo_join_id='${cd}' AND (name like 'Fine particles%' OR name like 'Nitrogen dioxide%' OR name like 'Ozone%') AND (measure='Annual mean' OR measure='Summer mean')`,
      $order: 'start_date DESC',
      $limit: 40,
    });
    const pick = (prefix, measure) => {
      const r = rows.find(r => r.name.startsWith(prefix) && r.measure === measure);
      return r ? { value: Number(r.data_value), unit: r.measure_info, period: r.time_period } : null;
    };
    const pm25 = pick('Fine particles', 'Annual mean');
    const no2 = pick('Nitrogen dioxide', 'Annual mean');
    const o3 = pick('Ozone', 'Summer mean');
    if (!pm25 && !no2 && !o3) return null;
    return { district: rows[0]?.geo_place_name || `CD ${cd}`, pm25, no2, o3 };
  },

  // ---------- Site-level queries for the Build Ideas tab ----------

  async emptyTreeBeds([lng, lat], radius = 250) {
    return soql(DATASETS.plantingSpaces, {
      $select: 'buildingnumber,streetname,width,length,location',
      $where: `within_circle(location, ${lat}, ${lng}, ${radius}) AND psstatus='Empty'`,
      $limit: 300,
    });
  },

  // Closest street address, taken from the nearest planting space of any status.
  async nearestAddress([lng, lat]) {
    for (const radius of [40, 120]) {
      const [row] = await soql(DATASETS.plantingSpaces, {
        $select: 'buildingnumber,streetname,zipcode',
        $where: `within_circle(location, ${lat}, ${lng}, ${radius}) AND streetname IS NOT NULL`,
        $limit: 1,
      });
      if (row) return row;
    }
    return null;
  },

  async busShelters([lng, lat], radius = 300) {
    return soql(DATASETS.busShelters, {
      $select: 'shelter_id,on_street,cross_stre,latitude,longitude',
      $where: `within_circle(the_geom, ${lat}, ${lng}, ${radius})`,
      $limit: 100,
    });
  },

  // PLUTO stores coordinates as text, so cast them for the box filter.
  async vacantLots({ zip, center, radiusDeg = 0.004 }) {
    const where = [`landuse='11'`, `latitude IS NOT NULL`];
    if (zip) where.push(`zipcode='${zip}'`);
    if (center) {
      const [lng, lat] = center;
      where.push(`latitude::number between ${lat - radiusDeg} and ${lat + radiusDeg}`);
      where.push(`longitude::number between ${lng - radiusDeg * 1.3} and ${lng + radiusDeg * 1.3}`);
    }
    const rows = await soql(DATASETS.pluto, {
      $select: 'bbl,address,zipcode,lotarea,ownername,ownertype,latitude,longitude',
      $where: where.join(' AND '),
      $order: 'lotarea DESC',
      $limit: 400,
    });
    return rows.map(r => ({
      bbl: String(r.bbl || '').split('.')[0],
      address: r.address || 'Unaddressed lot',
      zip: r.zipcode,
      sqft: Number(r.lotarea) || 0,
      owner: r.ownername || 'Unknown owner',
      publicOwner: r.ownertype === 'C' || r.ownertype === 'M' || r.ownertype === 'O',
      lat: Number(r.latitude),
      lng: Number(r.longitude),
    }));
  },

  async buildingsNear([lng, lat], radius = 90) {
    const rows = await soql(DATASETS.buildings, {
      $select: 'height_roof,the_geom',
      $where: `intersects(the_geom, '${circleWkt([lng, lat], radius)}') AND height_roof IS NOT NULL`,
      $limit: 400,
    });
    return rows.filter(r => r.the_geom).map(r => ({
      type: 'Feature',
      properties: { heightFt: Number(r.height_roof) || 0 },
      geometry: r.the_geom,
    }));
  },

  // ---------- Map overlays ----------

  // Community districts overlapping the box, joined with their latest annual PM2.5 and NO2.
  async airQualityDistricts(bbox) {
    const [districts, readings] = await Promise.all([
      soql(DATASETS.districts, { $select: 'boro_cd,the_geom', $where: withinBox('the_geom', bbox), $limit: 100 }),
      soql(DATASETS.airQuality, {
        $select: 'name,geo_join_id,geo_place_name,time_period,data_value',
        $where: `geo_type_name='CD' AND measure='Annual mean' AND (name like 'Fine particles%' OR name like 'Nitrogen dioxide%')`,
        $order: 'start_date DESC',
        $limit: 5000,
      }),
    ]);
    const latest = {};
    for (const r of readings) {
      const key = `${r.geo_join_id}|${r.name.startsWith('Fine') ? 'pm25' : 'no2'}`;
      if (!latest[key]) latest[key] = r;
    }
    return districts.filter(d => d.the_geom).map(d => {
      const pm = latest[`${d.boro_cd}|pm25`];
      const no2 = latest[`${d.boro_cd}|no2`];
      return {
        type: 'Feature',
        properties: {
          cd: d.boro_cd,
          name: pm?.geo_place_name || `Community District ${d.boro_cd}`,
          pm25: pm ? Number(pm.data_value) : null,
          no2: no2 ? Number(no2.data_value) : null,
          period: pm?.time_period || null,
        },
        geometry: d.the_geom,
      };
    });
  },

  // ZIP (MODZCTA) polygons overlapping the box, with median household income from the
  // Census ACS 5-year survey via Census Reporter (no API key needed).
  async incomeAreas(bbox) {
    const rows = await soql(DATASETS.zips, {
      $select: 'modzcta,pop_est,the_geom',
      $where: withinBox('the_geom', bbox),
      $limit: 200,
    });
    const zips = rows.map(r => r.modzcta).filter(z => /^\d{5}$/.test(z));
    const income = await this.medianIncome(zips);
    return rows.filter(r => r.the_geom).map(r => ({
      type: 'Feature',
      properties: { zip: r.modzcta, population: Number(r.pop_est) || 0, ...(income.values[r.modzcta] || {}), release: income.release },
      geometry: r.the_geom,
    }));
  },

  // Census Reporter rejects a whole request if any ZIP is unknown (e.g. NYC's placeholder 99999),
  // so drop placeholders and fall back to small batches if a request still fails.
  async medianIncome(zips) {
    zips = [...new Set(zips)].filter(z => /^\d{5}$/.test(z) && z !== '99999');
    if (!zips.length) return { values: {}, release: null };
    const fetchBatch = async batch => {
      const url = `https://api.censusreporter.org/1.0/data/show/latest?table_ids=B19013&geo_ids=${batch.map(z => `86000US${z}`).join(',')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Census Reporter request failed: ${res.status}`);
      return res.json();
    };
    let results;
    try {
      results = [await fetchBatch(zips)];
    } catch {
      const batches = [];
      for (let i = 0; i < zips.length; i += 4) batches.push(zips.slice(i, i + 4));
      results = (await Promise.allSettled(batches.map(fetchBatch))).filter(r => r.status === 'fulfilled').map(r => r.value);
    }
    const values = {};
    let release = null;
    for (const json of results) {
      release = release || json.release?.years || null;
      for (const [geo, v] of Object.entries(json.data || {})) {
        const est = v.B19013?.estimate?.B19013001;
        if (est != null) values[geo.slice(-5)] = { income: est, moe: v.B19013?.error?.B19013001 ?? null };
      }
    }
    return { values, release };
  },
};
