import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAdvancedDraftEdge,
  createAdvancedDraftEdgesFromSelection,
  getAdvancedDraftEdgesForShape,
  removeAdvancedDraftEdgesById,
  selectAdvancedEdge,
} from '../src/3d/editor/editorEdges.js';

function pointMap(entries) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

test('L with 2 points creates a draft edge', () => {
  const result = createAdvancedDraftEdge({
    shapeId: 'shape_1',
    selectedPointIds: ['pt_0_0_0', 'pt_0_5_0_0'],
    existingEdges: [],
    validPointIds: ['pt_0_0_0', 'pt_0_5_0_0'],
  });

  assert.equal(result.created, true);
  assert.equal(result.edge.pointA, 'pt_0_0_0');
  assert.equal(result.edge.pointB, 'pt_0_5_0_0');
});

test('L with fewer than 2 points creates nothing', () => {
  const result = createAdvancedDraftEdge({
    shapeId: 'shape_1',
    selectedPointIds: ['pt_0_0_0'],
    existingEdges: [],
    validPointIds: ['pt_0_0_0'],
  });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'insufficient_points');
});

test('L with more than 2 points is refused', () => {
  const result = createAdvancedDraftEdge({
    shapeId: 'shape_1',
    selectedPointIds: ['pt_0_0_0', 'pt_0_5_0_0', 'pt_1_0_0'],
    existingEdges: [],
    validPointIds: ['pt_0_0_0', 'pt_0_5_0_0', 'pt_1_0_0'],
  });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'too_many_points');
});

test('duplicate edge is refused', () => {
  const result = createAdvancedDraftEdge({
    shapeId: 'shape_1',
    selectedPointIds: ['pt_0_5_0_0', 'pt_0_0_0'],
    existingEdges: [{ id: 'edge_existing', pointA: 'pt_0_0_0', pointB: 'pt_0_5_0_0' }],
    validPointIds: ['pt_0_0_0', 'pt_0_5_0_0'],
  });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'duplicate_edge');
});

test('unknown points are refused', () => {
  const result = createAdvancedDraftEdge({
    shapeId: 'shape_1',
    selectedPointIds: ['pt_0_0_0', 'pt_missing'],
    existingEdges: [],
    validPointIds: ['pt_0_0_0'],
  });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'unknown_points');
});

test('edges are kept per active shape', () => {
  const edgeState = {
    shape_1: [{ id: 'edge_1', pointA: 'a', pointB: 'b' }],
  };
  assert.deepEqual(getAdvancedDraftEdgesForShape(edgeState, 'shape_1').map((edge) => edge.id), ['edge_1']);
  assert.deepEqual(getAdvancedDraftEdgesForShape(edgeState, 'shape_2'), []);
});

test('edge selection supports stable multi-select', () => {
  assert.deepEqual(selectAdvancedEdge('edge_a', [], {}), ['edge_a']);
  assert.deepEqual(selectAdvancedEdge('edge_b', ['edge_a'], { multi: true }), ['edge_a', 'edge_b']);
});

test('selected edges can be removed', () => {
  const remaining = removeAdvancedDraftEdgesById([
    { id: 'edge_a', pointA: 'a', pointB: 'b' },
    { id: 'edge_b', pointA: 'b', pointB: 'c' },
  ], ['edge_a']);

  assert.deepEqual(remaining.map((edge) => edge.id), ['edge_b']);
});

test('3 selected points create a triangle loop automatically', () => {
  const result = createAdvancedDraftEdgesFromSelection({
    shapeId: 'shape_1',
    selectedPointIds: ['p1', 'p2', 'p3'],
    existingEdges: [],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 0, z: 0 },
      { id: 'p3', x: 0, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, true);
  assert.equal(result.edges.length, 3);
  assert.deepEqual(result.edges.map((edge) => [edge.pointA, edge.pointB]), [
    ['p1', 'p2'],
    ['p2', 'p3'],
    ['p3', 'p1'],
  ]);
});

test('4 selected points create a quadrilateral loop automatically', () => {
  const result = createAdvancedDraftEdgesFromSelection({
    shapeId: 'shape_1',
    selectedPointIds: ['p1', 'p2', 'p3', 'p4'],
    existingEdges: [],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 2, y: 0, z: 0 },
      { id: 'p3', x: 3, y: 1, z: 0 },
      { id: 'p4', x: 1, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, true);
  assert.equal(result.edges.length, 4);
});

test('existing connections are reused and only missing loop edges are created', () => {
  const result = createAdvancedDraftEdgesFromSelection({
    shapeId: 'shape_1',
    selectedPointIds: ['p1', 'p2', 'p3', 'p4'],
    existingEdges: [
      { id: 'e1', pointA: 'p1', pointB: 'p2' },
      { id: 'e2', pointA: 'p2', pointB: 'p3' },
    ],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 2, y: 0, z: 0 },
      { id: 'p3', x: 2, y: 1, z: 0 },
      { id: 'p4', x: 0, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, true);
  assert.equal(result.edges.length, 2);
  assert.equal(result.reusedEdgeCount, 2);
  assert.deepEqual(result.loopEdgeIds, ['e1', 'e2', 'edge_p3__p4', 'edge_p1__p4']);
});

test('5 selected points are refused with explicit unsupported count', () => {
  const result = createAdvancedDraftEdgesFromSelection({
    shapeId: 'shape_1',
    selectedPointIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    existingEdges: [],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 0, z: 0 },
      { id: 'p3', x: 1, y: 1, z: 0 },
      { id: 'p4', x: 0, y: 1, z: 0 },
      { id: 'p5', x: 0.5, y: 0.5, z: 0 },
    ]),
  });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'unsupported_point_count');
});
