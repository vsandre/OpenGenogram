import assert from 'node:assert/strict';
import test from 'node:test';

import { clampFamilyOriginX, createFamilyRootGeometry, familyBranchHorizontalStartX, findFamilyOriginDropTarget } from '../../app/lib/genogram/family-edge-geometry';

test('a child inside the parent span has only one vertical root segment', () => {
  const geometry = createFamilyRootGeometry({
    parentLineY: 356,
    originX: 330,
    anchorXs: [330],
    verticalEndY: 460,
  });

  assert.deepEqual(geometry.segments, [
    { x1: 330, y1: 356, x2: 330, y2: 460 },
  ]);
});

test('moving a child keeps the parent-line origin and adds a branch toward the child', () => {
  const geometry = createFamilyRootGeometry({
    parentLineY: 356,
    originX: 330,
    anchorXs: [1150],
    verticalEndY: 460,
  });

  assert.equal(geometry.originX, 330);
  assert.deepEqual(geometry.segments, [
    { x1: 330, y1: 356, x2: 330, y2: 460 },
    { x1: 330, y1: 460, x2: 1150, y2: 460 },
  ]);
});

test('a child owns only the horizontal segment after the preceding family anchor', () => {
  const anchors = [509, 773];

  assert.equal(familyBranchHorizontalStartX(421, 773, anchors), 509);
  assert.equal(familyBranchHorizontalStartX(421, 509, anchors), 421);
  assert.equal(familyBranchHorizontalStartX(421, 421, [421, 509, 773]), 421);
});

test('the family origin cannot be dragged beyond the parents horizontal line', () => {
  assert.equal(clampFamilyOriginX(220, 440, 120), 220);
  assert.equal(clampFamilyOriginX(220, 440, 330), 330);
  assert.equal(clampFamilyOriginX(220, 440, 620), 440);
});

test('the child line origin targets another parents line only when dragged near it', () => {
  const target = {
    id: 'target-family',
    parentIds: ['parent-a', 'parent-b'],
    left: 640,
    right: 860,
    y: 425,
  };

  assert.equal(findFamilyOriginDropTarget({
    targets: [target],
    pointerX: 780,
    pointerY: 438,
    currentFamilyId: 'current-family',
  })?.id, target.id);

  assert.equal(findFamilyOriginDropTarget({
    targets: [target],
    pointerX: 1100,
    pointerY: 425,
    currentFamilyId: 'current-family',
  }), null);

  assert.equal(findFamilyOriginDropTarget({
    targets: [target],
    pointerX: 1100,
    pointerY: 425,
    currentFamilyId: 'current-family',
    stickyTargetId: target.id,
  })?.id, target.id);

  assert.equal(findFamilyOriginDropTarget({
    targets: [target],
    pointerX: 780,
    pointerY: 425,
    currentFamilyId: target.id,
  }), null);
});
