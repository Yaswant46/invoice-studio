/* pdf.js — html2pdf.js wrapper for invoice export.
 * Exposes `window.PDF`.
 *
 * Enforces single-A4-page output by:
 *  1) Asking html2pdf to avoid page breaks (`pagebreak.mode: ['avoid-all']`).
 *  2) If the rendered content is still taller than A4, applying a temporary
 *     CSS scale-transform to fit-to-page before capture, then restoring.
 */
(function (global) {
  'use strict';

  function sanitize(s) {
    return String(s || '')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function clientShortName(client) {
    if (!client || !client.companyName) return 'Client';
    var w = client.companyName.split(/\s+/)[0];
    return sanitize(w);
  }

  function buildFilename(doc, client) {
    var num = sanitize(doc.number || 'document').replace(/\//g, '_');
    var short = clientShortName(client);
    return num + '_' + short + '.pdf';
  }

  // mm per px: A4 portrait is 210mm wide. The captured .invoice element is
  // exactly 210mm because we use mm units. So mm/px = 210 / target.clientWidth.
  function mmPerPx(targetEl) {
    return 210 / targetEl.clientWidth;
  }

  function fitToA4(targetEl) {
    var perMm = mmPerPx(targetEl);
    var heightMm = targetEl.scrollHeight * perMm;
    // 297mm is full A4 height. Leave a small safety margin.
    var maxMm = 296;
    if (heightMm <= maxMm) return function () {};

    var scale = maxMm / heightMm;
    // Cap how aggressively we scale; below ~0.85 the content looks visibly
    // squashed. If we hit the cap, html2pdf will still flow onto page 2
    // (acceptable fallback for very-long invoices).
    if (scale < 0.85) scale = 0.85;

    var prevTransform = targetEl.style.transform;
    var prevOrigin    = targetEl.style.transformOrigin;
    var prevWidth     = targetEl.style.width;
    targetEl.style.transformOrigin = 'top left';
    targetEl.style.transform = 'scale(' + scale + ')';
    // Compensate width so html2canvas captures full breadth (the unscaled
    // width is 210mm; scaled width visually is 210*scale, but canvas needs
    // the actual element box at full width). Setting width keeps layout stable.

    return function restore() {
      targetEl.style.transform = prevTransform;
      targetEl.style.transformOrigin = prevOrigin;
      targetEl.style.width = prevWidth;
    };
  }

  function exportDocument(docId) {
    if (!global.html2pdf) {
      return Promise.reject(new Error('html2pdf.js not loaded.'));
    }
    var doc = global.Store.getDocument(docId);
    if (!doc) return Promise.reject(new Error('Document not found.'));
    var client = global.Store.getClient(doc.clientId);

    var target = document.querySelector('.print-root');
    if (!target) return Promise.reject(new Error('No .print-root element on page.'));

    var filename = buildFilename(doc, client);

    // Scale-to-fit before capture
    var restore = fitToA4(target);

    var opt = {
      margin: 0,
      filename: filename,
      enableLinks: false,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: target.scrollWidth,
        // Capture the un-scrolled element fully.
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['avoid-all'] }
    };

    return global.html2pdf()
      .set(opt)
      .from(target)
      .save()
      .then(function () { restore(); })
      .catch(function (err) { restore(); throw err; });
  }

  global.PDF = {
    exportDocument: exportDocument,
    buildFilename: buildFilename
  };
})(typeof window !== 'undefined' ? window : globalThis);
