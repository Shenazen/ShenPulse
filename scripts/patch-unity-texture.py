"""Replace one Texture2D image inside a Unity assets file."""

from __future__ import annotations

import argparse
import os
import tempfile

import UnityPy
from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True)
    parser.add_argument("--texture", required=True)
    parser.add_argument("--image", required=True)
    return parser.parse_args()


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    source = image.convert("RGBA")
    source.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    left = (size[0] - source.width) // 2
    top = (size[1] - source.height) // 2
    canvas.alpha_composite(source, (left, top))
    return canvas


def main() -> None:
    args = parse_args()
    asset_path = os.path.abspath(args.asset)
    with open(asset_path, "rb") as source:
        environment = UnityPy.load(source.read())
    changed = False

    for obj in environment.objects:
        if obj.type.name != "Texture2D":
            continue
        texture = obj.read()
        if texture.m_Name != args.texture:
            continue
        replacement = contain(
            Image.open(args.image),
            (int(texture.m_Width), int(texture.m_Height)),
        )
        texture.image = replacement
        texture.save()
        changed = True
        break

    if not changed:
        raise RuntimeError(f"Texture not found: {args.texture}")

    directory = os.path.dirname(asset_path)
    descriptor, temporary_path = tempfile.mkstemp(
        prefix="shenpulse-unity-",
        suffix=".assets",
        dir=directory,
    )
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(environment.file.save())
        os.replace(temporary_path, asset_path)
    finally:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)


if __name__ == "__main__":
    main()
