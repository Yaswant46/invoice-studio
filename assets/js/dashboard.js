/* dashboard.js — KPIs, filters, table actions */
(function () {
  'use strict';

  // ---------- State ----------
  var state = {
    showAllProfiles: false,
    search: '',
    type: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  };

  // ---------- DOM ----------
  var els = {
    profileSwitcher: document.getElementById('profile-switcher'),
    showAllProfiles: document.getElementById('show-all-profiles'),
    scopeLine:       document.getElementById('scope-line'),

    kpiBilled:       document.getElementById('kpi-billed'),
    kpiOutstanding:  document.getElementById('kpi-outstanding'),
    kpiOverdue:      document.getElementById('kpi-overdue'),
    kpiOverdueCount: document.getElementById('kpi-overdue-count'),
    kpiMonth:        document.getElementById('kpi-month'),
    kpiMonthLabel:   document.getElementById('kpi-month-label'),

    fSearch:    document.getElementById('f-search'),
    fType:      document.getElementById('f-type'),
    fStatus:    document.getElementById('f-status'),
    fDateFrom:  document.getElementById('f-date-from'),
    fDateTo:    document.getElementById('f-date-to'),
    btnClear:   document.getElementById('btn-clear-filters'),

    docsBody:   document.getElementById('docs-body'),
    docsTable:  document.getElementById('docs-table'),
    emptyState: document.getElementById('empty-state'),

    btnExportAll: document.getElementById('btn-export-all'),
    btnImportAll: document.getElementById('btn-import-all'),
    fileImport:   document.getElementById('hidden-import'),

    toastHost: document.getElementById('toast-host')
  };

  // ---------- Init ----------

  function init() {
    if (!Store.listProfiles().length) {
      // Onboarding: no profiles → push to settings.
      document.querySelector('.page').innerHTML = ''
        + '<div class="empty" style="margin-top:40px;">'
        +   '<h3>Welcome to Invoice Studio</h3>'
        +   '<p>Start by creating a profile (your business identity). You can then add clients and issue documents.</p>'
        +   '<a class="btn btn--primary" href="settings.html">Set up your first profile →</a>'
        + '</div>';
      return;
    }

    autoMarkOverdue();

    populateProfileSwitcher();
    bindEvents();
    paint();
  }

  function populateProfileSwitcher() {
    var profiles = Store.listProfiles();
    var active = Store.getActiveProfile();
    var opts = profiles.map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.name) + '</option>';
    });
    opts.push('<option disabled>──────────</option>');
    opts.push('<option value="__new__">+ New profile…</option>');
    opts.push('<option value="__manage__">Manage profiles…</option>');
    els.profileSwitcher.innerHTML = opts.join('');
    if (active) els.profileSwitcher.value = active.id;
  }

  function bindEvents() {
    els.profileSwitcher.addEventListener('change', function () {
      var v = els.profileSwitcher.value;
      if (v === '__new__') {
        location.href = 'settings.html?new=profile';
        return;
      }
      if (v === '__manage__') {
        location.href = 'settings.html';
        return;
      }
      Store.setActiveProfile(v);
      paint();
    });
    els.showAllProfiles.addEventListener('change', function () {
      state.showAllProfiles = els.showAllProfiles.checked;
      paint();
    });

    els.fSearch.addEventListener('input',  function () { state.search = els.fSearch.value.toLowerCase(); paintTable(); });
    els.fType.addEventListener('change',   function () { state.type = els.fType.value;  paintTable(); });
    els.fStatus.addEventListener('change', function () { state.status = els.fStatus.value; paintTable(); });
    els.fDateFrom.addEventListener('change', function () { state.dateFrom = els.fDateFrom.value; paintTable(); });
    els.fDateTo.addEventListener('change',   function () { state.dateTo = els.fDateTo.value;     paintTable(); });
    els.btnClear.addEventListener('click', function () {
      state.search = ''; state.type = 'all'; state.status = 'all'; state.dateFrom = ''; state.dateTo = '';
      els.fSearch.value = ''; els.fType.value = 'all'; els.fStatus.value = 'all';
      els.fDateFrom.value = ''; els.fDateTo.value = '';
      paintTable();
    });

    els.docsBody.addEventListener('click', onRowAction);

    els.btnExportAll.addEventListener('click', function (e) { e.preventDefault(); exportJson(); });
    els.btnImportAll.addEventListener('click', function (e) { e.preventDefault(); els.fileImport.click(); });
    els.fileImport.addEventListener('change', onImportPick);
  }

  // ---------- Auto-overdue ----------

  function autoMarkOverdue() {
    var settings = Store.getSettings();
    var days = (settings && settings.overdueDays) || 30;
    var today = new Date();
    var changed = false;
    var docs = Store.listDocuments();
    docs.forEach(function (d) {
      if (d.type !== 'invoice') return;
      if (d.status !== 'sent') return;
      var issued = new Date(d.issueDate + 'T00:00:00');
      if (isNaN(issued.getTime())) return;
      var diffDays = Math.floor((today - issued) / (1000 * 60 * 60 * 24));
      if (diffDays > days) {
        d.status = 'overdue';
        Store.saveDocument(d);
        changed = true;
      }
    });
    return changed;
  }

  // ---------- Paint ----------

  function currentDocs() {
    var docs = Store.listDocuments();
    if (!state.showAllProfiles) {
      var active = Store.getActiveProfile();
      if (active) docs = docs.filter(function (d) { return d.profileId === active.id; });
    }
    return docs;
  }

  function paint() {
    var active = Store.getActiveProfile();
    els.scopeLine.textContent = state.showAllProfiles
      ? 'Showing documents for all profiles.'
      : 'Showing documents for ' + (active ? active.name : '—') + '.';
    paintKpis();
    paintTable();
  }

  function paintKpis() {
    var docs = currentDocs();
    var billed = 0, outstanding = 0, overdueAmt = 0, overdueCount = 0, monthAmt = 0;
    var now = new Date();
    var mYear = now.getFullYear(), mMonth = now.getMonth();

    docs.forEach(function (d) {
      if (d.type !== 'invoice') return;
      var total = Calc.computeTotals(d.items, d.taxMode).grandTotal;
      billed += total;
      if (d.status === 'sent' || d.status === 'overdue') outstanding += total;
      if (d.status === 'overdue') { overdueAmt += total; overdueCount++; }
      var issued = new Date(d.issueDate + 'T00:00:00');
      if (!isNaN(issued.getTime()) && issued.getFullYear() === mYear && issued.getMonth() === mMonth) {
        monthAmt += total;
      }
    });

    els.kpiBilled.textContent       = Calc.formatINR(billed, { fractionDigits: 0 });
    els.kpiOutstanding.textContent  = Calc.formatINR(outstanding, { fractionDigits: 0 });
    els.kpiOverdue.textContent      = Calc.formatINR(overdueAmt, { fractionDigits: 0 });
    els.kpiOverdueCount.textContent = overdueCount + ' document' + (overdueCount === 1 ? '' : 's');
    els.kpiMonth.textContent        = Calc.formatINR(monthAmt, { fractionDigits: 0 });
    var monthName = now.toLocaleString('en-IN', { month: 'long' });
    els.kpiMonthLabel.textContent   = 'Billed in ' + monthName;
  }

  function paintTable() {
    var docs = filterDocs(currentDocs());
    if (!docs.length) {
      els.docsTable.style.display = 'none';
      els.emptyState.style.display = '';
      return;
    }
    els.docsTable.style.display = '';
    els.emptyState.style.display = 'none';

    // newest first
    docs.sort(function (a, b) {
      return (b.issueDate || '').localeCompare(a.issueDate || '');
    });

    els.docsBody.innerHTML = docs.map(rowHtml).join('');
  }

  function filterDocs(docs) {
    return docs.filter(function (d) {
      if (state.type !== 'all' && d.type !== state.type) return false;
      if (state.status !== 'all' && d.status !== state.status) return false;
      if (state.dateFrom && d.issueDate < state.dateFrom) return false;
      if (state.dateTo && d.issueDate > state.dateTo) return false;
      if (state.search) {
        var client = Store.getClient(d.clientId);
        var hay = (d.number + ' ' + (client ? client.companyName : '')).toLowerCase();
        if (hay.indexOf(state.search) === -1) return false;
      }
      return true;
    });
  }

  function rowHtml(d) {
    var client = Store.getClient(d.clientId);
    var total = Calc.computeTotals(d.items, d.taxMode).grandTotal;
    var typePill = d.type === 'proforma'
      ? '<span class="pill pill--proforma">Proforma</span>'
      : '<span class="pill pill--invoice">Invoice</span>';
    var statusPill = '<span class="pill pill--' + d.status + '">' + d.status + '</span>';
    var canConvert = d.type === 'proforma' && !d.convertedToId;
    var actions = ''
      + '<button class="btn btn--ghost btn--sm" data-act="view"      data-id="' + d.id + '" title="View">👁</button>'
      + '<button class="btn btn--ghost btn--sm" data-act="edit"      data-id="' + d.id + '" title="Edit">✏️</button>'
      + (canConvert
          ? '<button class="btn btn--ghost btn--sm" data-act="convert"   data-id="' + d.id + '" title="Convert to invoice">🔄</button>'
          : '')
      + '<button class="btn btn--ghost btn--sm" data-act="duplicate" data-id="' + d.id + '" title="Duplicate">📋</button>'
      + '<button class="btn btn--ghost btn--sm" data-act="delete"    data-id="' + d.id + '" title="Delete">🗑</button>';

    return ''
      + '<tr>'
      +   '<td data-label="Number"><a href="preview.html?id=' + d.id + '"><strong>' + esc(d.number) + '</strong></a></td>'
      +   '<td data-label="Type">'   + typePill   + '</td>'
      +   '<td data-label="Client">' + esc(client ? client.companyName : '—') + '</td>'
      +   '<td data-label="Date">'   + formatDate(d.issueDate) + '</td>'
      +   '<td class="num" data-label="Amount">' + Calc.formatINR(total, { fractionDigits: 0 }) + '</td>'
      +   '<td data-label="Status">' + statusPill + '</td>'
      +   '<td data-label="Actions" style="white-space:nowrap;">' + actions + '</td>'
      + '</tr>';
  }

  function onRowAction(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');

    if (act === 'view') {
      location.href = 'preview.html?id=' + encodeURIComponent(id);
    } else if (act === 'edit') {
      location.href = 'editor.html?id=' + encodeURIComponent(id);
    } else if (act === 'convert') {
      Convert.proformaToInvoice(id).then(function (newId) {
        if (newId) location.href = 'editor.html?id=' + encodeURIComponent(newId);
      });
    } else if (act === 'duplicate') {
      duplicateDoc(id);
    } else if (act === 'delete') {
      if (!confirm('Delete this document? This cannot be undone.')) return;
      Store.deleteDocument(id);
      paint();
      toast('Document deleted');
    }
  }

  function duplicateDoc(id) {
    var src = Store.getDocument(id);
    if (!src) return;
    var profile = Store.getProfile(src.profileId);
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = null;
    copy.number = Store.commitNumber(src.profileId, src.type);
    copy.status = 'draft';
    copy.issueDate = new Date().toISOString().slice(0, 10);
    copy.convertedFromId = null;
    copy.convertedToId = null;
    var saved = Store.saveDocument(copy);
    paint();
    toast('Duplicated as ' + saved.number);
  }

  // ---------- Export / Import ----------

  function exportJson() {
    var json = Store.exportJson();
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'invoice_tool_backup_' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  }

  function onImportPick(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (typeof parsed.schemaVersion !== 'number') throw new Error('Missing schemaVersion field.');
        var mode = confirm('Click OK to MERGE the file with current data.\nClick Cancel to REPLACE current data entirely.')
          ? 'merge' : 'replace';
        if (mode === 'replace' && !confirm('Are you sure? This wipes your current data.')) return;
        Store.importJson(parsed, mode);
        populateProfileSwitcher();
        paint();
        toast('Import complete');
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  // ---------- Helpers ----------

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' toast--error' : ' toast--success');
    el.textContent = msg;
    els.toastHost.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
