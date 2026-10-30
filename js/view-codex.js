/* Stormlight Codex — home (frontispiece) and Codex grid views. */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};
  var h = SC.util.h, ui = SC.ui, norm = SC.util.norm;

  var SKEY = 'sc.codexFilters';
  var DEFAULTS = { q: '', group: '', nation: '', kind: '', order: '', firstBook: '', status: '', sort: 'importance' };
  var state = (function (saved) {
    // Storage is untrusted (file:// shares one storage origin): keep only known string keys.
    var st = Object.assign({}, DEFAULTS);
    if (saved && typeof saved === 'object') {
      Object.keys(DEFAULTS).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(saved, k) && typeof saved[k] === 'string') st[k] = saved[k].slice(0, 200);
      });
    }
    return st;
  })(SC.util.store.sget(SKEY, {}));

  function saveState() { SC.util.store.sset(SKEY, state); }

  function appearanceKey(c) {
    var s = String(c.firstAppearance || '').toLowerCase();
    var n = 3000, m;
    if (/prelude/.test(s)) n = -2;
    else if (/prologue/.test(s)) n = -1;
    else if ((m = s.match(/chapter\s+(\d+)/))) n = Number(m[1]);
    else if ((m = s.match(/interlude\s+([ivx\d]+)-(\d+)/))) n = 1000 + Number(m[2]);
    else if (/interlude/.test(s)) n = 1500;
    else if (/epilogue/.test(s)) n = 2000;
    return SC.shield.RANK[c.firstBook] * 10000 + n;
  }

  var SORTS = {
    importance: function (a, b) { return (a.importance - b.importance) || a.name.localeCompare(b.name); },
    name: function (a, b) { return a.name.localeCompare(b.name); },
    first: function (a, b) {
      return (appearanceKey(a) - appearanceKey(b)) || (a.importance - b.importance) ||
        a.name.localeCompare(b.name);
    }
  };

  function haystack(c) {
    if (c._hay) return c._hay;
    var parts = [c.name, c.fullName, c.epithet].concat(c.aliases || []);
    (c.facts || []).forEach(function (f) { if (/title|rank|position|alias|name/i.test(f.label)) parts.push(f.value); });
    c._hay = norm(parts.filter(Boolean).join(' | '));
    return c._hay;
  }

  function matches(c, st) {
    if (st.group && c.groups.indexOf(st.group) < 0) return false;
    if (st.nation && c.nation !== st.nation) return false;
    if (st.kind && c.kind !== st.kind) return false;
    if (st.order && (st.order === '_none' ? c.order : c.order !== st.order)) return false;
    if (st.firstBook && c.firstBook !== st.firstBook) return false;
    if (st.status && c.status !== st.status) return false;
    var q = norm(st.q).trim();
    if (q) {
      var hay = haystack(c);
      var toks = q.split(/\s+/);
      for (var i = 0; i < toks.length; i++) if (hay.indexOf(toks[i]) < 0) return false;
    }
    return true;
  }

  function filtered(model, st) {
    st = st || state;
    var list = model.characters.filter(function (c) { return matches(c, st); });
    list.sort(SORTS[st.sort] || SORTS.importance);
    return list;
  }

  /** The list prev/next on character pages walks through. */
  function currentList(model) { return filtered(model, state); }

  function plateNumbers(model) {
    if (model._plates) return model._plates;
    var nums = Object.create(null);
    model.characters.slice().sort(SORTS.importance).forEach(function (c, i) { nums[c.id] = i + 1; });
    model._plates = nums;
    return nums;
  }

  function card(model, c, n) {
    var sub = c.epithet || ui.groupLabel(model, c.group, true);
    return h('li', { class: 'plate-item', dataset: { id: c.id } }, [
      h('a', { class: 'plate ' + ui.groupClass(c.group), href: '#/c/' + encodeURIComponent(c.id) }, [
        h('span', { class: 'plate-no', 'aria-hidden': 'true', text: 'Pl. ' + SC.util.roman(n) }),
        h('figure', { class: 'plate-fig' }, [
          ui.portrait(c, { alt: '', w: 320, h: 400 }),
          h('figcaption', { class: 'plate-cap' }, [
            h('span', { class: 'plate-name', text: c.name }),
            h('span', { class: 'plate-sub', text: sub })
          ])
        ])
      ])
    ]);
  }

  function options(values, labeler) {
    return values.map(function (v) { return h('option', { value: v, text: labeler ? labeler(v) : v }); });
  }

  function uniq(list) {
    var seen = Object.create(null), out = [];
    list.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }

  function select(id, label, opts, value, onchange) {
    var sel = h('select', { id: id, name: id }, opts);
    sel.value = value;
    if (sel.value !== value) sel.value = '';
    sel.addEventListener('change', function () { onchange(sel.value); });
    return h('div', { class: 'field' }, [h('label', { for: id, text: label }), sel]);
  }

  function renderCodex(root, params, model) {
    var plates = plateNumbers(model);
    var chars = model.characters;

    var head = ui.pageHeader('The Codex', 'Portraits and records of ' + chars.length +
      ' figures, as far as your reading allows.', 'Index of Persons');

    var count = h('p', { class: 'result-count', 'aria-live': 'polite' });
    var grid = h('ol', { class: 'plates', 'aria-label': 'Characters' });
    var empty = ui.emptyNote('No entries match these filters.');
    empty.hidden = true;

    var cards = Object.create(null);
    chars.forEach(function (c) { cards[c.id] = card(model, c, plates[c.id]); });

    function refresh() {
      saveState();
      var list = filtered(model, state);
      var frag = document.createDocumentFragment();
      var shown = Object.create(null);
      list.forEach(function (c) { frag.appendChild(cards[c.id]); shown[c.id] = 1; });
      SC.util.clear(grid).appendChild(frag);
      count.textContent = list.length === chars.length
        ? chars.length + ' entries'
        : list.length + ' of ' + chars.length + ' entries';
      empty.hidden = list.length > 0;
    }

    function set(k) { return function (v) { state[k] = v; refresh(); }; }

    var search = h('input', {
      type: 'search', id: 'codex-search', name: 'q', autocomplete: 'off', spellcheck: 'false',
      placeholder: 'Name, alias or title', 'aria-describedby': 'search-hint'
    });
    search.value = state.q;
    var t = null;
    search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = search.value; refresh(); }, 60);
    });
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && search.value) { search.value = ''; state.q = ''; refresh(); e.stopPropagation(); }
      if (e.key === 'Enter') {
        var first = grid.querySelector('a');
        if (first) { e.preventDefault(); first.focus(); }
      }
    });

    var groupIds = uniq(model.groups.map(function (g) { return g.id; }).filter(function (id) {
      return chars.some(function (c) { return c.groups.indexOf(id) >= 0; });
    }));
    var nations = uniq(chars.map(function (c) { return c.nation; })).sort();
    var kinds = uniq(chars.map(function (c) { return c.kind; }));
    var orderIds = uniq(chars.map(function (c) { return c.order; }));
    var books = SC.shield.BOOK_ORDER.filter(function (b) {
      return chars.some(function (c) { return c.firstBook === b; });
    });
    var statuses = uniq(chars.map(function (c) { return c.status; }));

    var any = function (lbl) { return h('option', { value: '', text: lbl }); };
    var form = h('form', { class: 'filters', role: 'search', 'aria-label': 'Search and filter characters' }, [
      h('div', { class: 'field field-search' }, [
        h('label', { for: 'codex-search', text: 'Search' }),
        search,
        h('p', { id: 'search-hint', class: 'hint', text: 'Press / to search from anywhere.' })
      ]),
      select('f-group', 'Group', [any('All groups')].concat(options(groupIds, function (g) { return ui.groupLabel(model, g, true); })), state.group, set('group')),
      select('f-nation', 'Nation', [any('All nations')].concat(options(nations)), state.nation, set('nation')),
      select('f-kind', 'Kind', [any('All kinds')].concat(options(kinds, function (k) { return ui.KIND_LABELS[k] || k; })), state.kind, set('kind')),
      select('f-order', 'Radiant order', [any('Any or none')].concat(options(orderIds, function (o) { return ui.orderName(model, o); })), state.order, set('order')),
      select('f-book', 'First appears', [any('Any book')].concat(options(books, ui.bookTitle)), state.firstBook, set('firstBook')),
      select('f-status', 'Status', [any('Any status')].concat(options(statuses, function (s) { return ui.STATUS_LABELS[s] || s; })), state.status, set('status')),
      select('f-sort', 'Order by', options(['importance', 'name', 'first'], function (s) {
        return { importance: 'Prominence', name: 'Name', first: 'First appearance' }[s];
      }), state.sort, set('sort')),
      h('button', {
        type: 'button', class: 'btn-quiet', onclick: function () {
          state = Object.assign({}, DEFAULTS);
          SC.router.rerender();
        }
      }, 'Clear filters')
    ]);
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    root.appendChild(head);
    root.appendChild(h('div', { class: 'codex' }, [
      h('aside', { class: 'codex-side' }, [form]),
      h('section', { class: 'codex-main', 'aria-label': 'Results' }, [count, grid, empty])
    ]));
    if (!chars.length) {
      empty.textContent = model.totalCharacters
        ? 'No entries are visible at your reading level.'
        : 'No character data yet. Run tools/build_data.py to build the codex.';
    }
    refresh();
  }

  function renderHome(root, params, model) {
    var meta = model.meta || {};
    var mains = model.characters.filter(function (c) { return c.importance === 1; })
      .sort(SORTS.importance).slice(0, 8);
    var lvl = model.state.level;
    root.appendChild(h('section', { class: 'frontis' }, [
      h('p', { class: 'kicker', text: 'Being a record of persons, bonds and deeds' }),
      h('h1', { class: 'frontis-title', tabindex: '-1', text: meta.title || 'Stormlight Codex' }),
      h('p', { class: 'frontis-sub', text: meta.subtitle || '' }),
      h('div', { class: 'rule-orn', 'aria-hidden': 'true' }),
      h('p', { class: 'frontis-note' }, [
        'Your shield is set to ',
        h('strong', { text: 'Book ' + lvl + ', ' + ui.bookTitle(['', 'wok', 'wor', 'ob'][lvl]) }),
        model.state.edgedancer && lvl >= 2 ? ', with Edgedancer' : '',
        '. Nothing beyond it is shown anywhere in the codex.'
      ])
    ]));
    var sections = [
      ['#/characters', 'The Codex', model.characters.length + ' portraits and records'],
      ['#/web', 'The Web of Bonds', model.edges.length + ' known ties, drawn as a map'],
      ['#/timeline', 'The Chronicle', model.timeline.length + ' events, book by book'],
      ['#/orders', 'The Ten Orders', 'Heralds, surges, spren and Ideals'],
      ['#/credits', 'Credits', 'Artists, sources and the spoiler policy']
    ];
    root.appendChild(h('nav', { class: 'contents', 'aria-label': 'Contents' }, [
      h('h2', { class: 'section-title', text: 'Contents' }),
      h('ol', { class: 'contents-list' }, sections.map(function (s, i) {
        return h('li', null, h('a', { href: s[0] }, [
          h('span', { class: 'contents-no', text: SC.util.roman(i + 1) + '.' }),
          h('span', { class: 'contents-name', text: s[1] }),
          h('span', { class: 'contents-lead', 'aria-hidden': 'true' }),
          h('span', { class: 'contents-desc', text: s[2] })
        ]));
      }))
    ]));
    if (mains.length) {
      var plates = plateNumbers(model);
      root.appendChild(h('section', { class: 'featured', 'aria-labelledby': 'feat-h' }, [
        h('h2', { id: 'feat-h', class: 'section-title', text: 'Principal figures' }),
        h('ol', { class: 'plates plates-featured' }, mains.map(function (c) { return card(model, c, plates[c.id]); }))
      ]));
    }
  }

  SC.views = SC.views || {};
  SC.views.codex = renderCodex;
  SC.views.home = renderHome;
  SC.codex = { filtered: filtered, currentList: currentList, SORTS: SORTS, state: function () { return state; } };
})();
