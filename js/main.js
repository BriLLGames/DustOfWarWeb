// Dust of War — shared site behaviour (no tracking, no analytics, no cookies)
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle-btn');
  var nav = document.querySelector('.main-nav');

  function setOpen(open) {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '\u2715' : '\u2630';
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 980) setOpen(false); });
  }

  var yearEls = document.querySelectorAll('[data-year]');
  yearEls.forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Home page: show the latest published news article in the news strip.
  var teaser = document.querySelector('[data-latest-news]');
  if (teaser && window.fetch) {
    var lang = document.documentElement.lang === 'ru' ? 'ru' : 'en';
    var root = lang === 'ru' ? '../' : '';
    fetch(root + 'news/index.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var items = ((data && data.articles) || []).filter(function (a) { return a.lang === 'all' || a.lang === lang; });
        if (!items.length) return;
        var a = items[0];
        var link = teaser.querySelector('[data-latest-link]');
        var p = teaser.querySelector('p');
        if (link) {
          link.textContent = a.title;
          link.setAttribute('href', 'article.html?slug=' + encodeURIComponent(a.slug));
        }
        if (p) p.textContent = a.summary || '';
      })
      .catch(function () {});
  }
});
