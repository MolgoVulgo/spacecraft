export function getAssemblyShapePalettePieces({ pieces, selectedPiece, getPieceProfileType }) {
  if (!selectedPiece) return [];
  return pieces.filter((piece) => (
    piece.family_id === selectedPiece.family_id
    && piece.size_id === selectedPiece.size_id
    && getPieceProfileType(piece) === 'standard'
  ));
}

export function getAssemblyShapePaletteVariantMap({ pieces, getShapeVariant, shapeButtonCount }) {
  const variantMap = new Map();
  for (const piece of pieces) {
    const variantIndex = Number(getShapeVariant(piece.shape_variant_id)?.variant_index);
    if (!Number.isInteger(variantIndex) || variantIndex < 1 || variantIndex > shapeButtonCount) continue;
    if (!variantMap.has(variantIndex)) variantMap.set(variantIndex, piece);
  }
  return variantMap;
}

export function applyVariantToAssemblyInstance({
  instance,
  currentPiece,
  nextPiece,
  buildGeometry,
  getReservationBoxForCatalogPiece,
  collidesWithOthers,
  createAssemblyEdgeGeometry,
  createAnchorGroup,
  disposeAnchorGroup,
  setSelectedCatalogPieceId,
  refreshAfterApply,
  setMessage,
  markShipDirty,
}) {
  if (!instance || !currentPiece || !nextPiece) {
    setMessage?.('Sélectionne une pièce dans la scène avant de choisir une forme.');
    return false;
  }

  if (currentPiece.family_id !== nextPiece.family_id || currentPiece.size_id !== nextPiece.size_id) {
    setMessage?.('Forme refusée : famille ou taille différente de la pièce sélectionnée.');
    return false;
  }

  const nextGeometry = buildGeometry(nextPiece, instance.symmetry);
  const candidateBox = getReservationBoxForCatalogPiece(nextPiece, instance.group.position);
  if (collidesWithOthers(candidateBox, instance.id)) {
    nextGeometry.dispose?.();
    setMessage?.('Forme refusée : collision avec une autre pièce.');
    return false;
  }

  const oldMeshGeometry = instance.mesh.geometry;
  const oldEdgesGeometry = instance.edges.geometry;
  const oldAnchorGroup = instance.anchors;
  const preservedPosition = instance.group.position.clone();
  const preservedRotation = instance.group.rotation.clone();
  const preservedScale = instance.group.scale.clone();

  instance.catalogPieceId = nextPiece.id;
  instance.label = `${nextPiece.label_fr || nextPiece.id} #${instance.id.replace('placed_', '')}`;
  instance.mesh.geometry = nextGeometry;
  instance.edges.geometry = createAssemblyEdgeGeometry(nextPiece, nextGeometry);
  instance.edges.visible = true;
  instance.anchors = createAnchorGroup(nextPiece, instance.symmetry);
  instance.group.remove(oldAnchorGroup);
  instance.group.add(instance.anchors);
  instance.group.position.copy(preservedPosition);
  instance.group.rotation.copy(preservedRotation);
  instance.group.scale.copy(preservedScale);

  oldMeshGeometry?.dispose?.();
  oldEdgesGeometry?.dispose?.();
  disposeAnchorGroup?.(oldAnchorGroup);

  setSelectedCatalogPieceId?.(nextPiece.id);
  refreshAfterApply?.();
  setMessage?.('Forme appliquée à la pièce sélectionnée.');
  markShipDirty?.();
  return true;
}
