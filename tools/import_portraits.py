#!/usr/bin/env python3
"""把 art/ 里的立绘裁成人物卡用的图：public/portraits/<模型>.jpg（480×640，3:4，按上半身裁）。

    python3 tools/import_portraits.py            # 处理 art/ 里所有认得出名字的图
    python3 tools/import_portraits.py --dry-run  # 只看会怎么处理

文件名里带人名就行，比如 "林知夏-卡片.png"、"jiangye card.webp"；名字里带"三视图"的跳过（那是建模参考）。
同一个人有好几张，用最新改过的那张。需要 ffmpeg（brew 装过）。
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'art')
OUT = os.path.join(ROOT, 'public', 'portraits')
NAMES = {
    'heroine': ['林知夏', '知夏', '女主', 'heroine'],
    'mom': ['妈妈', 'mom'],
    'dad': ['爸爸', 'dad'],
    'jiangye': ['江野', 'jiangye'],
    'shenyan': ['沈砚', 'shenyan'],
    'guchen': ['顾沉', 'guchen'],
    'xielin': ['谢临', 'xielin'],
    'neighbor': ['王阿姨', 'neighbor'],
    'stranger': ['陌生人', '敲门的男人', 'stranger'],
    'survivor_f': ['辫子姑娘', 'survivor_f'],
    'survivor_m': ['礼帽大叔', 'survivor_m'],
}
EXTS = ('.png', '.jpg', '.jpeg', '.webp')


def main() -> None:
    dry = '--dry-run' in sys.argv
    if not os.path.isdir(ART):
        print('没有 art/ 文件夹')
        return
    best: dict[str, str] = {}
    for f in os.listdir(ART):
        if not f.lower().endswith(EXTS) or '三视图' in f:
            continue
        low = f.lower()
        for pid, keys in NAMES.items():
            if any(k.lower() in low for k in keys):
                p = os.path.join(ART, f)
                if pid not in best or os.path.getmtime(p) > os.path.getmtime(best[pid]):
                    best[pid] = p
                break
    if not best:
        print('art/ 里没找到认得出名字的图（文件名里写上人名，比如"林知夏-卡片.png"）')
        return
    os.makedirs(OUT, exist_ok=True)
    for pid, src in sorted(best.items()):
        dst = os.path.join(OUT, f'{pid}.jpg')
        print(f'{os.path.basename(src)} -> public/portraits/{pid}.jpg')
        if dry:
            continue
        # 先按宽或高缩放到能盖住 480×640，再从上面裁（脸在上半部分）
        vf = 'scale=480:640:force_original_aspect_ratio=increase,crop=480:640:(iw-480)/2:0'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf', vf, '-q:v', '3', dst], check=True)


if __name__ == '__main__':
    main()
