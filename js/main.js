// Startup: runs after every other script has loaded.

AuthUI.bind();

// Logging in or out changes which saved sites, signatures and updates are visible.
let lastUserId = null;
Auth.onChange(async user => {
  const id = user?.id || null;
  if (id !== lastUserId) {
    lastUserId = id;
    await Proposals.loadSaved(user);
    if (state.zipFeature) refreshAfterProposalChange();
  }
  Community.onAuthChange(user);
});

route();

// Restore an existing session, then load the user's saved sites and community activity.
Auth.init().then(async () => {
  const user = Auth.current();
  if (AUTH_REDIRECT.error) AuthUI.showLinkError(AUTH_REDIRECT);
  else if (AUTH_REDIRECT.type === 'recovery' && user) AuthUI.showRecovery();
  // Drop leftover auth details from the address bar so they aren't mistaken for app routes.
  if (AUTH_REDIRECT.error || AUTH_REDIRECT.type) history.replaceState(null, '', location.pathname);
  lastUserId = user?.id || null;
  Community.lastUserId = lastUserId;
  await Proposals.loadSaved(user);
  await Community.refreshCache();
  if (state.zipFeature) refreshAfterProposalChange();
});
