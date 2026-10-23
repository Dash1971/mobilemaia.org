# mobilemaia.org

The public website for [Mobile Maia](https://github.com/Dash1971/maia-chess-android),
an independent, free and open-source Android chess app built around Maia-3.

Plain HTML, CSS, and a small progressive-enhancement script. No package manager,
framework, build step, external fonts, analytics, cookies, or browser storage.
Only `site/` is deployed. APKs and model binaries stay in the app's distribution
channels.

## Preview and check

```sh
python3 tools/check_site.py
python3 -m http.server 8080 --bind 127.0.0.1 --directory site
```

Open <http://127.0.0.1:8080>. Stop the server with Ctrl-C when finished.
Check narrow and wide layouts, screenshot selection/enlargement, FAQ disclosure,
keyboard focus, downloads, and the no-JavaScript fallback after relevant changes.

## Hosting

[GitHub Pages preview](https://dash1971.github.io/mobilemaia.org/).
Pushes to `main` validate the site, upload only `site/`, and deploy through
GitHub Actions. Pull requests validate without deploying. In repository
Settings → Pages, use **GitHub Actions** as the source.

The domain is being registered separately. No custom domain is attached until
ownership has been verified. Follow [domain setup](docs/domain-setup.md) to
connect `mobilemaia.org` and enable HTTPS. Domain registration can remain at 1984.

## Content and assets

App claims and links were checked against Stable source commit
`cd2551f70f9dde903d4bf543c7ea309beecee58f` and the published Stable `v2.4.0`
release on 2026-10-24 (Asia/Tokyo). See [asset provenance](ASSETS.md).
Screenshots illustrate several released versions; they are not new captures
or release verification. Stable and Preview remain separate.

Download links point to official distribution pages, not hardcoded APK versions.
Keep the homepage concise; detailed features and current release notes live in
the application repositories. There is no community chat invite until a channel
has actually been chosen and created.

## Licence

Original website code: [AGPL-3.0-only](LICENSE), copyright 2026 Mobile Maia
contributors. Reused app assets retain existing rights and applicable upstream
licences. See [ASSETS.md](ASSETS.md), [app component notices](APP_NOTICES.md), and
the website's [privacy and credits page](site/about.html).
