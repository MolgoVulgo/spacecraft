export function getRenderableEditorAnchors(shape) {
  return (shape?.anchors ?? []).filter((anchor) => anchor.enabled !== false);
}
