#!/usr/bin/env python3
"""Verify a deployed Pages revision and compare every public runtime asset."""
from pathlib import Path
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request


def main():
    root = Path(__file__).resolve().parents[1] / '_site'
    base = os.environ['PAGE_URL'].rstrip('/') + '/'
    expected = json.loads((root / 'version.json').read_text())
    query = urllib.parse.urlencode({'revision': expected['commit'], 'run': os.environ.get('GITHUB_RUN_ID', 'local')})

    def fetch(path):
        url = base + urllib.parse.quote(path, safe='/') + '?' + query
        request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'RailboundAdventures-CI'})
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status != 200:
                raise RuntimeError(f'{path}: HTTP {response.status}')
            return response.read()

    for attempt in range(36):
        try:
            current = json.loads(fetch('version.json'))
            if current == expected:
                break
            print(f'CDN has revision {current.get("commit")}; checking again', flush=True)
        except (OSError, ValueError, RuntimeError) as error:
            print(f'Deployment check {attempt + 1}: {error}', flush=True)
        if attempt == 35:
            raise RuntimeError('Published revision did not match the built artifact')
        time.sleep(5)

    verified = []
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.name == '.nojekyll':
            continue
        relative = path.relative_to(root).as_posix()
        expected_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        for attempt in range(4):
            try:
                actual = fetch(relative)
                if hashlib.sha256(actual).hexdigest() != expected_hash:
                    raise RuntimeError(f'{relative}: published bytes differ from the build')
                break
            except (OSError, RuntimeError):
                if attempt == 3:
                    raise
                time.sleep(3)
        verified.append({'path': relative, 'bytes': len(actual), 'sha256': expected_hash})
        print(f'OK {relative} ({len(actual)} bytes)', flush=True)

    report = {'url': base, 'commit': expected['commit'], 'version': expected['version'], 'verified': verified}
    Path('deployment-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    summary = f'Published {base}\n\nVerified revision `{expected["commit"]}` and all {len(verified)} public runtime assets byte-for-byte.\n'
    print(summary)
    if 'GITHUB_STEP_SUMMARY' in os.environ:
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as stream:
            stream.write(summary)


if __name__ == '__main__':
    main()
