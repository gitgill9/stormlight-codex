/* Starts the app once every script has loaded. */
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.SC.start);
  else window.SC.start();
})();
