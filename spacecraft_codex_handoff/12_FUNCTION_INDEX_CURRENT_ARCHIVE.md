# Function Index From Current Latest Archive

> Reference only. The user intends to restart from a stable version, so do not assume latest drag code is good.

## src/main.js
```text
136:function createAssemblyGrid(size = 4000, step = 50) {
151:function updateAssemblyGrid() {
166:function getMagnetStep() {
172:async function loadAssemblyCatalog() {
179:function buildRepository(catalog) {
191:function getCatalogPieceById(pieceId) {
195:function getSelectedCatalogPiece() {
199:function setSelectedCatalogPiece(pieceId) {
211:function getFamily(id) {
215:function getSize(id) {
219:function getShapeVariant(id) {
223:function getSpecProfile(id) {
227:function getRecipe(id) {
231:function getSelectedInstance() {
235:function cloneSymmetry(source = {}) {
243:function getSymmetryLabel(symmetry) {
251:function getEffectiveSpecProfile(profileId, visited = new Set()) {
271:function getVariantDisplayLabel(shape, size) {
284:function getDisplayLabel(catalogPiece) {
297:function escapeRegExp(value) {
301:function getCatalogGroupLabel(catalogPiece) {
307:function buildGeometry(catalogPiece, symmetry = {}) {
314:function createAssemblyEdgeGeometry(catalogPiece, geometry) {
319:function createFixedCatalogueBoxEdges(size, scale) {
345:function createOutlineEdgesOnly(geometry) {
355:function createMaterial(color = DEFAULT_COLOR) {
362:function createAnchorGroup(catalogPiece, symmetry = {}) {
388:function getShapeApproxSize(shape) {
394:function anchorToMeshPosition(catalogPiece, shape, anchor, symmetry) {
406:function safeRatio(value, max) {
413:function updateAnchorVisibility() {
422:function disposeAnchorGroup(group) {
428:function createInstance(catalogPiece, options = {}) {
497:function disposeInstanceResources(instance) {
505:function findAvailablePosition(catalogPiece) {
550:function addCatalogPieceById(pieceId, position = null) {
562:function addSelectedCatalogPiece(position = null) {
568:function duplicateSelectedInstance() {
602:function disposeInstance(instance) {
607:function removeSelectedInstance() {
622:function clearScene() {
636:function selectInstance(id) {
646:function refreshInstanceList() {
657:function updateSelectionUi() {
678:function setSymmetryButtonState(symmetry) {
684:function toggleSelectedSymmetry(axis) {
700:function resetSelectedSymmetries() {
706:function applySymmetryState(instance, nextSymmetry) {
742:function getBoxAt(geometry, position) {
747:function getReservationBoxForCatalogPiece(catalogPiece, position = new THREE.Vector3()) {
753:function getInstanceReservationBox(instance, position = instance.group.position) {
758:function getInstanceBox(instance, position = instance.group.position) {
762:function boxesOverlap(a, b) {
773:function collidesWithOthers(candidateBox, ignoredInstanceId) {
780:function hasCollision(instance, position) {
784:function calculateShipStats() {
843:function updateStats() {
900:function setMessage(message) {
905:function fmt(value) {
910:function updateEmptyHint() {
917:function updateSelectionBox() {
927:function fitCameraToObject(object, renderNow = true) {
943:function fitCameraToAll(renderNow = true) {
959:function fitOrthographicBox(box, padding = 1.25) {
977:function resetView() {
981:function takeScreenshot() {
989:function setAssemblyView(mode = 'top', fit = true) {
1018:function positionCameraForCurrentView(center) {
1033:function setActiveViewButton(mode) {
1039:function updateDimensionOverlay() {
1059:function resize() {
1071:function updateOrthographicFrustum(viewSize = camera.userData.viewSize ?? 1000) {
1083:function animate() {
1091:function setPointerFromEvent(event) {
1097:function pickInstance(event) {
1108:function intersectDragPlane(event, target) {
1114:function snapValue(value, step) {
1118:function normalizeCandidatePosition(instance, position, options = {}) {
1140:function resolveInitialSideDragLock(instance, targetPosition) {
1170:function getPrimarySideConnectionForInstance(instance) {
1199:function normalizeNewPiecePosition(catalogPiece, position) {
1205:function snapPositionToHalfUnit(position) {
1213:function applyMagneticSnap(instance, position) {
1218:function applyMagneticSnapForCatalogPiece(catalogPiece, position, excludeInstanceId = null) {
1253:function resolveSideAnchorSnapPosition(instance, targetPosition, options = {}) {
1304:function isSideAttachmentAnchor(anchor) {
1310:function areOpposedAnchors(a, b) {
1316:function updateAttachmentStates() {
1329:function getAnchorConnectedRootSet() {
1361:function instancesHaveCompatibleAnchors(instance, other) {
1378:function getAttachmentValidity(instance) {
1387:function reservationBoxesTouch(a, b) {
1398:function getWorldAttachmentAnchorsForInstance(instance) {
1403:function getWorldAttachmentAnchors(catalogPiece, symmetry = {}, position = new THREE.Vector3()) {
1419:function catalogNormalToWorld(normal, symmetry = {}) {
1431:function getEffectiveAttachmentAnchors(shape, size) {
1438:function isSixFacePlaceholderAnchorSet(anchors) {
1443:function generateHalfStepFaceAnchors(size) {
1473:function tryMoveInstance(instance, targetPosition, reason = 'Déplacement refusé : collision avec une autre pièce.', options = {}) {
1502:function resolveVerticalCollisionPosition(instance, targetPosition, options = {}) {
1525:function resolveDragTransitPosition(instance, targetPosition, direction, step) {
1572:function isFiniteDragPosition(position) {
1579:function isAllowedDragTransitCollision(instance, candidatePosition, sourcePosition) {
1618:function getAutoVerticalDirection() {
1626:function applyInstanceDragPosition(instance, position, { transitCollision = false, message = '' } = {}) {
1639:function applyDragPosition(instance, position) {
1662:function moveSelectedHeight(delta) {
1670:function setSelectedHeight(value) {
1679:function getHeightStep() {
1683:function getCatalogPieceIdFromDrop(event) {
1689:function getDropScenePosition(event) {
1700:function onCanvasDragOver(event) {
1708:function onCanvasDragLeave() {
1712:function onCanvasDrop(event) {
1723:function configureDragPlaneForView(instance) {
1739:function onPointerDown(event) {
1766:function onPointerMove(event) {
1777:function onPointerUp(event) {
1808:function rebuildRepository() {
1812:function slugifyId(value) {
1822:function uniqueId(base, existingIds) {
1831:function pad2(value) {
1835:function getNextVariantIndex(sizeId) {
1842:function getShapeVariantLabel(shape) {
1847:function populateCreationForms() {
1856:function renderBasicSelect(select, items, getValue, getLabel, selectedValue = select?.value) {
1868:function renderPieceShapeSelect() {
1877:function updateCreatePieceDefaultLabel() {
1891:function createVariantFromForm() {
1946:function getBaseGenerationFromForm(size) {
1970:function createDefaultAnchors(size) {
1992:function duplicateSelectedVariant() {
2024:function createCatalogPieceFromForm() {
2080:function ensureSpecProfile(familyId, sizeId, profileType) {
2107:function ensureRecipe(specProfileId, familyId, sizeId, profileType) {
2131:function refreshInstancesUsingShape(shapeId) {
2141:function rebuildInstanceGeometry(instance, catalogPiece) {
2164:function renderCatalogPieceOptions() {
2193:function getAvailableCatalogPieces() {
2205:function normalizeAssemblyCatalogFilters(pieces) {
2218:function renderAssemblyCatalogFilters(pieces) {
2261:function renderSizeList(sizeOptions) {
2314:function getDefaultCatalogPieceForFamilySize(familyId, sizeId) {
2329:function renderFilterSelect(select, options, selectedValue, onChange) {
2342:function populateHiddenCatalogSelect(pieces) {
2362:function renderShapePalette(pieces) {
2406:function applyCatalogShapeToSelectedInstance(pieceId) {
2456:function getFilteredCatalogPieces(pieces) {
2465:function getPieceProfileType(piece) {
2469:function uniqueBy(items, keyFn) {
2481:function getSizeSortValue(sizeId) {
2487:function getShapeIconSvg(shape) {
2499:function getShapeIconType(shape) {
2514:function getVariantSortKey(catalogPiece) {
2520:function escapeHtml(value) {
2529:function renderCatalogEditors() {
2560:function renderShapeEditor(shape) {
2675:function getShapeBaseTypeValue(shape) {
2685:function getGenerationFromBaseType(sizeId, baseType) {
2713:function renderSpecEditor(spec) {
2770:function renderRecipeEditor(recipe) {
2836:function setNestedValue(target, path, value) {
2847:function labelBlock(labelText, element) {
2856:function renderValidationReport() {
2869:function validateCatalog() {
2909:function exportCatalog() {
2914:function exportBlueprint() {
2938:function round3(value) {
2942:function downloadJson(filename, payload) {
2951:async function init() {
2971:function bindEvents() {
```

## src/editor.js
```text
119:function mapById(items = []) {
123:function rebuildRepo() {
134:function getSize(id) { return state.repo?.sizes.get(id) ?? null; }
135:function getFamily(id) { return state.repo?.families.get(id) ?? null; }
136:function getShape(id) { return state.repo?.shapes.get(id) ?? null; }
137:function getSpec(id) { return state.repo?.specs.get(id) ?? null; }
138:function getRecipe(id) { return state.repo?.recipes.get(id) ?? null; }
139:function getPiece(id) { return state.repo?.pieces.get(id) ?? null; }
140:function selectedShape() { return getShape(state.selectedShapeId); }
141:function selectedPiece() { return getPiece(state.selectedCatalogPieceId); }
143:function slugifyId(value) {
153:function uniqueId(base, existingIds) {
160:function pad2(value) {
164:function getBaseGroups() {
174:function renderBaseModels() {
257:function selectBaseModel(group, sizeId, options = {}) {
277:function findShapesForSize(sizeId = state.selectedBase?.size_id) {
283:function findCatalogPiecesForBase() {
290:function renderShapeSelect() {
302:function renderCatalogPieceSelect() {
314:function renderSelectedBaseSummary() {
330:function fullCells(size) {
344:function getShapeCells(shape, size = getSize(shape?.size_id)) {
350:function normalizeCells(cells, size) {
368:function isParametricShape(shape) {
372:function ensureVoxelGeneration(shape) {
401:function operationsFromLegacyShape(legacyShape, size) {
437:function normalizeSideName(side) {
448:function createSideOperation(type, side, size, options = {}) {
478:function sideToRepresentativeCell(side, d) {
486:function markShapeDirty(shape, reason = 'edit') {
496:function cellKey(x, y, z) { return `${x}:${y}:${z}`; }
498:function setCell(enabled) {
517:function isCellInside(size, x, y, z) {
522:function resetFullBox() {
531:function clearCells() {
540:function createDefaultAnchors(size) {
562:function getVariantTypeLabel(type) {
571:function createGenerationForVariantType(type, size) {
596:function getCurrentNewVariantType() {
600:function createVariantFromBase() {
634:function getNextVariantIndex(sizeId) {
641:function duplicateVariant() {
659:function deleteVariant() {
675:function ensureSpecProfile(familyId, sizeId, profileType = 'standard') {
699:function ensureRecipe(spec, familyId, sizeId, profileType = 'standard') {
718:function createCatalogPiece() {
754:function deleteCatalogPiece() {
764:function renderShapeForm() {
782:function updateShapeIdentity() {
793:function renderOperations() {
807:function describeShapeOperation(op) {
816:function faceOperationKey(cell, face, type = '') {
821:function operationMatchesSelectedFace(op, selectedFace = state.selectedFace) {
828:function deriveFaceOperationScope(selectedFace, size) {
906:function operationScopeKey(op) {
916:function createOperationFromSelectedFace(type) {
956:function removeFaceOperation() {
981:function renderVariantFaceSummary() {
1000:function renderAnchors() {
1017:function getNormalForFace(face) {
1028:function anchorPositionForCellFace(cell, face) {
1042:function anchorFaceKey(cell, face) {
1047:function anchorMatchesSelectedFace(anchor, selectedFace = state.selectedFace) {
1059:function renderSelectedFaceSummary() {
1076:function addAnchor() {
1116:function deleteAnchor() {
1135:function fillAnchorForm(anchorId) {
1152:function getSpecsForSelectedBase() {
1159:function getRecipesForSelectedBase() {
1166:function ensureBaseSpecAndRecipe() {
1173:function renderSpecProfileSelect() {
1187:function renderSpecEditor() {
1227:function renderRecipeSelect() {
1241:function renderRecipeEditor() {
1294:function renderModalContexts() {
1302:function openSpecModal() {
1310:function closeSpecModal() {
1315:function openRecipeModal() {
1323:function closeRecipeModal() {
1329:function getNested(target, path) {
1333:function setNested(target, path, value) {
1344:function renderPreview() {
1399:function renderCellPickProxies(cells, size) {
1416:function getSuppressedCellKeysForOperations(operations, size) {
1426:function getOperationAffectedCells(op, size) {
1459:function renderVoxelGuide(cells, size) {
1469:function createParametricShapeMesh(shape, size) {
1478:function getParametricFootprint(dim, type) {
1511:function getParametricPrismMesh(dim, type, scale) {
1530:function renderOperationSolids(shape, size) {
1539:function createOperationSolidMesh(op, size) {
1552:function createOperationMaterial() {
1561:function createOperationEdgeMaterial(op) {
1569:function meshWithEdges(geometry, material, edgeMaterial) {
1578:function createCornerRoundMesh(op, size) {
1593:function createCornerChamferMesh(op, size) {
1603:function pathToShape(points) {
1624:function roundedCornerPath(xSide, ySide, d, radius = 1) {
1651:function chamferCornerPath(xSide, ySide, d, amount = 0.5) {
1666:function pt(x, y, d) { return { x, y, d }; }
1667:function arc(cx, cy, radius, start, end, clockwise, d) { return { arc: { cx, cy, radius, start, end, clockwise, d } }; }
1669:function getCornerSides(op, d) {
1679:function createRoundRailMesh(op, size) {
1683:function createChamferRailMesh(op, size) {
1687:function createEdgeProfileMesh(op, size, mode) {
1719:function roundedSideProfile(side, face, a0, a1, z0, z1, radius = 1) {
1742:function chamferSideProfile(side, face, a0, a1, z0, z1, amount = 0.5) {
1760:function extrudeProfileAlongX(profile, xMin, xMax, d) {
1777:function extrudeProfileAlongY(profile, yMin, yMax, d) {
1795:function sampleProfile(profile) {
1815:function buildPrismIndices(indices, n) {
1829:function createSlopePreviewMesh(op, size) {
1836:function worldX(x, d) { return (x - d.length / 2) * CELL_SCALE; }
1837:function worldY(y, d) { return (y - d.width / 2) * CELL_SCALE; }
1838:function worldZ(z, d) { return (z - d.height / 2) * CELL_SCALE; }
1840:function cellCenterToWorld(cell, size) {
1844:function anchorToWorld(anchor, size) {
1848:function selectedFaceToWorld(size, selectedFace = state.selectedFace) {
1854:function catalogNormalToWorld(normal) {
1858:function renderSelectedFaceHint(size) {
1878:function catalogPositionToWorld(position, size) {
1884:function fitPreview(renderNow = true) {
1901:function resetPreview() {
1907:function renderStats() {
1926:function renderValidationReport() {
1948:function validateCatalog() {
1985:function validateSelectedShape() {
2014:function getCatalogFileName(suffix = '') {
2019:function downloadCatalogFile(filename = getCatalogFileName()) {
2031:async function writeCatalogToProjectFile() {
2046:function saveDraft() {
2057:async function publishCatalogToAssembly() {
2076:function controlSelectedShape() {
2092:function validateSelectedShapeStatus() {
2108:function renderAll(redrawPreview = true) {
2125:function setMessage(message) {
2131:function downloadJson(filename, payload) {
2140:function exportCatalog() {
2144:function faceFromIntersection(intersection) {
2156:function pickVoxelFace(event) {
2182:function bindFacePicking() {
2196:function bindEvents() {
2260:function migrateLegacyShapesForEditor() {
2266:function resize() {
2278:function animate() {
2285:async function init() {
```

## src/shape-engine.js
```text
3:export function buildShapeGeometry({ shape, size, scale = 100, symmetry = {}, showVoxels = false, renderMode = null } = {}) {
33:export function applySymmetryToGeometry(geometry, symmetry = {}) {
70:export function geometryFromIndexedMesh(vertices, faces) {
80:export function getBoxMesh(size, scale) {
100:export function getWedgeMesh(size, scale, base = {}) {
135:export function getParametricPrismMesh(dim, type, scale, base = {}) {
152:export function getParametricFootprint(dim, type, base = {}) {
189:function buildLegacyAssemblyGeometry(shape, dim, scale) {
220:function buildVoxelOperationGeometry(shape, dim, scale, options = {}) {
240:function buildAssemblySolidGeometry(shape, dim, scale) {
254:function getShapeCells(shape, dim) {
266:function createCellGeometry(cell, dim, scale, options = {}) {
273:function createOperationGeometry(op, dim, scale) {
285:function createCornerRoundGeometry(op, dim, scale) {
301:function createCornerChamferGeometry(op, dim, scale) {
316:function pathToShape(points, dim, scale) {
339:function roundedCornerPath(xSide, ySide, d, radius = 1) {
348:function chamferCornerPath(xSide, ySide, d, amount = 0.5) {
357:function pt(x, y) { return { x, y }; }
358:function arc(cx, cy, radius, start, end, clockwise) { return { arc: { cx, cy, radius, start, end, clockwise } }; }
360:function getCornerSides(op, d) {
370:function createEdgeProfileGeometry(op, dim, scale, mode) {
398:function roundedSideProfile(side, face, a0, a1, z0, z1, radius = 1) {
413:function chamferSideProfile(side, face, a0, a1, z0, z1, amount = 0.5) {
431:function extrudeProfileAlongX(profile, xMin, xMax, dim, scale) {
442:function extrudeProfileAlongY(profile, yMin, yMax, dim, scale) {
453:function sampleProfile(profile) {
474:function buildPrismIndices(indices, n) {
483:function geometryFromFlatPositions(positions, indices) {
493:function mergeGeometries(geometries) {
515:function getSuppressedCellKeysForOperations(operations, dim) {
523:function getOperationAffectedCells(op, dim) {
553:function normalizeCells(cells, dim) {
559:function isCellInside(dim, x, y, z) {
563:function cellKey(x, y, z) { return `${x}:${y}:${z}`; }
564:export function catalogPointVector(position, dim, scale = 100) {
573:export function catalogCellCenterVector(cell, dim, scale = 100) {
581:export function createCatalogReservationBox(sizeOrDimensions, scale = 100, position = new THREE.Vector3()) {
592:function catalogPoint(xLength, yWidth, zHeight, dim, scale) {
600:function worldLength(x, dim, scale) { return (x - (Number(dim.length) || 1) / 2) * scale; }
601:function worldWidth(y, dim, scale) { return (y - (Number(dim.width) || 1) / 2) * scale; }
602:function worldHeight(z, dim, scale) { return (z - (Number(dim.height) || 1) / 2) * scale; }
603:function worldZ(z, dim, scale) { return worldHeight(z, dim, scale); }
```
