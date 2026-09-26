// "Community" tab: petitions & projects, discussion threads, volunteer sign-up.

const NAME_KEY = 'gsp-my-name';
const INTERESTS = ['Tree care', 'Community gardening', 'Park & lot cleanups', 'Petitions & advocacy', 'Building green spaces'];
const SITE_TYPES = ['Vacant lot', 'Bus stop', 'Street trees', 'Rooftop', 'Schoolyard', 'Park improvement', 'Other'];
const TARGETS = ['NYC Parks / GreenThumb', 'NYC DOT', 'City Council Member', 'Community Board', 'Property owner', 'Other'];

const PROGRAMS = [
  { name: 'NYC Parks volunteering', desc: 'Stewardship days, tree care and park events across the five boroughs.', url: 'https://www.nycgovparks.org/opportunities/volunteer' },
  { name: 'GreenThumb', desc: 'Support for 550+ community gardens: workshops, materials and starting a new garden.', url: 'https://www.nycgovparks.org/greenthumb' },
  { name: 'NYC Service', desc: 'The city\'s volunteer hub. Search opportunities by borough and cause.', url: 'https://www.nycservice.org/' },
  { name: 'Trees New York', desc: 'Citizen Pruner training so you can legally care for street trees.', url: 'https://treesny.org/' },
];

const Community = {
  zip: null,
  pending: null,  // prefill waiting for the tab to open
  lots: [],

  myName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  },
  rememberName(name) {
    try { localStorage.setItem(NAME_KEY, name); } catch {}
  },

  // Follows the ZIP in the top bar, unless a petition was started for a spot in another ZIP.
  async show() {
    if (!this.bound) this.bind();
    const zip = this.pending?.zip || state.zip;
    if (!this.rendered || zip !== this.zip) await this.load(zip);
    if (this.pending) {
      const prefill = this.pending;
      this.pending = null;
      this.openCreate(prefill);
    }
  },

  // Called from the Build Ideas tab.
  startPetition(prefill) {
    this.pending = { type: 'petition', ...prefill };
    if (!/^\d{5}$/.test(prefill.zip || '')) delete this.pending.zip;
    showTab('community');
  },

  bind() {
    this.bound = true;
    const root = $('#community-panel');
    root.addEventListener('submit', e => {
      e.preventDefault();
      if (e.target.id === 'volunteer-form') this.submitVolunteer(e.target);
    });
    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const a = btn.dataset.action;
      if (a === 'create') this.openCreate({ type: 'petition' });
      if (a === 'open') this.openItem(btn.dataset.id);
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
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      if (f.id === 'create-form') this.submitCreate(f);
      if (f.id === 'sign-form') this.submitSign(f);
      if (f.id === 'join-form') this.submitJoin(f);
      if (f.id === 'chat-form') this.submitMessage(f);
    });
    dlg.addEventListener('change', e => {
      if (e.target.name === 'type') {
        dlg.querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== e.target.value; });
      }
    });
    dlg.addEventListener('click', e => { if (e.target.closest('[data-action=close]')) dlg.close(); });
  },

  async load(zip) {
    this.zip = zip || null;
    this.rendered = true;
    const items = await Store.listItems(this.zip);
    const volunteers = await Store.listVolunteers(this.zip);
    $('#community-panel').innerHTML = this.layout(items, volunteers.length);
    this.loadLots();
  },

  layout(items, volunteerCount) {
    const zip = this.zip;
    return `
      <div class="comm-wrap">
        <div class="comm-head">
          <div>
            <div class="kicker">Community</div>
            <h2 class="panel-title">Organize for green space${zip ? ` in ${esc(zip)}` : ''}</h2>
            <p class="muted">Start or sign petitions, rally volunteers for projects, and talk it through with neighbors.</p>
          </div>
        </div>

        ${Store.shared ? '' : `<div class="demo-note"><strong>Demo mode:</strong> petitions, sign-ups and messages are saved in this browser only. Connect a shared database in <code>js/store.js</code> to make them public.</div>`}

        <div class="comm-grid">
          <div class="comm-main">
            <section class="card">
              <div class="card-head">
                <h3>Petitions &amp; projects${zip ? ` in ${esc(zip)}` : ''}</h3>
                <button type="button" class="btn-primary" data-action="create">＋ Start a petition or project</button>
              </div>
              ${items.length ? `<div class="items">${items.map(i => this.itemCard(i)).join('')}</div>` : `
                <div class="empty-hint">
                  <div class="empty-icon">✊</div>
                  <p>Nothing here yet${zip ? ` for ${esc(zip)}` : ''}. Start the first petition, or pick a vacant lot below.</p>
                </div>`}
            </section>

            <section class="card">
              <h3>Vacant lots that could become green space</h3>
              <p class="muted small">From NYC's PLUTO tax lot data (land use: vacant). Publicly owned lots are listed first.</p>
              <div id="lot-list"><p class="muted"><span class="spinner spinner-sm"></span> Loading lots…</p></div>
            </section>
          </div>

          <aside class="comm-side">
            <section class="card">
              <h3>Sign up to volunteer</h3>
              <form id="volunteer-form" class="stack">
                <label>Name<input name="name" required value="${esc(this.myName())}"></label>
                <label>Email or phone<input name="contact" required></label>
                <label>ZIP code<input name="zip" inputmode="numeric" pattern="\\d{5}" maxlength="5" required value="${esc(zip || '')}"></label>
                <fieldset>
                  <legend>I'm interested in</legend>
                  ${INTERESTS.map(i => `<label class="check"><input type="checkbox" name="interests" value="${esc(i)}"> ${esc(i)}</label>`).join('')}
                </fieldset>
                <label>Availability
                  <select name="availability"><option>Weekends</option><option>Weekday evenings</option><option>Weekdays</option><option>Flexible</option></select>
                </label>
                <button type="submit" class="btn-primary">Sign me up</button>
                <p class="muted small" id="volunteer-count">${volunteerCount ? `${volunteerCount} neighbor${volunteerCount > 1 ? 's have' : ' has'} signed up${zip ? ` in ${esc(zip)}` : ''}.` : ''}</p>
              </form>
            </section>

            <section class="card">
              <h3>Official NYC programs</h3>
              <ul class="programs">${PROGRAMS.map(p => `<li><a href="${p.url}" target="_blank" rel="noopener">${esc(p.name)} ↗</a><span>${esc(p.desc)}</span></li>`).join('')}</ul>
            </section>
          </aside>
        </div>
      </div>`;
  },

  itemCard(i) {
    const isPetition = i.type === 'petition';
    const progress = isPetition ? Math.min(1, i.signatures.length / (i.goal || 100)) : null;
    return `<button type="button" class="item" data-action="open" data-id="${i.id}">
      <div class="item-top">
        <span class="tag ${isPetition ? 'tag-petition' : 'tag-project'}">${isPetition ? 'Petition' : 'Project'}</span>
        <span class="muted small">${esc(i.siteType || '')}</span>
      </div>
      <strong class="item-title">${esc(i.title)}</strong>
      ${i.location ? `<div class="muted small">📍 ${esc(i.location)}</div>` : ''}
      ${isPetition ? `
        <div class="bar"><span class="ok" style="width:${progress * 100}%"></span></div>
        <div class="small item-meta"><strong>${fmt(i.signatures.length)}</strong> of ${fmt(i.goal || 100)} signatures · to ${esc(i.target || '—')}</div>`
      : `<div class="small item-meta">${i.date ? `📅 ${esc(formatDate(i.date))} · ` : ''}<strong>${fmt(i.volunteers.length)}</strong>${i.needed ? ` of ${fmt(i.needed)}` : ''} volunteers</div>`}
      <div class="muted small">💬 ${i.messages.length} message${i.messages.length === 1 ? '' : 's'} · started by ${esc(i.organizer)} ${timeAgo(i.createdAt)}</div>
    </button>`;
  },

  async loadLots() {
    const el = () => $('#lot-list');
    if (!this.zip) {
      el().innerHTML = '<p class="muted">Enter a ZIP code to see vacant lots.</p>';
      return;
    }
    try {
      const zip = this.zip;
      const lots = await Data.vacantLots({ zip });
      if (zip !== this.zip || !el()) return;
      this.lots = lots
        .filter(l => l.sqft >= 500)
        .sort((a, b) => (b.publicOwner - a.publicOwner) || (b.sqft - a.sqft))
        .slice(0, 10);
      el().innerHTML = this.lots.length ? `<ul class="lot-list">${this.lots.map((l, idx) => `
        <li>
          <div>
            <strong>${esc(titleCase(l.address))}</strong>
            <div class="muted small">${fmt(l.sqft)} sq ft · ${esc(titleCase(l.owner))}</div>
          </div>
          <div class="lot-actions">
            ${l.publicOwner ? '<span class="tag tag-public">Public</span>' : '<span class="tag">Private</span>'}
            <button type="button" class="btn-secondary" data-action="lot-petition" data-index="${idx}">Start petition</button>
          </div>
        </li>`).join('')}</ul>` : '<p class="muted">No vacant lots over 500 sq ft are recorded in this ZIP.</p>';
    } catch {
      if (el()) el().innerHTML = '<p class="muted">Couldn\'t load vacant lots right now.</p>';
    }
  },

  // ---------- Dialogs ----------

  openDialog(html) {
    const dlg = $('#community-dialog');
    dlg.innerHTML = `<button type="button" class="dlg-close" data-action="close" aria-label="Close">×</button>${html}`;
    if (!dlg.open) dlg.showModal();
    return dlg;
  },

  openCreate(prefill = {}) {
    const type = prefill.type || 'petition';
    const opt = (list, sel) => list.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const dlg = this.openDialog(`
      <form id="create-form" class="stack">
        <h2 class="dlg-title">Start something</h2>
        <div class="seg">
          <label><input type="radio" name="type" value="petition" ${type === 'petition' ? 'checked' : ''}><span><strong>Petition</strong><small>Ask the city or an owner to create green space</small></span></label>
          <label><input type="radio" name="type" value="project" ${type === 'project' ? 'checked' : ''}><span><strong>Volunteer project</strong><small>Rally neighbors to plant, build or clean up</small></span></label>
        </div>
        <label>Title<input name="title" required maxlength="120" value="${esc(prefill.title || '')}" placeholder="e.g. Turn the lot on W 126th St into a community garden"></label>
        <div class="two">
          <label>Kind of site<select name="siteType">${opt(SITE_TYPES, prefill.siteType || 'Vacant lot')}</select></label>
          <label>ZIP code<input name="zip" inputmode="numeric" pattern="\\d{5}" maxlength="5" required value="${esc(prefill.zip || this.zip || '')}"></label>
        </div>
        <label>Location<input name="location" maxlength="160" value="${esc(prefill.location || '')}" placeholder="Address or cross streets"></label>
        <label>What should happen, and why?<textarea name="description" rows="4" required placeholder="Describe the green space you want, who it helps, and what you're asking for.">${esc(prefill.description || '')}</textarea></label>
        <div class="two" data-for="petition" ${type === 'petition' ? '' : 'hidden'}>
          <label>Addressed to<select name="target">${opt(TARGETS, prefill.target || TARGETS[0])}</select></label>
          <label>Signature goal<input name="goal" type="number" min="10" step="10" value="100"></label>
        </div>
        <div class="two" data-for="project" ${type === 'project' ? '' : 'hidden'}>
          <label>Date<input name="date" type="date"></label>
          <label>Volunteers needed<input name="needed" type="number" min="1" value="10"></label>
        </div>
        <label>Your name<input name="organizer" required value="${esc(this.myName())}"></label>
        <input type="hidden" name="lat" value="${esc(prefill.lat ?? '')}"><input type="hidden" name="lng" value="${esc(prefill.lng ?? '')}">
        <div class="dlg-actions"><button type="button" class="btn-link" data-action="close">Cancel</button><button type="submit" class="btn-primary">Publish</button></div>
      </form>`);
    dlg.querySelector('[name=title]').focus();
  },

  async submitCreate(f) {
    const d = Object.fromEntries(new FormData(f));
    this.rememberName(d.organizer.trim());
    const item = await Store.createItem({
      type: d.type,
      title: d.title.trim(),
      siteType: d.siteType,
      zip: d.zip,
      location: d.location.trim(),
      description: d.description.trim(),
      organizer: d.organizer.trim(),
      target: d.type === 'petition' ? d.target : null,
      goal: d.type === 'petition' ? Number(d.goal) || 100 : null,
      date: d.type === 'project' ? d.date : null,
      needed: d.type === 'project' ? Number(d.needed) || null : null,
      lat: d.lat ? Number(d.lat) : null,
      lng: d.lng ? Number(d.lng) : null,
    });
    await this.load(item.zip);
    this.openItem(item.id);
  },

  async openItem(id) {
    const i = await Store.getItem(id);
    if (!i) return;
    const isPetition = i.type === 'petition';
    const name = esc(this.myName());
    this.openDialog(`
      <div class="item-detail">
        <div class="item-top">
          <span class="tag ${isPetition ? 'tag-petition' : 'tag-project'}">${isPetition ? 'Petition' : 'Volunteer project'}</span>
          <span class="muted small">${esc(i.siteType || '')} · ZIP ${esc(i.zip)}</span>
        </div>
        <h2 class="dlg-title">${esc(i.title)}</h2>
        ${i.location ? `<div class="muted">📍 ${esc(i.location)}</div>` : ''}
        <p class="detail-desc">${esc(i.description)}</p>
        <div class="muted small">Started by ${esc(i.organizer)} ${timeAgo(i.createdAt)}${isPetition ? ` · addressed to ${esc(i.target)}` : ''}</div>

        ${isPetition ? `
          <section class="detail-block">
            <div class="goal-row"><span><strong>${fmt(i.signatures.length)}</strong> signature${i.signatures.length === 1 ? '' : 's'}</span><span class="muted">Goal ${fmt(i.goal)}</span></div>
            <div class="bar"><span class="ok" style="width:${Math.min(100, (i.signatures.length / i.goal) * 100)}%"></span></div>
            <form id="sign-form" class="inline-form" data-id="${i.id}">
              <input name="name" required placeholder="Your name" value="${name}">
              <input name="note" placeholder="Why it matters to you (optional)" maxlength="200">
              <button type="submit" class="btn-primary">Sign</button>
            </form>
            ${i.signatures.length ? `<ul class="signers">${i.signatures.slice(-5).reverse().map(s => `<li><strong>${esc(s.name)}</strong>${s.note ? `: ${esc(s.note)}` : ''} <span class="muted small">${timeAgo(s.at)}</span></li>`).join('')}</ul>` : ''}
          </section>` : `
          <section class="detail-block">
            <div class="goal-row"><span>${i.date ? `📅 <strong>${esc(formatDate(i.date))}</strong>` : 'Date to be decided'}</span><span><strong>${fmt(i.volunteers.length)}</strong>${i.needed ? ` of ${fmt(i.needed)}` : ''} volunteers</span></div>
            ${i.needed ? `<div class="bar"><span class="ok" style="width:${Math.min(100, (i.volunteers.length / i.needed) * 100)}%"></span></div>` : ''}
            <form id="join-form" class="inline-form" data-id="${i.id}">
              <input name="name" required placeholder="Your name" value="${name}">
              <input name="contact" required placeholder="Email or phone">
              <button type="submit" class="btn-primary">Count me in</button>
            </form>
            ${i.volunteers.length ? `<p class="small muted">Volunteering: ${i.volunteers.map(v => esc(v.name)).join(', ')}</p>` : ''}
          </section>`}

        <section class="detail-block">
          <h3>Discussion</h3>
          <div class="chat" id="chat-log">
            ${i.messages.length ? i.messages.map(m => `<div class="msg${m.name === this.myName() ? ' mine' : ''}"><div class="msg-meta"><strong>${esc(m.name)}</strong> <span>${timeAgo(m.at)}</span></div><div>${esc(m.text)}</div></div>`).join('')
              : '<p class="muted small">No messages yet. Ask a question, share an idea, or offer supplies.</p>'}
          </div>
          <form id="chat-form" class="inline-form" data-id="${i.id}">
            <input name="name" required placeholder="Name" value="${name}" class="chat-name">
            <input name="text" required placeholder="Write a message…" maxlength="500" autocomplete="off">
            <button type="submit" class="btn-primary">Send</button>
          </form>
        </section>
      </div>`);
    const log = $('#chat-log');
    if (log) log.scrollTop = log.scrollHeight;
  },

  async submitSign(f) {
    const d = Object.fromEntries(new FormData(f));
    this.rememberName(d.name.trim());
    await Store.sign(f.dataset.id, { name: d.name.trim(), note: d.note.trim() });
    await this.refreshAfterChange(f.dataset.id);
  },

  async submitJoin(f) {
    const d = Object.fromEntries(new FormData(f));
    this.rememberName(d.name.trim());
    await Store.joinProject(f.dataset.id, { name: d.name.trim(), contact: d.contact.trim() });
    await this.refreshAfterChange(f.dataset.id);
  },

  async submitMessage(f) {
    const d = Object.fromEntries(new FormData(f));
    this.rememberName(d.name.trim());
    await Store.postMessage(f.dataset.id, { name: d.name.trim(), text: d.text.trim() });
    await this.refreshAfterChange(f.dataset.id);
    $('#chat-form [name=text]')?.focus();
  },

  async refreshAfterChange(id) {
    await this.openItem(id);
    const items = await Store.listItems(this.zip);
    const list = document.querySelector('#community-panel .items');
    if (list) list.innerHTML = items.map(i => this.itemCard(i)).join('');
  },

  async submitVolunteer(f) {
    const d = new FormData(f);
    const fields = {
      name: d.get('name').trim(),
      contact: d.get('contact').trim(),
      zip: d.get('zip'),
      interests: d.getAll('interests'),
      availability: d.get('availability'),
    };
    this.rememberName(fields.name);
    await Store.addVolunteer(fields);
    const projects = (await Store.listItems(fields.zip)).filter(i => i.type === 'project');
    f.outerHTML = `<div class="thanks">
      <div class="empty-icon">🌿</div>
      <p><strong>Thanks, ${esc(fields.name)}!</strong> You're on the list for ${esc(fields.zip)}.</p>
      ${projects.length ? `<p class="small">Projects near you:</p><ul class="mini-list">${projects.slice(0, 4).map(p => `<li><button type="button" class="linkish" data-action="open" data-id="${p.id}">${esc(p.title)}</button></li>`).join('')}</ul>`
        : '<p class="small muted">No volunteer projects in this ZIP yet. You could start one, or join an official program below.</p>'}
    </div>`;
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
