/* convert.js — proforma → invoice with tranche picker + tax mode chooser.
 * Exposes `window.Convert`.
 *
 * The flow opens a modal showing each proforma line item as a checkbox so the
 * user can invoice 1+ tranches at a time. Returns a Promise that resolves to
 * the new invoice id, or null on cancel.
 */
(function (global) {
  'use strict';

  function suggestedTaxMode(profile, client) {
    if (profile && client && profile.stateCode && client.stateCode) {
      return profile.stateCode === client.stateCode ? 'intra' : 'inter';
    }
    return 'inter';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- Modal (built dynamically; works on any page) ----------

  function openModal(proforma, profile, client) {
    return new Promise(function (resolve) {
      var items = proforma.items || [];
      var suggested = suggestedTaxMode(profile, client);
      var totalIfAll = items.reduce(function (s, it) { return s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);

      var host = document.createElement('div');
      host.className = 'modal is-open';
      host.style.zIndex = 1000;

      var itemRows = items.map(function (it, idx) {
        var line = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
        return ''
          + '<label style="display:flex;gap:10px;padding:8px 10px;border:1px solid var(--app-border);border-radius:6px;margin-bottom:6px;cursor:pointer;align-items:flex-start;">'
          +   '<input type="checkbox" class="tr-pick" data-idx="' + idx + '" checked style="margin-top:2px;">'
          +   '<div style="flex:1;min-width:0;">'
          +     '<div style="font-weight:600;font-size:13px;">' + esc(it.description || '(no description)') + '</div>'
          +     (it.subDescription ? '<div style="font-size:11px;color:var(--app-muted);margin-top:2px;">' + esc(it.subDescription) + '</div>' : '')
          +   '</div>'
          +   '<div style="font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;">\u20B9' + line.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</div>'
          + '</label>';
      }).join('');

      host.innerHTML = ''
        + '<div class="modal__panel" style="width:min(620px,94vw);">'
        +   '<h3 class="modal__title">Convert proforma to invoice</h3>'
        +   '<p style="margin:0 0 12px;color:var(--app-muted);font-size:13px;">Pick which tranche(s) to bill on this invoice. Proforma total: <strong>\u20B9' + totalIfAll.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</strong>.</p>'
        +   '<div style="max-height:280px;overflow-y:auto;margin-bottom:14px;">' + (itemRows || '<p style="color:var(--app-muted);">No items on this proforma.</p>') + '</div>'
        +   '<div style="display:flex;gap:8px;margin-bottom:10px;">'
        +     '<button type="button" class="btn btn--sm" id="tr-select-all">Select all</button>'
        +     '<button type="button" class="btn btn--sm" id="tr-select-none">Select none</button>'
        +   '</div>'
        +   '<div class="field">'
        +     '<label class="field__label">Tax mode</label>'
        +     '<div class="radio-group">'
        +       '<label data-value="none"' + (suggested === 'none' ? ' class="is-active"' : '') + '><input type="radio" name="tr-tax" value="none"' + (suggested === 'none' ? ' checked' : '') + '>None</label>'
        +       '<label data-value="intra"' + (suggested === 'intra' ? ' class="is-active"' : '') + '><input type="radio" name="tr-tax" value="intra"' + (suggested === 'intra' ? ' checked' : '') + '>Intra-state (CGST+SGST)</label>'
        +       '<label data-value="inter"' + (suggested === 'inter' ? ' class="is-active"' : '') + '><input type="radio" name="tr-tax" value="inter"' + (suggested === 'inter' ? ' checked' : '') + '>Inter-state (IGST)</label>'
        +     '</div>'
        +     '<p class="field__hint">Suggested based on state codes: <strong>' + suggested + '</strong></p>'
        +   '</div>'
        +   '<div class="modal__actions">'
        +     '<button class="btn" type="button" id="tr-cancel">Cancel</button>'
        +     '<button class="btn btn--primary" type="button" id="tr-go">Create Invoice</button>'
        +   '</div>'
        + '</div>';

      document.body.appendChild(host);

      function close(val) {
        document.body.removeChild(host);
        resolve(val);
      }

      host.querySelector('#tr-cancel').addEventListener('click', function () { close(null); });
      host.querySelector('#tr-select-all').addEventListener('click', function () {
        host.querySelectorAll('.tr-pick').forEach(function (cb) { cb.checked = true; });
      });
      host.querySelector('#tr-select-none').addEventListener('click', function () {
        host.querySelectorAll('.tr-pick').forEach(function (cb) { cb.checked = false; });
      });

      // Highlight active tax-mode label
      host.querySelectorAll('input[name="tr-tax"]').forEach(function (r) {
        r.addEventListener('change', function () {
          host.querySelectorAll('.radio-group label').forEach(function (lb) {
            lb.classList.toggle('is-active', lb.getAttribute('data-value') === r.value);
          });
        });
      });

      host.querySelector('#tr-go').addEventListener('click', function () {
        var picked = Array.prototype.filter.call(host.querySelectorAll('.tr-pick'), function (cb) { return cb.checked; })
                          .map(function (cb) { return Number(cb.getAttribute('data-idx')); });
        if (!picked.length) {
          alert('Pick at least one tranche to invoice.');
          return;
        }
        var taxMode = host.querySelector('input[name="tr-tax"]:checked').value;
        close({ pickedIdxs: picked, taxMode: taxMode });
      });
    });
  }

  // ---------- Conversion ----------

  function proformaToInvoice(proformaId) {
    var Store = global.Store;
    var src = Store.getDocument(proformaId);
    if (!src) { alert('Proforma not found.'); return Promise.resolve(null); }
    if (src.type !== 'proforma') { alert('Only proforma documents can be converted.'); return Promise.resolve(null); }
    if (src.convertedToId) {
      alert('This proforma has already been converted (invoice id: ' + src.convertedToId + ').');
      return Promise.resolve(null);
    }
    var profile = Store.getProfile(src.profileId);
    var client = Store.getClient(src.clientId);

    return openModal(src, profile, client).then(function (choice) {
      if (!choice) return null;

      var pickedItems = choice.pickedIdxs.map(function (i) {
        return JSON.parse(JSON.stringify(src.items[i]));
      });
      var newNumber = Store.commitNumber(src.profileId, 'invoice');
      var today = new Date().toISOString().slice(0, 10);

      // Build a short note that captures which tranches were billed.
      var trancheLabels = choice.pickedIdxs.map(function (i) {
        return (src.items[i].description || ('Tranche ' + (i + 1))).split(/[—-]/)[0].trim();
      });
      var trancheNote = 'Invoiced tranche(s) from proforma ' + src.number + ': ' + trancheLabels.join(', ') + '.';

      var newDoc = {
        type: 'invoice',
        number: newNumber,
        profileId: src.profileId,
        clientId: src.clientId,
        issueDate: today,
        offerRef: src.offerRef || '',
        clientRef: src.clientRef || '',
        items: pickedItems,
        taxMode: choice.taxMode,
        paymentSchedule: [],
        showBankDetails: true,
        showPaymentSchedule: false,
        notes: trancheNote + (src.notes ? '\n\n' + src.notes : ''),
        status: 'draft',
        convertedFromId: src.id,
        convertedToId: null
      };
      var saved = Store.saveDocument(newDoc);

      // Mark source proforma. Only flip status to 'converted' once ALL tranches
      // have been billed; otherwise leave it as-is so partial invoicing works.
      if (choice.pickedIdxs.length === (src.items || []).length) {
        src.convertedToId = saved.id;
        src.status = 'converted';
      } else {
        // record the latest invoice via convertedToId (chain head)
        src.convertedToId = saved.id;
      }
      Store.saveDocument(src);

      return saved.id;
    });
  }

  global.Convert = {
    suggestedTaxMode: suggestedTaxMode,
    proformaToInvoice: proformaToInvoice
  };
})(typeof window !== 'undefined' ? window : globalThis);
