function createIssue(level, path, message, code) {
  return { level, path, message, code };
}

function createReporter() {
  const errors = [];
  const warnings = [];
  return {
    error(path, message, code = 'invalid') {
      errors.push(createIssue('error', path, message, code));
    },
    warn(path, message, code = 'warning') {
      warnings.push(createIssue('warning', path, message, code));
    },
    build() {
      return { valid: errors.length === 0, errors, warnings };
    },
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function validateVectorLike(value, path, reporter) {
  if (!isObject(value)) {
    reporter.error(path, 'vecteur absent ou invalide.', 'invalid_vector');
    return;
  }
  for (const axis of ['x', 'y', 'z']) {
    if (!isFiniteNumber(value[axis])) {
      reporter.error(`${path}.${axis}`, `${axis} doit être un nombre fini.`, 'invalid_number');
    }
  }
}

export function validateSceneSnapshot(ship, options = {}) {
  const reporter = createReporter();
  const pieces = ship?.pieces;
  const groups = ship?.groups ?? [];
  const catalogPieceIds = new Set(options.catalogPieceIds ?? []);

  if (!Array.isArray(pieces)) {
    reporter.error('ship.pieces', 'ship.pieces doit être un tableau.', 'invalid_collection');
    return reporter.build();
  }
  if (!Array.isArray(groups)) {
    reporter.error('ship.groups', 'ship.groups doit être un tableau.', 'invalid_collection');
    return reporter.build();
  }

  const pieceIds = new Set();
  const groupIds = new Set();
  const groupedPieceIds = new Set();

  for (const [index, piece] of pieces.entries()) {
    const path = `ship.pieces[${index}]`;
    const pieceId = piece?.placed_piece_id ?? piece?.id;
    if (!pieceId) reporter.error(`${path}.placed_piece_id`, 'placed_piece_id absent.', 'missing_id');
    else if (pieceIds.has(pieceId)) reporter.error(`${path}.placed_piece_id`, `placed_piece_id dupliqué: ${pieceId}.`, 'duplicate_id');
    else pieceIds.add(pieceId);

    const catalogPieceId = piece?.catalog_piece_id ?? piece?.catalogId;
    if (!catalogPieceId) reporter.error(`${path}.catalog_piece_id`, 'catalog_piece_id absent.', 'missing_field');
    else if (catalogPieceIds.size > 0 && !catalogPieceIds.has(catalogPieceId)) {
      reporter.error(`${path}.catalog_piece_id`, `catalog_piece_id introuvable (${catalogPieceId}).`, 'missing_reference');
    }

    validateVectorLike(piece?.position, `${path}.position`, reporter);
    if (!isObject(piece?.rotation)) reporter.error(`${path}.rotation`, 'rotation absente ou invalide.', 'missing_field');

    const symmetry = piece?.symmetry;
    if (!isObject(symmetry)) reporter.error(`${path}.symmetry`, 'symmetry absente ou invalide.', 'missing_field');
    else {
      for (const axis of ['width', 'length', 'height']) {
        if (typeof symmetry[axis] !== 'boolean') {
          reporter.error(`${path}.symmetry.${axis}`, `${axis} doit être booléen.`, 'invalid_boolean');
        }
      }
    }
  }

  for (const [index, group] of groups.entries()) {
    const path = `ship.groups[${index}]`;
    const groupId = group?.group_id ?? group?.id;
    if (!groupId) reporter.error(`${path}.group_id`, 'group_id absent.', 'missing_id');
    else if (groupIds.has(groupId)) reporter.error(`${path}.group_id`, `group_id dupliqué: ${groupId}.`, 'duplicate_id');
    else groupIds.add(groupId);

    validateVectorLike(group?.origin, `${path}.origin`, reporter);

    if (!Array.isArray(group?.children) || group.children.length === 0) {
      reporter.error(`${path}.children`, 'children doit être un tableau non vide.', 'invalid_collection');
      continue;
    }

    for (const [childIndex, child] of group.children.entries()) {
      const childPath = `${path}.children[${childIndex}]`;
      const instanceId = child?.instance_id ?? child?.instanceId;
      if (!instanceId) {
        reporter.error(`${childPath}.instance_id`, 'instance_id absent.', 'missing_id');
        continue;
      }
      if (!pieceIds.has(instanceId)) {
        reporter.error(`${childPath}.instance_id`, `instance_id introuvable (${instanceId}).`, 'missing_reference');
        continue;
      }
      if (groupedPieceIds.has(instanceId)) {
        reporter.error(`${childPath}.instance_id`, `instance_id déjà rattaché à un autre groupe (${instanceId}).`, 'duplicate_reference');
      }
      groupedPieceIds.add(instanceId);
      validateVectorLike(child?.local_position ?? child?.localPosition, `${childPath}.local_position`, reporter);
    }
  }

  for (const [index, piece] of pieces.entries()) {
    const path = `ship.pieces[${index}]`;
    const pieceId = piece?.placed_piece_id ?? piece?.id;
    const groupId = piece?.group_id ?? piece?.groupId ?? null;
    if (groupId == null) {
      if (pieceId && groupedPieceIds.has(pieceId)) {
        reporter.warn(`${path}.group_id`, `group_id absent alors que la pièce ${pieceId} est listée dans un groupe.`, 'group_link_mismatch');
      }
      continue;
    }
    if (!groupIds.has(groupId)) {
      reporter.error(`${path}.group_id`, `group_id introuvable (${groupId}).`, 'missing_reference');
    }
  }

  return reporter.build();
}
