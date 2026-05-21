/* settings.js — Profiles, Clients, Data tabs */
(function () {
  'use strict';

  // ---------- DOM ----------
  var els = {
    tabs:       document.querySelectorAll('.tabs__tab'),
    panels:     document.querySelectorAll('.tab-panel'),

    profilesList: document.getElementById('profiles-list'),
    btnNewProfile: document.getElementById('btn-new-profile'),
    clientsList: document.getElementById('clients-list'),
    btnNewClient: document.getElementById('btn-new-client'),

    storageSize: document.getElementById('storage-size'),
    btnExport:   document.getElementById('btn-export'),
    fileImport:  document.getElementById('file-import'),
    btnReset:    document.getElementById('btn-reset'),

    // Profile modal
    profileModal:  document.getElementById('profile-modal'),
    pmTitle:       document.getElementById('pm-title'),
    pmId:          document.getElementById('pm-id'),
    pmName:        document.getElementById('pm-name'),
    pmTagline:     document.getElementById('pm-tagline'),
    pmMobile:      document.getElementById('pm-mobile'),
    pmEmail:       document.getElementById('pm-email'),
    pmAddress:     document.getElementById('pm-address'),
    pmGstin:       document.getElementById('pm-gstin'),
    pmPan:         document.getElementById('pm-pan'),
    pmStateCode:   document.getElementById('pm-statecode'),
    pmBankName:    document.getElementById('pm-bank-name'),
    pmBankBank:    document.getElementById('pm-bank-bank'),
    pmBankAcNo:    document.getElementById('pm-bank-acno'),
    pmBankIfsc:    document.getElementById('pm-bank-ifsc'),
    pmBankBranch:  document.getElementById('pm-bank-branch'),
    pmBankUpi:     document.getElementById('pm-bank-upi'),
    pmPiPrefix:    document.getElementById('pm-pi-prefix'),
    pmPiYear:      document.getElementById('pm-pi-year'),
    pmInvPrefix:   document.getElementById('pm-inv-prefix'),
    pmInvYear:     document.getElementById('pm-inv-year'),
    pmPiNext:      document.getElementById('pm-pi-next'),
    pmInvNext:     document.getElementById('pm-inv-next'),
    pmSave:        document.getElementById('pm-save'),
    pmCancel:      document.getElementById('pm-cancel'),

    // Client modal
    clientModal:  document.getElementById('client-modal'),
    cmTitle:      document.getElementById('cm-title'),
    cmId:         document.getElementById('cm-id'),
    cmCompany:    document.getElementById('cm-company'),
    cmAddress:    document.getElementById('cm-address'),
    cmGstin:      document.getElementById('cm-gstin'),
    cmStateCode:  document.getElementById('cm-statecode'),
    cmAttn:       document.getElementById('cm-attn'),
    cmSave:       document.getElementById('cm-save'),
    cmCancel:     document.getElementById('cm-cancel'),

    // Import modal
    importModal:  document.getElementById('import-modal'),
    imSummary:    document.getElementById('im-summary'),
    imConfirm:    document.getElementById('im-confirm'),
    imCancel:     document.getElementById('im-cancel'),

    toastHost: document.getElementById('toast-host')
  };

  var pendingImport = null;

  // ---------- Init ----------

  function init() {
    bindTabs();
    bindData();
    bindProfileModal();
    bindClientModal();
    renderProfiles();
    renderClients();
    renderStorageSize();

    // Auto-open modals when arrived via ?new=profile or ?new=client.
    var qs = new URLSearchParams(location.search);
    var newWhat = qs.get('new');
    if (newWhat === 'profile') openProfileModal(null);
    else if (newWhat === 'client') {
      switchTab('clients');
      openClientModal(null);
    }
  }

  function switchTab(name) {
    els.tabs.forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-tab') === name); });
    els.panels.forEach(function (p) {
      p.style.display = p.getAttribute('data-tab-panel') === name ? '' : 'none';
    });
  }

  // ---------- Tabs ----------

  function bindTabs() {
    els.tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var name = tab.getAttribute('data-tab');
        els.tabs.forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        els.panels.forEach(function (p) {
          p.style.display = p.getAttribute('data-tab-panel') === name ? '' : 'none';
        });
      });
    });
  }

  // ---------- Profiles ----------

  function renderProfiles() {
    var profiles = Store.listProfiles();
    var active = Store.getActiveProfile();
    if (!profiles.length) {
      els.profilesList.innerHTML = ''
        + '<div class="empty"><h3>No profiles yet</h3>'
        + '<p>Create one to start issuing documents.</p>'
        + '<button class="btn btn--primary" onclick="document.getElementById(\'btn-new-profile\').click()">+ New profile</button></div>';
      return;
    }
    els.profilesList.innerHTML = profiles.map(function (p) {
      var count = Store.countDocsByProfile(p.id);
      var isActive = active && active.id === p.id;
      return ''
        + '<div class="card"><div class="card__body" style="display:flex;align-items:flex-start;gap:16px;">'
        +   '<div style="flex:1;">'
        +     '<div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">'
        +       '<strong style="font-size:15px;">' + esc(p.name) + '</strong>'
        +       (isActive ? '<span class="pill pill--invoice">Active</span>' : '')
        +     '</div>'
        +     (p.tagline ? '<p style="margin:0 0 6px;color:var(--app-muted);font-size:13px;">' + esc(p.tagline) + '</p>' : '')
        +     '<p style="margin:0;font-size:12px;color:var(--app-muted-soft);">'
        +       (p.gstin ? 'GSTIN ' + esc(p.gstin) + ' · ' : '')
        +       count + ' document' + (count === 1 ? '' : 's')
        +     '</p>'
        +   '</div>'
        +   '<div style="display:flex;gap:6px;flex-shrink:0;">'
        +     (isActive ? '' : '<button class="btn btn--sm" data-act="activate" data-id="' + p.id + '">Set active</button>')
        +     '<button class="btn btn--sm" data-act="edit" data-id="' + p.id + '">Edit</button>'
        +     '<button class="btn btn--sm btn--danger" data-act="delete" data-id="' + p.id + '">Delete</button>'
        +   '</div>'
        + '</div></div>';
    }).join('');
  }

  els = els; // (suppress lint hint)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn || !btn.dataset.id) return;
    var id = btn.dataset.id;
    var act = btn.dataset.act;
    if (btn.closest('#profiles-list')) {
      if (act === 'activate') {
        Store.setActiveProfile(id);
        renderProfiles();
        toast('Active profile changed');
      } else if (act === 'edit') {
        openProfileModal(Store.getProfile(id));
      } else if (act === 'delete') {
        var count = Store.countDocsByProfile(id);
        if (count > 0) {
          alert('Cannot delete: profile has ' + count + ' document(s). Delete those first.');
          return;
        }
        if (!confirm('Delete this profile? This cannot be undone.')) return;
        Store.deleteProfile(id);
        renderProfiles();
        toast('Profile deleted');
      }
    } else if (btn.closest('#clients-list')) {
      if (act === 'edit') {
        openClientModal(Store.getClient(id));
      } else if (act === 'delete') {
        var ccount = Store.countDocsByClient(id);
        if (ccount > 0) {
          alert('Cannot delete: client has ' + ccount + ' document(s). Delete those first.');
          return;
        }
        if (!confirm('Delete this client? This cannot be undone.')) return;
        Store.deleteClient(id);
        renderClients();
        toast('Client deleted');
      }
    }
  });

  function bindProfileModal() {
    els.btnNewProfile.addEventListener('click', function () { openProfileModal(null); });
    els.pmCancel.addEventListener('click', function () { els.profileModal.classList.remove('is-open'); });
    els.pmSave.addEventListener('click', saveProfile);
  }

  function openProfileModal(profile) {
    var p = profile || {
      name: '', tagline: '', mobile: '', email: '', address: '',
      gstin: '', pan: '', stateCode: '',
      bank: { accountName:'', bankName:'', accountNumber:'', ifsc:'', branch:'', upi:'' },
      counters: {
        proforma: { prefix: 'PI', year: String(new Date().getFullYear()), next: 1 },
        invoice:  { prefix: 'INV', year: String(new Date().getFullYear()), next: 1 }
      }
    };
    els.pmTitle.textContent = profile ? 'Edit profile' : 'New profile';
    els.pmId.value = p.id || '';
    els.pmName.value = p.name || '';
    els.pmTagline.value = p.tagline || '';
    els.pmMobile.value = p.mobile || '';
    els.pmEmail.value = p.email || '';
    els.pmAddress.value = p.address || '';
    els.pmGstin.value = p.gstin || '';
    els.pmPan.value = p.pan || '';
    els.pmStateCode.value = p.stateCode || '';
    var b = p.bank || {};
    els.pmBankName.value = b.accountName || '';
    els.pmBankBank.value = b.bankName || '';
    els.pmBankAcNo.value = b.accountNumber || '';
    els.pmBankIfsc.value = b.ifsc || '';
    els.pmBankBranch.value = b.branch || '';
    els.pmBankUpi.value = b.upi || '';
    var c = p.counters || {};
    els.pmPiPrefix.value = (c.proforma && c.proforma.prefix) || 'PI';
    els.pmPiYear.value   = (c.proforma && c.proforma.year)   || String(new Date().getFullYear());
    els.pmPiNext.value   = (c.proforma && c.proforma.next)   || 1;
    els.pmInvPrefix.value = (c.invoice && c.invoice.prefix) || 'INV';
    els.pmInvYear.value   = (c.invoice && c.invoice.year)   || String(new Date().getFullYear());
    els.pmInvNext.value   = (c.invoice && c.invoice.next)   || 1;
    els.profileModal.classList.add('is-open');
    els.pmName.focus();
  }

  function saveProfile() {
    var name = els.pmName.value.trim();
    if (!name) { alert('Display name is required.'); return; }
    var id = els.pmId.value || null;
    var existing = id ? Store.getProfile(id) : null;
    var payload = {
      id: id,
      name: name,
      tagline: els.pmTagline.value,
      mobile: els.pmMobile.value,
      email: els.pmEmail.value,
      address: els.pmAddress.value,
      gstin: els.pmGstin.value,
      pan: els.pmPan.value,
      stateCode: els.pmStateCode.value,
      bank: {
        accountName: els.pmBankName.value,
        bankName: els.pmBankBank.value,
        accountNumber: els.pmBankAcNo.value,
        ifsc: els.pmBankIfsc.value,
        branch: els.pmBankBranch.value,
        upi: els.pmBankUpi.value
      },
      counters: {
        proforma: {
          prefix: els.pmPiPrefix.value || 'PI',
          year: els.pmPiYear.value || String(new Date().getFullYear()),
          next: Math.max(1, Number(els.pmPiNext.value) || 1)
        },
        invoice: {
          prefix: els.pmInvPrefix.value || 'INV',
          year: els.pmInvYear.value || String(new Date().getFullYear()),
          next: Math.max(1, Number(els.pmInvNext.value) || 1)
        }
      },
      createdAt: existing ? existing.createdAt : undefined
    };
    Store.saveProfile(payload);
    els.profileModal.classList.remove('is-open');
    renderProfiles();
    toast(id ? 'Profile updated' : 'Profile created');
  }

  // ---------- Clients ----------

  function renderClients() {
    var clients = Store.listClients();
    if (!clients.length) {
      els.clientsList.innerHTML = ''
        + '<div class="empty"><h3>No clients yet</h3>'
        + '<p>Add clients to bill them on documents.</p>'
        + '<button class="btn btn--primary" onclick="document.getElementById(\'btn-new-client\').click()">+ New client</button></div>';
      return;
    }
    els.clientsList.innerHTML = clients.map(function (c) {
      var count = Store.countDocsByClient(c.id);
      return ''
        + '<div class="card"><div class="card__body" style="display:flex;align-items:flex-start;gap:16px;">'
        +   '<div style="flex:1;">'
        +     '<strong style="font-size:15px;display:block;margin-bottom:4px;">' + esc(c.companyName) + '</strong>'
        +     (c.address  ? '<p style="margin:0 0 4px;color:var(--app-muted);font-size:13px;">' + esc(c.address) + '</p>' : '')
        +     '<p style="margin:0;font-size:12px;color:var(--app-muted-soft);">'
        +       (c.gstin ? 'GSTIN ' + esc(c.gstin) + (c.stateCode ? ' · State ' + esc(c.stateCode) : '') + ' · ' : '')
        +       count + ' document' + (count === 1 ? '' : 's')
        +     '</p>'
        +   '</div>'
        +   '<div style="display:flex;gap:6px;flex-shrink:0;">'
        +     '<button class="btn btn--sm" data-act="edit" data-id="' + c.id + '">Edit</button>'
        +     '<button class="btn btn--sm btn--danger" data-act="delete" data-id="' + c.id + '">Delete</button>'
        +   '</div>'
        + '</div></div>';
    }).join('');
  }

  function bindClientModal() {
    els.btnNewClient.addEventListener('click', function () { openClientModal(null); });
    els.cmCancel.addEventListener('click', function () { els.clientModal.classList.remove('is-open'); });
    els.cmSave.addEventListener('click', saveClient);
  }

  function openClientModal(client) {
    var c = client || { companyName:'', address:'', gstin:'', stateCode:'', attention:'' };
    els.cmTitle.textContent = client ? 'Edit client' : 'New client';
    els.cmId.value = c.id || '';
    els.cmCompany.value = c.companyName || '';
    els.cmAddress.value = c.address || '';
    els.cmGstin.value = c.gstin || '';
    els.cmStateCode.value = c.stateCode || '';
    els.cmAttn.value = c.attention || '';
    els.clientModal.classList.add('is-open');
    els.cmCompany.focus();
  }

  function saveClient() {
    var name = els.cmCompany.value.trim();
    if (!name) { alert('Company name is required.'); return; }
    var id = els.cmId.value || null;
    var existing = id ? Store.getClient(id) : null;
    Store.saveClient({
      id: id,
      companyName: name,
      address: els.cmAddress.value,
      gstin: els.cmGstin.value,
      stateCode: els.cmStateCode.value,
      attention: els.cmAttn.value,
      createdAt: existing ? existing.createdAt : undefined
    });
    els.clientModal.classList.remove('is-open');
    renderClients();
    toast(id ? 'Client updated' : 'Client created');
  }

  // ---------- Data ----------

  function bindData() {
    els.btnExport.addEventListener('click', exportJson);
    els.fileImport.addEventListener('change', handleImportPick);
    els.btnReset.addEventListener('click', resetAll);
    els.imCancel.addEventListener('click', function () { els.importModal.classList.remove('is-open'); pendingImport = null; });
    els.imConfirm.addEventListener('click', confirmImport);
  }

  function renderStorageSize() {
    var bytes = Store.sizeBytes();
    var kb = (bytes / 1024).toFixed(1);
    els.storageSize.textContent = kb + ' KB';
  }

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

  function handleImportPick(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (typeof parsed.schemaVersion !== 'number') throw new Error('Missing schemaVersion field.');
        pendingImport = parsed;
        var pCount = (parsed.profiles || []).length;
        var cCount = (parsed.clients || []).length;
        var dCount = (parsed.documents || []).length;
        els.imSummary.textContent = 'File contains ' + pCount + ' profile(s), ' + cCount + ' client(s), ' + dCount + ' document(s).';
        els.importModal.classList.add('is-open');
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
      }
      e.target.value = ''; // reset so picking same file again triggers change
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pendingImport) return;
    var mode = document.querySelector('input[name="im-mode"]:checked').value;
    try {
      Store.importJson(pendingImport, mode);
      els.importModal.classList.remove('is-open');
      pendingImport = null;
      renderProfiles();
      renderClients();
      renderStorageSize();
      toast('Import complete');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  }

  function resetAll() {
    if (!confirm('This wipes ALL profiles, clients, and documents in this browser. Are you sure?')) return;
    if (!confirm('Final confirmation: reset all data?')) return;
    Store.reset();
    renderProfiles();
    renderClients();
    renderStorageSize();
    toast('Data reset to seed');
  }

  // ---------- Helpers ----------

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
