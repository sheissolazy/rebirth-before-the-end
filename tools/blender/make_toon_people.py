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
                    hair_style='ponytail', tie='#ef6a78', girl=True, short_sleeve=True, clip='#ffd25a'),
    # 妈妈：深棕齐耳短发、酒红上衣、深灰长裙
    'mom': dict(skin='#f1caa8', hair='#4b3229', top='#a8404f', bottom='#545460', shoes='#4a3a34', sole='#2a2220',
                hair_style='bob', girl=True, skirt=True),
    # 爸爸：寸头、军绿外套、牛仔裤
    'dad': dict(skin='#ebc19e', hair='#2b221f', top='#5f7350', bottom='#3d5a86', shoes='#3a302a', sole='#221c18',
                hair_style='short', girl=False),
    # --- 男主：比一家人高挑一点（腿长一些、头小一点、眼睛细长一点）---
    # 江野：青梅竹马、阳光，乱糟糟的短发，牛仔外套、黑裤子、白球鞋
    'jiangye': dict(skin='#eec29c', hair='#3a271e', top='#4f7fbf', bottom='#2b2b31', shoes='#efefea', sole='#cfcfca',
                    hair_style='messy', girl=False, lead=True, inner='#f4f1e8'),
    # 沈砚：医生，整齐的侧分、细框眼镜，白大褂里是浅蓝衬衫
    'shenyan': dict(skin='#f3d3b8', hair='#1f1a1c', top='#f4f4f0', bottom='#5b6272', shoes='#2d2a2a', sole='#1c1a1a',
                    hair_style='sidepart', girl=False, lead=True, glasses=True, coat='#f4f4f0', inner='#a9c6e3'),
    # 顾沉：军区基地长，板寸、高大，一身军绿作训服、黑靴子
    'guchen': dict(skin='#e2b48e', hair='#191514', top='#55623f', bottom='#4c5638', shoes='#1d1b1a', sole='#111010',
                   hair_style='buzz', girl=False, lead=True, chest=0.19),
    # 谢临：同为重生者，偏长的黑发、苍白，黑色长风衣
    'xielin': dict(skin='#f5ddcc', hair='#141216', top='#2a2930', bottom='#24232a', shoes='#1a191d', sole='#0f0e11',
                   hair_style='long', girl=False, lead=True, coat='#2a2930', inner='#55525c'),
    # --- 其他人 ---
    # 王阿姨：花白的发髻、紫红碎花上衣
    'neighbor': dict(skin='#ecc5a3', hair='#a49e98', top='#8d5a8f', bottom='#4b4650', shoes='#3a3333', sole='#221e1e',
                     hair_style='bun', girl=True),
    # 门外的陌生人：工装夹克的大叔
    'stranger': dict(skin='#dcae86', hair='#2f2a27', top='#6d7177', bottom='#8a7b5c', shoes='#3b3128', sole='#221c18',
                     hair_style='short', girl=False),
    'survivor_f': dict(skin='#f2cdb0', hair='#5a3b2a', top='#c9a982', bottom='#3f4a63', shoes='#6a5240', sole='#3d2f25',
                       hair_style='ponytail', tie='#7a5a44', girl=True),
    'survivor_m': dict(skin='#e5ba95', hair='#2e2420', top='#a64c43', bottom='#585d66', shoes='#3a3633', sole='#222020',
                       hair_style='messy', girl=False),
    # 丧尸：灰绿的皮肤、发黄的眼睛、衣服上有血
    'zombie_m': dict(skin='#9cae8a', hair='#2c2a26', top='#6c6a5e', bottom='#4b4a45', shoes='#2e2b27', sole='#1c1a17',
                     hair_style='messy', girl=False, zombie=True),
    'zombie_f': dict(skin='#a3b293', hair='#3b302a', top='#7d6b6a', bottom='#4c4650', shoes='#2e2b27', sole='#1c1a17',
                     hair_style='bob', girl=True, skirt=True, zombie=True),
}


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


MATS = {}
MB_SCALE = 1.6
DECIMATE = 0.42
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
    # 融球转出来的网格很密：减到四成多（光滑的形状减面后看不出来），网页加载快一倍多
    dec = me_ob.modifiers.new('dec', 'DECIMATE')
    dec.ratio = DECIMATE
    bpy.ops.object.modifier_apply(modifier='dec')
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
    lead = st.get('lead', False)
    chibi(rig, 0.88 if lead else LEG_SCALE, 0.92 if lead else ARM_SCALE)
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
    zombie = st.get('zombie', False)
    eye = mat('eye', '#e3cf62' if zombie else '#231c22', 0.2)
    shine = mat('eyeshine', '#ffffff', 0.2)
    blush = mat('blush', '#f4a3a0', 0.9)
    mouth = mat('mouth', '#3a2a2a' if zombie else '#b04e52', 0.6)
    girl = st['girl']

    def seg(a, b, r, kind='capsule', shrink=0.0):
        p0, p1 = H(a), H(b)
        d = p1 - p0
        return ('capsule', (p0 + p1) / 2, d, r, max(0.001, d.length / 2 - shrink))

    # --- 身体（融球，一体光滑）---
    neck_top = H('Head')
    chest_w = st.get('chest', 0.15 if girl else 0.17)
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
    # 领口：脖子根一圈深一点的边
    bpy.ops.mesh.primitive_torus_add(major_radius=0.062, minor_radius=0.016, major_segments=32, minor_segments=10,
                                     location=H('Neck') + up * 0.005 + fwd * 0.012)
    collar = bpy.context.view_layer.objects.active
    collar.name = f'{name}.collar'
    collar.scale = (1.0, 0.9, 1.0)
    darker = '#' + ''.join(f'{int(int(st["top"][i:i + 2], 16) * 0.72):02x}' for i in (1, 3, 5))
    collar.data.materials.append(mat('collar', darker, 0.8))
    for pl in collar.data.polygons:
        pl.use_smooth = True

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

    if st.get('coat'):
        # 长外套 / 白大褂：从腰到膝盖的下摆（圆台），跟着胯走
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=32, radius1=0.25, radius2=0.2, depth=0.5)
        # 前面开襟：去掉正前方一条，露出裤子（不然像裙子）
        f2 = Vector((fwd.x, fwd.y))
        cut = [f for f in bm.faces if Vector((f.calc_center_median().x, f.calc_center_median().y)).normalized().dot(f2) > 0.93]
        bmesh.ops.delete(bm, geom=cut, context='FACES')
        me = bpy.data.meshes.new(f'{name}.coat')
        bm.to_mesh(me)
        bm.free()
        ct = bpy.data.objects.new(f'{name}.coat', me)
        bpy.context.collection.objects.link(ct)
        ct.location = H('Hips') - up * 0.16
        ct.scale = (1.0, 0.8, 1.0)
        ct.data.materials.append(mat('coat', st['coat'], 0.8))
        for pl in ct.data.polygons:
            pl.use_smooth = True
        ct.modifiers.new('solid', 'SOLIDIFY').thickness = 0.012
        bpy.context.view_layer.objects.active = ct
        bpy.ops.object.modifier_apply(modifier='solid')
        rigid_hips.append(ct.name)
        extra.append(ct)
    if st.get('inner'):
        # 敞开的外套里露出来的衬衫 / T 恤：胸口一竖条
        # 倒三角的 V 领：上宽下尖、压扁贴在胸口（以前是椭圆，像吐出来的舌头）
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=20, radius1=0.004, radius2=0.062, depth=0.19)
        me = bpy.data.meshes.new(f'{name}.inner')
        bm.to_mesh(me)
        bm.free()
        vn = bpy.data.objects.new(f'{name}.inner', me)
        bpy.context.collection.objects.link(vn)
        top_c = H('Neck') - up * 0.03
        vn.matrix_world = Matrix.Translation(top_c - up * 0.095 + fwd * 0.085) @ fwd.to_track_quat('Y', 'Z').to_matrix().to_4x4() @ Matrix.Diagonal((1.0, 0.22, 1.0, 1.0))
        vn.data.materials.append(mat('inner', st['inner'], 0.8))
        for pl in vn.data.polygons:
            pl.use_smooth = True
        extra.append(vn)
    if zombie:
        # 衣服上几块血迹
        blood = mat('blood', '#5e1a1a', 0.5)
        for k, (sx, uy) in enumerate([(0.06, 0.02), (-0.08, -0.08), (0.1, -0.15)]):
            c = H('Spine1') + side * sx + up * uy + fwd * (0.105 + 0.01 * k)
            extra.append(ellipsoid(f'{name}.blood{k}', c, fwd, (0.045 - k * 0.008, 0.035, 0.012), blood, 14, 8))

    arms = []
    for s in ('Left', 'Right'):
        a, f, h = H(f'{s}Arm'), H(f'{s}ForeArm'), H(f'{s}Hand')
        if st.get('short_sleeve'):
            arms.append(('capsule', a + (f - a) * 0.7, f - a, 0.045, (f - a).length * 0.32))
        arms.append(('capsule', (f + h) / 2, h - f, 0.042, (h - f).length / 2))
        d = (h - f).normalized()
        # 手：扁一点的小手掌 + 往前的大拇指（像手套）
        arms.append(('ellipsoid', h + d * 0.055, d, 0.054, (1.05, 0.62, 0.95)))
        arms.append(('capsule', h + d * 0.035 + fwd * 0.035, d * 0.6 + fwd, 0.02, 0.02))
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
    R = 0.17 if lead else 0.185 if girl else 0.19
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
        ew, eh = (R * 0.135, R * 0.19) if girl else (R * 0.125, R * 0.155) if lead else (R * 0.12, R * 0.16)
        head_parts.append(ellipsoid(f'{name}.eye', on_face(ex, ey, 0.045), face_axis(ex, ey), (ew, eh, eye_d), eye, 20, 14))
        if not zombie:
            # 眼珠下半截透出暖棕色（像动画里的眼睛），上面一大一小两个高光
            iris = mat('iris', st.get('iris', '#6b4330'), 0.25)
            head_parts.append(ellipsoid(f'{name}.iris', on_face(ex, ey - eh / R * 0.28, 0.03), face_axis(ex, ey), (ew * 0.72, eh * 0.55, eye_d * 0.6), iris, 18, 12))
            head_parts.append(ellipsoid(f'{name}.shine', on_face(ex + s * 0.04, ey + 0.07 * (eh / (R * 0.16)), 0.0), face_axis(ex, ey), (R * 0.045, R * 0.05, R * 0.025), shine, 12, 8))
            head_parts.append(ellipsoid(f'{name}.shine2', on_face(ex - s * 0.045, ey - eh / R * 0.45, 0.005), face_axis(ex, ey), (R * 0.022, R * 0.022, R * 0.015), shine, 10, 6))
        # 眉毛：眼睛上方一点、外侧微微往下（显得温和）
        bx, by = s * 0.37, 0.24 if not lead else 0.2
        # 男主的眉毛更平、更浓；丧尸皱着眉
        tilt = -0.18 if not lead else 0.04
        if zombie:
            tilt = 0.35
        brow_dir = (side * s + up * tilt).normalized()
        head_parts.append(ellipsoid(f'{name}.brow', on_face(bx, by, 0.015), brow_dir, (R * (0.04 if lead else 0.032), R * 0.032, R * 0.14), hair, 12, 8))
        if girl:
            # 女生：眼睛外上角一小撮睫毛
            lx, ly = ex + s * 0.11, ey + 0.15
            head_parts.append(ellipsoid(f'{name}.lash', on_face(lx, ly, 0.005), (side * s + up * 0.9).normalized(), (R * 0.022, R * 0.022, R * 0.075), eye, 10, 6))
        if not zombie:
            head_parts.append(ellipsoid(f'{name}.blush', on_face(s * 0.58, -0.3, 0.03), face_axis(s * 0.58, -0.3), (R * (0.1 if lead else 0.14), R * 0.06 if lead else R * 0.085, R * 0.04), blush, 16, 8))
    # 嘴：一道往上弯的小笑弧（曲线挤成细管）
    curve = bpy.data.curves.new(f'{name}.smile', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = R * 0.02
    curve.bevel_resolution = 3
    sp = curve.splines.new('POLY')
    pts = [(-0.11, -0.385), (-0.06, -0.42), (0.0, -0.432), (0.06, -0.42), (0.11, -0.385)]
    if lead:
        pts = [(-0.08, -0.4), (0.0, -0.418), (0.08, -0.4)]
    if zombie:
        pts = [(-0.11, -0.45), (-0.05, -0.415), (0.0, -0.405), (0.05, -0.415), (0.11, -0.45)]
    sp.points.add(len(pts) - 1)
    for i, (x, y) in enumerate(pts):
        sp.points[i].co = (*on_face(x, y, 0.01), 1.0)
    smile = bpy.data.objects.new(f'{name}.smile', curve)
    bpy.context.collection.objects.link(smile)
    bpy.ops.object.select_all(action='DESELECT')
    smile.select_set(True)
    bpy.context.view_layer.objects.active = smile
    bpy.ops.object.convert(target='MESH')
    smile = bpy.context.view_layer.objects.active
    smile.data.materials.append(mouth)
    head_parts.append(smile)
    head_parts.append(ellipsoid(f'{name}.nose', on_face(0, -0.18, 0.0), fwd, (R * 0.05, R * 0.045, R * 0.035), skin, 12, 8))
    if st.get('glasses'):
        # 细框眼镜：两个圆框 + 鼻梁
        frame = mat('glasses', '#2b2622', 0.4)
        for s in (-1, 1):
            c = on_face(s * 0.36, -0.06, -0.06)
            bpy.ops.mesh.primitive_torus_add(major_radius=R * 0.2, minor_radius=R * 0.018, major_segments=28, minor_segments=6, location=c)
            g = bpy.context.view_layer.objects.active
            g.rotation_mode = 'QUATERNION'
            g.rotation_quaternion = face_axis(s * 0.36, -0.06).to_track_quat('Z', 'Y')
            g.data.materials.append(frame)
            head_parts.append(g)
        a, b = on_face(-0.17, -0.02, -0.07), on_face(0.17, -0.02, -0.07)
        head_parts.append(ellipsoid(f'{name}.bridge', (a + b) / 2, side, (R * 0.015, R * 0.015, (b - a).length / 2), frame, 8, 6))
    # 头发：融球捏的发型
    hs = st['hair_style']
    # 发顶：往后、往上挪，前沿正好在额头；不用挖洞，脸自然露出来
    # 板寸：贴着头皮的一层，整个头顶和后脑都盖住，前面发际线高一点
    if hs == 'buzz':
        hair_el = [('ellipsoid', hc + up * (R * 0.1) - fwd * (R * 0.16), side, R * 1.0, (1.0, 1.0, 1.0))]
    else:
        hair_el = [('ellipsoid', hc + up * (R * 0.16) - fwd * (R * 0.12), side, R * 1.03, (1.0, 1.02, 0.98))]
    # 前额那一片：把发顶和刘海连起来，不露头皮
    hair_el.append(('ellipsoid', hc + fwd * (R * 0.45) + up * (R * 0.72), side, R * 0.55, (1.35, 0.7, 0.55)))
    # 刘海：几缕贴着额头、斜着垂下来的发束（以前是一圈"发箍"）
    def on_head(sx, uy, lift):
        n = face_axis(sx, uy)
        return hc + n * (R * (0.96 + lift))

    def strand(pts, r):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            a, b = on_head(x0, y0, 0.06), on_head(x1, y1, 0.06)
            hair_el.append(('capsule', (a + b) / 2, b - a, R * r, (b - a).length / 2))

    if hs == 'ponytail':
        # 女主：右边分缝，大半往左扫
        strand([(0.28, 0.9), (0.0, 0.72), (-0.42, 0.5), (-0.62, 0.36)], 0.15)
        strand([(0.18, 0.86), (-0.12, 0.6), (-0.3, 0.42)], 0.13)
        strand([(0.36, 0.86), (0.52, 0.62), (0.64, 0.42)], 0.12)
    elif hs == 'bob':
        # 妈妈：中分的八字刘海
        for s in (-1, 1):
            strand([(s * 0.05, 0.92), (s * 0.3, 0.7), (s * 0.55, 0.48), (s * 0.66, 0.3)], 0.15)
    elif hs == 'messy':
        # 江野：乱糟糟往两边翘的碎发，头顶几撮支棱着
        for x, y0, y1 in ((-0.55, 0.8, 0.5), (-0.25, 0.9, 0.55), (0.05, 0.92, 0.6), (0.35, 0.88, 0.52), (0.6, 0.75, 0.45)):
            strand([(x * 0.8, y0), (x, y1)], 0.15)
        for x in (-0.3, 0.1, 0.4):
            hair_el.append(('ellipsoid', hc + up * (R * 1.05) + side * (x * R) - fwd * (R * 0.1), up + side * x, R * 0.22, (0.6, 0.6, 1.2)))
    elif hs == 'sidepart':
        # 沈砚：左边分缝，整齐地往右梳
        strand([(-0.3, 0.9), (0.1, 0.8), (0.5, 0.6), (0.68, 0.42)], 0.16)
        strand([(-0.35, 0.82), (-0.55, 0.62)], 0.13)
    elif hs == 'buzz':
        pass
    elif hs == 'long':
        strand([(0.1, 0.92), (-0.25, 0.7), (-0.5, 0.45), (-0.6, 0.15)], 0.15)
        strand([(0.2, 0.9), (0.45, 0.62), (0.6, 0.3)], 0.14)
    elif hs == 'bun':
        for s in (-1, 1):
            strand([(s * 0.05, 0.9), (s * 0.4, 0.72)], 0.15)
    else:
        # 爸爸：短短的、往上翘一点的前额碎发
        for x in (-0.45, -0.15, 0.15, 0.42):
            strand([(x * 0.9, 0.84), (x, 0.66)], 0.15)
    if hs == 'bun':
        # 王阿姨：短发贴着耳朵，脑后一个发髻
        for s in (-1, 1):
            hair_el.append(('ellipsoid', hc + side * (s * R * 0.84) + fwd * (R * 0.05), up, R * 0.3, (0.6, 0.8, 1.1)))
        hair_el.append(('ellipsoid', hc - fwd * (R * 1.0) + up * (R * 0.35), -fwd, R * 0.33, (1.0, 1.0, 0.9)))
    elif hs == 'long':
        # 谢临：盖住耳朵、垂到脖子的黑发
        for s in (-1, 1):
            hair_el.append(('capsule', hc + side * (s * R * 0.86) - up * (R * 0.2) + fwd * (R * 0.05), up, R * 0.26, R * 0.5))
        hair_el.append(('ellipsoid', hc - fwd * (R * 0.55) - up * (R * 0.35), up, R * 0.8, (1.25, 0.75, 1.0)))
    elif girl:
        # 女生：两侧长发垂到下巴下面
        for s in (-1, 1):
            hair_el.append(('capsule', hc + side * (s * R * 0.84) - up * (R * 0.25) + fwd * (R * 0.18), up, R * 0.24, R * 0.45))
    elif hs == 'buzz':
        pass
    else:
        for s in (-1, 1):
            hair_el.append(('ellipsoid', hc + side * (s * R * 0.78) + up * (R * 0.22) + fwd * (R * 0.02), up, R * 0.2, (0.5, 0.7, 1.0)))
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
    if st.get('clip'):
        # 女主：右边刘海上一个小星星发夹
        c = on_head_pt = hc + face_axis(0.55, 0.58) * (R * 1.06)
        star = mat('clip', st['clip'], 0.4)
        for k in range(5):
            a = math.radians(90 + k * 72)
            d = (side * math.cos(a) + up * math.sin(a)) * (R * 0.07)
            head_parts.append(ellipsoid(f'{name}.clip{k}', c + d, d.normalized(), (R * 0.03, R * 0.03, R * 0.06), star, 8, 6))
        head_parts.append(ellipsoid(f'{name}.clipc', c, face_axis(0.55, 0.58), (R * 0.055, R * 0.055, R * 0.03), star, 12, 8))
    if hs == 'ponytail':
        head_parts.append(ellipsoid(f'{name}.tie', hc - fwd * (R * 1.08) + up * (R * 0.45), -fwd, (R * 0.2, R * 0.2, R * 0.1), mat('tie', st['tie'], 0.5), 16, 10))

    # --- 合并、蒙皮 ---
    body_parts = [shirt, collar, pants, limbs, shoe, *soles, *extra]
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
