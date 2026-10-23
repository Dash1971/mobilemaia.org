# Mobile Maia website

This is the standalone public website, hosted by GitHub Pages. Serve only `site/`.
It is independent of the Stable and Preview app repositories and release gates.

- Keep the site buildless, accessible, responsive, and portable. Use local assets
  and system fonts. Do not introduce analytics, trackers, accounts, or dependencies
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
