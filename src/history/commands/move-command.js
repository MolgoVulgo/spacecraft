export function createMoveCommand({ label = 'Move selection', affectedIds = [], before, after, applySnapshot }) {
  return {
    label,
    affectedIds: [...affectedIds],
    before,
    after,
    do() {
      applySnapshot(after);
    },
    undo() {
      applySnapshot(before);
    },
    redo() {
      applySnapshot(after);
    },
  };
}
