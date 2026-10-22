#!/usr/bin/env python3
"""Write kits/remotion/index.json: every template and effect as one machine-readable record.

    python3 scripts/export-template-index.py           write the index
    python3 scripts/export-template-index.py --check   exit 1 when the committed index is stale

The index is what registries read without cloning the repository, for example the hosted MCP server
(github.com/actionow-ai/vvv-mcp) fetches it from the main branch. It is generated from the kit catalogs,
the generated props schemas and docs/assets/previews.json, so it never needs hand edits.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills' / 'vvv' / 'scripts'))
from vvv_project import describe_template, list_templates, load_catalog  # noqa: E402

KIT = ROOT / 'kits' / 'remotion'
OUT = KIT / 'index.json'
REPOSITORY = 'actionow-ai/vvv'
SITE = 'https://vibevision.video'


def record(kind, template_id, previews):
    catalog = load_catalog(KIT, template_id)
    base = describe_template(KIT, template_id)
    by_format = {}
    for name in catalog['formats']:
        described = describe_template(KIT, template_id, name)
        by_format[name] = {'slots': described['slots'], 'unusedSlots': described['unusedSlots']}
    folder = 'effects' if kind == 'effect' else 'templates'
    return {
        'id': template_id, 'kind': kind, 'title': base['title'], 'description': base['description'],
        'version': catalog.get('version'), 'package': (catalog.get('package') or {}).get('name'),
        'defaultFormat': base['defaultFormat'], 'formats': base['formats'], 'slotsByFormat': by_format,
        'copy': base['copy'], 'couple': base['couple'], 'props': base['props'], 'music': base['music'],
        'fixture': base['fixture'],
        'sourceUrl': f'https://github.com/{REPOSITORY}/tree/main/kits/remotion/src/{folder}/{template_id}',
        'previews': [{'format': p['format'], 'video': f"{SITE}/media/{p['video']}", 'poster': f"{SITE}/media/{p['poster']}",
                      'width': p['width'], 'height': p['height'], 'from': p['sourceRangeSeconds'][0],
                      'to': p['sourceRangeSeconds'][1], 'fullSeconds': p['fullCompositionSeconds']}
                     for p in previews if p['template'] == template_id],
    }


def build():
    previews = json.loads((ROOT / 'docs' / 'assets' / 'previews.json').read_text(encoding='utf-8'))
    index = {'index': 'vvv-template-index/1', 'repository': f'https://github.com/{REPOSITORY}',
             'site': SITE, 'templates': [], 'effects': []}
    for kind, key in (('template', 'templates'), ('effect', 'effects')):
        for entry in list_templates(KIT, kind):
            index[key].append(record(kind, entry['id'], previews))
    return json.dumps(index, ensure_ascii=False, indent=2) + '\n'


def main(argv):
    text = build()
    if '--check' in argv:
        if not OUT.is_file() or OUT.read_text(encoding='utf-8') != text:
            print('INDEX_STALE: kits/remotion/index.json; run python3 scripts/export-template-index.py', file=sys.stderr)
            return 1
        return 0
    with OUT.open('w', encoding='utf-8', newline='\n') as handle:  # Python 3.9: no newline= on write_text
        handle.write(text)
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
