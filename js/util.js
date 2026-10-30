/* Stormlight Codex — DOM utilities.
 * Never uses innerHTML: every node is built with createElement / textContent. */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};
  var SVGNS = 'http://www.w3.org/2000/svg';

  function append(el, kids) {
    if (kids === null || kids === undefined || kids === false) return;
    if (Array.isArray(kids)) { kids.forEach(function (k) { append(el, k); }); return; }
    if (typeof kids === 'string' || typeof kids === 'number') {
      el.appendChild(document.createTextNode(String(kids)));
      return;
    }
    el.appendChild(kids);
  }

  function setProps(el, props, isSvg) {
    if (!props) return;
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') {
        if (isSvg) el.setAttribute('class', v); else el.className = v;
      } else if (k === 'text') {
        el.textContent = v;
      } else if (k === 'css') {
        Object.keys(v).forEach(function (p) {
          if (p.indexOf('--') === 0) el.style.setProperty(p, v[p]);
          else el.style[p] = v[p];
        });
      } else if (k === 'dataset') {
        Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      } else if (k.indexOf('on') === 0 && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v === true) {
        el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    });
  }

  /** h('div', {class:'x', onclick: fn}, [children]) */
  function h(tag, props, kids) {
    var el = document.createElement(tag);
    setProps(el, props, false);
    append(el, kids);
    return el;
  }

  function svg(tag, props, kids) {
    var el = document.createElementNS(SVGNS, tag);
    setProps(el, props, true);
    append(el, kids);
    return el;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function hash(str) {
    var x = 2166136261;
    for (var i = 0; i < str.length; i++) {
      x ^= str.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return x >>> 0;
  }

  function roman(n) {
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var out = '';
    map.forEach(function (p) { while (n >= p[0]) { out += p[1]; n -= p[0]; } });
    return out;
  }

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  var store = {
    get: function (k, dflt) {
      try {
        var v = window.localStorage.getItem(k);
        return v === null ? dflt : JSON.parse(v);
      } catch (e) { return dflt; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ }
    },
    sget: function (k, dflt) {
      try {
        var v = window.sessionStorage.getItem(k);
        return v === null ? dflt : JSON.parse(v);
      } catch (e) { return dflt; }
    },
    sset: function (k, v) {
      try { window.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };

  /* Defence in depth for external links: only absolute http(s) URLs pass
   * (build_data.py already filters, but codex-data.js can be hand-edited). */
  function safeUrl(u) {
    if (typeof u !== 'string') return null;
    try {
      var p = new URL(u);
      return (p.protocol === 'https:' || p.protocol === 'http:') ? p.href : null;
    } catch (e) { return null; }
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  SC.util = { h: h, svg: svg, clear: clear, append: append, hash: hash, roman: roman,
    norm: norm, store: store, safeUrl: safeUrl, reducedMotion: prefersReducedMotion };
})();
