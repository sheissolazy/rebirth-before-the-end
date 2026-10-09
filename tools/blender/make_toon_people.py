"""Stylized ("island fishing"-like) people built in Blender on top of the MakeHuman Mixamo rig.

blender --background --factory-startup --python tools/blender/make_toon_people.py -- \
    <rig_source.glb> <out_dir> <name> [preview.png]

Keeps the exact armature (bone names + rest orientations) of an existing MakeHuman person, so the game's
code-driven poses (PoseDriver) work unchanged. The body is sculpted from metaballs (smooth, vinyl-toy look),
skinned with distance-based weights; the head is a clean sphere with big eyes, brows, blush and simple hair
shapes. Flat colours, no textures, so nothing looks grainy from the game's high camera.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import intersect_point_line

STYLES = {
    # 林知夏：高马尾、蓝 T 恤、牛仔裤、白鞋
    'heroine': dict(skin='#f6d2b3', hair='#3b2823', top='#5b9be0', bottom='#40639a', shoes='#d9734a', sole='#c9653f',
                    hair_style='ponytail', tie='#ef6a78', girl=True, short_sleeve=True),
    # 妈妈：深棕齐耳短发、酒红上衣、深灰长裙
    'mom': dict(skin='#f1caa8', hair='#4b3229', top='#a8404f', bottom='#545460', shoes='#4a3a34', sole='#2a2220',
                hair_style='bob', girl=True, skirt=True),
    # 爸爸：寸头、军绿外套、牛仔裤
    'dad': dict(skin='#ebc19e', hair='#2b221f', top='#5f7350', bottom='#3d5a86', shoes='#3a302a', sole='#221c18',
                hair_style='short', girl=False),
}


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


MATS = {}
MB_SCALE = 1.6
# Q 版比例：腿、手臂按比例缩短（只平移骨头，不改朝向，所以游戏里代码摆的姿势照样能用）
LEG_SCALE = 0.78
ARM_SCALE = 0.86


def chibi(rig, leg, arm):
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    by = {b.name.split(':')[-1]: b for b in eb}

    def chain(root, names, k):
        pivot = by[root].head.copy()
        for n in names:
            b = by[n]
            roll = b.roll
            b.head = pivot + (b.head - pivot) * k
            b.tail = pivot + (b.tail - pivot) * k
            b.roll = roll

    fingers = lambda side: [n for n in by if n.startswith(side + 'Hand') and n != side + 'Hand']
    for s in ('Left', 'Right'):
        chain(f'{s}UpLeg', [f'{s}UpLeg', f'{s}Leg', f'{s}Foot', f'{s}ToeBase'], leg)
        chain(f'{s}Arm', [f'{s}Arm', f'{s}ForeArm', f'{s}Hand', *fingers(s)], arm)
    # 腿短了，整个人往下放，脚还是踩在地上
    foot_z = min(by['LeftToeBase'].head.z, by['RightToeBase'].head.z)
    orig = 0.0
    drop = foot_z - orig - 0.02
    for b in eb:
        roll = b.roll
        b.head.z -= drop
        b.tail.z -= drop
        b.roll = roll
    bpy.ops.object.mode_set(mode='OBJECT')


def mat(name, color, rough=0.8):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*lin(color), 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*lin(color), 1.0)  # 工作台预览用
    MATS[name] = m
    return m


def look_quat(axis):
    """把局部 X 轴转到 axis 方向（metaball 胶囊沿局部 X）"""
    return Vector((1, 0, 0)).rotation_difference(axis.normalized())


def metaball(name, elems, material, resolution=0.012):
    """elems: (kind, center, axis, radius, half_len)。转成网格返回"""
    mb = bpy.data.metaballs.new(name + 'MB')
    mb.resolution = resolution
    mb.render_resolution = resolution
    for kind, c, axis, r, half in elems:
        el = mb.elements.new()
        el.co = c
        # 融球看得见的表面比 radius 小一圈（阈值 0.6），按想要的表面半径放大
        el.radius = r * MB_SCALE
        if kind == 'capsule':
            el.type = 'CAPSULE'
            el.size_x = half
            el.rotation = look_quat(axis)
        elif kind == 'ellipsoid':
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
    me_ob = bpy.context.view_layer.objects.active
    me_ob.name = name
    me_ob.data.materials.clear()
    me_ob.data.materials.append(material)
    for p in me_ob.data.polygons:
        p.use_smooth = True
    return me_ob


def ellipsoid(name, center, axis_z, radii, material, segs=32, rings=20):
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


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    src, out_dir, name = argv[0], argv[1], argv[2]
    preview = argv[3] if len(argv) > 3 else None
    st = STYLES[name]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    chibi(rig, LEG_SCALE, ARM_SCALE)
    mw = rig.matrix_world
    short = {b.name.split(':')[-1]: b for b in rig.data.bones}
    H = lambda b: mw @ short[b].head_local
    T = lambda b: mw @ short[b].tail_local
    up = Vector((0, 0, 1))
    fwd = T('LeftToeBase') - H('LeftFoot')
    fwd.z = 0
    fwd.normalize()
    side = up.cross(fwd).normalized()
    # 角色左手边：LeftArm 在哪边就是哪边
    if (H('LeftArm') - H('Spine2')).dot(side) < 0:
        side = -side

    skin = mat('skin', st['skin'], 0.65)
    hair = mat('hair', st['hair'], 0.5)
    top = mat('top', st['top'])
    bottom = mat('bottom', st['bottom'])
    shoes = mat('shoes', st['shoes'], 0.6)
    sole = mat('sole', st['sole'], 0.6)
    eye = mat('eye', '#231c22', 0.2)
    shine = mat('eyeshine', '#ffffff', 0.2)
    blush = mat('blush', '#f4a3a0', 0.9)
    mouth = mat('mouth', '#b04e52', 0.6)
    girl = st['girl']

    def seg(a, b, r, kind='capsule', shrink=0.0):
        p0, p1 = H(a), H(b)
        d = p1 - p0
        return ('capsule', (p0 + p1) / 2, d, r, max(0.001, d.length / 2 - shrink))

    # --- 身体（融球，一体光滑）---
    neck_top = H('Head')
    chest_w = 0.15 if girl else 0.17
    torso = [
        ('ellipsoid', (H('Spine2') + H('Neck')) / 2 - up * 0.01, side, 0.17, (chest_w / 0.17, 0.1 / 0.17, 0.115 / 0.17)),
        ('ellipsoid', (H('Spine') + H('Spine2')) / 2, side, 0.16, ((chest_w - 0.02) / 0.16, 0.085 / 0.16, 0.12 / 0.16)),
    ]
    sleeves = []
    for s in ('Left', 'Right'):
        a, f = H(f'{s}Arm'), H(f'{s}ForeArm')
        cut = 0.45 if st.get('short_sleeve') else 1.0
        sleeves.append(('capsule', a + (f - a) * cut / 2, f - a, 0.056, (f - a).length * cut / 2))
    hem = ('ellipsoid', H('Spine') + up * 0.03, side, 0.15, ((chest_w + 0.005) / 0.15, 0.1 / 0.15, 0.07 / 0.15))
    shirt = metaball(f'{name}_top', torso + sleeves + [hem, ('capsule', H('Spine2'), side, 0.07, 0.11)], top)

    legs = [('ellipsoid', H('Hips') + up * 0.015, side, 0.15, ((0.155 if girl else 0.15) / 0.15, 0.1 / 0.15, 0.1 / 0.15))]
    for s in ('Left', 'Right'):
        legs.append(seg(f'{s}UpLeg', f'{s}Leg', 0.078 if girl else 0.08))
        if not st.get('skirt'):
            legs.append(seg(f'{s}Leg', f'{s}Foot', 0.062))
    pants = metaball(f'{name}_bottom', legs, bottom)
    extra = []
    rigid_hips = []
    if st.get('skirt'):
        # A 字裙：上窄下宽的圆台，整条跟着胯走
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=32, radius1=0.2, radius2=0.155, depth=0.36)
        me = bpy.data.meshes.new(f'{name}.skirt')
        bm.to_mesh(me)
        bm.free()
        sk = bpy.data.objects.new(f'{name}.skirt', me)
        bpy.context.collection.objects.link(sk)
        sk.location = H('Hips') - up * 0.13
        sk.scale = (1.0, 0.82, 1.0)
        sk.data.materials.append(bottom)
        for p in sk.data.polygons:
            p.use_smooth = True
        rigid_hips.append(sk.name)
        extra.append(sk)
        for s in ('Left', 'Right'):
            p0, p1 = H(f'{s}Leg'), H(f'{s}Foot')
            extra.append(metaball(f'{name}_shin{s}', [('capsule', (p0 + p1) / 2, p1 - p0, 0.05, (p1 - p0).length / 2)], skin))

    arms = []
    for s in ('Left', 'Right'):
        a, f, h = H(f'{s}Arm'), H(f'{s}ForeArm'), H(f'{s}Hand')
        if st.get('short_sleeve'):
            arms.append(('capsule', a + (f - a) * 0.7, f - a, 0.045, (f - a).length * 0.32))
        arms.append(('capsule', (f + h) / 2, h - f, 0.042, (h - f).length / 2))
        d = (h - f).normalized()
        arms.append(('ellipsoid', h + d * 0.05, d, 0.05, (1.0, 0.75, 0.9)))
    arms.append(('capsule', (H('Neck') + neck_top) / 2 + up * 0.02, up, 0.05, 0.05))
    limbs = metaball(f'{name}_skin', arms, skin)

    feet = []
    for s in ('Left', 'Right'):
        f0, f1 = H(f'{s}Foot'), T(f'{s}ToeBase')
        c = (f0 + f1) / 2
        c.z = 0.055
        d = f1 - f0
        d.z = 0
        feet.append(('ellipsoid', c + fwd * 0.015, d, 0.068, (1.6, 0.9, 0.75)))
    shoe = metaball(f'{name}_shoes', feet, shoes)
    soles = []

    # --- 头（干净的球 + 大眼睛）---
    R = 0.185 if girl else 0.19
    hc = neck_top + up * (R * 0.78) + fwd * 0.02
    head_parts = [ellipsoid(f'{name}.head', hc, up, (R * 1.0, R * 0.96, R * 1.0), skin, 40, 28)]

    def on_face(sx, uy, sink):
        """脸上的点：贴着头的球面（sx、uy 是相对半径的横向、竖向偏移），sink = 往里埋多少"""
        f = math.sqrt(max(0.0, 1 - sx * sx - uy * uy)) * 0.96
        return hc + fwd * (R * (f - sink)) + side * (sx * R) + up * (uy * R)

    def face_axis(sx, uy):
        n = (fwd * math.sqrt(max(0.0, 1 - sx * sx - uy * uy)) + side * sx + up * uy)
        return n.normalized()

    for s in (-1, 1):
        ex, ey = s * 0.36, -0.06
        eye_d = R * 0.07
        head_parts.append(ellipsoid(f'{name}.eye', on_face(ex, ey, 0.045), face_axis(ex, ey), (R * 0.135 if girl else R * 0.12, R * 0.19 if girl else R * 0.16, eye_d), eye, 20, 14))
        head_parts.append(ellipsoid(f'{name}.shine', on_face(ex + s * 0.04, ey + 0.07, 0.0), face_axis(ex, ey), (R * 0.045, R * 0.05, R * 0.025), shine, 12, 8))
        head_parts.append(ellipsoid(f'{name}.brow', on_face(s * 0.37, 0.28, 0.02), side, (R * 0.035, R * 0.035, R * 0.15), hair, 12, 8))
        head_parts.append(ellipsoid(f'{name}.blush', on_face(s * 0.58, -0.3, 0.03), face_axis(s * 0.58, -0.3), (R * 0.14, R * 0.085, R * 0.04), blush, 16, 8))
    head_parts.append(ellipsoid(f'{name}.mouth', on_face(0, -0.42, 0.02), side, (R * 0.03, R * 0.03, R * 0.1), mouth, 12, 8))
    head_parts.append(ellipsoid(f'{name}.nose', on_face(0, -0.18, 0.0), fwd, (R * 0.05, R * 0.045, R * 0.035), skin, 12, 8))
    # 头发：融球捏的发型
    hs = st['hair_style']
    # 发顶：往后、往上挪，前沿正好在额头；不用挖洞，脸自然露出来
    hair_el = [('ellipsoid', hc + up * (R * 0.16) - fwd * (R * 0.12), side, R * 1.03, (1.0, 1.02, 0.98))]
    # 前额那一片：把发顶和刘海连起来，不露头皮
    hair_el.append(('ellipsoid', hc + fwd * (R * 0.45) + up * (R * 0.72), side, R * 0.55, (1.35, 0.7, 0.55)))
    # 刘海：一排小团盖住上半个额头
    for s in (-0.8, -0.4, 0.0, 0.4, 0.8):
        hair_el.append(('ellipsoid', hc + fwd * (R * 0.72) + up * (R * (0.5 - 0.08 * abs(s))) + side * (s * R * 0.6), up, R * 0.24, (0.85, 0.55, 1.0)))
    if girl:
        # 女生：两侧长发垂到下巴下面
        for s in (-1, 1):
            hair_el.append(('capsule', hc + side * (s * R * 0.84) - up * (R * 0.25) + fwd * (R * 0.18), up, R * 0.24, R * 0.45))
    else:
        for s in (-1, 1):
            hair_el.append(('ellipsoid', hc + side * (s * R * 0.86) + up * (R * 0.15) + fwd * (R * 0.1), up, R * 0.25, (0.55, 0.7, 1.1)))
    if hs == 'ponytail':
        pc = hc - fwd * (R * 1.0) + up * (R * 0.45)
        hair_el.append(('ellipsoid', pc - fwd * (R * 0.1), -fwd, R * 0.3, (0.9, 0.9, 0.9)))
        hair_el.append(('capsule', pc - fwd * (R * 0.42) - up * (R * 0.55), -up - fwd * 0.5, R * 0.28, R * 0.5))
    elif hs == 'bob':
        for s in (-1, 1):
            hair_el.append(('ellipsoid', hc + side * (s * R * 0.78) - up * (R * 0.25) - fwd * (R * 0.1), up, R * 0.42, (0.7, 0.95, 1.35)))
        hair_el.append(('ellipsoid', hc - fwd * (R * 0.6) - up * (R * 0.2), up, R * 0.75, (1.3, 0.8, 1.0)))
    hair_mesh = metaball(f'{name}_hair', hair_el, hair, 0.01)
    head_parts.append(hair_mesh)
    if hs == 'ponytail':
        head_parts.append(ellipsoid(f'{name}.tie', hc - fwd * (R * 1.08) + up * (R * 0.45), -fwd, (R * 0.2, R * 0.2, R * 0.1), mat('tie', st['tie'], 0.5), 16, 10))

    # --- 合并、蒙皮 ---
    body_parts = [shirt, pants, limbs, shoe, *soles, *extra]
    everything = body_parts + head_parts
    for o in everything:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        o.select_set(False)
    head_names = {o.name for o in head_parts}
    deform = [b for b in short if not any(k in b for k in ('Index', 'Middle', 'Ring', 'Pinky', 'Thumb'))]

    def weights(p):
        ds = []
        for b in deform:
            a, c = H(b), T(b)
            q, t = intersect_point_line(p, a, c)
            t = max(0.0, min(1.0, t))
            d = (p - (a + (c - a) * t)).length
            ds.append((d, b))
        ds.sort()
        top2 = ds[:2]
        w = [1 / (d ** 4 + 1e-6) for d, _ in top2]
        s = sum(w)
        return [(b, x / s) for (d, b), x in zip(top2, w)]

    for o in everything:
        groups = {}
        for b in deform:
            groups[b] = o.vertex_groups.new(name=short[b].name)
        for v in o.data.vertices:
            if o.name in head_names:
                groups['Head'].add([v.index], 1.0, 'REPLACE')
                continue
            if o.name in rigid_hips:
                groups['Hips'].add([v.index], 1.0, 'REPLACE')
                continue
            for b, w in weights(v.co):
                groups[b].add([v.index], w, 'ADD')

    bpy.ops.object.select_all(action='DESELECT')
    for o in everything:
        o.select_set(True)
    bpy.context.view_layer.objects.active = shirt
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = name
    body.parent = rig
    body.matrix_parent_inverse = rig.matrix_world.inverted()
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)

    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f'{name}_toon.glb')
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    body.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_skins=True, export_animations=False)
    print(f'TOON {name}: {tris} tris, {os.path.getsize(out) // 1024} KB -> {out}')

    if preview:
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        bpy.context.collection.objects.link(cam)
        target = H('Spine') + up * 0.05
        cam.location = target + fwd * 3.6 + side * 1.6 + up * 0.6
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = 55
        bpy.context.scene.camera = cam
        sc = bpy.context.scene
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'STUDIO'
        sc.display.shading.color_type = 'MATERIAL'
        sc.display.shading.show_shadows = False
        sc.display.shading.show_cavity = True
        sc.render.resolution_x, sc.render.resolution_y = 600, 800
        sc.render.filepath = preview
        bpy.ops.render.render(write_still=True)


main()
