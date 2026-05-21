/* editor.js — document editor form logic.
 * - Holds the doc in memory (no auto-save to store; pushes to live iframe instead).
 * - On Save: validates, commits counter if number is still auto, persists to store.
 */
(function () {
  'use strict';

  // ---------- State ----------
  var qs = new URLSearchParams(location.search);
  var existingId = qs.get('id');
  var initialType = qs.get('type') === 'invoice' ? 'invoice' : 'proforma';

  var isNew = !existingId;
  var doc;          // working copy of the document
  var profiles;     // list
  var clients;      // list
  var previewReady = false;
  var pendingPreviewPush = false;

  // ---------- DOM ----------
  var els = {
    pageTitle:        document.getElementById('page-title'),
    pageSubtitle:     document.getElementById('page-subtitle'),
    activeProfileLbl: document.getElementById('active-profile-label'),
    typeToggle:       document.getElementById('type-toggle'),
    profile:          document.getElementById('f-profile'),
    issueDate:        document.getElementById('f-issue-date'),
    number:           document.getElementById('f-number'),
    status:           document.getElementById('f-status'),
    offerRef:         document.getElementById('f-offer-ref'),
    clientRef:        document.getElementById('f-client-ref'),
    client:           document.getElementById('f-client'),
    btnNewClient:     document.getElementById('btn-new-client'),
    clientPreview:    document.getElementById('client-preview'),
    cpCompany:        document.getElementById('cp-company'),
    cpAddress:        document.getElementById('cp-address'),
    cpGstin:          document.getElementById('cp-gstin'),
    cpAttn:           document.getElementById('cp-attn'),
    itemsBody:        document.getElementById('items-body'),
    btnAddItem:       document.getElementById('btn-add-item'),
    taxToggle:        document.getElementById('taxmode-toggle'),
    taxHint:          document.getElementById('taxmode-hint'),
    showSchedule:     document.getElementById('f-show-schedule'),
    scheduleBody:     document.getElementById('schedule-body'),
    btnAddMilestone:  document.getElementById('btn-add-milestone'),
    scheduleSum:      document.getElementById('schedule-sum'),
    showBank:         document.getElementById('f-show-bank'),
    notes:            document.getElementById('f-notes'),
    tSubtotal:        document.getElementById('t-subtotal'),
    tCgst:            document.getElementById('t-cgst'),
    tSgst:            document.getElementById('t-sgst'),
    tIgst:            document.getElementById('t-igst'),
    tGrand:           document.getElementById('t-grand'),
    tWords:           document.getElementById('t-words'),
    rowCgst:          document.getElementById('row-cgst'),
    rowSgst:          document.getElementById('row-sgst'),
    rowIgst:          document.getElementById('row-igst'),
    btnSavePreview:   document.getElementById('btn-save-preview'),
    btnSaveDraft:     document.getElementById('btn-save-draft'),
    btnCancel:        document.getElementById('btn-cancel'),
    previewFrame:     document.getElementById('preview-frame'),
    modal:            document.getElementById('client-modal'),
    ncCompany:        document.getElementById('nc-company'),
    ncAddress:        document.getElementById('nc-address'),
    ncGstin:          document.getElementById('nc-gstin'),
    ncStateCode:      document.getElementById('nc-statecode'),
    ncAttn:           document.getElementById('nc-attn'),
    ncSave:           document.getElementById('nc-save'),
    ncCancel:         document.getElementById('nc-cancel'),
    toastHost:        document.getElementById('toast-host')
  };

  // ---------- Init ----------

  function init() {
    profiles = Store.listProfiles();
    clients = Store.listClients();

    if (!profiles.length) {
      alert('No profiles yet. Set one up in Settings first.');
      location.href = 'settings.html';
      return;
    }

    if (existingId) {
      var existing = Store.getDocument(existingId);
      if (!existing) {
        alert('Document not found.');
        location.href = 'index.html';
        return;
      }
      doc = JSON.parse(JSON.stringify(existing));
      els.pageTitle.textContent = (doc.type === 'proforma' ? 'Proforma ' : 'Invoice ') + doc.number;
      els.pageSubtitle.textContent = 'Editing — saved when you click Save.';
    } else {
      doc = blankDoc(initialType);
    }

    populateProfileSelect();
    populateClientSelect();
    bindEvents();
    paintAll();

    var active = Store.getActiveProfile();
    if (active) els.activeProfileLbl.textContent = active.name;

    els.previewFrame.addEventListener('load', function () {
      previewReady = true;
      pushPreview();
    });

    window.addEventListener('message', function (ev) {
      if (ev.data && ev.data.type === 'preview-ready') {
        previewReady = true;
        if (pendingPreviewPush) pushPreview();
      }
    });
  }

  function blankDoc(type) {
    var active = Store.getActiveProfile() || profiles[0];
    var today = new Date().toISOString().slice(0, 10);
    return {
      id: null,
      type: type,
      number: Numbering.nextNumber(active, type),
      profileId: active.id,
      clientId: clients.length ? clients[0].id : null,
      issueDate: today,
      offerRef: '',
      clientRef: '',
      items: [{ description: '', subDescription: '', qty: 1, unitPrice: 0, gstPercent: 0 }],
      taxMode: 'none',
      paymentSchedule: type === 'proforma' ? defaultSchedule() : [],
      showBankDetails: type === 'invoice',
      showPaymentSchedule: type === 'proforma',
      notes: '',
      status: 'draft',
      convertedFromId: null,
      convertedToId: null
    };
  }

  function defaultSchedule() {
    return [
      { percent: 20, label: 'Advance',         description: 'On release of the Purchase / Service Order.' },
      { percent: 20, label: 'Phase 1',         description: 'On conclusion of the 1st meeting and site visit.' },
      { percent: 40, label: 'Phase 2',         description: 'On submission of 2–3 tentative layout options and the 2nd meeting.' },
      { percent: 20, label: 'Phase 3 — Final', description: 'On submission of the final recommended AutoCAD layout and final area documents.' }
    ];
  }

  // ---------- Populate selects ----------

  function populateProfileSelect() {
    els.profile.innerHTML = profiles.map(function (p) {
      return '<option value="' + p.id + '">' + escapeAttr(p.name) + '</option>';
    }).join('');
    els.profile.value = doc.profileId;
  }

  function populateClientSelect() {
    if (!clients.length) {
      els.client.innerHTML = '<option value="">— no clients yet, add one →</option>';
      return;
    }
    els.client.innerHTML = clients.map(function (c) {
      return '<option value="' + c.id + '">' + escapeAttr(c.companyName) + '</option>';
    }).join('');
    if (doc.clientId) els.client.value = doc.clientId;
    else doc.clientId = clients[0].id;
  }

  // ---------- Paint (model → DOM) ----------

  function paintAll() {
    paintTypeToggle();
    paintBasics();
    paintClientPreview();
    paintItems();
    paintTaxToggle();
    paintScheduleSection();
    paintDisplayOptions();
    paintTotals();
    schedulePreviewPush();
  }

  function paintTypeToggle() {
    Array.prototype.forEach.call(els.typeToggle.querySelectorAll('label'), function (lb) {
      var on = lb.getAttribute('data-value') === doc.type;
      lb.classList.toggle('is-active', on);
      lb.querySelector('input').checked = on;
    });
  }

  function paintBasics() {
    els.profile.value = doc.profileId;
    els.issueDate.value = doc.issueDate;
    els.number.value = doc.number;
    els.status.value = doc.status;
    els.offerRef.value = doc.offerRef || '';
    els.clientRef.value = doc.clientRef || '';
  }

  function paintClientPreview() {
    if (!doc.clientId) {
      els.clientPreview.style.display = 'none';
      return;
    }
    var c = clients.find(function (x) { return x.id === doc.clientId; });
    if (!c) { els.clientPreview.style.display = 'none'; return; }
    els.clientPreview.style.display = '';
    els.cpCompany.textContent = c.companyName || '';
    els.cpAddress.textContent = c.address || '';
    els.cpGstin.textContent = c.gstin ? ('GSTIN: ' + c.gstin + (c.stateCode ? ' · State ' + c.stateCode : '')) : '';
    els.cpAttn.textContent = c.attention ? ('Attn: ' + c.attention) : '';
    els.client.value = doc.clientId;
  }

  function paintItems() {
    els.itemsBody.innerHTML = doc.items.map(function (it, idx) {
      var sub = Calc.lineSubtotal(it);
      return ''
        + '<tr data-idx="' + idx + '">'
        +   '<td>'
        +     '<input class="item-desc" placeholder="Description" value="' + escapeAttr(it.description || '') + '">'
        +     '<textarea class="item-subdesc" placeholder="Sub-description (optional)">' + escapeText(it.subDescription || '') + '</textarea>'
        +   '</td>'
        +   '<td><input type="number" class="num item-qty" min="0" step="any" value="' + Number(it.qty || 0) + '"></td>'
        +   '<td><input type="number" class="num item-price" min="0" step="any" value="' + Number(it.unitPrice || 0) + '"></td>'
        +   '<td><input type="number" class="num item-gst" min="0" max="100" step="any" value="' + Number(it.gstPercent || 0) + '"></td>'
        +   '<td style="text-align:right;font-variant-numeric:tabular-nums;">' + Calc.formatINR(sub) + '</td>'
        +   '<td class="actions"><button type="button" class="btn btn--ghost btn--sm btn-del-item" title="Remove">✕</button></td>'
        + '</tr>';
    }).join('');
  }

  function paintTaxToggle() {
    Array.prototype.forEach.call(els.taxToggle.querySelectorAll('label'), function (lb) {
      var on = lb.getAttribute('data-value') === doc.taxMode;
      lb.classList.toggle('is-active', on);
      lb.querySelector('input').checked = on;
    });
    var profile = profiles.find(function (p) { return p.id === doc.profileId; });
    var client = clients.find(function (c) { return c.id === doc.clientId; });
    var suggested = Convert.suggestedTaxMode(profile, client);
    els.taxHint.textContent = 'Suggested based on state codes: ' + suggested
      + (doc.taxMode === 'none' ? ' · Tip: Proforma usually uses None.' : '');
  }

  function paintScheduleSection() {
    els.showSchedule.checked = !!doc.showPaymentSchedule;
    var ms = doc.paymentSchedule || [];
    els.scheduleBody.innerHTML = ms.map(function (m, idx) {
      return ''
        + '<tr data-idx="' + idx + '">'
        +   '<td><input type="number" class="num ms-pct" min="0" max="100" step="any" value="' + Number(m.percent || 0) + '"></td>'
        +   '<td><input class="ms-label" value="' + escapeAttr(m.label || '') + '"></td>'
        +   '<td><input class="ms-desc" value="' + escapeAttr(m.description || '') + '"></td>'
        +   '<td class="actions"><button type="button" class="btn btn--ghost btn--sm btn-del-milestone" title="Remove">✕</button></td>'
        + '</tr>';
    }).join('');
    paintScheduleSum();
  }

  function paintScheduleSum() {
    var sum = (doc.paymentSchedule || []).reduce(function (a, m) { return a + (Number(m.percent) || 0); }, 0);
    els.scheduleSum.textContent = 'Sum: ' + sum + '%';
    els.scheduleSum.style.color = sum === 100 ? 'var(--app-success)' : 'var(--app-warning)';
  }

  function paintDisplayOptions() {
    els.showBank.checked = !!doc.showBankDetails;
    els.notes.value = doc.notes || '';
  }

  function paintTotals() {
    var t = Calc.computeTotals(doc.items, doc.taxMode);
    els.tSubtotal.textContent = Calc.formatINR(t.subtotal);
    els.tCgst.textContent = Calc.formatINR(t.cgst);
    els.tSgst.textContent = Calc.formatINR(t.sgst);
    els.tIgst.textContent = Calc.formatINR(t.igst);
    els.tGrand.textContent = Calc.formatINR(t.grandTotal);
    els.tWords.textContent = Calc.numberToWordsINR(t.grandTotal);
    els.rowCgst.style.display = doc.taxMode === 'intra' ? '' : 'none';
    els.rowSgst.style.display = doc.taxMode === 'intra' ? '' : 'none';
    els.rowIgst.style.display = doc.taxMode === 'inter' ? '' : 'none';
  }

  // ---------- Live preview push ----------

  var pushTimer = null;
  function schedulePreviewPush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushPreview, 120);
  }

  function pushPreview() {
    if (!previewReady) { pendingPreviewPush = true; return; }
    var win = els.previewFrame.contentWindow;
    if (!win || typeof win.applyLiveData !== 'function') { pendingPreviewPush = true; return; }
    var profile = profiles.find(function (p) { return p.id === doc.profileId; });
    var client  = clients.find(function (c) { return c.id === doc.clientId; });
    win.applyLiveData(doc, profile, client);
  }

  // ---------- Events ----------

  function bindEvents() {
    // Type toggle
    els.typeToggle.addEventListener('change', function (e) {
      var v = e.target.value;
      if (v && v !== doc.type) {
        doc.type = v;
        // Re-suggest number if user hasn't overridden it
        if (isNew) {
          var profile = profiles.find(function (p) { return p.id === doc.profileId; });
          doc.number = Numbering.nextNumber(profile, doc.type);
        }
        // Re-suggest schedule visibility on proforma; bank on invoice
        if (v === 'proforma' && !doc.paymentSchedule.length) doc.paymentSchedule = defaultSchedule();
        paintAll();
      }
    });

    els.profile.addEventListener('change', function () {
      doc.profileId = els.profile.value;
      if (isNew) {
        var profile = profiles.find(function (p) { return p.id === doc.profileId; });
        doc.number = Numbering.nextNumber(profile, doc.type);
      }
      paintBasics(); paintTaxToggle(); schedulePreviewPush();
    });

    els.issueDate.addEventListener('change', function () { doc.issueDate = els.issueDate.value; schedulePreviewPush(); });
    els.number.addEventListener('input',    function () { doc.number = els.number.value; schedulePreviewPush(); });
    els.status.addEventListener('change',   function () { doc.status = els.status.value; });
    els.offerRef.addEventListener('input',  function () { doc.offerRef = els.offerRef.value; schedulePreviewPush(); });
    els.clientRef.addEventListener('input', function () { doc.clientRef = els.clientRef.value; schedulePreviewPush(); });

    els.client.addEventListener('change', function () {
      doc.clientId = els.client.value;
      paintClientPreview(); paintTaxToggle(); schedulePreviewPush();
    });

    els.btnNewClient.addEventListener('click', openClientModal);
    els.ncCancel.addEventListener('click', closeClientModal);
    els.ncSave.addEventListener('click', saveNewClient);

    // Items
    els.btnAddItem.addEventListener('click', function () {
      doc.items.push({ description: '', subDescription: '', qty: 1, unitPrice: 0, gstPercent: 0 });
      paintItems(); paintTotals(); schedulePreviewPush();
    });
    els.itemsBody.addEventListener('input', function (e) {
      var tr = e.target.closest('tr');
      if (!tr) return;
      var idx = Number(tr.getAttribute('data-idx'));
      var it = doc.items[idx];
      if (!it) return;
      if (e.target.classList.contains('item-desc'))    it.description = e.target.value;
      if (e.target.classList.contains('item-subdesc')) it.subDescription = e.target.value;
      if (e.target.classList.contains('item-qty'))     it.qty = Number(e.target.value) || 0;
      if (e.target.classList.contains('item-price'))   it.unitPrice = Number(e.target.value) || 0;
      if (e.target.classList.contains('item-gst'))     it.gstPercent = Number(e.target.value) || 0;
      // Update line total inline without re-painting all inputs (preserves focus)
      var lineCell = tr.querySelector('td:nth-child(5)');
      if (lineCell) lineCell.textContent = Calc.formatINR(Calc.lineSubtotal(it));
      paintTotals(); schedulePreviewPush();
    });
    els.itemsBody.addEventListener('click', function (e) {
      if (e.target.closest('.btn-del-item')) {
        var tr = e.target.closest('tr');
        var idx = Number(tr.getAttribute('data-idx'));
        doc.items.splice(idx, 1);
        if (!doc.items.length) doc.items.push({ description: '', subDescription: '', qty: 1, unitPrice: 0, gstPercent: 0 });
        paintItems(); paintTotals(); schedulePreviewPush();
      }
    });

    // Tax mode
    els.taxToggle.addEventListener('change', function (e) {
      var v = e.target.value;
      if (v) { doc.taxMode = v; paintTaxToggle(); paintTotals(); schedulePreviewPush(); }
    });

    // Schedule
    els.showSchedule.addEventListener('change', function () {
      doc.showPaymentSchedule = els.showSchedule.checked;
      schedulePreviewPush();
    });
    els.btnAddMilestone.addEventListener('click', function () {
      if (!doc.paymentSchedule) doc.paymentSchedule = [];
      doc.paymentSchedule.push({ percent: 0, label: '', description: '' });
      paintScheduleSection(); schedulePreviewPush();
    });
    els.scheduleBody.addEventListener('input', function (e) {
      var tr = e.target.closest('tr');
      if (!tr) return;
      var idx = Number(tr.getAttribute('data-idx'));
      var m = doc.paymentSchedule[idx];
      if (!m) return;
      if (e.target.classList.contains('ms-pct'))   m.percent = Number(e.target.value) || 0;
      if (e.target.classList.contains('ms-label')) m.label = e.target.value;
      if (e.target.classList.contains('ms-desc'))  m.description = e.target.value;
      paintScheduleSum(); schedulePreviewPush();
    });
    els.scheduleBody.addEventListener('click', function (e) {
      if (e.target.closest('.btn-del-milestone')) {
        var tr = e.target.closest('tr');
        var idx = Number(tr.getAttribute('data-idx'));
        doc.paymentSchedule.splice(idx, 1);
        paintScheduleSection(); schedulePreviewPush();
      }
    });

    // Display options
    els.showBank.addEventListener('change', function () { doc.showBankDetails = els.showBank.checked; schedulePreviewPush(); });
    els.notes.addEventListener('input', function () { doc.notes = els.notes.value; schedulePreviewPush(); });

    // Save / Cancel
    els.btnCancel.addEventListener('click', function () {
      if (confirm('Discard changes and go back?')) location.href = 'index.html';
    });
    els.btnSaveDraft.addEventListener('click', function () { handleSave(false); });
    els.btnSavePreview.addEventListener('click', function () { handleSave(true); });
  }

  // ---------- Client modal ----------

  function openClientModal() {
    els.ncCompany.value = '';
    els.ncAddress.value = '';
    els.ncGstin.value = '';
    els.ncStateCode.value = '';
    els.ncAttn.value = '';
    els.modal.classList.add('is-open');
    els.ncCompany.focus();
  }

  function closeClientModal() { els.modal.classList.remove('is-open'); }

  function saveNewClient() {
    var name = els.ncCompany.value.trim();
    if (!name) { alert('Company name is required.'); return; }
    var c = Store.saveClient({
      companyName: name,
      address: els.ncAddress.value,
      gstin: els.ncGstin.value,
      stateCode: els.ncStateCode.value,
      attention: els.ncAttn.value
    });
    clients = Store.listClients();
    doc.clientId = c.id;
    populateClientSelect();
    paintClientPreview();
    paintTaxToggle();
    schedulePreviewPush();
    closeClientModal();
    toast('Client saved');
  }

  // ---------- Save ----------

  function validate() {
    var errors = [];
    if (!doc.profileId) errors.push('Pick a profile.');
    if (!doc.clientId)  errors.push('Pick or add a client.');
    if (!doc.items.length) errors.push('Add at least one line item.');
    if (!doc.issueDate) errors.push('Issue date is required.');
    if (!doc.number || !doc.number.trim()) errors.push('Document number is required.');
    return errors;
  }

  function handleSave(thenPreview) {
    var errs = validate();
    if (errs.length) { alert('Cannot save:\n\n• ' + errs.join('\n• ')); return; }

    var profile = profiles.find(function (p) { return p.id === doc.profileId; });
    var willCommitCounter = isNew && Numbering.isAutoNumber(profile, doc.type, doc.number);

    if (willCommitCounter) {
      doc.number = Store.commitNumber(profile.id, doc.type);
    }

    var saved = Store.saveDocument(doc);
    doc.id = saved.id;
    isNew = false;
    toast('Saved');

    if (thenPreview) {
      location.href = 'preview.html?id=' + encodeURIComponent(saved.id);
    } else {
      location.href = 'index.html';
    }
  }

  // ---------- Helpers ----------

  function escapeAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeText(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' toast--error' : ' toast--success');
    el.textContent = msg;
    els.toastHost.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', init);
})();
