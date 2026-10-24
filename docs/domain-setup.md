# Connect mobilemaia.org to GitHub Pages

The canonical address is `https://mobilemaia.org/`. Registration and DNS remain
at 1984; hosting is GitHub Pages. A 1984 web-hosting package is not needed.
The original `https://dash1971.github.io/mobilemaia.org/` address redirects to
the domain configured in Pages.

Ownership was verified by GitHub on 2026-10-24 before the custom domain was
attached. Preserve the existing GitHub challenge TXT record. The instructions
below describe setup and recovery; actual live DNS, certificate, and redirect
checks determine whether a cutover is complete.

## 1. Verify ownership first

After the purchase succeeds, open the GitHub account Settings → Pages → Add a
domain. Enter `mobilemaia.org` and add GitHub's exact TXT verification record to
the domain's DNS zone at 1984. Wait for GitHub to verify ownership. Preserve
that TXT record. Do not guess its account-specific token or publish credentials.

## 2. Attach the verified domain

In **Dash1971/mobilemaia.org → Settings → Pages**, set the custom domain to
`mobilemaia.org`. The repository uses Actions deployment; the Pages setting is
authoritative (a CNAME file alone does not configure an Actions deployment).

At 1984, configure the following records. Remove only conflicting website
records; preserve mail and verification records. Do not use wildcard records.

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | dash1971.github.io. |

Use the same root Host value as the existing apex A record if the DNS interface
does not display `@`. Replace the parking address `93.95.224.44` rather than
retaining it alongside GitHub's A records. Remove the default wildcard CNAME
(`*` → `mobilemaia.org`); preserve NS, MX and the verification TXT records.

These addresses were checked against GitHub documentation on 2026-10-24.
Recheck the official documentation before configuration. If IPv6 is desired,
use GitHub's current AAAA records; remove any old AAAA records pointing elsewhere.
Allow for DNS propagation and certificate provisioning, then enable **Enforce
HTTPS** in Pages. Check both the apex domain and `www`, including HTTPS redirects.

## 3. Update public URLs and verify

The canonical, social-image, 404-home, robots, and sitemap URLs use
`https://mobilemaia.org/`. All stylesheet, image, and script references are
relative and work at either address. This Actions deployment uses the Pages
repository setting for the custom domain; it does not require a CNAME file.

Run `python3 tools/check_site.py`, push, wait for the deployment, and check
the live home page, privacy page, images, FAQ, and download links on the domain.
Confirm the old GitHub Pages URL redirects correctly. Record the actual verified
DNS and HTTPS status; don't call the custom domain live just because files were
pushed.

## References

- [Verify a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [Manage custom-domain DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [HTTPS and current DNS addresses](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

The website has no email service. Domain registration and Pages hosting alone
do not create email inboxes.
