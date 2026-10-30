/* Stormlight Codex — reading-progress shield.
 *
 * Pure functions: given the raw CODEX data and a shield state
 * {level: 1|2|3, edgedancer: bool}, produce a "model" that contains ONLY what
 * a reader at that level may see. Every view renders from the model, never
 * from raw data, so gating happens in exactly one place.
 *
 * Rules (SPEC section 2):
 *  - an item is visible when its book is at or below the level;
 *    Edgedancer items additionally need the toggle on and level >= 2
 *  - characters whose firstBook is hidden vanish everywhere
 *  - facts, appearance, personality, history, relationships, quotes, images,
 *    timeline events, order ideals: gated by their own `book`
 *  - summary and epithet are Oathbringer-level: hidden unless OB is visible;
 *    the first visible history entry stands in for the summary
 * Conservative extras (fields that carry no book code in the schema):
 *  - `order` hidden unless `orderBook` is visible (no orderBook -> OB level)
 *  - `kind` shown unless `kindBook` is given and hidden (then 'human'/'other'
 *    is NOT guessed; kind becomes null)
 *  - status hidden unless `statusBook` is visible
 *  - plain-string aliases and secondary groups are OB-level; aliases written as
 *    {name, book} are gated by book
 *  - unknown / missing book codes are treated as hidden (never shown)
 */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};

  var RANK = { wok: 1, wor: 2, edgedancer: 2.5, ob: 3 };
  var BOOK_ORDER = ['wok', 'wor', 'edgedancer', 'ob'];
  var ERA_ORDER = ['before', 'wok', 'wor', 'edgedancer', 'ob'];
  var DEFAULT = { level: 3, edgedancer: true };
  var KEY = 'sc.shield';

  function normState(st) {
    st = st || {};
    var level = [1, 2, 3].indexOf(Number(st.level)) >= 0 ? Number(st.level) : DEFAULT.level;
    var ed = typeof st.edgedancer === 'boolean' ? st.edgedancer : DEFAULT.edgedancer;
    return { level: level, edgedancer: ed };
  }

  function visible(book, st) {
    if (!Object.prototype.hasOwnProperty.call(RANK, book)) return false;
    if (book === 'edgedancer') return !!st.edgedancer && st.level >= 2;
    return RANK[book] <= st.level;
  }

  function byBook(list, st) {
    return (list || []).filter(function (it) { return it && visible(it.book, st); });
  }

  /** Field that may be a plain value or {value, book}. Returns value or null. */
  function field(v, st) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && !Array.isArray(v)) {
      return visible(v.book, st) ? (v.value !== undefined ? v.value : v.text) : null;
    }
    return v;
  }

  function gateCharacter(c, st) {
    if (!c || !visible(c.firstBook, st)) return null;
    var obOK = visible('ob', st);
    var history = byBook(c.history, st);
    var aliases = (c.aliases || []).map(function (a) {
      if (typeof a === 'string') return obOK ? a : null;
      return a && visible(a.book, st) ? a.name : null;
    }).filter(Boolean);
    var groups = obOK ? (c.groups || []).slice() : (c.group ? [c.group] : []);
    var orderOK = c.orderBook ? visible(c.orderBook, st) : obOK;
    var kindOK = c.kindBook ? visible(c.kindBook, st) : true;
    var statusOK = c.statusBook ? visible(c.statusBook, st) : obOK;
    var summary = obOK ? c.summary : null;
    var lead = summary;
    if (!lead && history.length) lead = history[0].text;
    return {
      id: c.id,
      name: c.name,
      fullName: c.fullName || null,
      aliases: aliases,
      epithet: obOK ? (c.epithet || null) : null,
      group: c.group || null,
      groups: groups,
      kind: kindOK ? (c.kind || null) : null,
      nation: c.nation || null,
      order: orderOK ? (c.order || null) : null,
      importance: c.importance || 4,
      firstBook: c.firstBook,
      firstAppearance: c.firstAppearance || null,
      status: statusOK ? (c.status || null) : null,
      summary: summary,
      lead: lead || null,
      leadIsHistory: !summary && !!lead,
      facts: byBook(c.facts, st),
      appearance: byBook(c.appearance, st),
      personality: byBook(c.personality, st),
      history: history,
      quotes: byBook(c.quotes, st),
      images: byBook(c.images, st),
      hiddenImageCount: (c.images || []).length - byBook(c.images, st).length
    };
  }

  /** Build the gated model from raw CODEX data. */
  function gateAll(raw, st) {
    st = normState(st);
    raw = raw || {};
    var chars = [];
    var byId = Object.create(null);
    (raw.characters || []).forEach(function (c) {
      var g = gateCharacter(c, st);
      if (g && !byId[g.id]) { chars.push(g); byId[g.id] = g; }
    });

    // Relationships: edges with per-side labels (build_data.py). Fall back to
    // per-character relationships if edges are absent.
    var rawEdges = raw.edges;
    if (!rawEdges) {
      var tmp = Object.create(null);
      (raw.characters || []).forEach(function (c) {
        (c.relationships || []).forEach(function (r) {
          var a = c.id < r.id ? c.id : r.id, b = c.id < r.id ? r.id : c.id;
          var k = a + '|' + b;
          tmp[k] = tmp[k] || { a: a, b: b, sides: [] };
          tmp[k].sides.push({ from: c.id, to: r.id, type: r.type, label: r.label, book: r.book });
        });
      });
      rawEdges = Object.keys(tmp).map(function (k) { return tmp[k]; });
    }
    var edges = [];
    var adj = Object.create(null);
    chars.forEach(function (c) { adj[c.id] = []; });
    rawEdges.forEach(function (e) {
      if (!byId[e.a] || !byId[e.b]) return;
      var sides = byBook(e.sides, st);
      if (!sides.length) return;
      var ge = { a: e.a, b: e.b, sides: sides, type: sides[0].type };
      edges.push(ge);
      [e.a, e.b].forEach(function (me) {
        var other = me === e.a ? e.b : e.a;
        var mine = sides.filter(function (s) { return s.from === me; });
        var side = mine[0] || sides[0];
        adj[me].push({ id: other, type: side.type, label: side.label, sides: sides, edge: ge });
      });
    });
    chars.forEach(function (c) { c.relationships = adj[c.id]; });

    var timeline = byBook(raw.timeline, st).map(function (t) {
      return {
        id: t.id, book: t.book, era: t.era || null, when: t.when || null, kind: t.kind || null,
        title: t.title, text: t.text || null,
        seq: t.seq || 0,
        characters: (t.characters || []).filter(function (id) { return !!byId[id]; })
      };
    }).sort(function (x, y) {
      return (RANK[x.book] - RANK[y.book]) || (x.seq - y.seq);
    });

    var orders = (raw.orders || []).filter(function (o) {
      return !o.book || visible(o.book, st);
    }).map(function (o) {
      // members: orders.json members (gated by their book) + characters whose
      // own (gated) order is this one
      var members = [], seenM = Object.create(null);
      byBook(o.members, st).forEach(function (m) {
        var c = byId[m.id];
        if (c && !seenM[m.id]) { seenM[m.id] = 1; members.push({ c: c, note: m.note || null }); }
      });
      chars.forEach(function (c) {
        if (c.order === o.id && !seenM[c.id]) { seenM[c.id] = 1; members.push({ c: c, note: null }); }
      });
      var herald = field(o.herald, st);
      return {
        id: o.id,
        name: o.name,
        herald: herald,
        heraldId: herald && o.heraldId && byId[o.heraldId] ? o.heraldId : null,
        spren: field(o.spren, st),
        summary: field(o.summary, st),
        attributes: field(o.attributes, st),
        gemstone: field(o.gemstone, st),
        essence: field(o.essence, st),
        surges: (o.surges || []).map(function (s) { return field(s, st); }).filter(Boolean),
        ideals: byBook(o.ideals, st),
        members: members.map(function (m) { return m.c; }),
        memberNotes: members.reduce(function (acc, m) { if (m.note) acc[m.c.id] = m.note; return acc; }, {})
      };
    });

    var groups = raw.groups || [];
    var groupById = Object.create(null);
    groups.forEach(function (g) { groupById[g.id] = g; });

    var hiddenImages = 0;
    (raw.characters || []).forEach(function (c) {
      var g = byId[c.id];
      hiddenImages += g ? g.hiddenImageCount : (c.images || []).length;
    });

    return {
      state: st,
      characters: chars,
      byId: byId,
      edges: edges,
      timeline: timeline,
      orders: orders,
      groups: groups,
      groupById: groupById,
      meta: raw.meta || {},
      hiddenImages: hiddenImages,
      totalCharacters: (raw.characters || []).length
    };
  }

  function load() { return normState(SC.util.store.get(KEY, DEFAULT)); }
  function save(st) { SC.util.store.set(KEY, normState(st)); }
  function key(st) { return st.level + (st.edgedancer ? 'e' : ''); }

  SC.shield = {
    RANK: RANK, BOOK_ORDER: BOOK_ORDER, ERA_ORDER: ERA_ORDER, DEFAULT: DEFAULT,
    normState: normState, visible: visible, gateCharacter: gateCharacter, gateAll: gateAll,
    load: load, save: save, key: key
  };
})();
