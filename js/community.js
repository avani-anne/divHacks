// "Community" tab: petitions & projects, a map of where projects are growing, and volunteering
// (opportunities, followed ZIPs and an updates feed). Actions that change data require login.

const INTERESTS = ['Tree care', 'Community gardening', 'Park & lot cleanups', 'Petitions & advocacy', 'Building green spaces'];
const SITE_TYPES = ['Vacant lot', 'Bus stop', 'Street trees', 'Rooftop', 'Schoolyard', 'Senior center / nursing home', 'Homeless services site', 'Food pantry / kitchen', 'Park improvement', 'Other'];

// Kinds of partner sites (from the Facilities Database) and the green space that suits each.
const PARTNER_KINDS = {
  school: {
    label: 'Schools', one: 'School', icon: '🏫', color: '#2b6cb0', siteType: 'Schoolyard', short: 'Schoolyard garden',
    idea: 'Schoolyard garden or outdoor classroom',
    why: 'Students learn science and nutrition by growing food, and a shady schoolyard cools the block.',
  },
  seniors: {
    label: 'Senior centers & nursing homes', one: 'Older-adult site', icon: '🧓', color: '#138d75', siteType: 'Senior center / nursing home', short: 'Sensory garden',
    idea: 'Accessible sensory garden with raised, wheelchair-height beds',
    why: 'Gardens give older adults gentle exercise, time together and a calm place outdoors.',
  },
  homeless: {
    label: 'Homeless services', one: 'Homeless-services site', icon: '🏠', color: '#b03a2e', siteType: 'Homeless services site', short: 'Shade and seating garden',
    idea: 'Shade trees, planters and a quiet seating garden',
    why: 'Shaded, green seating offers rest and dignity for people who spend long hours outdoors.',
  },
  food: {
    label: 'Food pantries & soup kitchens', one: 'Food program', icon: '🍎', color: '#b7950b', siteType: 'Food pantry / kitchen', short: 'Donation garden',
    idea: 'A donation garden that grows fresh produce for them',
    why: 'Nearby gardens can hand harvests straight to pantries and kitchens that serve the neighborhood.',
  },
};
// The Facilities Database often names sites "Organization : Site"; drop the repeat when both match.
const partnerName = p => titleCase([...new Set(String(p.name || '').split(/\s+:\s+/).map(x => x.trim()).filter(Boolean))].join(' · '));
const TARGETS = ['NYC Parks / GreenThumb', 'NYC DOT', 'City Council Member', 'Community Board', 'Property owner', 'Other'];
const NOTIFY_OPTIONS = { projects: 'New volunteer projects', petitions: 'New petitions', reminders: 'Reminders before projects I joined', replies: 'Replies in discussions I\'m part of' };
const DAY = 24 * 60 * 60 * 1000;

const PROGRAMS = [
  { name: 'NYC Parks volunteering', desc: 'Stewardship days, tree care and park events across the five boroughs.', url: 'https://www.nycgovparks.org/opportunities/volunteer' },
  { name: 'GreenThumb', desc: 'Support for 550+ community gardens: workshops, materials and starting a new garden.', url: 'https://www.nycgovparks.org/greenthumb' },
  { name: 'NYC Service', desc: 'The city\'s volunteer hub. Search opportunities by borough and cause.', url: 'https://www.nycservice.org/' },
  { name: 'Trees New York', desc: 'Citizen Pruner training so you can legally care for street trees.', url: 'https://treesny.org/' },
];

const Community = {
  zip: null,
  view: 'projects',     // projects | map | volunteer
  pending: null,        // petition prefill waiting for the tab to open
  lots: [],
  allItems: [],         // cache of every item, used for the updates badge
  growMap: null,
  growFilter: 'all',

  // ---------- Entry points used by other tabs ----------

  async show() {
    if (!this.bound) this.bind();
    const zip = this.pending?.zip || state.zip;
    if (zip !== this.zip || !this.rendered) await this.load(zip);
    if (this.pending) {
      const prefill = this.pending;
      this.pending = null;
      this.view = 'projects';
      this.renderView();
      this.openCreate(prefill);
    }
  },

  startPetition(prefill) {
    this.pending = { type: 'petition', ...prefill };
    if (!/^\d{5}$/.test(prefill.zip || '')) delete this.pending.zip;
    showTab('community');
  },

  openVolunteer() {
    this.view = 'volunteer';
    this.rendered = false;
    showTab('community');
  },

  // Re-render on login/logout only; profile edits re-render themselves.
  async onAuthChange(user) {
    await this.refreshCache();
    const id = user?.id || null;
    if (id === this.lastUserId) return;
    this.lastUserId = id;
    this.previousSeenAt = null;
    if (this.rendered && !$('[data-panel=community]').hidden) this.renderView();
  },

  async refreshCache() {
    try {
      this.allItems = await Store.listItems(null);
    } catch (err) {
      console.error(err);
    }
    AuthUI.renderAccount();
  },

  // ---------- Updates feed ----------

  // Events relevant to a user: activity in followed ZIPs and on items they're part of.
  activity(user) {
    if (!user) return [];
    const follows = new Set(user.follows || []);
    const prefs = user.notify || { projects: true, petitions: true, reminders: true, replies: true };
    const events = [];
    const now = Date.now();
    for (const i of this.allItems) {
      const mine = i.organizerId === user.id;
      const joined = i.volunteers.some(v => v.userId === user.id);
      const signed = i.signatures.some(s => s.userId === user.id);
      const involved = mine || joined || signed;
      const kind = i.type === 'petition' ? 'petition' : 'project';

      if (follows.has(i.zip) && !mine && prefs[kind === 'petition' ? 'petitions' : 'projects']) {
        events.push({ at: i.createdAt, id: i.id, icon: kind === 'petition' ? '✊' : '🌱', text: `New ${kind} in ${i.zip}: <strong>${esc(i.title)}</strong>` });
      }
      if (i.type === 'project' && i.date && (joined || mine) && prefs.reminders) {
        const [y, m, d] = i.date.split('-').map(Number);
        const when = new Date(y, m - 1, d).getTime();
        if (when >= now - DAY && when - now < 7 * DAY) {
          events.push({ at: Math.max(i.createdAt, when - 7 * DAY), id: i.id, icon: '📅', text: `Coming up ${esc(formatDate(i.date))}: <strong>${esc(i.title)}</strong>` });
        }
      }
      if (mine && i.type === 'petition') {
        const goal = i.goal || 100;
        for (const frac of [0.5, 1]) {
          const n = Math.ceil(goal * frac);
          if (i.signatures.length >= n) {
            events.push({ at: i.signatures[n - 1].at, id: i.id, icon: '🎉', text: `Your petition reached ${frac === 1 ? 'its goal' : 'halfway'} (${fmt(n)} signatures): <strong>${esc(i.title)}</strong>` });
          }
        }
      }
      if (mine) {
        for (const v of i.volunteers) if (v.userId !== user.id) {
          events.push({ at: v.at, id: i.id, icon: '🙋', text: `${esc(v.name)} volunteered for <strong>${esc(i.title)}</strong>` });
        }
      }
      if (involved && prefs.replies) {
        for (const msg of i.messages) if (msg.userId !== user.id) {
          events.push({ at: msg.at, id: i.id, icon: '💬', text: `${esc(msg.name)} in <strong>${esc(i.title)}</strong>: “${esc(msg.text.slice(0, 80))}${msg.text.length > 80 ? '…' : ''}”` });
        }
      }
    }
    return events.sort((a, b) => b.at - a.at);
  },

  unreadCount(user) {
    if (!user) return 0;
    return this.activity(user).filter(e => e.at > (user.updatesSeenAt || 0)).length;
  },

  // ---------- Rendering ----------

  async load(zip) {
    this.zip = zip || null;
    this.rendered = true;
    await this.refreshCache();
    const f = Auth.current()?.follows || [];
    $('#community-panel').innerHTML = `
      <div class="comm-wrap">
        <div class="comm-head">
          <div>
            <div class="kicker">Community</div>
            <h2 class="panel-title">Organize for green space${this.zip ? ` in ${esc(this.zip)}` : ''}</h2>
            <p class="muted">Start or sign petitions, find projects near you, and volunteer to help green your neighborhood.</p>
          </div>
        </div>
        <nav class="subnav" role="tablist">
          <button type="button" role="tab" data-view="projects">✊ Petitions &amp; projects</button>
          <button type="button" role="tab" data-view="map">🗺️ Where it's growing</button>
          <button type="button" role="tab" data-view="partners">🤝 Partner sites</button>
          <button type="button" role="tab" data-view="volunteer">🙋 Volunteer</button>
        </nav>
        <div id="comm-view"></div>
      </div>`;
    this.renderView();
    this.loadLots();
  },

  async renderView() {
    document.querySelectorAll('.subnav [data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === this.view)));
    const items = this.allItems.filter(i => !this.zip || i.zip === this.zip);
    const el = $('#comm-view');
    if (!el) return;
    if (this.view === 'projects') el.innerHTML = this.projectsView(items);
    if (this.view === 'map') { el.innerHTML = this.mapView(items); this.drawGrowMap(items); }
    if (this.view === 'volunteer') { el.innerHTML = this.volunteerView(items); this.markUpdatesSeen(); this.showFollowers(); }
    if (this.view === 'projects') this.renderLots();
    if (this.view === 'partners') { el.innerHTML = this.partnersView(); this.renderPartners(items); }
  },

  projectsView(items) {
    return `<div class="comm-grid">
      <section class="card">
        <div class="card-head">
          <h3>Petitions &amp; projects${this.zip ? ` in ${esc(this.zip)}` : ''}</h3>
          <button type="button" class="btn-primary" data-action="create">＋ Start a petition or project</button>
        </div>
        ${items.length ? `<div class="items">${items.map(i => this.itemCard(i)).join('')}</div>` : `
          <div class="empty-hint"><div class="empty-icon">✊</div>
            <p>Nothing here yet${this.zip ? ` for ${esc(this.zip)}` : ''}. Start the first petition, or pick a vacant lot.</p></div>`}
      </section>
      <section class="card">
        <h3>Vacant lots that could become green space</h3>
        <p class="muted small">From NYC's PLUTO tax lot data (land use: vacant). Publicly owned lots are listed first.</p>
        <div id="lot-list"><p class="muted"><span class="spinner spinner-sm"></span> Loading lots…</p></div>
      </section>
    </div>`;
  },

  itemCard(i) {
    const me = Auth.current();
    const isPetition = i.type === 'petition';
    const progress = isPetition ? Math.min(1, i.signatures.length / (i.goal || 100)) : null;
    const signed = me && i.signatures.some(s => s.userId === me.id);
    const joined = me && i.volunteers.some(v => v.userId === me.id);
    return `<button type="button" class="item" data-action="open" data-id="${i.id}">
      <div class="item-top">
        <span class="tag ${isPetition ? 'tag-petition' : 'tag-project'}">${isPetition ? 'Petition' : 'Project'}</span>
        <span class="muted small">${signed ? '✓ Signed' : joined ? '✓ Volunteering' : esc(i.siteType || '')}</span>
      </div>
      <strong class="item-title">${esc(i.title)}</strong>
      ${i.partner ? `<div class="partner-tag">${PARTNER_KINDS[i.partner.kind]?.icon || '🤝'} With ${esc(partnerName(i.partner))}</div>` : ''}
      ${i.location ? `<div class="muted small">📍 ${esc(i.location)}</div>` : ''}
      ${isPetition ? `
        <div class="bar"><span class="ok" style="width:${progress * 100}%"></span></div>
        <div class="small item-meta"><strong>${fmt(i.signatures.length)}</strong> of ${fmt(i.goal || 100)} signatures · to ${esc(i.target || '—')}</div>`
      : `<div class="small item-meta">${i.date ? `📅 ${esc(formatDate(i.date))} · ` : ''}<strong>${fmt(i.volunteers.length)}</strong>${i.needed ? ` of ${fmt(i.needed)}` : ''} volunteers</div>`}
      <div class="muted small">💬 ${i.messages.length} message${i.messages.length === 1 ? '' : 's'} · started by ${esc(i.organizer)} ${timeAgo(i.createdAt)}</div>
    </button>`;
  },

  async loadLots() {
    this.lots = [];
    this.lotsLoaded = false;
    this.lotsError = false;
    this.lotsZip = this.zip;
    if (!this.zip) { this.renderLots(); return; }
    try {
      const zip = this.zip;
      const lots = await Data.vacantLots({ zip });
      if (zip !== this.zip) return;
      this.lots = lots.filter(l => l.sqft >= 500)
        .sort((a, b) => (b.publicOwner - a.publicOwner) || (b.sqft - a.sqft))
        .slice(0, 10);
      this.lotsLoaded = true;
    } catch {
      this.lotsError = true;
    }
    this.renderLots();
  },

  renderLots() {
    const el = $('#lot-list');
    if (!el) return;
    if (!this.zip) { el.innerHTML = '<p class="muted">Enter a ZIP code to see vacant lots.</p>'; return; }
    if (this.lotsError) { el.innerHTML = '<p class="muted">Couldn\'t load vacant lots right now.</p>'; return; }
    if (!this.lotsLoaded) return;
    el.innerHTML = this.lots.length ? `<ul class="lot-list">${this.lots.map((l, idx) => `
      <li>
        <div><strong>${esc(titleCase(l.address))}</strong><div class="muted small">${fmt(l.sqft)} sq ft · ${esc(titleCase(l.owner))}</div></div>
        <div class="lot-actions">
          ${l.publicOwner ? '<span class="tag tag-public">Public</span>' : '<span class="tag">Private</span>'}
          <button type="button" class="btn-secondary" data-action="lot-petition" data-index="${idx}">Start petition</button>
        </div>
      </li>`).join('')}</ul>` : '<p class="muted">No vacant lots over 500 sq ft are recorded in this ZIP.</p>';
  },

  // ---------- Where it's growing (map) ----------

  mapView(items) {
    const placed = items.filter(i => i.lat != null);
    const unplaced = items.filter(i => i.lat == null);
    const upcoming = items.filter(i => i.type === 'project').sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const petitions = items.filter(i => i.type === 'petition' && i.signatures.length < (i.goal || 100));
    const chip = (key, label) => `<button type="button" class="chip${this.growFilter === key ? ' chip-on' : ''}" data-grow="${key}">${label}</button>`;
    return `<div class="grow">
      <section class="card grow-map-card">
        <div class="card-head">
          <h3>Where green projects are growing${this.zip ? ` in ${esc(this.zip)}` : ''}</h3>
          <div class="chips">${chip('all', 'All')}${chip('project', '🌱 Projects')}${chip('petition', '✊ Petitions')}${chip('garden', '🥕 Gardens')}${chip('partner', '🤝 Partners')}</div>
        </div>
        <div class="grow-map-wrap" id="grow-wrap"><div id="grow-map"></div><div id="grow-map3d" class="map3d" hidden></div></div>
        <div class="grow-legend">
          <span><i style="background:#2f8f5b"></i>Volunteer project</span>
          <span><i style="background:${COLORS.proposal}"></i>Petition</span>
          <span><i style="background:${COLORS.garden}"></i>Active community garden</span>
          ${Auth.current() ? '<span><i class="ring"></i>Your saved sites</span>' : ''}
          ${this.growFilter === 'partner' ? Object.values(PARTNER_KINDS).map(k => `<span><i style="background:${k.color}"></i>${esc(k.label)}</span>`).join('') : ''}
        </div>
      </section>
      <aside class="grow-side">
        <section class="card">
          <h3>Active projects</h3>
          ${upcoming.length ? `<ul class="grow-list">${upcoming.map(i => this.growRow(i)).join('')}</ul>`
            : '<p class="muted small">No volunteer projects yet. <button type="button" class="linkish" data-action="create-project">Start one</button></p>'}
        </section>
        <section class="card">
          <h3>Petitions gathering signatures</h3>
          ${petitions.length ? `<ul class="grow-list">${petitions.map(i => this.growRow(i)).join('')}</ul>` : '<p class="muted small">No open petitions here yet.</p>'}
          ${unplaced.length ? `<p class="muted small">${unplaced.length} item${unplaced.length > 1 ? 's have' : ' has'} no map location yet.</p>` : ''}
        </section>
      </aside>
    </div>`;
  },

  growRow(i) {
    const meta = i.type === 'project'
      ? `${i.date ? `${esc(formatDate(i.date))} · ` : ''}${fmt(i.volunteers.length)}${i.needed ? `/${fmt(i.needed)}` : ''} volunteers`
      : `${fmt(i.signatures.length)}/${fmt(i.goal || 100)} signatures`;
    return `<li><button type="button" data-action="${i.lat != null ? 'grow-focus' : 'open'}" data-id="${i.id}">
      <span>${esc(i.title)}</span><small>${meta}${i.lat == null ? ' · not mapped' : ''}</small></button></li>`;
  },

  async drawGrowMap(items) {
    if (this.growMap) { this.growMap.remove(); this.growMap = null; }
    this.grow3d?.destroy();
    const m = L.map('grow-map', { zoomControl: true, scrollWheelZoom: false });
    this.growMap = m;
    addBasemaps(m, { control: false });
    this.growMarkers = {};
    const show = key => this.growFilter === 'all' || this.growFilter === key;
    const placed = items.filter(i => i.lat != null && show(i.type));

    // Leaflet needs a view before vector layers are added.
    const bounds = placed.map(i => L.latLng(i.lat, i.lng));
    const outline = state.zipFeature && state.zip === this.zip
      ? L.geoJSON(state.zipFeature, { style: { color: '#10261a', weight: 2, dashArray: '6 5', fill: false }, interactive: false })
      : null;
    if (outline) bounds.push(outline.getBounds().getNorthWest(), outline.getBounds().getSouthEast());
    if (bounds.length) m.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 16 });
    else m.setView([40.73, -73.95], 11);
    outline?.addTo(m);

    for (const i of placed) {
      const color = i.type === 'project' ? '#2f8f5b' : COLORS.proposal;
      const marker = L.circleMarker([i.lat, i.lng], { radius: 10, color: '#fff', weight: 2.5, fillColor: color, fillOpacity: 1 })
        .bindPopup(`<div class="pop"><div class="pop-kicker">${i.type === 'project' ? 'Volunteer project' : 'Petition'}</div><strong>${esc(i.title)}</strong>
          <div class="muted small">${i.type === 'project' ? `${i.date ? esc(formatDate(i.date)) + ' · ' : ''}${fmt(i.volunteers.length)} volunteers` : `${fmt(i.signatures.length)} of ${fmt(i.goal || 100)} signatures`}</div>
          <button type="button" class="btn-primary btn-sm" data-action="open" data-id="${i.id}">Open</button></div>`)
        .addTo(m);
      this.growMarkers[i.id] = marker;
    }
    const me = Auth.current();
    if (me && this.zip) {
      for (const p of Proposals.savedBy(me.id).filter(p => p.zip === this.zip)) {
        L.circleMarker([p.lat, p.lng], { radius: 8, color: COLORS.proposal, weight: 3, fillColor: '#fff', fillOpacity: 1 })
          .bindPopup(`<div class="pop"><div class="pop-kicker">Your saved site</div><strong>${esc(p.name)}</strong><div>${esc(p.type)}</div></div>`).addTo(m);
      }
    }
    // 3D view of the same markers. Remembers whether it was on across re-renders.
    const was3d = this.grow3dOn;
    this.growGardens = [];
    this.growPartners = [];
    this.grow3d = new View3D({
      container: 'grow-map3d',
      leaflet: () => m,
      onToggle: on => { this.grow3dOn = on; },
      layers: () => {
        const itemPoints = type => turf.featureCollection(placed.filter(i => i.type === type).map(i => turf.point([i.lng, i.lat], {
          id: i.id, title: i.title, kind: type,
          meta: type === 'project' ? `${i.date ? formatDate(i.date) + ' · ' : ''}${i.volunteers.length} volunteers` : `${i.signatures.length} of ${i.goal || 100} signatures`,
        })));
        const itemPopup = p => `<div class="pop"><div class="pop-kicker">${p.kind === 'project' ? 'Volunteer project' : 'Petition'}</div><strong>${esc(p.title)}</strong><div class="muted small">${esc(p.meta)}</div><button type="button" class="btn-primary btn-sm" data-action="open" data-id="${esc(p.id)}">Open</button></div>`;
        const me = Auth.current();
        const saved = me && this.zip ? Proposals.savedBy(me.id).filter(p => p.zip === this.zip) : [];
        return [
          ...(outline ? [{ id: 'grow-zip', type: 'line', data: state.zipFeature, paint: outlinePaint }] : []),
          { id: 'grow-gardens', type: 'circle', data: turf.featureCollection(this.growGardens), paint: dotPaint(COLORS.garden, 6),
            popup: p => `<div class="pop"><div class="pop-kicker">Active community garden</div><strong>${esc(p.name)}</strong><div>${esc(p.address || '')}</div></div>` },
          { id: 'grow-saved', type: 'circle', data: turf.featureCollection(saved.map(p => turf.point([p.lng, p.lat], { name: p.name, type: p.type }))),
            paint: { 'circle-radius': 8, 'circle-color': '#fff', 'circle-stroke-color': COLORS.proposal, 'circle-stroke-width': 3 },
            popup: p => `<div class="pop"><div class="pop-kicker">Your saved site</div><strong>${esc(p.name)}</strong><div>${esc(p.type)}</div></div>` },
          { id: 'grow-partners', type: 'circle', data: turf.featureCollection(this.growPartners), popup: p => partnerPopup(p),
            paint: { ...dotPaint('#888', 7), 'circle-color': ['match', ['get', 'kind'], ...Object.entries(PARTNER_KINDS).flatMap(([k, v]) => [k, v.color]), '#888'] } },
          { id: 'grow-projects', type: 'circle', data: itemPoints('project'), paint: dotPaint('#2f8f5b', 10), popup: itemPopup },
          { id: 'grow-petitions', type: 'circle', data: itemPoints('petition'), paint: dotPaint(COLORS.proposal, 10), popup: itemPopup },
        ];
      },
    });
    add3DToggle($('#grow-wrap'), this.grow3d);
    if (was3d) $('#grow-wrap .toggle-3d').click();

    if (this.growFilter === 'partner' && this.zip) {
      try {
        const partners = await this.getPartners(this.zip);
        if (this.growMap !== m) return;
        this.partnerLists = { ...(this.partnerLists || {}), [this.zip]: partners };
        for (const p of partners) {
          const props = { uid: p.uid, name: partnerName(p), kind: p.kind, type: titleCase(p.type), address: titleCase(p.address), linked: this.linkedItems(p.uid).length };
          this.growPartners.push(turf.point([p.lng, p.lat], props));
          L.circleMarker([p.lat, p.lng], { radius: props.linked ? 9 : 6, color: '#fff', weight: 2, fillColor: PARTNER_KINDS[p.kind].color, fillOpacity: 1 })
            .bindPopup(partnerPopup(props)).addTo(m);
        }
        this.grow3d.sync();
      } catch (err) { console.error(err); }
    }

    if (show('garden') && this.zip) {
      try {
        const zip = this.zip;
        const box = state.zipFeature && state.zip === zip ? turf.bbox(state.zipFeature) : m.getBounds().toBBoxString().split(',').map(Number);
        const gardens = await Data.gardens(zip, box);
        if (this.growMap !== m) return;
        gardens.filter(g => /^Active/.test(g.properties.status) && (g.properties.zip === zip)).forEach(g => {
          const [lng, lat] = turf.centroid(g).geometry.coordinates;
          this.growGardens.push(turf.point([lng, lat], { name: g.properties.name, address: g.properties.address }));
          L.circleMarker([lat, lng], { radius: 6, color: '#fff', weight: 2, fillColor: COLORS.garden, fillOpacity: 1 })
            .bindPopup(`<div class="pop"><div class="pop-kicker">Active community garden</div><strong>${esc(g.properties.name)}</strong><div>${esc(g.properties.address)}</div>${g.properties.hours ? `<div class="muted small">${esc(g.properties.hours)}</div>` : ''}</div>`)
            .addTo(m);
        });
        this.grow3d.sync();
      } catch {}
    }
  },

  // ---------- Partner sites ----------

  getPartners(zip) {
    this.partnerCache = this.partnerCache || {};
    if (!this.partnerCache[zip]) {
      this.partnerCache[zip] = Data.partnerSites(zip).catch(err => { delete this.partnerCache[zip]; throw err; });
    }
    return this.partnerCache[zip];
  },

  findPartner(uid) {
    return Object.values(this.partnerLists || {}).flat().find(p => p.uid === uid) || null;
  },

  linkedItems(uid) {
    return this.allItems.filter(i => i.partner?.uid === uid);
  },

  partnersView() {
    return `<div class="comm-grid">
      <section class="card">
        <div class="card-head"><h3>Partner sites${this.zip ? ` in ${esc(this.zip)}` : ''}</h3></div>
        <p class="muted">Schools, senior centers, nursing homes, homeless-services sites and food programs near you that could host, or benefit from, a green space.</p>
        <div class="chips partner-kinds" id="partner-kinds"></div>
        <div id="partner-list"><p class="muted"><span class="spinner spinner-sm"></span> Finding partner sites…</p></div>
      </section>
      <aside class="comm-side">
        <section class="card">
          <h3>How partnering works</h3>
          <ol class="steps">
            <li><strong>Pick a site</strong> and press <em>Propose a green space here</em>. It starts a project pinned at the site and tagged with the partner.</li>
            <li><strong>Reach out.</strong> Use <em>Find contact</em>, then share your project link with the principal, program director or facility manager.</li>
            <li><strong>Build it together.</strong> Neighbors volunteer through the project, and the partner's staff, students or residents can join in.</li>
          </ol>
          <p class="muted small">Already organizing a project? Use <em>Tag my project</em> to link it to a partner site.</p>
        </section>
        <section class="card">
          <h3>Programs that help</h3>
          <ul class="programs">
            <li><a href="https://www.growtolearn.org/" target="_blank" rel="noopener">GrowNYC Grow to Learn ↗</a><span>Grants, workshops and support for school gardens across NYC.</span></li>
            <li><a href="https://www.nycgovparks.org/greenthumb" target="_blank" rel="noopener">GreenThumb ↗</a><span>Materials and workshops for community and institutional gardens.</span></li>
            <li><a href="${LINKS.dep}" target="_blank" rel="noopener">DEP green infrastructure ↗</a><span>Funding for rain gardens and green roofs on private property, including schools and nonprofits.</span></li>
          </ul>
        </section>
        <p class="muted small">Source: NYC City Planning Facilities Database. Private residences, including supportive housing, are left out, and the city doesn't publish homeless shelter addresses to protect residents.</p>
      </aside>
    </div>`;
  },

  async renderPartners(items) {
    const list = () => $('#partner-list');
    if (!this.zip) { list().innerHTML = '<p class="muted">Enter a ZIP code to see partner sites.</p>'; return; }
    let partners;
    try {
      partners = await this.getPartners(this.zip);
    } catch {
      if (list()) list().innerHTML = '<p class="muted">Couldn\'t load partner sites right now.</p>';
      return;
    }
    if (!list()) return;
    this.partnerLists = { ...(this.partnerLists || {}), [this.zip]: partners };
    const counts = Object.fromEntries(Object.keys(PARTNER_KINDS).map(k => [k, partners.filter(p => p.kind === k).length]));
    const kind = this.partnerKind && counts[this.partnerKind] ? this.partnerKind : 'all';
    $('#partner-kinds').innerHTML = [
      `<button type="button" class="chip${kind === 'all' ? ' chip-on' : ''}" data-action="partner-kind" data-kind="all">All (${partners.length})</button>`,
      ...Object.entries(PARTNER_KINDS).filter(([k]) => counts[k]).map(([k, v]) =>
        `<button type="button" class="chip${kind === k ? ' chip-on' : ''}" data-action="partner-kind" data-kind="${k}">${v.icon} ${esc(v.label)} (${counts[k]})</button>`),
    ].join('');
    const shown = partners.filter(p => kind === 'all' || p.kind === kind)
      // Sites that already have projects first, then alphabetical.
      .sort((a, b) => this.linkedItems(b.uid).length - this.linkedItems(a.uid).length || a.name.localeCompare(b.name));
    const me = Auth.current();
    list().innerHTML = shown.length ? `<div class="partner-list">${shown.map(p => this.partnerCard(p, me)).join('')}</div>`
      : '<p class="muted">No partner sites are listed in this ZIP.</p>';
  },

  partnerCard(p, me) {
    const k = PARTNER_KINDS[p.kind];
    const linked = this.linkedItems(p.uid);
    const mine = me ? this.allItems.filter(i => i.organizerId === me.id && i.zip === this.zip && i.partner?.uid !== p.uid) : [];
    const search = `https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${p.address} New York NY ${p.zip}`)}`;
    return `<div class="partner-card" style="--kind:${k.color}">
      <div class="partner-top">
        <span class="partner-icon" title="${esc(k.one)}">${k.icon}</span>
        <div>
          <strong>${esc(partnerName(p))}</strong>
          <div class="muted small">${esc(titleCase(p.type))} · ${esc(titleCase(p.address))}${p.operator && titleCase(p.operator) !== partnerName(p) ? ` · run by ${esc(titleCase(p.operator))}` : ''}</div>
        </div>
      </div>
      <p class="partner-idea">💡 ${esc(k.idea)}. <span class="muted">${esc(k.why)}</span></p>
      ${linked.length ? `<div class="partner-linked">${linked.map(i => `<button type="button" class="linkish" data-action="open" data-id="${i.id}">${i.type === 'project' ? '🌱' : '✊'} ${esc(i.title)}</button>`).join('')}</div>` : ''}
      <div class="partner-actions">
        <button type="button" class="btn-primary btn-sm" data-action="partner-propose" data-uid="${esc(p.uid)}" data-type="project">Propose a green space here</button>
        ${mine.length ? `<button type="button" class="btn-secondary btn-sm" data-action="partner-tag" data-uid="${esc(p.uid)}">Tag my project</button>` : ''}
        <a class="btn-link small" href="${search}" target="_blank" rel="noopener">Find contact ↗</a>
      </div>
    </div>`;
  },

  proposeAtPartner(uid) {
    const p = this.findPartner(uid);
    if (!p) return;
    const k = PARTNER_KINDS[p.kind];
    this.openCreate({
      type: 'project',
      title: `${k.short} at ${partnerName(p)}`,
      siteType: k.siteType,
      zip: p.zip,
      location: `${partnerName(p)}, ${titleCase(p.address)}`,
      description: `Let's work with ${partnerName(p)} to create ${k.idea.charAt(0).toLowerCase() + k.idea.slice(1)}. ${k.why}`,
      lat: p.lat, lng: p.lng,
      partner: { uid: p.uid, name: p.name, kind: p.kind, address: p.address },
    });
  },

  openTagPartner(uid) {
    const me = Auth.current();
    const p = this.findPartner(uid);
    if (!me || !p) return;
    const mine = this.allItems.filter(i => i.organizerId === me.id && i.zip === this.zip && i.partner?.uid !== p.uid);
    this.openDialog(`
      <h2 class="dlg-title">Tag a project with ${esc(partnerName(p))}</h2>
      <p class="muted">The project will show this partner site on its page and on the partner's card.</p>
      <div class="tag-list">${mine.map((i, n) => `
        <label class="check tag-option"><input type="radio" name="tag-item" value="${i.id}" ${n === 0 ? 'checked' : ''}>
          <span>${i.type === 'project' ? '🌱' : '✊'} ${esc(i.title)}${i.partner ? `<small class="muted"> (replaces ${esc(partnerName(i.partner))})</small>` : ''}</span></label>`).join('')}</div>
      <p class="form-error" id="item-error" role="alert"></p>
      <div class="dlg-actions"><button type="button" class="btn-link" data-action="close">Cancel</button><button type="button" class="btn-primary" data-action="tag-confirm" data-uid="${esc(p.uid)}">Tag project</button></div>`);
  },

  async confirmTagPartner(uid) {
    const p = this.findPartner(uid);
    const id = document.querySelector('[name=tag-item]:checked')?.value;
    if (!p || !id) return;
    try {
      await Store.setPartner(id, { uid: p.uid, name: p.name, kind: p.kind, address: p.address });
    } catch (err) {
      $('#item-error').textContent = err.message;
      return;
    }
    await this.refreshCache();
    await this.openItem(id);
    this.renderView();
  },

  // ---------- Volunteer ----------

  volunteerView(items) {
    const me = Auth.current();
    const projects = items.filter(i => i.type === 'project').sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const petitions = items.filter(i => i.type === 'petition' && i.signatures.length < (i.goal || 100)).slice(0, 4);
    return `<div class="comm-grid">
      <div class="comm-main">
        <section class="card">
          <div class="card-head">
            <h3>Volunteer opportunities${this.zip ? ` in ${esc(this.zip)}` : ''}</h3>
            <button type="button" class="btn-secondary btn-green" data-action="create-project">＋ Organize a project</button>
          </div>
          ${projects.length ? `<div class="opps-list">${projects.map(i => this.opportunityCard(i, me)).join('')}</div>` : `
            <div class="empty-hint"><div class="empty-icon">🌱</div><p>No volunteer projects in this ZIP yet. Organize a tree-bed cleanup, planting day or garden build and neighbors can sign up.</p></div>`}
        </section>
        ${petitions.length ? `
        <section class="card">
          <h3>Help a petition reach its goal</h3>
          <ul class="grow-list">${petitions.map(i => this.growRow(i).replace('data-action="grow-focus"', 'data-action="open"')).join('')}</ul>
        </section>` : ''}
        <section class="card">
          <h3>Official NYC programs</h3>
          <ul class="programs">${PROGRAMS.map(p => `<li><a href="${p.url}" target="_blank" rel="noopener">${esc(p.name)} ↗</a><span>${esc(p.desc)}</span></li>`).join('')}</ul>
        </section>
      </div>
      <aside class="comm-side">
        ${me ? this.profileCard(me) : `
        <section class="card cta-card">
          <div class="empty-icon">🔔</div>
          <h3>Get updates for your ZIP</h3>
          <p class="muted">Sign up to volunteer and hear about new projects, petitions and planting days near you.</p>
          <div class="cta-actions"><button type="button" class="btn-primary" data-action="signup">Sign up</button><button type="button" class="btn-link" data-action="login">Log in</button></div>
          <p class="muted small" id="followers-count"></p>
        </section>`}
        ${me ? this.updatesCard(me) : ''}
      </aside>
    </div>`;
  },

  opportunityCard(i, me) {
    const joined = me && i.volunteers.some(v => v.userId === me.id);
    const full = i.needed && i.volunteers.length >= i.needed;
    return `<div class="opp-card">
      <div class="opp-date">${i.date ? (() => { const [y, m, d] = i.date.split('-').map(Number); const dt = new Date(y, m - 1, d); return `<b>${dt.getDate()}</b><span>${dt.toLocaleDateString('en-US', { month: 'short' })}</span>`; })() : '<span>Date<br>TBD</span>'}</div>
      <div class="opp-info">
        <button type="button" class="linkish item-title" data-action="open" data-id="${i.id}">${esc(i.title)}</button>
        <div class="muted small">${i.location ? `📍 ${esc(i.location)} · ` : ''}${fmt(i.volunteers.length)}${i.needed ? ` of ${fmt(i.needed)}` : ''} volunteers · by ${esc(i.organizer)}</div>
      </div>
      <div class="opp-cta">${joined ? '<span class="saved-note">✓ You\'re in</span>'
        : full ? '<span class="muted small">Full</span>'
        : `<button type="button" class="btn-primary btn-sm" data-action="quick-join" data-id="${i.id}">Volunteer</button>`}</div>
    </div>`;
  },

  profileCard(me) {
    const v = me.volunteer || {};
    const smsZip = this.zip || me.follows?.[0] || null;
    const notify = me.notify || { projects: true, petitions: true, reminders: true, replies: true };
    return `<section class="card">
      <h3>Your volunteer profile</h3>
      <form id="profile-form" class="stack">
        <div>
          <div class="field-label">ZIP codes you follow</div>
          <div class="chips follow-chips">${(me.follows || []).map(z => `<span class="chip chip-on">${esc(z)} <button type="button" data-action="unfollow" data-zip="${esc(z)}" aria-label="Stop following ${esc(z)}">×</button></span>`).join('') || '<span class="muted small">None yet</span>'}</div>
          <div class="inline-form follow-add">
            <input name="newzip" inputmode="numeric" maxlength="5" placeholder="Add a ZIP" value="${this.zip && !(me.follows || []).includes(this.zip) ? esc(this.zip) : ''}">
            <button type="button" class="btn-secondary btn-green" data-action="follow">Follow</button>
          </div>
        </div>
        <fieldset><legend>I can help with</legend>
          ${INTERESTS.map(i => `<label class="check"><input type="checkbox" name="interests" value="${esc(i)}" ${v.interests?.includes(i) ? 'checked' : ''}> ${esc(i)}</label>`).join('')}
        </fieldset>
        <label>Availability<select name="availability">${['Weekends', 'Weekday evenings', 'Weekdays', 'Flexible'].map(a => `<option ${v.availability === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <fieldset class="sms-box">
          <legend>📱 Text alerts</legend>
          <label>Mobile phone <span class="muted small">(US)</span><input name="phone" value="${esc(v.phone || '')}" inputmode="tel" autocomplete="tel" placeholder="(212) 555-0100"></label>
          ${smsZip ? `<label class="check"><input type="checkbox" name="sms" ${v.sms?.on && v.sms.zip === smsZip ? 'checked' : ''}> Text me alerts for ZIP <strong>${esc(smsZip)}</strong></label>
          <p class="muted small consent">By checking this box you agree to receive text messages from Greenify NYC about green-space projects in this ZIP. Message and data rates may apply. Reply STOP to unsubscribe at any time.</p>`
            : '<p class="muted small">Follow a ZIP code to turn on text alerts.</p>'}
        </fieldset>
        <fieldset><legend>Send me updates about</legend>
          ${Object.entries(NOTIFY_OPTIONS).map(([k, label]) => `<label class="check"><input type="checkbox" name="notify" value="${k}" ${notify[k] ? 'checked' : ''}> ${esc(label)}</label>`).join('')}
        </fieldset>
        <button type="submit" class="btn-primary">${me.volunteer ? 'Save changes' : 'Sign me up to volunteer'}</button>
        <p class="muted small" id="profile-saved" role="status"></p>
        <p class="muted small">Updates appear in the feed below and under 🔔 in your account menu.</p>
      </form>
    </section>`;
  },

  updatesCard(me) {
    const events = this.activity(me).slice(0, 15);
    const seen = this.previousSeenAt ?? me.updatesSeenAt ?? 0;
    return `<section class="card">
      <h3>🔔 Your updates</h3>
      ${events.length ? `<ul class="updates">${events.map(e => `
        <li class="${e.at > seen ? 'unread' : ''}"><button type="button" data-action="open" data-id="${e.id}">
          <span class="u-icon">${e.icon}</span><span class="u-text">${e.text}<small>${timeAgo(e.at)}</small></span></button></li>`).join('')}</ul>`
        : `<p class="muted small">Nothing yet. Follow a ZIP to hear about new petitions and projects there.</p>`}
    </section>`;
  },

  async showFollowers() {
    if (!this.zip) return;
    const zip = this.zip;
    const n = await Auth.followersOf(zip);
    const el = $('#followers-count');
    if (el && n && zip === this.zip) el.textContent = `${n} neighbor${n > 1 ? 's follow' : ' follows'} ${zip}.`;
  },

  // Viewing the volunteer tab marks updates as read (but keeps this view's highlights).
  async markUpdatesSeen() {
    const me = Auth.current();
    if (!me) return;
    if (this.unreadCount(me) === 0) return;
    this.previousSeenAt = me.updatesSeenAt || 0;
    await Auth.updateProfile({ updatesSeenAt: Date.now() });
  },

  async saveProfile(form) {
    const d = new FormData(form);
    const notify = Object.fromEntries(Object.keys(NOTIFY_OPTIONS).map(k => [k, d.getAll('notify').includes(k)]));
    const me = Auth.current();
    const follows = me.follows || [];
    const newzip = String(d.get('newzip') || '').trim();
    const phone = String(d.get('phone') || '').trim();
    const smsZip = this.zip || follows[0] || null;
    const wantsSms = d.get('sms') === 'on' && smsZip;
    const before = me.volunteer?.sms;
    // Only text when alerts are newly turned on, or the number or ZIP changed.
    const shouldText = wantsSms && !(before?.on && before.phone === phone && before.zip === smsZip);
    if (wantsSms && !toUsPhone(phone)) {
      $('#profile-saved').textContent = 'Enter a 10-digit US mobile number to get text alerts.';
      return;
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;

    let smsNote = '';
    let sms = wantsSms ? { on: true, phone, zip: smsZip, at: Date.now() } : null;
    if (shouldText) {
      const result = await sendWelcomeText(phone, smsZip);
      if (result.ok) smsNote = ` We texted ${result.to}.`;
      else { smsNote = ` But the text couldn't be sent: ${result.error}`; sms = before || null; }
    }
    const nextFollows = [...follows];
    if (/^\d{5}$/.test(newzip) && !nextFollows.includes(newzip)) nextFollows.push(newzip);
    if (wantsSms && !nextFollows.includes(smsZip)) nextFollows.push(smsZip);
    await Auth.updateProfile({
      volunteer: { interests: d.getAll('interests'), availability: d.get('availability'), phone, sms, since: me.volunteer?.since || Date.now() },
      notify,
      follows: nextFollows,
    });
    this.renderView();
    const note = $('#profile-saved');
    if (note) note.textContent = `✓ Saved. Thanks for volunteering!${smsNote}`;
  },

  async follow(zip, add) {
    const me = Auth.current();
    if (!me || !/^\d{5}$/.test(zip)) return;
    const follows = new Set(me.follows || []);
    if (add) follows.add(zip); else follows.delete(zip);
    await Auth.updateProfile({ follows: [...follows] });
    this.renderView();
  },

  // ---------- Events ----------

  bind() {
    this.bound = true;
    const root = $('#community-panel');
    root.addEventListener('submit', e => {
      e.preventDefault();
      if (e.target.id === 'profile-form') this.saveProfile(e.target);
    });
    root.addEventListener('click', async e => {
      const view = e.target.closest('[data-view]');
      if (view) { this.view = view.dataset.view; this.renderView(); return; }
      const grow = e.target.closest('[data-grow]');
      if (grow) { this.growFilter = grow.dataset.grow; this.renderView(); return; }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const a = btn.dataset.action;
      if (a === 'create') this.openCreate({ type: 'petition' });
      if (a === 'create-project') this.openCreate({ type: 'project' });
      if (a === 'open') this.openItem(btn.dataset.id);
      if (a === 'signup') AuthUI.open({ mode: 'signup', reason: 'Create an account to volunteer and get updates for your ZIP.' });
      if (a === 'login') AuthUI.open({ reason: 'Log in to volunteer and get updates for your ZIP.' });
      if (a === 'follow') this.follow(root.querySelector('[name=newzip]').value.trim(), true);
      if (a === 'unfollow') this.follow(btn.dataset.zip, false);
      if (a === 'quick-join') this.openItem(btn.dataset.id, { focusJoin: true });
      if (a === 'partner-kind') { this.partnerKind = btn.dataset.kind; this.renderPartners(this.allItems.filter(i => i.zip === this.zip)); }
      if (a === 'partner-propose') this.proposeAtPartner(btn.dataset.uid, btn.dataset.type);
      if (a === 'partner-tag') this.openTagPartner(btn.dataset.uid);
      if (a === 'grow-focus') {
        const marker = this.growMarkers?.[btn.dataset.id];
        if (marker) { this.growMap.flyTo(marker.getLatLng(), 17); marker.openPopup(); }
      }
      if (a === 'lot-petition') {
        const l = this.lots[+btn.dataset.index];
        this.openCreate({
          type: 'petition', siteType: 'Vacant lot', lat: l.lat, lng: l.lng,
          location: `${titleCase(l.address)} (${fmt(l.sqft)} sq ft, BBL ${l.bbl})`,
          target: l.publicOwner ? 'NYC Parks / GreenThumb' : 'Property owner',
          title: `Turn ${titleCase(l.address)} into a community green space`,
        });
      }
    });

    const dlg = $('#community-dialog');
    dlg.addEventListener('click', e => {
      if (e.target === dlg) return dlg.close();
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const a = btn.dataset.action;
      if (a === 'close') dlg.close();
      if (a === 'need-login') this.loginThenReopen(btn.dataset.id, btn.dataset.reason);
      if (a === 'leave') this.leave(btn.dataset.id);
      if (a === 'clear-pin') this.setPickedLocation(null);
      if (a === 'tag-confirm') this.confirmTagPartner(btn.dataset.uid);
    });
    dlg.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      if (f.id === 'create-form') this.submitCreate(f);
      if (f.id === 'sign-form') this.submitSign(f);
      if (f.id === 'join-form') this.submitJoin(f);
      if (f.id === 'chat-form') this.submitMessage(f);
    });
    dlg.addEventListener('change', e => {
      if (e.target.name === 'type') dlg.querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== e.target.value; });
      if (e.target.name === 'savedSite' && e.target.value) {
        const p = Proposals.all().find(x => x.id === e.target.value);
        if (p) {
          this.setPickedLocation([p.lat, p.lng]);
          const loc = dlg.querySelector('[name=location]');
          if (!loc.value) loc.value = p.name;
          this.pickMap?.setView([p.lat, p.lng], 17);
        }
      }
    });
    // The "Open" button inside map popups (2D or 3D) lives outside the panel.
    document.addEventListener('click', e => {
      const btn = e.target.closest('.leaflet-popup [data-action=open], .maplibregl-popup [data-action=open]');
      if (btn) this.openItem(btn.dataset.id);
      const pbtn = e.target.closest('.leaflet-popup [data-action=partner-propose], .maplibregl-popup [data-action=partner-propose]');
      if (pbtn) this.proposeAtPartner(pbtn.dataset.uid, pbtn.dataset.type);
    });
  },

  // ---------- Dialogs ----------

  openDialog(html) {
    const dlg = $('#community-dialog');
    dlg.innerHTML = `<button type="button" class="dlg-close" data-action="close" aria-label="Close">×</button>${html}`;
    if (!dlg.open) dlg.showModal();
    return dlg;
  },

  async openCreate(prefill = {}) {
    const me = await Auth.require(`Log in or create an account to start a ${prefill.type === 'project' ? 'volunteer project' : 'petition'}.`);
    if (!me) return;
    const type = prefill.type || 'petition';
    this.createPartner = prefill.partner || null;
    const opt = (list, sel) => list.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const saved = Proposals.savedBy(me.id);
    const dlg = this.openDialog(`
      <form id="create-form" class="stack">
        <h2 class="dlg-title">Start something</h2>
        <div class="seg">
          <label><input type="radio" name="type" value="petition" ${type === 'petition' ? 'checked' : ''}><span><strong>Petition</strong><small>Ask the city or an owner to create green space</small></span></label>
          <label><input type="radio" name="type" value="project" ${type === 'project' ? 'checked' : ''}><span><strong>Volunteer project</strong><small>Rally neighbors to plant, build or clean up</small></span></label>
        </div>
        <label>Title<input name="title" required maxlength="120" value="${esc(prefill.title || '')}" placeholder="e.g. Turn the lot on W 126th St into a community garden"></label>
        <div class="two">
          <label>Kind of site<select name="siteType">${opt(SITE_TYPES, prefill.siteType || (type === 'project' ? 'Street trees' : 'Vacant lot'))}</select></label>
          <label>ZIP code<input name="zip" inputmode="numeric" pattern="\\d{5}" maxlength="5" required value="${esc(prefill.zip || this.zip || me.zip || '')}"></label>
        </div>
        <label>Location<input name="location" maxlength="160" value="${esc(prefill.location || '')}" placeholder="Address or cross streets"></label>
        <div>
          <div class="field-label">Pin it on the map <span class="muted small">(so neighbors can find it under “Where it's growing”)</span></div>
          ${saved.length ? `<select name="savedSite" class="saved-select"><option value="">Use one of my saved sites…</option>${saved.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.zip)})</option>`).join('')}</select>` : ''}
          <div id="pick-map"></div>
          <div class="pick-status muted small" id="pick-status"></div>
        </div>
        <label>What should happen, and why?<textarea name="description" rows="3" required placeholder="Describe the green space you want, who it helps, and what you're asking for.">${esc(prefill.description || '')}</textarea></label>
        <div class="two" data-for="petition" ${type === 'petition' ? '' : 'hidden'}>
          <label>Addressed to<select name="target">${opt(TARGETS, prefill.target || TARGETS[0])}</select></label>
          <label>Signature goal<input name="goal" type="number" min="10" step="10" value="100"></label>
        </div>
        <div class="two" data-for="project" ${type === 'project' ? '' : 'hidden'}>
          <label>Date<input name="date" type="date"></label>
          <label>Volunteers needed<input name="needed" type="number" min="1" value="10"></label>
        </div>
        ${prefill.partner ? `<p class="partner-banner">🤝 With partner site: <strong>${esc(partnerName(prefill.partner))}</strong> <span class="muted small">${esc(titleCase(prefill.partner.address || ''))}</span></p>` : ''}
        <p class="muted small">Posting as <strong>${esc(me.name)}</strong></p>
        <div class="dlg-actions"><button type="button" class="btn-link" data-action="close">Cancel</button><button type="submit" class="btn-primary">Publish</button></div>
      </form>`);
    this.initPickMap(prefill.lat != null && prefill.lat !== '' ? [Number(prefill.lat), Number(prefill.lng)] : null);
    dlg.querySelector('[name=title]').focus();
  },

  initPickMap(initial) {
    if (this.pickMap) { this.pickMap.remove(); this.pickMap = null; }
    this.picked = null;
    const m = L.map('pick-map', { zoomControl: true, attributionControl: false });
    this.pickMap = m;
    addBasemaps(m, { control: false });
    if (initial) m.setView(initial, 17);
    else if (state.zipFeature) m.fitBounds(L.geoJSON(state.zipFeature).getBounds());
    else m.setView([40.73, -73.95], 11);
    if (state.zipFeature) L.geoJSON(state.zipFeature, { style: { color: '#10261a', weight: 1.5, dashArray: '5 4', fill: false }, interactive: false }).addTo(m);
    m.on('click', e => this.setPickedLocation([e.latlng.lat, e.latlng.lng]));
    this.setPickedLocation(initial);
    setTimeout(() => m.invalidateSize(), 50);
  },

  setPickedLocation(latlng) {
    this.picked = latlng;
    this.pickMarker?.remove();
    this.pickMarker = null;
    if (latlng && this.pickMap) {
      this.pickMarker = L.circleMarker(latlng, { radius: 9, color: '#fff', weight: 2.5, fillColor: COLORS.proposal, fillOpacity: 1 }).addTo(this.pickMap);
    }
    const status = $('#pick-status');
    if (status) status.innerHTML = latlng ? `📍 Pinned. <button type="button" class="linkish" data-action="clear-pin">Remove pin</button>` : 'Click the map to drop a pin.';
  },

  async submitCreate(f) {
    const me = Auth.current();
    if (!me) return;
    const d = Object.fromEntries(new FormData(f));
    const item = await Store.createItem(me, {
      type: d.type,
      title: d.title.trim(),
      siteType: d.siteType,
      zip: d.zip,
      location: d.location.trim(),
      description: d.description.trim(),
      target: d.type === 'petition' ? d.target : null,
      goal: d.type === 'petition' ? Number(d.goal) || 100 : null,
      date: d.type === 'project' ? d.date : null,
      needed: d.type === 'project' ? Number(d.needed) || null : null,
      partner: this.createPartner,
      lat: this.picked ? +this.picked[0].toFixed(6) : null,
      lng: this.picked ? +this.picked[1].toFixed(6) : null,
    });
    // Organizers follow their project's ZIP automatically.
    if (!(me.follows || []).includes(item.zip)) await Auth.updateProfile({ follows: [...(me.follows || []), item.zip] });
    await this.load(item.zip);
    this.openItem(item.id);
  },

  async openItem(id, { focusJoin } = {}) {
    const i = await Store.getItem(id);
    if (!i) return;
    const me = Auth.current();
    const isPetition = i.type === 'petition';
    const signed = me && i.signatures.find(s => s.userId === me.id);
    const joined = me && i.volunteers.find(v => v.userId === me.id);
    const loginBtn = (label, reason) => `<button type="button" class="btn-primary" data-action="need-login" data-id="${i.id}" data-reason="${esc(reason)}">${label}</button>`;
    const n = i.signatures.length;

    this.openDialog(`
      <div class="item-detail">
        <div class="item-top">
          <span class="tag ${isPetition ? 'tag-petition' : 'tag-project'}">${isPetition ? 'Petition' : 'Volunteer project'}</span>
          <span class="muted small">${esc(i.siteType || '')} · ZIP ${esc(i.zip)}</span>
        </div>
        <h2 class="dlg-title">${esc(i.title)}</h2>
        ${i.location ? `<div class="muted">📍 ${esc(i.location)}</div>` : ''}
        <p class="detail-desc">${esc(i.description)}</p>
        ${i.partner ? `<p class="partner-banner">${PARTNER_KINDS[i.partner.kind]?.icon || '🤝'} Partner site: <strong>${esc(partnerName(i.partner))}</strong> <span class="muted small">${esc(titleCase(i.partner.address || ''))}</span></p>` : ''}
        <div class="muted small">Started by ${esc(i.organizer)} ${timeAgo(i.createdAt)}${isPetition ? ` · addressed to ${esc(i.target)}` : ''}</div>

        ${isPetition ? `
          <section class="detail-block">
            <div class="goal-row"><span><strong>${fmt(n)}</strong> signature${n === 1 ? '' : 's'}</span><span class="muted">Goal ${fmt(i.goal)}</span></div>
            <div class="bar"><span class="ok" style="width:${Math.min(100, (n / i.goal) * 100)}%"></span></div>
            ${signed ? `<p class="saved-note done-note">✓ You signed this petition ${timeAgo(signed.at)}.</p>`
              : me ? `<form id="sign-form" class="inline-form" data-id="${i.id}">
                  <input name="note" placeholder="Why it matters to you (optional)" maxlength="200">
                  <button type="submit" class="btn-primary">Sign as ${esc(me.name)}</button>
                </form>`
              : `<div class="login-cta">${loginBtn('Log in to sign', 'Log in to sign this petition. Each account can sign once.')}<span class="muted small">One signature per account.</span></div>`}
            ${n ? `<ul class="signers">${i.signatures.slice(-5).reverse().map(s => `<li><strong>${esc(s.name)}</strong>${s.note ? `: ${esc(s.note)}` : ''} <span class="muted small">${timeAgo(s.at)}</span></li>`).join('')}</ul>` : ''}
          </section>` : `
          <section class="detail-block">
            <div class="goal-row"><span>${i.date ? `📅 <strong>${esc(formatDate(i.date))}</strong>` : 'Date to be decided'}</span><span><strong>${fmt(i.volunteers.length)}</strong>${i.needed ? ` of ${fmt(i.needed)}` : ''} volunteers</span></div>
            ${i.needed ? `<div class="bar"><span class="ok" style="width:${Math.min(100, (i.volunteers.length / i.needed) * 100)}%"></span></div>` : ''}
            ${joined ? `<p class="saved-note done-note">✓ You're volunteering. <button type="button" class="linkish" data-action="leave" data-id="${i.id}">Can't make it?</button></p>`
              : me ? `<form id="join-form" class="inline-form" data-id="${i.id}">
                  <input name="contact" required placeholder="Best email or phone for the organizer" value="${esc(me.volunteer?.phone || me.email)}">
                  <button type="submit" class="btn-primary">Volunteer</button>
                </form>`
              : `<div class="login-cta">${loginBtn('Log in to volunteer', 'Log in to volunteer for this project.')}</div>`}
            ${i.volunteers.length ? `<p class="small muted">Volunteering: ${i.volunteers.map(v => esc(v.name)).join(', ')}</p>` : ''}
            ${me && me.id === i.organizerId && i.volunteers.length ? '<div id="organizer-contacts" class="small"></div>' : ''}
          </section>`}

        <section class="detail-block">
          <h3>Discussion</h3>
          <div class="chat" id="chat-log">
            ${i.messages.length ? i.messages.map(m => `<div class="msg${me && m.userId === me.id ? ' mine' : ''}"><div class="msg-meta"><strong>${esc(m.name)}</strong> <span>${timeAgo(m.at)}</span></div><div>${esc(m.text)}</div></div>`).join('')
              : '<p class="muted small">No messages yet. Ask a question, share an idea, or offer supplies.</p>'}
          </div>
          ${me ? `<form id="chat-form" class="inline-form" data-id="${i.id}">
              <input name="text" required placeholder="Write a message…" maxlength="500" autocomplete="off">
              <button type="submit" class="btn-primary">Send</button>
            </form>`
            : `<div class="login-cta">${loginBtn('Log in to join the discussion', 'Log in to post in the discussion.').replace('btn-primary', 'btn-secondary btn-green')}</div>`}
          <p class="form-error" id="item-error" role="alert"></p>
        </section>
      </div>`);
    const log = $('#chat-log');
    if (log) log.scrollTop = log.scrollHeight;
    if ($('#organizer-contacts')) {
      const contacts = await Store.volunteerContacts(i.id);
      const byUser = Object.fromEntries(contacts.map(c => [c.user_id, c.contact]));
      const el = $('#organizer-contacts');
      if (el) el.innerHTML = `<div class="field-label">Volunteer contacts <span class="muted">(only you can see these)</span></div><ul class="contact-list">${i.volunteers.map(v => `<li><strong>${esc(v.name)}</strong> ${esc(byUser[v.userId] || '—')}</li>`).join('')}</ul>`;
    }
    if (focusJoin) $('#join-form [name=contact]')?.focus();
  },

  async loginThenReopen(id, reason) {
    $('#community-dialog').close();
    const me = await Auth.require(reason);
    this.openItem(id);
    if (me) this.renderView();
  },

  async act(id, fn) {
    const me = Auth.current();
    if (!me) return this.loginThenReopen(id, 'Please log in first.');
    try {
      await fn(me);
    } catch (err) {
      const el = $('#item-error');
      if (el) el.textContent = err.message;
      return;
    }
    await this.refreshCache();
    await this.openItem(id);
    this.renderView();
  },

  submitSign(f) { return this.act(f.dataset.id, me => Store.sign(f.dataset.id, me, { note: f.note.value.trim() })); },
  submitJoin(f) { return this.act(f.dataset.id, me => Store.joinProject(f.dataset.id, me, { contact: f.contact.value.trim() })); },
  leave(id) { return this.act(id, me => Store.leaveProject(id, me)); },
  async submitMessage(f) {
    await this.act(f.dataset.id, me => Store.postMessage(f.dataset.id, me, { text: f.text.value.trim() }));
    $('#chat-form [name=text]')?.focus();
  },
};

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function partnerPopup(p) {
  const k = PARTNER_KINDS[p.kind];
  return `<div class="pop"><div class="pop-kicker">${k.icon} ${esc(k.one)}</div><strong>${esc(p.name)}</strong>
    <div class="muted small">${esc(p.type)} · ${esc(p.address)}</div>
    ${p.linked ? `<div class="small">${p.linked} project${p.linked > 1 ? 's' : ''} here</div>` : ''}
    <div class="small">💡 ${esc(k.idea)}</div>
    <button type="button" class="btn-primary btn-sm" data-action="partner-propose" data-uid="${esc(p.uid)}">Propose a green space here</button></div>`;
}

// US numbers only, e.g. (212) 555-0100 → +12125550100.
function toUsPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// Asks the send-welcome-sms Edge Function (supabase/functions) to text the confirmation.
// Twilio credentials live only in that function's secrets.
async function sendWelcomeText(phone, zip) {
  try {
    const { data, error } = await sb.functions.invoke('send-welcome-sms', { body: { phone, zip } });
    if (!error) return data;
    const detail = await error.context?.json?.().catch(() => null);
    if (detail?.error) return { ok: false, error: detail.error };
    if (/Failed to send a request|not found|404/i.test(error.message)) return { ok: false, error: "text alerts aren't set up yet (the send-welcome-sms function isn't deployed)." };
    return { ok: false, error: error.message };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
