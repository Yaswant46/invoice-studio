/* numbering.js — per-profile, per-type document number generation.
 * Exposes `window.Numbering`.
 *
 * `nextNumber()` is PURE — it only previews what the next number would be.
 * `commitNumber()` (in Store) increments the counter and returns the consumed value.
 * Split intentionally so the editor can show a live-updating preview without
 * burning numbers every time the user toggles document type.
 */
(function (global) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  function nextNumber(profile, type) {
    if (!profile || !profile.counters || !profile.counters[type]) return '';
    var c = profile.counters[type];
    return c.prefix + '/' + c.year + '/' + pad2(c.next);
  }

  // Thin alias so callers can stay within the Numbering namespace.
  function commitNumber(profileId, type) {
    return global.Store.commitNumber(profileId, type);
  }

  // Detect whether a user-provided number string matches the auto-generated
  // one, so the save handler can decide whether to consume a counter slot.
  function isAutoNumber(profile, type, candidate) {
    return nextNumber(profile, type) === candidate;
  }

  global.Numbering = {
    nextNumber: nextNumber,
    commitNumber: commitNumber,
    isAutoNumber: isAutoNumber
  };
})(typeof window !== 'undefined' ? window : globalThis);
