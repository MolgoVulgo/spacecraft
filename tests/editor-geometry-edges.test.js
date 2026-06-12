import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEdgeChamferOperation,
  createEdgeFilletOperation,
  deriveEditableBBoxEdges,
  normalizeEdgeCorrectionOperations,
  selectEditableEdge,
  upsertEdgeCorrection,
  validateEdgeChamferOperation,
  validateEdgeCorrectionExclusivity,
  validateEdgeFilletOperation,
} from '../src/3d/editor/editorGeometryEdges.js';

test('bbox editable edges are stable and unique for 4x3x1', () => {
  const size = { dimensions: { length: 4, width: 3, height: 1 } };
  const edges = deriveEditableBBoxEdges(size);

  assert.deepEqual(edges.map((edge) => edge.id), [
    'top-front',
    'top-back',
    'top-left',
    'top-right',
    'bottom-front',
    'bottom-back',
    'bottom-left',
    'bottom-right',
  ]);
  assert.equal(new Set(edges.map((edge) => edge.id)).size, edges.length);
  assert.deepEqual(deriveEditableBBoxEdges(size).map((edge) => edge.id), edges.map((edge) => edge.id));
  for (const edge of edges) {
    for (const point of [edge.start, edge.end]) {
      assert.equal(point.x >= 0 && point.x <= 4, true);
      assert.equal(point.y >= 0 && point.y <= 3, true);
      assert.equal(point.z >= 0 && point.z <= 1, true);
    }
  }
});

test('editable edge selection supports single and multi toggle', () => {
  assert.deepEqual(selectEditableEdge('top-front', [], {}), ['top-front']);
  assert.deepEqual(selectEditableEdge('top-left', ['top-front'], { multi: true }), ['top-front', 'top-left']);
  assert.deepEqual(selectEditableEdge('top-left', ['top-front', 'top-left'], { multi: true }), ['top-front']);
});

test('selected edges create one edge_chamfer operation', () => {
  const editableEdges = deriveEditableBBoxEdges({ dimensions: { length: 4, width: 3, height: 1 } });
  const result = createEdgeChamferOperation({
    shapeId: 'shape_1',
    edgeIds: ['top-front', 'top-left'],
    editableEdges,
  });

  assert.equal(result.created, true);
  assert.equal(result.operation.type, 'edge_chamfer');
  assert.deepEqual(result.operation.edge_ids, ['top-front', 'top-left']);
  assert.equal(result.operation.amount, 0.5);
  assert.equal(validateEdgeChamferOperation(result.operation).valid, true);
});

test('selected edges create one edge_fillet operation', () => {
  const editableEdges = deriveEditableBBoxEdges({ dimensions: { length: 4, width: 3, height: 1 } });
  const result = createEdgeFilletOperation({
    shapeId: 'shape_1',
    edgeIds: ['top-front'],
    editableEdges,
  });

  assert.equal(result.created, true);
  assert.equal(result.operation.type, 'edge_fillet');
  assert.deepEqual(result.operation.edge_ids, ['top-front']);
  assert.equal(result.operation.radius, 1);
  assert.equal(result.operation.segments, 8);
  assert.equal(validateEdgeFilletOperation(result.operation).valid, true);
});

test('edge operations refuse empty edge selection', () => {
  const editableEdges = deriveEditableBBoxEdges({ dimensions: { length: 4, width: 3, height: 1 } });
  assert.equal(createEdgeChamferOperation({ shapeId: 'shape_1', edgeIds: [], editableEdges }).reason, 'empty_selection');
  assert.equal(createEdgeFilletOperation({ shapeId: 'shape_1', edgeIds: [], editableEdges }).reason, 'empty_selection');
});

test('upsertEdgeCorrection replaces fillet with chamfer on the same edge', () => {
  const shape = {
    generation: {
      operations: [
        { type: 'edge_fillet', edge_id: 'top-back', radius: 1 },
      ],
    },
  };

  upsertEdgeCorrection(shape, 'top-back', { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 });
  assert.deepEqual(shape.generation.operations, [
    { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 },
  ]);
});

test('upsertEdgeCorrection replaces chamfer with fillet on the same edge', () => {
  const shape = {
    generation: {
      operations: [
        { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 },
      ],
    },
  };

  upsertEdgeCorrection(shape, 'top-back', { type: 'edge_fillet', edge_id: 'top-back', radius: 1 });
  assert.deepEqual(shape.generation.operations, [
    { type: 'edge_fillet', edge_id: 'top-back', radius: 1 },
  ]);
});

test('upsertEdgeCorrection does not duplicate the same operation on the same edge', () => {
  const shape = {
    generation: {
      operations: [
        { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 },
      ],
    },
  };

  upsertEdgeCorrection(shape, 'top-back', { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 });
  assert.deepEqual(shape.generation.operations, [
    { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 },
  ]);
});

test('upsertEdgeCorrection preserves other edges and non-edge operations', () => {
  const shape = {
    generation: {
      operations: [
        { type: 'cut', face_id: 'top', point_ids: [] },
        { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 },
        { type: 'edge_fillet', edge_id: 'top-front', radius: 1 },
      ],
    },
  };

  upsertEdgeCorrection(shape, 'top-back', { type: 'edge_fillet', edge_id: 'top-back', radius: 1 });
  assert.deepEqual(shape.generation.operations, [
    { type: 'cut', face_id: 'top', point_ids: [] },
    { type: 'edge_fillet', edge_id: 'top-front', radius: 1 },
    { type: 'edge_fillet', edge_id: 'top-back', radius: 1 },
  ]);
});

test('normalizeEdgeCorrectionOperations keeps the latest correction per edge', () => {
  const report = normalizeEdgeCorrectionOperations([
    { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 },
    { type: 'edge_fillet', edge_id: 'top-back', radius: 1 },
    { type: 'edge_fillet', edge_id: 'top-front', radius: 1 },
  ]);

  assert.equal(report.changed, true);
  assert.deepEqual(report.operations, [
    { type: 'edge_fillet', edge_id: 'top-back', radius: 1 },
    { type: 'edge_fillet', edge_id: 'top-front', radius: 1 },
  ]);
});

test('validateEdgeCorrectionExclusivity rejects duplicate edge corrections on one edge', () => {
  const report = validateEdgeCorrectionExclusivity([
    { type: 'edge_chamfer', edge_id: 'top-back', amount: 0.5 },
    { type: 'edge_fillet', edge_id: 'top-back', radius: 1 },
  ]);

  assert.equal(report.valid, false);
  assert.match(report.errors[0], /EDGE_CORRECTION_EXCLUSIVE_PER_EDGE edge top-back: edge_chamfer \+ edge_fillet/);
});
