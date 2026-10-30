/* Stormlight Codex — app shell: hash router, reading-progress shield
 * controls, theme toggle, keyboard shortcuts. */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};
  var h = SC.util.h;

  var shieldState = SC.shield.load();
  var modelCache = { key: null, model: null };
  var cleanup = null;
  var lastRouteKey = null;

  function raw() { return window.CODEX || { characters: [], groups: [], orders: [], timeline: [], meta: {} }; }

  function model() {
    var k = SC.shield.key(shieldState);
    if (modelCache.key !== k) modelCache = { key: k, model: SC.shield.gateAll(raw(), shieldState) };
    return modelCache.model;
  }

  var ROUTES = [
    [/^\/?$/, 'home', 'Frontispiece'],
    [/^\/characters\/?$/, 'codex', 'The Codex'],
    [/^\/c\/([^/]+)\/?$/, 'character', null],
    [/^\/web\/?$/, 'web', 'The Web of Bonds'],
    [/^\/timeline\/?$/, 'timeline', 'The Chronicle'],
    [/^\/orders\/?$/, 'orders', 'The Ten Orders'],
    [/^\/credits\/?$/, 'credits', 'Credits']
  ];

  function parse(hash) {
    var path = (hash || '').replace(/^#/, '').split('?')[0] || '/';
    for (var i = 0; i < ROUTES.length; i++) {
      var m = ROUTES[i][0].exec(path);
      if (m) {
        var id = null;
        if (m[1]) { try { id = decodeURIComponent(m[1]); } catch (e) { id = m[1]; } }
        return { view: ROUTES[i][1], title: ROUTES[i][2], params: { id: id }, path: path };
      }
    }
    return { view: 'notfound', title: 'Not found', params: {}, path: path };
  }

  function notFound(root) {
    root.appendChild(SC.ui.pageHeader('Page not found', 'There is no such page in the codex.'));
    root.appendChild(h('p', null, h('a', { href: '#/', text: 'Return to the frontispiece' })));
  }

  function render(opts) {
    opts = opts || {};
    var main = document.getElementById('main');
    var route = parse(location.hash);
    var m = model();
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    SC.util.clear(main);
    main.dataset.view = route.view;
    var siteTitle = (m.meta && m.meta.title) || 'Stormlight Codex';
    document.title = route.title ? route.title + ' \u2014 ' + siteTitle : siteTitle;
    var fn = SC.views[route.view] || notFound;
    cleanup = fn(main, route.params, m) || null;

    // nav state
    Array.prototype.forEach.call(document.querySelectorAll('.site-nav a'), function (a) {
      var target = a.getAttribute('href').replace(/^#/, '');
      var on = target === route.path || (target === '/characters' && route.view === 'character');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    var routeKey = route.path;
    if (!opts.keepFocus && routeKey !== lastRouteKey) {
      window.scrollTo(0, 0);
      if (lastRouteKey !== null) {
        var t = main.querySelector('h1');
        if (t) t.focus({ preventScroll: true });
      }
    }
    lastRouteKey = routeKey;
    if (opts.afterRender) opts.afterRender();
  }

  // ---------- shield controls ----------
  function buildShield() {
    var host = document.getElementById('shield');
    SC.util.clear(host);
    var levels = [[1, 'Book 1', 'The Way of Kings'], [2, 'Book 2', 'Words of Radiance'], [3, 'Book 3', 'Oathbringer']];
    var radios = levels.map(function (l) {
      var id = 'shield-' + l[0];
      var input = h('input', { type: 'radio', name: 'shield-level', id: id, value: String(l[0]) });
      input.checked = shieldState.level === l[0];
      input.addEventListener('change', function () { if (input.checked) setShield({ level: l[0] }); });
      return h('span', { class: 'seg' }, [input, h('label', { for: id, title: l[2] }, l[1])]);
    });
    var ed = h('input', { type: 'checkbox', id: 'shield-ed' });
    ed.checked = shieldState.edgedancer;
    ed.disabled = shieldState.level < 2;
    ed.addEventListener('change', function () { setShield({ edgedancer: ed.checked }); });
    host.appendChild(h('fieldset', { class: 'shield-set' }, [
      h('legend', { class: 'shield-legend' }, [h('span', { class: 'shield-glyph', 'aria-hidden': 'true' }), 'I\u2019ve read through']),
      h('div', { class: 'segs' }, radios),
      h('span', { class: 'ed-toggle' + (ed.disabled ? ' is-disabled' : '') }, [
        ed, h('label', { for: 'shield-ed' }, 'Include Edgedancer')
      ])
    ]));
  }

  function setShield(patch) {
    shieldState = SC.shield.normState(Object.assign({}, shieldState, patch));
    SC.shield.save(shieldState);
    var active = document.activeElement && document.activeElement.id;
    buildShield();
    render({ keepFocus: true });
    if (active) { var el = document.getElementById(active); if (el) el.focus(); }
    announce('Reading progress set to Book ' + shieldState.level +
      (shieldState.level >= 2 ? (shieldState.edgedancer ? ', including Edgedancer' : ', without Edgedancer') : '') + '.');
  }

  function announce(msg) {
    var live = document.getElementById('announcer');
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }

  // ---------- theme ----------
  function buildTheme() {
    var btn = document.getElementById('theme-toggle');
    function sync() {
      var light = document.documentElement.dataset.theme === 'light';
      btn.setAttribute('aria-pressed', light ? 'true' : 'false');
      btn.textContent = light ? 'Night' : 'Parchment';
      btn.setAttribute('aria-label', light ? 'Switch to the night theme' : 'Switch to the parchment theme');
    }
    btn.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      SC.util.store.set('sc.theme', next);
      sync();
    });
    sync();
  }

  // ---------- keyboard ----------
  function onKey(e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    e.preventDefault();
    var s = document.getElementById('codex-search');
    if (s) { s.focus(); s.select(); return; }
    var go = function () { var x = document.getElementById('codex-search'); if (x) x.focus(); };
    if (location.hash === '#/characters') go();
    else { pendingFocusSearch = true; location.hash = '#/characters'; }
  }
  var pendingFocusSearch = false;

  function start() {
    buildShield();
    buildTheme();
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', function () {
      render({
        afterRender: function () {
          if (pendingFocusSearch) {
            pendingFocusSearch = false;
            var x = document.getElementById('codex-search');
            if (x) x.focus();
          }
        }
      });
    });
    var foot = document.getElementById('foot-meta');
    if (foot) {
      var r = raw();
      foot.textContent = (r.meta && r.meta.sample ? 'Sample data. ' : '') +
        (r.characters || []).length + ' records. Offline; no network requests.';
    }
    render();
  }

  SC.router = {
    rerender: function () { render({ keepFocus: true }); },
    parse: parse,
    model: model,
    getShield: function () { return shieldState; },
    setShield: setShield,
    render: render
  };
  SC.start = start;
})();
