"""Render a bust "photo" of every Q-version (toon) person for the character cards.

    blender --background --factory-startup --python tools/blender/render_portraits.py -- \
        public/models/people public/portraits [name ...]

Reads <dir>/<name>_toon.glb, drops the arms from the rest pose, frames head + shoulders from a
slight 3/4 angle with a warm key light and a cool rim light on a dark warm backdrop, and writes
<out>/<name>.jpg (480x640). These are placeholders: the game loads public/portraits/<name>.jpg,
so a finished illustration (e.g. from Dreamina) can replace a file with the same name.
"""
import glob
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
src_dir, out_dir = argv[0], argv[1]
names = argv[2:] or sorted(os.path.basename(p)[:-len('_toon.glb')] for p in glob.glob(os.path.join(src_dir, '*_toon.glb')))
os.makedirs(out_dir, exist_ok=True)


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for b in list(coll):
            if b.users == 0:
                coll.remove(b)


def bone(rig, suffix):
    for b in rig.pose.bones:
        if b.name.replace('mixamorig:', '').lower() == suffix.lower():
            return b
    for b in rig.pose.bones:
        if b.name.lower().endswith(suffix.lower()):
            return b
    return None


def setup_scene():
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    sc.render.resolution_x, sc.render.resolution_y = 480, 640
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 88
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w') if not sc.world else sc.world
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.11, 0.085, 0.065, 1)
    bg.inputs[1].default_value = 0.6


def light(name, kind, energy, color, loc, target, size=2.0):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == 'AREA':
        ld.size = size
    o = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (target - loc).to_track_quat('-Z', 'Y').to_euler()
    return o


setup_scene()
for name in names:
    path = os.path.join(src_dir, f'{name}_toon.glb')
    if not os.path.exists(path):
        print(f'SKIP {name}: no {path}')
        continue
    clear()
    bpy.ops.import_scene.gltf(filepath=path)
    rig = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not rig or not meshes:
        print(f'SKIP {name}: no rig/mesh')
        continue

    # 手臂放下来（静止姿势是 A 字，半身照里两条胳膊会斜着戳出去）
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for side, sgn in (('Left', 1), ('Right', -1)):
        b = bone(rig, f'{side}Arm')
        if not b:
            continue
        b.rotation_mode = 'XYZ'
        # 找一个让上臂几乎贴着身体往下（稍微往外张一点）的旋转：两个轴一起转，前后不歪
        want = Vector((sgn * 0.26, 0, -0.97)).normalized()
        best, best_e = -2.0, (0, 0, 0)
        for i in range(-20, 21):
            for k in range(-20, 21):
                e = (i * 0.06, 0, k * 0.06)
                b.rotation_euler = e
                bpy.context.view_layer.update()
                d = ((rig.matrix_world @ b.tail) - (rig.matrix_world @ b.head)).normalized()
                if d.dot(want) > best:
                    best, best_e = d.dot(want), e
        b.rotation_euler = best_e
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()

    head = bone(rig, 'Head')
    neck = bone(rig, 'Neck') or head
    hp = rig.matrix_world @ (head.head if head else Vector((0, 0, 1.4)))
    ht = rig.matrix_world @ (head.tail if head else Vector((0, 0, 1.6)))
    head_len = max((ht - hp).length, 0.12)
    # 头顶大概在头骨尾巴再往上一点；看向下巴和肩膀之间
    target = hp + Vector((0, 0, head_len * 0.05))
    # glTF 导入后人物朝 -Y，相机从前面偏右一点拍
    fwd = Vector((0, -1, 0))
    side = Vector((1, 0, 0))
    dist = head_len * 13.5
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.collection.objects.link(cam)
    cam.data.lens = 70
    cam.location = target + fwd * dist + side * dist * 0.28 + Vector((0, 0, head_len * 0.5))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam

    light('key', 'AREA', 260 * head_len / 0.25, (1.0, 0.88, 0.74), target + fwd * 2.2 + side * -1.6 + Vector((0, 0, 1.4)), target, 1.6)
    light('rim', 'AREA', 180 * head_len / 0.25, (0.62, 0.74, 0.95), target - fwd * 1.8 + side * 1.6 + Vector((0, 0, 0.8)), target, 1.2)
    light('fill', 'AREA', 50 * head_len / 0.25, (0.95, 0.9, 0.85), target + fwd * 2.5 + side * 1.8, target, 3.0)

    bpy.context.scene.render.filepath = os.path.join(out_dir, f'{name}.jpg')
    bpy.ops.render.render(write_still=True)
    print(f'PORTRAIT {name} -> {bpy.context.scene.render.filepath}')
