const COOKIE_MAX_AGE = 60 * 60;

function cookieName(kind) {
  return `external_link_${kind}_passwords`;
}

function read(kind) {
  const prefix = `${cookieName(kind)}=`;
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  if (!value) return {};
  try {
    return JSON.parse(decodeURIComponent(value.slice(prefix.length))) || {};
  } catch {
    return {};
  }
}

function write(kind, passwords) {
  document.cookie = `${cookieName(kind)}=${encodeURIComponent(JSON.stringify(passwords))}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax`;
}

export function getExternalLinkPassword(kind, token) {
  return read(kind)[token] || "";
}

export function setExternalLinkPassword(kind, token, password) {
  const passwords = read(kind);
  if (password) passwords[token] = password;
  else delete passwords[token];
  write(kind, passwords);
}
