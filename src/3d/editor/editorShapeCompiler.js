import { buildShapeGeometry } from '../core/meshGeneration.js';

function roundCompiledValue(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function worldToCatalogPoint(vertex, dimensions) {
  const length = Number(dimensions?.length) || 1;
  const width = Number(dimensions?.width) || 1;
  return {
    x: roundCompiledValue(vertex.y + length / 2),
    y: roundCompiledValue(vertex.x + width / 2),
    z: roundCompiledValue(vertex.z),
  };
}

function geometryToPreviewMesh(geometry, dimensions) {
  const position = geometry.getAttribute('position');
  if (!position || position.count === 0) return { vertices: [], faces: [] };

  const vertices = [];
  const faces = [];
  for (let index = 0; index < position.count; index += 1) {
    vertices.push({
      id: `pv_${String(index + 1).padStart(4, '0')}`,
      ...worldToCatalogPoint({
        x: position.getX(index),
        y: position.getY(index),
        z: position.getZ(index),
      }, dimensions),
    });
  }

  const source = geometry.index?.array ?? [...Array(position.count).keys()];
  for (let index = 0; index < source.length; index += 3) {
    faces.push({
      id: `pf_${String(index / 3 + 1).padStart(4, '0')}`,
      vertices: [
        vertices[source[index]]?.id,
        vertices[source[index + 1]]?.id,
        vertices[source[index + 2]]?.id,
      ].filter(Boolean),
    });
  }

  return { vertices, faces };
}

function compileShapeVariant(shape, size) {
  const compiledShape = cloneJson(shape);
  compiledShape.generation ??= { mode: 'voxel_grid', base: { type: 'box' }, cells: [], operations: [] };
  compiledShape.generation.operations ??= [];
  compiledShape.collision ??= { mode: 'base_box' };
  if (!compiledShape.collision.mode) compiledShape.collision.mode = 'base_box';

  const geometry = buildShapeGeometry({
    shape: compiledShape,
    size,
    scale: 1,
  });
  compiledShape.preview_mesh = geometryToPreviewMesh(geometry, size?.dimensions);
  geometry.dispose?.();
  return compiledShape;
}

export function compileEditorCatalog({
  catalog,
  sizes = [],
  draftStateByShapeId = {},
}) {
  const errors = [];
  const warnings = [];
  const sizeById = new Map((sizes ?? []).map((size) => [size.id, size]));

  for (const [shapeId, draftState] of Object.entries(draftStateByShapeId ?? {})) {
    if ((draftState?.edgeCount ?? 0) > 0 || (draftState?.faceCount ?? 0) > 0) {
      errors.push(`${shapeId}: draft avancé incomplet à compiler d'abord.`);
    }
  }
  if (errors.length) return { ok: false, errors, warnings, catalog: null };

  const compiledCatalog = cloneJson(catalog);
  compiledCatalog.shape_variants = (compiledCatalog.shape_variants ?? []).map((shape) => {
    const size = sizeById.get(shape.size_id) ?? { dimensions: shape?.generation?.base?.bounds ?? { length: 1, width: 1, height: 1 } };
    return compileShapeVariant(shape, size);
  });

  return { ok: true, errors, warnings, catalog: compiledCatalog };
}
