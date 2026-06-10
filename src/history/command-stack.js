export function createCommandStack(options = {}) {
  let limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
  const undoStack = [];
  const redoStack = [];

  function trimUndoStack() {
    while (undoStack.length > limit) undoStack.shift();
  }

  function push(command) {
    if (!command) return false;
    undoStack.push(command);
    trimUndoStack();
    redoStack.length = 0;
    return true;
  }

  function execute(command) {
    if (!command?.do) return false;
    command.do();
    return push(command);
  }

  function setLimit(nextLimit) {
    if (!Number.isInteger(nextLimit) || nextLimit <= 0) return limit;
    limit = nextLimit;
    trimUndoStack();
    while (redoStack.length > limit) redoStack.shift();
    return limit;
  }

  function undo() {
    const command = undoStack.pop();
    if (!command?.undo) return false;
    command.undo();
    redoStack.push(command);
    return true;
  }

  function redo() {
    const command = redoStack.pop();
    if (!command?.redo) return false;
    command.redo();
    undoStack.push(command);
    trimUndoStack();
    return true;
  }

  return {
    limit,
    execute,
    setLimit,
    push,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    getState() {
      return {
        limit,
        undoDepth: undoStack.length,
        redoDepth: redoStack.length,
      };
    },
  };
}
