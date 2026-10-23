"""Download the official Windows tunnel client and verify its release checksum."""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parent.parent
target = root / 'tools' / 'bin'
target.mkdir(parents=True, exist_ok=True)

def download(url, extra_headers=None):
    with urlopen(Request(url, headers={'User-Agent': 'Songgai-Public-Demo-Setup', **(extra_headers or {})}), timeout=120) as response:
        return response.read()

release = json.loads(download('https://api.github.com/repos/cloudflare/cloudflared/releases/latest'))
assets = {item['name']: item for item in release['assets']}
binary = assets['cloudflared-windows-amd64.exe']
try:
    content = download(binary['browser_download_url'])
except Exception:
    content = download(binary['url'] + '?download=1', {'Accept': 'application/octet-stream'})
actual = hashlib.sha256(content).hexdigest()
expected = binary.get('digest', '').removeprefix('sha256:')
if not expected:
    sums = download(assets['checksums.txt']['browser_download_url']).decode()
    expected = next(line.split()[0] for line in sums.splitlines() if line.split()[-1].lstrip('*') == binary['name'])
if actual != expected:
    raise RuntimeError('Official binary checksum mismatch; download discarded.')
(target / 'cloudflared.exe').write_bytes(content)
(target / 'cloudflared-manifest.json').write_text(json.dumps({'version': release['tag_name'], 'url': binary['browser_download_url'], 'sha256': actual}, indent=2), encoding='utf-8')
print(json.dumps({'version': release['tag_name'], 'bytes': len(content), 'checksumVerified': True}))
