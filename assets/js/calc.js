/* calc.js — pure functions for totals, currency formatting, and INR words.
 * Used by editor.js (live totals) and render.js (final document totals).
 * Exposes `window.Calc`.
 *
 * Kept separate from editor.js because render.js needs the same math without
 * pulling in editor UI code.
 */
(function (global) {
  'use strict';

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function lineSubtotal(item) {
    var q = Number(item && item.qty) || 0;
    var p = Number(item && item.unitPrice) || 0;
    return q * p;
  }

  function lineGstAmount(item) {
    var pct = Number(item && item.gstPercent) || 0;
    return lineSubtotal(item) * (pct / 100);
  }

  // taxMode: 'none' | 'intra' | 'inter'
  function computeTotals(items, taxMode) {
    items = items || [];
    var subtotal = 0, totalGst = 0;
    for (var i = 0; i < items.length; i++) {
      subtotal += lineSubtotal(items[i]);
      totalGst += lineGstAmount(items[i]);
    }
    var cgst = 0, sgst = 0, igst = 0;
    if (taxMode === 'intra') {
      cgst = totalGst / 2;
      sgst = totalGst / 2;
    } else if (taxMode === 'inter') {
      igst = totalGst;
    } else {
      // 'none' — ignore line GST entirely
      totalGst = 0;
    }
    var grandTotal = subtotal + cgst + sgst + igst;
    return {
      subtotal: round2(subtotal),
      totalGst: round2(totalGst),
      cgst: round2(cgst),
      sgst: round2(sgst),
      igst: round2(igst),
      grandTotal: round2(grandTotal)
    };
  }

  // True if at least one line has a non-zero GST %.
  function hasAnyGst(items) {
    if (!items) return false;
    for (var i = 0; i < items.length; i++) {
      if ((Number(items[i].gstPercent) || 0) > 0) return true;
    }
    return false;
  }

  // ---------- Currency formatting (INR, en-IN grouping) ----------
  function formatINR(amount, opts) {
    opts = opts || {};
    var n = Number(amount) || 0;
    var fractionDigits = opts.fractionDigits != null ? opts.fractionDigits : 2;
    var withSymbol = opts.withSymbol !== false;
    var str = n.toLocaleString('en-IN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    });
    return withSymbol ? '\u20B9' + str : str;
  }

  // ---------- Number to words (Indian system) ----------
  var ONES = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigitWords(n) {
    if (n < 20) return ONES[n];
    var t = Math.floor(n / 10), o = n % 10;
    return TENS[t] + (o ? ' ' + ONES[o] : '');
  }

  // Indian grouping: ... Crore Lakh Thousand Hundred (tens/ones)
  function intToIndianWords(n) {
    if (n === 0) return 'Zero';
    var crore = Math.floor(n / 10000000); n = n - crore * 10000000;
    var lakh = Math.floor(n / 100000);    n = n - lakh * 100000;
    var thousand = Math.floor(n / 1000);  n = n - thousand * 1000;
    var hundred = Math.floor(n / 100);    var lastTwo = n - hundred * 100;

    var parts = [];
    if (crore > 0) {
      // Recurse for crore >= 100 (i.e. arab+ ranges) so we still say "One Hundred Crore" etc.
      parts.push((crore > 99 ? intToIndianWords(crore) : twoDigitWords(crore)) + ' Crore');
    }
    if (lakh > 0) parts.push(twoDigitWords(lakh) + ' Lakh');
    if (thousand > 0) parts.push(twoDigitWords(thousand) + ' Thousand');
    if (hundred > 0) parts.push(ONES[hundred] + ' Hundred');
    if (lastTwo > 0) {
      parts.push((parts.length > 0 ? 'and ' : '') + twoDigitWords(lastTwo));
    }
    return parts.join(' ');
  }

  function numberToWordsINR(amount) {
    if (typeof amount !== 'number' || !isFinite(amount)) return '';
    var negative = amount < 0;
    var abs = Math.abs(amount);
    var rupees = Math.floor(abs);
    var paise = Math.round((abs - rupees) * 100);
    if (paise === 100) { rupees += 1; paise = 0; }

    var out = 'Rupees ' + (rupees === 0 ? 'Zero' : intToIndianWords(rupees));
    if (paise > 0) out += ' and ' + intToIndianWords(paise) + ' Paise';
    out += ' Only';
    if (negative) out = 'Negative ' + out;
    return out;
  }

  global.Calc = {
    round2: round2,
    lineSubtotal: lineSubtotal,
    lineGstAmount: lineGstAmount,
    computeTotals: computeTotals,
    hasAnyGst: hasAnyGst,
    formatINR: formatINR,
    numberToWordsINR: numberToWordsINR,
    // exported for testing
    _intToIndianWords: intToIndianWords
  };
})(typeof window !== 'undefined' ? window : globalThis);
