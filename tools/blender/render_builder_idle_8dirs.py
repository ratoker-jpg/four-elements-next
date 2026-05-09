import colorsys
import math
import shutil
from pathlib import Path

import bpy
from mathutils import Vector


FACTIONS = {
    "green": {
        "base": (0.66, 0.91, 0.36, 1.0),
        "highlight": (0.85, 1.00, 0.54, 1.0),
        "shadow": (0.49, 0.75, 0.24, 1.0),
        "edge": (0.96, 1.00, 0.85, 1.0),
    },
    "cyan": {
        "base": (0.55, 0.86, 1.00, 1.0),
        "highlight": (0.81, 0.96, 1.00, 1.0),
        "shadow": (0.35, 0.71, 0.91, 1.0),
        "edge": (0.95, 0.99, 1.00, 1.0),
    },
    "yellow": {
        "base": (0.92, 0.82, 0.31, 1.0),
        "highlight": (1.00, 0.94, 0.54, 1.0),
        "shadow": (0.77, 0.67, 0.18, 1.0),
        "edge": (1.00, 0.98, 0.84, 1.0),
    },
    "purple": {
        "base": (0.76, 0.48, 0.96, 1.0),
        "highlight": (0.89, 0.69, 1.00, 1.0),
        "shadow": (0.60, 0.34, 0.82, 1.0),
        "edge": (0.98, 0.91, 1.00, 1.0),
    },
}

PRIMARY_MATERIAL_HINTS = ("faction", "primary")
PRIMARY_OBJECT_HINTS = ("body_faction", "side_bar", "sidebars", "wheel_hub")
LIGHT_NAME_HINTS = ("light", "gray", "grey", "metal", "ring", "cream")
DARK_NAME_HINTS = ("dark", "tire", "wheel", "base", "corner", "platform")
CRANE_NAME_HINTS = ("crane", "arm", "manip", "joint", "gripper", "claw", "hand", "wrist", "forearm")
ACCENT_BLUE_HINTS = ("blue", "pin")
ACCENT_ORANGE_HINTS = ("orange", "button", "plate")

RENDER_SIZE = 228
OUTPUT_ROOT = "_inbox/generated_assets/sprite_renders_builder_bright_v2"
LIVE_UNIT_FOLDER = Path("assets") / "factions"
LIVE_UNIT_SUBDIR = Path("units") / "builder_8dirs"
SYNC_TO_GAME_ASSETS = True
RENDER_EXCLUDE_NAMES = set()


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
        start = candidate.parent if candidate.is_file() else candidate
        for path in [start, *start.parents]:
            if (path / "index.html").exists() and (path / "src").exists():
                return path

    raise RuntimeError("Project root not found. Open the script from the project or run it inside Blender.")


ROOT = find_project_root()
STAGING_ROOT = ROOT / OUTPUT_ROOT


def save_state(obj):
    return {
        "parent": obj.parent,
        "matrix_world": obj.matrix_world.copy(),
        "hide_render": obj.hide_render,
    }


def restore_state(obj, state):
    obj.parent = state["parent"]
    obj.matrix_world = state["matrix_world"]
    obj.hide_render = state["hide_render"]


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def object_bounds(objects):
    points = []
    for obj in objects:
        if not hasattr(obj, "bound_box"):
            continue
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))

    if not points:
        return None

    min_x = min(p.x for p in points)
    min_y = min(p.y for p in points)
    min_z = min(p.z for p in points)
    max_x = max(p.x for p in points)
    max_y = max(p.y for p in points)
    max_z = max(p.z for p in points)
    return Vector((min_x, min_y, min_z)), Vector((max_x, max_y, max_z))


def source_objects():
    for root_name in ("sprite_pivot", "builder_root"):
        root = bpy.data.objects.get(root_name)
        if root:
            objects = [root, *list(root.children_recursive)]
            return [o for o in objects if o.type not in {"CAMERA", "LIGHT"}]
    return [o for o in bpy.context.scene.objects if o.type not in {"CAMERA", "LIGHT"}]


def looks_like_default_scene(objects):
    if len(objects) != 1:
        return False
    name = objects[0].name.lower()
    return name in {"cube", "defaultcube", "object"}


def root_objects(objects):
    obj_set = set(objects)
    return [obj for obj in objects if obj.parent not in obj_set]


def create_temp_camera(center, span):
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("builder_export_camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(3.0, max(span.x, span.y, span.z) * 2.18)

    cam_obj = bpy.data.objects.new("builder_export_camera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = center + Vector((4.45, -4.95, 4.25))
    look_at(cam_obj, center + Vector((0.0, 0.0, span.z * 0.16)))
    scene.camera = cam_obj
    return cam_obj


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.render.resolution_x = RENDER_SIZE
    scene.render.resolution_y = RENDER_SIZE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.12
    scene.view_settings.gamma = 1.0


def iter_principled_nodes(material):
    if not material or not material.use_nodes or not material.node_tree:
        return []
    return [node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"]


def collect_material_bindings(objects):
    bindings = []
    seen = set()
    for obj in objects:
        for slot in getattr(obj, "material_slots", []):
            material = slot.material
            if not material:
                continue
            key = (obj.name, material.name)
            if key not in seen:
                seen.add(key)
                bindings.append((obj.name, material))
    return bindings


def save_material_state(material_bindings):
    state = {}
    for object_name, material in material_bindings:
        if material.name in state:
            state[material.name]["objects"].add(object_name)
            continue
        nodes = []
        for node in iter_principled_nodes(material):
            nodes.append(
                {
                    "node": node,
                    "base_color": tuple(node.inputs["Base Color"].default_value),
                    "roughness": float(node.inputs["Roughness"].default_value),
                    "metallic": float(node.inputs["Metallic"].default_value),
                    "specular": float(node.inputs["Specular"].default_value) if "Specular" in node.inputs else None,
                    "emission": tuple(node.inputs["Emission"].default_value) if "Emission" in node.inputs else None,
                    "emission_strength": float(node.inputs["Emission Strength"].default_value)
                    if "Emission Strength" in node.inputs
                    else None,
                }
            )
        state[material.name] = {"objects": {object_name}, "nodes": nodes}
    return state


def restore_material_state(material_state):
    for material_name, entry in material_state.items():
        material = bpy.data.materials.get(material_name)
        if not material:
            continue
        for node_state in entry["nodes"]:
            node = node_state["node"]
            if not node or node.id_data != material.node_tree:
                continue
            node.inputs["Base Color"].default_value = node_state["base_color"]
            node.inputs["Roughness"].default_value = node_state["roughness"]
            node.inputs["Metallic"].default_value = node_state["metallic"]
            if node_state["specular"] is not None and "Specular" in node.inputs:
                node.inputs["Specular"].default_value = node_state["specular"]
            if node_state["emission"] is not None and "Emission" in node.inputs:
                node.inputs["Emission"].default_value = node_state["emission"]
            if node_state["emission_strength"] is not None and "Emission Strength" in node.inputs:
                node.inputs["Emission Strength"].default_value = node_state["emission_strength"]


def classify_material(material_name, object_names, base_color):
    name = (material_name or "").lower()
    object_text = " ".join(object_names).lower()
    r, g, b = base_color[:3]
    hue, sat, val = colorsys.rgb_to_hsv(r, g, b)

    if any(hint in name for hint in PRIMARY_MATERIAL_HINTS):
        return "primary"
    if any(hint in object_text for hint in PRIMARY_OBJECT_HINTS):
        return "primary"
    if any(hint in name for hint in CRANE_NAME_HINTS):
        return "crane"
    if any(hint in name for hint in LIGHT_NAME_HINTS):
        return "light"
    if any(hint in name for hint in DARK_NAME_HINTS):
        return "dark"
    if any(hint in name for hint in ACCENT_BLUE_HINTS):
        return "blue"
    if any(hint in name for hint in ACCENT_ORANGE_HINTS):
        return "orange"

    if sat > 0.22 and 0.18 <= hue <= 0.48:
        return "primary"
    if val > 0.75 and sat < 0.25:
        return "light"
    if val < 0.36 and sat < 0.36:
        return "dark"
    if 0.50 <= hue <= 0.72 and sat > 0.18:
        return "blue"
    if 0.03 <= hue <= 0.14 and sat > 0.2:
        return "orange"
    return "keep"


def tint_color(color, target, mix):
    return tuple((1.0 - mix) * color[i] + mix * target[i] for i in range(4))


def apply_faction_palette(material_state, palette):
    for material_name, entry in material_state.items():
        object_names = entry["objects"]
        for node_state in entry["nodes"]:
            node = node_state["node"]
            original = node_state["base_color"]
            role = classify_material(material_name, object_names, original)

            if role == "crane":
                node.inputs["Base Color"].default_value = tint_color(original, (0.97, 0.95, 0.90, 1.0), 0.18)
                if "Roughness" in node.inputs:
                    node.inputs["Roughness"].default_value = min(0.48, node_state["roughness"] * 0.96)
                if "Specular" in node.inputs:
                    node.inputs["Specular"].default_value = min(0.52, node_state["specular"] + 0.05 if node_state["specular"] is not None else 0.44)
                continue
            if role == "primary":
                node.inputs["Base Color"].default_value = palette["base"]
                if "Roughness" in node.inputs:
                    node.inputs["Roughness"].default_value = min(0.55, node_state["roughness"] * 0.95)
                if "Specular" in node.inputs:
                    node.inputs["Specular"].default_value = min(0.55, node_state["specular"] + 0.08 if node_state["specular"] is not None else 0.45)
            elif role == "light":
                node.inputs["Base Color"].default_value = tint_color(original, palette["edge"], 0.08)
            elif role == "dark":
                node.inputs["Base Color"].default_value = tint_color(original, palette["shadow"], 0.05)
            elif role == "blue":
                node.inputs["Base Color"].default_value = tint_color(original, (0.42, 0.82, 1.0, 1.0), 0.05)
            elif role == "orange":
                node.inputs["Base Color"].default_value = tint_color(original, (0.92, 0.52, 0.20, 1.0), 0.05)


def render_angles(temp_root, output_dir):
    scene = bpy.context.scene
    angle_map = {
        0: 0,
        2: 90,
        4: 180,
        6: 270,
    }

    for dir_id, degrees in angle_map.items():
        temp_root.rotation_euler = (0.0, 0.0, math.radians(degrees))
        scene.render.filepath = str(output_dir / f"builder_idle_dir{dir_id}_0.png")
        bpy.ops.render.render(write_still=True)

    for dir_id in (1, 3, 5, 7):
        shutil.copy2(output_dir / f"builder_idle_dir{dir_id - 1}_0.png", output_dir / f"builder_idle_dir{dir_id}_0.png")


def sync_to_game_assets(staging_dir, faction):
    if not SYNC_TO_GAME_ASSETS:
        return

    live_dir = ROOT / LIVE_UNIT_FOLDER / faction / LIVE_UNIT_SUBDIR
    live_dir.mkdir(parents=True, exist_ok=True)
    for png in staging_dir.glob("*.png"):
        shutil.copy2(png, live_dir / png.name)


def apply_render_exclusions(objects):
    excluded = []
    for obj in objects:
        if obj.name in RENDER_EXCLUDE_NAMES:
            obj.hide_render = True
            excluded.append(obj.name)
    return excluded


def write_manifest(faction, staging_dir, live_dir):
    pngs = sorted(staging_dir.glob("*.png"))
    lines = [
        f"faction: {faction}",
        f"staging_dir: {staging_dir}",
        f"live_dir: {live_dir}",
        f"png_count: {len(pngs)}",
        "",
        "files:",
    ]
    for png in pngs:
        lines.append(f"- {png.name} ({png.stat().st_size} bytes)")
    (staging_dir / "manifest.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_root_manifest():
    lines = [
        "builder_idle_8dirs export",
        f"staging_root: {STAGING_ROOT}",
        f"sync_to_game_assets: {SYNC_TO_GAME_ASSETS}",
        "",
        "factions:",
    ]
    for faction in FACTIONS:
        lines.append(f"- {faction}")
    (STAGING_ROOT / "manifest.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    objs = source_objects()
    if not objs:
        raise RuntimeError("No source objects found. Open the builder model and make sure it is visible.")
    if looks_like_default_scene(objs):
        raise RuntimeError(
            "Default Blender scene detected. Open the actual builder .blend or the scene with the builder model, "
            "then run this script from Blender's Scripting tab."
        )

    bounds = object_bounds(objs)
    if not bounds:
        raise RuntimeError("Could not calculate bounds for the builder model.")

    min_corner, max_corner = bounds
    center = (min_corner + max_corner) / 2.0
    span = max_corner - min_corner

    STAGING_ROOT.mkdir(parents=True, exist_ok=True)
    setup_render()
    write_root_manifest()

    original_object_state = {obj: save_state(obj) for obj in objs}
    material_bindings = collect_material_bindings(objs)
    original_material_state = save_material_state(material_bindings)
    excluded_objects = apply_render_exclusions(objs)

    temp_root = bpy.data.objects.new("builder_export_root", None)
    temp_root.empty_display_type = "PLAIN_AXES"
    temp_root.location = center
    bpy.context.collection.objects.link(temp_root)

    cam = None
    try:
        for obj in root_objects(objs):
            obj.parent = temp_root
            obj.matrix_world = original_object_state[obj]["matrix_world"]

        cam = create_temp_camera(center, span)

        for faction, palette in FACTIONS.items():
            faction_dir = STAGING_ROOT / faction
            faction_dir.mkdir(parents=True, exist_ok=True)
            live_dir = ROOT / LIVE_UNIT_FOLDER / faction / LIVE_UNIT_SUBDIR

            restore_material_state(original_material_state)
            apply_faction_palette(original_material_state, palette)
            render_angles(temp_root, faction_dir)
            sync_to_game_assets(faction_dir, faction)
            write_manifest(faction, faction_dir, live_dir)

    finally:
        restore_material_state(original_material_state)
        if cam and cam.name in bpy.data.objects:
            bpy.data.objects.remove(cam, do_unlink=True)
        if temp_root and temp_root.name in bpy.data.objects:
            bpy.data.objects.remove(temp_root, do_unlink=True)
        for obj, state in original_object_state.items():
            if obj.name in bpy.data.objects:
                restore_state(obj, state)

    print(f"Rendered builder idle sprites to: {STAGING_ROOT}")


main()
