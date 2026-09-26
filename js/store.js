// Community data store: petitions, projects, signatures, volunteers and discussion messages.
//
// DEMO MODE: data lives in this browser's localStorage, so other people can't see it.
// To make it shared, replace the bodies of these async methods with calls to a hosted
// database (Firebase, Supabase, etc.). The rest of the app only talks to this API.

const COMMUNITY_KEY = 'gsp-community-v1';

const Store = {
  shared: false,

  _read() {
    try {
      return JSON.parse(localStorage.getItem(COMMUNITY_KEY)) || { items: [], volunteers: [] };
    } catch {
      return { items: [], volunteers: [] };
    }
  },
  _write(db) {
    try { localStorage.setItem(COMMUNITY_KEY, JSON.stringify(db)); } catch {}
  },
  _id: prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,

  // Petitions and projects for a ZIP, newest first.
  async listItems(zip) {
    return this._read().items
      .filter(i => !zip || i.zip === zip)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async getItem(id) {
    return this._read().items.find(i => i.id === id) || null;
  },

  async createItem(fields) {
    const db = this._read();
    const item = {
      id: this._id('i'),
      createdAt: Date.now(),
      signatures: [],
      volunteers: [],
      messages: [],
      ...fields,
    };
    db.items.push(item);
    this._write(db);
    return item;
  },

  async _updateItem(id, fn) {
    const db = this._read();
    const item = db.items.find(i => i.id === id);
    if (!item) throw new Error('Not found');
    fn(item);
    this._write(db);
    return item;
  },

  async sign(id, { name, note }) {
    return this._updateItem(id, item => item.signatures.push({ name, note, at: Date.now() }));
  },

  async joinProject(id, { name, contact }) {
    return this._updateItem(id, item => item.volunteers.push({ name, contact, at: Date.now() }));
  },

  async postMessage(id, { name, text }) {
    return this._updateItem(id, item => item.messages.push({ name, text, at: Date.now() }));
  },

  async addVolunteer(fields) {
    const db = this._read();
    const v = { id: this._id('v'), createdAt: Date.now(), ...fields };
    db.volunteers.push(v);
    this._write(db);
    return v;
  },

  async listVolunteers(zip) {
    return this._read().volunteers.filter(v => !zip || v.zip === zip);
  },
};
