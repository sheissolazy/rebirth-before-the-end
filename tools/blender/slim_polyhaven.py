"""Slim Poly Haven glTF models for the web game.

blender --background --factory-startup --python tools/blender/slim_polyhaven.py -- \
    <src_models_dir> <out_dir> slug:target_tris:tex_px [slug:target_tris:tex_px ...]

For each model: import the 1K glTF, decimate meshes so the whole model has about
`target_tris` triangles (0 = keep), shrink textures to `tex_px`, move the origin to the
bottom centre, and export a single .glb with WebP textures.

Poly Haven's glTF package uses JPG colour maps without transparency, and ships the leaf
transparency as separate Alpha maps. If `<src>/<slug>/alpha/<key>.jpg` exists (key `Alpha`
for the main material, `leaves_alpha` for the leaves material), it is wired into the
material's Alpha so the exported colour texture carries it. Without this, grass and leaves
render as black cards.
"""
import glob
import os
import sys

import bpy
import mathutils


def dangling_textures(glb_path):
    import json
    import struct
    with open(glb_path, 'rb') as f:
        data = f.read()
    n = struct.unpack_from('<I', data, 12)[0]
    j = json.loads(data[20:20 + n])
    imgs = len(j.get('images', []))
    def src(t):
        return t.get('source', t.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
    return [t for t in j.get('textures', []) if src(t) is None or src(t) >= imgs]


def tri_count(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)


def attach_alpha(src_dir, slug):
    adir = os.path.join(src_dir, slug, 'alpha')
    if not os.path.isdir(adir):
        return 0
    n = 0
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        key = 'leaves_alpha' if 'leaves' in mat.name.lower() else 'Alpha'
        path = os.path.join(adir, f'{key}.jpg')
        if not os.path.exists(path):
            continue
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = next((nd for nd in nodes if nd.type == 'BSDF_PRINCIPLED'), None)
        base = bsdf and bsdf.inputs['Base Color'].links and bsdf.inputs['Base Color'].links[0].from_node
        if not bsdf or not base:
            continue
        img = bpy.data.images.load(path)
        img.colorspace_settings.name = 'Non-Color'
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = img
        if base.inputs.get('Vector') and base.inputs['Vector'].links:
            links.new(base.inputs['Vector'].links[0].from_socket, tex.inputs['Vector'])
        links.new(tex.outputs['Color'], bsdf.inputs['Alpha'])
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'DITHERED'
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'CLIP'
        n += 1
    return n


def slim(src_dir, out_dir, slug, target, tex):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = glob.glob(os.path.join(src_dir, slug, '*.gltf'))[0]
    bpy.ops.import_scene.gltf(filepath=path)
    alpha = attach_alpha(src_dir, slug)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    before = tri_count(meshes)
    if target and before > target:
        ratio = target / before
        for o in meshes:
            bpy.context.view_layer.objects.active = o
            mod = o.modifiers.new('decimate', 'DECIMATE')
            mod.ratio = max(ratio, 0.01)
            mod.use_collapse_triangulate = True
            bpy.ops.object.select_all(action='DESELECT')
            o.select_set(True)
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for img in bpy.data.images:
        if img.size[0] > tex or img.size[1] > tex:
            s = tex / max(img.size[0], img.size[1])
            img.scale(max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s)))
    # origin at the bottom centre of the whole model
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    offset = mathutils.Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    for o in bpy.data.objects:
        if o.parent is None:
            o.location -= offset
    out = os.path.join(out_dir, f'{slug}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP',
                              export_image_quality=78, export_apply=True)
    # The exporter packs roughness-only maps into a 1-channel image, which WebP can't hold: it then
    # drops the image and leaves a texture with no source, and three.js GLTFLoader throws
    # "reading 'uri'". Detect that and export again with PNG/JPEG textures.
    if dangling_textures(out):
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='AUTO',
                                  export_image_quality=78, export_apply=True)
        print(f'  {slug}: WebP dropped a texture, exported with PNG/JPEG instead')
    after = tri_count([o for o in bpy.data.objects if o.type == 'MESH'])
    dims = mx - mn
    print(f'SLIM {slug}: {before} -> {after} tris, {os.path.getsize(out) // 1024} KB, alpha maps {alpha}, size {dims.x:.2f}x{dims.y:.2f}x{dims.z:.2f} m')


argv = sys.argv[sys.argv.index('--') + 1:]
src, dst, specs = argv[0], argv[1], argv[2:]
os.makedirs(dst, exist_ok=True)
for spec in specs:
    slug, target, tex = spec.split(':')
    slim(src, dst, slug, int(target), int(tex))
