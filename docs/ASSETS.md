# 素材清单

规则：只用能商用的素材，优先 CC0；非商用（NC）授权一律不用。每加一个外部素材，就在这里记一行。

| 素材 | 来源 | 授权 | 用在哪 |
|---|---|---|---|
| 小别墅组件 `public/models/villa_kit.glb` | 自制，`tools/blender/build_villa_kit.py` 生成 | 自有 | 2.5D 原型 |
| 贴图（墙、木地板、木板、灰瓦、草地、远山、石板、卵石、沥青、树皮、樱花树皮）`public/textures/ph/*_diff.jpg / *_nor.jpg` | Poly Haven：white_plaster_02、wood_floor、weathered_brown_planks、grey_roof_tiles_02、leafy_grass、aerial_grass_rock、stone_tiles_02、cobblestone_floor_04、asphalt_02、bark_brown_02、sakura_bark（1K，已压缩） | CC0 | 2.5D 原型"世外桃源"画风 |
| 天空光照 `public/textures/ph/kloofendal_sky.hdr` | Poly Haven：kloofendal_48d_partly_cloudy_puresky（1K） | CC0 | 世外桃源画风的环境光 |

Poly Haven 的素材是 CC0，不署名也可以；但它的 API 条款要求用 API 的产品注明来源，所以游戏的制作人员名单里要写上"素材：Poly Haven（polyhaven.com）"。下载时用了唯一的 User-Agent，没有批量爬取。

| 3D 模型 `public/models/ph/*.glb`（32 个） | Poly Haven：Sofa_01、Rockingchair_01、wooden_table_02、painted_wooden_chair_01、chinese_cabinet、chinese_chandelier、potted_plant_01、wooden_crate_01/02、electric_stove、vintage_electric_kettle、painted_wooden_cabinet、vintage_day_bed、ClassicNightstand_01、wooden_lantern_01、WoodenTable_01、wooden_bookshelf_worn、island_tree_02、grass_bermuda_01、shrub_sorrel_01、periwinkle_plant、dandelion_01、flower_empodium、fern_02、rock_moss_set_02、boulder_01、covered_car、wine_barrel_01、wooden_bucket_01、large_iron_gate、painted_wooden_bench、street_lamp_01 | CC0 | 世外桃源画风。用 `tools/blender/slim_polyhaven.py` 减面、接上透明贴图、压成 WebP；`tools/blender/fix_glb.py` 修掉坏掉的贴图引用 |
| 人物 `public/models/people/{heroine,mom,dad,neighbor,stranger,survivor_f,survivor_m,jiangye,shenyan,guchen,xielin,zombie_m,zombie_f}.glb` | MakeHuman（MPFB 2 for Blender）+ MakeHuman system assets 包（身体、皮肤、眼睛、眉毛、睫毛、发型、衣服、鞋），`tools/blender/make_people.py` 生成，Mixamo 兼容骨骼 | CC0（MPFB 插件本身是 GPL，但生成的人物和 system assets 都是 CC0，可商用、可闭源） | 世外桃源画风的女主、妈妈、爸爸、王阿姨、陌生人/黑鸦、两个幸存者（辫子姑娘、礼帽大叔）、江野、沈砚、顾沉、谢临、两种丧尸（丧尸的灰绿皮肤和血迹是游戏里用着色器加的） |
| 音效和背景音乐 | `src/world/sound.ts` 用 WebAudio 现场合成（枪声、丧尸低吼、砸门、雨声、鸟叫、蛐蛐、和弦背景音乐） | 自己写的，无外部素材 | 全部声音 |
