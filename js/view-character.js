/* Stormlight Codex — character page. */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};
  var h = SC.util.h, ui = SC.ui;

  function gallery(c) {
    var fig = h('figure', { class: 'gallery-main' });
    var cap = h('figcaption', { class: 'credit' });
    var thumbs = null;

    function show(i) {
      var im = c.images[i];
      SC.util.clear(fig);
      fig.appendChild(ui.portrait(c, { image: im || null, eager: true, w: 480, h: 600, cls: 'portrait-lg' }));
      SC.util.clear(cap);
      if (im) {
        if (im.caption) cap.appendChild(h('span', { class: 'credit-cap', text: im.caption }));
        cap.appendChild(h('span', { class: 'credit-artist', text: im.artist ? 'Art: ' + im.artist : 'Artist uncredited' }));
        var srcUrl = SC.util.safeUrl(im.source);
        if (srcUrl) {
          cap.appendChild(h('a', {
            class: 'credit-src', href: srcUrl, target: '_blank', rel: 'noopener noreferrer',
            text: 'Source'
          }));
        }
        fig.appendChild(cap);
      } else {
        fig.appendChild(h('figcaption', { class: 'credit', text: 'No portrait on record' }));
      }
      if (thumbs) {
        Array.prototype.forEach.call(thumbs.querySelectorAll('button'), function (b, j) {
          b.setAttribute('aria-pressed', j === i ? 'true' : 'false');
        });
      }
    }

    var kids = [fig];
    if (c.images.length > 1) {
      thumbs = h('div', { class: 'thumbs', role: 'group', 'aria-label': 'Portrait gallery' },
        c.images.map(function (im, i) {
          return h('button', {
            type: 'button', class: 'thumb', 'aria-label': 'Show portrait ' + (i + 1) + (im.artist ? ' by ' + im.artist : ''),
            onclick: function () { show(i); }
          }, ui.portrait(c, { image: im, alt: '', w: 64, h: 80 }));
        }));
      kids.push(thumbs);
    }
    show(0);
    return h('div', { class: 'gallery' }, kids);
  }

  function factsTable(model, c) {
    var rows = [];
    function row(k, v) { if (v) rows.push(h('tr', null, [h('th', { scope: 'row', text: k }), h('td', null, v)])); }
    row('Full name', c.fullName && c.fullName !== c.name ? c.fullName : null);
    row('Also known as', c.aliases.length ? c.aliases.join(', ') : null);
    row('Group', c.groups.length ? h('span', null, c.groups.map(function (g, i) {
      return [i ? ', ' : '', ui.groupLabel(model, g)];
    })) : null);
    row('Kind', c.kind ? ui.KIND_LABELS[c.kind] || c.kind : null);
    row('Nation', c.nation);
    row('Order', c.order ? h('a', { href: '#/orders', text: ui.orderName(model, c.order) }) : null);
    row('Status', c.status ? ui.STATUS_LABELS[c.status] || c.status : null);
    c.facts.forEach(function (f) { row(f.label, f.value); });
    row('First appears', c.firstAppearance || ui.bookTitle(c.firstBook));
    return h('table', { class: 'facts' }, [h('caption', { class: 'sr-only', text: 'Quick facts' }), h('tbody', null, rows)]);
  }

  function history(c) {
    if (!c.history.length) return null;
    var groups = SC.shield.ERA_ORDER.map(function (era) {
      var items = c.history.filter(function (x) { return x.era === era; });
      if (!items.length) return null;
      return h('section', { class: 'era era-' + era }, [
        h('h3', { class: 'era-title', text: ui.ERA_TITLES[era] }),
        h('ol', { class: 'hist' }, items.map(function (x) {
          return h('li', { class: 'hist-item' }, [
            x.title ? h('h4', { class: 'hist-title', text: x.title }) : null,
            h('p', { text: x.text })
          ]);
        }))
      ]);
    });
    return h('section', { class: 'char-section', 'aria-labelledby': 'hist-h' }, [
      h('h2', { id: 'hist-h', class: 'section-title', text: 'History' }), groups
    ]);
  }

  function relationships(model, c) {
    if (!c.relationships.length) return null;
    var byType = Object.create(null);
    c.relationships.forEach(function (r) { (byType[r.type] = byType[r.type] || []).push(r); });
    var blocks = ui.REL_ORDER.filter(function (t) { return byType[t]; }).map(function (t) {
      var list = byType[t].slice().sort(function (a, b) {
        return model.byId[a.id].importance - model.byId[b.id].importance;
      });
      return h('div', { class: 'rel-group' }, [
        h('h3', { class: 'rel-type rel-' + t, text: ui.REL_LABELS[t] || t }),
        h('ul', { class: 'chips' }, list.map(function (r) {
          return h('li', null, ui.chip(model.byId[r.id], r.label));
        }))
      ]);
    });
    return h('section', { class: 'char-section', 'aria-labelledby': 'rel-h' }, [
      h('h2', { id: 'rel-h', class: 'section-title', text: 'Bonds & relations' }), blocks
    ]);
  }

  function notes(title, list, id) {
    if (!list.length) return null;
    return h('section', { class: 'char-section notes', 'aria-labelledby': id }, [
      h('h2', { id: id, class: 'section-title', text: title }),
      list.map(function (x) { return h('p', { text: x.text }); })
    ]);
  }

  function navLinks(model, c) {
    var list = SC.codex.currentList(model);
    var idx = list.map(function (x) { return x.id; }).indexOf(c.id);
    if (idx < 0) { list = model.characters.slice().sort(SC.codex.SORTS.importance); idx = list.map(function (x) { return x.id; }).indexOf(c.id); }
    var prev = idx > 0 ? list[idx - 1] : null;
    var next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
    function link(x, rel, lbl) {
      if (!x) return h('span', { class: 'pager-' + rel + ' is-off', 'aria-hidden': 'true' });
      return h('a', { class: 'pager-' + rel, href: '#/c/' + encodeURIComponent(x.id), rel: rel }, [
        h('span', { class: 'pager-lbl', text: lbl }), h('span', { class: 'pager-name', text: x.name })
      ]);
    }
    return h('nav', { class: 'pager', 'aria-label': 'Previous and next entry' }, [
      link(prev, 'prev', 'Previous'),
      h('a', { class: 'pager-back', href: '#/characters', text: 'Back to the Codex' }),
      link(next, 'next', 'Next')
    ]);
  }

  function render(root, params, model) {
    var c = model.byId[params.id];
    if (!c) {
      root.appendChild(ui.pageHeader('No such entry', 'This entry does not exist, or lies beyond your reading progress.'));
      root.appendChild(h('p', null, h('a', { href: '#/characters', text: 'Return to the Codex' })));
      return;
    }
    document.title = c.name + ' — ' + ((model.meta && model.meta.title) || 'Stormlight Codex');
    var lead = c.lead ? h('p', { class: 'lead' + (c.leadIsHistory ? ' lead-hist' : ''), text: c.lead }) : null;

    root.appendChild(navLinks(model, c));
    root.appendChild(h('article', { class: 'char ' + ui.groupClass(c.group) }, [
      h('div', { class: 'char-side' }, [gallery(c), factsTable(model, c)]),
      h('div', { class: 'char-body' }, [
        h('header', { class: 'char-head' }, [
          h('p', { class: 'kicker', text: ui.groupLabel(model, c.group) }),
          h('h1', { class: 'char-name', tabindex: '-1', text: c.name }),
          c.epithet ? h('p', { class: 'epithet', text: c.epithet }) : null,
          h('div', { class: 'rule-orn', 'aria-hidden': 'true' })
        ]),
        lead,
        c.quotes.length ? h('div', { class: 'quotes' }, c.quotes.map(function (q) {
          return h('blockquote', { class: 'quote' }, h('p', { text: q.text }));
        })) : null,
        notes('Appearance', c.appearance, 'app-h'),
        notes('Character', c.personality, 'pers-h'),
        history(c),
        relationships(model, c),
        h('p', { class: 'first-app' }, [
          h('span', { class: 'kicker', text: 'First appears in ' }),
          c.firstAppearance || ui.bookTitle(c.firstBook)
        ])
      ])
    ]));
  }

  SC.views = SC.views || {};
  SC.views.character = render;
})();
