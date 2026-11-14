// Dust of War news admin — GitHub API helpers (runs in the browser, talks to api.github.com).
export var OWNER = 'BriLLGames';
export var REPO = 'DustOfWarWeb';
export var BRANCH = 'main';
export var RAW = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/';
var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
var TOKEN_KEY = 'dow-admin-token';
var token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';

export function hasToken() { return !!token; }
export function setToken(t, remember) {
  token = t;
  sessionStorage.setItem(TOKEN_KEY, t);
  if (remember) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
}
export function clearToken() {
  token = '';
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

async function api(method, path, body) {
  var headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (body) headers['Content-Type'] = 'application/json';
  var res = await fetch(API + path, { method: method, cache: 'no-store', headers: headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    var msg = 'GitHub error ' + res.status;
    try { var j = await res.json(); if (j && j.message) msg = j.message; } catch (e) { /* ignore */ }
    if (res.status === 401) msg = 'The token is invalid or expired. Sign out and sign in with a new token.';
    if (res.status === 403 && /not accessible/i.test(msg)) msg = 'The token has no write access. It needs "Contents: Read and write" for DustOfWarWeb.';
    var err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Verifies the token can read the repository. */
export async function checkAccess() {
  var repo = await api('GET', '');
  if (repo.permissions && repo.permissions.push === false) throw new Error('This GitHub account cannot write to ' + OWNER + '/' + REPO + '.');
  return repo;
}

function b64ToUtf8(b64) {
  var bin = atob(b64.replace(/\n/g, ''));
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Reads a UTF-8 file from the branch; null if it does not exist. */
export async function readText(path) {
  try {
    var r = await api('GET', '/contents/' + encodeURI(path) + '?ref=' + BRANCH);
    return b64ToUtf8(r.content || '');
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

export async function readJSON(path) {
  var t = await readText(path);
  return t == null ? null : JSON.parse(t);
}

/** Lists a directory; [] if it does not exist. */
export async function listDir(path) {
  try {
    var r = await api('GET', '/contents/' + encodeURI(path) + '?ref=' + BRANCH);
    return Array.isArray(r) ? r : [];
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

/**
 * Writes all changes to the branch as ONE commit.
 * changes: [{ path, text }] | [{ path, base64 }] | [{ path, delete: true }]
 */
export async function commit(changes, message) {
  var entries = [];
  for (var i = 0; i < changes.length; i++) {
    var c = changes[i];
    if (c.delete) entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
    else if (c.base64 != null) {
      var blob = await api('POST', '/git/blobs', { content: c.base64, encoding: 'base64' });
      entries.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
    } else entries.push({ path: c.path, mode: '100644', type: 'blob', content: c.text });
  }
  var lastErr = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    var ref = await api('GET', '/git/ref/heads/' + BRANCH);
    var head = await api('GET', '/git/commits/' + ref.object.sha);
    var tree = await api('POST', '/git/trees', { base_tree: head.tree.sha, tree: entries });
    var cm = await api('POST', '/git/commits', { message: message, tree: tree.sha, parents: [ref.object.sha] });
    try {
      await api('PATCH', '/git/refs/heads/' + BRANCH, { sha: cm.sha });
      return cm.sha;
    } catch (e) {
      lastErr = e;
      if (e.status !== 422 && e.status !== 409) throw e;
    }
  }
  throw lastErr;
}

export function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { var s = String(reader.result); resolve(s.slice(s.indexOf(',') + 1)); };
    reader.onerror = function () { reject(reader.error || new Error('Could not read file')); };
    reader.readAsDataURL(blob);
  });
}

/** Downscales large photos (max 2000px) and re-encodes them as WebP. */
export async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { blob: file, name: file.name };
  try {
    var bmp = await createImageBitmap(file);
    var scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.2 * 1024 * 1024) return { blob: file, name: file.name };
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    var out = await new Promise(function (r) { canvas.toBlob(r, 'image/webp', 0.86); });
    if (!out || out.size >= file.size) return { blob: file, name: file.name };
    return { blob: out, name: file.name.replace(/\.[^.]+$/, '') + '.webp' };
  } catch (e) {
    return { blob: file, name: file.name };
  }
}

/** Converts an image to a PNG no larger than max px on the longest side. */
export async function toPngBase64(file, max) {
  var bmp = await createImageBitmap(file);
  var scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  var canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  var url = canvas.toDataURL('image/png');
  return url.slice(url.indexOf(',') + 1);
}

var CYR = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya', 'і':'i','ї':'yi','є':'ye','ґ':'g' };

export function slugify(s) {
  var lower = String(s || '').toLowerCase();
  var out = '';
  for (var i = 0; i < lower.length; i++) { var ch = lower[i]; out += CYR[ch] != null ? CYR[ch] : ch; }
  return out.normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** Uploads a media file for articles; returns its repo path. */
export async function uploadMedia(file) {
  var prepared = await prepareImage(file);
  if (prepared.blob.size > 25 * 1024 * 1024) throw new Error('"' + file.name + '" is larger than 25 MB. For long videos use a YouTube block.');
  var name = prepared.name;
  var dot = name.lastIndexOf('.');
  var ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  var base = slugify(dot > 0 ? name.slice(0, dot) : name).slice(0, 50) || 'file';
  var month = new Date().toISOString().slice(0, 7);
  var path = 'news/media/' + month + '/' + Math.random().toString(36).slice(2, 8) + '-' + base + (ext ? '.' + ext : '');
  var b64 = await blobToBase64(prepared.blob);
  await commit([{ path: path, base64: b64 }], 'News: upload ' + path.split('/').pop());
  return { path: path, size: prepared.blob.size, blob: prepared.blob };
}
