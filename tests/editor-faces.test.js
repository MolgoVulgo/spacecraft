import test from 'node:test';
import assert from 'node:assert/strict';

import { createAdvancedDraftFace, removeInvalidDraftFaces } from '../src/3d/editor/editorFaces.js';

function pointMap(entries) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

test('square loop creates a valid face', () => {
  const result = createAdvancedDraftFace({
    shapeId: 'shape_1',
    selectedEdgeIds: ['e1', 'e2', 'e3', 'e4'],
    edges: [
      { id: 'e1', pointA: 'p1', pointB: 'p2' },
      { id: 'e2', pointA: 'p2', pointB: 'p3' },
      { id: 'e3', pointA: 'p3', pointB: 'p4' },
      { id: 'e4', pointA: 'p4', pointB: 'p1' },
    ],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 0, z: 0 },
      { id: 'p3', x: 1, y: 1, z: 0 },
      { id: 'p4', x: 0, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, true);
  assert.deepEqual(result.face.points, ['p1', 'p2', 'p3', 'p4']);
  assert.deepEqual(result.face.normal, { x: 0, y: 0, z: 1 });
});

test('face creation can use all active edges when no edge is explicitly selected', () => {
  const result = createAdvancedDraftFace({
    shapeId: 'shape_1',
    selectedEdgeIds: [],
    edges: [
      { id: 'e1', pointA: 'p1', pointB: 'p2' },
      { id: 'e2', pointA: 'p2', pointB: 'p3' },
      { id: 'e3', pointA: 'p3', pointB: 'p1' },
    ],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 0, z: 0 },
      { id: 'p3', x: 0, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, true);
  assert.deepEqual(result.face.edges, ['e1', 'e2', 'e3']);
});

test('face creation prioritizes edges matching selected points', () => {
  const result = createAdvancedDraftFace({
    shapeId: 'shape_1',
    selectedEdgeIds: [],
    selectedPointIds: ['p1', 'p2', 'p3'],
    edges: [
      { id: 'e1', pointA: 'p1', pointB: 'p2' },
      { id: 'e2', pointA: 'p2', pointB: 'p3' },
      { id: 'e3', pointA: 'p3', pointB: 'p1' },
      { id: 'e4', pointA: 'p4', pointB: 'p5' },
      { id: 'e5', pointA: 'p5', pointB: 'p6' },
      { id: 'e6', pointA: 'p6', pointB: 'p4' },
    ],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 0, z: 0 },
      { id: 'p3', x: 0, y: 1, z: 0 },
      { id: 'p4', x: 2, y: 0, z: 0 },
      { id: 'p5', x: 3, y: 0, z: 0 },
      { id: 'p6', x: 2, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, true);
  assert.deepEqual(result.face.edges, ['e1', 'e2', 'e3']);
  assert.deepEqual(result.face.points, ['p1', 'p2', 'p3']);
});

test('extra connections between selected points do not block perimeter face creation', () => {
  const result = createAdvancedDraftFace({
    shapeId: 'shape_1',
    selectedEdgeIds: [],
    selectedPointIds: ['p1', 'p2', 'p3', 'p4'],
    edges: [
      { id: 'e1', pointA: 'p1', pointB: 'p2' },
      { id: 'e2', pointA: 'p2', pointB: 'p3' },
      { id: 'e3', pointA: 'p3', pointB: 'p4' },
      { id: 'e4', pointA: 'p4', pointB: 'p1' },
      { id: 'diag', pointA: 'p1', pointB: 'p3' },
    ],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 0, z: 0 },
      { id: 'p3', x: 1, y: 1, z: 0 },
      { id: 'p4', x: 0, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, true);
  assert.deepEqual(result.face.edges, ['e1', 'e2', 'e3', 'e4']);
});

test('more than 4 selected points without explicit edges is refused explicitly', () => {
  const result = createAdvancedDraftFace({
    shapeId: 'shape_1',
    selectedEdgeIds: [],
    selectedPointIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    edges: [],
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

test('open loop is refused', () => {
  const result = createAdvancedDraftFace({
    shapeId: 'shape_1',
    selectedEdgeIds: ['e1', 'e2', 'e3'],
    edges: [
      { id: 'e1', pointA: 'p1', pointB: 'p2' },
      { id: 'e2', pointA: 'p2', pointB: 'p3' },
      { id: 'e3', pointA: 'p3', pointB: 'p4' },
    ],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 0, z: 0 },
      { id: 'p3', x: 1, y: 1, z: 0 },
      { id: 'p4', x: 0, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'open_loop');
});

test('non coplanar loop is refused', () => {
  const result = createAdvancedDraftFace({
    shapeId: 'shape_1',
    selectedEdgeIds: ['e1', 'e2', 'e3', 'e4'],
    edges: [
      { id: 'e1', pointA: 'p1', pointB: 'p2' },
      { id: 'e2', pointA: 'p2', pointB: 'p3' },
      { id: 'e3', pointA: 'p3', pointB: 'p4' },
      { id: 'e4', pointA: 'p4', pointB: 'p1' },
    ],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 0, z: 0 },
      { id: 'p3', x: 1, y: 1, z: 1 },
      { id: 'p4', x: 0, y: 1, z: 0 },
    ]),
  });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'non_coplanar');
});

test('self-crossed loop is refused', () => {
  const result = createAdvancedDraftFace({
    shapeId: 'shape_1',
    selectedEdgeIds: ['e1', 'e2', 'e3', 'e4'],
    edges: [
      { id: 'e1', pointA: 'p1', pointB: 'p2' },
      { id: 'e2', pointA: 'p2', pointB: 'p3' },
      { id: 'e3', pointA: 'p3', pointB: 'p4' },
      { id: 'e4', pointA: 'p4', pointB: 'p1' },
    ],
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 0 },
      { id: 'p2', x: 1, y: 1, z: 0 },
      { id: 'p3', x: 0, y: 1, z: 0 },
      { id: 'p4', x: 1, y: 0, z: 0 },
    ]),
  });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'self_crossed');
});

test('faces are dropped when referenced edges disappear', () => {
  const remaining = removeInvalidDraftFaces([
    { id: 'face_ok', edges: ['e1', 'e2'] },
    { id: 'face_bad', edges: ['e3', 'e4'] },
  ], ['e1', 'e2']);

  assert.deepEqual(remaining.map((face) => face.id), ['face_ok']);
});
