"""Generate the game's people with MakeHuman (MPFB 2 for Blender), all CC0 assets.

blender --background --factory-startup --python tools/blender/make_people.py -- \
    <makehuman_system_assets_cc0.zip> <out_dir> [name ...]

Installs the MakeHuman system asset pack into MPFB's user data (first run only), then
builds each character: body shape, skin, eyes, eyebrows, eyelashes, hair, clothes and a
Mixamo-compatible rig, and exports one .glb per person with WebP textures.
"""
import os
import sys
import zipfile

import bpy

PEOPLE = {
    # 林知夏：25 岁左右，高马尾，休闲装
    'heroine': dict(
        macro=dict(gender=0.0, age=0.5, muscle=0.5, weight=0.45, height=0.55, proportions=0.65, cupsize=0.5, firmness=0.5),
        skin='young_asian_female', hair='ponytail01', eyebrows='eyebrow002', eyelashes='eyelashes01',
        clothes=['female_casualsuit01', 'shoes01'],
    ),
    # 妈妈：50 岁左右，短发
    'mom': dict(
        macro=dict(gender=0.0, age=0.69, muscle=0.45, weight=0.6, height=0.42, proportions=0.5, cupsize=0.5, firmness=0.4),
        skin='middleage_asian_female', hair='bob02', eyebrows='eyebrow005', eyelashes='eyelashes02',
        clothes=['female_elegantsuit01', 'shoes04'],
    ),
    # 爸爸：53 岁左右，短发
    'dad': dict(
        macro=dict(gender=1.0, age=0.72, muscle=0.55, weight=0.62, height=0.5, proportions=0.5, cupsize=0.5, firmness=0.5),
        skin='middleage_asian_male', hair='short02', eyebrows='eyebrow009', eyelashes='eyelashes03',
        clothes=['male_casualsuit05', 'shoes03'],
    ),
    # 丧尸（游戏里再把皮肤调成灰绿、衣服弄脏）：干活的大叔、穿运动服的阿姨
    'zombie_m': dict(
        macro=dict(gender=1.0, age=0.8, muscle=0.4, weight=0.45, height=0.55, proportions=0.45, cupsize=0.5, firmness=0.4),
        skin='old_asian_male', hair='short04', eyebrows='eyebrow010', eyelashes='eyelashes01',
        clothes=['male_worksuit01', 'shoes02'],
    ),
    'zombie_f': dict(
        macro=dict(gender=0.0, age=0.6, muscle=0.4, weight=0.4, height=0.48, proportions=0.5, cupsize=0.5, firmness=0.4),
        skin='old_asian_female', hair='long01', eyebrows='eyebrow001', eyelashes='eyelashes02',
        clothes=['female_sportsuit01', 'shoes05'],
    ),
}


def enable_mpfb():
    mod = 'bl_ext.blender_org.mpfb'
    if mod not in bpy.context.preferences.addons:
        bpy.ops.preferences.addon_enable(module=mod)


def find_asset(data, kind, name, ext):
    path = os.path.join(data, kind, name, f'{name}.{ext}')
    if os.path.exists(path):
        return path
    for root, _dirs, files in os.walk(os.path.join(data, kind)):
        for f in files:
            if f == f'{name}.{ext}':
                return os.path.join(root, f)
    raise FileNotFoundError(f'{kind}/{name}.{ext}')


def build(name, spec, data, out_dir):
    from bl_ext.blender_org.mpfb.services import HumanService, TargetService
    bpy.ops.wm.read_factory_settings(use_empty=True)
    enable_mpfb()
    macro = TargetService.get_default_macro_info_dict()
    for k, v in spec['macro'].items():
        macro[k] = v
    macro['race'] = {'asian': 1.0, 'african': 0.0, 'caucasian': 0.0}
    body = HumanService.create_human(scale=0.1, macro_detail_dict=macro)
    body.name = name
    rig = HumanService.add_builtin_rig(body, 'mixamo')
    rig.name = f'{name}_rig'
    HumanService.set_character_skin(find_asset(data, 'skins', spec['skin'], 'mhmat'), body, skin_type='GAMEENGINE')
    assets = [
        ('eyes', 'low-poly', 'Eyes'),
        ('eyebrows', spec['eyebrows'], 'Eyebrows'),
        ('eyelashes', spec['eyelashes'], 'Eyelashes'),
        ('hair', spec['hair'], 'Hair'),
    ] + [('clothes', c, 'Clothes') for c in spec['clothes']]
    for kind, asset, atype in assets:
        HumanService.add_mhclo_asset(find_asset(data, kind, asset, 'mhclo'), body, asset_type=atype,
                                     subdiv_levels=0, material_type='GAMEENGINE')
    # 眼睛换成棕色（默认材质偏红）
    eye_png = os.path.join(data, 'eyes', 'materials', f"{spec.get('eyes', 'brown')}_eye.png")
    for o in bpy.data.objects:
        if o.type == 'MESH' and 'low-poly' in o.name and os.path.exists(eye_png):
            for slot in o.material_slots:
                if slot.material and slot.material.use_nodes:
                    for nd in slot.material.node_tree.nodes:
                        if nd.type == 'TEX_IMAGE' and nd.image and 'nor' not in nd.image.name.lower():
                            nd.image = bpy.data.images.load(eye_png)
                            break
    for img in bpy.data.images:
        if img.size[0] > 1024:
            s = 1024 / max(img.size[0], img.size[1])
            img.scale(int(img.size[0] * s), int(img.size[1] * s))
    # 去掉细分修改器，导出时只保留骨骼
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for m in list(o.modifiers):
                if m.type == 'SUBSURF':
                    o.modifiers.remove(m)
    # 皮肤、眼睛、衣服、鞋不透明；头发、眉毛、睫毛用镂空。
    # MPFB 默认全是半透明混合，游戏引擎里脸会被后脑勺的头发盖住。
    cutout = ('hair', 'eyebrow', 'eyelash', spec['hair'])
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = next((nd for nd in mat.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        if any(c in mat.name.lower() for c in cutout):
            if hasattr(mat, 'surface_render_method'):
                mat.surface_render_method = 'DITHERED'
        else:
            for link in list(bsdf.inputs['Alpha'].links):
                mat.node_tree.links.remove(link)
            bsdf.inputs['Alpha'].default_value = 1.0
            if hasattr(mat, 'surface_render_method'):
                mat.surface_render_method = 'DITHERED'
    keep = {rig} | {o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig}
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        o.select_set(True)
    out = os.path.join(out_dir, f'{name}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True,
                              export_skins=True, export_animations=False, export_image_format='WEBP',
                              export_image_quality=80)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    bones = len(rig.data.bones)
    print(f'PERSON {name}: {tris} tris (before masks), {bones} bones, {os.path.getsize(out) // 1024} KB')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    pack, out_dir, names = argv[0], argv[1], argv[2:] or list(PEOPLE)
    os.makedirs(out_dir, exist_ok=True)
    enable_mpfb()
    from bl_ext.blender_org.mpfb.services import LocationService, AssetService
    data = LocationService.get_user_data()
    if not os.path.exists(os.path.join(data, 'hair', 'ponytail01')) and os.path.exists(pack):
        with zipfile.ZipFile(pack) as z:
            z.extractall(data)
        print('INSTALLED system assets into', data)
    AssetService.update_all_asset_lists()
    for n in names:
        build(n, PEOPLE[n], data, out_dir)


main()
