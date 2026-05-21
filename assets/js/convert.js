/* convert.js — proforma → invoice conversion.
 * Exposes `window.Convert`.
 *
 * Pulled out of preview.html into a shared module because the dashboard
 * row-action and the preview toolbar both invoke this flow.
 */
(function (global) {
  'use strict';

  function suggestedTaxMode(profile, client) {
    if (profile && client && profile.stateCode && client.stateCode) {
      return profile.stateCode === client.stateCode ? 'intra' : 'inter';
    }
    return 'inter';
  }

  // Returns new invoice doc id on success, null on cancel/failure.
  function proformaToInvoice(proformaId) {
    var Store = global.Store;
    var src = Store.getDocument(proformaId);
    if (!src) { alert('Proforma not found.'); return null; }
    if (src.type !== 'proforma') { alert('Only proforma documents can be converted.'); return null; }
    if (src.convertedToId) {
      alert('This proforma has already been converted (invoice id: ' + src.convertedToId + ').');
      return null;
    }
    var profile = Store.getProfile(src.profileId);
    var client = Store.getClient(src.clientId);

    var suggested = suggestedTaxMode(profile, client);
    var pick = prompt(
      'Tax mode for the new invoice?\n' +
      '  intra = CGST + SGST (same state)\n' +
      '  inter = IGST (interstate)\n' +
      '  none  = no GST\n\n' +
      'Suggested: ' + suggested,
      suggested
    );
    if (pick == null) return null;
    pick = pick.toLowerCase().trim();
    if (pick !== 'intra' && pick !== 'inter' && pick !== 'none') {
      alert('Invalid tax mode. Cancelled.');
      return null;
    }

    var newNumber = Store.commitNumber(src.profileId, 'invoice');
    var today = new Date().toISOString().slice(0, 10);
    var newDoc = {
      type: 'invoice',
      number: newNumber,
      profileId: src.profileId,
      clientId: src.clientId,
      issueDate: today,
      offerRef: src.offerRef || '',
      clientRef: src.clientRef || '',
      items: JSON.parse(JSON.stringify(src.items || [])),
      taxMode: pick,
      paymentSchedule: JSON.parse(JSON.stringify(src.paymentSchedule || [])),
      showBankDetails: true,
      showPaymentSchedule: !!src.showPaymentSchedule,
      notes: src.notes || '',
      status: 'draft',
      convertedFromId: src.id,
      convertedToId: null
    };
    var saved = Store.saveDocument(newDoc);

    // Mark the source proforma as converted, with a back-pointer.
    src.convertedToId = saved.id;
    src.status = 'converted';
    Store.saveDocument(src);

    return saved.id;
  }

  global.Convert = {
    suggestedTaxMode: suggestedTaxMode,
    proformaToInvoice: proformaToInvoice
  };
})(typeof window !== 'undefined' ? window : globalThis);
