import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def find_project_root():
    candidates = []

    try:
        candidates.append(Path(__file__).resolve())
    except Exception:
        pass

    try:
        for text in bpy.data.texts:
            filepath = getattr(text, "filepath", "")
            if filepath:
                candidates.append(Path(filepath).resolve())
    except Exception:
        pass

    candidates.append(Path.cwd().resolve())

    for candidate in candidates:
        start = candidate if candidate.is_dir() else candidate.parent
        for path in [start, *start.parents]:
            if (path / "index.html").exists() and (path / "src").exists():
                return path

    # Fallback for running the text manually from Blender while the file browser
    # is already opened in tools/blender.
    cwd = Path.cwd().resolve()
    if cwd.name == "blender" and cwd.parent.name == "tools":
      return cwd.parents[1]

    raise RuntimeError(
        "Project root not found. Run render_separator.bat from the project folder "
        "or open the .py file from tools/blender."
    )


ROOT = find_project_root()
OUT_DIR = ROOT / "_inbox" / "generated_assets"
OUT_PATH = OUT_DIR / "separator_3d_cyan.png"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mat(name, color, roughness=0.55, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_cube(name, loc, scale, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("soft bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        obj.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return obj


def add_cylinder(name, loc, radius, depth, material, vertices=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    if bevel:
        mod = obj.modifiers.new("rim bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        obj.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return obj


def add_pipe(name, loc, radius, depth, material, rotation=(0, 0, 0)):
    obj = add_cylinder(name, loc, radius, depth, material, vertices=32, bevel=0.015)
    obj.rotation_euler = rotation
    return obj


def add_curve_pipe(name, points, radius, material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 10
    curve.bevel_depth = radius
    curve.bevel_resolution = 5

    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1)

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj


def build_separator():
    base_mat = mat("dark violet base", (0.22, 0.21, 0.27, 1), 0.68)
    base_edge = mat("base bevel edge", (0.44, 0.43, 0.51, 1), 0.62)
    cream = mat("warm cream machinery", (0.86, 0.79, 0.60, 1), 0.55)
    cream_dark = mat("cream shadow side", (0.62, 0.55, 0.42, 1), 0.62)
    metal_mat = mat("painted blue metal", (0.22, 0.72, 0.82, 1), 0.46)
    cyan_mat = mat("cyan faction paint", (0.04, 0.78, 0.94, 1), 0.34)
    dark_mat = mat("dark vents and rubber", (0.06, 0.06, 0.07, 1), 0.78)
    yellow = mat("yellow pipe", (0.96, 0.73, 0.16, 1), 0.43)
    purple = mat("purple pipe", (0.58, 0.38, 0.92, 1), 0.43)
    pink = mat("pink pipe", (0.92, 0.35, 0.72, 1), 0.43)
    hazard = mat("hazard yellow", (1.0, 0.82, 0.12, 1), 0.5)
    white_mark = mat("white pad mark", (0.92, 0.98, 1.0, 1), 0.42)

    # Isometric 2x2 platform.
    add_cube("2x2 footprint plate", (0, 0, 0.07), (3.35, 3.10, 0.14), base_mat, bevel=0.08)
    add_cube("raised metal deck", (0.10, 0.02, 0.20), (3.05, 2.78, 0.12), base_edge, bevel=0.06)

    # Cyan service pad in front, echoing the current game sprite.
    add_cube("cyan service pad", (0.28, -1.02, 0.27), (1.35, 0.86, 0.045), cyan_mat, bevel=0.035)
    add_cube("white H vertical", (0.28, -1.02, 0.305), (0.13, 0.52, 0.018), white_mark, bevel=0.005)
    add_cube("white H cross", (0.28, -1.02, 0.315), (0.47, 0.10, 0.018), white_mark, bevel=0.005)

    # Main processor block and vent face.
    add_cube("cream processor body", (0.65, 0.32, 0.78), (1.35, 1.28, 1.08), cream, bevel=0.09)
    add_cube("processor side tower", (1.32, 0.22, 0.84), (0.38, 1.00, 1.22), cream_dark, bevel=0.06)
    add_cube("black output mouth", (0.62, -0.36, 0.72), (0.62, 0.08, 0.30), dark_mat, bevel=0.025)
    add_cube("top service hatch", (0.45, 0.34, 1.36), (0.48, 0.42, 0.05), dark_mat, bevel=0.025)

    # Vertical cyan separator tank.
    tank = add_cylinder("cyan separator tank", (-0.70, 0.42, 0.95), 0.43, 1.45, metal_mat, vertices=56, bevel=0.02)
    add_cylinder("tank top cap", (-0.70, 0.42, 1.70), 0.45, 0.10, cyan_mat, vertices=56, bevel=0.02)
    add_cylinder("tank bottom ring", (-0.70, 0.42, 0.25), 0.45, 0.08, cyan_mat, vertices=56, bevel=0.015)

    # Front colored separator tubes.
    tube_specs = [
        (-1.18, -0.44, pink),
        (-0.78, -0.56, metal_mat),
        (-0.38, -0.68, purple),
        (0.02, -0.80, yellow),
    ]
    for x, y, material in tube_specs:
        add_pipe("front horizontal process tube", (x, y, 0.50), 0.095, 0.92, material, rotation=(0, math.radians(90), 0))
        add_cylinder("tube rounded cap", (x - 0.46, y, 0.50), 0.098, 0.04, material, vertices=32, bevel=0.01)
        add_cylinder("tube dark socket", (x + 0.46, y, 0.50), 0.105, 0.08, dark_mat, vertices=32, bevel=0.01)

    # Curved service pipes from tubes into tank/body.
    add_curve_pipe("pink pipe up to tank", [(-1.60, -0.45, 0.55), (-1.60, 0.30, 0.95), (-1.13, 0.44, 1.25)], 0.045, pink)
    add_curve_pipe("cyan pipe to tank", [(-0.82, -0.55, 0.58), (-0.96, 0.08, 0.88), (-1.04, 0.43, 1.15)], 0.045, metal_mat)
    add_curve_pipe("yellow pipe to processor", [(0.02, -0.80, 0.58), (0.18, -0.30, 0.86), (0.55, -0.08, 1.02)], 0.045, yellow)

    # Hazard strip as separate blocks so it reads at sprite size.
    add_cube("hazard strip base", (0.88, -0.75, 0.34), (0.82, 0.16, 0.08), dark_mat, bevel=0.01)
    for i in range(5):
        add_cube("hazard yellow block", (0.56 + i * 0.16, -0.75, 0.39), (0.08, 0.17, 0.04), hazard, bevel=0.002)

    # Small colored stack on right side.
    for n, material in enumerate((pink, yellow, purple, metal_mat)):
        add_cube("resource color slot", (1.04, -0.24, 0.49 + n * 0.11), (0.08, 0.035, 0.055), material, bevel=0.003)

    # Tiny roof bolts / caps for scale.
    add_cylinder("processor roof cap", (0.82, 0.38, 1.44), 0.12, 0.045, dark_mat, vertices=32, bevel=0.008)
    add_cylinder("tank roof bolt", (-0.70, 0.42, 1.79), 0.10, 0.04, base_edge, vertices=32, bevel=0.006)


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.eevee.taa_render_samples = 64
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.0, 7.0))
    key = bpy.context.object
    key.name = "large softbox"
    key.data.energy = 500
    key.data.size = 5.0

    bpy.ops.object.light_add(type="POINT", location=(2.5, 2.5, 3.5))
    rim = bpy.context.object
    rim.name = "cyan rim helper"
    rim.data.energy = 45
    rim.data.color = (0.45, 0.95, 1.0)

    bpy.ops.object.camera_add(location=(4.6, -5.0, 4.0))
    cam = bpy.context.object
    look_at(cam, (0, 0, 0.7))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 4.55
    scene.camera = cam

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(OUT_PATH)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"


def main():
    clear_scene()
    build_separator()
    setup_render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_DIR / "separator_3d_cyan.blend"))
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {OUT_PATH}")


if __name__ == "__main__":
    main()
