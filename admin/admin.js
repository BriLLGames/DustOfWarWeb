// Dust of War news admin — UI. Publishes straight to GitHub; no server needed.
import * as gh from './github.js';
import { renderArticle, fmtDate, fmtSize, youtubeId } from './render.js';

var SITE = 'https://brillgames.github.io/DustOfWarWeb/';
var LANGS = { all: 'EN + RU', en: 'English only', ru: 'Russian only' };
var TYPES = [['paragraph', 'Text'], ['heading', 'Heading'], ['quote', 'Quote'], ['image', 'Photo'], ['video', 'Video file'], ['file', 'File (download)'], ['youtube', 'YouTube video'], ['divider', 'Divider']];
var LABEL = {};
TYPES.forEach(function (t) { LABEL[t[0]] = t[1]; });

var app = document.getElementById('app');
var headActions = document.getElementById('head-actions');
var localUrls = {};      // repo path -> object URL for files uploaded this session
var state = null;        // editor state
var dirty = false;
var currentHash = location.hash;

// ---------------------------------------------------------------- helpers
function h(tag, attrs, children) {
  var el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v == null || v === false) return;
    if (k === 'class') el.className = v;
    else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  (children || []).forEach(function (c) {
    if (c == null || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}
function rid() { return Math.random().toString(36).slice(2, 10); }
function media(path) { return localUrls[path] || gh.RAW + path; }
function errMsg(e) { return (e && e.message) || String(e); }

var toastTimer = null;
function toast(msg, kind) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (kind === 'error' ? ' error' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, kind === 'error' ? 7000 : 4000);
}
var overlay = null;
function busy(text) {
  overlay = h('div', { class: 'overlay' }, [h('div', null, [h('span', { class: 'spin' }), text])]);
  document.body.appendChild(overlay);
}
function unbusy() { if (overlay) overlay.remove(); overlay = null; }

function closeMenus() { document.querySelectorAll('.ins-menu').forEach(function (m) { m.remove(); }); }
document.addEventListener('click', function (e) { if (!e.target.closest('.ins')) closeMenus(); });

function setHead(view) {
  headActions.replaceChildren();
  if (!gh.hasToken()) return;
  headActions.append(
    h('a', { class: 'abtn sm' + (view === 'list' ? ' on' : ''), href: '#/' }, ['Articles']),
    h('a', { class: 'abtn sm' + (view === 'logo' ? ' on' : ''), href: '#/logo' }, ['Logo']),
    h('a', { class: 'abtn sm hide-sm', href: SITE + 'news.html', target: '_blank', rel: 'noopener' }, ['Site \u2197']),
    h('button', { class: 'abtn sm', onclick: function () {
      if (dirty && !confirm('Discard unsaved changes and sign out?')) return;
      dirty = false; gh.clearToken(); location.hash = '#/'; route();
    } }, ['Sign out'])
  );
}

// ---------------------------------------------------------------- routing
window.addEventListener('hashchange', function () {
  if (dirty && !confirm('You have unsaved changes. Leave without saving?')) {
    history.replaceState(null, '', currentHash || '#/');
    return;
  }
  dirty = false;
  route();
});
window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && state && document.querySelector('.editor-bar')) {
    e.preventDefault();
    if (state.published) publish(); else saveDraft();
  }
});

function route() {
  currentHash = location.hash;
  closeMenus();
  state = null;
  if (!gh.hasToken()) return showLogin();
  var parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'edit' && parts[1]) return showEditor(decodeURIComponent(parts[1]));
  if (parts[0] === 'new') return showEditor(null);
  if (parts[0] === 'logo') return showLogo();
  return showList();
}

function loading() { app.replaceChildren(h('div', { class: 'news-status' }, ['Loading\u2026'])); }
function failed(e) {
  app.replaceChildren(h('div', { class: 'admin-card' }, [
    h('p', { class: 'err' }, [errMsg(e)]),
    h('button', { class: 'abtn', onclick: route }, ['Try again'])
  ]));
}

// ---------------------------------------------------------------- login
function showLogin() {
  setHead('login');
  var input = h('input', { type: 'password', class: 'field', placeholder: 'github_pat_\u2026', autocomplete: 'off', id: 'tok' });
  var remember = h('input', { type: 'checkbox', checked: true, id: 'rem' });
  var err = h('p', { class: 'err' });
  var btn = h('button', { class: 'abtn primary', type: 'submit' }, ['Sign in']);
  var form = h('form', { class: 'stack', onsubmit: async function (e) {
    e.preventDefault();
    var t = input.value.trim();
    if (!t) return;
    btn.disabled = true; err.textContent = '';
    gh.setToken(t, remember.checked);
    try { await gh.checkAccess(); route(); }
    catch (ex) { gh.clearToken(); err.textContent = errMsg(ex); btn.disabled = false; }
  } }, [
    h('div', null, [h('label', { class: 'lbl', for: 'tok' }, ['GitHub token']), input]),
    h('label', { class: 'check' }, [remember, ' Remember on this device']),
    btn, err
  ]);
  app.replaceChildren(h('section', { class: 'admin-card admin-login' }, [
    h('div', { class: 'eyebrow' }, ['News admin']),
    h('h1', null, ['Sign in']),
    h('p', { class: 'muted' }, ['This tool writes directly to the DustOfWarWeb GitHub repository. Sign in once with a GitHub personal access token:']),
    h('ol', null, [
      h('li', null, ['Open ', h('a', { class: 'link', href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, ['GitHub \u2192 new fine-grained token']), '.']),
      h('li', null, ['Repository access: ', h('b', null, ['Only select repositories \u2192 DustOfWarWeb']), '.']),
      h('li', null, ['Permissions \u2192 Repository \u2192 ', h('b', null, ['Contents: Read and write']), '.']),
      h('li', null, ['Generate the token, copy it and paste it below.'])
    ]),
    form,
    h('p', { class: 'hint' }, ['The token is stored only in this browser. Never share it.'])
  ]));
  input.focus();
}

// ---------------------------------------------------------------- list
async function loadIndex() {
  var idx = await gh.readJSON('news/index.json');
  return (idx && idx.articles) || [];
}

async function showList() {
  setHead('list');
  loading();
  var published, drafts;
  try {
    var res = await Promise.all([loadIndex(), gh.listDir('_news_drafts')]);
    published = res[0];
    var files = res[1].filter(function (f) { return /\.json$/.test(f.name); });
    drafts = (await Promise.all(files.map(function (f) { return gh.readJSON('_news_drafts/' + f.name); }))).filter(Boolean);
  } catch (e) { return failed(e); }
  drafts.sort(function (a, b) { return String(b.updated || '').localeCompare(String(a.updated || '')); });

  function item(a, isPub) {
    var key = isPub ? 'p-' + a.slug : 'd-' + a.id;
    return h('a', { class: 'a-item', href: '#/edit/' + encodeURIComponent(key) }, [
      h('div', { class: 'a-thumb' }, [a.cover ? h('img', { src: media(a.cover), alt: '' }) : null]),
      h('div', { class: 'a-text' }, [
        h('div', { class: 'a-meta' }, [
          h('span', { class: 'badge ' + (isPub ? 'pub' : 'draft') }, [isPub ? 'Published' : 'Draft']),
          h('span', null, [LANGS[a.lang] || LANGS.all]),
          h('span', null, [isPub ? fmtDate(a.date) : (a.updated ? 'Edited ' + fmtDate(a.updated) : '')])
        ]),
        h('h3', null, [a.title || 'Untitled']),
        a.summary ? h('p', null, [a.summary]) : null
      ])
    ]);
  }

  var children = [
    h('div', { class: 'list-head' }, [
      h('div', null, [h('div', { class: 'eyebrow' }, ['News admin']), h('h1', null, ['Articles'])]),
      h('a', { class: 'abtn primary', href: '#/new' }, ['+ New article'])
    ])
  ];
  if (!drafts.length && !published.length) {
    children.push(h('div', { class: 'news-status' }, ['No articles yet. Click \u201cNew article\u201d to write the first one.']));
  }
  if (drafts.length) {
    children.push(h('h2', { class: 'list-sub' }, ['Drafts']));
    drafts.forEach(function (a) { children.push(item(a, false)); });
  }
  if (published.length) {
    children.push(h('h2', { class: 'list-sub' }, ['Published']));
    published.forEach(function (a) { children.push(item(a, true)); });
  }
  app.replaceChildren.apply(app, children);
}

// ---------------------------------------------------------------- editor
function clean(a) {
  return {
    id: a.id, slug: a.slug || '', title: a.title || '', summary: a.summary || '', cover: a.cover || null,
    lang: a.lang || 'all', date: a.date || null,
    blocks: (a.blocks || []).filter(function (b) { return !b._uploading; }).map(function (b) {
      var o = {};
      Object.keys(b).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = b[k]; });
      return o;
    })
  };
}
function snapshot() { return JSON.stringify(clean(state.a)); }
function markDirty() { dirty = snapshot() !== state.saved; updateBar(); }
function uploadsPending() { return state.a.blocks.some(function (b) { return b._uploading; }) || state.coverUploading; }

async function showEditor(key) {
  setHead('editor');
  loading();
  var a = null, published = false;
  try {
    if (!key) a = { id: rid(), slug: '', title: '', summary: '', cover: null, lang: 'all', date: null, blocks: [{ id: rid(), type: 'paragraph', text: '' }] };
    else if (key.indexOf('d-') === 0) a = await gh.readJSON('_news_drafts/' + key.slice(2) + '.json');
    else { a = await gh.readJSON('news/posts/' + key.slice(2) + '.json'); published = true; }
  } catch (e) { return failed(e); }
  if (!a || a.unpublished) {
    app.replaceChildren(h('div', { class: 'admin-card' }, [h('p', null, ['Article not found.']), h('a', { class: 'abtn', href: '#/' }, ['Back to articles'])]));
    return;
  }
  a.id = a.id || rid();
  a.blocks = (a.blocks || []).map(function (b) { b.id = b.id || rid(); return b; });
  state = { key: key, a: a, published: published, saved: '', preview: false, coverUploading: false };
  state.saved = snapshot();
  dirty = false;
  renderEditor();
}

var barEls = {};
function updateBar() {
  if (!barEls.status) return;
  var busyUp = uploadsPending();
  barEls.status.textContent = state.published ? (dirty ? 'Published \u00b7 changes not on site' : 'Published') : (dirty ? 'Draft \u00b7 unsaved' : 'Draft');
  barEls.status.className = 'badge ' + (state.published ? 'pub' : 'draft') + (dirty ? ' warn' : '');
  if (barEls.save) barEls.save.disabled = !dirty || busyUp;
  barEls.publish.disabled = busyUp || (state.published && !dirty);
}

function renderEditor() {
  closeMenus();
  var a = state.a;
  barEls = {};
  barEls.status = h('span', { class: 'badge' });
  barEls.publish = h('button', { class: 'abtn primary sm', onclick: publish }, [state.published ? 'Update site' : 'Publish']);
  if (!state.published) barEls.save = h('button', { class: 'abtn sm', onclick: saveDraft }, ['Save draft']);
  var previewBtn = h('button', { class: 'abtn sm', onclick: function () { state.preview = !state.preview; renderEditor(); } }, [state.preview ? 'Edit' : 'Preview']);
  var bar = h('div', { class: 'editor-bar' }, [
    h('a', { class: 'abtn sm', href: '#/' }, ['\u2190']),
    barEls.status,
    h('span', { class: 'spacer' }),
    previewBtn,
    barEls.save || null,
    barEls.publish
  ]);

  var body;
  if (state.preview) {
    body = h('div', { class: 'article-page admin-preview', html: renderArticle(clean(a), media) });
  } else {
    body = h('div', { class: 'stack' }, [metaFields(), h('div', null, [
      h('label', { class: 'lbl' }, ['Article body']),
      h('p', { class: 'hint', style: 'margin:0 0 8px' }, ['Use the + buttons to put text, photos, videos or files exactly where they should appear.']),
      blocksEl()
    ]), dangerZone()]);
  }
  app.replaceChildren(bar, body);
  updateBar();
}

function metaFields() {
  var a = state.a;
  var locked = !!a.date;
  function inp(attrs, onInput) { attrs.oninput = function (e) { onInput(e.target.value); markDirty(); }; return h('input', attrs); }

  var slugHint = h('p', { class: 'hint' });
  function refreshSlugHint() {
    var s = a.slug || gh.slugify(a.title) || '\u2026';
    slugHint.textContent = (locked ? 'Locked after first publish. ' : 'Generated from the title if empty. ') + SITE + 'article.html?slug=' + s;
  }
  refreshSlugHint();

  var langSel = h('select', { class: 'field', onchange: function (e) { a.lang = e.target.value; markDirty(); } },
    Object.keys(LANGS).map(function (k) { return h('option', { value: k, selected: a.lang === k }, [k === 'all' ? 'Both versions (EN + RU)' : LANGS[k]]); }));

  var coverInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    state.coverUploading = true; renderEditor();
    try {
      var r = await gh.uploadMedia(f);
      localUrls[r.path] = URL.createObjectURL(r.blob);
      a.cover = r.path;
    } catch (ex) { toast(errMsg(ex), 'error'); }
    state.coverUploading = false;
    if (state && state.a === a) { renderEditor(); markDirty(); }
  } });
  var cover = h('div', { class: 'cover-box' }, [
    coverInput,
    a.cover ? h('img', { src: media(a.cover), alt: 'Cover' }) : null,
    h('button', { class: 'abtn sm', disabled: state.coverUploading, onclick: function () { coverInput.click(); } },
      [state.coverUploading ? 'Uploading\u2026' : (a.cover ? 'Replace cover' : '+ Upload cover')]),
    a.cover ? h('button', { class: 'abtn sm', onclick: function () { a.cover = null; renderEditor(); markDirty(); } }, ['Remove']) : null
  ]);

  return h('div', { class: 'stack' }, [
    h('div', null, [h('label', { class: 'lbl' }, ['Title']), inp({ class: 'field field-title', value: a.title, placeholder: 'Article title' }, function (v) { a.title = v; refreshSlugHint(); })]),
    h('div', null, [h('label', { class: 'lbl' }, ['Short description']),
      h('textarea', { class: 'field', rows: 2, placeholder: 'One or two sentences shown under the title in the news list', oninput: function (e) { a.summary = e.target.value; markDirty(); } }, [a.summary || ''])]),
    h('div', { class: 'grid2' }, [
      h('div', null, [h('label', { class: 'lbl' }, ['Show on']), langSel]),
      h('div', null, [h('label', { class: 'lbl' }, ['Link address']),
        inp({ class: 'field', value: a.slug, placeholder: 'auto from title', disabled: locked }, function (v) { a.slug = v.toLowerCase().replace(/[^a-z0-9-]/g, '-'); refreshSlugHint(); }),
        slugHint])
    ]),
    h('div', null, [h('label', { class: 'lbl' }, ['Cover image (optional)']), cover])
  ]);
}

// ---- blocks
var fileInput = h('input', { type: 'file', hidden: true });
document.body.appendChild(fileInput);
var pendingPick = null;
fileInput.addEventListener('change', function () {
  var files = Array.from(fileInput.files || []);
  var pick = pendingPick;
  pendingPick = null;
  fileInput.value = '';
  if (pick && files.length) onFiles(pick, files);
});
function pickFiles(pick) {
  pendingPick = pick;
  fileInput.accept = pick.type === 'image' ? 'image/*' : pick.type === 'video' ? 'video/mp4,video/webm,video/quicktime' : '';
  fileInput.multiple = pick.type === 'image' && !pick.replace;
  fileInput.click();
}

async function onFiles(pick, files) {
  var a = state.a;
  var targets = [];
  if (pick.replace) {
    pick.replace._uploading = true;
    pick.replace.name = files[0].name;
    pick.replace._preview = URL.createObjectURL(files[0]);
    targets.push({ b: pick.replace, f: files[0] });
  } else {
    var created = files.map(function (f) {
      var b = { id: rid(), type: pick.type, name: f.name, size: f.size, _uploading: true, _preview: pick.type === 'file' ? '' : URL.createObjectURL(f) };
      targets.push({ b: b, f: f });
      return b;
    });
    a.blocks.splice.apply(a.blocks, [pick.index, 0].concat(created));
  }
  renderEditor();
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    try {
      var r = await gh.uploadMedia(t.f);
      localUrls[r.path] = t.b._preview || URL.createObjectURL(r.blob);
      t.b.path = r.path; t.b.size = r.size; t.b.name = t.b.name || t.f.name;
    } catch (ex) {
      toast(errMsg(ex), 'error');
      if (!t.b.path) a.blocks = a.blocks.filter(function (x) { return x !== t.b; });
    }
    t.b._uploading = false;
    if (state && state.a === a) { renderEditor(); markDirty(); }
  }
}

function insertBlock(index, type) {
  closeMenus();
  if (type === 'image' || type === 'video' || type === 'file') return pickFiles({ type: type, index: index });
  var b = { id: rid(), type: type };
  if (type === 'youtube') b.url = '';
  else if (type !== 'divider') b.text = '';
  state.a.blocks.splice(index, 0, b);
  renderEditor();
  markDirty();
  var el = document.querySelector('[data-bid="' + b.id + '"] .field');
  if (el) el.focus();
}

function inserter(index, last) {
  var wrap = h('div', { class: 'ins' + (last ? ' last' : '') });
  var btn = h('button', { class: 'ins-btn', type: 'button', 'aria-label': 'Insert block here', onclick: function (e) {
    e.stopPropagation();
    var open = wrap.querySelector('.ins-menu');
    closeMenus();
    if (open) return;
    wrap.appendChild(h('div', { class: 'ins-menu' }, TYPES.map(function (t) {
      return h('button', { type: 'button', onclick: function () { insertBlock(index, t[0]); } }, [t[1]]);
    })));
  } }, [last ? '+ Add block' : '+']);
  wrap.appendChild(btn);
  return wrap;
}

function toolbar(ta, b) {
  function wrapSel(before, after, fallback) {
    var s = ta.selectionStart, e = ta.selectionEnd;
    var sel = ta.value.slice(s, e) || fallback;
    ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
    b.text = ta.value;
    markDirty();
    ta.focus();
    ta.setSelectionRange(s + before.length, s + before.length + sel.length);
  }
  return h('div', { class: 'tb' }, [
    h('button', { type: 'button', title: 'Bold', onclick: function () { wrapSel('**', '**', 'bold text'); } }, [h('b', null, ['B'])]),
    h('button', { type: 'button', title: 'Italic', onclick: function () { wrapSel('*', '*', 'italic text'); } }, [h('i', null, ['I'])]),
    h('button', { type: 'button', title: 'Link', onclick: function () { var u = prompt('Link URL', 'https://'); if (u) wrapSel('[', '](' + u.trim() + ')', 'link text'); } }, ['Link']),
    h('span', { class: 'hint tb-hint' }, ['Empty line = new paragraph'])
  ]);
}

function blockCard(b, i, total) {
  var blocks = state.a.blocks;
  function field(tag, prop, attrs) {
    attrs = attrs || {};
    attrs.class = 'field';
    attrs.oninput = function (e) { b[prop] = e.target.value; markDirty(); };
    if (tag === 'textarea') return h('textarea', attrs, [b[prop] || '']);
    attrs.value = b[prop] || '';
    return h('input', attrs);
  }
  var src = b._preview || (b.path ? media(b.path) : '');
  var body = [];
  if (b.type === 'paragraph' || b.type === 'quote') {
    var ta = field('textarea', 'text', { rows: b.type === 'quote' ? 3 : 5, placeholder: b.type === 'quote' ? 'Quote text\u2026' : 'Write text\u2026' });
    body.push(toolbar(ta, b), ta);
  } else if (b.type === 'heading') {
    body.push(field('input', 'text', { placeholder: 'Section heading' }));
  } else if (b.type === 'image') {
    if (src) body.push(h('img', { class: 'blk-media' + (b._uploading ? ' dim' : ''), src: src, alt: '' }));
    body.push(field('input', 'caption', { placeholder: 'Caption (optional)' }), field('input', 'alt', { placeholder: 'Image description for screen readers (optional)' }));
  } else if (b.type === 'video') {
    if (src) body.push(h('video', { class: 'blk-media' + (b._uploading ? ' dim' : ''), src: src, controls: true, preload: 'metadata' }));
    body.push(field('input', 'caption', { placeholder: 'Caption (optional)' }));
  } else if (b.type === 'file') {
    body.push(field('input', 'name', { placeholder: 'File name shown to readers' }));
    if (b.size) body.push(h('p', { class: 'hint' }, [fmtSize(b.size)]));
  } else if (b.type === 'youtube') {
    var thumb = h('div');
    var showThumb = function () {
      var id = youtubeId(b.url);
      thumb.replaceChildren(id ? h('img', { class: 'yt-thumb', src: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg', alt: '' }) : (b.url ? h('p', { class: 'err' }, ['This does not look like a YouTube link.']) : ''));
    };
    var urlIn = field('input', 'url', { placeholder: 'https://www.youtube.com/watch?v=\u2026' });
    urlIn.addEventListener('input', showThumb);
    showThumb();
    body.push(urlIn, thumb, field('input', 'caption', { placeholder: 'Caption (optional)' }));
  } else if (b.type === 'divider') {
    body.push(h('div', { class: 'frontline' }));
  }

  function move(d) {
    var j = i + d;
    if (j < 0 || j >= blocks.length) return;
    blocks.splice(i, 1);
    blocks.splice(j, 0, b);
    renderEditor(); markDirty();
  }
  var isMedia = b.type === 'image' || b.type === 'video' || b.type === 'file';
  return h('div', { class: 'blk', 'data-bid': b.id }, [
    h('div', { class: 'blk-head' }, [
      h('span', null, [LABEL[b.type] || b.type]),
      b._uploading ? h('span', { class: 'up' }, [h('span', { class: 'spin' }), 'Uploading\u2026']) : null,
      h('span', { class: 'spacer' }),
      isMedia && !b._uploading ? h('button', { class: 'abtn sm', type: 'button', onclick: function () { pickFiles({ type: b.type, replace: b }); } }, ['Replace']) : null,
      h('button', { class: 'abtn icon', type: 'button', title: 'Move up', disabled: i === 0, onclick: function () { move(-1); } }, ['\u2191']),
      h('button', { class: 'abtn icon', type: 'button', title: 'Move down', disabled: i === total - 1, onclick: function () { move(1); } }, ['\u2193']),
      h('button', { class: 'abtn icon', type: 'button', title: 'Delete block', onclick: function () {
        state.a.blocks = blocks.filter(function (x) { return x !== b; });
        renderEditor(); markDirty();
      } }, ['\u2715'])
    ]),
    h('div', { class: 'blk-body' }, body)
  ]);
}

function blocksEl() {
  var blocks = state.a.blocks;
  var out = h('div', { class: 'blocks' });
  if (blocks.length) out.appendChild(inserter(0));
  blocks.forEach(function (b, i) {
    out.appendChild(blockCard(b, i, blocks.length));
    if (i < blocks.length - 1) out.appendChild(inserter(i + 1));
  });
  out.appendChild(inserter(blocks.length, true));
  return out;
}

function dangerZone() {
  var items = [];
  if (state.published) {
    items.push(h('a', { class: 'abtn sm', href: SITE + (state.a.lang === 'ru' ? 'ru/' : '') + 'article.html?slug=' + encodeURIComponent(state.a.slug), target: '_blank', rel: 'noopener' }, ['View on site \u2197']));
    items.push(h('button', { class: 'abtn sm', onclick: unpublish }, ['Unpublish']));
  }
  if (state.key) items.push(h('button', { class: 'abtn sm danger', onclick: removeArticle }, ['Delete article']));
  return items.length ? h('div', { class: 'danger-zone' }, items) : null;
}

// ---------------------------------------------------------------- actions
function afterSave(key) {
  state.key = key;
  state.saved = snapshot();
  dirty = false;
  currentHash = '#/edit/' + encodeURIComponent(key);
  history.replaceState(null, '', currentHash);
  renderEditor();
}

async function saveDraft() {
  if (state.published || uploadsPending()) return;
  var a = state.a;
  busy('Saving draft\u2026');
  try {
    var data = clean(a);
    data.updated = new Date().toISOString();
    await gh.commit([{ path: '_news_drafts/' + a.id + '.json', text: JSON.stringify(data, null, 2) + '\n' }], 'News: save draft "' + (a.title || 'Untitled') + '"');
    afterSave('d-' + a.id);
    toast('Draft saved');
  } catch (e) { toast(errMsg(e), 'error'); }
  unbusy();
}

async function publish() {
  var a = state.a;
  if (!a.title.trim()) return toast('Add a title before publishing', 'error');
  if (uploadsPending()) return toast('Wait for uploads to finish', 'error');
  busy(state.published ? 'Updating site\u2026' : 'Publishing\u2026');
  try {
    var list = await loadIndex();
    var now = new Date().toISOString();
    if (!a.date) {
      var base = gh.slugify(a.slug || a.title) || 'article';
      var taken = {};
      list.forEach(function (x) { if (x.id !== a.id) taken[x.slug] = true; });
      var slug = base, n = 2;
      while (taken[slug]) slug = base + '-' + n++;
      a.slug = slug;
      a.date = now;
    }
    var data = clean(a);
    data.updated = now;
    var entry = { id: a.id, slug: a.slug, title: a.title, summary: a.summary || '', cover: a.cover || null, lang: a.lang || 'all', date: a.date };
    list = list.filter(function (x) { return x.slug !== a.slug && !(x.id && x.id === a.id); });
    list.push(entry);
    list.sort(function (x, y) { return String(y.date || '').localeCompare(String(x.date || '')); });
    var changes = [
      { path: 'news/posts/' + a.slug + '.json', text: JSON.stringify(data, null, 2) + '\n' },
      { path: 'news/index.json', text: JSON.stringify({ updated: now, articles: list }, null, 2) + '\n' }
    ];
    if (state.key && state.key.indexOf('d-') === 0) changes.push({ path: '_news_drafts/' + a.id + '.json', delete: true });
    await gh.commit(changes, 'News: publish "' + a.title + '"');
    state.published = true;
    afterSave('p-' + a.slug);
    toast('Published. The site updates in about a minute.');
  } catch (e) { toast(errMsg(e), 'error'); }
  unbusy();
}

async function unpublish() {
  if (!confirm('Remove this article from the site? It will stay here as a draft.')) return;
  var a = state.a;
  busy('Removing from site\u2026');
  try {
    var list = (await loadIndex()).filter(function (x) { return x.slug !== a.slug; });
    var now = new Date().toISOString();
    var data = clean(a);
    data.updated = now;
    await gh.commit([
      { path: 'news/index.json', text: JSON.stringify({ updated: now, articles: list }, null, 2) + '\n' },
      { path: 'news/posts/' + a.slug + '.json', text: JSON.stringify({ slug: a.slug, unpublished: true }) + '\n' },
      { path: '_news_drafts/' + a.id + '.json', text: JSON.stringify(data, null, 2) + '\n' }
    ], 'News: unpublish "' + a.title + '"');
    state.published = false;
    afterSave('d-' + a.id);
    toast('Removed from the site. Saved as a draft.');
  } catch (e) { toast(errMsg(e), 'error'); }
  unbusy();
}

async function removeArticle() {
  if (!confirm('Delete this article permanently?')) return;
  var a = state.a;
  busy('Deleting\u2026');
  try {
    var changes = [];
    if (state.published) {
      var list = (await loadIndex()).filter(function (x) { return x.slug !== a.slug; });
      changes.push({ path: 'news/index.json', text: JSON.stringify({ updated: new Date().toISOString(), articles: list }, null, 2) + '\n' });
      changes.push({ path: 'news/posts/' + a.slug + '.json', text: JSON.stringify({ slug: a.slug, unpublished: true }) + '\n' });
    } else if (state.key && state.key.indexOf('d-') === 0) {
      changes.push({ path: '_news_drafts/' + a.id + '.json', delete: true });
    }
    if (changes.length) await gh.commit(changes, 'News: delete "' + (a.title || 'Untitled') + '"');
    dirty = false;
    unbusy();
    toast('Article deleted');
    location.hash = '#/';
    return;
  } catch (e) { toast(errMsg(e), 'error'); }
  unbusy();
}

// ---------------------------------------------------------------- studio logo
function showLogo() {
  setHead('logo');
  var frame = h('div', { class: 'dev-mark logo-frame' });
  function showCurrent(srcUrl) {
    var img = h('img', { src: srcUrl, alt: 'Studio logo' });
    img.addEventListener('error', function () { frame.textContent = 'BG'; });
    frame.replaceChildren(img);
  }
  showCurrent(gh.RAW + 'assets/studio-logo.png?v=' + Date.now());
  var input = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    busy('Uploading logo\u2026');
    try {
      var b64 = await gh.toPngBase64(f, 512);
      await gh.commit([{ path: 'assets/studio-logo.png', base64: b64 }], 'Update studio logo');
      showCurrent('data:image/png;base64,' + b64);
      toast('Studio logo updated. The site updates in about a minute.');
    } catch (ex) { toast(errMsg(ex), 'error'); }
    unbusy();
  } });
  app.replaceChildren(h('section', { class: 'admin-card' }, [
    h('div', { class: 'eyebrow' }, ['Site']),
    h('h1', { class: 'card-title' }, ['Studio logo']),
    h('p', { class: 'muted' }, ['Shown in the Developer section of the site, inside the red frame. A square image works best (PNG with a transparent background is ideal).']),
    h('div', { class: 'logo-row' }, [frame, h('div', null, [input, h('button', { class: 'abtn primary', onclick: function () { input.click(); } }, ['Upload new logo'])])])
  ]));
}

route();
