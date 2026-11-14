// Dust of War news admin — article preview renderer (mirrors js/news.js on the site).
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function safeUrl(u) {
  u = String(u || '').trim();
  var m = /^([a-z][a-z0-9+.-]*):/i.exec(u);
  if (m && !/^(https?|mailto)$/i.test(m[1])) return '#';
  return u;
}
function inline(text) {
  var s = esc(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
    var url = safeUrl(u.replace(/&amp;/g, '&'));
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + t + '</a>';
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s;
}
function paragraphs(text) {
  return String(text || '').split(/\n{2,}/).map(function (p) {
    p = p.trim();
    return p ? '<p>' + inline(p).replace(/\n/g, '<br>') + '</p>' : '';
  }).join('');
}
export function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; }
}
export function fmtSize(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return Math.round(n / 1024) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
export function youtubeId(url) {
  var m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url || '');
  return m ? m[1] : null;
}
function caption(b) { return b.caption ? '<figcaption>' + inline(b.caption) + '</figcaption>' : ''; }

function block(b, media) {
  switch (b.type) {
    case 'heading': return '<h2>' + inline(b.text) + '</h2>';
    case 'paragraph': return paragraphs(b.text);
    case 'quote': return '<blockquote>' + paragraphs(b.text) + '</blockquote>';
    case 'divider': return '<div class="frontline article-divider"></div>';
    case 'image':
      return b.path ? '<figure class="article-figure"><img src="' + esc(media(b.path)) + '" alt="' + esc(b.alt || b.caption || '') + '">' + caption(b) + '</figure>' : '';
    case 'video':
      return b.path ? '<figure class="article-figure"><video src="' + esc(media(b.path)) + '" controls preload="metadata" playsinline></video>' + caption(b) + '</figure>' : '';
    case 'youtube':
      var id = youtubeId(b.url);
      return id ? '<figure class="article-figure"><div class="article-embed"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '" title="YouTube video" allowfullscreen loading="lazy"></iframe></div>' + caption(b) + '</figure>' : '';
    case 'file':
      return b.path ? '<a class="article-file" href="' + esc(media(b.path)) + '" target="_blank" rel="noopener"><span class="article-file-icon">\u2193</span><span class="article-file-meta"><strong>' + esc(b.name || 'file') + '</strong><span>Download' + (b.size ? ' \u00b7 ' + fmtSize(b.size) : '') + '</span></span></a>' : '';
    default: return '';
  }
}

/** Full article HTML using the site's own article classes. */
export function renderArticle(a, media) {
  return '<header class="article-head"><div class="eyebrow">' + esc(fmtDate(a.date || new Date().toISOString())) + '</div>' +
    '<h1>' + esc(a.title || 'Untitled') + '</h1>' + (a.summary ? '<p class="article-lead">' + esc(a.summary) + '</p>' : '') + '</header>' +
    (a.cover ? '<div class="article-cover"><img src="' + esc(media(a.cover)) + '" alt=""></div>' : '') +
    '<div class="article-body">' + (a.blocks || []).map(function (b) { return block(b, media); }).join('') + '</div>';
}
