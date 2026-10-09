"""A toon orange tabby ("大橘") for the 2.5D prototype, built from metaballs like the toon people.

blender --background --factory-startup --python tools/blender/make_toon_cat.py -- <out.glb> [preview.png]

No skeleton: the cat is a few separate nodes (body, head, four legs, three tail segments) whose origins sit
at their joints, so the game can swing legs, wag the tail and turn the head by rotating nodes.
The cat faces +Y in Blender (= +Z in three.js after the glTF Y-up conversion), 1 unit = 1 metre.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

MB_SCALE = 1.6


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


MATS = {}


def mat(name, color, rough=0.75):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*lin(color), 1.0)
    b.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*lin(color), 1.0)
    MATS[name] = m
    return m


def look_quat(axis):
    return Vector((1, 0, 0)).rotation_difference(axis.normalized())


def metaball(name, elems, material, resolution=0.008):
    mb = bpy.data.metaballs.new(name + 'MB')
    mb.resolution = resolution
    mb.render_resolution = resolution
    for kind, c, axis, r, half in elems:
        el = mb.elements.new()
        el.co = c
        el.radius = r * MB_SCALE
        if kind == 'capsule':
            el.type = 'CAPSULE'
            el.size_x = half
        else:
            el.type = 'ELLIPSOID'
            el.size_x, el.size_y, el.size_z = half
        el.rotation = look_quat(axis)
        el.stiffness = 2.0
    ob = bpy.data.objects.new(name + 'MB', mb)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    me = bpy.context.view_layer.objects.active
    me.name = name
    me.data.materials.clear()
    me.data.materials.append(material)
    dec = me.modifiers.new('dec', 'DECIMATE')
    dec.ratio = 0.5
    bpy.ops.object.modifier_apply(modifier='dec')
    for p in me.data.polygons:
        p.use_smooth = True
    return me


def ellipsoid(name, center, axis_z, radii, material, segs=24, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    rot = axis_z.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    ob.matrix_world = Matrix.Translation(center) @ rot @ Matrix.Diagonal((*radii, 1.0))
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def cone(name, base, tip, r, material):
    bm = bmesh.new()
    d = tip - base
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=16, radius1=r, radius2=0.004, depth=d.length)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    rot = d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    ob.matrix_world = Matrix.Translation((base + tip) / 2) @ rot
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def set_origin(ob, at):
    """把物体的原点挪到关节（at），网格不动"""
    ob.data.transform(Matrix.Translation(-at))
    ob.matrix_world = Matrix.Translation(at)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = argv[0]
    preview = argv[1] if len(argv) > 1 else None
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fur = mat('fur', '#eda25a', 0.85)
    stripe = mat('stripe', '#c97a35', 0.85)
    white = mat('white', '#fbf3e6', 0.85)
    pink = mat('pink', '#f2a0a4', 0.6)
    eye = mat('eye', '#2a2320', 0.2)
    shine = mat('shine', '#ffffff', 0.2)
    inner = mat('ear', '#f6b8b0', 0.7)
    whisk = mat('whisker', '#fff8ee', 0.5)

    Y = Vector((0, 1, 0))
    Z = Vector((0, 0, 1))
    X = Vector((1, 0, 0))
    # --- 身体：圆滚滚的橘猫（胸口和肚子白）---
    hip_h, sh_h = 0.2, 0.21
    body = metaball('body', [
        ('ellipsoid', Vector((0, 0.0, 0.2)), Y, 0.1, (1.0, 1.75, 0.95)),
        ('ellipsoid', Vector((0, 0.11, 0.21)), Y, 0.09, (1.0, 1.0, 1.0)),
        ('ellipsoid', Vector((0, -0.1, 0.2)), Y, 0.1, (1.05, 1.0, 1.0)),
    ], fur)
    chest = metaball('chest', [('ellipsoid', Vector((0, 0.15, 0.17)), Y, 0.068, (0.95, 0.75, 1.1))], white)
    belly = metaball('belly', [('ellipsoid', Vector((0, 0.0, 0.135)), Y, 0.07, (0.95, 1.9, 0.6))], white)
    # 背上的花纹：大半埋在身子里的扁椭球，只露出一道道弯弯的色带
    stripes = [ellipsoid(f'st{k}', Vector((0, y, 0.25)), Z, (0.088, 0.017, 0.052 - abs(y) * 0.04), stripe) for k, y in enumerate((-0.13, -0.065, 0.0, 0.065))]
    torso = join([body, chest, belly, *stripes], 'body')

    # --- 头：大圆头、三角耳朵、大眼睛、小粉鼻子、胡子 ---
    hc = Vector((0, 0.23, 0.33))
    R = 0.105
    parts = [ellipsoid('head', hc, Z, (R * 1.12, R * 0.95, R * 0.95), fur, 32, 22)]
    parts.append(ellipsoid('muzzle', hc + Vector((0, R * 0.78, -R * 0.32)), Y, (R * 0.5, R * 0.36, R * 0.34), white, 20, 14))
    for s in (-1, 1):
        base = hc + Vector((s * R * 0.6, -R * 0.05, R * 0.62))
        tip = base + Vector((s * R * 0.25, R * 0.02, R * 0.65))
        parts.append(cone(f'ear{s}', base, tip, R * 0.38, fur))
        parts.append(cone(f'earin{s}', base + Vector((0, R * 0.08, R * 0.04)), tip + Vector((0, R * 0.06, -R * 0.12)), R * 0.24, inner))
        e = hc + Vector((s * R * 0.42, R * 0.86, R * 0.08))
        parts.append(ellipsoid(f'eye{s}', e, Y, (R * 0.17, R * 0.23, R * 0.08), eye))
        parts.append(ellipsoid(f'shine{s}', e + Vector((s * R * 0.04, R * 0.07, R * 0.08)), Y, (R * 0.06, R * 0.07, R * 0.03), shine, 12, 8))
        for k, dz in enumerate((0.0, -0.1)):
            a = hc + Vector((s * R * 0.42, R * 0.95, -R * 0.3 + dz * R))
            b = a + Vector((s * R * 0.75, -R * 0.1, dz * R * 1.5 + R * 0.06))
            parts.append(ellipsoid(f'wh{s}{k}', (a + b) / 2, b - a, (R * 0.012, R * 0.012, (b - a).length / 2), whisk, 6, 4))
    parts.append(ellipsoid('nose', hc + Vector((0, R * 1.08, -R * 0.15)), Y, (R * 0.1, R * 0.06, R * 0.07), pink, 12, 8))
    for s in (-1, 1):
        parts.append(ellipsoid(f'cheekst{s}', hc + Vector((s * R * 0.98, 0, R * 0.1)), X * s, (R * 0.04, R * 0.18, R * 0.03), stripe, 10, 6))
    parts.append(ellipsoid('forehead', hc + Vector((0, R * 0.5, R * 0.72)), Z, (R * 0.06, R * 0.22, R * 0.04), stripe, 10, 6))
    head = join(parts, 'head')
    neck = Vector((0, 0.17, 0.27))
    set_origin(head, neck)

    # --- 腿：四根短圆柱 + 白爪子；原点在肩/胯 ---
    legs = []
    for name, x, y in (('legFL', 0.055, 0.12), ('legFR', -0.055, 0.12), ('legBL', 0.06, -0.12), ('legBR', -0.06, -0.12)):
        top = Vector((x, y, sh_h if y > 0 else hip_h))
        lg = metaball(name + 'm', [('capsule', top - Vector((0, 0, 0.085)), Z, 0.037, 0.07)], fur)
        paw = metaball(name + 'p', [('ellipsoid', Vector((x, y + 0.012, 0.025)), Y, 0.034, (1.0, 1.25, 0.75))], white)
        leg = join([lg, paw], name)
        set_origin(leg, top)
        legs.append(leg)

    # --- 尾巴：三节，原点在每节的根部 ---
    tails = []
    base = Vector((0, -0.24, 0.26))
    d = Vector((0, -0.6, 0.8)).normalized()
    seg = 0.085
    for k in range(3):
        a = base + d * (seg * k)
        b = a + d * seg
        m = stripe if k == 2 else fur
        # 每节往后多伸一点，和下一节叠在一起，弯起来也不露缝
        t = metaball(f'tail{k + 1}m', [('capsule', (a + b) / 2 + d * 0.012, d, 0.027 - k * 0.003, seg / 2 + 0.014)], m)
        t.name = f'tail{k + 1}'
        set_origin(t, a)
        tails.append(t)
        d = (d + Vector((0, 0.15, 0.25))).normalized()

    # 层级：body ← head / legs / tail1 ← tail2 ← tail3
    torso.data.transform(Matrix.Translation(-Vector((0, 0, hip_h))))
    torso.matrix_world = Matrix.Translation(Vector((0, 0, hip_h)))
    root = bpy.data.objects.new('cat', None)
    bpy.context.collection.objects.link(root)
    for ob in (torso,):
        ob.parent = root
    for ob in (head, *legs, tails[0]):
        mw = ob.matrix_world.copy()
        ob.parent = torso
        ob.matrix_world = mw
    for p, c in ((tails[0], tails[1]), (tails[1], tails[2])):
        mw = c.matrix_world.copy()
        c.parent = p
        c.matrix_world = mw

    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    bpy.ops.object.select_all(action='SELECT')
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=False)
    print(f'CAT: {tris} tris, {os.path.getsize(out) // 1024} KB -> {out}')

    if preview:
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        bpy.context.collection.objects.link(cam)
        target = Vector((0, 0.03, 0.22))
        cam.location = target + Vector((0.75, 0.95, 0.32))
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = 50
        bpy.context.scene.camera = cam
        sc = bpy.context.scene
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'STUDIO'
        sc.display.shading.color_type = 'MATERIAL'
        sc.render.resolution_x, sc.render.resolution_y = 640, 520
        sc.render.filepath = preview
        bpy.ops.render.render(write_still=True)


main()
