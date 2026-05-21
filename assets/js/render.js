/* render.js — produces the A4 invoice HTML from a document + profile + client.
 * Exposes `window.Render`.
 *
 * Pure function: returns an HTML string. Caller injects via innerHTML into a
 * `.print-root` container.
 */
(function (global) {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function formatDate(input) {
    if (!input) return '';
    var d = /^\d{4}-\d{2}-\d{2}$/.test(input)
      ? new Date(input + 'T00:00:00')
      : new Date(input);
    if (isNaN(d.getTime())) return String(input);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function moneyCell(n) { return global.Calc.formatINR(n); }

  // ---------- Section builders ----------

  function header(profile, title, sublabel) {
    return ''
      + '<header class="inv-header">'
      +   '<div class="inv-header__brand">'
      +     '<h1>' + esc(profile.name) + '</h1>'
      +     (profile.tagline ? '<p>' + esc(profile.tagline) + '</p>' : '')
      +   '</div>'
      +   '<div class="inv-header__title">'
      +     '<h2>' + esc(title) + '</h2>'
      +     (sublabel ? '<p class="inv-header__sublabel">' + esc(sublabel) + '</p>' : '')
      +   '</div>'
      + '</header>';
  }

  function meta(doc, profile) {
    var leftRows = [
      ['Invoice #', doc.number],
      ['Issue Date', formatDate(doc.issueDate)]
    ];
    if (doc.offerRef) leftRows.push(['Offer Ref', doc.offerRef]);
    if (doc.clientRef) leftRows.push(['Client Ref', doc.clientRef]);

    var leftDl = leftRows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1] || '—') + '</dd>';
    }).join('');

    var fromLines = [];
    fromLines.push('<p class="inv-meta__from-line"><strong>' + esc(profile.name) + '</strong></p>');
    if (profile.tagline) fromLines.push('<p class="inv-meta__from-line">' + esc(profile.tagline) + '</p>');
    if (profile.address) fromLines.push('<p class="inv-meta__from-line">' + nl2br(profile.address) + '</p>');
    if (profile.mobile)  fromLines.push('<p class="inv-meta__from-line">Mob: ' + esc(profile.mobile) + '</p>');
    if (profile.email)   fromLines.push('<p class="inv-meta__from-line">Email: ' + esc(profile.email) + '</p>');
    if (profile.gstin)   fromLines.push('<p class="inv-meta__from-line">GSTIN: ' + esc(profile.gstin) + '</p>');
    if (profile.pan)     fromLines.push('<p class="inv-meta__from-line">PAN: ' + esc(profile.pan) + '</p>');

    return ''
      + '<section class="inv-meta">'
      +   '<div class="inv-meta__block">'
      +     '<h3>Document</h3>'
      +     '<dl>' + leftDl + '</dl>'
      +   '</div>'
      +   '<div class="inv-meta__block">'
      +     '<h3>From</h3>'
      +     fromLines.join('')
      +   '</div>'
      + '</section>';
  }

  function billTo(client) {
    if (!client) {
      return '<section class="inv-billto"><h3>Bill To</h3>'
           + '<p class="inv-billto__company">—</p></section>';
    }
    var lines = [];
    lines.push('<p class="inv-billto__company">' + esc(client.companyName || '—') + '</p>');
    if (client.address) lines.push('<p class="inv-billto__line">' + nl2br(client.address) + '</p>');
    if (client.gstin)   lines.push('<p class="inv-billto__line">GSTIN: ' + esc(client.gstin) + '</p>');
    if (client.attention) lines.push('<p class="inv-billto__attn">Kind Attn: ' + esc(client.attention) + '</p>');
    return ''
      + '<section class="inv-billto">'
      +   '<h3>Bill To</h3>'
      +   lines.join('')
      + '</section>';
  }

  function itemsTable(items, anyGst) {
    var rows = (items || []).map(function (it, idx) {
      var sub = global.Calc.lineSubtotal(it);
      var gstCell = anyGst
        ? '<td class="num">' + (Number(it.gstPercent) || 0).toFixed(0) + '%</td>'
        : '';
      return ''
        + '<tr>'
        +   '<td>'
        +     '<p class="inv-items__desc-main">' + esc(it.description || '') + '</p>'
        +     (it.subDescription
              ? '<p class="inv-items__desc-sub">' + nl2br(it.subDescription) + '</p>'
              : '')
        +   '</td>'
        +   '<td class="num qty">' + esc(it.qty != null ? it.qty : '') + '</td>'
        +   '<td class="num">' + moneyCell(Number(it.unitPrice) || 0) + '</td>'
        +   gstCell
        +   '<td class="num">' + moneyCell(sub) + '</td>'
        + '</tr>';
    }).join('');

    var gstHead = anyGst ? '<th class="num qty">GST</th>' : '';
    return ''
      + '<section>'
      +   '<table class="inv-items">'
      +     '<thead><tr>'
      +       '<th>Description</th>'
      +       '<th class="num qty">Qty</th>'
      +       '<th class="num">Rate</th>'
      +       gstHead
      +       '<th class="num">Amount</th>'
      +     '</tr></thead>'
      +     '<tbody>' + (rows || '<tr><td colspan="5">No items.</td></tr>') + '</tbody>'
      +   '</table>'
      + '</section>';
  }

  function totals(t, taxMode) {
    var rows = [];
    rows.push('<div class="inv-totals__row"><span>Subtotal</span><span>' + moneyCell(t.subtotal) + '</span></div>');
    if (taxMode === 'intra') {
      rows.push('<div class="inv-totals__row"><span>CGST</span><span>' + moneyCell(t.cgst) + '</span></div>');
      rows.push('<div class="inv-totals__row"><span>SGST</span><span>' + moneyCell(t.sgst) + '</span></div>');
    } else if (taxMode === 'inter') {
      rows.push('<div class="inv-totals__row"><span>IGST</span><span>' + moneyCell(t.igst) + '</span></div>');
    }
    rows.push('<div class="inv-totals__row inv-totals__row--grand"><span>Grand Total</span><span>'
              + moneyCell(t.grandTotal) + '</span></div>');
    return '<section class="inv-totals"><div class="inv-totals__rows">' + rows.join('') + '</div></section>';
  }

  function words(text) {
    return '<p class="inv-words"><strong>In Words:</strong>' + esc(text) + '</p>';
  }

  function notesBlock(text) {
    return '<section class="inv-notes"><h3>Notes</h3>' + nl2br(text) + '</section>';
  }

  function schedule(items) {
    var cards = items.map(function (m) {
      return ''
        + '<div class="inv-schedule__card">'
        +   '<div class="inv-schedule__percent">' + esc(m.percent) + '%</div>'
        +   '<p class="inv-schedule__label">' + esc(m.label || '') + '</p>'
        +   '<p class="inv-schedule__desc">' + esc(m.description || '') + '</p>'
        + '</div>';
    }).join('');
    return ''
      + '<section class="inv-schedule">'
      +   '<h3>Payment Schedule</h3>'
      +   '<div class="inv-schedule__grid">' + cards + '</div>'
      + '</section>';
  }

  function bank(profile) {
    var b = profile.bank || {};
    var rows = [
      ['Account Name', b.accountName],
      ['Bank',         b.bankName],
      ['A/C No.',      b.accountNumber],
      ['IFSC',         b.ifsc],
      ['Branch',       b.branch]
    ].filter(function (r) { return !!r[1]; });

    if (!rows.length && !b.upi) return '';

    var dl = rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
    }).join('');

    var rightCol = b.upi
      ? '<div class="inv-bank__col">'
      +   '<p class="inv-bank__upi-line">UPI: ' + esc(b.upi) + '</p>'
      +   '<div class="inv-bank__qr-placeholder">QR placeholder</div>'
      + '</div>'
      : '<div class="inv-bank__col"></div>';

    return ''
      + '<section class="inv-bank">'
      +   '<h3>Bank Details</h3>'
      +   '<div class="inv-bank__grid">'
      +     '<div class="inv-bank__col"><dl>' + dl + '</dl></div>'
      +     rightCol
      +   '</div>'
      + '</section>';
  }

  function declaration(isProforma) {
    var msg = isProforma
      ? 'This is a Proforma Invoice issued for advance reference. It is not a Tax Invoice and is not valid for input tax credit.'
      : 'We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.';
    return '<p class="inv-declaration">' + esc(msg) + '</p>';
  }

  function sigBlock(profile, doc) {
    return ''
      + '<section class="inv-sigblock">'
      +   '<div class="inv-sigblock__sig">'
      +     '<p class="inv-sigblock__sig-line">For ' + esc(profile.name) + '</p>'
      +     '<p class="inv-sigblock__sig-name">Authorised Signatory</p>'
      +   '</div>'
      +   '<div class="inv-sigblock__date">Date<strong>' + esc(formatDate(doc.issueDate)) + '</strong></div>'
      + '</section>';
  }

  function footerStrip(profile) {
    var bits = [];
    if (profile.mobile) bits.push(esc(profile.mobile));
    if (profile.email)  bits.push(esc(profile.email));
    if (profile.gstin)  bits.push('GSTIN ' + esc(profile.gstin));
    if (!bits.length) return '';
    return '<div class="inv-footer-strip"><span>' + bits.join('</span><span>·</span><span>') + '</span></div>';
  }

  // ---------- Public ----------

  function renderDocument(doc, profile, client, settings) {
    if (!doc || !profile) return '<p style="padding:40px;color:#666;">Missing document or profile.</p>';

    var t = global.Calc.computeTotals(doc.items, doc.taxMode);
    var w = global.Calc.numberToWordsINR(t.grandTotal);
    var anyGst = global.Calc.hasAnyGst(doc.items) && doc.taxMode !== 'none';

    var isProforma = doc.type === 'proforma';
    var title = isProforma ? 'Proforma Invoice' : 'Tax Invoice';
    var sublabel = isProforma ? 'Not a Tax Invoice' : '';

    var html = ''
      + '<article class="invoice">'
      +   header(profile, title, sublabel)
      +   meta(doc, profile)
      +   billTo(client)
      +   itemsTable(doc.items, anyGst)
      +   totals(t, doc.taxMode)
      +   words(w)
      +   (doc.notes ? notesBlock(doc.notes) : '')
      +   (doc.showPaymentSchedule && doc.paymentSchedule && doc.paymentSchedule.length
            ? schedule(doc.paymentSchedule) : '')
      +   (doc.showBankDetails ? bank(profile) : '')
      +   declaration(isProforma)
      +   sigBlock(profile, doc)
      +   footerStrip(profile)
      + '</article>';

    return html;
  }

  function renderById(docId) {
    var doc = global.Store.getDocument(docId);
    if (!doc) return '<p style="padding:40px;color:#666;">Document not found.</p>';
    var profile = global.Store.getProfile(doc.profileId);
    var client = global.Store.getClient(doc.clientId);
    return renderDocument(doc, profile, client, global.Store.getSettings());
  }

  global.Render = {
    renderDocument: renderDocument,
    renderById: renderById,
    formatDate: formatDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
