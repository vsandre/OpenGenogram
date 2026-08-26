import { DEFAULT_PARTNER_LINE_OFFSET, SIBLING_LINE_OFFSET, personSymbolAnchorOffsets, projectToFlowNodes, type FlowNode } from './flow-adapter';
import { getRelationshipDefinition, type CanvasAnnotationKind, type JsonValue, type Project } from './model';
import { getProjectFileName } from './project-file';

export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PngExportPlan {
  width: number;
  height: number;
  pixelRatio: number;
  outputWidth: number;
  outputHeight: number;
  contentScale: number;
  translateX: number;
  translateY: number;
}

export const PNG_EXPORT_PADDING = 56;
export const PNG_EXPORT_PIXEL_RATIO = 2;
export const PNG_MAX_OUTPUT_DIMENSION = 8192;
export const PNG_MAX_OUTPUT_PIXELS = 32 * 1024 * 1024;

const ANNOTATION_SIZES: Record<CanvasAnnotationKind, { width: number; height: number }> = {
  text: { width: 180, height: 48 },
  secret: { width: 120, height: 96 },
  note: { width: 190, height: 116 },
};

function nodeSize(node: FlowNode): { width: number; height: number } {
  if (node.type === 'annotation') {
    const defaults = ANNOTATION_SIZES[node.data.annotation.kind];
    return node.data.annotation.kind === 'note'
      ? { width: node.data.annotation.width ?? defaults.width, height: node.data.annotation.height ?? defaults.height }
      : defaults;
  }
  if (node.type === 'household') return { width: node.data.width, height: node.data.height };
  if (node.type === 'person') return { width: 132, height: 180 };
  return { width: 1, height: 1 };
}

function nodeRectangle(node: FlowNode): ExportBounds {
  const size = nodeSize(node);
  if (node.type !== 'person') return { ...node.position, ...size };
  const showsMedicalDetails = node.data.person.symbolKind === 'person'
    && node.data.person.visualSettings?.showMedical !== false
    && node.data.person.medicalMarkers.length > 0;
  const width = showsMedicalDetails ? 300 : size.width;
  return {
    x: node.position.x - (width - size.width) / 2,
    y: node.position.y,
    width,
    height: size.height,
  };
}

interface Point { x: number; y: number }

function emotionalControlPoints(project: Project): Point[] {
  const people = new Map(project.people.map((person) => [person.id, person]));
  return project.relationships.flatMap((relationship) => {
    if (getRelationshipDefinition(relationship.type).category !== 'emotional') return [];
    const sourcePerson = people.get(relationship.source);
    const targetPerson = people.get(relationship.target);
    const sourcePosition = project.canvas.positions[relationship.source];
    const targetPosition = project.canvas.positions[relationship.target];
    if (!sourcePerson || !targetPerson || !sourcePosition || !targetPosition) return [];

    const sourceAnchors = personSymbolAnchorOffsets(sourcePerson);
    const targetAnchors = personSymbolAnchorOffsets(targetPerson);
    const sourceCenterX = sourcePosition.x + 66;
    const targetCenterX = targetPosition.x + 66;
    const leftToRight = sourceCenterX <= targetCenterX;
    const source = {
      x: sourcePosition.x + (leftToRight ? sourceAnchors.right - 1 : sourceAnchors.left + 1),
      y: sourcePosition.y + 42,
    };
    const target = {
      x: targetPosition.x + (leftToRight ? targetAnchors.left + 1 : targetAnchors.right - 1),
      y: targetPosition.y + 42,
    };
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const unitX = dx / length;
    const unitY = dy / length;
    const normalX = -unitY;
    const normalY = unitX;
    const controls = relationship.attributes.controlPoints;
    if (!Array.isArray(controls)) return [];

    return controls.flatMap((value: JsonValue) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const progress = value.t;
      const offset = value.offset;
      if (typeof progress !== 'number' || typeof offset !== 'number' || !Number.isFinite(progress) || !Number.isFinite(offset)) return [];
      const clampedProgress = Math.max(0.06, Math.min(0.94, progress));
      const clampedOffset = Math.max(-260, Math.min(260, offset));
      return [{
        x: source.x + unitX * length * clampedProgress + normalX * clampedOffset,
        y: source.y + unitY * length * clampedProgress + normalY * clampedOffset,
      }];
    });
  });
}

function partnerLinePoints(project: Project): Point[] {
  const people = new Map(project.people.map((person) => [person.id, person]));
  return project.relationships.flatMap((relationship) => {
    if (getRelationshipDefinition(relationship.type).category !== 'partner') return [];
    const sourcePerson = people.get(relationship.source);
    const targetPerson = people.get(relationship.target);
    const sourcePosition = project.canvas.positions[relationship.source];
    const targetPosition = project.canvas.positions[relationship.target];
    if (!sourcePerson || !targetPerson || !sourcePosition || !targetPosition) return [];
    const sourceY = sourcePosition.y + personSymbolAnchorOffsets(sourcePerson).bottom - 1;
    const targetY = targetPosition.y + personSymbolAnchorOffsets(targetPerson).bottom - 1;
    const storedOffset = relationship.attributes.lineOffset;
    const lineOffset = typeof storedOffset === 'number' && Number.isFinite(storedOffset)
      ? Math.max(12, Math.min(240, storedOffset))
      : DEFAULT_PARTNER_LINE_OFFSET;
    return [{ x: (sourcePosition.x + targetPosition.x) / 2 + 66, y: Math.max(sourceY, targetY) + lineOffset }];
  });
}

function siblingLinePoints(project: Project): Point[] {
  const people = new Map(project.people.map((person) => [person.id, person]));
  return project.relationships.flatMap((relationship) => {
    if (relationship.type !== 'sibling') return [];
    const sourcePerson = people.get(relationship.source);
    const targetPerson = people.get(relationship.target);
    const sourcePosition = project.canvas.positions[relationship.source];
    const targetPosition = project.canvas.positions[relationship.target];
    if (!sourcePerson || !targetPerson || !sourcePosition || !targetPosition) return [];
    const sourceY = sourcePosition.y + personSymbolAnchorOffsets(sourcePerson).top + 1;
    const targetY = targetPosition.y + personSymbolAnchorOffsets(targetPerson).top + 1;
    const storedOffset = relationship.attributes.lineOffset;
    const lineOffset = typeof storedOffset === 'number' && Number.isFinite(storedOffset)
      ? Math.max(12, Math.min(240, storedOffset))
      : SIBLING_LINE_OFFSET;
    return [{ x: (sourcePosition.x + targetPosition.x) / 2 + 66, y: Math.min(sourceY, targetY) - lineOffset }];
  });
}

export function getProjectExportBounds(project: Project): ExportBounds | null {
  const nodes = projectToFlowNodes(project);
  if (nodes.length === 0) return null;

  const rectangles = [
    ...nodes.map(nodeRectangle),
    ...emotionalControlPoints(project).map((point) => ({ ...point, width: 0, height: 0 })),
    ...partnerLinePoints(project).map((point) => ({ ...point, width: 0, height: 0 })),
    ...siblingLinePoints(project).map((point) => ({ ...point, width: 0, height: 0 })),
  ];
  const minX = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const minY = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const maxX = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width));
  const maxY = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function createPngExportPlan(bounds: ExportBounds): PngExportPlan {
  const naturalWidth = bounds.width + PNG_EXPORT_PADDING * 2;
  const naturalHeight = bounds.height + PNG_EXPORT_PADDING * 2;
  const dimensionScale = PNG_MAX_OUTPUT_DIMENSION
    / (Math.max(naturalWidth, naturalHeight) * PNG_EXPORT_PIXEL_RATIO);
  const pixelScale = Math.sqrt(
    PNG_MAX_OUTPUT_PIXELS
      / (naturalWidth * naturalHeight * PNG_EXPORT_PIXEL_RATIO * PNG_EXPORT_PIXEL_RATIO),
  );
  const contentScale = Math.min(1, dimensionScale, pixelScale);
  const width = Math.max(1, Math.floor(naturalWidth * contentScale));
  const height = Math.max(1, Math.floor(naturalHeight * contentScale));
  return {
    width,
    height,
    pixelRatio: PNG_EXPORT_PIXEL_RATIO,
    outputWidth: width * PNG_EXPORT_PIXEL_RATIO,
    outputHeight: height * PNG_EXPORT_PIXEL_RATIO,
    contentScale,
    translateX: (PNG_EXPORT_PADDING - bounds.x) * contentScale,
    translateY: (PNG_EXPORT_PADDING - bounds.y) * contentScale,
  };
}

export function getPngExportFileName(project: Project): string {
  return getProjectFileName(project, 'png');
}
