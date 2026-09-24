'use client';

import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react';
import { MoveHorizontal, MoveVertical } from 'lucide-react';
import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

import { clampFamilyOriginX, createFamilyRootGeometry, familyBranchHorizontalStartX, findFamilyOriginDropTarget, type FamilyRootSegment } from '../lib/genogram/family-edge-geometry';
import { familyBranchIsSelected, leftmostFamilyBranchSelection, projectToPartnerUnionTargets, selectedFamilyChildIds, type FamilyChildBranch, type FamilyFlowEdge, type FamilyTwinBranch, type PartnerUnionTarget } from '../lib/genogram/flow-adapter';
import { useGenogramStore } from '../lib/genogram/store';
import styles from './GenogramEditor.module.css';

const INK = '#000000';
const SELECTED = 'var(--accent)';
const HOVER_HALO = 'rgba(71, 85, 105, 0.3)';

type FamilyMoveTarget = PartnerUnionTarget & { originX: number };

function f(value: number): string {
  return value.toFixed(2);
}

function segmentPath(segment: FamilyRootSegment): string {
  return `M ${f(segment.x1)} ${f(segment.y1)} L ${f(segment.x2)} ${f(segment.y2)}`;
}

function dashFor(kind: FamilyChildBranch['lineKind']): string | undefined {
  if (kind === 'child-dashed') return '8 6';
  if (kind === 'child-dotted') return '2 6';
  if (kind === 'child-step') return '10 5 2 5';
  if (kind === 'child-surrogate') return '5 5';
  if (kind === 'child-donor') return '3 3';
  return undefined;
}

function BranchAnnotations({ branch, startX, startY, stroke }: { branch: FamilyChildBranch; startX: number; startY: number; stroke: string }) {
  const adoptionMarker = branch.lineKind === 'child-dashed';
  if (!branch.badge && !branch.immigrationMarker && !adoptionMarker && !branch.relationshipLabel) return null;
  const progress = 0.58;
  const x = startX + (branch.x - startX) * progress;
  const y = startY + (branch.y - startY) * progress;
  return <g pointerEvents="none">
    {adoptionMarker && <>
      <path d={`M ${f(x - 4)} ${f(y - 7)} Q ${f(x - 10)} ${f(y)} ${f(x - 4)} ${f(y + 7)}`} fill="none" stroke={stroke} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <path d={`M ${f(x + 4)} ${f(y - 7)} Q ${f(x + 10)} ${f(y)} ${f(x + 4)} ${f(y + 7)}`} fill="none" stroke={stroke} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </>}
    {branch.badge && <>
      <rect x={x - 12} y={y - 8} width="24" height="16" rx="4" fill="#fbfdfa" stroke={stroke} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <text x={x} y={y + 3} fill={stroke} fontSize="8" fontWeight="800" textAnchor="middle">{branch.badge}</text>
    </>}
    {branch.immigrationMarker && <text x={x} y={y + (branch.badge || adoptionMarker ? 35 : 15)} fill={stroke} fontSize="50" fontWeight="77" textAnchor="middle">{branch.immigrationMarker === 'double' ? '≈' : '~'}</text>}
    {branch.relationshipLabel && (
        <EdgeLabelRenderer>
          <span className={styles.childLineLabel} style={{ transform: `translate(-50%, -100%) translate(${x}px, ${y - (branch.badge || adoptionMarker || branch.immigrationMarker ? 15 : -3)}px)`}}>{branch.relationshipLabel}</span>
        </EdgeLabelRenderer>
      )}
  </g>;
}

function dragDelta(clientDelta: number, zoom: number): number {
  return clientDelta / zoom;
}

function twinGeometry(twin: FamilyTwinBranch, trunkStartY: number) {
  const midX = (twin.first.x + twin.second.x) / 2;
  return { midX, splitY: trunkStartY };
}

export function GenogramFamilyEdge({ id, data, selected, interactionWidth }: EdgeProps<FamilyFlowEdge>) {
  const { getZoom, screenToFlowPosition } = useReactFlow();
  const project = useGenogramStore((state) => state.project);
  const selectedRelationshipIds = useGenogramStore((state) => state.ui.selectedRelationshipIds);
  const updateRelationship = useGenogramStore((state) => state.updateRelationship);
  const moveChildToFamily = useGenogramStore((state) => state.moveChildToFamily);
  const setSelection = useGenogramStore((state) => state.setSelection);
  const setActivePanel = useGenogramStore((state) => state.setActivePanel);
  const [draftSiblingOffset, setDraftSiblingOffset] = useState<number | null>(null);
  const [draftOriginOffset, setDraftOriginOffset] = useState<number | null>(null);
  const [familyMoveTarget, setFamilyMoveTarget] = useState<FamilyMoveTarget | null>(null);
  const [hoveredBranchKey, setHoveredBranchKey] = useState<string | null>(null);
  const branchDrag = useRef<{ pointerId: number; clientY: number; offset: number } | null>(null);
  const originDrag = useRef<{ pointerId: number; clientX: number; offset: number } | null>(null);
  const familyMoveTargetRef = useRef<FamilyMoveTarget | null>(null);
  if (!data) return null;
  const baseStroke = data.hidden ? 'transparent' : (data.color ?? INK);
  const selectedStroke = data.hidden ? 'rgba(79, 133, 124, 0.34)' : SELECTED;

  function getBranchStroke(branch: FamilyChildBranch, isSelected: boolean): string {
    const relationshipColor = branch.relationshipIds
      .map((id) => project.relationships.find((r) => r.id === id))
      .map((r) => r?.attributes.color)
      .find((color): color is string => typeof color === 'string');
    const relationshipHidden = branch.relationshipIds
      .map((id) => project.relationships.find((r) => r.id === id))
      .map((r) => r?.attributes.hidden)
      .find((hidden): hidden is boolean => typeof hidden === 'boolean');
    if (relationshipHidden) return isSelected ? 'rgba(79, 133, 124, 0.34)' : 'transparent';
    if (isSelected) return SELECTED;
    return relationshipColor ?? INK;
  }

  const movingChildIds = selectedFamilyChildIds(data);
  const renderedSingles = familyMoveTarget
    ? data.singles.filter((branch) => !movingChildIds.includes(branch.childId))
    : data.singles;
  const renderedTwins = familyMoveTarget
    ? data.twins.filter((twin) => !movingChildIds.includes(twin.first.childId) && !movingChildIds.includes(twin.second.childId))
    : data.twins;
  const childTopY = Math.min(
    ...data.singles.map((branch) => branch.y),
    ...data.twins.flatMap((twin) => [twin.first.y, twin.second.y]),
  );
  const connectionStartY = data.parentLineY;
  const maxOffset = Math.max(34, childTopY - connectionStartY - 18);
  const defaultOffset = Math.max(28, data.siblingY - connectionStartY);
  const savedOffset = Math.max(28, Math.min(maxOffset, data.siblingOffset ?? defaultOffset));
  const siblingOffset = draftSiblingOffset ?? savedOffset;
  const siblingY = connectionStartY + siblingOffset;
  const parentCenterX = (data.parentLeftX + data.parentRightX) / 2;
  const savedOriginX = clampFamilyOriginX(data.parentLeftX, data.parentRightX, parentCenterX + (data.originOffset ?? 0));
  const requestedOriginX = parentCenterX + (draftOriginOffset ?? savedOriginX - parentCenterX);
  const originX = clampFamilyOriginX(data.parentLeftX, data.parentRightX, requestedOriginX);
  const originOffset = originX - parentCenterX;
  const loneSingle = data.singles.length === 1 && data.twins.length === 0 ? data.singles[0] : null;
  const loneTwin = data.singles.length === 0 && data.twins.length === 1 ? data.twins[0] : null;
  const singleAnchors = data.singles.map((branch) => branch.x);
  const twinAnchors = data.twins.map((twin) => (twin.first.x + twin.second.x) / 2);
  const anchors = [...singleAnchors, ...twinAnchors];
  const rootGeometry = createFamilyRootGeometry({
    parentLineY: connectionStartY,
    originX,
    anchorXs: anchors,
    verticalEndY: siblingY,
  });
  const defaultRootSelection = leftmostFamilyBranchSelection(data);
  const rootInteractionPath = segmentPath(rootGeometry.segments[0]);
  const { startX, endX } = rootGeometry;
  const basePath = rootGeometry.segments.map(segmentPath).join(' ');
  const alignedLoneSingle = Boolean(loneSingle && Math.abs(originX - loneSingle.x) <= 0.01);
  const rootRenderPath = alignedLoneSingle && loneSingle
    ? `M ${f(originX)} ${f(connectionStartY)} L ${f(loneSingle.x)} ${f(loneSingle.y)}`
    : basePath;
  const renderedLoneSingle = renderedSingles.length === 1 && renderedTwins.length === 0 ? renderedSingles[0] : null;
  const renderedAnchors = [
    ...renderedSingles.map((branch) => branch.x),
    ...renderedTwins.map((twin) => (twin.first.x + twin.second.x) / 2),
  ];
  const renderedRootGeometry = renderedAnchors.length > 0 ? createFamilyRootGeometry({
    parentLineY: connectionStartY,
    originX,
    anchorXs: renderedAnchors,
    verticalEndY: siblingY,
  }) : null;
  const renderedAlignedLoneSingle = Boolean(renderedLoneSingle && Math.abs(originX - renderedLoneSingle.x) <= 0.01);
  const renderedRootPath = renderedAnchors.length === 0
    ? ''
    : renderedAlignedLoneSingle && renderedLoneSingle
      ? `M ${f(originX)} ${f(connectionStartY)} L ${f(renderedLoneSingle.x)} ${f(renderedLoneSingle.y)}`
      : renderedRootGeometry?.segments.map(segmentPath).join(' ') ?? '';
  const handleX = (startX + endX) / 2;
  const hasHorizontalBranch = endX - startX > 12;
  const loneTwinGeometry = loneTwin ? twinGeometry(loneTwin, siblingY) : null;
  const displayedOriginX = familyMoveTarget?.originX ?? originX;
  const displayedOriginY = familyMoveTarget?.y ?? connectionStartY;
  const movingBranches = [
    ...data.singles.filter((branch) => movingChildIds.includes(branch.childId)),
    ...data.twins.flatMap((twin) => [twin.first, twin.second]).filter((branch) => movingChildIds.includes(branch.childId)),
  ];
  const previewBranches = movingBranches.length > 0
    ? movingBranches
    : [...data.singles, ...data.twins.flatMap((twin) => [twin.first, twin.second])];
  const previewChildX = previewBranches.reduce((sum, branch) => sum + branch.x, 0) / previewBranches.length;
  const previewChildTopY = Math.min(...previewBranches.map((branch) => branch.y));
  const previewBendY = familyMoveTarget
    ? familyMoveTarget.y + Math.max(34, (previewChildTopY - familyMoveTarget.y) * 0.55)
    : 0;

  const routeToAnchor = (anchorX: number) => `M ${f(originX)} ${f(connectionStartY)} L ${f(originX)} ${f(siblingY)} L ${f(anchorX)} ${f(siblingY)}`;
  const renderedRouteToAnchor = (anchorX: number) => `M ${f(originX)} ${f(connectionStartY)} L ${f(originX)} ${f(siblingY)} L ${f(anchorX)} ${f(siblingY)}`;
  const singlePath = (branch: FamilyChildBranch) => alignedLoneSingle && branch.childId === loneSingle?.childId
    ? `M ${f(originX)} ${f(connectionStartY)} L ${f(branch.x)} ${f(branch.y)}`
    : `${routeToAnchor(branch.x)} L ${f(branch.x)} ${f(branch.y)}`;
  const renderedSinglePath = (branch: FamilyChildBranch) => renderedAlignedLoneSingle && branch.childId === renderedLoneSingle?.childId
    ? `M ${f(originX)} ${f(connectionStartY)} L ${f(branch.x)} ${f(branch.y)}`
    : `${renderedRouteToAnchor(branch.x)} L ${f(branch.x)} ${f(branch.y)}`;
  const twinLegPath = (twin: FamilyTwinBranch, branch: FamilyChildBranch) => {
    const { midX, splitY } = twinGeometry(twin, siblingY);
    return `M ${f(midX)} ${f(splitY)} L ${f(branch.x)} ${f(branch.y)}`;
  };
  const singleInteractionPath = (branch: FamilyChildBranch) => {
    if (alignedLoneSingle && branch.childId === loneSingle?.childId) return singlePath(branch);
    const horizontalStartX = familyBranchHorizontalStartX(originX, branch.x, anchors);
    const horizontal = Math.abs(horizontalStartX - branch.x) > 0.01
      ? `M ${f(horizontalStartX)} ${f(siblingY)} L ${f(branch.x)} ${f(siblingY)} `
      : '';
    return `${horizontal}M ${f(branch.x)} ${f(siblingY)} L ${f(branch.x)} ${f(branch.y)}`;
  };
  const renderedTwinRoutePath = (twin: FamilyTwinBranch, branch: FamilyChildBranch) => {
    const { midX, splitY } = twinGeometry(twin, siblingY);
    return `${renderedRouteToAnchor(midX)} L ${f(midX)} ${f(splitY)} L ${f(branch.x)} ${f(branch.y)}`;
  };

  const selectBranch = (event: ReactMouseEvent<SVGPathElement>, relationshipIds: string[]) => {
    event.preventDefault();
    event.stopPropagation();
    const ids = [...new Set(relationshipIds)];
    const multi = event.metaKey || event.ctrlKey || event.shiftKey;
    const allSelected = ids.every((relationshipId) => selectedRelationshipIds.includes(relationshipId));
    const next = multi && allSelected
      ? selectedRelationshipIds.filter((relationshipId) => !ids.includes(relationshipId))
      : multi ? [...new Set([...selectedRelationshipIds, ...ids])] : ids;
    setSelection([], next);
    setActivePanel(null);
  };

  const updateFamilyMoveTarget = (target: FamilyMoveTarget | null) => {
    familyMoveTargetRef.current = target;
    setFamilyMoveTarget(target);
  };

  const onDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    branchDrag.current = { pointerId: event.pointerId, clientY: event.clientY, offset: siblingOffset };
  };
  const onDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!branchDrag.current || branchDrag.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setDraftSiblingOffset(Math.max(28, Math.min(maxOffset, branchDrag.current.offset + dragDelta(event.clientY - branchDrag.current.clientY, getZoom()))));
  };
  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!branchDrag.current || branchDrag.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    branchDrag.current = null;
    const nextOffset = draftSiblingOffset ?? siblingOffset;
    for (const relationshipId of data.relationshipIds) {
      const relationship = project.relationships.find((item) => item.id === relationshipId);
      if (relationship) updateRelationship(relationshipId, { attributes: { ...relationship.attributes, siblingOffset: nextOffset } });
    }
    setDraftSiblingOffset(null);
  };

  const onOriginDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    originDrag.current = { pointerId: event.pointerId, clientX: event.clientX, offset: originOffset };
    updateFamilyMoveTarget(null);
  };
  const onOriginDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!originDrag.current || originDrag.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const pointer = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const withinCurrentLine = pointer.x >= Math.min(data.parentLeftX, data.parentRightX)
      && pointer.x <= Math.max(data.parentLeftX, data.parentRightX)
      && Math.abs(pointer.y - connectionStartY) <= 44;
    const target = withinCurrentLine ? null : findFamilyOriginDropTarget({
      targets: projectToPartnerUnionTargets(project),
      pointerX: pointer.x,
      pointerY: pointer.y,
      currentFamilyId: data.unionId,
      stickyTargetId: familyMoveTargetRef.current?.id,
    });
    if (target) {
      updateFamilyMoveTarget({ ...target, originX: clampFamilyOriginX(target.left, target.right, pointer.x) });
      return;
    }
    updateFamilyMoveTarget(null);
    const requestedOffset = originDrag.current.offset + dragDelta(event.clientX - originDrag.current.clientX, getZoom());
    const nextX = clampFamilyOriginX(data.parentLeftX, data.parentRightX, parentCenterX + requestedOffset);
    setDraftOriginOffset(nextX - parentCenterX);
  };
  const finishOriginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!originDrag.current || originDrag.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    originDrag.current = null;
    const moveTarget = familyMoveTargetRef.current;
    if (moveTarget) {
      const childIds = movingChildIds;
      const movingTwinPair = data.twins.some((twin) => childIds.includes(twin.first.childId) && childIds.includes(twin.second.childId));
      const nextOriginOffset = moveTarget.originX - moveTarget.x;
      for (const childId of childIds) {
        moveChildToFamily(childId, moveTarget.parentIds, {
          familyOriginOffset: nextOriginOffset,
          preserveTwinRelationships: movingTwinPair,
        });
      }
      updateFamilyMoveTarget(null);
      setDraftOriginOffset(null);
      return;
    }
    const nextOffset = draftOriginOffset ?? originOffset;
    for (const relationshipId of data.relationshipIds) {
      const relationship = project.relationships.find((item) => item.id === relationshipId);
      if (relationship) updateRelationship(relationshipId, { attributes: { ...relationship.attributes, familyOriginOffset: nextOffset } });
    }
    setDraftOriginOffset(null);
  };
  const cancelOriginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!originDrag.current || originDrag.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    originDrag.current = null;
    updateFamilyMoveTarget(null);
    setDraftOriginOffset(null);
  };

  return (
    <>
      <g role="img" aria-label={data.label}>
        <title>{data.label}</title>
        {familyMoveTarget && <g pointerEvents="none">
          <path className={styles.childFamilyMovePath} d={`M ${f(familyMoveTarget.originX)} ${f(familyMoveTarget.y)} L ${f(familyMoveTarget.originX)} ${f(previewBendY)} L ${f(previewChildX)} ${f(previewBendY)} L ${f(previewChildX)} ${f(previewChildTopY)}`} />
        </g>}
        <BaseEdge
          id={id}
          path={rootRenderPath}
          interactionWidth={interactionWidth ?? 26}
          style={{ stroke: 'transparent', strokeWidth: 1 }}
        />
        {defaultRootSelection && <path
          className="react-flow__edge-interaction"
          data-family-branch-child-id={defaultRootSelection.childId}
          d={rootInteractionPath}
          fill="none"
          stroke="transparent"
          strokeWidth={interactionWidth ?? 26}
          pointerEvents="stroke"
          style={{ cursor: 'pointer' }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => selectBranch(event, defaultRootSelection.relationshipIds)}
        />}
        {data.singles.map((branch) => (
          <path
            key={`hit-${branch.childId}`}
            className="react-flow__edge-interaction"
            data-family-branch-child-id={branch.childId}
            d={singleInteractionPath(branch)}
            fill="none"
            stroke="transparent"
            strokeWidth={interactionWidth ?? 26}
            pointerEvents="stroke"
            style={{ cursor: 'pointer' }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerEnter={() => setHoveredBranchKey(`single:${branch.childId}`)}
            onPointerLeave={() => setHoveredBranchKey(null)}
            onClick={(event) => selectBranch(event, branch.relationshipIds)}
          />
        ))}
        {data.twins.flatMap((twin) => [twin.first, twin.second].map((branch) => (
          <path
            key={`hit-${twin.twinRelationshipId}-${branch.childId}`}
            className="react-flow__edge-interaction"
            data-family-branch-child-id={branch.childId}
            d={twinLegPath(twin, branch)}
            fill="none"
            stroke="transparent"
            strokeWidth={interactionWidth ?? 26}
            pointerEvents="stroke"
            style={{ cursor: 'pointer' }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerEnter={() => setHoveredBranchKey(`twin:${twin.twinRelationshipId}:${branch.childId}`)}
            onPointerLeave={() => setHoveredBranchKey(null)}
            onClick={(event) => selectBranch(event, [...branch.relationshipIds, twin.twinRelationshipId])}
          />
        )))}
        <g>
          <path d={renderedRootPath} fill="none" stroke={baseStroke} strokeDasharray={renderedLoneSingle ? dashFor(renderedLoneSingle.lineKind) : undefined} strokeLinecap="round" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          {renderedSingles.map((branch) => {
            const isSelected = familyBranchIsSelected(branch, data.selectedRelationshipIds);
            const branchStroke = getBranchStroke(branch, isSelected);
            return (
              <g key={branch.childId}>
                <path d={renderedAlignedLoneSingle && branch.childId === renderedLoneSingle?.childId ? '' : `M ${f(branch.x)} ${f(siblingY)} L ${f(branch.x)} ${f(branch.y)}`} fill="none" stroke={branchStroke} strokeDasharray={dashFor(branch.lineKind)} strokeLinecap="round" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                <BranchAnnotations branch={branch} startX={branch.x} startY={renderedAlignedLoneSingle && branch.childId === renderedLoneSingle?.childId ? connectionStartY : siblingY} stroke={branchStroke} />
              </g>
            );
          })}
          {renderedTwins.map((twin) => {
            const trunkStartY = siblingY;
            const { midX, splitY } = twinGeometry(twin, trunkStartY);
            const connectorProgress = 0.58;
            const firstConnector = {
              x: midX + (twin.first.x - midX) * connectorProgress,
              y: splitY + (twin.first.y - splitY) * connectorProgress,
            };
            const secondConnector = {
              x: midX + (twin.second.x - midX) * connectorProgress,
              y: splitY + (twin.second.y - splitY) * connectorProgress,
            };
            const firstSelected = familyBranchIsSelected(twin.first, data.selectedRelationshipIds);
            const secondSelected = familyBranchIsSelected(twin.second, data.selectedRelationshipIds);
            const twinRelationshipSelected = data.selectedRelationshipIds.includes(twin.twinRelationshipId);
            const selectBoth = twinRelationshipSelected && !firstSelected && !secondSelected;
            return (
              <g key={twin.twinRelationshipId} pointerEvents="none">
                <path d={`M ${f(midX)} ${f(trunkStartY)} L ${f(midX)} ${f(splitY)}`} fill="none" stroke={baseStroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <path d={`M ${f(midX)} ${f(splitY)} L ${f(twin.first.x)} ${f(twin.first.y)}`} fill="none" stroke={baseStroke} strokeDasharray={dashFor(twin.first.lineKind)} strokeLinecap="round" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <path d={`M ${f(midX)} ${f(splitY)} L ${f(twin.second.x)} ${f(twin.second.y)}`} fill="none" stroke={baseStroke} strokeDasharray={dashFor(twin.second.lineKind)} strokeLinecap="round" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <BranchAnnotations branch={twin.first} startX={midX} startY={splitY} stroke={firstSelected || selectBoth ? selectedStroke : baseStroke} />
                <BranchAnnotations branch={twin.second} startX={midX} startY={splitY} stroke={secondSelected || selectBoth ? selectedStroke : baseStroke} />
                {twin.type === 'identical-twins' && (
                  <path d={`M ${f(firstConnector.x)} ${f(firstConnector.y)} L ${f(secondConnector.x)} ${f(secondConnector.y)}`} fill="none" stroke={firstSelected || secondSelected || twinRelationshipSelected ? selectedStroke : baseStroke} strokeWidth={firstSelected || secondSelected || twinRelationshipSelected ? 2.8 : 2} vectorEffect="non-scaling-stroke" />
                )}
              </g>
            );
          })}
          {renderedSingles.filter((branch) => hoveredBranchKey === `single:${branch.childId}`).map((branch) => (
            <path
              key={`hover-${branch.childId}`}
              data-family-hover-route-child-id={branch.childId}
              d={renderedSinglePath(branch)}
              fill="none"
              stroke={HOVER_HALO}
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeWidth="10"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
          {renderedTwins.flatMap((twin) => [twin.first, twin.second]
            .filter((branch) => hoveredBranchKey === `twin:${twin.twinRelationshipId}:${branch.childId}`)
            .map((branch) => (
              <path
                key={`hover-${twin.twinRelationshipId}-${branch.childId}`}
                data-family-hover-route-child-id={branch.childId}
                d={renderedTwinRoutePath(twin, branch)}
                fill="none"
                stroke={HOVER_HALO}
                strokeLinecap="square"
                strokeLinejoin="miter"
                strokeWidth="10"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )))}
          {renderedSingles.filter((branch) => familyBranchIsSelected(branch, data.selectedRelationshipIds)).map((branch) => (
            <g key={`selected-${branch.childId}`} pointerEvents="none">
              <path d={renderedAlignedLoneSingle && branch.childId === renderedLoneSingle?.childId ? renderedSinglePath(branch) : renderedRouteToAnchor(branch.x)} fill="none" stroke={selectedStroke} strokeDasharray={renderedAlignedLoneSingle && branch.childId === renderedLoneSingle?.childId ? dashFor(branch.lineKind) : undefined} strokeLinecap="round" strokeWidth="2.8" vectorEffect="non-scaling-stroke" />
              {!renderedAlignedLoneSingle || branch.childId !== renderedLoneSingle?.childId ? <path d={`M ${f(branch.x)} ${f(siblingY)} L ${f(branch.x)} ${f(branch.y)}`} fill="none" stroke={selectedStroke} strokeDasharray={dashFor(branch.lineKind)} strokeLinecap="round" strokeWidth="2.8" vectorEffect="non-scaling-stroke" /> : null}
            </g>
          ))}
          {renderedTwins.map((twin) => {
            const { midX, splitY } = twinGeometry(twin, siblingY);
            const firstSelected = familyBranchIsSelected(twin.first, data.selectedRelationshipIds);
            const secondSelected = familyBranchIsSelected(twin.second, data.selectedRelationshipIds);
            const twinRelationshipSelected = data.selectedRelationshipIds.includes(twin.twinRelationshipId);
            const selectedBranches = twinRelationshipSelected && !firstSelected && !secondSelected
              ? [twin.first, twin.second]
              : [firstSelected ? twin.first : null, secondSelected ? twin.second : null].filter((branch): branch is FamilyChildBranch => branch !== null);
            return selectedBranches.map((branch) => <g key={`selected-${twin.twinRelationshipId}-${branch.childId}`} pointerEvents="none">
              <path d={`${renderedRouteToAnchor(midX)} L ${f(midX)} ${f(splitY)}`} fill="none" stroke={selectedStroke} strokeLinecap="round" strokeWidth="2.8" vectorEffect="non-scaling-stroke" />
              <path d={`M ${f(midX)} ${f(splitY)} L ${f(branch.x)} ${f(branch.y)}`} fill="none" stroke={selectedStroke} strokeDasharray={dashFor(branch.lineKind)} strokeLinecap="round" strokeWidth="2.8" vectorEffect="non-scaling-stroke" />
            </g>);
          })}
        </g>
      </g>
      {familyMoveTarget && <EdgeLabelRenderer><span
        className={`nodrag nopan ${styles.childFamilyMoveLabel}`}
        style={{ transform: `translate(-50%, -100%) translate(${familyMoveTarget.originX}px, ${familyMoveTarget.y - 18}px)` }}
      >Move to another family</span></EdgeLabelRenderer>}
      {selected && <EdgeLabelRenderer><button
        className={`nodrag nopan ${styles.relationshipDragHandle} ${styles.familyOriginDragHandle} ${familyMoveTarget ? styles.familyOriginMoveTarget : ''}`}
        type="button"
        aria-label="Adjust child line origin"
        title="Drag along the parents line to adjust the child line origin"
        style={{ transform: `translate(-50%, -50%) translate(${displayedOriginX}px, ${displayedOriginY}px)` }}
        onPointerDown={onOriginDragStart}
        onPointerMove={onOriginDragMove}
        onPointerUp={finishOriginDrag}
        onPointerCancel={cancelOriginDrag}
      ><MoveHorizontal
        className={styles.relationshipDragIcon}
        size={14}
        strokeWidth={2}
        aria-hidden="true"
      /></button></EdgeLabelRenderer>}
      {selected && hasHorizontalBranch && !familyMoveTarget && <EdgeLabelRenderer><button
        className={`nodrag nopan ${styles.relationshipDragHandle}`}
        type="button"
        aria-label="Adjust child branch height"
        title="Drag to adjust child branch height"
        style={{ transform: `translate(-50%, -50%) translate(${handleX}px, ${siblingY}px)` }}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      ><MoveVertical
        className={styles.relationshipDragIcon}
        size={14}
        strokeWidth={2}
        aria-hidden="true"
      /></button></EdgeLabelRenderer>}
    </>
  );
}
