# Initial website verification

Date: 2026-10-24, Asia/Tokyo.

- Repository: <https://github.com/Dash1971/mobilemaia.org> (public).
- Published site: <https://dash1971.github.io/mobilemaia.org/>.
- Website source verified: `93570cb9e9b2655254c034ab8a3b6b6b570072da`.
- [Check and deploy workflow](https://github.com/Dash1971/mobilemaia.org/actions/runs/40039721418): successful.
- GitHub Pages uses Actions deployment; HTTPS is enabled. No custom domain is
  attached while purchase and ownership verification are pending.
- `python3 tools/check_site.py` passed: three HTML pages, twelve served files,
  741,844 bytes. Local links, fragments, ARIA references, asset paths, basic
  metadata, and the static-site size budget passed. `git diff --check` passed.
- HTTP 200 responses for the published homepage, privacy/credits page, stylesheet,
  JavaScript, and main screenshot. Their response bytes matched local source
  exactly. Full source asset hashes are retained in `site-hashes-2026-10-24.json`.
- Browser visual inspection: 320 px and 390 px phone layouts, 665 px pane layout,
  and 1280 px desktop layout (the phone and desktop sizes used a local iframe
  viewport harness). Narrow-header overlap found during inspection was fixed.
- Browser interaction: screenshot selection changed the displayed image and
  selected state; enlargement opened an accessible modal; Escape closed it;
  FAQ disclosure opened its answer; anchor navigation and sticky header were
  visually checked. Published homepage loaded in the browser successfully.
- [Published-page screenshot](published-preview.png) is a browser capture at the
  available 665 px pane width. It is verification evidence, not a website asset.
- The default screenshot, downloads, content, and native FAQ work without custom
  JavaScript by construction. This pass did not independently disable JavaScript
  in the browser or perform a formal accessibility audit.
- Official download and help destinations come from the pinned Stable README.
  No APKs were downloaded or installed as part of website verification.
- Stable and Preview application source and release tooling were not modified.
  This repository's validation/deployment only publishes static website files;
  no companion app tooling port or app release qualification applies.
- Both task-owned preview servers were stopped; task-owned scratch source
  snapshots and the responsive harness were removed. See
  `cleanup-2026-10-24.json` for removed paths and volume free space before/after.

Pending external setup: completed domain purchase, GitHub ownership-verification
TXT record, apex/www DNS configuration, custom-domain attachment, and custom-domain
HTTPS checks. The exact sequence is in [domain setup](domain-setup.md).
