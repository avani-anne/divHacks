// Community data store: petitions, projects, signatures, volunteers and discussion messages,
// backed by Supabase (tables and access rules in supabase/schema.sql). The rest of the app only
// talks to this API and works with the plain objects returned by toItem().

const ITEM_SELECT = '*, signatures(user_id, name, note, created_at), volunteers(user_id, name, created_at), messages(user_id, name, text, created_at)';
const ts = iso => Date.parse(iso);

function toItem(r) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    siteType: r.site_type,
    zip: r.zip,
    location: r.location,
    description: r.description,
    target: r.target,
    goal: r.goal,
    date: r.date,
    needed: r.needed,
    lat: r.lat,
    lng: r.lng,
    organizer: r.organizer_name || 'A neighbor',
    organizerId: r.organizer_id,
    createdAt: ts(r.created_at),
    signatures: (r.signatures || []).map(s => ({ userId: s.user_id, name: s.name, note: s.note, at: ts(s.created_at) })).sort((a, b) => a.at - b.at),
    volunteers: (r.volunteers || []).map(v => ({ userId: v.user_id, name: v.name, at: ts(v.created_at) })).sort((a, b) => a.at - b.at),
    messages: (r.messages || []).map(m => ({ userId: m.user_id, name: m.name, text: m.text, at: ts(m.created_at) })).sort((a, b) => a.at - b.at),
  };
}

// Postgres unique-constraint violations mean "already did this".
function checkError(error, duplicateMessage) {
  if (!error) return;
  if (error.code === '23505' && duplicateMessage) throw new Error(duplicateMessage);
  throw new Error(error.message || 'Something went wrong. Please try again.');
}

const Store = {
  // Petitions and projects, newest first. Pass a ZIP or an array of ZIPs to filter.
  async listItems(zips) {
    let q = sb.from('items').select(ITEM_SELECT).order('created_at', { ascending: false }).limit(1000);
    if (zips != null) q = q.in('zip', [].concat(zips));
    const { data, error } = await q;
    checkError(error);
    return data.map(toItem);
  },

  async getItem(id) {
    const { data, error } = await sb.from('items').select(ITEM_SELECT).eq('id', id).maybeSingle();
    checkError(error);
    return data ? toItem(data) : null;
  },

  // Organizer id and name are stamped by the database from the logged-in account.
  async createItem(user, f) {
    const { data, error } = await sb.from('items').insert({
      type: f.type, title: f.title, site_type: f.siteType, zip: f.zip, location: f.location,
      description: f.description, target: f.target, goal: f.goal, date: f.date || null,
      needed: f.needed, lat: f.lat, lng: f.lng,
    }).select(ITEM_SELECT).single();
    checkError(error);
    return toItem(data);
  },

  async sign(id, user, { note }) {
    const { error } = await sb.from('signatures').insert({ item_id: id, note: note || null });
    checkError(error, "You've already signed this petition.");
  },

  async joinProject(id, user, { contact }) {
    const { error } = await sb.from('volunteers').insert({ item_id: id });
    checkError(error, "You're already signed up for this project.");
    if (contact) {
      const res = await sb.from('volunteer_contacts').insert({ item_id: id, contact });
      if (res.error && res.error.code !== '23505') console.error(res.error);
    }
  },

  async leaveProject(id, user) {
    const { error } = await sb.from('volunteers').delete().eq('item_id', id).eq('user_id', user.id);
    checkError(error);
    await sb.from('volunteer_contacts').delete().eq('item_id', id).eq('user_id', user.id);
  },

  async postMessage(id, user, { text }) {
    const { error } = await sb.from('messages').insert({ item_id: id, text });
    checkError(error);
  },

  // Contact details for a project's volunteers (only returned to the organizer, per the RLS policy).
  async volunteerContacts(id) {
    const { data, error } = await sb.from('volunteer_contacts').select('user_id, contact').eq('item_id', id);
    return error ? [] : data;
  },
};
