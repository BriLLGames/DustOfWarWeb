// Dust of War — news list & article renderer.
// Data lives in news/index.json and news/posts/<slug>.json (published from the admin panel).
(function () {
  var lang = document.documentElement.lang === 'ru' ? 'ru' : 'en';
  var root = lang === 'ru' ? '../' : '';
  var T = {
    en: { loading: 'Loading\u2026', empty: 'No news yet \u2014 check back soon.', error: 'Could not load news. Please try again later.', more: 'Read more \u2192', notFound: 'Article not found.', download: 'Download' },
    ru: { loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026', empty: '\u041d\u043e\u0432\u043e\u0441\u0442\u0435\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u2014 \u0437\u0430\u0433\u043b\u044f\u043d\u0438\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.', error: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043d\u043e\u0432\u043e\u0441\u0442\u0438. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.', more: '\u0427\u0438\u0442\u0430\u0442\u044c \u2192', notFound: '\u0421\u0442\u0430\u0442\u044c\u044f \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.', download: '\u0421\u043a\u0430\u0447\u0430\u0442\u044c' }
  }[lang];

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
  function media(p) {
    if (!p) return '';
    return /^https?:\/\//i.test(p) ? p : root + p;
  }
  function inline(text) {
    var s = esc(text);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      var url = safeUrl(u.replace(/&amp;/g, '&'));
      var ext = /^https?:/i.test(url);
      return '<a href="' + esc(url) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>';
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
  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }
  function fmtSize(n) {
    if (!n) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return Math.round(n / 1024) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function youtubeId(url) {
    var m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url || '');
    return m ? m[1] : null;
  }
  function caption(b) {
    return b.caption ? '<figcaption>' + inline(b.caption) + '</figcaption>' : '';
  }

  function renderBlock(b) {
    switch (b.type) {
      case 'heading': return '<h2>' + inline(b.text) + '</h2>';
      case 'paragraph': return paragraphs(b.text);
      case 'quote': return '<blockquote>' + paragraphs(b.text) + '</blockquote>';
      case 'divider': return '<div class="frontline article-divider"></div>';
      case 'image':
        if (!b.path) return '';
        return '<figure class="article-figure"><a href="' + esc(media(b.path)) + '" target="_blank" rel="noopener">' +
          '<img src="' + esc(media(b.path)) + '" alt="' + esc(b.alt || b.caption || '') + '" loading="lazy"></a>' + caption(b) + '</figure>';
      case 'video':
        if (!b.path) return '';
        return '<figure class="article-figure"><video src="' + esc(media(b.path)) + '" controls preload="metadata" playsinline></video>' + caption(b) + '</figure>';
      case 'youtube':
        var id = youtubeId(b.url);
        if (!id) return '';
        return '<figure class="article-figure"><div class="article-embed"><iframe src="https://www.youtube-nocookie.com/embed/' + id +
          '" title="YouTube video" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>' + caption(b) + '</figure>';
      case 'file':
        if (!b.path) return '';
        return '<a class="article-file" href="' + esc(media(b.path)) + '" download target="_blank" rel="noopener">' +
          '<span class="article-file-icon">\u2193</span><span class="article-file-meta"><strong>' + esc(b.name || 'file') + '</strong>' +
          '<span>' + T.download + (b.size ? ' \u00b7 ' + fmtSize(b.size) : '') + '</span></span></a>';
      default: return '';
    }
  }

  function status(el, text) { el.innerHTML = '<div class="news-status">' + esc(text) + '</div>'; }
  function getJSON(path) {
    return fetch(root + path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  function renderList(el) {
    status(el, T.loading);
    getJSON('news/index.json').then(function (data) {
      var items = ((data && data.articles) || []).filter(function (a) { return a.lang === 'all' || a.lang === lang; });
      if (!items.length) return status(el, T.empty);
      el.innerHTML = items.map(function (a) {
        var href = 'article.html?slug=' + encodeURIComponent(a.slug);
        var cover = a.cover ? '<div class="news-item-cover"><img src="' + esc(media(a.cover)) + '" alt="" loading="lazy"></div>' : '';
        return '<a class="news-item' + (a.cover ? '' : ' no-cover') + '" href="' + href + '">' + cover +
          '<div class="news-item-text"><div class="news-item-date">' + esc(fmtDate(a.date)) + '</div>' +
          '<h2>' + esc(a.title) + '</h2>' + (a.summary ? '<p>' + esc(a.summary) + '</p>' : '') +
          '<span class="news-item-more">' + T.more + '</span></div></a>';
      }).join('');
    }).catch(function () { status(el, T.error); });
  }

  function renderArticle(el) {
    var slug = new URLSearchParams(window.location.search).get('slug') || '';
    if (!/^[a-z0-9-]+$/.test(slug)) return status(el, T.notFound);
    status(el, T.loading);
    getJSON('news/posts/' + slug + '.json').then(function (a) {
      document.title = a.title + ' \u2014 Dust of War';
      var meta = document.querySelector('meta[name="description"]');
      if (meta && a.summary) meta.setAttribute('content', a.summary);
      el.innerHTML =
        '<header class="article-head"><div class="eyebrow">' + esc(fmtDate(a.date)) + '</div>' +
        '<h1>' + esc(a.title) + '</h1>' + (a.summary ? '<p class="article-lead">' + esc(a.summary) + '</p>' : '') + '</header>' +
        (a.cover ? '<div class="article-cover"><img src="' + esc(media(a.cover)) + '" alt=""></div>' : '') +
        '<div class="article-body">' + (a.blocks || []).map(renderBlock).join('') + '</div>';
    }).catch(function () { status(el, T.notFound); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var list = document.getElementById('news-list');
    if (list) renderList(list);
    var article = document.getElementById('article');
    if (article) renderArticle(article);
  });
})();
