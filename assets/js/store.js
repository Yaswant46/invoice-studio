/* store.js — localStorage CRUD, schema, migrations, seed data.
 * Exposes a global `Store` object. No ES modules (works over file:// + GH Pages).
 */
(function (global) {
  'use strict';

  var ROOT_KEY = 'invoice_tool_v1';
  var SCHEMA_VERSION = 1;

  // ---------- ID generation (nanoid-style, ~64 bits) ----------
  var ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  function makeId(prefix) {
    var s = '';
    var bytes = new Uint8Array(10);
    (global.crypto || global.msCrypto).getRandomValues(bytes);
    for (var i = 0; i < bytes.length; i++) {
      s += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
    }
    return (prefix ? prefix + '_' : '') + s;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // ---------- Seed data (matches the Deevyashakti proforma) ----------
  function buildSeed() {
    var profileId = 'prof_seedacm0001';
    var clientId = 'cli_seeddipl0001';
    var docId = 'doc_seedpi000001';
    var ts = '2026-05-21T10:00:00Z';

    return {
      schemaVersion: SCHEMA_VERSION,
      activeProfileId: profileId,
      profiles: [
        {
          id: profileId,
          name: 'A. Chandra Mohan',
          tagline: 'Industrial Layout & Engineering Consultancy',
          mobile: '+91 8124969233',
          email: 'cmadiraju333@gmail.com',
          address: '',
          gstin: '',
          pan: '',
          stateCode: '36',
          bank: {
            accountName: 'A. Chandra Mohan',
            bankName: '',
            accountNumber: '',
            ifsc: '',
            branch: '',
            upi: ''
          },
          counters: {
            proforma: { prefix: 'PI', year: '2026', next: 2 },
            invoice:  { prefix: 'INV', year: '2026', next: 1 }
          },
          createdAt: ts
        }
      ],
      clients: [
        {
          id: clientId,
          companyName: 'DEEVYASHAKTI INDIA PRIVATE LIMITED',
          address: 'Kondurg, Ranga Reddy District, Telangana',
          gstin: '36AACCD2632C1Z8',
          attention: 'Mr. Keshav Agarwal',
          stateCode: '36',
          createdAt: ts
        }
      ],
      documents: [
        {
          id: docId,
          type: 'proforma',
          number: 'PI/2026/01',
          profileId: profileId,
          clientId: clientId,
          issueDate: '2026-05-21',
          offerRef: 'TCO/2026/05-14 dtd 20/05/2026',
          clientRef: 'SO/DIPL/ENG/2026-27/001 dtd 20/05/2026',
          items: [
            {
              description: '20% Advance — Mobilization',
              subDescription: 'Payable on release of the Purchase / Service Order.',
              qty: 1, unitPrice: 60000, gstPercent: 0
            },
            {
              description: '20% Phase 1 — Site Visit',
              subDescription: 'On conclusion of the 1st meeting and site visit.',
              qty: 1, unitPrice: 60000, gstPercent: 0
            },
            {
              description: '40% Phase 2 — Tentative Layouts',
              subDescription: 'On submission of 2–3 tentative layout options and the 2nd meeting.',
              qty: 1, unitPrice: 120000, gstPercent: 0
            },
            {
              description: '20% Phase 3 — Final Deliverables',
              subDescription: 'On submission of the final recommended AutoCAD layout and final area documents.',
              qty: 1, unitPrice: 60000, gstPercent: 0
            }
          ],
          taxMode: 'none',
          paymentSchedule: [
            { percent: 20, label: 'Advance',          description: 'On release of the Purchase / Service Order.' },
            { percent: 20, label: 'Phase 1',          description: 'On conclusion of the 1st meeting and site visit.' },
            { percent: 40, label: 'Phase 2',          description: 'On submission of 2–3 tentative layout options and the 2nd meeting.' },
            { percent: 20, label: 'Phase 3 — Final',  description: 'On submission of the final recommended AutoCAD layout and final area documents.' }
          ],
          showBankDetails: true,
          showPaymentSchedule: true,
          notes: '',
          status: 'draft',
          convertedFromId: null,
          convertedToId: null,
          createdAt: ts,
          updatedAt: ts
        }
      ],
      settings: {
        currency: 'INR',
        currencySymbol: '\u20B9',
        locale: 'en-IN',
        overdueDays: 30
      }
    };
  }

  // ---------- Migrations ----------
  // Each migration takes the current state and returns the migrated state.
  // Add new entries when bumping SCHEMA_VERSION.
  var migrations = {
    // 0 -> 1 example placeholder (no-op since v1 is initial)
    // 1: function (state) { ... return state; }
  };

  function migrate(state) {
    var v = state.schemaVersion || 0;
    while (v < SCHEMA_VERSION) {
      var fn = migrations[v + 1];
      if (!fn) break;
      state = fn(state);
      v++;
      state.schemaVersion = v;
    }
    return state;
  }

  // ---------- Load / save ----------
  function loadRaw() {
    try {
      var raw = localStorage.getItem(ROOT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Store: failed to parse localStorage; resetting.', e);
      return null;
    }
  }

  function persist(state) {
    localStorage.setItem(ROOT_KEY, JSON.stringify(state));
  }

  function load() {
    var state = loadRaw();
    if (!state) {
      state = buildSeed();
      persist(state);
      return state;
    }
    var migrated = migrate(state);
    if (migrated !== state) persist(migrated);
    return migrated;
  }

  // ---------- Generic helpers ----------
  function findById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function indexById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  // ---------- Public API ----------
  var Store = {
    ROOT_KEY: ROOT_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    makeId: makeId,

    // Whole-state access
    getState: function () { return load(); },
    setState: function (state) { persist(state); return state; },
    reset: function () {
      var fresh = buildSeed();
      persist(fresh);
      return fresh;
    },
    wipe: function () { localStorage.removeItem(ROOT_KEY); },
    sizeBytes: function () {
      var raw = localStorage.getItem(ROOT_KEY);
      return raw ? raw.length : 0;
    },

    // ----- Profiles -----
    listProfiles: function () { return load().profiles.slice(); },
    getProfile: function (id) { return findById(load().profiles, id); },
    getActiveProfile: function () {
      var s = load();
      return findById(s.profiles, s.activeProfileId) || s.profiles[0] || null;
    },
    setActiveProfile: function (id) {
      var s = load();
      s.activeProfileId = id;
      persist(s);
    },
    saveProfile: function (profile) {
      var s = load();
      if (!profile.id) {
        profile.id = makeId('prof');
        profile.createdAt = nowIso();
        if (!profile.counters) {
          var yr = String(new Date().getFullYear());
          profile.counters = {
            proforma: { prefix: 'PI', year: yr, next: 1 },
            invoice:  { prefix: 'INV', year: yr, next: 1 }
          };
        }
        if (!profile.bank) profile.bank = { accountName:'', bankName:'', accountNumber:'', ifsc:'', branch:'', upi:'' };
        s.profiles.push(profile);
        if (!s.activeProfileId) s.activeProfileId = profile.id;
      } else {
        var i = indexById(s.profiles, profile.id);
        if (i < 0) throw new Error('Profile not found: ' + profile.id);
        s.profiles[i] = profile;
      }
      persist(s);
      return profile;
    },
    deleteProfile: function (id) {
      var s = load();
      var docCount = s.documents.filter(function (d) { return d.profileId === id; }).length;
      if (docCount > 0) {
        throw new Error('Cannot delete profile with ' + docCount + ' document(s).');
      }
      s.profiles = s.profiles.filter(function (p) { return p.id !== id; });
      if (s.activeProfileId === id) s.activeProfileId = s.profiles[0] ? s.profiles[0].id : null;
      persist(s);
    },
    countDocsByProfile: function (id) {
      return load().documents.filter(function (d) { return d.profileId === id; }).length;
    },

    // ----- Clients -----
    listClients: function () { return load().clients.slice(); },
    getClient: function (id) { return findById(load().clients, id); },
    saveClient: function (client) {
      var s = load();
      if (!client.id) {
        client.id = makeId('cli');
        client.createdAt = nowIso();
        s.clients.push(client);
      } else {
        var i = indexById(s.clients, client.id);
        if (i < 0) throw new Error('Client not found: ' + client.id);
        s.clients[i] = client;
      }
      persist(s);
      return client;
    },
    deleteClient: function (id) {
      var s = load();
      var docCount = s.documents.filter(function (d) { return d.clientId === id; }).length;
      if (docCount > 0) {
        throw new Error('Cannot delete client with ' + docCount + ' document(s).');
      }
      s.clients = s.clients.filter(function (c) { return c.id !== id; });
      persist(s);
    },
    countDocsByClient: function (id) {
      return load().documents.filter(function (d) { return d.clientId === id; }).length;
    },

    // ----- Documents -----
    listDocuments: function () { return load().documents.slice(); },
    getDocument: function (id) { return findById(load().documents, id); },
    saveDocument: function (doc) {
      var s = load();
      var ts = nowIso();
      if (!doc.id) {
        doc.id = makeId('doc');
        doc.createdAt = ts;
        doc.updatedAt = ts;
        s.documents.push(doc);
      } else {
        var i = indexById(s.documents, doc.id);
        if (i < 0) throw new Error('Document not found: ' + doc.id);
        doc.updatedAt = ts;
        if (!doc.createdAt) doc.createdAt = s.documents[i].createdAt || ts;
        s.documents[i] = doc;
      }
      persist(s);
      return doc;
    },
    deleteDocument: function (id) {
      var s = load();
      s.documents = s.documents.filter(function (d) { return d.id !== id; });
      // also clear back-references on linked docs
      s.documents.forEach(function (d) {
        if (d.convertedFromId === id) d.convertedFromId = null;
        if (d.convertedToId === id) d.convertedToId = null;
      });
      persist(s);
    },

    // Atomically increment a profile's counter for a given type and return
    // the formatted number that was just consumed.
    commitNumber: function (profileId, type) {
      var s = load();
      var p = findById(s.profiles, profileId);
      if (!p) throw new Error('Profile not found: ' + profileId);
      var c = p.counters[type];
      if (!c) throw new Error('Unknown counter type: ' + type);
      var num = c.prefix + '/' + c.year + '/' + String(c.next).padStart(2, '0');
      c.next += 1;
      persist(s);
      return num;
    },

    // ----- Settings -----
    getSettings: function () { return load().settings; },
    saveSettings: function (settings) {
      var s = load();
      s.settings = Object.assign({}, s.settings, settings);
      persist(s);
      return s.settings;
    },

    // ----- Export / Import -----
    exportJson: function () {
      return JSON.stringify(load(), null, 2);
    },
    importJson: function (json, mode) {
      // mode: 'replace' | 'merge'
      var incoming = typeof json === 'string' ? JSON.parse(json) : json;
      if (!incoming || typeof incoming !== 'object') throw new Error('Invalid JSON payload.');
      if (typeof incoming.schemaVersion !== 'number') throw new Error('Missing schemaVersion.');
      incoming = migrate(incoming);

      if (mode === 'replace' || !mode) {
        persist(incoming);
        return incoming;
      }
      // merge: append non-duplicate ids; keep current settings unless missing
      var current = load();
      function mergeList(curr, inc) {
        var ids = {};
        curr.forEach(function (x) { ids[x.id] = true; });
        inc.forEach(function (x) { if (!ids[x.id]) curr.push(x); });
        return curr;
      }
      current.profiles  = mergeList(current.profiles,  incoming.profiles  || []);
      current.clients   = mergeList(current.clients,   incoming.clients   || []);
      current.documents = mergeList(current.documents, incoming.documents || []);
      current.settings  = Object.assign({}, incoming.settings || {}, current.settings);
      persist(current);
      return current;
    }
  };

  global.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);
