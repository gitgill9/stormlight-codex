/* Stormlight Codex — relationship web.
 * Own small force layout (repulsion, springs, collision, group anchors),
 * SVG rendering, pan / zoom / pinch, node drag, neighbour highlight.
 * Nodes are SVG <a> links: Tab focuses, Enter opens the character. */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};
  var h = SC.util.h, svg = SC.util.svg, ui = SC.ui;

  var RADIUS = { 1: 26, 2: 20, 3: 15, 4: 11 };
  var FKEY = 'sc.webFilters';

  function render(root, params, model) {
    var saved = SC.util.store.sget(FKEY, {});
    var groupIds = model.groups.map(function (g) { return g.id; }).filter(function (id) {
      return model.characters.some(function (c) { return c.group === id; });
    });
    if (model.characters.some(function (c) { return groupIds.indexOf(c.group) < 0; })) groupIds.push('_other');
    var typeIds = ui.REL_ORDER.filter(function (t) { return model.edges.some(function (e) { return e.type === t; }); });
    // Storage is untrusted: rebuild as prototype-free maps of booleans.
    function boolMap(o) {
      var m = Object.create(null);
      if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { if (o[k] === true) m[k] = true; });
      return m;
    }
    var offGroups = boolMap(saved && saved.offGroups);
    var offTypes = boolMap(saved && saved.offTypes);
    function persist() { SC.util.store.sset(FKEY, { offGroups: offGroups, offTypes: offTypes }); }
    function groupOf(c) { return groupIds.indexOf(c.group) >= 0 ? c.group : '_other'; }

    root.appendChild(ui.pageHeader('The Web of Bonds', 'Every known tie between the figures of the Codex. ' +
      'Drag to pan, scroll or pinch to zoom, hover to trace a figure\u2019s bonds, select to open.', 'A map of relations'));

    if (!model.characters.length) {
      root.appendChild(ui.emptyNote('No characters are visible at your reading level yet.'));
      return null;
    }

    // ---------- toolbar ----------
    var groupBar = h('div', { class: 'toggles', role: 'group', 'aria-label': 'Show groups' },
      groupIds.map(function (g) {
        var b = h('button', {
          type: 'button', class: 'toggle ' + ui.groupClass(g === '_other' ? null : g),
          'aria-pressed': offGroups[g] ? 'false' : 'true'
        }, [h('span', { class: 'swatch', 'aria-hidden': 'true' }), g === '_other' ? 'Other' : ui.groupLabel(model, g, true)]);
        b.addEventListener('click', function () {
          offGroups[g] = !offGroups[g];
          b.setAttribute('aria-pressed', offGroups[g] ? 'false' : 'true');
          persist(); applyFilters(true);
        });
        return b;
      }));
    var typeBar = h('div', { class: 'toggles legend', role: 'group', 'aria-label': 'Show relationship types' },
      typeIds.map(function (t) {
        var b = h('button', { type: 'button', class: 'toggle e-' + t, 'aria-pressed': offTypes[t] ? 'false' : 'true' }, [
          svg('svg', { class: 'edge-swatch', viewBox: '0 0 28 8', 'aria-hidden': 'true', focusable: 'false' },
            svg('line', { class: 'edge e-' + t, x1: 1, y1: 4, x2: 27, y2: 4 })),
          ui.REL_LABELS[t] || t
        ]);
        b.addEventListener('click', function () {
          offTypes[t] = !offTypes[t];
          b.setAttribute('aria-pressed', offTypes[t] ? 'false' : 'true');
          persist(); applyFilters(false);
        });
        return b;
      }));
    var zoomIn = h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Zoom in', text: '+' });
    var zoomOut = h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Zoom out', text: '\u2212' });
    var zoomFit = h('button', { type: 'button', class: 'btn-quiet', text: 'Fit' });
    var info = h('p', { class: 'web-info', 'aria-live': 'polite' });

    root.appendChild(h('div', { class: 'web-tools' }, [
      h('div', { class: 'web-tools-row' }, [h('span', { class: 'tools-lbl', text: 'Groups' }), groupBar]),
      h('div', { class: 'web-tools-row' }, [h('span', { class: 'tools-lbl', text: 'Ties' }), typeBar]),
      h('div', { class: 'web-tools-row web-zoom' }, [zoomOut, zoomIn, zoomFit, info])
    ]));

    // ---------- svg scaffold ----------
    var stage = h('div', { class: 'web-stage' });
    var W = 900, H = 640;
    var root$ = svg('svg', {
      class: 'web', role: 'group', tabindex: '0', 'aria-label': 'Relationship graph. Use Tab to move between figures, plus and minus to zoom, arrow keys to pan.',
      viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet'
    });
    var defs = svg('defs');
    Object.keys(RADIUS).forEach(function (k) {
      defs.appendChild(svg('clipPath', { id: 'clip-r' + k }, svg('circle', { cx: 0, cy: 0, r: RADIUS[k] - 1.5 })));
    });
    root$.appendChild(defs);
    var bg = svg('rect', { class: 'web-bg', x: -50000, y: -50000, width: 100000, height: 100000 });
    var world = svg('g', { class: 'world' });
    var gEdges = svg('g', { class: 'edges' });
    var gNodes = svg('g', { class: 'nodes' });
    world.appendChild(bg);
    world.appendChild(gEdges);
    world.appendChild(gNodes);
    root$.appendChild(world);
    stage.appendChild(root$);
    root.appendChild(stage);
    root.appendChild(h('p', { class: 'hint web-hint', text: 'Labels for minor figures appear as you zoom in.' }));

    // ---------- data ----------
    var nodes = model.characters.map(function (c) {
      var seed = SC.util.hash(c.id);
      return {
        id: c.id, c: c, r: RADIUS[c.importance] || 11, x: 0, y: 0, vx: 0, vy: 0,
        jx: ((seed & 1023) / 1023 - 0.5), jy: (((seed >>> 10) & 1023) / 1023 - 0.5),
        fixed: false, el: null, on: true, nbr: Object.create(null), edges: []
      };
    });
    var nodeById = Object.create(null);
    nodes.forEach(function (n) { nodeById[n.id] = n; });
    var links = model.edges.map(function (e) {
      var l = { s: nodeById[e.a], t: nodeById[e.b], type: e.type, e: e, el: null, on: true };
      l.s.nbr[l.t.id] = 1; l.t.nbr[l.s.id] = 1;
      l.s.edges.push(l); l.t.edges.push(l);
      return l;
    });

    var anchors = Object.create(null);
    function placeAnchors() {
      var R = Math.min(W, H) * 0.34;
      groupIds.forEach(function (g, i) {
        var a = (i / groupIds.length) * Math.PI * 2 - Math.PI / 2;
        anchors[g] = { x: W / 2 + Math.cos(a) * R, y: H / 2 + Math.sin(a) * R };
      });
    }
    placeAnchors();
    nodes.forEach(function (n) {
      var a = anchors[groupOf(n.c)];
      n.x = a.x + n.jx * 120; n.y = a.y + n.jy * 120;
    });

    // ---------- build elements ----------
    links.forEach(function (l) {
      var labels = l.e.sides.map(function (s) { return s.label; }).filter(Boolean).join(' / ');
      l.el = svg('line', { class: 'edge e-' + l.type }, svg('title', null, l.s.c.name + ' \u2014 ' + l.t.c.name + (labels ? ': ' + labels : '')));
      gEdges.appendChild(l.el);
    });
    nodes.forEach(function (n) {
      var c = n.c;
      var a = svg('a', {
        class: 'node imp-' + c.importance + ' ' + ui.groupClass(c.group), href: '#/c/' + encodeURIComponent(c.id),
        'aria-label': c.name + ', ' + ui.groupLabel(model, c.group, true) + ', ' + Object.keys(n.nbr).length + ' ties'
      });
      a.appendChild(svg('circle', { class: 'node-ring', r: n.r + 2.5 }));
      a.appendChild(svg('circle', { class: 'node-bg', r: n.r }));
      var initials = svg('text', { class: 'node-init', y: n.r * 0.36, 'text-anchor': 'middle', 'font-size': Math.round(n.r * 0.9) }, ui.initials(c.name));
      var im = c.images[0];
      if (im) {
        var img = svg('image', {
          href: im.file, x: -n.r, y: -n.r, width: n.r * 2, height: n.r * 2.5,
          preserveAspectRatio: 'xMidYMin slice', 'clip-path': 'url(#clip-r' + c.importance + ')'
        });
        img.addEventListener('error', function () { if (img.parentNode) img.parentNode.replaceChild(initials, img); });
        a.appendChild(img);
      } else {
        a.appendChild(initials);
      }
      a.appendChild(svg('text', { class: 'node-label', y: n.r + 14, 'text-anchor': 'middle' }, c.name));
      n.el = a;
      gNodes.appendChild(a);
      bindNode(n);
    });

    // ---------- simulation ----------
    var alpha = 1, raf = 0, active = nodes, activeLinks = links;
    var strength = 1400 + nodes.length * 12, linkLen = 70 + Math.min(50, nodes.length / 3);
    var userMoved = false; // stop auto-fitting once the reader pans or zooms

    function tick() {
      var i, j, a, b, dx, dy, d2, d, f;
      var N = active.length;
      for (i = 0; i < N; i++) {
        a = active[i];
        for (j = i + 1; j < N; j++) {
          b = active[j];
          dx = b.x - a.x; dy = b.y - a.y;
          d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = a.jx - b.jx || 0.5; dy = a.jy - b.jy || 0.5; d2 = 1; }
          if (d2 > 250000) continue;
          d = Math.sqrt(d2);
          f = (strength * alpha) / d2;
          var min = a.r + b.r + 10;
          if (d < min) f += ((min - d) / d) * 0.5;
          dx *= f; dy *= f;
          a.vx -= dx; a.vy -= dy; b.vx += dx; b.vy += dy;
        }
      }
      for (i = 0; i < activeLinks.length; i++) {
        var l = activeLinks[i];
        dx = l.t.x - l.s.x; dy = l.t.y - l.s.y;
        d = Math.sqrt(dx * dx + dy * dy) || 1;
        var L = linkLen + l.s.r + l.t.r;
        f = ((d - L) / d) * 0.06 * alpha;
        dx *= f; dy *= f;
        l.s.vx += dx; l.s.vy += dy; l.t.vx -= dx; l.t.vy -= dy;
      }
      for (i = 0; i < N; i++) {
        a = active[i];
        var an = anchors[groupOf(a.c)];
        a.vx += (an.x - a.x) * 0.012 * alpha + (W / 2 - a.x) * 0.002 * alpha;
        a.vy += (an.y - a.y) * 0.012 * alpha + (H / 2 - a.y) * 0.002 * alpha;
        if (a.fixed) { a.vx = 0; a.vy = 0; continue; }
        a.vx *= 0.6; a.vy *= 0.6;
        a.x += a.vx; a.y += a.vy;
      }
      alpha *= 0.985;
    }

    function draw() {
      for (var i = 0; i < links.length; i++) {
        var l = links[i];
        if (!l.on) continue;
        l.el.setAttribute('x1', l.s.x.toFixed(1)); l.el.setAttribute('y1', l.s.y.toFixed(1));
        l.el.setAttribute('x2', l.t.x.toFixed(1)); l.el.setAttribute('y2', l.t.y.toFixed(1));
      }
      for (var k = 0; k < nodes.length; k++) {
        var n = nodes[k];
        if (n.on) n.el.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ' ' + n.y.toFixed(1) + ')');
      }
    }

    var fitAfter = true;
    function loop() {
      raf = 0;
      tick(); tick();
      draw();
      if (fitAfter && !userMoved) fit(false);
      if (alpha > 0.02) raf = requestAnimationFrame(loop);
      else fitAfter = false;
    }
    function heat(a, refit) {
      alpha = Math.max(alpha, a);
      if (refit) fitAfter = true;
      if (SC.util.reducedMotion()) {
        while (alpha > 0.02) tick();
        draw();
        if (fitAfter) { fitAfter = false; fit(false); }
        return;
      }
      if (refit) userMoved = false;
      if (!raf) raf = requestAnimationFrame(loop);
    }

    // ---------- filters ----------
    function applyFilters(groupsChanged) {
      nodes.forEach(function (n) { n.on = !offGroups[groupOf(n.c)]; n.el.classList.toggle('is-off', !n.on); });
      links.forEach(function (l) {
        l.on = l.s.on && l.t.on && !offTypes[l.type];
        l.el.classList.toggle('is-off', !l.on);
      });
      active = nodes.filter(function (n) { return n.on; });
      activeLinks = links.filter(function (l) { return l.on; });
      info.textContent = active.length + ' figures, ' + activeLinks.length + ' ties shown';
      if (groupsChanged) heat(0.5, true); else draw();
    }

    // ---------- view transform ----------
    var view = { k: 1, x: 0, y: 0 };
    function applyView() {
      world.setAttribute('transform', 'translate(' + view.x.toFixed(1) + ' ' + view.y.toFixed(1) + ') scale(' + view.k.toFixed(4) + ')');
      root$.classList.toggle('zoomed', view.k > 1.35);
    }
    function zoomAt(px, py, factor) {
      userMoved = true;
      var k = Math.max(0.2, Math.min(5, view.k * factor));
      factor = k / view.k;
      view.x = px - (px - view.x) * factor;
      view.y = py - (py - view.y) * factor;
      view.k = k;
      applyView();
    }
    function fit(animate) {
      var vis = active.length ? active : nodes;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      vis.forEach(function (n) {
        x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r);
        x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r + 18);
      });
      if (!isFinite(x0)) return;
      var pad = 30;
      var k = Math.min((W - pad * 2) / Math.max(1, x1 - x0), (H - pad * 2) / Math.max(1, y1 - y0), 2.2);
      var target = { k: k, x: W / 2 - ((x0 + x1) / 2) * k, y: H / 2 - ((y0 + y1) / 2) * k };
      if (!animate || SC.util.reducedMotion()) { view = target; applyView(); return; }
      var from = { k: view.k, x: view.x, y: view.y }, t0 = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - t0) / 450), e = 1 - Math.pow(1 - t, 3);
        view = { k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
        applyView();
        if (t < 1) raf2 = requestAnimationFrame(step);
      })(t0);
    }
    var raf2 = 0;

    function toLocal(evt) {
      var r = root$.getBoundingClientRect();
      // viewBox matches stage pixels (see resize) so this is a plain offset
      return { x: (evt.clientX - r.left) * (W / r.width), y: (evt.clientY - r.top) * (H / r.height) };
    }

    root$.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = toLocal(e);
      zoomAt(p.x, p.y, Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 30 : 1)));
    }, { passive: false });

    // pointers: background pan, two-finger pinch, node drag
    var pointers = Object.create(null), pan = null, pinch = null, drag = null;
    root$.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      var p = toLocal(e);
      pointers[e.pointerId] = p;
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k };
        pan = null; drag = null;
        return;
      }
      var nodeEl = e.target.closest ? e.target.closest('.node') : null;
      if (nodeEl) {
        var n = nodes.filter(function (x) { return x.el === nodeEl; })[0];
        drag = { n: n, sx: p.x, sy: p.y, moved: false, id: e.pointerId };
      } else {
        pan = { sx: p.x, sy: p.y, vx: view.x, vy: view.y };
      }
      try { root$.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    root$.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      var p = toLocal(e);
      pointers[e.pointerId] = p;
      if (pinch) {
        var ids = Object.keys(pointers);
        if (ids.length < 2) return;
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * d / pinch.d) / view.k);
      } else if (drag) {
        if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 4) return;
        drag.moved = true;
        drag.n.fixed = true;
        drag.n.x = (p.x - view.x) / view.k;
        drag.n.y = (p.y - view.y) / view.k;
        root$.classList.add('dragging');
        userMoved = true;
        heat(0.15);
        draw();
      } else if (pan) {
        view.x = pan.vx + (p.x - pan.sx);
        view.y = pan.vy + (p.y - pan.sy);
        userMoved = true;
        applyView();
      }
    });
    function endPointer(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (drag && drag.id === e.pointerId) {
        if (drag.moved) { drag.n.fixed = false; suppressClick = true; setTimeout(function () { suppressClick = false; }, 50); }
        drag = null;
        root$.classList.remove('dragging');
      }
      pan = null;
    }
    var suppressClick = false;
    root$.addEventListener('dragstart', function (e) { e.preventDefault(); });
    root$.addEventListener('pointerup', endPointer);
    root$.addEventListener('pointercancel', endPointer);
    root$.addEventListener('click', function (e) { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);

    root$.addEventListener('keydown', function (e) {
      var step = 40;
      if (e.key === '+' || e.key === '=') zoomAt(W / 2, H / 2, 1.25);
      else if (e.key === '-' || e.key === '_') zoomAt(W / 2, H / 2, 0.8);
      else if (e.key === 'ArrowLeft') { view.x += step; userMoved = true; applyView(); }
      else if (e.key === 'ArrowRight') { view.x -= step; userMoved = true; applyView(); }
      else if (e.key === 'ArrowUp') { view.y += step; userMoved = true; applyView(); }
      else if (e.key === 'ArrowDown') { view.y -= step; userMoved = true; applyView(); }
      else if (e.key === '0') fit(true);
      else return;
      e.preventDefault();
    });
    zoomIn.addEventListener('click', function () { zoomAt(W / 2, H / 2, 1.3); });
    zoomOut.addEventListener('click', function () { zoomAt(W / 2, H / 2, 1 / 1.3); });
    zoomFit.addEventListener('click', function () { fit(true); });

    // ---------- highlight ----------
    function highlight(n) {
      root$.classList.toggle('tracing', !!n);
      nodes.forEach(function (m) { m.el.classList.toggle('hl', !!n && (m === n || !!n.nbr[m.id])); });
      links.forEach(function (l) { l.el.classList.toggle('hl', !!n && (l.s === n || l.t === n)); });
      if (n) {
        var ties = n.edges.filter(function (l) { return l.on; }).length;
        info.textContent = n.c.name + ': ' + ties + (ties === 1 ? ' tie' : ' ties');
      } else {
        info.textContent = active.length + ' figures, ' + activeLinks.length + ' ties shown';
      }
    }
    function bindNode(n) {
      n.el.addEventListener('pointerenter', function () { if (!drag) highlight(n); });
      n.el.addEventListener('pointerleave', function () { if (!drag) highlight(null); });
      n.el.addEventListener('focus', function () { highlight(n); });
      n.el.addEventListener('blur', function () { highlight(null); });
    }

    // ---------- sizing ----------
    function resize() {
      var r = stage.getBoundingClientRect();
      if (r.width < 10) return;
      var nw = Math.round(r.width), nh = Math.round(Math.max(360, Math.min(window.innerHeight * 0.72, r.width * 0.8)));
      if (nw === W && nh === H) return;
      var first = W === 900 && H === 640;
      W = nw; H = nh;
      root$.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      root$.style.height = H + 'px';
      placeAnchors();
      if (first) {
        nodes.forEach(function (n) { var a = anchors[groupOf(n.c)]; n.x = a.x + n.jx * 120; n.y = a.y + n.jy * 120; });
      } else { fit(false); }
    }
    resize();
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(stage);

    applyView();
    applyFilters(false);
    heat(1, true);

    return function cleanup() {
      if (raf) cancelAnimationFrame(raf);
      if (raf2) cancelAnimationFrame(raf2);
      if (ro) ro.disconnect();
    };
  }

  SC.views = SC.views || {};
  SC.views.web = render;
})();
