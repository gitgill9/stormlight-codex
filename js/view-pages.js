/* Stormlight Codex — Chronicle (timeline), Orders of the Knights Radiant, Credits. */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};
  var h = SC.util.h, ui = SC.ui;

  function chipsFor(model, ids) {
    var cs = ids.map(function (id) { return model.byId[id]; }).filter(Boolean);
    if (!cs.length) return null;
    return h('ul', { class: 'chips chips-small' }, cs.map(function (c) { return h('li', null, ui.chip(c)); }));
  }

  function renderTimeline(root, params, model) {
    root.appendChild(ui.pageHeader('The Chronicle', 'Major events of the story, book by book, as far as your reading allows.', 'Annals'));
    if (!model.timeline.length) {
      root.appendChild(ui.emptyNote((window.CODEX.timeline || []).length
        ? 'No events are visible at your reading level.'
        : 'No timeline data yet. Add data/timeline.json and rebuild.'));
      return;
    }
    var books = SC.shield.BOOK_ORDER.filter(function (b) {
      return model.timeline.some(function (t) { return t.book === b; });
    });
    if (books.length > 1) {
      root.appendChild(h('nav', { class: 'jump', 'aria-label': 'Jump to book' },
        books.map(function (b) {
          return h('a', {
            href: '#/timeline', class: 'jump-link', text: ui.bookTitle(b),
            onclick: function (e) {
              e.preventDefault();
              var t = document.getElementById('tl-' + b);
              if (t) { t.scrollIntoView({ behavior: SC.util.reducedMotion() ? 'auto' : 'smooth' }); t.focus({ preventScroll: true }); }
            }
          });
        })));
    }
    books.forEach(function (b) {
      var items = model.timeline.filter(function (t) { return t.book === b; });
      root.appendChild(h('section', { class: 'tl-book bk-' + b, 'aria-labelledby': 'tl-' + b }, [
        h('h2', { id: 'tl-' + b, class: 'tl-book-title', tabindex: '-1', text: ui.bookTitle(b) }),
        h('ol', { class: 'tl' }, items.map(function (t) {
          return h('li', { class: 'tl-item' }, [
            h('div', { class: 'tl-mark', 'aria-hidden': 'true' }),
            h('div', { class: 'tl-body' }, [
              tlKicker(t),
              h('h3', { class: 'tl-title', text: t.title }),
              t.text ? h('p', { class: 'tl-text', text: t.text }) : null,
              chipsFor(model, t.characters)
            ])
          ]);
        }))
      ]));
    });
  }

  var ERA_TAGS = { ancient: 'Long ago', before: 'Before the story' };
  var KIND_TAGS = {
    revelation: 'Revelation', politics: 'Politics', death: 'Death', journey: 'Journey',
    oath: 'Oath', battle: 'Battle'
  };
  function tlKicker(t) {
    var bits = [];
    if (t.era && ERA_TAGS[t.era]) bits.push(ERA_TAGS[t.era]);
    if (t.when) bits.push(t.when);
    if (t.kind && KIND_TAGS[t.kind]) bits.push(KIND_TAGS[t.kind]);
    if (!bits.length) return null;
    return h('p', { class: 'tl-when' + (t.era === 'ancient' || t.era === 'before' ? ' tl-past' : '') }, bits.join(' \u00b7 '));
  }

  function renderOrders(root, params, model) {
    root.appendChild(ui.pageHeader('The Ten Orders', 'The Knights Radiant: their Heralds, Surges, spren and Ideals, as known so far.', 'Ars Arcanum'));
    if (!model.orders.length) {
      // Still list the ten names with any known members from character data.
      var ids = Object.keys(ui.ORDER_NAMES);
      root.appendChild(ui.emptyNote('Detailed order records have not been written yet (data/orders.json).'));
      root.appendChild(h('div', { class: 'orders' }, ids.map(function (id, i) {
        var members = model.characters.filter(function (c) { return c.order === id; });
        return orderCard(model, { id: id, name: ui.ORDER_NAMES[id], surges: [], ideals: [], members: members, memberNotes: {} }, i);
      })));
      return;
    }
    root.appendChild(h('div', { class: 'orders' }, model.orders.map(function (o, i) { return orderCard(model, o, i); })));
  }

  function orderCard(model, o, i) {
    var rows = [];
    function row(k, v) { if (v) rows.push(h('div', { class: 'ord-row' }, [h('dt', { text: k }), h('dd', null, v)])); }
    row('Herald', o.heraldId ? h('a', { href: '#/c/' + encodeURIComponent(o.heraldId), text: o.herald }) : o.herald);
    row('Surges', o.surges.length ? o.surges.join(' \u00b7 ') : null);
    row('Spren', o.spren);
    row('Attributes', o.attributes);
    row('Gemstone', o.gemstone);
    row('Essence', o.essence);
    var notes = o.memberNotes || {};
    return h('section', { class: 'order ord-' + o.id, 'aria-labelledby': 'ord-' + o.id }, [
      h('p', { class: 'ord-no', 'aria-hidden': 'true', text: SC.util.roman(i + 1) }),
      h('h2', { id: 'ord-' + o.id, class: 'ord-name', text: o.name }),
      o.summary ? h('p', { class: 'ord-summary', text: o.summary }) : null,
      rows.length ? h('dl', { class: 'ord-facts' }, rows) : null,
      o.ideals.length ? h('div', { class: 'ord-ideals' }, [
        h('h3', { class: 'ord-sub', text: 'Ideals known' }),
        h('ol', null, o.ideals.map(function (d) {
          return h('li', { value: d.n || undefined }, [
            h('q', { text: d.text }),
            d.note ? h('span', { class: 'ord-note', text: d.note }) : null
          ]);
        }))
      ]) : null,
      h('div', { class: 'ord-members' }, [
        h('h3', { class: 'ord-sub', text: 'Known members' }),
        o.members.length
          ? h('ul', { class: 'chips chips-small' }, o.members.slice().sort(function (a, b) {
            return a.importance - b.importance || a.name.localeCompare(b.name);
          }).map(function (c) { return h('li', null, ui.chip(c, notes[c.id] || null)); }))
          : h('p', { class: 'muted', text: 'None recorded in the Codex.' })
      ])
    ]);
  }

  function renderCredits(root, params, model) {
    var meta = model.meta || {};
    root.appendChild(ui.pageHeader('Credits', 'Artists, sources and the rules this codex keeps.', 'Colophon'));
    var rows = [];
    model.characters.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) {
      c.images.forEach(function (im) {
        rows.push(h('tr', null, [
          h('td', { class: 'cr-thumb' }, ui.portrait(c, { image: im, alt: '', w: 48, h: 60 })),
          h('td', null, h('a', { href: '#/c/' + encodeURIComponent(c.id), text: c.name })),
          h('td', null, [im.artist || 'Uncredited', im.caption ? h('span', { class: 'muted cr-cap', text: im.caption }) : null]),
          h('td', null, SC.util.safeUrl(im.source) ? h('a', { href: SC.util.safeUrl(im.source), target: '_blank', rel: 'noopener noreferrer', text: sourceLabel(im.source) }) : '\u2014'),
          h('td', { class: 'muted', text: im.licence || 'Fan art, used with credit for personal, non-commercial reference; rights remain with the artist.' })
        ]));
      });
    });
    root.appendChild(h('section', { class: 'credits-section', 'aria-labelledby': 'cr-img' }, [
      h('h2', { id: 'cr-img', class: 'section-title', text: 'Portraits' }),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'credits' }, [
        h('thead', null, h('tr', null, ['', 'Character', 'Artist', 'Source', 'Licence'].map(function (t) {
          return h('th', { scope: 'col', text: t });
        }))),
        h('tbody', null, rows)
      ])) : ui.emptyNote('No portraits are visible at your reading level.'),
      model.hiddenImages ? h('p', { class: 'muted', text: model.hiddenImages + ' further portrait' +
        (model.hiddenImages === 1 ? ' is' : 's are') + ' hidden by your reading-progress shield; raise it to see their credits.' }) : null
    ]));
    root.appendChild(h('section', { class: 'credits-section prose', 'aria-labelledby': 'cr-text' }, [
      h('h2', { id: 'cr-text', class: 'section-title', text: 'Text & sources' }),
      h('p', { text: meta.textNote || 'The Stormlight Archive and its characters are the work of Brandon Sanderson and Dragonsteel. ' +
        'Character records here are original summaries written for personal reference, informed by snapshots of the Coppermind ' +
        'fan wiki (coppermind.net, CC BY-NC-SA) captured before the fourth book was published. This is an unofficial fan project.' }),
      h('p', { text: 'Typefaces: IM Fell English by Igino Marini and Alegreya by Huerta Tipogr\u00e1fica, both under the SIL Open Font License.' })
    ]));
    root.appendChild(h('section', { class: 'credits-section prose', 'aria-labelledby': 'cr-policy' }, [
      h('h2', { id: 'cr-policy', class: 'section-title', text: 'Spoiler policy' }),
      h('p', { text: 'Everything in this codex is limited to what is revealed by the last page of Oathbringer (Book 3), plus the novella Edgedancer behind its own toggle. ' +
        'Nothing from later books, preview chapters, author Q&As, annotations or other series is included.' }),
      h('p', { text: 'Characters are described as they stand at the end of Oathbringer. Every fact, history entry, relationship, quotation, portrait and event is tagged with the book in which a reader learns it, ' +
        'and the reading-progress shield in the header hides anything beyond the book you have chosen. Below Book 3, the Oathbringer-level summary and epithet are hidden too.' })
    ]));
  }

  function sourceLabel(url) {
    var m = /^https?:\/\/([^/]+)/.exec(url);
    return m ? m[1].replace(/^www\./, '') : 'link';
  }

  SC.views = SC.views || {};
  SC.views.timeline = renderTimeline;
  SC.views.orders = renderOrders;
  SC.views.credits = renderCredits;
})();
