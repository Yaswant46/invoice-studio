/* pdf.js — html2pdf.js wrapper for invoice export.
 * Exposes `window.PDF`.
 * Requires html2pdf.js loaded via CDN script tag.
 */
(function (global) {
  'use strict';

  function sanitize(s) {
    return String(s || '')
      .replace(/[\\/:*?"<>|]+/g, '_')   // forbidden filename chars
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

    var opt = {
      margin: 0,
      filename: filename,
      enableLinks: false,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: target.scrollWidth
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    return global.html2pdf().set(opt).from(target).save();
  }

  global.PDF = {
    exportDocument: exportDocument,
    buildFilename: buildFilename
  };
})(typeof window !== 'undefined' ? window : globalThis);
