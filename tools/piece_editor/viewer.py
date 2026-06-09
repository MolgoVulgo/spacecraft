from __future__ import annotations

import math
from typing import Dict, List, Optional, Set, Tuple

from panda3d.core import CollisionRay
from ursina import AmbientLight, DirectionalLight, EditorCamera, Entity, Mesh, Vec3, camera, color, destroy, mouse, window
from ursina.scene import instance as scene

from .models import Anchor, Cell, Piece, PieceInstance
from .shape_builder import GeneratedMesh, build_generated_mesh
from .ursina_theme import ursina_theme

URSINA_THEME = ursina_theme()

ENVELOPE_EDGE_THICKNESS = 0.012
MESH_EDGE_THICKNESS = 1
FEATURE_EDGE_MIN_ANGLE_DEGREES = 12.0


def to_scene_cell_center(cell: Cell) -> Tuple[float, float, float]:
    x, y, z = cell
    return (x + 0.5, z + 0.5, y + 0.5)


def to_scene_anchor_position(position: Tuple[float, float, float]) -> Tuple[float, float, float]:
    x, y, z = position
    return (x, z, y)


def color_from_name(name: str):
    mapping = {
        "orange": color.rgb32(196, 92, 38),
        "blue": color.rgb32(66, 124, 194),
        "green": color.rgb32(72, 154, 102),
        "purple": color.rgb32(126, 92, 178),
        "yellow": color.rgb32(196, 152, 58),
        "red": color.rgb32(182, 62, 62),
        "selected": color.rgb32(255, 170, 64),
        "anchor": URSINA_THEME["anchor"],
        "cursor": color.rgb32(92, 118, 196),
        "body": color.rgb32(196, 92, 38),
        "selected_body": color.rgb32(236, 136, 48),
    }
    return mapping.get(name, mapping["orange"])


class PieceRenderer:
    def __init__(self) -> None:
        self.root = Entity(name="render_root")
        self.entities: List[Entity] = []
        self.show_envelope_outline = True
        self.show_anchors = False

    def clear(self) -> None:
        for entity in self.entities:
            destroy(entity)
        self.entities.clear()

    def draw_envelope_outline(self, piece: Piece, position: Cell = (0, 0, 0), selected: bool = False) -> None:
        if not self.show_envelope_outline:
            return

        edge_color = color.rgba32(92, 128, 196, 160 if selected else 92)
        px, py, pz = position
        sx, sy, sz = piece.logical_size
        edge_specs = [
            ((px + sx / 2, pz, py), (sx, ENVELOPE_EDGE_THICKNESS, ENVELOPE_EDGE_THICKNESS)),
            ((px + sx / 2, pz, py + sy), (sx, ENVELOPE_EDGE_THICKNESS, ENVELOPE_EDGE_THICKNESS)),
            ((px + sx / 2, pz + sz, py), (sx, ENVELOPE_EDGE_THICKNESS, ENVELOPE_EDGE_THICKNESS)),
            ((px + sx / 2, pz + sz, py + sy), (sx, ENVELOPE_EDGE_THICKNESS, ENVELOPE_EDGE_THICKNESS)),
            ((px, pz, py + sy / 2), (ENVELOPE_EDGE_THICKNESS, ENVELOPE_EDGE_THICKNESS, sy)),
            ((px + sx, pz, py + sy / 2), (ENVELOPE_EDGE_THICKNESS, ENVELOPE_EDGE_THICKNESS, sy)),
            ((px, pz + sz, py + sy / 2), (ENVELOPE_EDGE_THICKNESS, ENVELOPE_EDGE_THICKNESS, sy)),
            ((px + sx, pz + sz, py + sy / 2), (ENVELOPE_EDGE_THICKNESS, ENVELOPE_EDGE_THICKNESS, sy)),
            ((px, pz + sz / 2, py), (ENVELOPE_EDGE_THICKNESS, sz, ENVELOPE_EDGE_THICKNESS)),
            ((px + sx, pz + sz / 2, py), (ENVELOPE_EDGE_THICKNESS, sz, ENVELOPE_EDGE_THICKNESS)),
            ((px, pz + sz / 2, py + sy), (ENVELOPE_EDGE_THICKNESS, sz, ENVELOPE_EDGE_THICKNESS)),
            ((px + sx, pz + sz / 2, py + sy), (ENVELOPE_EDGE_THICKNESS, sz, ENVELOPE_EDGE_THICKNESS)),
        ]
        for edge_position, edge_scale in edge_specs:
            edge = Entity(parent=self.root, model="cube", position=edge_position, scale=edge_scale, color=edge_color)
            self.entities.append(edge)

    def subtract_vertices(self, a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
        return (a[0] - b[0], a[1] - b[1], a[2] - b[2])

    def cross_product(self, a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
        return (
            (a[1] * b[2]) - (a[2] * b[1]),
            (a[2] * b[0]) - (a[0] * b[2]),
            (a[0] * b[1]) - (a[1] * b[0]),
        )

    def normalize_vector(self, vector: Tuple[float, float, float]) -> Tuple[float, float, float]:
        length = math.sqrt((vector[0] ** 2) + (vector[1] ** 2) + (vector[2] ** 2))
        if length <= 0.000001:
            return (0.0, 0.0, 0.0)
        return (vector[0] / length, vector[1] / length, vector[2] / length)

    def dot_product(self, a: Tuple[float, float, float], b: Tuple[float, float, float]) -> float:
        return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2])

    def compute_face_normal(self, vertices: List[Tuple[float, float, float]], face: Tuple[int, int, int]) -> Tuple[float, float, float]:
        a, b, c = face
        ab = self.subtract_vertices(vertices[b], vertices[a])
        ac = self.subtract_vertices(vertices[c], vertices[a])
        return self.normalize_vector(self.cross_product(ab, ac))

    def build_mesh_edge_segments(self, vertices: List[Tuple[float, float, float]], faces: List[Tuple[int, int, int]]) -> List[Tuple[int, int]]:
        face_normals = [self.compute_face_normal(vertices, face) for face in faces]
        edges_to_faces: Dict[Tuple[int, int], List[int]] = {}

        for face_index, (a, b, c) in enumerate(faces):
            for start, end in ((a, b), (b, c), (c, a)):
                edge_key = tuple(sorted((start, end)))
                edges_to_faces.setdefault(edge_key, []).append(face_index)

        cosine_threshold = math.cos(math.radians(FEATURE_EDGE_MIN_ANGLE_DEGREES))
        feature_edges = []
        for edge_key, linked_faces in edges_to_faces.items():
            if len(linked_faces) <= 1:
                feature_edges.append(edge_key)
                continue

            first_normal = face_normals[linked_faces[0]]
            second_normal = face_normals[linked_faces[1]]
            normal_dot = max(min(self.dot_product(first_normal, second_normal), 1.0), -1.0)
            if normal_dot < cosine_threshold:
                feature_edges.append(edge_key)

        return sorted(feature_edges)

    def draw_piece_body(
        self,
        piece: Piece,
        position: Cell = (0, 0, 0),
        color_name: str = "body",
        selected: bool = False,
        solid_cells: Optional[Set[Cell]] = None,
        mirror_state: Optional[Tuple[bool, bool, bool]] = None,
        prefer_shape_geometry: bool = True,
    ) -> None:
        base_color = color_from_name("selected_body" if selected else color_name)
        if prefer_shape_geometry:
            generated_mesh = build_generated_mesh(piece)
            if generated_mesh and generated_mesh.vertices and generated_mesh.faces:
                self.draw_generated_piece(
                    piece,
                    generated_mesh,
                    position=position,
                    body_color=base_color,
                    selected=selected,
                    mirror_state=mirror_state or (False, False, False),
                )
                return

        ox, oy, oz = position
        for x, y, z in sorted(solid_cells if solid_cells is not None else piece.solid_cells):
            body = Entity(
                parent=self.root,
                model="cube",
                position=to_scene_cell_center((x + ox, y + oy, z + oz)),
                scale=(0.98, 0.98, 0.98),
                color=base_color,
            )
            body.alpha = 1.0
            self.entities.append(body)
        self.draw_envelope_outline(piece, position=position, selected=selected)

    def draw_generated_piece(
        self,
        piece: Piece,
        generated_mesh: GeneratedMesh,
        position: Cell,
        body_color,
        selected: bool,
        mirror_state: Tuple[bool, bool, bool],
    ) -> None:
        self.draw_mesh_geometry(
            piece=piece,
            vertices=generated_mesh.vertices,
            triangles=generated_mesh.faces,
            position=position,
            body_color=body_color,
            selected=selected,
            mirror_state=mirror_state,
        )

    def draw_mesh_geometry(
        self,
        piece: Piece,
        vertices: List[Tuple[float, float, float]],
        triangles: List[Tuple[int, int, int]],
        position: Cell,
        body_color,
        selected: bool,
        mirror_state: Tuple[bool, bool, bool],
    ) -> None:
        mirror_x, mirror_y, mirror_z = mirror_state
        mirrored_vertices = []
        for vertex_x, vertex_y, vertex_z in vertices:
            mirrored_vertices.append(
                (
                    -vertex_x if mirror_x else vertex_x,
                    -vertex_y if mirror_z else vertex_y,
                    -vertex_z if mirror_y else vertex_z,
                )
            )

        mirror_count = int(mirror_x) + int(mirror_y) + int(mirror_z)
        resolved_triangles = [(a, c, b) for a, b, c in triangles] if mirror_count % 2 == 1 else list(triangles)
        mesh = Mesh(vertices=mirrored_vertices, triangles=resolved_triangles, mode="triangle")
        px, py, pz = position
        sx, sy, sz = piece.logical_size
        body = Entity(
            parent=self.root,
            model=mesh,
            position=(px + sx / 2, pz + sz / 2, py + sy / 2),
            color=body_color,
            double_sided=True,
        )
        self.entities.append(body)

        edge_segments = self.build_mesh_edge_segments(mirrored_vertices, resolved_triangles)
        if edge_segments:
            edge_mesh = Mesh(vertices=mirrored_vertices, triangles=edge_segments, mode="line", thickness=MESH_EDGE_THICKNESS)
            edge_entity = Entity(
                parent=self.root,
                model=edge_mesh,
                position=(px + sx / 2, pz + sz / 2, py + sy / 2),
                color=color.rgb32(8, 10, 12),
            )
            self.entities.append(edge_entity)

        self.draw_envelope_outline(piece, position=position, selected=selected)

    def draw_anchors(self, anchors: List[Anchor], color_name: str = "anchor") -> None:
        if not self.show_anchors:
            return

        for anchor_data in anchors:
            anchor = Entity(
                parent=self.root,
                model="sphere",
                position=to_scene_anchor_position(anchor_data.position),
                scale=(0.11, 0.11, 0.11),
                color=color_from_name(color_name),
            )
            self.entities.append(anchor)


class EditorViewer:
    def __init__(self, grid_entity: Entity) -> None:
        self.renderer = PieceRenderer()
        self.editor_camera = EditorCamera(rotation_speed=120, panning_speed=8, zoom_speed=0, ignore_scroll_on_ui=False)
        self.editor_camera.rotation_x = 30
        self.editor_camera.rotation_y = -35
        self.pointer_lens_pos: Optional[Tuple[float, float]] = None
        self.cursor_entity = Entity(model="cube", color=color_from_name("cursor"), scale=(1.02, 1.02, 1.02), enabled=True)
        self.grid = grid_entity
        self.grid_enabled = True
        self.envelope_outline_enabled = True
        self.anchors_enabled = False
        self.hitboxes: List[Entity] = []

    def set_pointer_from_widget(self, x: float, y: float, width: float, height: float) -> None:
        widget_width = max(width, 1.0)
        widget_height = max(height, 1.0)
        lens_x = (float(x) / widget_width) * 2.0 - 1.0
        lens_y = 1.0 - (float(y) / widget_height) * 2.0
        self.pointer_lens_pos = (lens_x, lens_y)

    def clear_pointer_override(self) -> None:
        self.pointer_lens_pos = None

    def set_grid_enabled(self, enabled: bool) -> None:
        self.grid_enabled = enabled
        self.grid.enabled = enabled

    def set_envelope_outline_enabled(self, enabled: bool) -> None:
        self.envelope_outline_enabled = enabled
        self.renderer.show_envelope_outline = enabled

    def set_anchors_enabled(self, enabled: bool) -> None:
        self.anchors_enabled = enabled
        self.renderer.show_anchors = enabled

    def clear_hitboxes(self) -> None:
        for entity in self.hitboxes:
            destroy(entity)
        self.hitboxes.clear()

    def draw_edit_piece(self, piece: Piece, cursor: Cell) -> None:
        self.renderer.clear()
        self.clear_hitboxes()
        self.renderer.draw_piece_body(piece, solid_cells=piece.solid_cells, prefer_shape_geometry=(piece.render_mode == "variant"))
        self.renderer.draw_anchors(piece.anchors)
        self.cursor_entity.enabled = True
        self.cursor_entity.position = to_scene_cell_center(cursor)

    def draw_assembly(self, instances: List[PieceInstance], selected_index: Optional[int]) -> None:
        self.renderer.clear()
        self.clear_hitboxes()
        self.cursor_entity.enabled = False
        for index, instance in enumerate(instances):
            selected = index == selected_index
            self.renderer.draw_piece_body(
                instance.piece,
                position=instance.position,
                color_name=instance.color_name,
                selected=selected,
                solid_cells=instance.transformed_solid_cells(),
                mirror_state=(instance.mirror_length, instance.mirror_width, instance.mirror_height),
            )
            self.renderer.draw_anchors(instance.world_anchors(), color_name="anchor")
            px, py, pz = instance.position
            sx, sy, sz = instance.piece.logical_size
            hitbox = Entity(
                parent=self.renderer.root,
                model="cube",
                collider="box",
                position=(px + sx / 2, pz + sz / 2, py + sy / 2),
                scale=(sx, sz, sy),
                color=color.rgba32(0, 0, 0, 0),
            )
            hitbox.instance_index = index
            self.hitboxes.append(hitbox)

    def hovered_instance_index(self) -> Optional[int]:
        hovered = mouse.hovered_entity
        if hovered is None:
            return None
        return getattr(hovered, "instance_index", None)

    @staticmethod
    def _ray_box_distance(ray_origin: Vec3, ray_direction: Vec3, box_center: Vec3, box_scale: Vec3) -> Optional[float]:
        min_x = box_center.x - (box_scale.x / 2)
        max_x = box_center.x + (box_scale.x / 2)
        min_y = box_center.y - (box_scale.y / 2)
        max_y = box_center.y + (box_scale.y / 2)
        min_z = box_center.z - (box_scale.z / 2)
        max_z = box_center.z + (box_scale.z / 2)

        t_min = float("-inf")
        t_max = float("inf")
        for origin_value, direction_value, lower, upper in (
            (ray_origin.x, ray_direction.x, min_x, max_x),
            (ray_origin.y, ray_direction.y, min_y, max_y),
            (ray_origin.z, ray_direction.z, min_z, max_z),
        ):
            if abs(direction_value) <= 0.000001:
                if origin_value < lower or origin_value > upper:
                    return None
                continue
            inv_direction = 1.0 / direction_value
            near = (lower - origin_value) * inv_direction
            far = (upper - origin_value) * inv_direction
            if near > far:
                near, far = far, near
            t_min = max(t_min, near)
            t_max = min(t_max, far)
            if t_min > t_max:
                return None
        if t_max < 0:
            return None
        return t_min if t_min >= 0 else t_max

    def pick_instance_index(self) -> Optional[int]:
        hovered_index = self.hovered_instance_index()
        if hovered_index is not None:
            return hovered_index
        ray_origin, ray_direction = self.mouse_world_ray()
        best_index: Optional[int] = None
        best_distance: Optional[float] = None
        for hitbox in self.hitboxes:
            distance = self._ray_box_distance(ray_origin, ray_direction, hitbox.world_position, hitbox.scale)
            if distance is None:
                continue
            if best_distance is None or distance < best_distance:
                best_distance = distance
                best_index = getattr(hitbox, "instance_index", None)
        return best_index

    def mouse_world_ray(self) -> Tuple[Vec3, Vec3]:
        ray = CollisionRay()
        if self.pointer_lens_pos is not None:
            ray.set_from_lens(camera.lens_node, self.pointer_lens_pos[0], self.pointer_lens_pos[1])
        else:
            # Ursina mouse coordinates are in UI space: X already includes aspect ratio, Y does not.
            # Convert back to Panda lens space before building the world ray.
            ray.set_from_lens(camera.lens_node, mouse.x * 2 / window.aspect_ratio, mouse.y * 2)
        local_direction = Vec3(*ray.getDirection()).normalized()
        world_direction = Vec3(*scene.getRelativeVector(camera, local_direction)).normalized()
        return camera.world_position, world_direction

    def intersect_ray_plane(self, ray_origin: Vec3, ray_direction: Vec3, plane_point: Vec3, plane_normal: Vec3) -> Optional[Vec3]:
        denominator = ray_direction.dot(plane_normal)
        if abs(denominator) < 0.00001:
            return None
        distance = (plane_point - ray_origin).dot(plane_normal) / denominator
        if distance < 0:
            return None
        return ray_origin + (ray_direction * distance)

    def mouse_world_point_on_plane(self, plane_point: Vec3, plane_normal: Vec3) -> Optional[Vec3]:
        ray_origin, ray_direction = self.mouse_world_ray()
        return self.intersect_ray_plane(ray_origin, ray_direction, plane_point, plane_normal.normalized())

    def mouse_world_point_on_horizontal_plane(self, scene_y: float) -> Optional[Vec3]:
        return self.mouse_world_point_on_plane(Vec3(0, scene_y, 0), Vec3(0, 1, 0))

    def zoom_camera(self, direction: int) -> None:
        current_distance = max(abs(self.editor_camera.target_z), 0.001)
        min_distance = 1.5
        max_distance = 200.0
        zoom_ratio = 0.88
        current_sign = -1 if self.editor_camera.target_z <= 0 else 1

        if direction > 0:
            next_distance = current_distance * zoom_ratio
        else:
            next_distance = current_distance / zoom_ratio

        next_distance = max(min(next_distance, max_distance), min_distance)
        # Keep the EditorCamera pivot fixed and only move the camera on its local Z axis.
        self.editor_camera.target_z = current_sign * next_distance

    def orbit_camera(self, delta_yaw: float = 0.0, delta_pitch: float = 0.0) -> None:
        next_pitch = max(-89.0, min(89.0, self.editor_camera.rotation_x + delta_pitch))
        self.editor_camera.rotation_x = next_pitch
        self.editor_camera.rotation_y += delta_yaw

    def pan_camera(self, delta_x: float, delta_y: float) -> None:
        zoom_compensation = max(abs(self.editor_camera.target_z) * 0.0025, 0.02)
        self.editor_camera.position -= camera.right * delta_x * zoom_compensation
        self.editor_camera.position += camera.up * delta_y * zoom_compensation

    def center_scene(self, center: Vec3, size: float) -> None:
        distance = max(10.0, size * 4.2)
        self.editor_camera.position = center
        camera.position = Vec3(0, 0, -distance)
        camera.rotation = Vec3.zero
        self.editor_camera.start_position = center
        self.editor_camera.target_z = camera.z

    def setup_default_lights(self) -> None:
        DirectionalLight(rotation=(45, -35, 35), color=color.rgb32(126, 134, 146))
        AmbientLight(color=color.rgb32(42, 46, 56))
