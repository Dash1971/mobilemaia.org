# Connect mobilemaia.org to GitHub Pages

The website can be reviewed on `https://dash1971.github.io/mobilemaia.org/` while
the domain is purchased. Registration, DNS, and hosting are independent. Keep
registration and DNS at 1984 if desired; a 1984 web-hosting package is not needed.

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
| CNAME | www | dash1971.github.io |

These addresses were checked against GitHub documentation on 2026-10-24.
Recheck the official documentation before configuration. If IPv6 is desired,
use GitHub's current AAAA records; remove any old AAAA records pointing elsewhere.
Allow for DNS propagation and certificate provisioning, then enable **Enforce
HTTPS** in Pages. Check both the apex domain and `www`, including HTTPS redirects.

## 3. Update public URLs and verify

Replace `https://dash1971.github.io/mobilemaia.org/` with
`https://mobilemaia.org/` in `site/index.html`, `site/404.html`, `site/robots.txt`,
and `site/sitemap.xml`; update the README's published link. All stylesheet,
image, and script references are relative and already work at either address.
Optionally add `site/CNAME` containing `mobilemaia.org` as portable domain
metadata, but keep the repository's Pages setting configured too.

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
