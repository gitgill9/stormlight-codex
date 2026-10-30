/* Runs in <head> before first paint: apply the saved theme (no flash). */
(function () {
  'use strict';
  var t = 'dark';
  try {
    var v = JSON.parse(window.localStorage.getItem('sc.theme'));
    if (v === 'light' || v === 'dark') t = v;
  } catch (e) { /* default */ }
  document.documentElement.dataset.theme = t;
})();
