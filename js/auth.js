// Accounts: sign up, log in, profile (followed ZIPs, volunteer interests) and the login dialog.
// Backed by Supabase Auth; profile fields live in the `profiles` table (see supabase/schema.sql).
// The rest of the app only uses Auth.current(), Auth.require(), Auth.updateProfile(),
// Auth.followersOf() and Auth.onChange().

// App field name → profiles column.
const PROFILE_COLUMNS = { name: 'name', zip: 'zip', follows: 'follows', volunteer: 'volunteer', notify: 'notify', updatesSeenAt: 'updates_seen_at' };

const Auth = {
  listeners: [],
  user: null,       // cached profile of the signed-in user, or null
  ready: null,      // resolves once the initial session has been checked

  init() {
    this.ready = (async () => {
      const { data } = await sb.auth.getSession();
      await this._load(data.session?.user || null);
    })();
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setTimeout(() => AuthUI.showRecovery(), 0);
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
      if ((session?.user?.id || null) === (this.user?.id || null)) return;
      // Supabase warns against awaiting other Supabase calls inside this callback.
      setTimeout(() => this._load(session?.user || null).then(() => this._emit()), 0);
    });
    return this.ready;
  },

  async _load(authUser) {
    if (!authUser) { this.user = null; return; }
    const { data, error } = await sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
    if (error) console.error(error);
    const p = data || {};
    this.user = {
      id: authUser.id,
      email: authUser.email,
      name: p.name || authUser.user_metadata?.name || authUser.email.split('@')[0],
      zip: p.zip || null,
      follows: p.follows || [],
      volunteer: p.volunteer || null,
      notify: p.notify || null,
      updatesSeenAt: p.updates_seen_at ? Date.parse(p.updates_seen_at) : Date.now(),
    };
  },

  current() { return this.user; },

  onChange(fn) { this.listeners.push(fn); },
  _emit() { this.listeners.forEach(fn => fn(this.user)); },

  // Returns { user } when signed in straight away, or { confirm: true } when Supabase requires
  // the user to confirm their email first.
  async signUp({ name, email, password, zip }) {
    email = String(email || '').trim().toLowerCase();
    name = String(name || '').trim();
    zip = String(zip || '').trim();
    if (!name) throw new Error('Enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 6) throw new Error('Use at least 6 characters for your password.');
    if (zip && !/^\d{5}$/.test(zip)) throw new Error('ZIP code should be 5 digits.');
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { name, zip }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw new Error(friendlyAuthError(error));
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) throw new Error('An account with that email already exists. Log in instead.');
    if (!data.session) return { confirm: true, email };
    await this._load(data.user);
    this._emit();
    return { user: this.user };
  },

  async logIn({ email, password }) {
    const { data, error } = await sb.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
    if (error) throw new Error(friendlyAuthError(error));
    await this._load(data.user);
    this._emit();
    return this.user;
  },

  async logOut() {
    await sb.auth.signOut();
    this.user = null;
    this._emit();
  },

  async sendPasswordReset(email) {
    const { error } = await sb.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(friendlyAuthError(error));
  },

  async setNewPassword(password) {
    if (password.length < 6) throw new Error('Use at least 6 characters for your password.');
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(friendlyAuthError(error));
  },

  async updateProfile(patch) {
    const me = this.current();
    if (!me) throw new Error('Not logged in');
    const row = {};
    for (const [k, v] of Object.entries(patch)) {
      if (!PROFILE_COLUMNS[k]) continue;
      row[PROFILE_COLUMNS[k]] = k === 'updatesSeenAt' ? new Date(v).toISOString() : v;
    }
    const { error } = await sb.from('profiles').update(row).eq('id', me.id);
    if (error) throw new Error(error.message);
    this.user = { ...me, ...patch };
    this._emit();
    return this.user;
  },

  // How many people follow a ZIP for updates.
  async followersOf(zip) {
    const { data, error } = await sb.rpc('followers_count', { z: zip });
    return error ? 0 : data;
  },

  // Resolves with the user, opening the login dialog first if needed. Resolves null if dismissed.
  require(reason) {
    const me = this.current();
    if (me) return Promise.resolve(me);
    return AuthUI.open({ reason });
  },
};

function friendlyAuthError(error) {
  const msg = error?.message || String(error);
  if (/invalid login credentials/i.test(msg)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/already registered/i.test(msg)) return 'An account with that email already exists. Log in instead.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a minute and try again.';
  return msg;
}

// ---------------- Login dialog & account menu ----------------

const AuthUI = {
  resolve: null,

  open({ reason, mode = 'login' } = {}) {
    const dlg = $('#auth-dialog');
    this.render(mode, reason);
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('#auth-form input')?.focus();
    return new Promise(resolve => { this.resolve = resolve; });
  },

  // Opened when someone arrives from a password-reset email link.
  showRecovery() {
    if (this.recoveryShown) return;
    this.recoveryShown = true;
    this.open({ mode: 'reset' });
  },

  // An email link came back with an error (usually expired or already used).
  showLinkError(redirect) {
    const expired = /expired|invalid/i.test(`${redirect.errorCode} ${redirect.error}`);
    this.open({
      mode: 'forgot',
      reason: expired
        ? 'That link has expired or was already used. Links work once and expire after an hour. Enter your email to get a new one.'
        : `That link didn't work (${redirect.error}). Enter your email to get a new one.`,
    });
  },

  close(result = null) {
    const dlg = $('#auth-dialog');
    if (dlg.open) dlg.close();
    if (this.resolve) { const r = this.resolve; this.resolve = null; r(result); }
  },

  render(mode, reason) {
    this.mode = mode;
    this.reason = reason;
    const dlg = $('#auth-dialog');
    const brand = title => `<button type="button" class="dlg-close" data-auth="close" aria-label="Close">×</button>
      <div class="auth-brand"><img src="assets/leaf-mascot.svg" alt="" width="44" height="44"><h2 class="dlg-title">${title}</h2></div>`;

    if (mode === 'confirm') {
      dlg.innerHTML = `${brand('Check your email')}
        <p class="auth-reason">We sent a confirmation link to <strong>${esc(this.pendingEmail || 'your inbox')}</strong>. Click it, then come back and log in.</p>
        <button type="button" class="btn-primary btn-block" data-auth="login">Back to log in</button>`;
      return;
    }
    if (mode === 'forgot' || mode === 'reset') {
      const forgot = mode === 'forgot';
      const note = reason || (forgot ? '' : "You're signed in from your reset link. Choose a new password to finish.");
      dlg.innerHTML = `${brand(forgot ? 'Reset your password' : 'Choose a new password')}
        ${note ? `<p class="auth-reason">${esc(note)}</p>` : ''}
        <form id="auth-form" class="stack" novalidate>
          ${forgot ? '<label>Email<input name="email" type="email" autocomplete="email" required></label>'
            : '<label>New password<input name="password" type="password" autocomplete="new-password" required minlength="6"></label>'}
          <p class="form-error" id="auth-error" role="alert"></p>
          <p class="auth-ok" id="auth-ok" role="status"></p>
          <button type="submit" class="btn-primary btn-block">${forgot ? 'Send reset link' : 'Save password'}</button>
        </form>
        ${forgot ? '<p class="muted small auth-demo"><button type="button" class="linkish" data-auth="login">Back to log in</button></p>' : ''}`;
      $('#auth-form input').focus();
      return;
    }

    const signup = mode === 'signup';
    dlg.innerHTML = `${brand(signup ? 'Create your account' : 'Welcome back')}
      ${reason ? `<p class="auth-reason">${esc(reason)}</p>` : ''}
      <div class="seg-tabs" role="tablist">
        <button type="button" role="tab" data-auth="login" aria-selected="${!signup}">Log in</button>
        <button type="button" role="tab" data-auth="signup" aria-selected="${signup}">Sign up</button>
      </div>
      <form id="auth-form" class="stack" novalidate>
        ${signup ? '<label>Name<input name="name" autocomplete="name" required></label>' : ''}
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="6"></label>
        ${signup ? `<label>Home ZIP code <span class="muted small">(we'll send you updates for it)</span><input name="zip" inputmode="numeric" maxlength="5" value="${esc(state.zip || '')}"></label>` : ''}
        <p class="form-error" id="auth-error" role="alert"></p>
        <button type="submit" class="btn-primary btn-block">${signup ? 'Create account' : 'Log in'}</button>
      </form>
      ${signup ? '' : '<p class="muted small auth-demo"><button type="button" class="linkish" data-auth="forgot">Forgot your password?</button></p>'}`;
    $('#auth-form [name=' + (signup ? 'name' : 'email') + ']').focus();
  },

  async submit(form) {
    const d = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if (this.mode === 'signup') {
        const result = await Auth.signUp(d);
        if (result.confirm) { this.pendingEmail = result.email; this.render('confirm'); return; }
        this.close(result.user);
      } else if (this.mode === 'forgot') {
        await Auth.sendPasswordReset(d.email);
        $('#auth-ok').textContent = 'If that email has an account, a reset link is on its way.';
        btn.disabled = false;
      } else if (this.mode === 'reset') {
        await Auth.setNewPassword(d.password);
        this.close(Auth.current());
        toast("Password updated. You're logged in.");
      } else {
        this.close(await Auth.logIn(d));
      }
    } catch (err) {
      $('#auth-error').textContent = err.message;
      btn.disabled = false;
    }
  },

  renderAccount() {
    const me = Auth.current();
    const el = $('#account-area');
    if (!me) {
      el.innerHTML = `<button type="button" class="btn-secondary btn-green" data-auth="open">Log in</button>`;
      return;
    }
    const unread = Community.unreadCount(me);
    const saved = Proposals.savedBy(me.id);
    el.innerHTML = `
      <div class="account">
        <button type="button" class="avatar-btn" data-auth="menu" aria-haspopup="true" aria-expanded="false">
          <span class="avatar">${esc(me.name.slice(0, 1).toUpperCase())}</span>
          ${unread ? `<span class="badge">${unread}</span>` : ''}
        </button>
        <div class="account-menu" hidden>
          <div class="account-head"><strong>${esc(me.name)}</strong><span class="muted small">${esc(me.email)}</span></div>
          <button type="button" data-auth="updates">🔔 Updates${unread ? ` <span class="pill">${unread} new</span>` : ''}</button>
          <div class="menu-label">Saved green spaces (${saved.length})</div>
          ${saved.length ? saved.slice(0, 6).map(p => `<button type="button" data-auth="goto" data-zip="${esc(p.zip)}" data-id="${esc(p.id)}"><span>📍 ${esc(p.name)}</span><small class="muted">${esc(p.zip)}</small></button>`).join('')
            : '<p class="muted small menu-empty">Drop a pin with “Propose a green space” and press Save.</p>'}
          <button type="button" data-auth="logout" class="menu-logout">Log out</button>
        </div>
      </div>`;
  },

  bind() {
    const dlg = $('#auth-dialog');
    dlg.addEventListener('click', e => {
      if (e.target === dlg) return this.close(null);
      const a = e.target.closest('[data-auth]')?.dataset.auth;
      if (a === 'close') this.close(null);
      if (a === 'login' || a === 'signup' || a === 'forgot') this.render(a, this.reason);
    });
    dlg.addEventListener('cancel', e => { e.preventDefault(); this.close(null); });
    dlg.addEventListener('submit', e => { e.preventDefault(); this.submit(e.target); });

    const area = $('#account-area');
    area.addEventListener('click', e => {
      const btn = e.target.closest('[data-auth]');
      if (!btn) return;
      const a = btn.dataset.auth;
      const menu = area.querySelector('.account-menu');
      if (a === 'open') this.open();
      if (a === 'menu') {
        menu.hidden = !menu.hidden;
        btn.setAttribute('aria-expanded', String(!menu.hidden));
        return;
      }
      if (menu) menu.hidden = true;
      if (a === 'logout') Auth.logOut();
      if (a === 'updates') Community.openVolunteer();
      if (a === 'goto') goToProposal(btn.dataset.zip, btn.dataset.id);
    });
    document.addEventListener('click', e => {
      if (!area.contains(e.target)) { const m = area.querySelector('.account-menu'); if (m) m.hidden = true; }
    });
    Auth.onChange(() => this.renderAccount());
    this.renderAccount();
  },
};
