"""Generate the low-poly villa kit for the 2.5D prototype.

Run headless:
  blender --background --factory-startup --python tools/blender/build_villa_kit.py -- \
      --out public/models/villa_kit.glb --preview /tmp/villa_preview.png

Every piece sits on a 1 m grid with its origin at the bottom centre of its cell, so
three.js can snap pieces by integer coordinates. Materials are named `pal_<key>`;
the game swaps them for toon materials of the same palette colour.
"""
import argparse
import math
import sys

import bpy
import mathutils

# Soft toon palette, matched to the island-fishing reference look.
PALETTE = {
    'wall': (0.910, 0.820, 0.690),
    'trim': (0.431, 0.345, 0.275),
    'floor': (0.690, 0.450, 0.280),
    'wood': (0.640, 0.410, 0.240),
    'wood_dark': (0.400, 0.250, 0.150),
    'roof': (0.780, 0.408, 0.290),
    'glass': (0.450, 0.780, 0.860),
    'metal': (0.490, 0.541, 0.569),
    'fabric': (0.300, 0.520, 0.720),
    'linen': (0.957, 0.937, 0.894),
    'grass': (0.420, 0.680, 0.280),
    'stone': (0.639, 0.663, 0.678),
}

WALL_H = 2.6
WALL_T = 0.2


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--preview')
    return ap.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(key):
    name = f'pal_{key}'
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        bsdf = mat.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*PALETTE[key], 1.0)
        bsdf.inputs['Roughness'].default_value = 0.9
    return mat


def box(name, size, loc, key, bevel=0.015):
    """Axis-aligned box; `loc` is the centre of its bottom face."""
    sx, sy, sz = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], loc[1], loc[2] + sz / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(material(key))
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
    return obj


def join(name, parts, origin=(0, 0, 0)):
    """Merge parts into one mesh object whose origin is `origin`."""
    for p in parts:
        bpy.context.view_layer.objects.active = p
        for m in list(p.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    bpy.context.scene.cursor.location = origin
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return obj


# --- kit pieces, each built at the world origin -------------------------------

def floor_tile():
    return join('floor_1x1', [box('f', (1, 1, 0.1), (0, 0, -0.1), 'floor', bevel=0.01)])


def grass_tile():
    return join('grass_1x1', [box('g', (1, 1, 0.1), (0, 0, -0.1), 'grass', bevel=0.0)])


def wall():
    return join('wall_1m', [
        box('w', (1, WALL_T, WALL_H), (0, 0, 0), 'wall'),
        box('b', (1, WALL_T + 0.04, 0.12), (0, 0, 0), 'trim'),
    ])


def wall_window():
    sill, top = 0.9, 2.0
    side = 0.2
    hole = 1 - 2 * side
    return join('wall_window_1m', [
        box('lo', (1, WALL_T, sill), (0, 0, 0), 'wall'),
        box('hi', (1, WALL_T, WALL_H - top), (0, 0, top), 'wall'),
        box('l', (side, WALL_T, top - sill), (-0.5 + side / 2, 0, sill), 'wall'),
        box('r', (side, WALL_T, top - sill), (0.5 - side / 2, 0, sill), 'wall'),
        box('sill', (hole + 0.1, WALL_T + 0.08, 0.06), (0, 0, sill - 0.03), 'trim'),
        box('glass', (hole, 0.03, top - sill), (0, 0, sill), 'glass', bevel=0),
        box('mullion', (0.04, 0.05, top - sill), (0, 0, sill), 'trim', bevel=0),
        box('b', (1, WALL_T + 0.04, 0.12), (0, 0, 0), 'trim'),
    ])


def wall_door():
    door_w, door_h = 0.9, 2.1
    side = (1 - door_w) / 2
    return join('wall_door_1m', [
        box('l', (side, WALL_T, door_h), (-0.5 + side / 2, 0, 0), 'wall', bevel=0.005),
        box('r', (side, WALL_T, door_h), (0.5 - side / 2, 0, 0), 'wall', bevel=0.005),
        box('top', (1, WALL_T, WALL_H - door_h), (0, 0, door_h), 'wall'),
        box('frame', (door_w + 0.06, WALL_T + 0.04, 0.06), (0, 0, door_h), 'trim', bevel=0),
    ])


def door():
    return join('door_1m', [
        box('slab', (0.86, 0.06, 2.06), (0, 0, 0), 'wood_dark'),
        box('knob', (0.06, 0.1, 0.06), (0.32, 0, 1.0), 'metal', bevel=0),
    ])


def fence():
    parts = [box(f'p{i}', (0.1, 0.1, 1.1), (x, 0, 0), 'wood') for i, x in enumerate((-0.45, 0.45))]
    parts += [box(f'r{i}', (1, 0.06, 0.08), (0, 0, z), 'wood') for i, z in enumerate((0.35, 0.8))]
    return join('fence_1m', parts)


def gate():
    parts = [box(f'p{i}', (0.14, 0.14, 1.6), (x, 0, 0), 'stone') for i, x in enumerate((-0.47, 0.47))]
    parts += [box(f'bar{i}', (0.03, 0.03, 1.3), (-0.33 + i * 0.11, 0, 0.1), 'metal', bevel=0) for i in range(7)]
    parts += [box(f'rail{i}', (0.8, 0.04, 0.05), (0, 0, z), 'metal', bevel=0) for i, z in enumerate((0.15, 1.3))]
    return join('gate_1m', parts)


def crate():
    return join('crate', [
        box('c', (0.6, 0.6, 0.6), (0, 0, 0), 'wood', bevel=0.03),
        box('band', (0.62, 0.62, 0.08), (0, 0, 0.26), 'wood_dark', bevel=0),
    ])


def bed():
    return join('bed', [
        box('frame', (1.0, 2.0, 0.35), (0, 0, 0), 'wood'),
        box('head', (1.0, 0.08, 0.9), (0, -0.96, 0), 'wood_dark'),
        box('mattress', (0.92, 1.9, 0.18), (0, 0.02, 0.35), 'linen', bevel=0.04),
        box('blanket', (0.94, 1.15, 0.06), (0, 0.38, 0.5), 'fabric', bevel=0.03),
        box('pillow', (0.6, 0.32, 0.12), (0, -0.7, 0.53), 'linen', bevel=0.05),
    ])


def table():
    parts = [box('top', (1.2, 0.7, 0.06), (0, 0, 0.72), 'wood')]
    parts += [box(f'l{i}', (0.06, 0.06, 0.72), (x, y, 0), 'wood_dark')
              for i, (x, y) in enumerate(((-0.54, -0.29), (0.54, -0.29), (-0.54, 0.29), (0.54, 0.29)))]
    return join('table', parts)


def chair():
    parts = [box('seat', (0.45, 0.45, 0.05), (0, 0, 0.45), 'wood'),
             box('back', (0.45, 0.05, 0.45), (0, -0.2, 0.5), 'wood')]
    parts += [box(f'l{i}', (0.05, 0.05, 0.45), (x, y, 0), 'wood_dark')
              for i, (x, y) in enumerate(((-0.19, -0.19), (0.19, -0.19), (-0.19, 0.19), (0.19, 0.19)))]
    return join('chair', parts)


BUILDERS = [floor_tile, grass_tile, wall, wall_window, wall_door, door, fence, gate, crate, bed, table, chair]


def place(src, loc, rot_z=0.0):
    """Linked duplicate of a kit piece for the preview vignette."""
    obj = src.copy()
    obj.location = loc
    obj.rotation_euler = (0, 0, math.radians(rot_z))
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_preview(kit):
    """A corner of the villa: grass yard, fence and gate, a room with bed and table."""
    for x in range(-2, 7):
        for y in range(-3, 6):
            inside = 0 <= x <= 4 and 0 <= y <= 3
            place(kit['floor_1x1' if inside else 'grass_1x1'], (x, y, 0))
    # back walls only (front walls are faded in the game when the camera looks in)
    for x in range(5):
        piece = 'wall_window_1m' if x in (1, 3) else 'wall_1m'
        place(kit[piece], (x, 3.5, 0))
    for y in range(4):
        piece = 'wall_door_1m' if y == 1 else 'wall_1m'
        place(kit[piece], (-0.5, y, 0), rot_z=90)
    place(kit['door_1m'], (-0.5, 1, 0), rot_z=90)
    place(kit['bed'], (3.5, 2.4, 0), rot_z=180)
    place(kit['table'], (1.5, 1.5, 0))
    place(kit['chair'], (1.5, 0.9, 0), rot_z=180)
    place(kit['chair'], (1.5, 2.1, 0))
    for loc in ((0.4, 2.9, 0), (0.4, 2.3, 0)):
        place(kit['crate'], loc)
    for y in range(-3, 6):
        place(kit['gate_1m' if y == 1 else 'fence_1m'], (-2.5, y, 0), rot_z=90)
    for x in range(-2, 7):
        place(kit['fence_1m'], (x, -3.5, 0))


def setup_render(path):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1280, 800
    scene.render.filepath = path
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.exposure = -0.35
    world = bpy.data.worlds.new('world')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.60, 0.72, 0.82, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.45
    scene.world = world
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.0
    sun.data.angle = math.radians(8)
    sun.rotation_euler = (math.radians(45), math.radians(15), math.radians(30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 11
    # fixed 45° interior view: yaw 45°, pitch 55° from vertical; back off along the view axis
    rot = mathutils.Euler((math.radians(55), 0, math.radians(45)), 'XYZ')
    cam.rotation_euler = rot
    target = mathutils.Vector((2.0, 1.0, 0.8))
    cam.location = target + rot.to_matrix() @ mathutils.Vector((0, 0, 20))
    scene.collection.objects.link(cam)
    scene.camera = cam


def main():
    args = parse_args()
    reset_scene()
    kit = {}
    for i, build in enumerate(BUILDERS):
        obj = build()
        obj.location = (i * 2.5, -20, 0)  # park the kit away from the preview vignette
        kit[obj.name] = obj
    bpy.ops.object.select_all(action='DESELECT')
    for obj in kit.values():
        obj.location = (0, 0, 0)
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', use_selection=True, export_apply=True)
    print(f'KIT exported {len(kit)} pieces -> {args.out}')
    if args.preview:
        for i, obj in enumerate(kit.values()):
            obj.location = (i * 2.5, -40, 0)
        build_preview(kit)
        setup_render(args.preview)
        bpy.ops.render.render(write_still=True)
        print(f'PREVIEW -> {args.preview}')


main()
