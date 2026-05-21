/* theme.js — applies the saved theme to <body data-theme="..."> on every page.
 * Loaded early (in <head>) on each HTML page so there's no color flash.
 * Exposes `window.Theme`.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'invoice_tool_theme_v1';

  var PRESETS = [
    { id: 'navy',     name: 'Navy (default)', swatch: '#0d3b66' },
    { id: 'forest',   name: 'Forest',         swatch: '#14532d' },
    { id: 'burgundy', name: 'Burgundy',       swatch: '#7c2d4c' },
    { id: 'charcoal', name: 'Charcoal',       swatch: '#1f2937' },
    { id: 'plum',     name: 'Plum',           swatch: '#581c87' },
    { id: 'teal',     name: 'Teal',           swatch: '#0f766e' }
  ];

  function get() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v && PRESETS.some(function (p) { return p.id === v; })) return v;
    } catch (e) {}
    return 'navy';
  }

  function set(themeId) {
    if (!PRESETS.some(function (p) { return p.id === themeId; })) return;
    try { localStorage.setItem(STORAGE_KEY, themeId); } catch (e) {}
    apply(themeId);
  }

  function apply(themeId) {
    var id = themeId || get();
    // Set on <html> (not body) so CSS variables on :root inherit the override
    // properly through the cascade. Setting on body would leave variables
    // already computed at :root frozen at their default values.
    document.documentElement.setAttribute('data-theme', id);
  }

  // Auto-apply immediately.
  apply();

  global.Theme = {
    PRESETS: PRESETS,
    get: get,
    set: set,
    apply: apply
  };
})(typeof window !== 'undefined' ? window : globalThis);
