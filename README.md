# Invoice Studio

A fully client-side proforma & tax invoice generator. No backend, no build step, no frameworks — vanilla HTML/CSS/JS only. All data stays in your browser's `localStorage`, with JSON export/import for backup.

Designed for hosting on GitHub Pages, or for opening `index.html` directly from disk (`file://`).

---

## Features

- **Two document types**: Proforma Invoice (no GST) and Tax Invoice (CGST+SGST or IGST).
- **Auto-numbering** per profile, per type (e.g. `PI/2026/01`, `INV/2026/01`). Override any number manually without burning the counter.
- **Proforma → Invoice conversion**: clones items, schedule, and references; assigns a new invoice number; back-links both documents.
- **Live A4 preview** while you edit, mirrored in an iframe alongside the form.
- **PDF export** via `html2pdf.js` (A4 portrait, 0 margin, image quality 0.98). Filename pattern: `<DocNumber>_<ClientShortName>.pdf`.
- **Dashboard KPIs**: total billed, outstanding, overdue, this-month. Toggle between active profile and all profiles.
- **Auto-overdue**: invoices in `sent` status flip to `overdue` after 30 days (configurable in `settings.overdueDays`).
- **Profiles & clients**: full CRUD with delete protection when documents exist.
- **JSON backup**: download/restore your entire dataset. Merge or replace on import.

---

## Quick start (local)

Just open `index.html` in any modern browser. There's no install step, no build, no server required.

```bash
# macOS
open index.html

# Or double-click index.html in Finder/Explorer.
```

On first load you'll see a seeded Deevyashakti proforma (`PI/2026/01`) under profile **A. Chandra Mohan**. Use **Settings → Data → Reset all data** to remove it and start fresh.

> **Note on `file://`**: Everything works opened directly from disk. The only network request the app makes is to a CDN for `html2pdf.js` (used for PDF export); if you're offline, every page still loads but PDF export will be unavailable. Vendor the script locally to remove that dependency — see "Going fully offline" below.

---

## Deploy to GitHub Pages

1. Create a new repo and push this folder to `main`.
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Invoice Studio"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git push -u origin main
   ```
2. In the repo settings → **Pages**, select:
   - **Source**: Deploy from a branch
   - **Branch**: `main` / `/ (root)`
3. Save. After ~30s the site will be live at `https://<your-user>.github.io/<your-repo>/`.

No build step, no CI configuration needed.

---

## File structure

```
/
├── index.html              Dashboard
├── editor.html             Create / edit a document
├── preview.html            A4 preview + PDF export
├── settings.html           Profiles, clients, data
├── README.md
└── assets/
    ├── css/
    │   ├── app.css         Dashboard, editor, settings UI
    │   └── invoice.css     A4 template (print-ready)
    └── js/
        ├── store.js        localStorage CRUD, schema, migrations, seed
        ├── numbering.js    Per-profile, per-type counters
        ├── calc.js         Totals, INR formatting, number-to-words
        ├── render.js       A4 HTML generation
        ├── pdf.js          html2pdf.js wrapper + filename builder
        ├── convert.js      Proforma → Invoice flow
        ├── dashboard.js    index.html
        ├── editor.js       editor.html
        └── settings.js     settings.html
```

---

## Data & schema

All data lives under a single `localStorage` key: `invoice_tool_v1`. The current schema version is **1**. See `assets/js/store.js` for the full shape — top-level keys are `schemaVersion`, `activeProfileId`, `profiles`, `clients`, `documents`, `settings`.

**Migrations** are handled by `Store.migrate()` — bump `SCHEMA_VERSION` in `store.js` and add a `migrations[v→v+1]` function when changing the schema.

**Backup**: Use **Settings → Data → Export JSON** (or the footer link on the dashboard). The export is a single JSON file containing the full state. Importing offers Merge (add anything new without overwriting) or Replace (wipe and use the file as-is).

---

## Numbering rules

- Each profile has independent counters for `proforma` and `invoice`, with editable `prefix`, `year`, and `next` values (see Settings → Profiles → Edit → Numbering).
- New documents preview the next number live. The counter is only consumed when you save **and** the number still matches the auto-generated one.
- Override the number manually in the editor and the counter is left alone — useful for back-dating or matching legacy sequences.

---

## Tax modes

| Mode    | Behavior                                                |
|---------|---------------------------------------------------------|
| `none`  | Line GST% values ignored. Grand total = subtotal.       |
| `intra` | Sum of line GST split equally as CGST + SGST.           |
| `inter` | Sum of line GST shown as IGST only.                     |

The editor suggests intra/inter based on whether the profile's `stateCode` matches the client's.

---

## Status lifecycle

`draft` → `sent` → `paid` (terminal) or `overdue` (auto, after 30 days) → `paid`.
Proformas additionally have `converted` (set automatically when you convert them to an invoice).

You can override any status manually from the preview toolbar.

---

## Going fully offline

If you don't want a CDN dependency for PDF export, download `html2pdf.bundle.min.js` into `assets/vendor/` and update the `<script>` tag in `preview.html`:

```html
<!-- before -->
<script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js"></script>

<!-- after -->
<script src="assets/vendor/html2pdf.bundle.min.js"></script>
```

Everything else is already self-contained.

---

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). Uses `localStorage`, `crypto.getRandomValues`, `Intl.NumberFormat` with the `en-IN` locale, and CSS Grid. No IE support.

---

## Known limitations (v1)

- Single-device. No cloud sync, no auth.
- No multi-currency (₹ INR only).
- No HSN/SAC code field on line items.
- QR code on bank block is a placeholder; not generated.
- No recurring invoices, no email sending, no logo upload.

---

## License

Personal use. Adapt as needed.
