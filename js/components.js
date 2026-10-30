/* Stormlight Codex — shared UI pieces: book labels, portraits, monogram
 * glyph tiles, character chips. */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};
  var h = SC.util.h, svg = SC.util.svg;

  var BOOK_TITLES = {
    wok: 'The Way of Kings', wor: 'Words of Radiance',
    edgedancer: 'Edgedancer', ob: 'Oathbringer'
  };
  var BOOK_SHORT = { wok: 'Book 1', wor: 'Book 2', edgedancer: 'Novella', ob: 'Book 3' };
  var ERA_TITLES = {
    before: 'Before the story', wok: 'The Way of Kings', wor: 'Words of Radiance',
    edgedancer: 'Edgedancer', ob: 'Oathbringer'
  };
  var KIND_LABELS = {
    human: 'Human', singer: 'Singer', spren: 'Spren', herald: 'Herald', god: 'Shard / god',
    unmade: 'Unmade', other: 'Other'
  };
  var STATUS_LABELS = { alive: 'Living', deceased: 'Deceased', unknown: 'Unknown' };
  var REL_LABELS = {
    family: 'Family', bond: 'Bonds', romance: 'Romance', friend: 'Friends', ally: 'Allies',
    mentor: 'Mentors & students', rival: 'Rivals', enemy: 'Enemies', serves: 'Service & loyalty',
    other: 'Other ties'
  };
  var REL_ORDER = ['bond', 'family', 'romance', 'friend', 'mentor', 'ally', 'serves', 'rival',
    'enemy', 'other'];
  var ORDER_NAMES = {
    windrunners: 'Windrunners', skybreakers: 'Skybreakers', dustbringers: 'Dustbringers',
    edgedancers: 'Edgedancers', truthwatchers: 'Truthwatchers', lightweavers: 'Lightweavers',
    elsecallers: 'Elsecallers', willshapers: 'Willshapers', stonewards: 'Stonewards',
    bondsmiths: 'Bondsmiths'
  };

  function bookTitle(code) {
    var meta = (window.CODEX && window.CODEX.meta) || {};
    var b = (meta.books || []).filter(function (x) { return x.code === code; })[0];
    return (b && b.title) || BOOK_TITLES[code] || code;
  }

  function groupClass(gid) {
    return 'g-' + (/^[a-z0-9-]+$/.test(gid || '') ? gid : 'none');
  }

  function initials(name) {
    var parts = String(name || '?').replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/[\s-]+/)
      .filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).replace(/^./, function (m) { return m.toUpperCase(); });
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* A symmetric "glyphward" ornament generated from the id: strokes on a
   * small grid, mirrored left/right, so every tile is distinct but calm. */
  function glyphPath(id) {
    var seed = SC.util.hash(id || 'x');
    var pts = [];
    for (var r = 0; r < 5; r++) for (var c = 0; c < 2; c++) pts.push([c, r]);
    var d = 'M50 10 L50 115 ';
    for (var i = 0; i < 7; i++) {
      var a = pts[(seed >>> (i * 3)) % pts.length];
      var b = pts[(seed >>> (i * 3 + 2)) % pts.length];
      if (a === b) continue;
      var ax = 50 - (a[0] + 1) * 14, ay = 18 + a[1] * 22;
      var bx = 50 - (b[0] + 1) * 14, by = 18 + b[1] * 22;
      d += 'M' + ax + ' ' + ay + ' L' + bx + ' ' + by + ' ';
      d += 'M' + (100 - ax) + ' ' + ay + ' L' + (100 - bx) + ' ' + by + ' ';
    }
    return d;
  }

  function monogram(c, opts) {
    opts = opts || {};
    var g = svg('svg', {
      class: 'mono ' + groupClass(c.group) + (opts.small ? ' mono-small' : ''),
      viewBox: '0 0 100 125', 'aria-hidden': 'true', focusable: 'false',
      preserveAspectRatio: 'xMidYMid slice'
    });
    g.appendChild(svg('rect', { class: 'mono-bg', x: 0, y: 0, width: 100, height: 125 }));
    if (!opts.small) {
      g.appendChild(svg('path', { class: 'mono-glyph', d: glyphPath(c.id) }));
      g.appendChild(svg('rect', { class: 'mono-frame', x: 6, y: 6, width: 88, height: 113 }));
    }
    g.appendChild(svg('text', {
      class: 'mono-text', x: 50, y: opts.small ? 76 : 74, 'text-anchor': 'middle'
    }, initials(c.name)));
    return g;
  }

  /** Portrait element: first visible image or a monogram. Never a broken image. */
  function portrait(c, opts) {
    opts = opts || {};
    var im = opts.image !== undefined ? opts.image : (c.images && c.images[0]);
    var wrap = h('div', { class: 'portrait ' + groupClass(c.group) + (opts.cls ? ' ' + opts.cls : '') });
    if (!im) { wrap.appendChild(monogram(c, opts)); wrap.classList.add('is-mono'); return wrap; }
    var img = h('img', {
      src: im.file, alt: opts.alt === '' ? '' : (im.caption || ('Portrait of ' + c.name)),
      loading: opts.eager ? 'eager' : 'lazy', decoding: 'async',
      width: opts.w || 320, height: opts.h || 400
    });
    img.addEventListener('error', function () {
      if (!img.parentNode) return;
      wrap.replaceChild(monogram(c, opts), img);
      wrap.classList.add('is-mono');
    });
    wrap.appendChild(img);
    return wrap;
  }

  function chip(c, extra) {
    return h('a', { class: 'chip ' + groupClass(c.group), href: '#/c/' + encodeURIComponent(c.id) }, [
      portrait(c, { small: true, alt: '', w: 48, h: 60, cls: 'chip-face' }),
      h('span', { class: 'chip-text' }, [
        h('span', { class: 'chip-name', text: c.name }),
        extra ? h('span', { class: 'chip-sub', text: extra }) : null
      ])
    ]);
  }

  function bookTag(code) {
    return h('span', { class: 'book-tag bk-' + code, title: bookTitle(code), text: BOOK_SHORT[code] || code });
  }

  function groupLabel(model, gid, short) {
    var g = model.groupById[gid];
    if (!g) return gid || 'Unaffiliated';
    return (short && g.short) || g.label;
  }

  function orderName(model, oid) {
    var o = (model.orders || []).filter(function (x) { return x.id === oid; })[0];
    return (o && o.name) || ORDER_NAMES[oid] || oid;
  }

  function emptyNote(text) {
    return h('p', { class: 'empty-note', text: text });
  }

  function pageHeader(title, sub, kicker) {
    return h('header', { class: 'page-head' }, [
      kicker ? h('p', { class: 'kicker', text: kicker }) : null,
      h('h1', { class: 'page-title', tabindex: '-1', text: title }),
      sub ? h('p', { class: 'page-sub', text: sub }) : null,
      h('div', { class: 'rule-orn', 'aria-hidden': 'true' })
    ]);
  }

  SC.ui = {
    BOOK_TITLES: BOOK_TITLES, BOOK_SHORT: BOOK_SHORT, ERA_TITLES: ERA_TITLES,
    KIND_LABELS: KIND_LABELS, STATUS_LABELS: STATUS_LABELS, REL_LABELS: REL_LABELS,
    REL_ORDER: REL_ORDER, ORDER_NAMES: ORDER_NAMES,
    bookTitle: bookTitle, groupClass: groupClass, initials: initials, monogram: monogram,
    portrait: portrait, chip: chip, bookTag: bookTag, groupLabel: groupLabel,
    orderName: orderName, emptyNote: emptyNote, pageHeader: pageHeader
  };
})();
