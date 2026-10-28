# Mobile Maia website

This is the standalone public website, hosted by GitHub Pages. Deploy `site/`
plus the generated browser app bundle; never native build artifacts or models.
It is independent of the Stable and Preview app repositories and release gates.

- Absolute user constraint: Mobile Maia Android app repositories are read-only.
  Never edit, commit, push or release Android app code from this website task.
  Export the pinned source read-only; browser transformations belong only in
  this repository and its task-owned disposable web-build copies. Preserve the
  existing Android/browser-Wasm experience when fixing WebKit JS compatibility.

- Before changing the browser app or upgrading its app-source pin, read
  `docs/WEB_ADAPTATIONS.md`. Update that register with every web-specific
  behavior/adapter change and follow its source-upgrade checklist.

- Keep the homepage/research buildless, accessible, responsive, and portable.
  The browser app builds the pinned Mobile Maia Flutter UI with platform adapters;
  do not maintain a separate HTML/JavaScript recreation of app screens or labels.
  Use local assets and fonts (system fonts for ordinary website pages). Do not introduce analytics, trackers, accounts, or dependencies
  without a concrete product need and user authorization.
- Check current Stable documentation before making app claims. Keep Preview
  features and downloads clearly separate. Do not publish app releases here.
- Link to official release pages; never check APKs or model binaries into this repo.
- Preserve screenshot provenance and attribution in `ASSETS.md` and `site/about.html`.
- Run `python3 tools/check_site.py`; visually check desktop and mobile after layout
  changes. Keep task-owned temporary output in ignored `.scratch/` and stop preview
  processes when finished.
- The custom domain must be owned and verified before it is attached to Pages.
  Follow `docs/domain-setup.md`. Do not add a CNAME while domain purchase is pending.
