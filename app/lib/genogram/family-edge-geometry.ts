export interface FamilyRootSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FamilyRootGeometry {
  startX: number;
  endX: number;
  originX: number;
  segments: FamilyRootSegment[];
}

interface FamilyDropTargetCandidate {
  id: string;
  left: number;
  right: number;
  y: number;
}

interface FindFamilyOriginDropTargetOptions<T extends FamilyDropTargetCandidate> {
  targets: readonly T[];
  pointerX: number;
  pointerY: number;
  currentFamilyId: string;
  stickyTargetId?: string;
}

interface CreateFamilyRootGeometryOptions {
  parentLineY: number;
  originX: number;
  anchorXs: number[];
  verticalEndY: number;
}

export function clampFamilyOriginX(parentLeftX: number, parentRightX: number, requestedX: number): number {
  const left = Math.min(parentLeftX, parentRightX);
  const right = Math.max(parentLeftX, parentRightX);
  return Math.max(left, Math.min(right, requestedX));
}

export function createFamilyRootGeometry({
  parentLineY,
  originX,
  anchorXs,
  verticalEndY,
}: CreateFamilyRootGeometryOptions): FamilyRootGeometry {
  if (anchorXs.length === 0) throw new Error('Family root geometry requires at least one child anchor.');

  const startX = Math.min(originX, ...anchorXs);
  const endX = Math.max(originX, ...anchorXs);
  const segments: FamilyRootSegment[] = [
    { x1: originX, y1: parentLineY, x2: originX, y2: verticalEndY },
  ];

  // Moving a child never moves or extends the parent-line origin. The child
  // branch reaches the icon from the saved origin at its own adjustable Y.
  if (endX - startX > 0.01) {
    segments.push({ x1: startX, y1: verticalEndY, x2: endX, y2: verticalEndY });
  }

  return { startX, endX, originX, segments };
}

export function familyBranchHorizontalStartX(originX: number, anchorX: number, anchorXs: readonly number[]): number {
  const epsilon = 0.01;
  if (anchorX > originX + epsilon) {
    return Math.max(originX, ...anchorXs.filter((value) => value < anchorX - epsilon && value >= originX - epsilon));
  }
  if (anchorX < originX - epsilon) {
    return Math.min(originX, ...anchorXs.filter((value) => value > anchorX + epsilon && value <= originX + epsilon));
  }
  return anchorX;
}

export function findFamilyOriginDropTarget<T extends FamilyDropTargetCandidate>({
  targets,
  pointerX,
  pointerY,
  currentFamilyId,
  stickyTargetId,
}: FindFamilyOriginDropTargetOptions<T>): T | null {
  const eligibleTargets = targets.filter((target) => target.id !== currentFamilyId);
  const candidate = eligibleTargets
    .map((target) => {
      const horizontalDistance = pointerX < target.left ? target.left - pointerX : pointerX > target.right ? pointerX - target.right : 0;
      const verticalDistance = Math.abs(pointerY - target.y);
      return { target, horizontalDistance, verticalDistance, score: horizontalDistance + verticalDistance * 2 };
    })
    .filter(({ horizontalDistance, verticalDistance }) => horizontalDistance <= 64 && verticalDistance <= 44)
    .sort((left, right) => left.score - right.score)[0];

  if (candidate) return candidate.target;

  const stickyTarget = eligibleTargets.find((target) => target.id === stickyTargetId);
  return stickyTarget && Math.abs(pointerY - stickyTarget.y) <= 44 ? stickyTarget : null;
}
