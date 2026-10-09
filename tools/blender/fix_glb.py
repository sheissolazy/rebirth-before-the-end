"""Remove textures that point at no image from .glb files (Blender sometimes fails to
write a 16-bit roughness map). Materials that used them fall back to their factors.

python3 tools/blender/fix_glb.py public/models/ph/*.glb
"""
import json
import struct
import sys


def fix(path):
    data = open(path, 'rb').read()
    jlen = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20 + jlen])
    rest = data[20 + jlen:]
    texs = j.get('textures', [])
    imgs = j.get('images', [])

    def has_source(t):
        s = t.get('source', t.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
        return s is not None and s < len(imgs)

    keep = [i for i, t in enumerate(texs) if has_source(t)]
    if len(keep) == len(texs):
        return False
    remap = {old: new for new, old in enumerate(keep)}
    j['textures'] = [texs[i] for i in keep]

    def walk(node):
        if isinstance(node, dict):
            for k in list(node.keys()):
                v = node[k]
                if isinstance(v, dict) and 'index' in v and k.lower().endswith('texture'):
                    if v['index'] in remap:
                        v['index'] = remap[v['index']]
                    else:
                        del node[k]
                        continue
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(j.get('materials', []))
    body = json.dumps(j, separators=(',', ':')).encode()
    body += b' ' * ((4 - len(body) % 4) % 4)
    total = 12 + 8 + len(body) + len(rest)
    out = data[:8] + struct.pack('<I', total) + struct.pack('<I', len(body)) + b'JSON' + body + rest
    open(path, 'wb').write(out)
    return True


for p in sys.argv[1:]:
    if fix(p):
        print('fixed', p)
