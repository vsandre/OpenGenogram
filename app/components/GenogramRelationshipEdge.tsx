'use client';

import { BaseEdge, EdgeLabelRenderer, getStraightPath, useReactFlow, ViewportPortal, type EdgeProps } from '@xyflow/react';
import { MoveVertical, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

import { getRelationshipDefinition, type Person } from '../lib/genogram/model';
import { DEFAULT_PARTNER_LINE_OFFSET, SIBLING_LINE_OFFSET, personSymbolAnchorOffsets, personSymbolBoundsOffsets, type RelationshipFlowEdge } from '../lib/genogram/flow-adapter';
import { useGenogramStore } from '../lib/genogram/store';
import styles from './GenogramEditor.module.css';

const INK = '#000000';
const SELECTED = 'var(--accent)';
const SYMBOL_ENDPOINT_OVERLAP = 10;
type Point = { x: number; y: number };
type ControlPoint = { t: number; offset: number };

function f(value: number): string { return value.toFixed(2); }

function vector(source: Point, target: Point) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  return { dx: dx / length, dy: dy / length, nx: -dy / length, ny: dx / length, length };
}

function line(source: Point, target: Point, offset = 0): string {
  const { nx, ny } = vector(source, target);
  return `M ${f(source.x + nx * offset)} ${f(source.y + ny * offset)} L ${f(target.x + nx * offset)} ${f(target.y + ny * offset)}`;
}

function controlPointFromCanvas(point: Point, source: Point, target: Point): ControlPoint {
  const { dx, dy, nx, ny, length } = vector(source, target);
  const relativeX = point.x - source.x;
  const relativeY = point.y - source.y;
  return {
    t: Math.max(0.06, Math.min(0.94, (relativeX * dx + relativeY * dy) / length)),
    offset: Math.max(-260, Math.min(260, relativeX * nx + relativeY * ny)),
  };
}

function canvasPointFromControl(control: ControlPoint, source: Point, target: Point): Point {
  const { dx, dy, nx, ny, length } = vector(source, target);
  return {
    x: source.x + dx * length * control.t + nx * control.offset,
    y: source.y + dy * length * control.t + ny * control.offset,
  };
}

function dragDelta(clientDelta: number, zoom: number): number {
  return clientDelta / zoom;
}

function readControlPoints(value: unknown): ControlPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.t !== 'number' || typeof record.offset !== 'number' || !Number.isFinite(record.t) || !Number.isFinite(record.offset)) return [];
    return [{ t: Math.max(0.06, Math.min(0.94, record.t)), offset: Math.max(-260, Math.min(260, record.offset)) }];
  }).sort((a, b) => a.t - b.t);
}

function polyline(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${f(point.x)} ${f(point.y)}`).join(' ');
}

function offsetPolyline(points: Point[], offset: number): string {
  const shifted = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const { nx, ny } = vector(previous, next);
    return { x: point.x + nx * offset, y: point.y + ny * offset };
  });
  return polyline(shifted);
}

function zigzagPolyline(points: Point[], spacing = 30, amplitude = 6): string {
  return points.slice(0, -1).map((point, index) => zigzag(point, points[index + 1], spacing, amplitude)).join(' ');
}

function zigzag(source: Point, target: Point, spacing = 30, amplitude = 6): string {
  const { dx, dy, nx, ny, length } = vector(source, target);
  const segments = Math.max(5, Math.min(40, Math.round(length / spacing)));
  const points = [`M ${f(source.x)} ${f(source.y)}`];
  for (let index = 1; index < segments; index += 1) {
    const progress = index / segments;
    const offset = (index % 2 === 0 ? -1 : 1) * amplitude;
    points.push(`L ${f(source.x + dx * length * progress + nx * offset)} ${f(source.y + dy * length * progress + ny * offset)}`);
  }
  points.push(`L ${f(target.x)} ${f(target.y)}`);
  return points.join(' ');
}

function directedZigzagPolyline(points: Point[], arrowAtStart: boolean, spacing = 30, amplitude = 6): string {
  if (points.length < 2) return polyline(points);
  if (arrowAtStart) {
    const arrow = points[0];
    const next = points[1];
    const { dx, dy, length } = vector(arrow, next);
    const straightLength = Math.min(14, length / 3);
    const joint = { x: arrow.x + dx * straightLength, y: arrow.y + dy * straightLength };
    return `${line(arrow, joint)} ${zigzagPolyline([joint, ...points.slice(1)], spacing, amplitude)}`;
  }
  const previous = points[points.length - 2];
  const arrow = points[points.length - 1];
  const { dx, dy, length } = vector(previous, arrow);
  const straightLength = Math.min(14, length / 3);
  const joint = { x: arrow.x - dx * straightLength, y: arrow.y - dy * straightLength };
  return `${zigzagPolyline([...points.slice(0, -1), joint], spacing, amplitude)} L ${f(arrow.x)} ${f(arrow.y)}`;
}

function pointBetween(source: Point, target: Point, progress: number): Point {
  return { x: source.x + (target.x - source.x) * progress, y: source.y + (target.y - source.y) * progress };
}

function pointOnPolyline(points: Point[], progress: number): { point: Point; source: Point; target: Point } {
  if (points.length < 2) {
    const point = points[0] ?? { x: 0, y: 0 };
    return { point, source: point, target: point };
  }
  const lengths = points.slice(0, -1).map((point, index) => vector(point, points[index + 1]).length);
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let distance = totalLength * Math.max(0, Math.min(1, progress));
  for (let index = 0; index < lengths.length; index += 1) {
    const source = points[index];
    const target = points[index + 1];
    if (distance <= lengths[index] || index === lengths.length - 1) {
      return { point: pointBetween(source, target, lengths[index] === 0 ? 0 : distance / lengths[index]), source, target };
    }
    distance -= lengths[index];
  }
  return { point: points[points.length - 1], source: points[points.length - 2], target: points[points.length - 1] };
}

function splitPolyline(points: Point[], progress: number): { before: Point[]; after: Point[]; point: Point } {
  const split = pointOnPolyline(points, progress);
  const segmentIndex = Math.max(0, points.findIndex((point, index) => point === split.source && points[index + 1] === split.target));
  return {
    before: [...points.slice(0, segmentIndex + 1), split.point],
    after: [split.point, ...points.slice(segmentIndex + 1)],
    point: split.point,
  };
}

function pointAlongPolyline( points: Point[], progress = 0.5, maxDistance = 25): { x: number; y: number } {
  const { point, source, target } = pointOnPolyline(points, progress);
  // vector of Polyline segment
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  // Calculate slope (0 = horizontal, 1 = vertical)
  const slope = Math.abs(dy) / length;
  // Distance along the line based on slope
  // Horizontal (slope ≈ 0): alongDistance = 0
  // Vertical (slope ≈ 1): alongDistance = maxDistance
  const alongDistance = slope * maxDistance;
  // Determine direction: always upward (smaller Y)
  // If line goes from top-left to bottom-right, we need to go backward
  const direction = dy > 0 ? -1 : 1;
  // Normalized direction vector
  const dirX = dx / length;
  const dirY = dy / length;
  // Move point along the line upward
  return {
    x: point.x + dirX * alongDistance * direction,
    y: point.y + dirY * alongDistance * direction,
  };
}

function circleMark(point: Point, source: Point, target: Point, along = 0, radius = 6): string {
  const { dx, dy } = vector(source, target);
  const center = { x: point.x + dx * along, y: point.y + dy * along };
  return `M ${f(center.x + radius)} ${f(center.y)} A ${radius} ${radius} 0 1 0 ${f(center.x - radius)} ${f(center.y)} A ${radius} ${radius} 0 1 0 ${f(center.x + radius)} ${f(center.y)}`;
}

function diamondMark(point: Point, source: Point, target: Point, along = 0, radius = 7): string {
  const { dx, dy, nx, ny } = vector(source, target);
  const center = { x: point.x + dx * along, y: point.y + dy * along };
  return `M ${f(center.x + dx * radius)} ${f(center.y + dy * radius)} L ${f(center.x + nx * radius)} ${f(center.y + ny * radius)} L ${f(center.x - dx * radius)} ${f(center.y - dy * radius)} L ${f(center.x - nx * radius)} ${f(center.y - ny * radius)} Z`;
}

function boxMark(point: Point, source: Point, target: Point, radius = 8): string {
  const { dx, dy, nx, ny } = vector(source, target);
  const corners = [
    { x: point.x - dx * radius - nx * radius, y: point.y - dy * radius - ny * radius },
    { x: point.x + dx * radius - nx * radius, y: point.y + dy * radius - ny * radius },
    { x: point.x + dx * radius + nx * radius, y: point.y + dy * radius + ny * radius },
    { x: point.x - dx * radius + nx * radius, y: point.y - dy * radius + ny * radius },
  ];
  return `${polyline([...corners, corners[0]])} ${crossMark(point, source, target).join(' ')}`;
}

function mark(point: Point, source: Point, target: Point, along = 0): string {
  const { dx, dy, nx, ny } = vector(source, target);
  const center = { x: point.x + dx * along, y: point.y + dy * along };
  const slashX = (dx + nx) / Math.SQRT2;
  const slashY = (dy + ny) / Math.SQRT2;
  return `M ${f(center.x - slashX * 7)} ${f(center.y - slashY * 7)} L ${f(center.x + slashX * 7)} ${f(center.y + slashY * 7)}`;
}

function bar(point: Point, source: Point, target: Point, along: number): string {
  const { dx, dy, nx, ny } = vector(source, target);
  const center = { x: point.x + dx * along, y: point.y + dy * along };
  return `M ${f(center.x - nx * 8)} ${f(center.y - ny * 8)} L ${f(center.x + nx * 8)} ${f(center.y + ny * 8)}`;
}

function crossMark(point: Point, source: Point, target: Point): string[] {
  const { dx, dy, nx, ny } = vector(source, target);
  const firstX = (dx + nx) / Math.SQRT2;
  const firstY = (dy + ny) / Math.SQRT2;
  const secondX = (dx - nx) / Math.SQRT2;
  const secondY = (dy - ny) / Math.SQRT2;
  return [
    `M ${f(point.x - firstX * 6)} ${f(point.y - firstY * 6)} L ${f(point.x + firstX * 6)} ${f(point.y + firstY * 6)}`,
    `M ${f(point.x - secondX * 6)} ${f(point.y - secondY * 6)} L ${f(point.x + secondX * 6)} ${f(point.y + secondY * 6)}`,
  ];
}

function partnerPath(source: Point, target: Point, offset: number) {
  const y = Math.max(source.y, target.y) + offset;
  return { path: `M ${f(source.x)} ${f(source.y - SYMBOL_ENDPOINT_OVERLAP)} L ${f(source.x)} ${f(y)} L ${f(target.x)} ${f(y)} L ${f(target.x)} ${f(target.y - SYMBOL_ENDPOINT_OVERLAP)}`, markPoint: { x: (source.x + target.x) / 2, y } };
}

function childPath(source: Point, target: Point) {
  const y = source.y + Math.max(24, (target.y - source.y) * 0.45);
  return `M ${f(source.x)} ${f(source.y)} L ${f(source.x)} ${f(y)} L ${f(target.x)} ${f(y)} L ${f(target.x)} ${f(target.y)}`;
}

function siblingPath(source: Point, target: Point, offset: number) {
  const y = Math.min(source.y, target.y) - offset;
  return {
    path: `M ${f(source.x)} ${f(source.y)} L ${f(source.x)} ${f(y)} L ${f(target.x)} ${f(y)} L ${f(target.x)} ${f(target.y)}`,
    markPoint: { x: (source.x + target.x) / 2, y },
  };
}

function targetSymbolEntryDistance(person: Person | undefined, source: Point, target: Point): number {
  if (!person) return 22;
  const anchors = personSymbolAnchorOffsets(person);
  const bounds = personSymbolBoundsOffsets(person);
  const center = { x: (anchors.left + anchors.right) / 2, y: (anchors.top + anchors.bottom) / 2 };
  const { dx, dy } = vector(source, target);
  const backwardX = -dx;
  const backwardY = -dy;
  const xDistance = Math.abs(backwardX) < 0.001
    ? Number.POSITIVE_INFINITY
    : (backwardX < 0 ? center.x - bounds.left : bounds.right - center.x) / Math.abs(backwardX);
  const yDistance = Math.abs(backwardY) < 0.001
    ? Number.POSITIVE_INFINITY
    : (backwardY < 0 ? center.y - bounds.top : bounds.bottom - center.y) / Math.abs(backwardY);
  return Math.max(8, Math.min(64, xDistance, yDistance));
}

function twinPaths(kind: 'twin-fraternal' | 'twin-identical', source: Point, target: Point) {
  const split = { x: (source.x + target.x) / 2, y: Math.min(source.y, target.y) - 42 };
  const main = `M ${f(split.x)} ${f(split.y)} L ${f(source.x)} ${f(source.y)} M ${f(split.x)} ${f(split.y)} L ${f(target.x)} ${f(target.y)}`;
  if (kind === 'twin-fraternal') return { main, extras: [] };
  const progress = 0.62;
  const first = { x: split.x + (source.x - split.x) * progress, y: split.y + (source.y - split.y) * progress };
  const second = { x: split.x + (target.x - split.x) * progress, y: split.y + (target.y - split.y) * progress };
  return { main, extras: [line(first, second)] };
}

export function GenogramRelationshipEdge(props: EdgeProps<RelationshipFlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, data, selected, interactionWidth } = props;
  const relationship = data?.relationship;
  const { getZoom, screenToFlowPosition } = useReactFlow();
  const updateRelationship = useGenogramStore((state) => state.updateRelationship);
  const directedEndpointPerson = useGenogramStore((state) => {
    const current = data?.relationship;
    if (!current) return undefined;
    const endpointId = current.attributes.directionReversed === true ? current.source : current.target;
    return state.project.people.find((person) => person.id === endpointId);
  });
  const [draftOffset, setDraftOffset] = useState<number | null>(null);
  const [draftControlPoints, setDraftControlPoints] = useState<ControlPoint[] | null>(null);
  const [selectedControlIndex, setSelectedControlIndex] = useState<number | null>(null);
  const draftOffsetRef = useRef<number | null>(null);
  const draftControlPointsRef = useRef<ControlPoint[] | null>(null);
  const drag = useRef<{ pointerId: number; clientY: number; offset: number } | null>(null);
  const controlDrag = useRef<{ pointerId: number; index: number } | null>(null);
  const removeDragListeners = useRef<(() => void) | null>(null);
  useEffect(() => () => removeDragListeners.current?.(), []);
  if (!relationship) return null;
  const definition = getRelationshipDefinition(relationship.type);
  const kind = definition.lineKind;
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };
  const savedControlPoints = readControlPoints(relationship.attributes.controlPoints);
  const controlPoints = draftControlPoints ?? savedControlPoints;
  const emotionalPoints = [source, ...controlPoints.map((control) => canvasPointFromControl(control, source, target)), target];
  const usesArrow = definition.category === 'emotional' && definition.directed;
  const directionReversed = relationship.attributes.directionReversed === true;
  const arrowEndpoint = directionReversed ? source : target;
  const arrowOrigin = directionReversed
    ? emotionalPoints[Math.min(1, emotionalPoints.length - 1)]
    : emotionalPoints[Math.max(0, emotionalPoints.length - 2)];
  const arrowAngle = Math.atan2(arrowEndpoint.y - arrowOrigin.y, arrowEndpoint.x - arrowOrigin.x) * 180 / Math.PI;
  const targetEntryDistance = targetSymbolEntryDistance(directedEndpointPerson, arrowOrigin, arrowEndpoint);
  const arrowDirection = vector(arrowOrigin, arrowEndpoint);
  const arrowTarget = {
    x: arrowEndpoint.x - arrowDirection.dx * (targetEntryDistance + 2),
    y: arrowEndpoint.y - arrowDirection.dy * (targetEntryDistance + 2),
  };
  const renderedEmotionalPoints = usesArrow
    ? directionReversed
      ? [arrowTarget, ...emotionalPoints.slice(1)]
      : [...emotionalPoints.slice(0, -1), arrowTarget]
    : emotionalPoints;
  const visibleSourceEndpoint = usesArrow && directionReversed ? arrowTarget : source;
  const visibleTargetEndpoint = usesArrow && !directionReversed ? arrowTarget : target;
  const [straightPath, straightLabelX, straightLabelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const storedOffset = relationship.attributes.lineOffset;
  const defaultLineOffset = kind === 'sibling' ? SIBLING_LINE_OFFSET : DEFAULT_PARTNER_LINE_OFFSET;
  const savedLineOffset = typeof storedOffset === 'number' && Number.isFinite(storedOffset)
    ? Math.max(12, Math.min(240, storedOffset))
    : defaultLineOffset;
  const lineOffset = draftOffset ?? savedLineOffset;
  const partner = definition.category === 'partner' ? partnerPath(source, target, lineOffset) : null;
  const sibling = kind === 'sibling' ? siblingPath(source, target, lineOffset) : null;
  const adjustableLine = partner ?? sibling;
  const midpoint = adjustableLine?.markPoint ?? { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
  let main = partner?.path ?? straightPath;
  let extras: string[] = [];
  let patternExtras: Array<{ path: string; color?: string; dash?: string }> = [];
  let dash: string | undefined;

  if (kind === 'child-solid' || kind === 'child-dashed' || kind === 'child-dotted' || kind === 'child-step' || kind === 'child-surrogate' || kind === 'child-donor') main = childPath(source, target);
  if (sibling) main = sibling.path;
  if (kind === 'child-dashed' || kind === 'long-dashed') dash = '8 6';
  if (kind === 'child-dotted' || kind === 'dotted' || kind === 'affair-separation' || kind === 'affair-divorce' || kind === 'affair-married' || kind === 'unknown') dash = '2 6';
  if (kind === 'child-step') dash = '10 5 2 5';
  if (kind === 'child-surrogate') dash = '5 5';
  if (kind === 'child-donor') dash = '3 3';
  if (kind === 'dashed' || kind === 'separation-dashed') dash = '4 8';
  if (kind === 'sparse-dotted') dash = '1 10';
  if (definition.category === 'emotional') main = polyline(renderedEmotionalPoints);
  if (kind === 'double') { main = offsetPolyline(renderedEmotionalPoints, -4); extras = [offsetPolyline(renderedEmotionalPoints, 4)]; }
  if (kind === 'triple') { main = polyline(renderedEmotionalPoints); extras = [offsetPolyline(renderedEmotionalPoints, -6), offsetPolyline(renderedEmotionalPoints, 6)]; }
  if (kind === 'zigzag' || kind === 'abuse') main = usesArrow ? directedZigzagPolyline(renderedEmotionalPoints, directionReversed) : zigzagPolyline(renderedEmotionalPoints);
  if (kind === 'fused-conflict') { main = zigzagPolyline(renderedEmotionalPoints); extras = [offsetPolyline(renderedEmotionalPoints, -7), offsetPolyline(renderedEmotionalPoints, 7)]; }
  if (kind === 'separation') extras = [mark(midpoint, { x: sourceX, y: midpoint.y }, { x: targetX, y: midpoint.y })];
  if (kind === 'separation-dashed' || kind === 'affair-separation') extras = [mark(midpoint, { x: sourceX, y: midpoint.y }, { x: targetX, y: midpoint.y })];
  if (kind === 'divorce') extras = [mark(midpoint, { x: sourceX, y: midpoint.y }, { x: targetX, y: midpoint.y }, -6), mark(midpoint, { x: sourceX, y: midpoint.y }, { x: targetX, y: midpoint.y }, 6)];
  if (kind === 'affair-divorce') extras = [mark(midpoint, { x: sourceX, y: midpoint.y }, { x: targetX, y: midpoint.y }, -6), mark(midpoint, { x: sourceX, y: midpoint.y }, { x: targetX, y: midpoint.y }, 6)];
  if (kind === 'annulment') extras = [...crossMark(midpoint, source, target), mark(midpoint, { x: sourceX, y: midpoint.y }, { x: targetX, y: midpoint.y }, -11), mark(midpoint, { x: sourceX, y: midpoint.y }, { x: targetX, y: midpoint.y }, 11)];
  if (kind === 'widowed') extras = crossMark(midpoint, source, target);
  if (kind === 'affair-married' && partner) extras = [partnerPath(source, target, lineOffset + 6).path];
  if (kind === 'cutoff') extras = [bar(midpoint, source, target, -6), bar(midpoint, source, target, 6)];
  if (kind === 'twin-fraternal' || kind === 'twin-identical') {
    const twin = twinPaths(kind, source, target);
    main = twin.main;
    extras = twin.extras;
  }

  if (definition.category === 'emotional') {
    const basePath = polyline(renderedEmotionalPoints);
    const pathCenter = pointOnPolyline(renderedEmotionalPoints, 0.5);
    const pathSplit = splitPolyline(renderedEmotionalPoints, 0.72);
    const markerPoint = pathCenter.point;
    const markerSource = pathCenter.source;
    const markerTarget = pathCenter.target;
    if (relationship.type === 'cutoff') {
      main = basePath;
      extras = [bar(markerPoint, markerSource, markerTarget, -6), bar(markerPoint, markerSource, markerTarget, 6)];
    }
    if (relationship.type === 'close-hostile') {
      main = zigzagPolyline(renderedEmotionalPoints);
      extras = [];
      patternExtras = [{ path: offsetPolyline(renderedEmotionalPoints, -7), color: '#2563eb' }, { path: offsetPolyline(renderedEmotionalPoints, 7), color: '#2563eb' }];
    }
    if (relationship.type === 'sexual-abuse') {
      main = directedZigzagPolyline(renderedEmotionalPoints, directionReversed);
      extras = [offsetPolyline(renderedEmotionalPoints, -7), offsetPolyline(renderedEmotionalPoints, 7)];
    }
    if (relationship.type === 'negative-focused') main = directedZigzagPolyline(renderedEmotionalPoints, directionReversed, 13, 5);
    if (relationship.type === 'caregiver') main = basePath;
    if (relationship.type === 'repaired-cutoff') {
      main = basePath;
      extras = [bar(markerPoint, markerSource, markerTarget, -7), circleMark(markerPoint, markerSource, markerTarget), bar(markerPoint, markerSource, markerTarget, 7)];
    }
    if (relationship.type === 'never-met') {
      main = basePath;
      dash = '2 6';
      extras = crossMark(markerPoint, markerSource, markerTarget);
    }
    if (relationship.type === 'love') {
      main = basePath;
      extras = [circleMark(markerPoint, markerSource, markerTarget)];
    }
    if (relationship.type === 'romantic-love') {
      main = basePath;
      extras = [circleMark(markerPoint, markerSource, markerTarget, -4), circleMark(markerPoint, markerSource, markerTarget, 4)];
    }
    if (relationship.type === 'attachment') {
      main = basePath;
      extras = [-12, -4, 4, 12].map((along) => circleMark(markerPoint, markerSource, markerTarget, along, 5));
    }
    if (relationship.type === 'infatuation') {
      main = basePath;
      extras = [circleMark(markerPoint, markerSource, markerTarget, -4, 5), circleMark(markerPoint, markerSource, markerTarget, 4, 5)];
    }
    if (relationship.type === 'conflict') {
      main = offsetPolyline(renderedEmotionalPoints, -4);
      dash = '6 4';
      extras = [];
      patternExtras = [{ path: offsetPolyline(renderedEmotionalPoints, 4), dash: '6 4' }];
    }
    if (relationship.type === 'hatred') {
      main = basePath;
      dash = '6 4';
      extras = [];
      patternExtras = [{ path: offsetPolyline(renderedEmotionalPoints, -6), dash: '6 4' }, { path: offsetPolyline(renderedEmotionalPoints, 6), dash: '6 4' }];
    }
    if (relationship.type === 'distrust') {
      main = basePath;
      dash = undefined;
      extras = [-12, -6, 0, 6, 12].map((along) => bar(markerPoint, markerSource, markerTarget, along));
    }
    if (relationship.type === 'distant-hostile') {
      main = zigzagPolyline(pathSplit.before);
      dash = undefined;
      extras = [];
      patternExtras = [{ path: polyline(pathSplit.after), color: '#94a3b8', dash: '5 5' }];
    }
    if (relationship.type === 'fused-conflict') {
      main = zigzagPolyline(renderedEmotionalPoints);
      extras = [offsetPolyline(renderedEmotionalPoints, -7), offsetPolyline(renderedEmotionalPoints, 7)];
    }
    if (relationship.type === 'violence') main = zigzagPolyline(renderedEmotionalPoints, 12, 5);
    if (relationship.type === 'distant-violence') {
      main = zigzagPolyline(pathSplit.before, 12, 5);
      dash = undefined;
      extras = [];
      patternExtras = [{ path: polyline(pathSplit.after), color: '#94a3b8', dash: '5 5' }];
    }
    if (relationship.type === 'close-violence') {
      main = zigzagPolyline(renderedEmotionalPoints, 12, 5);
      extras = [];
      patternExtras = [{ path: offsetPolyline(renderedEmotionalPoints, -7), color: '#2563eb' }, { path: offsetPolyline(renderedEmotionalPoints, 7), color: '#2563eb' }];
    }
    if (relationship.type === 'fused-violence') {
      main = zigzagPolyline(renderedEmotionalPoints, 12, 5);
      extras = [offsetPolyline(renderedEmotionalPoints, -7), offsetPolyline(renderedEmotionalPoints, 7)];
    }
    if (relationship.type === 'abuse') main = directedZigzagPolyline(renderedEmotionalPoints, directionReversed);
    if (relationship.type === 'physical-neglect') { main = basePath; dash = '7 5'; }
    if (relationship.type === 'emotional-neglect') { main = basePath; dash = '2 6'; }
    if (relationship.type === 'manipulation') {
      main = basePath;
      dash = '7 5';
      extras = crossMark(markerPoint, markerSource, markerTarget);
    }
    if (relationship.type === 'control') {
      main = basePath;
      dash = undefined;
      extras = [boxMark(markerPoint, markerSource, markerTarget)];
    }
    if (relationship.type === 'jealousy') {
      main = basePath;
      dash = undefined;
      extras = [diamondMark(markerPoint, markerSource, markerTarget)];
    }
    if (relationship.type === 'admirer') {
      main = basePath;
      dash = undefined;
      extras = [circleMark(markerPoint, markerSource, markerTarget)];
    }
  }

  const customColor = typeof relationship.attributes.color === 'string' ? relationship.attributes.color : null;
  const hidden = relationship.attributes.hidden === true;
  const stroke = hidden ? (selected ? 'rgba(79, 133, 124, 0.34)' : 'transparent') : (customColor ?? (selected ? SELECTED : (definition.color ?? INK)));
  const strokeWidth = selected ? 2.8 : 2;
  const label = typeof relationship.attributes.label === 'string' ? relationship.attributes.label.trim() : '';

  const labelPoint = definition.category === 'emotional'
    ? pointAlongPolyline(renderedEmotionalPoints, 0.5, 25)
    : adjustableLine?.markPoint 
    ?? { x: straightLabelX, y: straightLabelY};
  const labelX = labelPoint.x;
  const labelY = labelPoint.y - 12;
  const childBadge = relationship.type === 'surrogate-child' ? 'S' : relationship.type === 'sperm-donor-child' ? 'SD' : relationship.type === 'egg-donor-child' ? 'ED' : null;
  const adoptionMarker = relationship.type === 'adopted-child';
  const immigrationMarker = relationship.attributes.immigrationMarker === 'single' ? '~' : relationship.attributes.immigrationMarker === 'double' ? '≈' : null;
  const arrowColor = customColor ?? (selected ? SELECTED : (relationship.type === 'abuse' ? '#2563eb' : (definition.color ?? INK)));
  const onDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    drag.current = { pointerId: event.pointerId, clientY: event.clientY, offset: lineOffset };
    const onMove = (moveEvent: PointerEvent) => {
      if (!drag.current || drag.current.pointerId !== moveEvent.pointerId) return;
      moveEvent.preventDefault();
      const direction = kind === 'sibling' ? -1 : 1;
      const nextOffset = Math.max(12, Math.min(240, drag.current.offset + direction * dragDelta(moveEvent.clientY - drag.current.clientY, getZoom())));
      draftOffsetRef.current = nextOffset;
      setDraftOffset(nextOffset);
    };
    const finish = (finishEvent: PointerEvent) => {
      if (!drag.current || drag.current.pointerId !== finishEvent.pointerId) return;
      drag.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      removeDragListeners.current = null;
      const nextOffset = draftOffsetRef.current;
      draftOffsetRef.current = null;
      if (nextOffset !== null && nextOffset !== savedLineOffset) {
        updateRelationship(id, { attributes: { ...relationship.attributes, lineOffset: nextOffset } });
      }
      setDraftOffset(null);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    removeDragListeners.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  };
  const saveControlPoints = (next: ControlPoint[]) => {
    updateRelationship(id, {
      attributes: {
        ...relationship.attributes,
        controlPoints: next.map(({ t, offset }) => ({ t, offset })),
      },
    });
  };
  const addControlPoint = (event: ReactMouseEvent<SVGPathElement>) => {
    if (!selected || definition.category !== 'emotional') return;
    event.preventDefault();
    event.stopPropagation();
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const added = controlPointFromCanvas(point, source, target);
    const next = [...controlPoints, added].sort((a, b) => a.t - b.t);
    saveControlPoints(next);
    setSelectedControlIndex(next.indexOf(added));
  };
  const removeControlPoint = (index: number) => {
    saveControlPoints(controlPoints.filter((_, itemIndex) => itemIndex !== index));
    setSelectedControlIndex(null);
  };
  const onControlDragStart = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    setSelectedControlIndex(index);
    controlDrag.current = { pointerId: event.pointerId, index };
  };
  const onControlDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!controlDrag.current || controlDrag.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const moved = controlPointFromCanvas(point, source, target);
    const base = draftControlPointsRef.current ?? controlPoints;
    const next = base.map((control, itemIndex) => itemIndex === controlDrag.current?.index ? moved : control).sort((a, b) => a.t - b.t);
    draftControlPointsRef.current = next;
    setDraftControlPoints(next);
    setSelectedControlIndex(next.indexOf(moved));
  };
  const finishControlDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!controlDrag.current || controlDrag.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    controlDrag.current = null;
    const next = draftControlPointsRef.current;
    draftControlPointsRef.current = null;
    if (next) saveControlPoints(next);
    setDraftControlPoints(null);
  };
  const resetControlPoints = () => {
    saveControlPoints([]);
    setSelectedControlIndex(null);
    setDraftControlPoints(null);
  };
  const controlNodePoints = controlPoints.map((control) => canvasPointFromControl(control, source, target));
  const selectedControlPoint = selectedControlIndex === null ? null : (controlNodePoints[selectedControlIndex] ?? null);
  const resetPoint = {
    x: (sourceX + targetX) / 2,
    y: Math.max(...emotionalPoints.map((point) => point.y)) + 38,
  };

  return (
    <>
      <g role="img" aria-label={`${definition.label} relationship`}>
        <title>{definition.label} relationship</title>
        <BaseEdge
          id={id}
          path={main}
          interactionWidth={interactionWidth ?? 26}
          style={{ stroke, strokeWidth, strokeDasharray: dash, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }}
        />
        {extras.map((path, index) => (
          <path key={`${id}-extra-${index}`} d={path} fill="none" stroke={stroke} strokeLinecap="round" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ))}
        {patternExtras.map((extra, index) => (
          <path
            key={`${id}-pattern-extra-${index}`}
            d={extra.path}
            fill="none"
            stroke={hidden ? (selected ? 'rgba(79, 133, 124, 0.34)' : 'transparent') : (customColor ?? (selected ? SELECTED : (extra.color ?? definition.color ?? INK)))}
            strokeDasharray={extra.dash}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ))}
        {selected && definition.category === 'emotional' && <path className={styles.emotionalLineHitArea} d={main} fill="none" stroke="transparent" strokeWidth="28" pointerEvents="stroke" onClick={addControlPoint} />}
      </g>
      {label && (
        <EdgeLabelRenderer>
          <span className="nodrag nopan" style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, color: stroke, padding: '1px 4px', fontSize: 10, fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex:3, textShadow: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff' }}>
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
      {definition.category === 'child' && (childBadge || adoptionMarker || immigrationMarker) && <EdgeLabelRenderer><span
        className={`nodrag nopan ${styles.childLineBadge}`}
        style={{ transform: `translate(-50%, -50%) translate(${straightLabelX}px, ${straightLabelY}px)`, color: stroke }}
      >{childBadge && <b>{childBadge}</b>}{adoptionMarker && <b aria-hidden="true">)(</b>}{immigrationMarker && <span>{immigrationMarker}</span>}</span></EdgeLabelRenderer>}
      {usesArrow && !hidden && (
        <ViewportPortal>
          <span
            className={`nodrag nopan ${styles.emotionalDirectionMarker}`}
            data-emotional-direction-marker="true"
            style={{ transform: `translate(-50%, -50%) translate(${arrowTarget.x}px, ${arrowTarget.y}px)`, color: arrowColor }}
            aria-hidden="true"
          >
            <svg viewBox="-9 -9 18 18">
              <g transform={`rotate(${arrowAngle})`}>
                <path className={styles.emotionalDirectionMarkerHalo} d="M -8 -5 L 0 0 L -8 5" />
                <path className={styles.emotionalDirectionMarkerArrow} d="M -8 -5 L 0 0 L -8 5" />
                {relationship.type === 'caregiver' && <>
                  <path className={styles.emotionalDirectionMarkerHalo} d="M -14 -5 L -6 0 L -14 5" />
                  <path className={styles.emotionalDirectionMarkerArrow} d="M -14 -5 L -6 0 L -14 5" />
                </>}
              </g>
            </svg>
          </span>
        </ViewportPortal>
      )}
      {selected && adjustableLine && (
        <EdgeLabelRenderer>
          <button
            className={`nodrag nopan ${styles.relationshipDragHandle}`}
            type="button"
            aria-label="Adjust relationship line height"
            title="Drag to adjust line height"
            style={{ transform: `translate(-50%, -50%) translate(${adjustableLine.markPoint.x}px, ${adjustableLine.markPoint.y}px)` }}
            onPointerDown={onDragStart}
          >
            <MoveVertical
              className={styles.relationshipDragIcon}
              size={14}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        </EdgeLabelRenderer>
      )}
      {selected && definition.category === 'emotional' && (
        <EdgeLabelRenderer>
          <span className={`nodrag nopan ${styles.emotionalEndpoint}`} style={{ transform: `translate(-50%, -50%) translate(${visibleSourceEndpoint.x}px, ${visibleSourceEndpoint.y}px)` }} aria-hidden="true" />
          <span className={`nodrag nopan ${styles.emotionalEndpoint}`} style={{ transform: `translate(-50%, -50%) translate(${visibleTargetEndpoint.x}px, ${visibleTargetEndpoint.y}px)` }} aria-hidden="true" />
          {controlNodePoints.map((point, index) => <button
            className={`nodrag nopan ${styles.emotionalControlPoint} ${selectedControlIndex === index ? styles.emotionalControlPointSelected : ''}`}
            type="button"
            key={`${id}-control-${index}`}
            aria-label={`Emotional line control point ${index + 1}`}
            title="Drag to reshape. Press Delete to remove."
            style={{ transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)` }}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedControlIndex(index); }}
            onPointerDown={(event) => onControlDragStart(event, index)}
            onPointerMove={onControlDragMove}
            onPointerUp={finishControlDrag}
            onPointerCancel={finishControlDrag}
            onKeyDown={(event) => {
              if (event.key !== 'Delete' && event.key !== 'Backspace') return;
              event.preventDefault();
              event.stopPropagation();
              removeControlPoint(index);
            }}
          />)}
          {selectedControlPoint && selectedControlIndex !== null && <button
            className={`nodrag nopan ${styles.emotionalControlPointDeleteButton}`}
            type="button"
            aria-label="Delete emotional line control point"
            title="Delete control point"
            style={{ transform: `translate(-50%, -100%) translate(${selectedControlPoint.x}px, ${selectedControlPoint.y - 14}px)` }}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); removeControlPoint(selectedControlIndex); }}
            onKeyDown={(event) => {
              if (event.key !== 'Delete' && event.key !== 'Backspace') return;
              event.preventDefault();
              event.stopPropagation();
              removeControlPoint(selectedControlIndex);
            }}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>}
          {controlPoints.length > 0 && <button className={`nodrag nopan ${styles.emotionalResetButton}`} type="button" style={{ transform: `translate(-50%, -50%) translate(${resetPoint.x}px, ${resetPoint.y}px)` }} onClick={(event) => { event.preventDefault(); event.stopPropagation(); resetControlPoints(); }}><RotateCcw size={11} aria-hidden="true" />Reset</button>}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
