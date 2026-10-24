# mobilemaia.org domain cutover

Date: 2026-10-24 (Asia/Tokyo).

## Ownership and routing

- GitHub successfully verified ownership for the Dash1971 personal account.
  The account-specific challenge TXT record remains published at 1984.
- The Pages repository is configured with `cname: mobilemaia.org` and uses
  GitHub Actions deployment. Registration and authoritative DNS remain at 1984.
- The apex publishes exactly `185.199.108.153`, `185.199.109.153`,
  `185.199.110.153`, and `185.199.111.153` (TTL 900).
- `www.mobilemaia.org` is a CNAME to `dash1971.github.io.` (TTL 900).
- The old parking address `93.95.224.44` and wildcard CNAME were removed.
- No apex AAAA or restrictive CAA records were found. The existing MX records
  (`mx1.1984.is`, priority 10; `mx2.1984.is`, priority 20) were preserved.
- Records were read directly from 1984's authoritative nameservers and checked
  through Google's public DNS-over-HTTPS resolver after publication.
- GitHub serves the homepage for the apex hostname (HTTP 200, checked directly
  against a GitHub Pages address while recursive DNS caches were updating).

## Website source

- Canonical and Open Graph URLs, social icon URL, 404 home link, robots sitemap
  reference, and sitemap locations now use `https://mobilemaia.org/`.
- Website commit: `f17988085ffe3b1f9c7013dd8ca376938b87e519`.
- [Validation and deployment](https://github.com/Dash1971/mobilemaia.org/actions/runs/40046607536)
  passed. Local `python3 tools/check_site.py` and `git diff --check` passed.
- These are domain/metadata changes only. App source, Stable/Preview tooling,
  release gates, and app distribution channels were not changed.

## HTTPS

GitHub approved a Let's Encrypt certificate for `mobilemaia.org`, expiring
2027-01-22, and HTTPS enforcement is enabled. Python's default trust store and
hostname verification accepted the live certificate using TLS 1.3. No custom
trust settings or certificate-verification bypasses were used.

The HTTPS homepage, privacy/credits page, stylesheet, JavaScript, and main app
screenshot all returned HTTP 200 and matched the deployed source bytes. HTTP
requests to the apex and `www`, and the old GitHub Pages URL, all ended at
`https://mobilemaia.org/`.

The first certificate covers the apex only. At this intermediate check,
`https://www.mobilemaia.org/` still failed hostname verification. Its public
CNAME is correct, but GitHub's health result still reflected its earlier alias
to the apex. Keep this remaining TLS coverage check open until the live `www`
certificate is verified; don't claim all host variants work based on HTTP
redirects alone.

[GitHub Pages settings evidence](https-enabled-2026-10-24.png) shows the custom
domain, successful DNS check, and enabled HTTPS enforcement. GitHub remains
responsible for its managed certificate provisioning; no DNS changes are
required from the user for the remaining alias certificate check.

No preview servers, builds, APKs, model copies, temporary environments, or
downloaded archives were created for this cutover. Bounded certificate checks
finished before handoff; only source, compact verification notes/hashes, and
the settings screenshot are retained.

GitHub initially cached the old DNS records. After the correct records were
published, the domain was removed and immediately reattached once, using
[GitHub's documented certificate-provisioning recovery](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https#troubleshooting-certificate-provisioning-certificate-not-yet-created-error).
Ownership verification stayed in place throughout. No certificate checks were
bypassed, and no third-party certificate or paid hosting was purchased.
