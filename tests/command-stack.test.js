import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommandStack } from '../src/history/command-stack.js';
import { createMoveCommand } from '../src/history/commands/move-command.js';

test('command stack defaults to limit 10', () => {
  const stack = createCommandStack();
  assert.equal(stack.limit, 10);
});

test('undo restores previous state and redo reapplies next state', () => {
  let value = 0;
  const stack = createCommandStack();
  const command = createMoveCommand({
    affectedIds: ['piece_1'],
    before: [{ id: 'piece_1', type: 'piece', position: { x: 0, y: 0, z: 0 } }],
    after: [{ id: 'piece_1', type: 'piece', position: { x: 1, y: 0, z: 0 } }],
    applySnapshot(snapshot) {
      value = snapshot[0].position.x;
    },
  });

  value = 1;
  stack.push(command);

  assert.equal(stack.undo(), true);
  assert.equal(value, 0);
  assert.equal(stack.redo(), true);
  assert.equal(value, 1);
});

test('new command after undo clears redo stack', () => {
  const stack = createCommandStack();
  const calls = [];
  const commandA = {
    do() { calls.push('A:do'); },
    undo() { calls.push('A:undo'); },
    redo() { calls.push('A:redo'); },
  };
  const commandB = {
    do() { calls.push('B:do'); },
    undo() { calls.push('B:undo'); },
    redo() { calls.push('B:redo'); },
  };

  stack.execute(commandA);
  stack.undo();
  stack.execute(commandB);

  assert.equal(stack.canRedo(), false);
  assert.deepEqual(calls, ['A:do', 'A:undo', 'B:do']);
});
