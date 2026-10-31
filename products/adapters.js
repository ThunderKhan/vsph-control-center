// Reviewed static adapters only. Database product codes never become SQL table names.
const registry = Object.freeze({
  CRM: Object.freeze({
    key: "crm",
    table: "crm_contacts",
    heading: "CRM Contacts",
    columns: ["Contact", "Email", "Company"],
    roles: ["super_admin", "admin", "manager", "user"],
  }),
  MUSIC: Object.freeze({
    key: "music",
    table: "music_requests",
    heading: "Music Requests",
    columns: ["Song", "Artist", "Status"],
    roles: ["super_admin", "admin", "manager", "staff", "user"],
  }),
});
function adapter(code) {
  return Object.hasOwn(registry, code) ? registry[code] : null;
}
function canCreateRecord(code, role) {
  return Boolean(adapter(code)?.roles.includes(role));
}
function diagnostics(code) {
  const a = adapter(code);
  return {
    adapter: a?.key || "portal-only",
    recordsConfigured: Boolean(a),
    heading: a?.heading || "Product workspace",
    columns: a?.columns || [],
    launchPath:
      "/apps/" + encodeURIComponent(String(code).toLowerCase()) + "/launch",
    externalHealth: "unverified",
  };
}
function payload(code, body) {
  const a = adapter(code);
  if (!a) return null;
  const trim = (key, max) =>
    String(body[key] || "")
      .trim()
      .slice(0, max);
  if (a.key === "crm") {
    const name = trim("name", 150);
    if (!name) return null;
    return {
      name,
      email: trim("email", 190) || null,
      company: trim("company", 150) || null,
    };
  }
  const song_title = trim("song_title", 150);
  if (!song_title) return null;
  return { song_title, artist: trim("artist", 150) || null };
}
function applicationCookieNames(cookies = {}) {
  // Only received, syntactically valid application cookie names; never arbitrary Set-Cookie paths.
  return Object.keys(cookies)
    .filter(
      (name) =>
        /^vsph\.[a-z][a-z0-9_]{1,39}\.sid$/.test(name) &&
        name !== "vsph.portal.sid",
    )
    .slice(0, 100);
}
module.exports = {
  adapter,
  canCreateRecord,
  diagnostics,
  payload,
  applicationCookieNames,
};
