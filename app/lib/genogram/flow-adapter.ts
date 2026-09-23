import { MarkerType, Position as FlowPosition, type Edge, type Node } from '@xyflow/react';

import {
  getRelationshipDefinition,
  isChildRelationship,
  isPartnerRelationship,
  isTwinRelationship,
  type Household,
  type CanvasAnnotation,
  type Person,
  type Position,
  type Project,
  type Relationship,
  type RelationshipLineKind,
  type RelationshipType,
} from './model';

export interface PersonNodeData {
  [key: string]: unknown;
  person: Person;
  connectionCue?: boolean;
  connectionLabel?: string;
}
export interface JunctionNodeData { [key: string]: unknown; unionId: string; parentIds: string[] }
export interface HouseholdNodeData { [key: string]: unknown; household: Household; width: number; height: number }
export interface AnnotationNodeData { [key: string]: unknown; annotation: CanvasAnnotation }
export interface RelationshipEdgeData { [key: string]: unknown; relationship: Relationship }
export interface AnnotationLinkEdgeData { [key: string]: unknown; kind: 'annotation-link'; sourceAnnotationId: string; targetId: string }

export interface FamilyChildBranch {
  childId: string;
  x: number;
  y: number;
  lineKind: Extract<RelationshipLineKind, 'child-solid' | 'child-dashed' | 'child-dotted' | 'child-step' | 'child-surrogate' | 'child-donor'>;
  badge?: 'S' | 'SD' | 'ED';
  immigrationMarker?: 'single' | 'double';
  relationshipIds: string[];
}

export interface FamilyTwinBranch {
  twinRelationshipId: string;
  type: 'fraternal-twins' | 'identical-twins';
  first: FamilyChildBranch;
  second: FamilyChildBranch;
}

export interface FamilyEdgeData {
  [key: string]: unknown;
  relationshipIds: string[];
  selectedRelationshipIds: string[];
  unionId: string;
  parentLeftX: number;
  parentRightX: number;
  parentLineY: number;
  siblingY: number;
  siblingOffset?: number;
  originOffset?: number;
  singles: FamilyChildBranch[];
  twins: FamilyTwinBranch[];
  label: string;
  relationshipLabel?: string;
  color?: string;
  hidden?: boolean;
}

export interface PartnerUnionTarget {
  id: string;
  relationshipId: string;
  parentIds: [string, string];
  left: number;
  right: number;
  x: number;
  y: number;
}

export type PersonFlowNode = Node<PersonNodeData, 'person'>;
export type JunctionFlowNode = Node<JunctionNodeData, 'junction'>;
export type HouseholdFlowNode = Node<HouseholdNodeData, 'household'>;
export type AnnotationFlowNode = Node<AnnotationNodeData, 'annotation'>;
export type FlowNode = PersonFlowNode | JunctionFlowNode | HouseholdFlowNode | AnnotationFlowNode;
export type RelationshipFlowEdge = Edge<RelationshipEdgeData, 'relationship'>;
export type FamilyFlowEdge = Edge<FamilyEdgeData, 'family'>;
export type AnnotationLinkFlowEdge = Edge<AnnotationLinkEdgeData, 'straight'>;
export type FlowEdge = RelationshipFlowEdge | FamilyFlowEdge | AnnotationLinkFlowEdge;

export function familyBranchIsSelected(branch: FamilyChildBranch, selectedRelationshipIds: readonly string[]): boolean {
  const selected = new Set(selectedRelationshipIds);
  return branch.relationshipIds.some((id) => selected.has(id));
}

export function selectedFamilyChildIds(data: Pick<FamilyEdgeData, 'selectedRelationshipIds' | 'singles' | 'twins'>): string[] {
  const selected = new Set(data.selectedRelationshipIds);
  const childIds = data.singles
    .filter((branch) => branch.relationshipIds.some((id) => selected.has(id)))
    .map((branch) => branch.childId);

  for (const twin of data.twins) {
    const twinSelected = selected.has(twin.twinRelationshipId)
      || twin.first.relationshipIds.some((id) => selected.has(id))
      || twin.second.relationshipIds.some((id) => selected.has(id));
    if (twinSelected) childIds.push(twin.first.childId, twin.second.childId);
  }

  return [...new Set(childIds)];
}

export function leftmostFamilyBranchSelection(data: Pick<FamilyEdgeData, 'singles' | 'twins'>): { childId: string; relationshipIds: string[] } | null {
  const candidates = [
    ...data.singles.map((branch) => ({ childId: branch.childId, x: branch.x, relationshipIds: branch.relationshipIds })),
    ...data.twins.flatMap((twin) => [twin.first, twin.second].map((branch) => ({
      childId: branch.childId,
      x: branch.x,
      relationshipIds: [...branch.relationshipIds, twin.twinRelationshipId],
    }))),
  ].sort((first, second) => first.x - second.x || first.childId.localeCompare(second.childId));
  const candidate = candidates[0];
  return candidate ? { childId: candidate.childId, relationshipIds: [...new Set(candidate.relationshipIds)] } : null;
}

const PERSON_NODE_WIDTH = 132;
const PERSON_NODE_HEIGHT = 180;
const PERSON_SYMBOL_VIEWBOX = 112;
const PERSON_SYMBOL_SIZES = { small: 66, medium: 82, large: 98 } as const;
const HOUSEHOLD_PADDING = 42;
export const CANVAS_GRID_SIZE = 22;
export const DEFAULT_PARTNER_LINE_OFFSET = 92;
export const SIBLING_LINE_OFFSET = 68;
export const AUTOMATIC_RELATIONSHIP_Y_TOLERANCE = CANVAS_GRID_SIZE * 5;

export interface AutomaticRelationship {
  type: Extract<RelationshipType, 'marriage' | 'biological-child'>;
  source: string;
  target: string;
  targetRole: 'Parent' | 'Partner' | 'Child';
}

export function inferAutomaticRelationship(sourceId: string, targetId: string, sourceY: number, targetY: number): AutomaticRelationship {
  const deltaY = targetY - sourceY;
  if (Math.abs(deltaY) <= AUTOMATIC_RELATIONSHIP_Y_TOLERANCE) {
    return { type: 'marriage', source: sourceId, target: targetId, targetRole: 'Partner' };
  }
  return deltaY > 0
    ? { type: 'biological-child', source: sourceId, target: targetId, targetRole: 'Child' }
    : { type: 'biological-child', source: targetId, target: sourceId, targetRole: 'Parent' };
}

export interface PersonSymbolAnchorOffsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function personSymbolSize(person: Person): number {
  return PERSON_SYMBOL_SIZES[person.visualSettings?.size ?? 'medium'];
}

function personSymbolOffsets(person: Person, symbolSize: number): PersonSymbolAnchorOffsets {
  let bounds = { left: 28, right: 84, top: 30, bottom: 86 };
  if (person.symbolKind === 'pregnancy') bounds = { left: 26, right: 86, top: 35, bottom: 88 };
  if (person.symbolKind === 'miscarriage') bounds = { left: 46, right: 66, top: 48, bottom: 68 };
  if (person.symbolKind === 'termination') bounds = { left: 39, right: 73, top: 24, bottom: 75 };
  if (person.symbolKind === 'stillbirth') 
    bounds = person.isIndexPerson
      ? { left: 23, right: 89, top: 29, bottom: 91 }
      : { left: 26, right: 86, top: 35, bottom: 88 };
  if (person.symbolKind === 'person' && (person.gender === 'unspecified' || person.gender === 'other')) {
    bounds = person.isIndexPerson
      ? { left: 19, right: 93, top: 21, bottom: 95 }
      : { left: 26, right: 86, top: 28, bottom: 88 };
  }
  if (person.symbolKind === 'person' && person.gender === 'nonbinary') {
    bounds = person.isIndexPerson
      ? { left: 19, right: 93, top: 23, bottom: 95 }
      : { left: 26, right: 86, top: 30, bottom: 88 };
  }
  if (person.symbolKind === 'person' && (person.gender === 'male' || person.gender === 'trans-male' ) ) {
    bounds = person.isIndexPerson
      ? { left: 21, right: 91, top: 22, bottom: 93 }
      : { left: 22, right: 90, top: 29, bottom: 92 };
  }
  if (person.symbolKind === 'person' && (person.gender === 'female' || person.gender === 'trans-female' || person.gender === 'intersex') ) {
    bounds = person.isIndexPerson
      ? { left: 21, right: 91, top: 23, bottom: 93 }
      : { left: 22, right: 90, top: 30, bottom: 92 };
  }
  const symbolLeft = (PERSON_NODE_WIDTH - symbolSize) / 2;
  const symbolTop = (PERSON_SYMBOL_SIZES.medium - symbolSize) / 2;
  const scale = symbolSize / PERSON_SYMBOL_VIEWBOX;
  return {
    top: symbolTop + bounds.top * scale,
    right: symbolLeft + bounds.right * scale,
    bottom: symbolTop + bounds.bottom * scale,
    left: symbolLeft + bounds.left * scale,
  };
}

export function personSymbolAnchorOffsets(person: Person): PersonSymbolAnchorOffsets {
  // Display size scales the symbol only; relationship geometry stays on the
  // standard canvas anchors so S/M/L toggles cannot reshape existing lines.
  return personSymbolOffsets(person, PERSON_SYMBOL_SIZES.medium);
}

export function personSymbolBoundsOffsets(person: Person): PersonSymbolAnchorOffsets {
  return personSymbolOffsets(person, personSymbolSize(person));
}

function relationshipLineOffset(relationship: Relationship): number {
  const value = relationship.attributes.lineOffset;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(12, Math.min(240, value)) : DEFAULT_PARTNER_LINE_OFFSET;
}

function fallbackPosition(index: number): Position {
  return { x: 230 + (index % 2) * 230, y: 130 + Math.floor(index / 2) * 230 };
}

function personPosition(project: Project, personId: string): Position {
  const index = project.people.findIndex((person) => person.id === personId);
  return project.canvas.positions[personId] ?? fallbackPosition(Math.max(index, 0));
}

function personCenterX(project: Project, personId: string): number {
  return personPosition(project, personId).x + PERSON_NODE_WIDTH / 2;
}

function pairKey(source: string, target: string): string {
  return [source, target].sort().join('::');
}

interface PartnerUnion {
  id: string;
  relationshipId: string;
  parentIds: [string, string];
  left: number;
  right: number;
  position: Position;
}

interface FamilyChild {
  childId: string;
  relationshipIds: string[];
  lineKind: FamilyChildBranch['lineKind'];
}

interface FamilyGroup {
  union: PartnerUnion;
  children: FamilyChild[];
}

interface FamilyStructure {
  groups: FamilyGroup[];
  consumedRelationshipIds: Set<string>;
}

function derivePartnerUnions(project: Project): Map<string, PartnerUnion> {
  const people = new Set(project.people.map((person) => person.id));
  const unions = new Map<string, PartnerUnion>();
  for (const relationship of project.relationships) {
    if (!isPartnerRelationship(relationship.type) || !people.has(relationship.source) || !people.has(relationship.target)) continue;
    const key = pairKey(relationship.source, relationship.target);
    if (unions.has(key)) continue;
    const first = personPosition(project, relationship.source);
    const second = personPosition(project, relationship.target);
    const firstCenterX = personCenterX(project, relationship.source);
    const secondCenterX = personCenterX(project, relationship.target);
    unions.set(key, {
      id: `junction:${key}`,
      relationshipId: relationship.id,
      parentIds: [relationship.source, relationship.target],
      left: Math.min(firstCenterX, secondCenterX),
      right: Math.max(firstCenterX, secondCenterX),
      position: {
        x: (firstCenterX + secondCenterX) / 2 - 0.5,
        y: Math.max(
          first.y + personSymbolAnchorOffsets(project.people.find((person) => person.id === relationship.source) as Person).bottom,
          second.y + personSymbolAnchorOffsets(project.people.find((person) => person.id === relationship.target) as Person).bottom,
        ) + relationshipLineOffset(relationship),
      },
    });
  }
  return unions;
}

export function projectToPartnerUnionTargets(project: Project): PartnerUnionTarget[] {
  return [...derivePartnerUnions(project).values()].map((union) => ({
    id: union.id,
    relationshipId: union.relationshipId,
    parentIds: [...union.parentIds],
    left: union.left,
    right: union.right,
    x: union.position.x + 0.5,
    y: union.position.y,
  }));
}

function childLineDetails(relationships: Relationship[]): Pick<FamilyChildBranch, 'lineKind' | 'badge' | 'immigrationMarker'> {
  const relationship = relationships[0];
  const immigrationMarker = relationship?.attributes.immigrationMarker === 'single' || relationship?.attributes.immigrationMarker === 'double'
    ? relationship.attributes.immigrationMarker
    : undefined;
  if (relationships.some((item) => item.type === 'surrogate-child')) return { lineKind: 'child-surrogate', badge: 'S', immigrationMarker };
  if (relationships.some((item) => item.type === 'sperm-donor-child')) return { lineKind: 'child-donor', badge: 'SD', immigrationMarker };
  if (relationships.some((item) => item.type === 'egg-donor-child')) return { lineKind: 'child-donor', badge: 'ED', immigrationMarker };
  if (relationships.some((item) => item.type === 'step-child')) return { lineKind: 'child-step', immigrationMarker };
  if (relationships.some((item) => item.type === 'foster-child')) return { lineKind: 'child-dotted', immigrationMarker };
  if (relationships.some((item) => item.type === 'adopted-child')) return { lineKind: 'child-dashed', immigrationMarker };
  return { lineKind: 'child-solid', immigrationMarker };
}

function deriveFamilyStructure(project: Project): FamilyStructure {
  const unions = derivePartnerUnions(project);
  const people = new Set(project.people.map((person) => person.id));
  const byChild = new Map<string, Relationship[]>();
  for (const relationship of project.relationships) {
    if (!isChildRelationship(relationship.type) || !people.has(relationship.source) || !people.has(relationship.target)) continue;
    const relationships = byChild.get(relationship.target) ?? [];
    relationships.push(relationship);
    byChild.set(relationship.target, relationships);
  }

  const groups = new Map<string, FamilyGroup>();
  const consumedRelationshipIds = new Set<string>();
  for (const [childId, relationships] of byChild) {
    let union: PartnerUnion | undefined;
    let matching: Relationship[] = [];
    for (let firstIndex = 0; firstIndex < relationships.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < relationships.length; secondIndex += 1) {
        const candidate = unions.get(pairKey(relationships[firstIndex].source, relationships[secondIndex].source));
        if (!candidate) continue;
        union = candidate;
        matching = [relationships[firstIndex], relationships[secondIndex]];
        break;
      }
      if (union) break;
    }
    if (!union) continue;
    const group = groups.get(union.id) ?? { union, children: [] };
    group.children.push({ childId, relationshipIds: matching.map((item) => item.id), ...childLineDetails(matching) });
    groups.set(union.id, group);
    matching.forEach((relationship) => consumedRelationshipIds.add(relationship.id));
  }

  for (const relationship of project.relationships) {
    if (!isTwinRelationship(relationship.type)) continue;
    const group = [...groups.values()].find((candidate) => {
      const childIds = new Set(candidate.children.map((child) => child.childId));
      return childIds.has(relationship.source) && childIds.has(relationship.target);
    });
    if (group) consumedRelationshipIds.add(relationship.id);
  }
  return { groups: [...groups.values()], consumedRelationshipIds };
}

function createJunctionNodes(structure: FamilyStructure): JunctionFlowNode[] {
  return structure.groups.map(({ union }) => ({
    id: union.id,
    type: 'junction',
    position: union.position,
    data: { unionId: union.id, parentIds: [...union.parentIds] },
    selectable: false,
    draggable: false,
    connectable: false,
    focusable: false,
    sourcePosition: FlowPosition.Bottom,
    zIndex: 1,
    ariaLabel: 'Family relationship junction',
  }));
}

function createHouseholdNodes(project: Project, selected: Set<string>): HouseholdFlowNode[] {
  return project.households.flatMap((household) => {
    const positions = household.memberIds
      .filter((id) => project.people.some((person) => person.id === id))
      .map((id) => personPosition(project, id));
    if (positions.length === 0) return [];
    const minX = Math.min(...positions.map((position) => position.x)) - HOUSEHOLD_PADDING;
    const minY = Math.min(...positions.map((position) => position.y)) - HOUSEHOLD_PADDING;
    const maxX = Math.max(...positions.map((position) => position.x + PERSON_NODE_WIDTH)) + HOUSEHOLD_PADDING;
    const maxY = Math.max(...positions.map((position) => position.y + PERSON_NODE_HEIGHT)) + HOUSEHOLD_PADDING;
    return [{
      id: household.id,
      type: 'household' as const,
      className: 'genogram-household-flow-node',
      position: { x: minX, y: minY },
      data: { household, width: maxX - minX, height: maxY - minY },
      style: { width: maxX - minX, height: maxY - minY, pointerEvents: 'none' },
      selected: selected.has(household.id),
      draggable: false,
      connectable: false,
      selectable: true,
      zIndex: -10,
      ariaLabel: `${household.label} family boundary`,
    }];
  });
}

function relationshipHandles(project: Project, relationship: Relationship) {
  const definition = getRelationshipDefinition(relationship.type);
  if (definition.category === 'partner') return { sourceHandle: 'bottom-source', targetHandle: 'bottom-target' };
  if (relationship.type === 'sibling') return { sourceHandle: 'top-source', targetHandle: 'top-target' };
  if (isChildRelationship(relationship.type)) return { sourceHandle: 'bottom-source', targetHandle: 'top-target' };
  if (isTwinRelationship(relationship.type)) return { sourceHandle: 'top-source', targetHandle: 'top-target' };
  if (definition.category === 'emotional') return { sourceHandle: 'center-source', targetHandle: 'center-target' };
  const sourceX = personCenterX(project, relationship.source);
  const targetX = personCenterX(project, relationship.target);
  return sourceX <= targetX
    ? { sourceHandle: 'right-source', targetHandle: 'left-target' }
    : { sourceHandle: 'left-source', targetHandle: 'right-target' };
}

function createRelationshipEdge(project: Project, relationship: Relationship, selected: Set<string>): RelationshipFlowEdge {
  const selectedEdge = selected.has(relationship.id);
  const definition = getRelationshipDefinition(relationship.type);
  const customColor = typeof relationship.attributes.color === 'string' ? relationship.attributes.color : null;
  const markerColor = relationship.attributes.hidden === true ? 'transparent' : (customColor ?? (selectedEdge ? '#4f857c' : (definition.color ?? '#000000')));
  return {
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    ...relationshipHandles(project, relationship),
    type: 'relationship',
    data: { relationship },
    selected: selectedEdge,
    interactionWidth: 26,
    markerEnd: definition.directed ? { type: MarkerType.ArrowClosed, color: markerColor } : undefined,
    zIndex: 2,
  };
}

function createFamilyEdges(project: Project, structure: FamilyStructure, selected: Set<string>): FamilyFlowEdge[] {
  const twinRelationships = project.relationships.filter((relationship) => isTwinRelationship(relationship.type));
  return structure.groups.flatMap(({ union, children }) => {
    if (children.length === 0) return [];
    const childById = new Map(children.map((child) => [child.childId, child]));
    const used = new Set<string>();
    const twins: FamilyTwinBranch[] = [];
    for (const relationship of twinRelationships) {
      const first = childById.get(relationship.source);
      const second = childById.get(relationship.target);
      if (!first || !second || used.has(first.childId) || used.has(second.childId)) continue;
      used.add(first.childId);
      used.add(second.childId);
      twins.push({
        twinRelationshipId: relationship.id,
        type: relationship.type as FamilyTwinBranch['type'],
        first: { ...first, x: personCenterX(project, first.childId), y: personPosition(project, first.childId).y + personSymbolAnchorOffsets(project.people.find((person) => person.id === first.childId) as Person).top },
        second: { ...second, x: personCenterX(project, second.childId), y: personPosition(project, second.childId).y + personSymbolAnchorOffsets(project.people.find((person) => person.id === second.childId) as Person).top },
      });
    }
    const singles = children
      .filter((child) => !used.has(child.childId))
      .map((child) => ({ ...child, x: personCenterX(project, child.childId), y: personPosition(project, child.childId).y + personSymbolAnchorOffsets(project.people.find((person) => person.id === child.childId) as Person).top }));
    const relationshipIds = [
      ...children.flatMap((child) => child.relationshipIds),
      ...twins.map((twin) => twin.twinRelationshipId),
    ];
    const defaultBranch = leftmostFamilyBranchSelection({ singles, twins });
    const geometryRelationship = defaultBranch?.relationshipIds
      .map((id) => project.relationships.find((relationship) => relationship.id === id))
      .find((relationship) => relationship && isChildRelationship(relationship.type));
    const styledRelationship = relationshipIds
      .map((id) => project.relationships.find((relationship) => relationship.id === id))
      .find((relationship) => relationship && selected.has(relationship.id))
      ?? project.relationships.find((relationship) => relationshipIds.includes(relationship.id));
    const color = typeof styledRelationship?.attributes.color === 'string' ? styledRelationship.attributes.color : undefined;
    const hidden = styledRelationship?.attributes.hidden === true;
    const relationshipLabel = typeof styledRelationship?.attributes.label === 'string' ? styledRelationship.attributes.label.trim() : undefined;
    const storedSiblingOffset = geometryRelationship?.attributes.siblingOffset;
    const siblingOffset = typeof storedSiblingOffset === 'number' && Number.isFinite(storedSiblingOffset) ? storedSiblingOffset : undefined;
    const storedOriginOffset = geometryRelationship?.attributes.familyOriginOffset;
    const originOffset = typeof storedOriginOffset === 'number' && Number.isFinite(storedOriginOffset) ? storedOriginOffset : undefined;
    const childTopY = Math.min(
      ...singles.map((branch) => branch.y),
      ...twins.flatMap((twin) => [twin.first.y, twin.second.y]),
    );
    const sourceY = union.position.y;
    const childGap = Math.max(56, childTopY - sourceY);
    const siblingY = Math.max(sourceY + 28, Math.min(childTopY - 68, sourceY + Math.max(52, childGap * 0.72)));
    return [{
      id: `family:${union.id}`,
      source: union.id,
      target: children[0].childId,
      sourceHandle: 'bottom-source',
      targetHandle: 'top-target',
      type: 'family' as const,
      data: {
        relationshipIds,
        selectedRelationshipIds: relationshipIds.filter((relationshipId) => selected.has(relationshipId)),
        unionId: union.id,
        parentLeftX: union.left,
        parentRightX: union.right,
        parentLineY: union.position.y,
        siblingY,
        siblingOffset,
        originOffset,
        singles,
        twins,
        label: 'Children from partner union',
        relationshipLabel,
        color,
        hidden,
      },
      selected: relationshipIds.some((id) => selected.has(id)),
      selectable: false,
      interactionWidth: 26,
      zIndex: 2,
    }];
  });
}

export function projectToFlowNodes(
  project: Project,
  selectedPersonIds: string[] = [],
  selectedHouseholdIds: string[] = [],
  selectedAnnotationIds: string[] = [],
): FlowNode[] {
  const selectedPeople = new Set(selectedPersonIds);
  const selectedHouseholds = new Set(selectedHouseholdIds);
  const selectedAnnotations = new Set(selectedAnnotationIds);
  const structure = deriveFamilyStructure(project);
  const peopleNodes: PersonFlowNode[] = project.people.map((person, index) => ({
    id: person.id,
    type: 'person',
    position: project.canvas.positions[person.id] ?? fallbackPosition(index),
    measured: { width: PERSON_NODE_WIDTH, height: PERSON_NODE_HEIGHT },
    data: { person },
    selected: selectedPeople.has(person.id),
    draggable: true,
    connectable: true,
    zIndex: 3,
  }));
  const annotationNodes: AnnotationFlowNode[] = project.annotations.map((annotation, index) => ({
    id: annotation.id,
    type: 'annotation',
    position: project.canvas.positions[annotation.id] ?? { x: 300 + index * 24, y: 300 + index * 24 },
    style: annotation.kind === 'note' ? { width: annotation.width ?? 190, height: annotation.height ?? 116 } : undefined,
    data: { annotation },
    selected: selectedAnnotations.has(annotation.id),
    draggable: true,
    connectable: true,
    zIndex: 4,
    ariaLabel: `${annotation.kind === 'note' ? 'Note' : annotation.kind === 'secret' ? 'Family secret' : 'Text'}: ${annotation.text}`,
  }));
  return [...createHouseholdNodes(project, selectedHouseholds), ...peopleNodes, ...annotationNodes, ...createJunctionNodes(structure)];
}

export function projectToFlowEdges(project: Project, selectedIds: string[] = [], selectedAnnotationLinkId: string | null = null): FlowEdge[] {
  const selected = new Set(selectedIds);
  const people = new Set(project.people.map((person) => person.id));
  const structure = deriveFamilyStructure(project);
  const directEdges = project.relationships
    .filter((relationship) => people.has(relationship.source) && people.has(relationship.target) && !structure.consumedRelationshipIds.has(relationship.id))
    .map((relationship) => createRelationshipEdge(project, relationship, selected));
  const annotationLinkTargets = new Set([...people, ...project.annotations.map((annotation) => annotation.id)]);
  const annotationLinks: AnnotationLinkFlowEdge[] = project.annotations.flatMap((annotation) => (annotation.linkedIds ?? [])
    .filter((targetId) => targetId !== annotation.id && annotationLinkTargets.has(targetId))
    .map((targetId) => {
      const id = `annotation-link-${annotation.id}-${targetId}`;
      const attributes = annotation.linkAttributes?.[targetId] ?? {};
      const isSelected = selectedAnnotationLinkId === id;
      const color = attributes.color ?? '#64748b';
      return {
        id,
        source: annotation.id,
        target: targetId,
        sourceHandle: 'center-source',
        targetHandle: 'center-target',
        type: 'straight' as const,
        data: { kind: 'annotation-link' as const, sourceAnnotationId: annotation.id, targetId },
        style: { stroke: color, strokeWidth: isSelected ? 3 : 1.8, strokeDasharray: '6 5', opacity: attributes.hidden ? (isSelected ? 0.35 : 0.08) : 1 },
        selected: isSelected,
        selectable: true,
        focusable: false,
        interactionWidth: 18,
        zIndex: 0,
      } as AnnotationLinkFlowEdge;
    }));
  return [...annotationLinks, ...directEdges, ...createFamilyEdges(project, structure, selected)];
}
