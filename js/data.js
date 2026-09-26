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
};

async function soql(id, params) {
  const url = new URL(`${NYC}/${id}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NYC Open Data request failed (${id}): ${res.status}`);
  return res.json();
}

function withinBox(field, [minX, minY, maxX, maxY]) {
  return `within_box(${field}, ${maxY}, ${minX}, ${minY}, ${maxX})`;
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
      $where: `zipcode='${zip}' OR ${withinBox('multipolygon', bbox)}`,
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
};
