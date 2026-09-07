"""Verify and restore the original game source without accepting unsafe paths."""
from pathlib import Path, PurePosixPath
import hashlib
import io
import tarfile

parts = sorted(Path('.bootstrap').glob('part-*.xzpart'))
assert len(parts) == 10, 'Expected ten source archive chunks'
data = b''.join(p.read_bytes() for p in parts)
expected = '4aa677419465b51fd91403e7c21e1ff9f20f6d9efad9c1bf15f25e1d79d86e11'
assert hashlib.sha256(data).hexdigest() == expected, 'Source archive checksum mismatch'
with tarfile.open(fileobj=io.BytesIO(data), mode='r:xz') as archive:
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        assert not path.is_absolute() and '..' not in path.parts
        assert path.parts and path.parts[0] not in ('.git', '.github', '.bootstrap')
        assert member.isfile() or member.isdir(), 'Only regular files and directories are permitted'
    archive.extractall('.', filter='data')
print('Verified source archive:', expected)
