import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = ROOT / "_inbox" / "stroitel.blend"


def fmt_obj(obj):
    return {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "location": tuple(round(v, 4) for v in obj.location),
        "rotation": tuple(round(v, 4) for v in obj.rotation_euler),
        "scale": tuple(round(v, 4) for v in obj.scale),
        "data": obj.data.name if obj.data else None,
    }


def main():
    print(f"Blend path: {BLEND_PATH}")
    print(f"Scene: {bpy.context.scene.name}")
    print("Objects:")
    for obj in bpy.data.objects:
      print(fmt_obj(obj))

    print("Cameras:")
    for cam in bpy.data.cameras:
        print({"name": cam.name, "type": cam.type, "ortho_scale": getattr(cam, "ortho_scale", None)})

    print("Materials:")
    for mat in bpy.data.materials:
        print({"name": mat.name, "use_nodes": mat.use_nodes})

    print("Textures:")
    for img in bpy.data.images:
        print({"name": img.name, "size": tuple(img.size), "file": img.filepath})


main()
