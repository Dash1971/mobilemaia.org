#!/usr/bin/env python3
"""Check the deployed directory for broken local references and accidental bloat."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[1] / 'site'
errors = []

class Document(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.ids, self.links = path, set(), []
        self.idrefs = []
        self.has_title = False
        self.has_lang = False
        self.has_viewport = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            if attrs['id'] in self.ids:
                errors.append(f'{self.path.name}: duplicate id {attrs["id"]}')
            self.ids.add(attrs['id'])
        if tag == 'html':
            self.has_lang = bool(attrs.get('lang'))
        if tag == 'title':
            self.has_title = True
        if tag == 'meta' and attrs.get('name') == 'viewport':
            self.has_viewport = True
        if tag == 'img' and 'alt' not in attrs:
            errors.append(f'{self.path.name}: image missing alt')
        for attr in ('aria-labelledby', 'aria-describedby', 'aria-controls'):
            self.idrefs.extend(attrs.get(attr, '').split())
        for attr in ('href', 'src'):
            if attrs.get(attr):
                self.links.append(attrs[attr])
        if tag in ('script', 'img', 'link'):
            resource = attrs.get('src') or (attrs.get('href') if attrs.get('rel') == 'stylesheet' else '')
            if resource and urlsplit(resource).netloc:
                errors.append(f'{self.path.name}: third-party asset {resource}')

documents = {}
for path in ROOT.glob('*.html'):
    doc = Document(path)
    doc.feed(path.read_text())
    documents[path.resolve()] = doc
    if not all((doc.has_title, doc.has_lang, doc.has_viewport)):
        errors.append(f'{path.name}: missing title, language or viewport')

for path, doc in documents.items():
    for identifier in doc.idrefs:
        if identifier not in doc.ids:
            errors.append(f'{path.name}: missing ARIA target {identifier}')
    for raw in doc.links:
        url = urlsplit(raw)
        if url.scheme or url.netloc:
            continue
        target = (path.parent / unquote(url.path)).resolve() if url.path else path
        if target.is_dir():
            target = target / 'index.html'
        if not target.is_relative_to(ROOT.resolve()) or not target.exists():
            errors.append(f'{path.name}: broken local link {raw}')
        elif url.fragment and target in documents and unquote(url.fragment) not in documents[target].ids:
            errors.append(f'{path.name}: missing fragment {raw}')

for resource in re.findall(r"(?:src:\s*|href\s*=\s*)['\"](assets/[^'\"]+)['\"]", (ROOT / 'main.js').read_text()):
    if not (ROOT / resource).is_file():
        errors.append(f'main.js: missing {resource}')

files = [p for p in ROOT.rglob('*') if p.is_file()]
size = sum(p.stat().st_size for p in files)
if size > 5 * 1024 * 1024:
    errors.append(f'Site exceeds 5 MiB budget: {size} bytes')
for path in files:
    if path.suffix in ('.apk', '.onnx', '.zip', '.tar', '.gz'):
        errors.append(f'Unexpected large/binary distribution file: {path}')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'PASS: {len(documents)} pages, {len(files)} files, {size:,} bytes; local links, fragments and assets verified.')
