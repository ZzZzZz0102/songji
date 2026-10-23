"""Download pinned, self-hosted viewer dependencies and their licenses."""
import hashlib
import json
import sys
import time
from pathlib import Path
from urllib.request import urlopen

vendor = Path(__file__).resolve().parent.parent / 'public' / 'vendor'
vendor.mkdir(parents=True, exist_ok=True)
files = {
    'qrcode.js': 'qrcode-generator@1.4.4/qrcode.js',
    'qrcode-README.md': 'qrcode-generator@1.4.4/README.md',
    'three.module.js': 'three@0.160.1/build/three.module.min.js',
    'three-LICENSE.txt': 'three@0.160.1/LICENSE',
    'gaussian-splats-3d.module.js': '@mkkellogg/gaussian-splats-3d@0.4.7/build/gaussian-splats-3d.module.js',
    'gaussian-LICENSE.txt': '@mkkellogg/gaussian-splats-3d@0.4.7/LICENSE',
    'model-viewer.min.js': '@google/model-viewer@4.0.0/dist/model-viewer.min.js',
    'model-viewer-LICENSE.txt': '@google/model-viewer@4.0.0/LICENSE',
}
manifest = []
for name, package_path in files.items():
    url = 'https://cdn.jsdelivr.net/npm/' + package_path
    if (vendor / name).exists() and name not in sys.argv[1:]:
        content = (vendor / name).read_bytes()
    else:
        candidates = [url, 'https://unpkg.com/' + package_path]
        if name == 'model-viewer-LICENSE.txt':
            candidates.insert(0, 'https://raw.githubusercontent.com/google/model-viewer/v4.0.0/LICENSE')
        for attempt in range(len(candidates)):
            try:
                with urlopen(candidates[attempt], timeout=30) as response:
                    content = response.read()
                url = candidates[attempt]
                break
            except Exception:
                if attempt == len(candidates) - 1:
                    raise
                time.sleep(2)
        (vendor / name).write_bytes(content)
    manifest.append({'file': name, 'url': url, 'sha256': hashlib.sha256(content).hexdigest()})
    print(name, len(content), flush=True)
(vendor / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
