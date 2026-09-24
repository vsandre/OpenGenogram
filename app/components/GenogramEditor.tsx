'use client';

import {
  Background,
  Controls,
  Handle,
  NodeResizeControl,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useUpdateNodeInternals,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeProps,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type Viewport as FlowViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeftRight, Baby, Bold, BookOpen, BoxSelect, BriefcaseBusiness, CalendarDays, ChevronDown, Coins, Copy, Download, Pencil, Eye, EyeOff, FolderOpen, GitBranch, Globe2, GraduationCap, Group, Hand, Heart, House, ImageDown, Italic, Layers, Link2, MapPin, MessageSquare, Minus, MousePointer2, Palette, Plus, Sparkles, Star, StickyNote, Tags, Trash2, Triangle, Type, Underline, UserRound, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { toPng } from 'html-to-image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

import {
  createEmptyProject,
  createId,
  createPreviewProject,
  CHILD_RELATIONSHIP_TYPES,
  CULTURAL_HERITAGE_PATTERNS,
  GENDERS,
  getRelationshipConnectionError,
  getRelationshipDefinition,
  isChildRelationship,
  MEDICAL_MARKER_COLORS,
  MEDICAL_MARKER_STATUSES,
  MEDICAL_CONDITION_PRESETS,
  createDefaultCanvasViewVisibility,
  createDefaultPersonLabelVisibility,
  createDefaultPersonVisualSettings,
  createEmptyPersonProfile,
  PERSON_DISPLAY_SIZES,
  RELATIONSHIP_CATEGORY_LABELS,
  RELATIONSHIP_DEFINITIONS,
  SYMBOL_KINDS,
  SYMBOL_KIND_LABELS,
  type Gender,
  type CanvasViewKey,
  type CanvasViewVisibility,
  type CanvasAnnotation,
  type CanvasAnnotationKind,
  type CulturalHeritagePattern,
  type Household,
  type MedicalMarker,
  type MedicalMarkerColor,
  type MedicalMarkerStatus,
  type Person,
  type PersonDisplaySize,
  type PersonLabelKey,
  type PersonLabelVisibility,
  type PersonProfile,
  type PersonVisualSettings,
  type Project,
  type Relationship,
  type RelationshipCategory,
  type RelationshipLineKind,
  type RelationshipType,
} from '../lib/genogram/model';
import { importLocalProject, loadLocalProject, saveLocalProject } from '../lib/genogram/local-persistence';
import { createPngExportPlan, getPngExportFileName, getProjectExportBounds } from '../lib/genogram/export-png';
import { getProjectFileName, MAX_PROJECT_FILE_BYTES, parseProjectFile, serializeProject } from '../lib/genogram/project-file';
import {
  CANVAS_GRID_SIZE,
  inferAutomaticRelationship,
  projectToFlowEdges,
  projectToFlowNodes,
  personSymbolAnchorOffsets,
  personSymbolBoundsOffsets,
  personSymbolSize,
  type FlowEdge,
  type FlowNode,
  type HouseholdFlowNode,
  type AnnotationFlowNode,
  type PersonFlowNode,
} from '../lib/genogram/flow-adapter';
import { useGenogramStore, type QuickRelativeKind } from '../lib/genogram/store';
import { COUNTRY_OPTIONS, countryFlag } from '../lib/countries';
import { GenogramFamilyEdge } from './GenogramFamilyEdge';
import { GenogramRelationshipEdge } from './GenogramRelationshipEdge';
import styles from './GenogramEditor.module.css';
import { PersonSymbol, ReligionIcon } from './PersonSymbol';

export type GenogramEditorMode = 'preview' | 'edit';
export interface GenogramEditorProps { mode?: GenogramEditorMode; initialProject?: Project; projectId?: string | null }

const genderLabels: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  'trans-male': 'Transgender male',
  'trans-female': 'Transgender female',
  nonbinary: 'Non-binary',
  intersex: 'Intersex',
  unspecified: 'Unknown',
  other: 'Other',
};
const addPersonGenders = ['male', 'female', 'unspecified'] as const satisfies readonly Gender[];
const relationshipCategories: RelationshipCategory[] = ['partner', 'child', 'emotional'];
const emotionalRelationshipGroups: Array<{ label: string; types: RelationshipType[] }> = [
  { label: 'McGoldrick standard', types: ['connection', 'close', 'fused', 'distant', 'hostile', 'close-hostile', 'emotional-abuse', 'physical-abuse', 'sexual-abuse', 'focused', 'negative-focused', 'caregiver', 'cutoff', 'repaired-cutoff'] },
  { label: 'Extended', types: ['indifferent', 'never-met'] },
  { label: 'Positive', types: ['harmonious', 'friendship', 'love', 'romantic-love', 'attachment', 'infatuation'] },
  { label: 'Hostile & violence', types: ['conflict', 'hatred', 'distrust', 'distant-hostile', 'fused-conflict', 'violence', 'distant-violence', 'close-violence', 'fused-violence'] },
  { label: 'Abuse & control', types: ['abuse', 'physical-neglect', 'emotional-neglect', 'manipulation', 'control'] },
  { label: 'Attention', types: ['jealousy', 'admirer'] },
];
const medicalStatusLabels: Record<MedicalMarkerStatus, string> = { active: 'Active', recovery: 'Recovery', suspected: 'Suspected' };
const relationshipLineColors = ['#64748b', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#9333ea', '#db2777', '#111827'] as const;
const personColorOptions = ['#fbfdfa', '#dcebe5', '#e9e1d5', '#f3e7e9', '#e5edef', '#f1e7e1', '#e8eeeb', '#1d2f3a'] as const;
const heritagePatternLabels: Record<CulturalHeritagePattern, string> = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  'diagonal-right': 'Right diagonal',
  'diagonal-left': 'Left diagonal',
  grid: 'Grid',
  dots: 'Dots',
  waves: 'Waves',
  woven: 'Woven',
  checker: 'Checker',
};
const religionPresets = [
  { label: 'Christian' }, { label: 'Catholic' }, { label: 'Orthodox' },
  { label: 'Mormon' }, { label: "Jehovah's Witness" }, { label: 'Jewish' },
  { label: 'Islam' }, { label: 'Buddhist' }, { label: 'Hindu' },
  { label: 'Sikh' }, { label: 'Spiritual' }, { label: 'None' }, { label: 'Other' },
] as const;
const socialClassPresets = [
  { label: 'Upper class', description: 'Affluent / aristocratic' },
  { label: 'Upper-middle class', description: 'Professionals / management' },
  { label: 'Middle class', description: 'White-collar / technical' },
  { label: 'Working class', description: 'Blue-collar / manual labor' },
  { label: 'Poverty', description: 'Low income / unemployed' },
] as const;
const sexualOrientationOptions = ['Heterosexual', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Queer', 'Questioning', 'Unknown', 'Other', 'Prefer not to say'] as const;
const educationPresets = [
  { code: '—', label: 'No formal education' }, { code: 'K5', label: 'Primary school' },
  { code: 'HS', label: 'Middle / high school' }, { code: 'VOC', label: 'Technical / vocational' },
  { code: 'SC', label: 'Some college' }, { code: 'AA', label: 'Associate degree' },
  { code: 'BA', label: "Bachelor's degree" }, { code: 'MA', label: "Master's degree" },
  { code: 'PhD', label: 'Doctorate' }, { code: 'PRO', label: 'Professional degree (MD/JD)' },
] as const;
const personLabelOptions: Array<{ key: PersonLabelKey; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'birthYear', label: 'Birth year' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'orientation', label: 'Orientation' },
  { key: 'heritage', label: 'Heritage' },
  { key: 'religion', label: 'Religion' },
  { key: 'socialClass', label: 'Class' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'school', label: 'School' },
  { key: 'education', label: 'Education' },
  { key: 'location', label: 'Location' },
  { key: 'birthPlace', label: 'Birth place' },
  { key: 'medical', label: 'Medical' },
  { key: 'custom', label: 'Custom' },
  { key: 'notes', label: 'Notes' },
];

const canvasViewOptions: Array<{ key: CanvasViewKey; label: string; icon: LucideIcon }> = [
  { key: 'cultural', label: 'Cultural', icon: Globe2 },
  { key: 'medical', label: 'Medical', icon: Heart },
  { key: 'social', label: 'Social', icon: Coins },
  { key: 'religion', label: 'Religion', icon: Star },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'custom', label: 'Custom', icon: Sparkles },
  { key: 'backgrounds', label: 'Backgrounds', icon: Group },
];

interface PersonLabelContextValue {
  visibility: PersonLabelVisibility;
  wrapLongText: boolean;
}
const defaultPersonLabelContext: PersonLabelContextValue = {
  visibility: createDefaultPersonLabelVisibility(),
  wrapLongText: false,
};
const PersonLabelContext = createContext<PersonLabelContextValue>(defaultPersonLabelContext);

interface CanvasViewContextValue {
  visibility: CanvasViewVisibility;
}
const defaultCanvasViewContext: CanvasViewContextValue = {
  visibility: createDefaultCanvasViewVisibility(),
};
const CanvasViewContext = createContext<CanvasViewContextValue>(defaultCanvasViewContext);

type PersonQuickAction = QuickRelativeKind | 'emotional' | 'connection';
interface PersonActionContextValue {
  enabled: boolean;
  run: (personId: string, action: PersonQuickAction) => void;
  isDisabled: (personId: string, action: PersonQuickAction) => boolean;
}
const PersonActionContext = createContext<PersonActionContextValue | null>(null);

interface AnnotationLinkActionContextValue {
  enabled: boolean;
  beginConnection: (annotationId: string) => void;
}
const AnnotationLinkActionContext = createContext<AnnotationLinkActionContextValue | null>(null);

interface AnnotationActionContextValue {
  editingId: string | null;
  finishEditing: () => void;
}
const AnnotationActionContext = createContext<AnnotationActionContextValue | null>(null);

const personQuickActions: Array<{
  action: PersonQuickAction;
  label: string;
  Icon: LucideIcon;
  position: string;
  tone: string;
}> = [
  { action: 'parents', label: 'Add parents', Icon: Users, position: styles.quickActionTop, tone: styles.quickActionParents },
  { action: 'partner', label: 'Add partner', Icon: Heart, position: styles.quickActionUpperRight, tone: styles.quickActionPartner },
  { action: 'sibling', label: 'Add sibling', Icon: UserPlus, position: styles.quickActionLowerRight, tone: styles.quickActionSibling },
  { action: 'child', label: 'Add child', Icon: Baby, position: styles.quickActionBottom, tone: styles.quickActionChild },
  { action: 'emotional', label: 'Emotional Line', Icon: GitBranch, position: styles.quickActionLowerLeft, tone: styles.quickActionEmotional },
  { action: 'connection', label: 'Draw connection', Icon: Link2, position: styles.quickActionUpperLeft, tone: styles.quickActionConnection },
];

function PersonNode({ id, data, selected }: NodeProps<PersonFlowNode>) {
  const { person } = data;
  const anchors = personSymbolAnchorOffsets(person);
  const symbolSize = personSymbolSize(person);
  const updateNodeInternals = useUpdateNodeInternals();
  const visualSettings = { ...createDefaultPersonVisualSettings(), ...person.visualSettings };
  const profile = { ...createEmptyPersonProfile(), ...person.profile };
  const anchorStyle = {
    '--symbol-anchor-top': `${anchors.top}px`,
    '--symbol-anchor-right': `${anchors.right}px`,
    '--symbol-anchor-bottom': `${anchors.bottom}px`,
    '--symbol-anchor-left': `${anchors.left}px`,
    '--symbol-anchor-center-y': `${(anchors.top + anchors.bottom) / 2}px`,
    '--person-symbol-size': `${symbolSize}px`,
  } as CSSProperties;
  useEffect(() => {
    updateNodeInternals(id);
  }, [anchors.bottom, anchors.left, anchors.right, anchors.top, id, updateNodeInternals]);
  const personActions = useContext(PersonActionContext);
  const labelSettings = useContext(PersonLabelContext);
  const viewSettings = useContext(CanvasViewContext);
  const symbolLabel = SYMBOL_KIND_LABELS[person.symbolKind];
  const culturalHeritage = person.culturalHeritageLayers?.map((layer) => layer.label.trim()).filter(Boolean).join(', ') || profile.culturalHeritage;
  const orientation = profile.sexualOrientation.trim();
  const normalizedOrientation = orientation.toLowerCase();
  const orientationLabel = normalizedOrientation === 'heterosexual' || normalizedOrientation === 'prefer not to say' ? '' : orientation;
  const medicalSummary = person.medicalMarkers.map((marker) => marker.label).join(', ');
  const extraDetails = [
    labelSettings.visibility.orientation && orientationLabel,
    labelSettings.visibility.heritage && viewSettings.visibility.cultural && culturalHeritage,
    labelSettings.visibility.religion && viewSettings.visibility.religion && profile.religion,
    labelSettings.visibility.socialClass && viewSettings.visibility.social && profile.socialClass,
    labelSettings.visibility.occupation && profile.occupation,
    labelSettings.visibility.school && viewSettings.visibility.education && profile.school,
    labelSettings.visibility.education && viewSettings.visibility.education && profile.education,
    labelSettings.visibility.location && viewSettings.visibility.location && profile.location,
    labelSettings.visibility.birthPlace && profile.birthPlace,
    labelSettings.visibility.custom && viewSettings.visibility.custom && profile.attributes,
    labelSettings.visibility.notes && person.notes,
  ].filter((value): value is string => Boolean(value));
  const showBirthYear = person.symbolKind === 'person' && labelSettings.visibility.birthYear && person.birthYear !== null;
  const showGender = person.symbolKind === 'person' && labelSettings.visibility.gender;
  const showMedical = person.symbolKind === 'person' && labelSettings.visibility.medical && viewSettings.visibility.medical && medicalSummary.length > 0;
  const showPrimaryDetails = labelSettings.visibility.name || showBirthYear || showGender || showMedical || extraDetails.length > 0;
  return (
    <div className={`${styles.personNode} ${selected ? styles.personNodeSelected : ''} ${visualSettings.hidden ? styles.personNodeHidden : ''}`} style={anchorStyle} aria-label={`${person.name || symbolLabel}, ${person.symbolKind === 'person' ? genderLabels[person.gender] : symbolLabel}`} data-person-id={person.id}>
      {selected && person.symbolKind === 'person' && personActions?.enabled && (
        <div className={styles.personQuickActions} aria-label="Quick person actions">
          <span className={styles.personQuickActionRing} aria-hidden="true" />
          {personQuickActions.map(({ action, label, Icon, position, tone }) => personActions.isDisabled(person.id, action) ? null : (
            <button
              key={action}
              className={`nodrag nopan ${styles.personQuickAction} ${position} ${tone}`}
              type="button"
              aria-label={label}
              title={label}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); personActions.run(person.id, action); }}
            >
              <Icon aria-hidden="true" size={12} strokeWidth={2} />
              <span className={styles.quickActionLabel} aria-hidden="true">{label}</span>
            </button>
          ))}
        </div>
      )}
      <Handle id="top-target" className={`${styles.handle} ${styles.symbolTopHandle}`} type="target" position={Position.Top} />
      <Handle id="center-target" className={`${styles.handleGhost} ${styles.personLinkTargetHandle}`} type="target" position={Position.Top} />
      <Handle id="center-source" className={`${styles.handleGhost} ${styles.personLinkTargetHandle}`} type="source" position={Position.Top} />
      <Handle id="top-source" className={`${styles.handleGhost} ${styles.symbolTopHandle}`} type="source" position={Position.Top} />
      <Handle id="left-target" className={`${styles.handleGhost} ${styles.symbolLeftHandle}`} type="target" position={Position.Left} />
      <Handle id="left-source" className={`${styles.handleGhost} ${styles.symbolLeftHandle}`} type="source" position={Position.Left} />
      <PersonSymbol person={person} size={symbolSize} showAnnotations={labelSettings.visibility.age} showProfileBadges viewVisibility={viewSettings.visibility} className={styles.personSymbol} />
      {data.connectionCue && <div className={styles.connectionTargetCue} aria-hidden="true"><span className={styles.connectionTargetLabel}>{data.connectionLabel}</span><span className={styles.connectionTargetDot} /></div>}
      {visualSettings.hidden && <span className={styles.hiddenPersonBadge}><EyeOff size={11} aria-hidden="true" />Hidden</span>}
      {showPrimaryDetails && <div className={`${styles.personPrimaryDetails} ${labelSettings.wrapLongText ? styles.personPrimaryDetailsWrap : ''}`}>
        {labelSettings.visibility.name && <strong className={styles.personName}>{person.name || symbolLabel}</strong>}
        {showBirthYear && <span className={styles.personYears}>{person.birthYear}</span>}
        {showGender && <span className={styles.personDetails}>{genderLabels[person.gender]}</span>}
        {showMedical && <span className={styles.personMedicalSummary} title={medicalSummary}>{medicalSummary}</span>}
        {person.symbolKind === 'person' && extraDetails.length > 0 && <span className={styles.personExtraDetails}>{extraDetails.join(' · ')}</span>}
      </div>}
      <Handle id="right-target" className={`${styles.handleGhost} ${styles.symbolRightHandle}`} type="target" position={Position.Right} />
      <Handle id="right-source" className={`${styles.handleGhost} ${styles.symbolRightHandle}`} type="source" position={Position.Right} />
      <Handle id="bottom-target" className={`${styles.handleGhost} ${styles.symbolBottomHandle}`} type="target" position={Position.Bottom} />
      <Handle id="bottom-source" className={`${styles.handle} ${styles.symbolBottomHandle}`} type="source" position={Position.Bottom} />
    </div>
  );
}

function JunctionNode({ data }: NodeProps<Extract<FlowNode, { type: 'junction' }>>) {
  return <div className={styles.junctionNode} aria-label="Family relationship junction" data-union-id={data.unionId}><Handle id="bottom-source" className={styles.junctionHandle} type="source" position={Position.Bottom} /></div>;
}

function HouseholdNode({ data, selected }: NodeProps<HouseholdFlowNode>) {
  return (
    <div className={`${styles.householdNode} ${selected ? styles.householdNodeSelected : ''}`} style={{ width: data.width, height: data.height }} data-household-id={data.household.id}>
      <button type="button" aria-label={`Edit ${data.household.label} family boundary`}>{data.household.label}</button>
    </div>
  );
}

function AnnotationNode({ id, data, selected }: NodeProps<AnnotationFlowNode>) {
  const { annotation } = data;
  const annotationLinkActions = useContext(AnnotationLinkActionContext);
  const annotationActions = useContext(AnnotationActionContext);
  const updateAnnotation = useGenogramStore((state) => state.updateAnnotation);
  const fontFamily = annotation.fontFamily === 'serif' ? 'Georgia, serif' : annotation.fontFamily === 'mono' ? 'ui-monospace, SFMono-Regular, monospace' : 'Inter, ui-sans-serif, system-ui, sans-serif';
  const annotationColor = annotation.kind === 'note' || !annotation.color || annotation.color === '#1d2f3a' ? '#000000' : annotation.color;
  const editingInsideAnnotation = annotation.kind !== 'secret' && annotationActions?.editingId === annotation.id;
  return (
    <div
      className={`${styles.annotationNode} ${styles[`annotation${annotation.kind[0].toUpperCase()}${annotation.kind.slice(1)}`]} ${selected ? styles.annotationNodeSelected : ''}`}
      data-annotation-id={annotation.id}
      style={{
        color: annotationColor,
        backgroundColor: annotation.kind === 'note' ? (annotation.backgroundColor ?? '#f4efe4') : undefined,
        fontFamily,
        fontSize: annotation.fontSize ?? (annotation.kind === 'text' ? 18 : 12),
        fontWeight: annotation.bold ? 700 : 400,
        fontStyle: annotation.italic ? 'italic' : 'normal',
        textDecoration: annotation.underline ? 'underline' : 'none',
      }}
    >
      {annotation.kind === 'note' && selected && <NodeResizeControl
        className={styles.annotationResizeHandle}
        nodeId={id}
        position="bottom-right"
        minWidth={140}
        minHeight={80}
        maxWidth={480}
        maxHeight={360}
        onResizeEnd={(_, { width, height }) => updateAnnotation(annotation.id, { width: Math.round(width), height: Math.round(height) })}
      ><span aria-hidden="true" /></NodeResizeControl>}
      {selected && annotation.kind === 'note' && annotationLinkActions?.enabled && (
        <button
          className={`nodrag nopan ${styles.annotationLinkActionButton}`}
          type="button"
          aria-label="Draw link"
          title="Draw link"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            annotationLinkActions.beginConnection(annotation.id);
          }}
        >
          <Link2 aria-hidden="true" size={17} strokeWidth={2.2} />
          <span className={styles.quickActionLabel} aria-hidden="true">Draw link</span>
        </button>
      )}
      {selected && annotation.kind === 'secret' && annotationLinkActions?.enabled && (
        <div className={styles.secretQuickActions} aria-label="Quick secret actions">
          <span className={styles.secretQuickActionRing} aria-hidden="true" />
          <button
            className={`nodrag nopan ${styles.secretQuickActionButton}`}
            type="button"
            aria-label="Draw connection"
            title="Draw connection"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              annotationLinkActions.beginConnection(annotation.id);
            }}
          >
            <Link2 aria-hidden="true" size={17} strokeWidth={2.2} />
            <span className={styles.quickActionLabel} aria-hidden="true">Draw connection</span>
          </button>
        </div>
      )}
      <Handle id="top-target" className={styles.handleGhost} type="target" position={Position.Top} />
      <Handle id="center-target" className={`${styles.handleGhost} ${styles.annotationLinkTargetHandle}`} type="target" position={Position.Top} />
      <Handle id="center-source" className={`${styles.handleGhost} ${styles.annotationLinkSourceHandle}`} type="source" position={Position.Top} />
      {annotation.kind === 'secret' && <span className={styles.secretTriangle} aria-hidden="true"><Triangle className={styles.familySecretIcon} size={42} strokeWidth={1.8} /></span>}
      {editingInsideAnnotation ? <>
        {annotation.kind === 'text' && <span className={styles.annotationTextMeasure} aria-hidden="true">{annotation.text || '\u00a0'}</span>}
        <textarea
          className={`nodrag nopan ${styles.annotationNodeInput} ${annotation.kind === 'text' ? styles.annotationTextInput : ''}`}
          aria-label={`Edit ${annotation.kind}`}
          autoFocus
          value={annotation.text}
          onChange={(event) => updateAnnotation(annotation.id, { text: event.target.value })}
          onBlur={() => annotationActions.finishEditing()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              annotationActions.finishEditing();
            }
          }}
        />
      </> : <span>{annotation.kind === 'secret' && annotation.hidden ? 'Hidden secret' : annotation.text}</span>}
    </div>
  );
}

const nodeTypes = { person: PersonNode, junction: JunctionNode, household: HouseholdNode, annotation: AnnotationNode };
const edgeTypes = { relationship: GenogramRelationshipEdge, family: GenogramFamilyEdge };

function blankPerson(overrides: Partial<Person> = {}): Person {
  return { id: 'symbol', name: '', gender: 'unspecified', birthYear: null, deathYear: null, notes: '', deceased: false, symbolKind: 'person', isIndexPerson: false, medicalMarkers: [], ...overrides };
}

function ToolSymbol({ symbolKind = 'person', gender = 'unspecified', deceased = false }: { symbolKind?: Person['symbolKind']; gender?: Gender; deceased?: boolean }) {
  return <PersonSymbol person={blankPerson({ symbolKind, gender, deceased })} size={24} className={styles.toolSymbol} />;
}

function SexualOrientationIcon({ orientation }: { orientation: string }) {
  const normalizedOrientation = orientation.trim().toLowerCase();
  if (!normalizedOrientation || normalizedOrientation === 'prefer not to say') {
    return <Minus size={14} strokeWidth={1.8} aria-hidden="true" />;
  }
  if (normalizedOrientation === 'heterosexual') {
    return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" />;
  }
  const showDot = normalizedOrientation === 'asexual';
  const showQuestion = normalizedOrientation === 'unknown' || normalizedOrientation === 'questioning' || normalizedOrientation === 'other';
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M 1 1 L 13 1 L 7 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {showDot && <circle cx="7" cy="5" r="1.5" fill="currentColor" />}
      {showQuestion && <text x="7" y="8" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">?</text>}
    </svg>
  );
}

function LegendLine({ kind, label, color = '#203432', type }: { kind: RelationshipLineKind; label: string; color?: string; type?: RelationshipType }) {
  const markerId = `legend-arrow-${useId().replace(/:/g, '')}`;
  const p = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeWidth: 1.8, vectorEffect: 'non-scaling-stroke' as const };
  const isArrow = kind === 'focused' || kind === 'abuse';
  let emotionalSample: ReactNode = null;
  switch (type) {
    case 'close-hostile': emotionalSample = <><line {...p} stroke="#2563eb" x1="4" y1="3" x2="52" y2="3" /><path {...p} d="M4 9 L10 4 L16 14 L22 4 L28 14 L34 4 L40 14 L46 4 L52 9" /><line {...p} stroke="#2563eb" x1="4" y1="15" x2="52" y2="15" /></>; break;
    case 'sexual-abuse': emotionalSample = <><line {...p} x1="4" y1="3" x2="48" y2="3" /><path {...p} d="M4 9 L10 4 L16 14 L22 4 L28 14 L34 4 L40 14 L46 9" /><line {...p} x1="4" y1="15" x2="48" y2="15" /><path {...p} d="M43 4 L52 9 L43 14" /></>; break;
    case 'negative-focused': emotionalSample = <><path {...p} d="M4 9 L7 3 L10 15 L13 3 L16 15 L19 3 L22 15 L25 3 L28 15 L31 3 L34 15 L37 3 L40 15 L43 9" /><path {...p} d="M43 4 L52 9 L43 14" /></>; break;
    case 'caregiver': emotionalSample = <><line {...p} x1="4" y1="9" x2="42" y2="9" /><path {...p} d="M36 4 L44 9 L36 14 M43 4 L51 9 L43 14" /></>; break;
    case 'repaired-cutoff': emotionalSample = <><line {...p} x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="23" y1="2" x2="23" y2="16" /><circle cx="28" cy="9" r="5" fill="#fff" stroke={color} strokeWidth="1.8" /><line {...p} x1="33" y1="2" x2="33" y2="16" /></>; break;
    case 'never-met': emotionalSample = <><line {...p} strokeDasharray="2 5" x1="4" y1="9" x2="52" y2="9" /><path {...p} d="M25 6 L31 12 M31 6 L25 12" /></>; break;
    case 'love': emotionalSample = <><line {...p} x1="4" y1="9" x2="52" y2="9" /><circle cx="28" cy="9" r="5" fill="#fff" stroke={color} strokeWidth="1.8" /></>; break;
    case 'romantic-love': emotionalSample = <><line {...p} x1="4" y1="9" x2="52" y2="9" /><circle cx="25" cy="9" r="5" fill="#fff" stroke={color} strokeWidth="1.8" /><circle cx="31" cy="9" r="5" fill="#fff" stroke={color} strokeWidth="1.8" /></>; break;
    case 'attachment': emotionalSample = <><line {...p} x1="4" y1="9" x2="52" y2="9" />{[19, 25, 31, 37].map((x) => <circle key={x} cx={x} cy="9" r="4" fill="#fff" stroke={color} strokeWidth="1.6" />)}</>; break;
    case 'infatuation': emotionalSample = <><line {...p} x1="4" y1="9" x2="44" y2="9" /><circle cx="25" cy="9" r="4" fill="#fff" stroke={color} strokeWidth="1.6" /><circle cx="31" cy="9" r="4" fill="#fff" stroke={color} strokeWidth="1.6" /><path {...p} d="M43 4 L52 9 L43 14" /></>; break;
    case 'conflict': emotionalSample = <><line {...p} strokeDasharray="5 3" x1="4" y1="6" x2="52" y2="6" /><line {...p} strokeDasharray="5 3" x1="4" y1="12" x2="52" y2="12" /></>; break;
    case 'hatred': emotionalSample = <>{[4, 9, 14].map((y) => <line key={y} {...p} strokeDasharray="5 3" x1="4" y1={y} x2="52" y2={y} />)}</>; break;
    case 'distrust': emotionalSample = <><line {...p} x1="4" y1="9" x2="52" y2="9" />{[19, 24, 29, 34, 39].map((x) => <line key={x} {...p} x1={x} y1="3" x2={x} y2="15" />)}</>; break;
    case 'distant-hostile': emotionalSample = <><path {...p} d="M4 9 L10 3 L16 15 L22 3 L28 15 L34 3 L40 9" /><line {...p} stroke="#94a3b8" strokeDasharray="4 4" x1="40" y1="9" x2="52" y2="9" /></>; break;
    case 'fused-conflict': emotionalSample = <><line {...p} x1="4" y1="3" x2="52" y2="3" /><path {...p} d="M4 9 L10 3 L16 15 L22 3 L28 15 L34 3 L40 15 L46 3 L52 9" /><line {...p} x1="4" y1="15" x2="52" y2="15" /></>; break;
    case 'violence': emotionalSample = <path {...p} d="M4 9 L7 3 L10 15 L13 3 L16 15 L19 3 L22 15 L25 3 L28 15 L31 3 L34 15 L37 3 L40 15 L43 3 L46 15 L49 3 L52 9" />; break;
    case 'distant-violence': emotionalSample = <><path {...p} d="M4 9 L7 3 L10 15 L13 3 L16 15 L19 3 L22 15 L25 3 L28 15 L31 3 L34 15 L37 9" /><line {...p} stroke="#94a3b8" strokeDasharray="4 4" x1="37" y1="9" x2="52" y2="9" /></>; break;
    case 'close-violence': emotionalSample = <><line {...p} stroke="#2563eb" x1="4" y1="3" x2="52" y2="3" /><path {...p} d="M4 9 L7 3 L10 15 L13 3 L16 15 L19 3 L22 15 L25 3 L28 15 L31 3 L34 15 L37 3 L40 15 L43 3 L46 15 L49 3 L52 9" /><line {...p} stroke="#2563eb" x1="4" y1="15" x2="52" y2="15" /></>; break;
    case 'fused-violence': emotionalSample = <><line {...p} x1="4" y1="2" x2="52" y2="2" /><path {...p} d="M4 9 L7 3 L10 15 L13 3 L16 15 L19 3 L22 15 L25 3 L28 15 L31 3 L34 15 L37 3 L40 15 L43 3 L46 15 L49 3 L52 9" /><line {...p} x1="4" y1="16" x2="52" y2="16" /></>; break;
    case 'abuse': emotionalSample = <><path {...p} d="M4 9 L10 3 L16 15 L22 3 L28 15 L34 3 L40 9" /><path {...p} stroke="#2563eb" d="M42 4 L52 9 L42 14" /></>; break;
    case 'physical-neglect': emotionalSample = <><line {...p} strokeDasharray="6 4" x1="4" y1="9" x2="43" y2="9" /><path {...p} d="M43 4 L52 9 L43 14" /></>; break;
    case 'emotional-neglect': emotionalSample = <><line {...p} strokeDasharray="2 5" x1="4" y1="9" x2="43" y2="9" /><path {...p} d="M43 4 L52 9 L43 14" /></>; break;
    case 'manipulation': emotionalSample = <><line {...p} strokeDasharray="6 4" x1="4" y1="9" x2="43" y2="9" /><path {...p} d="M24 4 L32 14 M32 4 L24 14 M43 4 L52 9 L43 14" /></>; break;
    case 'control': emotionalSample = <><line {...p} x1="4" y1="9" x2="43" y2="9" /><rect x="21" y="2" width="14" height="14" fill="#fff" stroke={color} strokeWidth="1.5" /><path {...p} d="M23 4 L33 14 M33 4 L23 14 M43 4 L52 9 L43 14" /></>; break;
    case 'jealousy': emotionalSample = <><line {...p} x1="4" y1="9" x2="43" y2="9" /><path {...p} d="M28 2 L35 9 L28 16 L21 9 Z M43 4 L52 9 L43 14" /></>; break;
    case 'admirer': emotionalSample = <><line {...p} x1="4" y1="9" x2="43" y2="9" /><circle cx="28" cy="9" r="5" fill="#fff" stroke={color} strokeWidth="1.8" /><path {...p} d="M43 4 L52 9 L43 14" /></>; break;
    default: break;
  }
  if (emotionalSample) return <svg className={styles.legendLine} viewBox="0 0 56 18" role="img" aria-label={label}>{emotionalSample}</svg>;
  return (
    <svg className={styles.legendLine} viewBox="0 0 56 18" role="img" aria-label={label}>
      {isArrow && <defs><marker id={markerId} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L6 3.5 L0 7" fill="none" stroke={color} strokeWidth="1.4" /></marker></defs>}
      {kind === 'double' && <><line {...p} x1="4" y1="6" x2="52" y2="6" /><line {...p} x1="4" y1="12" x2="52" y2="12" /></>}
      {kind === 'triple' && <><line {...p} x1="4" y1="4" x2="52" y2="4" /><line {...p} x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="4" y1="14" x2="52" y2="14" /></>}
      {kind === 'separation' && <><line {...p} x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="25" y1="3" x2="32" y2="15" /></>}
      {kind === 'separation-dashed' && <><line {...p} strokeDasharray="5 4" x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="25" y1="3" x2="32" y2="15" /></>}
      {kind === 'divorce' && <><line {...p} x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="22" y1="3" x2="29" y2="15" /><line {...p} x1="29" y1="3" x2="36" y2="15" /></>}
      {kind === 'annulment' && <><line {...p} x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="17" y1="3" x2="24" y2="15" /><line {...p} x1="24" y1="3" x2="31" y2="15" /><line {...p} x1="34" y1="5" x2="42" y2="13" /><line {...p} x1="42" y1="5" x2="34" y2="13" /></>}
      {kind === 'widowed' && <><line {...p} x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="24" y1="5" x2="32" y2="13" /><line {...p} x1="32" y1="5" x2="24" y2="13" /></>}
      {(kind === 'long-dashed' || kind === 'child-dashed') && <line {...p} strokeDasharray="8 6" x1="4" y1="9" x2="52" y2="9" />}
      {kind === 'child-dashed' && <><path {...p} d="M23 3 Q18 9 23 15" /><path {...p} d="M33 3 Q38 9 33 15" /></>}
      {(kind === 'dotted' || kind === 'child-dotted') && <line {...p} strokeDasharray="2 5" x1="4" y1="9" x2="52" y2="9" />}
      {kind === 'child-step' && <line {...p} strokeDasharray="10 5 2 5" x1="4" y1="9" x2="52" y2="9" />}
      {(kind === 'child-surrogate' || kind === 'child-donor') && <><line {...p} strokeDasharray={kind === 'child-surrogate' ? '5 5' : '3 3'} x1="4" y1="9" x2="52" y2="9" /><rect x="22" y="2" width="12" height="14" rx="3" fill="#fff" stroke="currentColor" strokeWidth="1" /><text x="28" y="12" fill="currentColor" fontSize="7" fontWeight="800" textAnchor="middle">{kind === 'child-surrogate' ? 'S' : 'D'}</text></>}
      {kind === 'unknown' && <><line {...p} strokeDasharray="2 5" x1="4" y1="9" x2="52" y2="9" /><circle cx="28" cy="9" r="4" fill="white" stroke="#203432" strokeWidth="1.2" /></>}
      {kind === 'sparse-dotted' && <line {...p} strokeDasharray="1 8" x1="4" y1="9" x2="52" y2="9" />}
      {kind === 'affair-separation' && <><line {...p} strokeDasharray="4 4" x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="25" y1="3" x2="32" y2="15" /></>}
      {kind === 'affair-divorce' && <><line {...p} strokeDasharray="4 4" x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="22" y1="3" x2="29" y2="15" /><line {...p} x1="29" y1="3" x2="36" y2="15" /></>}
      {kind === 'affair-married' && <><line {...p} strokeDasharray="4 4" x1="4" y1="6" x2="52" y2="6" /><line {...p} x1="4" y1="13" x2="52" y2="13" /></>}
      {kind === 'dashed' && <line {...p} strokeDasharray="4 7" x1="4" y1="9" x2="52" y2="9" />}
      {(kind === 'zigzag' || kind === 'abuse') && <path {...p} markerEnd={kind === 'abuse' ? `url(#${markerId})` : undefined} d="M4 9 L10 3 L16 15 L22 3 L28 15 L34 3 L40 15 L46 3 L52 9" />}
      {kind === 'fused-conflict' && <><line {...p} x1="4" y1="3" x2="52" y2="3" /><path {...p} d="M4 9 L10 4 L16 14 L22 4 L28 14 L34 4 L40 14 L46 4 L52 9" /><line {...p} x1="4" y1="15" x2="52" y2="15" /></>}
      {kind === 'cutoff' && <><line {...p} x1="4" y1="9" x2="52" y2="9" /><line {...p} x1="25" y1="2" x2="25" y2="16" /><line {...p} x1="32" y1="2" x2="32" y2="16" /></>}
      {kind === 'focused' && <line {...p} markerEnd={`url(#${markerId})`} x1="4" y1="9" x2="52" y2="9" />}
      {(kind === 'twin-fraternal' || kind === 'twin-identical') && <><path {...p} d="M28 2 L10 16 M28 2 L46 16" />{kind === 'twin-identical' && <line {...p} x1="17" y1="11" x2="39" y2="11" />}</>}
      {(kind === 'single' || kind === 'child-solid') && <line {...p} x1="4" y1="9" x2="52" y2="9" />}
    </svg>
  );
}

function Legend({ project }: { project: Project }) {
  const genders = [...new Set(project.people.filter((person) => person.symbolKind === 'person').map((person) => person.gender))];
  const events = SYMBOL_KINDS.filter((kind) => kind !== 'person' && project.people.some((person) => person.symbolKind === kind));
  const relationTypes = [...new Set(project.relationships.map((relationship) => relationship.type))];
  const markers = [...new Map(project.people.flatMap((person) => person.medicalMarkers).map((marker) => [`${marker.label}:${marker.color}`, marker])).values()];
  return (
    <aside className={styles.legend} aria-label="Genogram legend">
      <div className={styles.legendHeading}><p className={styles.kicker}>Notation</p><h3>Legend</h3></div>
      {genders.length > 0 && <div className={styles.legendSection}><p className={styles.legendSectionTitle}>People</p>{genders.map((gender) => <div className={styles.legendRow} key={gender}><PersonSymbol person={blankPerson({ gender })} size={28} className={styles.legendPersonSymbol} /><span>{genderLabels[gender]}</span></div>)}</div>}
      {events.length > 0 && <div className={styles.legendSection}><p className={styles.legendSectionTitle}>Pregnancy and loss</p>{events.map((kind) => <div className={styles.legendRow} key={kind}><PersonSymbol person={blankPerson({ symbolKind: kind })} size={28} className={styles.legendPersonSymbol} /><span>{SYMBOL_KIND_LABELS[kind]}</span></div>)}</div>}
      {markers.length > 0 && <div className={styles.legendSection}><p className={styles.legendSectionTitle}>Medical / genetic</p>{markers.map((marker) => <div className={styles.legendRow} key={`${marker.label}-${marker.color}`}><span className={styles.legendMarkerSwatch} style={{ backgroundColor: marker.color }} /><span>{marker.label}</span></div>)}</div>}
      {relationshipCategories.map((category) => {
        const types = relationTypes.filter((type) => RELATIONSHIP_DEFINITIONS[type].category === category);
        return types.length > 0 ? <div className={styles.legendSection} key={category}><p className={styles.legendSectionTitle}>{RELATIONSHIP_CATEGORY_LABELS[category]}</p>{types.map((type) => <div className={styles.legendRow} key={type}><LegendLine kind={RELATIONSHIP_DEFINITIONS[type].lineKind} label={RELATIONSHIP_DEFINITIONS[type].label} color={RELATIONSHIP_DEFINITIONS[type].color} type={type} /><span>{RELATIONSHIP_DEFINITIONS[type].label}</span></div>)}</div> : null;
      })}
      {project.households.length > 0 && <div className={styles.legendRow}><span className={styles.legendBoundary} /><span>Family boundary</span></div>}
    </aside>
  );
}

interface PersonInspectorSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: string;
  open: boolean;
  onToggle: () => void;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  children: ReactNode;
}

function PersonInspectorSection({ id, title, icon: Icon, tone, open, onToggle, visible, onVisibleChange, children }: PersonInspectorSectionProps) {
  return (
    <section className={`${styles.personInspectorSection} ${open ? styles.personInspectorSectionOpen : ''}`} style={{ '--section-tone': tone } as CSSProperties}>
      <div className={styles.personInspectorSectionHeader}>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`person-section-${id}`}><Icon size={15} strokeWidth={1.9} aria-hidden="true" /><span>{title}</span><ChevronDown className={open ? styles.sectionChevronOpen : ''} size={15} aria-hidden="true" /></button>
        {onVisibleChange && <button className={styles.sectionVisibilityButton} type="button" onClick={() => onVisibleChange(!visible)} aria-label={`${visible ? 'Hide' : 'Show'} ${title} on canvas`} aria-pressed={visible}>{visible ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}<span>{visible ? 'Shown' : 'Hidden'}</span></button>}
      </div>
      {open && <div className={styles.personInspectorSectionBody} id={`person-section-${id}`}>{children}</div>}
    </section>
  );
}

function HeritagePatternSwatch({ pattern }: { pattern: CulturalHeritagePattern }) {
  if (pattern === 'dots') return <svg viewBox="0 0 30 30" aria-hidden="true"><g fill="currentColor">{[6, 15, 24].flatMap((x) => [6, 15, 24].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" />))}</g></svg>;
  if (pattern === 'checker') return <svg viewBox="0 0 30 30" aria-hidden="true"><g fill="currentColor"><rect x="0" y="0" width="10" height="10" /><rect x="20" y="0" width="10" height="10" /><rect x="10" y="10" width="10" height="10" /><rect x="0" y="20" width="10" height="10" /><rect x="20" y="20" width="10" height="10" /></g></svg>;
  if (pattern === 'woven') return <svg viewBox="0 0 30 30" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="2"><path d="M10,0 C10,5 20,10 20,15 C20,20 10,25 10,30" /><path d="M20,0 C20,5 10,10 10,15 C10,20 20,25 20,30" /></g></svg>;
  const paths: Record<Exclude<CulturalHeritagePattern, 'dots' | 'checker' | 'woven'>, string> = {
    horizontal: 'M0,5 h30 M0,12 h30 M0,19 h30 M0,26 h30',
    vertical: 'M5,0 v30 M12,0 v30 M19,0 v30 M26,0 v30',
    'diagonal-right': 'M0,6 L6,0 M0,14 L14,0 M0,22 L22,0 M0,30 L30,0 M8,30 L30,8 M16,30 L30,16 M24,30 L30,24',
    'diagonal-left': 'M24,0 L30,6 M16,0 L30,14 M8,0 L30,22 M0,0 L30,30 M0,8 L22,30 M0,16 L14,30 M0,24 L6,30',
    grid: 'M5,0 v30 M15,0 v30 M25,0 v30 M0,5 h30 M0,15 h30 M0,25 h30',
    waves: 'M0,6 Q4,2 8,6 T16,6 T24,6 T32,6 M0,15 Q4,11 8,15 T16,15 T24,15 T32,15 M0,24 Q4,20 8,24 T16,24 T24,24 T32,24',
  };
  return <svg viewBox="0 0 30 30" aria-hidden="true"><path d={paths[pattern]} fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
}

function PersonInspector({ person }: { person: Person | undefined }) {
  const updatePerson = useGenogramStore((state) => state.updatePerson);
  const setCanvasViewVisibility = useGenogramStore((state) => state.setCanvasViewVisibility);
  const deletePeople = useGenogramStore((state) => state.deletePeople);
  const setSelection = useGenogramStore((state) => state.setSelection);
  const setActivePanel = useGenogramStore((state) => state.setActivePanel);
  const [statusOpen, setStatusOpen] = useState(false);
  const [orientationOpen, setOrientationOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(['medical']);
  const [careerTagDraft, setCareerTagDraft] = useState({ personId: '', value: '' });
  const [locationCountryOpen, setLocationCountryOpen] = useState(false);
  const [locationSearchDraft, setLocationSearchDraft] = useState({ personId: '', value: '' });
  const viewSettings = useContext(CanvasViewContext);
  if (!person) return null;
  const profile = { ...createEmptyPersonProfile(), ...person.profile };
  const careerTagInput = careerTagDraft.personId === person.id ? careerTagDraft.value : '';
  const locationCountrySearch = locationSearchDraft.personId === person.id ? locationSearchDraft.value : '';
  const visualSettings = { ...createDefaultPersonVisualSettings(), ...person.visualSettings };
  const heritageLayers = person.culturalHeritageLayers ?? [];
  const toggleSection = (id: string) => setOpenSections((sections) => sections.includes(id) ? sections.filter((section) => section !== id) : [...sections, id]);
  const updateProfile = (patch: Partial<PersonProfile>) => updatePerson(person.id, { profile: { ...profile, ...patch } });
  const careerTags = profile.attributes.split(',').map((tag) => tag.trim()).filter(Boolean);
  const addCareerTag = () => {
    const tag = careerTagInput.trim();
    if (!tag) return;
    if (!careerTags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      updateProfile({ attributes: [...careerTags, tag].join(', ') });
    }
    setCareerTagDraft({ personId: person.id, value: '' });
  };
  const removeCareerTag = (tag: string) => updateProfile({ attributes: careerTags.filter((item) => item !== tag).join(', ') });
  const legacyLocation = !profile.country && !profile.state && !profile.city ? profile.location : '';
  const locationCity = profile.city || legacyLocation;
  const filteredCountries = COUNTRY_OPTIONS.filter((country) => country.name.toLowerCase().includes(locationCountrySearch.trim().toLowerCase()));
  const updateLocation = (patch: Partial<Pick<PersonProfile, 'country' | 'countryCode' | 'city' | 'state'>>) => {
    const next = { country: profile.country, countryCode: profile.countryCode, city: locationCity, state: profile.state, ...patch };
    updateProfile({ ...next, location: [next.city, next.state, next.country].map((part) => part.trim()).filter(Boolean).join(', ') });
  };
  const selectCountry = (country: typeof COUNTRY_OPTIONS[number]) => {
    updateLocation({ country: country.name, countryCode: country.code });
    setLocationSearchDraft({ personId: person.id, value: '' });
    setLocationCountryOpen(false);
  };
  const updateVisualSettings = (patch: Partial<PersonVisualSettings>) => updatePerson(person.id, { visualSettings: { ...visualSettings, ...patch } });
  const toggleHeritagePattern = (pattern: CulturalHeritagePattern) => {
    const existing = heritageLayers.find((layer) => layer.pattern === pattern);
    updatePerson(person.id, {
      culturalHeritageLayers: existing
        ? heritageLayers.filter((layer) => layer.id !== existing.id)
        : [...heritageLayers, { id: createId('heritage'), pattern, label: '' }],
    });
  };
  const updateHeritageLayer = (id: string, label: string) => updatePerson(person.id, {
    culturalHeritageLayers: heritageLayers.map((layer) => layer.id === id ? { ...layer, label } : layer),
  });
  type PersonStatus = 'alive' | 'deceased' | 'pregnancy' | 'miscarriage' | 'stillbirth' | 'termination';
  const status: PersonStatus = person.symbolKind === 'person' ? (person.deceased ? 'deceased' : 'alive') : person.symbolKind;
  const statusOptions: Array<{ value: PersonStatus; label: string }> = [
    { value: 'alive', label: 'Alive' },
    { value: 'deceased', label: 'Deceased' },
    { value: 'pregnancy', label: 'Pregnancy' },
    { value: 'miscarriage', label: 'Miscarriage' },
    { value: 'stillbirth', label: 'Stillbirth' },
    { value: 'termination', label: 'Abortion' },
  ];
  const statusIcon = (value: PersonStatus) => value === 'alive'
    ? <Heart size={17} strokeWidth={1.8} aria-hidden="true" />
    : value === 'deceased'
      ? <ToolSymbol gender={person.gender} deceased />
      : <ToolSymbol symbolKind={value} gender={person.gender} />;
  const setStatus = (value: PersonStatus) => {
    const symbolKind: Person['symbolKind'] = value === 'alive' || value === 'deceased' ? 'person' : value;
    updatePerson(person.id, {
      symbolKind,
      deceased: value === 'deceased',
      medicalMarkers: symbolKind === 'person' ? person.medicalMarkers : [],
      isIndexPerson: symbolKind === 'person' ? person.isIndexPerson : false,
    });
    setStatusOpen(false);
  };
  const setYear = (field: 'birthYear' | 'deathYear', value: string) => {
    if (value.trim() === '') return updatePerson(person.id, { [field]: null });
    const year = Number(value);
    if (Number.isInteger(year)) updatePerson(person.id, { [field]: year });
  };
  type DateKind = 'birth' | 'death';
  type DatePart = 'month' | 'day' | 'year';
  const getDateParts = (kind: DateKind) => {
    const storedDate = kind === 'birth' ? profile.birthDate : profile.deathDate;
    const [storedYear = '', storedMonth = '', storedDay = ''] = /^\d{4}-\d{2}-\d{2}$/.test(storedDate) ? storedDate.split('-') : [];
    return {
      month: (kind === 'birth' ? profile.birthMonth : profile.deathMonth) || storedMonth,
      day: (kind === 'birth' ? profile.birthDay : profile.deathDay) || storedDay,
      year: (kind === 'birth' ? person.birthYear : person.deathYear)?.toString() ?? storedYear,
    };
  };
  const birthDateParts = getDateParts('birth');
  const deathDateParts = getDateParts('death');
  const updateDatePart = (kind: DateKind, part: DatePart, rawValue: string) => {
    const value = rawValue.replace(/\D/g, '').slice(0, part === 'year' ? 4 : 2);
    const next = { ...getDateParts(kind), [part]: value };
    const completeDate = next.year.length === 4 && next.month.length === 2 && next.day.length === 2
      ? `${next.year}-${next.month}-${next.day}`
      : '';
    updateProfile(kind === 'birth'
      ? { birthMonth: next.month, birthDay: next.day, birthDate: completeDate }
      : { deathMonth: next.month, deathDay: next.day, deathDate: completeDate });
    if (part === 'year') setYear(kind === 'birth' ? 'birthYear' : 'deathYear', value);
  };
  const addMarker = (label = `Condition ${person.medicalMarkers.length + 1}`, color: MedicalMarkerColor = MEDICAL_MARKER_COLORS[person.medicalMarkers.length] ?? MEDICAL_MARKER_COLORS[0]) => {
    if (person.symbolKind !== 'person') return;
    const quadrant = (person.medicalMarkers.length % 4) as MedicalMarker['quadrant'];
    updatePerson(person.id, { medicalMarkers: [...person.medicalMarkers, { id: createId('marker'), label, color, quadrant, status: 'active' }] });
  };
  const updateMarker = (id: string, patch: Partial<MedicalMarker>) => updatePerson(person.id, { medicalMarkers: person.medicalMarkers.map((marker) => marker.id === id ? { ...marker, ...patch } : marker) });
  const toggleMedicalPreset = (label: string, color: MedicalMarkerColor) => {
    const existing = person.medicalMarkers.find((marker) => marker.label === label);
    if (existing) updatePerson(person.id, { medicalMarkers: person.medicalMarkers.filter((marker) => marker.id !== existing.id) });
    else addMarker(label, color);
  };
  const sectionProps = (id: string) => ({ id, open: openSections.includes(id), onToggle: () => toggleSection(id) });
  return (
    <section className={styles.inspectorContent} aria-label="Edit person">
      <div className={styles.inspectorHeading}><div><p className={styles.kicker}>Selected symbol</p><h3>Person details</h3></div><button className={styles.iconButton} type="button" onClick={() => { setSelection([]); setActivePanel(null); }} aria-label="Close person editor">×</button></div>
      <div className={styles.personInspectorSummary}>
        <div className={styles.personInspectorSymbol}><PersonSymbol person={person} size={64} showAnnotations viewVisibility={viewSettings.visibility} /></div>
        <div className={styles.personInspectorSummaryFields}>
          <label className={styles.summaryNameField}><span>Name</span><input value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} /></label>
        </div>
        <div className={styles.personInspectorCommonFields}>
          <fieldset className={`${styles.genderFieldset} ${styles.summaryGenderFieldset}`} disabled={person.symbolKind !== 'person'}>
            <legend>Gender symbol</legend>
            <div className={`${styles.genderPicker} ${styles.summaryGenderPicker}`}>{addPersonGenders.map((gender) => <button className={person.gender === gender ? styles.genderPickerActive : ''} type="button" key={gender} onClick={() => updatePerson(person.id, { gender })}><ToolSymbol gender={gender} /><span>{genderLabels[gender]}</span></button>)}</div>
          </fieldset>
          <div className={styles.personInspectorSummaryMeta}>
            <div className={`${styles.statusField} ${styles.summaryStatusField}`}>
              <span>Status</span>
              <button className={`${styles.statusTrigger} ${statusOpen ? styles.statusTriggerOpen : ''}`} title="Click to change vital status" type="button" aria-haspopup="listbox" aria-expanded={statusOpen} onClick={() => { setOrientationOpen(false); setStatusOpen((open) => !open); }}>{statusIcon(status)}<span>{statusOptions.find((option) => option.value === status)?.label}</span><ChevronDown size={13} aria-hidden="true" /></button>
              {statusOpen && <div className={styles.statusMenu} role="listbox" aria-label="Person status">{statusOptions.map((option) => <button className={status === option.value ? styles.statusOptionActive : ''} type="button" role="option" aria-selected={status === option.value} key={option.value} onClick={() => setStatus(option.value)}>{statusIcon(option.value)}<span>{option.label}</span></button>)}</div>}
            </div>
            <label className={styles.summaryYearField}>
              <span>Birth year</span>
              <span className={styles.summaryYearInput}><CalendarDays size={14} aria-hidden="true" /><input aria-label="Birth year" inputMode="numeric" placeholder="YYYY" value={person.birthYear ?? ''} onChange={(event) => setYear('birthYear', event.target.value)} /></span>
            </label>
          </div>
        </div>
      </div>

      <PersonInspectorSection {...sectionProps('identity')} title="Identity & names" icon={UserRound} tone="#4f857c">
        <div className={styles.fieldGrid}>
          <label className={styles.field}><span>First</span><input title="First/given name" placeholder="First" value={profile.givenName} onChange={(event) => updateProfile({ givenName: event.target.value })} /></label>
          <label className={styles.field}><span>Middle</span><input title="Middle name(s)" placeholder="Middle" value={profile.middleName} onChange={(event) => updateProfile({ middleName: event.target.value })} /></label>
          <label className={styles.field}><span>Last</span><input title="Last/family name" placeholder="Last" value={profile.familyName} onChange={(event) => updateProfile({ familyName: event.target.value })} /></label>
          <label className={styles.field}><span>Maiden</span><input title="Birth surname (for tracing maternal lines)" placeholder="Birth surname" value={profile.birthName} onChange={(event) => updateProfile({ birthName: event.target.value })} /></label>
        </div>
        <div className={styles.fieldGridThree}>
          <label className={styles.field}><span>Title</span><input title="Prefix title (Dr., Rev., etc.)" placeholder="Dr." value={profile.title} onChange={(event) => updateProfile({ title: event.target.value })} /></label>
          <label className={styles.field}><span>Suffix</span><input title="Name suffix (Jr., III, etc.)" placeholder="Jr." value={profile.suffix} onChange={(event) => updateProfile({ suffix: event.target.value })} /></label>
          <label className={styles.field}><span>Nickname</span><input title="Informal name (Bob for Robert)" placeholder="Bob" value={profile.nickname} onChange={(event) => updateProfile({ nickname: event.target.value })} /></label>
        </div>
        <label className={styles.field}><span>Alternative name / alias</span><input title="Changed name, immigrant name, or alias" placeholder="Changed name, alias" value={profile.alternativeName} onChange={(event) => updateProfile({ alternativeName: event.target.value })} /></label>
        <fieldset className={styles.genderFieldset} disabled={person.symbolKind !== 'person'}>
          <legend>All gender symbols</legend>
          <div className={styles.genderPicker}>{GENDERS.map((gender) => <button className={person.gender === gender ? styles.genderPickerActive : ''} type="button" key={gender} onClick={() => updatePerson(person.id, { gender })}><ToolSymbol gender={gender} /><span>{genderLabels[gender]}</span></button>)}</div>
        </fieldset>
        <div className={styles.statusField}>
          <span>Orientation</span>
          <button className={`${styles.statusTrigger} ${orientationOpen ? styles.statusTriggerOpen : ''}`} title="Click to change sexual orientation" type="button" aria-haspopup="listbox" aria-expanded={orientationOpen} onClick={() => { setStatusOpen(false); setOrientationOpen((open) => !open); }}><SexualOrientationIcon orientation={profile.sexualOrientation} /><span>{profile.sexualOrientation || 'Select orientation'}</span><ChevronDown size={13} aria-hidden="true" /></button>
          {orientationOpen && <div className={`${styles.statusMenu} ${styles.orientationMenu}`} role="listbox" aria-label="Sexual orientation">
            {sexualOrientationOptions.map((option) => <button className={profile.sexualOrientation === option ? styles.statusOptionActive : ''} type="button" role="option" aria-selected={profile.sexualOrientation === option} key={option} onClick={() => { updateProfile({ sexualOrientation: option }); setOrientationOpen(false); }}><SexualOrientationIcon orientation={option} /><span>{option}</span></button>)}
          </div>}
        </div>
      </PersonInspectorSection>

      <PersonInspectorSection {...sectionProps('life')} title="Vitals & dates" icon={CalendarDays} tone="#66728c">
        <label className={styles.field}><span>Birth</span><span className={styles.datePartGrid}><input aria-label="Birth month" inputMode="numeric" title="Birth month (01-12)" placeholder="MM" maxLength={2} value={birthDateParts.month} onChange={(event) => updateDatePart('birth', 'month', event.target.value)} /><input aria-label="Birth day" inputMode="numeric" title="Birth day (01-31)" placeholder="DD" maxLength={2} value={birthDateParts.day} onChange={(event) => updateDatePart('birth', 'day', event.target.value)} /><input aria-label="Birth year" inputMode="numeric" title="Birth year" placeholder="YYYY" maxLength={4} value={birthDateParts.year} onChange={(event) => updateDatePart('birth', 'year', event.target.value)} /></span></label>
        <label className={styles.field}><span>Birth place</span><input title="Place of birth" placeholder="City, State, Country" value={profile.birthPlace} onChange={(event) => updateProfile({ birthPlace: event.target.value })} /></label>
        {status === 'deceased' && <>
          <label className={styles.field}><span>Death</span><span className={styles.datePartGrid}><input aria-label="Death month" inputMode="numeric" title="Death month (01-12)" placeholder="MM" maxLength={2} value={deathDateParts.month} onChange={(event) => updateDatePart('death', 'month', event.target.value)} /><input aria-label="Death day" inputMode="numeric" title="Death day (01-31)" placeholder="DD" maxLength={2} value={deathDateParts.day} onChange={(event) => updateDatePart('death', 'day', event.target.value)} /><input aria-label="Death year" inputMode="numeric" title="Death year" placeholder="YYYY" maxLength={4} value={deathDateParts.year} onChange={(event) => updateDatePart('death', 'year', event.target.value)} /></span></label>
          <label className={styles.field}><span>Death place</span><input title="Place of death" placeholder="City, State, Country" value={profile.deathPlace} onChange={(event) => updateProfile({ deathPlace: event.target.value })} /></label>
        </>}
        <label className={styles.checkboxField} title="Mark if person had no children by choice or circumstance"><input type="checkbox" checked={person.explicitlyChildless ?? false} onChange={(event) => updatePerson(person.id, { explicitlyChildless: event.target.checked })} /><span>Explicitly childless</span></label>
      </PersonInspectorSection>

      <PersonInspectorSection {...sectionProps('career')} title="Career" icon={BriefcaseBusiness} tone="#9a753f" visible={viewSettings.visibility.custom} onVisibleChange={(visible) => setCanvasViewVisibility('custom', visible)}>
        <label className={styles.field}><span>Current occupation</span><input title="Current or primary occupation" placeholder="Teacher, Engineer, etc." value={profile.occupation} onChange={(event) => updateProfile({ occupation: event.target.value })} /></label>
        <div className={styles.fieldGrid}>
          <label className={styles.field}><span>From (year)</span><input inputMode="numeric" title="Year this occupation started" placeholder="1998" value={profile.occupationStartYear} onChange={(event) => updateProfile({ occupationStartYear: event.target.value })} /></label>
          <label className={styles.field}><span>To (year)</span><input inputMode="numeric" title="Year this occupation ended (empty = ongoing)" placeholder="2004" value={profile.occupationEndYear} onChange={(event) => updateProfile({ occupationEndYear: event.target.value })} /></label>
        </div>
        <div className={styles.careerTagsField}>
          <span>Tags / attributes</span>
          <div className={styles.careerTagEditor} title="Add custom tags (press Enter to add)">
            {careerTags.map((tag) => <button type="button" key={tag} title={`Remove ${tag}`} onClick={() => removeCareerTag(tag)}><span>{tag}</span><span aria-hidden="true">×</span></button>)}
            <input aria-label="Add career tag" title="Type and press Enter to add a tag" placeholder="+ Add" value={careerTagInput} onChange={(event) => setCareerTagDraft({ personId: person.id, value: event.target.value })} onKeyDown={(event) => { if (event.key !== 'Enter') return; event.preventDefault(); addCareerTag(); }} />
          </div>
        </div>
      </PersonInspectorSection>

      <PersonInspectorSection {...sectionProps('notes')} title="Notes" icon={MessageSquare} tone="#637775">
        <label className={styles.field}><span>Private notes</span><textarea rows={5} value={person.notes} onChange={(event) => updatePerson(person.id, { notes: event.target.value })} /></label>
      </PersonInspectorSection>

      <PersonInspectorSection {...sectionProps('color')} title="Color" icon={Palette} tone="#a96a73" visible={visualSettings.showColor} onVisibleChange={(showColor) => updateVisualSettings({ showColor })}>
        <div className={styles.personColorPicker} aria-label="Person color">{personColorOptions.map((color) => <button className={visualSettings.color === color ? styles.personColorActive : ''} type="button" key={color} onClick={() => updateVisualSettings({ color, showColor: true })} aria-label={`Use ${color}`} aria-pressed={visualSettings.color === color}><span style={{ backgroundColor: color }} /></button>)}</div>
      </PersonInspectorSection>

      {person.symbolKind === 'person' && <PersonInspectorSection {...sectionProps('medical')} title="Medical / genetic" icon={Heart} tone="#a54f43" visible={viewSettings.visibility.medical} onVisibleChange={(visible) => setCanvasViewVisibility('medical', visible)}>
        <div className={styles.markerEditor}>
          <div className={styles.markerEditorHeading}><span>Conditions</span><button className={styles.smallButton} type="button" onClick={() => addMarker()}>Custom ({person.medicalMarkers.length})</button></div>
          <p className={styles.markerEditorHelp}>Add as many conditions as needed. Every condition becomes a colored segment.</p>
          <div className={styles.medicalPresetGrid}>{MEDICAL_CONDITION_PRESETS.map((preset) => {
            const active = person.medicalMarkers.some((marker) => marker.label === preset.label);
            return <button className={active ? styles.medicalPresetActive : ''} type="button" key={preset.label} onClick={() => toggleMedicalPreset(preset.label, preset.color)}><span style={{ backgroundColor: preset.color }} />{preset.label}</button>;
          })}</div>
          {person.medicalMarkers.length > 0 && <div className={styles.markerList}>{person.medicalMarkers.map((marker) => <div className={styles.markerEditorRow} key={marker.id}>
            <label className={styles.markerColorField} title="Condition color"><span style={{ backgroundColor: marker.color }} /><select aria-label="Condition color" value={marker.color} onChange={(event) => updateMarker(marker.id, { color: event.target.value as MedicalMarkerColor })}>{MEDICAL_MARKER_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
            <label className={styles.markerField}><input aria-label="Condition label" value={marker.label} onChange={(event) => updateMarker(marker.id, { label: event.target.value })} /></label>
            <button className={styles.iconButton} type="button" onClick={() => updatePerson(person.id, { medicalMarkers: person.medicalMarkers.filter((item) => item.id !== marker.id) })} aria-label={`Delete ${marker.label}`}>×</button>
            <div className={styles.markerStatusPicker} aria-label={`${marker.label} status`}>{MEDICAL_MARKER_STATUSES.map((markerStatus) => <button className={(marker.status ?? 'active') === markerStatus ? styles.markerStatusActive : ''} type="button" key={markerStatus} aria-pressed={(marker.status ?? 'active') === markerStatus} onClick={() => updateMarker(marker.id, { status: markerStatus })}>{medicalStatusLabels[markerStatus]}</button>)}</div>
          </div>)}</div>}
        </div>
      </PersonInspectorSection>}

      <PersonInspectorSection {...sectionProps('heritage')} title="Cultural heritage" icon={Globe2} tone="#47758b" visible={viewSettings.visibility.cultural} onVisibleChange={(visible) => setCanvasViewVisibility('cultural', visible)}>
        <div className={styles.heritagePresetGrid}>{CULTURAL_HERITAGE_PATTERNS.map((pattern) => {
          const active = heritageLayers.some((layer) => layer.pattern === pattern);
          return <button className={active ? styles.profilePresetActive : ''} type="button" key={pattern} aria-pressed={active} onClick={() => toggleHeritagePattern(pattern)}><span className={styles.heritagePatternPreview}><HeritagePatternSwatch pattern={pattern} /></span><span>{heritagePatternLabels[pattern]}</span></button>;
        })}</div>
        {heritageLayers.length > 0 && <div className={styles.heritageLayerList}><p>Active layers</p>{heritageLayers.map((layer) => <label className={styles.heritageLayerRow} key={layer.id}><span className={styles.heritageLayerSwatch}><HeritagePatternSwatch pattern={layer.pattern} /></span><input aria-label={`${heritagePatternLabels[layer.pattern]} heritage`} placeholder="Enter heritage (e.g. Irish)" value={layer.label} onChange={(event) => updateHeritageLayer(layer.id, event.target.value)} /></label>)}</div>}
      </PersonInspectorSection>
      <PersonInspectorSection {...sectionProps('religion')} title="Religion" icon={Star} tone="#776e9f" visible={viewSettings.visibility.religion} onVisibleChange={(visible) => setCanvasViewVisibility('religion', visible)}>
        <div className={styles.religionPresetGrid}>{religionPresets.map((option) => <button className={profile.religion === option.label ? styles.profilePresetActive : ''} type="button" key={option.label} aria-pressed={profile.religion === option.label} onClick={() => updateProfile({ religion: profile.religion === option.label ? '' : option.label })}><ReligionIcon religion={option.label} /><span>{option.label}</span></button>)}</div>
      </PersonInspectorSection>
      <PersonInspectorSection {...sectionProps('social')} title="Social class" icon={Coins} tone="#4f857c" visible={viewSettings.visibility.social} onVisibleChange={(visible) => setCanvasViewVisibility('social', visible)}>
        <div className={styles.socialClassPresetList}>{socialClassPresets.map((option) => <button className={profile.socialClass === option.label ? styles.profilePresetActive : ''} type="button" key={option.label} aria-pressed={profile.socialClass === option.label} onClick={() => updateProfile({ socialClass: profile.socialClass === option.label ? '' : option.label })}><span className={styles.socialClassDot} /><span><strong>{option.label}</strong><small>{option.description}</small></span></button>)}</div>
      </PersonInspectorSection>
      <PersonInspectorSection {...sectionProps('education')} title="Education" icon={GraduationCap} tone="#47758b" visible={viewSettings.visibility.education} onVisibleChange={(visible) => setCanvasViewVisibility('education', visible)}>
        <div className={styles.educationPresetGrid}>{educationPresets.map((option) => <button className={profile.education === option.label ? styles.profilePresetActive : ''} type="button" key={option.label} aria-pressed={profile.education === option.label} onClick={() => updateProfile({ education: profile.education === option.label ? '' : option.label })}><span>{option.code}</span><strong>{option.label}</strong></button>)}</div>
        <label className={styles.field}><span>School(s)</span><input placeholder="Harvard, MIT, etc." value={profile.school} onChange={(event) => updateProfile({ school: event.target.value })} /></label>
      </PersonInspectorSection>
      <PersonInspectorSection {...sectionProps('location')} title="Location" icon={MapPin} tone="#b9673a" visible={viewSettings.visibility.location} onVisibleChange={(visible) => setCanvasViewVisibility('location', visible)}>
        <div className={styles.locationCountryPicker}>
          <button className={`${styles.locationCountryTrigger} ${locationCountryOpen ? styles.locationCountryTriggerOpen : ''}`} type="button" aria-haspopup="listbox" aria-expanded={locationCountryOpen} onClick={() => setLocationCountryOpen((open) => !open)}><span className={styles.locationCountryFlag} aria-hidden="true">{profile.countryCode ? countryFlag(profile.countryCode) : <Globe2 size={14} />}</span><span>{profile.country || 'Country'}</span><ChevronDown size={14} aria-hidden="true" /></button>
          {locationCountryOpen && <div className={styles.locationCountryMenu}>
            <input autoFocus aria-label="Search country" placeholder="Search country..." value={locationCountrySearch} onChange={(event) => setLocationSearchDraft({ personId: person.id, value: event.target.value })} onKeyDown={(event) => { if (event.key === 'Escape') setLocationCountryOpen(false); }} />
            <div className={styles.locationCountryList} role="listbox" aria-label="Countries">
              {filteredCountries.length > 0 ? filteredCountries.map((country) => <button className={profile.countryCode === country.code ? styles.locationCountryOptionActive : ''} type="button" role="option" aria-selected={profile.countryCode === country.code} key={country.code} onClick={() => selectCountry(country)}><span aria-hidden="true">{countryFlag(country.code)}</span><span>{country.name}</span></button>) : <p>No countries found</p>}
            </div>
          </div>}
        </div>
        <div className={styles.locationFieldGrid}>
          <label className={styles.field}><span>City</span><input placeholder="City" value={locationCity} onChange={(event) => updateLocation({ city: event.target.value })} /></label>
          <label className={styles.field}><span>State</span><input placeholder="State" value={profile.state} onChange={(event) => updateLocation({ state: event.target.value })} /></label>
        </div>
      </PersonInspectorSection>

      <div className={styles.personInspectorFooter}>
        <div className={styles.personSizePicker} aria-label="Person symbol size">{PERSON_DISPLAY_SIZES.map((size) => <button className={visualSettings.size === size ? styles.personSizeActive : ''} type="button" key={size} onClick={() => updateVisualSettings({ size: size as PersonDisplaySize })} aria-pressed={visualSettings.size === size}>{size[0].toUpperCase()}</button>)}</div>
        <div className={styles.personInspectorActions}>
          <button className={person.isIndexPerson ? styles.personInspectorActionActive : ''} type="button" onClick={() => updatePerson(person.id, { isIndexPerson: !person.isIndexPerson })}><Sparkles size={14} aria-hidden="true" />Index</button>
          <button className={visualSettings.hidden ? styles.personInspectorActionActive : ''} type="button" onClick={() => updateVisualSettings({ hidden: !visualSettings.hidden })}>{visualSettings.hidden ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}{visualSettings.hidden ? 'Show' : 'Hide'}</button>
          <button className={styles.personInspectorDeleteAction} type="button" onClick={() => deletePeople([person.id])}><Trash2 size={14} aria-hidden="true" />Delete</button>
        </div>
      </div>
    </section>
  );
}

function RelationshipInspector({ relationship }: { relationship: Relationship | undefined }) {
  const updateRelationship = useGenogramStore((state) => state.updateRelationship);
  const deleteRelationships = useGenogramStore((state) => state.deleteRelationships);
  const addTwinSibling = useGenogramStore((state) => state.addTwinSibling);
  const setSelection = useGenogramStore((state) => state.setSelection);
  const project = useGenogramStore((state) => state.project);
  const selectedRelationshipIds = useGenogramStore((state) => state.ui.selectedRelationshipIds);
  if (!relationship) return null;
  const definition = getRelationshipDefinition(relationship.type);
  const label = typeof relationship.attributes.label === 'string' ? relationship.attributes.label : '';
  const lineColor = typeof relationship.attributes.color === 'string' ? relationship.attributes.color : null;
  const hidden = relationship.attributes.hidden === true;
  const immigrationMarker = relationship.attributes.immigrationMarker === 'single' || relationship.attributes.immigrationMarker === 'double' ? relationship.attributes.immigrationMarker : 'none';
  const childRelationshipIds = isChildRelationship(relationship.type)
    ? project.relationships.filter((item) => isChildRelationship(item.type) && item.target === relationship.target).map((item) => item.id)
    : [];
  const targetRelationshipIds = childRelationshipIds.length > 0
    ? childRelationshipIds
    : selectedRelationshipIds.includes(relationship.id) ? selectedRelationshipIds : [relationship.id];
  const updateRelationshipIdsAttributes = (ids: string[], patch: Record<string, string | boolean | null>) => {
    for (const id of ids) {
      const current = project.relationships.find((item) => item.id === id);
      if (!current) continue;
      const attributes = { ...current.attributes };
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete attributes[key];
        else attributes[key] = value;
      }
      updateRelationship(id, { attributes });
    }
  };
  const updateSelectedLineAttributes = (patch: Record<string, string | boolean | null>) => updateRelationshipIdsAttributes(targetRelationshipIds, patch);
  const updateChildAttributes = (patch: Record<string, string | boolean | null>) => updateRelationshipIdsAttributes(childRelationshipIds, patch);
  const updateChildType = (type: RelationshipType) => childRelationshipIds.forEach((id) => updateRelationship(id, { type }));
  const partnerGroups: Array<{ label: string; types: RelationshipType[] }> = [
    { label: 'Commitment', types: ['dating', 'cohabitation', 'engagement', 'marriage', 'life-partner', 'unknown-partner'] },
    { label: 'Dissolution', types: ['actual-separation', 'separation', 'divorce', 'annulment', 'widowed'] },
    { label: 'Circumstances', types: ['affair', 'affair-separation', 'affair-divorce', 'affair-married', 'one-night-stand', 'rape'] },
  ];
  const lineActions = <div className={`${styles.lineActions} ${definition.category === 'emotional' ? styles.lineActionsTop : ''} ${definition.category === 'emotional' && definition.directed ? styles.lineActionsDirected : ''}`}>
    <button type="button" onClick={() => updateSelectedLineAttributes({ hidden: !hidden })}>{hidden ? <Eye size={15} /> : <EyeOff size={15} />}{hidden ? 'Show' : 'Hide'}</button>
    {definition.category === 'emotional' && definition.directed && <button className={styles.lineDirectionButton} type="button" aria-label="Reverse arrow direction" title="Reverse arrow direction" onClick={() => updateRelationship(relationship.id, { attributes: { ...relationship.attributes, directionReversed: relationship.attributes.directionReversed !== true } })}><ArrowLeftRight size={16} aria-hidden="true" /></button>}
    <button className={styles.lineDeleteButton} type="button" onClick={() => deleteRelationships(targetRelationshipIds)}><Trash2 size={15} />Delete</button>
  </div>;
  return (
    <section className={styles.inspectorContent} aria-label="Selected relationship">
      <div className={styles.inspectorHeading}><div><p className={styles.kicker}>Selected line</p><h3>{definition.category === 'partner' ? 'Partner relationship' : definition.category === 'emotional' ? 'Emotional line' : 'Child relationship'}</h3></div><button className={styles.iconButton} type="button" onClick={() => setSelection([])} aria-label="Close relationship editor">×</button></div>
      {definition.category === 'emotional' && lineActions}
      {definition.category === 'emotional' ? <>
        <label className={styles.field}><span>Label / notes</span><input placeholder="e.g. no communication" value={label} onChange={(event) => updateRelationship(relationship.id, { attributes: { ...relationship.attributes, label: event.target.value } })} /></label>
        <div className={styles.emotionalRelationshipGroups} aria-label="Emotional relationship types">{emotionalRelationshipGroups.map((group) => <div className={styles.relationshipTypeGroup} key={group.label}><p>{group.label}</p><div className={styles.emotionalRelationshipPicker}>{group.types.map((type) => {
          const option = RELATIONSHIP_DEFINITIONS[type];
          return <button className={relationship.type === type ? styles.emotionalRelationshipActive : ''} type="button" key={type} onClick={() => updateRelationship(relationship.id, { type })}><LegendLine kind={option.lineKind} label={option.label} color={option.color} type={type} /><span>{option.label}</span></button>;
        })}</div></div>)}</div>
      </> : definition.category === 'partner' ? <>
        <label className={styles.field}><span>Label</span><input placeholder="e.g. m. 1990" value={label} onChange={(event) => updateRelationship(relationship.id, { attributes: { ...relationship.attributes, label: event.target.value } })} /></label>
        {partnerGroups.map((group) => <div className={styles.relationshipTypeGroup} key={group.label}><p>{group.label}</p><div className={styles.partnerRelationshipPicker}>{group.types.map((type) => {
          const option = RELATIONSHIP_DEFINITIONS[type];
          return <button className={relationship.type === type ? styles.partnerRelationshipActive : ''} type="button" key={type} onClick={() => updateRelationship(relationship.id, { type })}><LegendLine kind={option.lineKind} label={option.label} /><span>{option.label}</span></button>;
        })}</div></div>)}
      </> : childRelationshipIds.length > 0 ? ( <>
        <div className={styles.relationshipTypeGroup}><p>Connection type</p><div className={styles.childRelationshipPicker}>{CHILD_RELATIONSHIP_TYPES.map((type) => {
          const option = RELATIONSHIP_DEFINITIONS[type];
          return <button className={relationship.type === type ? styles.childRelationshipActive : ''} type="button" key={type} onClick={() => updateChildType(type)}><LegendLine kind={option.lineKind} label={option.label} /><span>{option.label.replace(' child', '')}</span></button>;
        })}</div></div>
        <label className={styles.field}><span>Label / note</span><input placeholder="e.g. b. 1990" value={label} onChange={(event) => updateChildAttributes({ label: event.target.value || null })} /></label>
        <div className={styles.childInspectorGroup}><p>Add twin sibling</p><div className={styles.twinSiblingActions}>
          <button type="button" disabled={childRelationshipIds.length === 0} onClick={() => addTwinSibling(relationship.id, 'fraternal-twins')}><Users size={14} aria-hidden="true" />Fraternal</button>
          <button type="button" disabled={childRelationshipIds.length === 0} onClick={() => addTwinSibling(relationship.id, 'identical-twins')}><Copy size={14} aria-hidden="true" />Identical</button>
        </div></div>
        <div className={styles.childInspectorGroup}><p>Immigration marker</p><div className={styles.immigrationMarkerPicker}>{(['none', 'single', 'double'] as const).map((marker) => <button className={immigrationMarker === marker ? styles.immigrationMarkerActive : ''} type="button" key={marker} onClick={() => updateChildAttributes({ immigrationMarker: marker === 'none' ? null : marker })}>{marker === 'none' ? 'None' : marker === 'single' ? 'Single (~)' : 'Double (≈)'}</button>)}</div>
        <div><p className={styles.helpImigration}>Single - person lived in two or more cultures</p><p className={styles.helpImigration}>Double - person imigrated from another country</p></div></div>
      </>) : (
        <p className={styles.helpText}>
          Add a parent to one of the siblings to turn this into a standard parent-child relationship.
        </p>
      )}
      <p className={styles.helpText}>{definition.category === 'child' ? 'Create one child line from each parent. When the parents have a partner relationship, both lines merge at the union point.' : 'The line geometry carries the meaning in black-and-white exports.'}</p>
      <div className={styles.lineAppearanceEditor}>
        <span>Line color</span>
        <div className={styles.lineColorPicker} aria-label="Relationship line color">{relationshipLineColors.map((color) => <button className={lineColor === color ? styles.lineColorActive : ''} type="button" key={color} aria-label={`Set line color ${color}`} aria-pressed={lineColor === color} style={{ '--line-color': color } as CSSProperties} onClick={() => updateSelectedLineAttributes({ color })} />)}<button className={`${styles.lineColorReset} ${lineColor === null ? styles.lineColorActive : ''}`} type="button" aria-label="Use default line color" aria-pressed={lineColor === null} onClick={() => updateSelectedLineAttributes({ color: null })}><div>×</div></button></div>
      </div>
      {definition.category !== 'emotional' && lineActions}
    </section>
  );
}

function HouseholdInspector({ household, project }: { household: Household | undefined; project: Project }) {
  const updateHousehold = useGenogramStore((state) => state.updateHousehold);
  const deleteHouseholds = useGenogramStore((state) => state.deleteHouseholds);
  const setSelection = useGenogramStore((state) => state.setSelection);
  const setCanvasViewVisibility = useGenogramStore((state) => state.setCanvasViewVisibility);
  const viewSettings = useContext(CanvasViewContext);
  if (!household) return null;
  const members = household.memberIds.map((id) => project.people.find((person) => person.id === id)?.name).filter(Boolean);
  return (
    <section className={styles.inspectorContent} aria-label="Selected family boundary">
      <div className={styles.inspectorHeading}><div><p className={styles.kicker}>Selected boundary</p><h3>Family boundary</h3></div><button className={styles.iconButton} type="button" onClick={() => setSelection([])} aria-label="Close boundary editor">×</button></div>
      <button className={styles.boundaryVisibilityButton} type="button" onClick={() => setCanvasViewVisibility('backgrounds', !viewSettings.visibility.backgrounds)} aria-pressed={viewSettings.visibility.backgrounds}>{viewSettings.visibility.backgrounds ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}<span>{viewSettings.visibility.backgrounds ? 'Shown on canvas' : 'Hidden on canvas'}</span></button>
      <label className={styles.field}><span>Label</span><input value={household.label} onChange={(event) => updateHousehold(household.id, { label: event.target.value })} /></label>
      <p className={styles.helpText}>{members.length} member{members.length === 1 ? '' : 's'}: {members.join(', ')}</p>
      <div className={styles.inspectorActions}><button className={styles.inspectorDeleteButton} type="button" onClick={() => deleteHouseholds([household.id])}><Trash2 size={15} aria-hidden="true" />Delete</button></div>
    </section>
  );
}

function AnnotationFloatingEditor({ annotation }: { annotation: CanvasAnnotation }) {
  const updateAnnotation = useGenogramStore((state) => state.updateAnnotation);
  const deleteAnnotations = useGenogramStore((state) => state.deleteAnnotations);
  const fontSize = annotation.fontSize ?? (annotation.kind === 'text' ? 18 : 12);
  const annotationColor = !annotation.color || annotation.color === '#1d2f3a' ? '#000000' : annotation.color;
  const textColors = ['#000000', '#4f857c', '#9a5d55', '#d39d31'];
  const noteBackgroundColors = ['#f4efe4', '#dcebe5', '#f3e7e9', '#f6e6bd'];
  const colors = annotation.kind === 'note' ? noteBackgroundColors : textColors;
  const selectedColor = annotation.kind === 'note' ? (annotation.backgroundColor ?? '#f4efe4') : annotationColor;
  if (annotation.kind === 'secret') return <div className={styles.secretFloatingEditor} aria-label="Secret properties">
    <label><span>Label</span><input value={annotation.text} onChange={(event) => updateAnnotation(annotation.id, { text: event.target.value })} /></label>
    <label><span>Notes</span><textarea rows={3} value={annotation.notes ?? ''} onChange={(event) => updateAnnotation(annotation.id, { notes: event.target.value })} /></label>
  </div>;
  return <div className={styles.annotationFloatingEditor} aria-label={`${annotation.kind === 'note' ? 'Note' : 'Text'} properties`}>
    <div className={styles.annotationFormatBar} role="toolbar" aria-label="Text formatting">
      <select aria-label="Font family" value={annotation.fontFamily ?? 'sans'} onChange={(event) => updateAnnotation(annotation.id, { fontFamily: event.target.value as CanvasAnnotation['fontFamily'] })}><option value="sans">Inter</option><option value="serif">Serif</option><option value="mono">Mono</option></select>
      <button type="button" aria-label="Decrease font size" onClick={() => updateAnnotation(annotation.id, { fontSize: Math.max(9, fontSize - 1) })}><Minus size={14} /></button><output aria-label="Font size">{fontSize}</output><button type="button" aria-label="Increase font size" onClick={() => updateAnnotation(annotation.id, { fontSize: Math.min(64, fontSize + 1) })}><Plus size={14} /></button>
      <span className={styles.annotationFormatDivider} aria-hidden="true" />
      <button className={annotation.bold ? styles.annotationFormatActive : ''} type="button" aria-label="Bold" aria-pressed={Boolean(annotation.bold)} onClick={() => updateAnnotation(annotation.id, { bold: !annotation.bold })}><Bold size={15} /></button>
      <button className={annotation.italic ? styles.annotationFormatActive : ''} type="button" aria-label="Italic" aria-pressed={Boolean(annotation.italic)} onClick={() => updateAnnotation(annotation.id, { italic: !annotation.italic })}><Italic size={15} /></button>
      <button className={annotation.underline ? styles.annotationFormatActive : ''} type="button" aria-label="Underline" aria-pressed={Boolean(annotation.underline)} onClick={() => updateAnnotation(annotation.id, { underline: !annotation.underline })}><Underline size={15} /></button>
      <div className={styles.annotationColorMenu} aria-label={annotation.kind === 'note' ? 'Note background color' : 'Text color'}>{colors.map((color) => <button className={selectedColor === color ? styles.annotationColorActive : ''} type="button" key={color} aria-label={annotation.kind === 'note' ? `Set note background color ${color}` : `Set text color ${color}`} style={{ '--annotation-color': color } as CSSProperties} onClick={() => updateAnnotation(annotation.id, annotation.kind === 'note' ? { backgroundColor: color } : { color })} />)}</div>
      <button className={styles.annotationDeleteAction} type="button" aria-label={`Delete ${annotation.kind}`} onClick={() => deleteAnnotations([annotation.id])}><Trash2 size={15} /></button>
    </div>
  </div>;
}

function AnnotationLinkInspector({ sourceId, targetId, onClose }: { sourceId: string; targetId: string; onClose: () => void }) {
  const project = useGenogramStore((state) => state.project);
  const updateAnnotationLink = useGenogramStore((state) => state.updateAnnotationLink);
  const deleteAnnotationLink = useGenogramStore((state) => state.deleteAnnotationLink);
  const source = project.annotations.find((annotation) => annotation.id === sourceId);
  if (!source?.linkedIds?.includes(targetId)) return null;
  const attributes = source.linkAttributes?.[targetId] ?? {};
  const lineColor = attributes.color ?? null;
  const hidden = attributes.hidden === true;
  const deleteLink = () => {
    deleteAnnotationLink(sourceId, targetId);
    onClose();
  };
  return <section className={styles.inspectorContent} aria-label="Selected annotation link">
    <div className={styles.inspectorHeading}><div><p className={styles.kicker}>Selected link</p><h3>Annotation link</h3></div><button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close link editor">×</button></div>
    <label className={styles.field}><span>Label / note</span><input placeholder="e.g. Roommate, Mentor, Caregiver" value={attributes.label ?? ''} onChange={(event) => updateAnnotationLink(sourceId, targetId, { label: event.target.value })} /></label>
    <div className={styles.lineAppearanceEditor}>
      <span>Line color</span>
      <div className={styles.lineColorPicker} aria-label="Annotation link color">{relationshipLineColors.map((color) => <button className={lineColor === color ? styles.lineColorActive : ''} type="button" key={color} aria-label={`Set line color ${color}`} aria-pressed={lineColor === color} style={{ '--line-color': color } as CSSProperties} onClick={() => updateAnnotationLink(sourceId, targetId, { color })} />)}<button className={`${styles.lineColorReset} ${lineColor === null ? styles.lineColorActive : ''}`} type="button" aria-label="Use default gray" aria-pressed={lineColor === null} onClick={() => updateAnnotationLink(sourceId, targetId, { color: undefined })}>×</button></div>
    </div>
    <div className={styles.lineActions}>
      <button type="button" onClick={() => updateAnnotationLink(sourceId, targetId, { hidden: !hidden })}>{hidden ? <Eye size={15} /> : <EyeOff size={15} />}{hidden ? 'Show' : 'Hide'}</button>
      <button className={styles.lineDeleteButton} type="button" onClick={deleteLink}><Trash2 size={15} />Delete</button>
    </div>
  </section>;
}

type FeedbackTone = 'success' | 'error' | 'info';
interface Feedback { tone: FeedbackTone; message: string }
const previewFallbackProject = createPreviewProject();
const CANVAS_SNAP_GRID: [number, number] = [CANVAS_GRID_SIZE, CANVAS_GRID_SIZE];
const waitForPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
type CanvasToolMode = 'select' | 'pan' | 'multi';

function pointHitsPersonSymbol(person: Person, position: { x: number; y: number }, point: { x: number; y: number }): boolean {
  const bounds = personSymbolBoundsOffsets(person);
  const left = position.x + bounds.left;
  const right = position.x + bounds.right;
  const top = position.y + bounds.top;
  const bottom = position.y + bounds.bottom;
  if (point.x < left || point.x > right || point.y < top || point.y > bottom) return false;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const radiusX = Math.max(1, (right - left) / 2);
  const radiusY = Math.max(1, (bottom - top) / 2);
  if (person.symbolKind === 'person' && (person.gender === 'female' || person.gender === 'trans-female' || person.gender === 'intersex')) {
    return ((point.x - centerX) / radiusX) ** 2 + ((point.y - centerY) / radiusY) ** 2 <= 1;
  }
  if (person.symbolKind === 'person' && (person.gender === 'nonbinary' || person.gender === 'unspecified' || person.gender === 'other')) {
    return Math.abs(point.x - centerX) / radiusX + Math.abs(point.y - centerY) / radiusY <= 1;
  }
  return true;
}

function annotationCanvasSize(annotation: CanvasAnnotation | CanvasAnnotationKind) {
  const kind = typeof annotation === 'string' ? annotation : annotation.kind;
  if (kind === 'text') return { width: 180, height: 48 };
  if (kind === 'secret') return { width: 120, height: 96 };
  return typeof annotation === 'string'
    ? { width: 190, height: 116 }
    : { width: annotation.width ?? 190, height: annotation.height ?? 116 };
}

const AUTOSAVE_DEBOUNCE_MS = 700;
function projectOperationError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function EditProjectLifecycle({ projectId }: { projectId: string | null }) {
  const project = useGenogramStore((state) => state.project);
  const replaceProject = useGenogramStore((state) => state.replaceProject);
  const setSaveStatus = useGenogramStore((state) => state.setSaveStatus);
  const [ready, setReady] = useState(!projectId);
  const [loadError, setLoadError] = useState<string | null>(projectId ? null : 'Choose a project from the dashboard.');

  useEffect(() => {
    let active = true;
    if (!projectId) return () => { active = false; };

    loadLocalProject(projectId).then((savedProject) => {
      if (!active) return;
      if (!savedProject) {
        setLoadError('This local project was not found.');
        setReady(true);
        return;
      }
      replaceProject(savedProject);
      setReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      const message = projectOperationError(error, 'Local project could not be restored.');
      setSaveStatus('error', message);
      setLoadError(message);
      setReady(true);
    });
    return () => { active = false; };
  }, [projectId, replaceProject, setSaveStatus]);

  useEffect(() => {
    if (!ready || loadError) return;
    let active = true;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveLocalProject(project).then(() => {
        if (active) setSaveStatus('saved');
      }).catch((error: unknown) => {
        if (active) setSaveStatus('error', projectOperationError(error, 'Local project could not be saved.'));
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadError, project, ready, setSaveStatus]);

  if (!ready) {
    return <div className={styles.persistenceLoading} role="status" aria-live="polite">Loading local project…</div>;
  }
  if (loadError) {
    return <div className={styles.persistenceLoading} role="alert"><span>{loadError}</span><Link href="/">Back to dashboard</Link></div>;
  }

  return <GenogramCanvas key={`local:${project.id}`} mode="edit" />;
}

function GenogramCanvas({ mode, initialProject }: Required<Pick<GenogramEditorProps, 'mode'>> & Pick<GenogramEditorProps, 'initialProject'>) {
  const router = useRouter();
  const [canvasToolMode, setCanvasToolMode] = useState<CanvasToolMode>('select');
  const [showPersonMenu, setShowPersonMenu] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<RelationshipType>('marriage');
  const [relationshipMode, setRelationshipMode] = useState(false);
  const [relationshipSourceId, setRelationshipSourceId] = useState<string | null>(null);
  const [relationshipTargetId, setRelationshipTargetId] = useState<string | null>(null);
  const [annotationConnectionSourceId, setAnnotationConnectionSourceId] = useState<string | null>(null);
  const [annotationConnectionTargetId, setAnnotationConnectionTargetId] = useState<string | null>(null);
  const [selectedAnnotationLink, setSelectedAnnotationLink] = useState<{ id: string; sourceId: string; targetId: string } | null>(null);
  const [connectionCursor, setConnectionCursor] = useState<{ x: number; y: number } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const annotationActionContext = useMemo<AnnotationActionContextValue>(() => ({
    editingId: editingAnnotationId,
    finishEditing: () => setEditingAnnotationId(null),
  }), [editingAnnotationId]);
  const fileMenuId = `genogram-file-menu-${useId().replace(/:/g, '')}`;
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasPaneRef = useRef<HTMLDivElement | null>(null);
  const labelToolRef = useRef<HTMLDivElement | null>(null);
  const viewToolRef = useRef<HTMLDivElement | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const fileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);
  const storedProject = useGenogramStore((state) => state.project);
  const replaceProject = useGenogramStore((state) => state.replaceProject); 
  const ui = useGenogramStore((state) => state.ui);
  const addPerson = useGenogramStore((state) => state.addPerson);
  const addAnnotation = useGenogramStore((state) => state.addAnnotation);
  const addAnnotationLink = useGenogramStore((state) => state.addAnnotationLink);
  const deleteAnnotationLink = useGenogramStore((state) => state.deleteAnnotationLink);
  const quickAddRelative = useGenogramStore((state) => state.quickAddRelative);
  const addRelationship = useGenogramStore((state) => state.addRelationship);
  const addHousehold = useGenogramStore((state) => state.addHousehold);
  const deletePeople = useGenogramStore((state) => state.deletePeople);
  const deleteRelationships = useGenogramStore((state) => state.deleteRelationships);
  const deleteHouseholds = useGenogramStore((state) => state.deleteHouseholds);
  const deleteAnnotations = useGenogramStore((state) => state.deleteAnnotations);
  const duplicatePeople = useGenogramStore((state) => state.duplicatePeople);
  const setSelection = useGenogramStore((state) => state.setSelection);
  const setActivePanel = useGenogramStore((state) => state.setActivePanel);
  const setSaveStatus = useGenogramStore((state) => state.setSaveStatus);
  const beginNodeDrag = useGenogramStore((state) => state.beginNodeDrag);
  const updateNodePositions = useGenogramStore((state) => state.updateNodePositions);
  const endNodeDrag = useGenogramStore((state) => state.endNodeDrag);
  const setViewport = useGenogramStore((state) => state.setViewport);
  const setPersonLabelVisibility = useGenogramStore((state) => state.setPersonLabelVisibility);
  const setWrapPersonLabels = useGenogramStore((state) => state.setWrapPersonLabels);
  const setCanvasViewVisibility = useGenogramStore((state) => state.setCanvasViewVisibility);
  const undo = useGenogramStore((state) => state.undo);
  const redo = useGenogramStore((state) => state.redo);
  const project = mode === 'preview' ? (initialProject ?? previewFallbackProject) : storedProject;
  const personLabelContext = useMemo<PersonLabelContextValue>(() => ({
    visibility: {
      ...createDefaultPersonLabelVisibility(),
      ...project.canvas.personLabelVisibility,
    },
    wrapLongText: project.canvas.wrapPersonLabels === true,
  }), [project.canvas.personLabelVisibility, project.canvas.wrapPersonLabels]);
  const canvasViewContext = useMemo<CanvasViewContextValue>(() => ({
    visibility: {
      ...createDefaultCanvasViewVisibility(),
      ...project.canvas.viewVisibility,
    },
  }), [project.canvas.viewVisibility]);
  const closeFileMenu = useCallback((returnFocus = false) => {
    setFileMenuOpen(false);
    if (returnFocus) fileTriggerRef.current?.focus();
  }, []);
  const nodes = useMemo(() => {
    let flowNodes = projectToFlowNodes(project, mode === 'edit' ? ui.selectedPersonIds : [], mode === 'edit' ? ui.selectedHouseholdIds : [], mode === 'edit' ? ui.selectedAnnotationIds : []);
    if (!canvasViewContext.visibility.backgrounds) flowNodes = flowNodes.filter((node) => node.type !== 'household');
    if (mode === 'edit' && annotationConnectionSourceId) return flowNodes.map((node) => {
      if (node.type !== 'person' && node.type !== 'annotation') return node;
      const role = node.id === annotationConnectionSourceId
        ? 'genogram-connection-source'
        : node.id === annotationConnectionTargetId ? 'genogram-connection-target-active' : 'genogram-connection-target';
      return { ...node, className: [node.className, role].filter(Boolean).join(' ') };
    });
    if (mode !== 'edit' || !relationshipMode || !relationshipSourceId) return flowNodes;
    return flowNodes.map((node) => {
      if (node.type !== 'person') return node;
      const sourcePosition = project.canvas.positions[relationshipSourceId];
      const targetPosition = project.canvas.positions[node.id];
      const automaticRelationship = connectionType === 'marriage' && node.id !== relationshipSourceId && sourcePosition && targetPosition
        ? inferAutomaticRelationship(relationshipSourceId, node.id, sourcePosition.y, targetPosition.y)
        : null;
      const role = node.id === relationshipSourceId
        ? 'genogram-connection-source'
        : node.id === relationshipTargetId ? 'genogram-connection-target-active' : 'genogram-connection-target';
      return {
        ...node,
        className: [node.className, role].filter(Boolean).join(' '),
        data: {
          ...node.data,
          connectionCue: node.id === relationshipTargetId,
          connectionLabel: automaticRelationship
            ? `Link as ${automaticRelationship.targetRole}`
            : `Link as ${RELATIONSHIP_CATEGORY_LABELS[getRelationshipDefinition(connectionType).category]}`,
        },
      };
    });
  }, [annotationConnectionSourceId, annotationConnectionTargetId, canvasViewContext.visibility.backgrounds, connectionType, mode, project, relationshipMode, relationshipSourceId, relationshipTargetId, ui.selectedAnnotationIds, ui.selectedHouseholdIds, ui.selectedPersonIds]);
  const edges = useMemo(() => projectToFlowEdges(project, mode === 'edit' ? ui.selectedRelationshipIds : [], mode === 'edit' ? selectedAnnotationLink?.id ?? null : null), [mode, project, selectedAnnotationLink?.id, ui.selectedRelationshipIds]);
  const selectedPerson = project.people.find((person) => person.id === ui.selectedPersonIds[0]);
  const selectedRelationship = project.relationships.find((relationship) => relationship.id === ui.selectedRelationshipIds[0]);
  const selectedHousehold = project.households.find((household) => household.id === ui.selectedHouseholdIds[0]);
  const selectedAnnotation = project.annotations.find((annotation) => annotation.id === ui.selectedAnnotationIds[0]);
  const selectedItemCount = ui.selectedPersonIds.length + ui.selectedRelationshipIds.length + ui.selectedHouseholdIds.length + ui.selectedAnnotationIds.length;
  const selectedSymbolCount = ui.selectedPersonIds.length + ui.selectedHouseholdIds.length + ui.selectedAnnotationIds.length;
  const selectionActionPosition = useMemo(() => {
    const bounds: Array<{ left: number; top: number; right: number; bottom: number }> = [];
    for (const id of ui.selectedPersonIds) {
      const position = project.canvas.positions[id];
      if (position) bounds.push({ left: position.x, top: position.y, right: position.x + 132, bottom: position.y + 180 });
    }
    for (const id of ui.selectedAnnotationIds) {
      const annotation = project.annotations.find((item) => item.id === id);
      const position = project.canvas.positions[id];
      if (!annotation || !position) continue;
      const size = annotationCanvasSize(annotation);
      bounds.push({ left: position.x, top: position.y, right: position.x + size.width, bottom: position.y + size.height });
    }
    for (const id of ui.selectedHouseholdIds) {
      const household = project.households.find((item) => item.id === id);
      if (!household) continue;
      const positions = household.memberIds.map((memberId) => project.canvas.positions[memberId]).filter(Boolean);
      if (!positions.length) continue;
      bounds.push({
        left: Math.min(...positions.map((position) => position.x)) - 42,
        top: Math.min(...positions.map((position) => position.y)) - 42,
        right: Math.max(...positions.map((position) => position.x + 132)) + 42,
        bottom: Math.max(...positions.map((position) => position.y + 180)) + 42,
      });
    }
    if (!bounds.length) return null;
    const centerX = (Math.min(...bounds.map((item) => item.left)) + Math.max(...bounds.map((item) => item.right))) / 2;
    const top = Math.min(...bounds.map((item) => item.top));
    const { x, y, zoom } = project.canvas.viewport;
    return {
      left: `clamp(148px, ${centerX * zoom + x}px, calc(100% - 148px))`,
      top: `clamp(92px, ${top * zoom + y - 12}px, calc(100% - 104px))`,
    } as CSSProperties;
  }, [project.annotations, project.canvas.positions, project.canvas.viewport, project.households, ui.selectedAnnotationIds, ui.selectedHouseholdIds, ui.selectedPersonIds]);
  const annotationEditorPosition = useMemo(() => {
    if (!selectedAnnotation || ui.selectedAnnotationIds.length !== 1) return null;
    const position = project.canvas.positions[selectedAnnotation.id];
    if (!position) return null;
    const size = annotationCanvasSize(selectedAnnotation);
    const { x, y, zoom } = project.canvas.viewport;
    const centerX = (position.x + size.width / 2) * zoom + x;
    const bottom = (position.y + size.height) * zoom + y + 12;
    return {
      left: `clamp(178px, ${centerX}px, calc(100% - 178px))`,
      top: `clamp(104px, ${bottom}px, calc(100% - 210px))`,
    } as CSSProperties;
  }, [project.canvas.positions, project.canvas.viewport, selectedAnnotation, ui.selectedAnnotationIds.length]);
  const showInspector = !ui.dragSnapshot && Boolean(
    (ui.activePanel === 'person' && selectedPerson)
      || (ui.activePanel === 'household' && selectedHousehold)
      || selectedRelationship
      || selectedAnnotationLink,
  );
  const connectionSourcePoint = useMemo(() => {
    if (!relationshipMode || !relationshipSourceId) return null;
    const position = project.canvas.positions[relationshipSourceId];
    if (!position) return null;
    const { x, y, zoom } = project.canvas.viewport;
    return { x: (position.x + 66) * zoom + x, y: (position.y + 42) * zoom + y };
  }, [project.canvas.positions, project.canvas.viewport, relationshipMode, relationshipSourceId]);
  const connectionTargetPoint = useMemo(() => {
    if (!relationshipMode || !relationshipTargetId) return null;
    const position = project.canvas.positions[relationshipTargetId];
    if (!position) return null;
    const { x, y, zoom } = project.canvas.viewport;
    return { x: (position.x + 66) * zoom + x, y: (position.y + 42) * zoom + y };
  }, [project.canvas.positions, project.canvas.viewport, relationshipMode, relationshipTargetId]);
  const annotationConnectionSourcePoint = useMemo(() => {
    if (!annotationConnectionSourceId) return null;
    const source = project.annotations.find((annotation) => annotation.id === annotationConnectionSourceId);
    const position = project.canvas.positions[annotationConnectionSourceId];
    if (!source || !position) return null;
    const { x, y, zoom } = project.canvas.viewport;
    const size = annotationCanvasSize(source);
    return { x: (position.x + size.width / 2) * zoom + x, y: (position.y + size.height / 2 - 12) * zoom + y };
  }, [annotationConnectionSourceId, project.annotations, project.canvas.positions, project.canvas.viewport]);
  const annotationConnectionTargetPoint = useMemo(() => {
    if (!annotationConnectionTargetId) return null;
    const position = project.canvas.positions[annotationConnectionTargetId];
    if (!position) return null;
    const { x, y, zoom } = project.canvas.viewport;
    const person = project.people.find((item) => item.id === annotationConnectionTargetId);
    if (person) {
      const anchors = personSymbolAnchorOffsets(person);
      return { x: (position.x + 66) * zoom + x, y: (position.y + (anchors.top + anchors.bottom) / 2) * zoom + y };
    }
    const annotation = project.annotations.find((item) => item.id === annotationConnectionTargetId);
    if (!annotation) return null;
    const size = annotationCanvasSize(annotation);
    return { x: (position.x + size.width / 2) * zoom + x, y: (position.y + size.height / 2 + 12) * zoom + y };
  }, [annotationConnectionTargetId, project.annotations, project.canvas.positions, project.canvas.viewport, project.people]);
  const activeConnectionSourcePoint = annotationConnectionSourcePoint ?? connectionSourcePoint;
  const connectionEndPoint = annotationConnectionTargetPoint ?? connectionTargetPoint ?? connectionCursor;
  const connectionModeActive = relationshipMode || Boolean(annotationConnectionSourceId);

  const showFeedback = useCallback((tone: FeedbackTone, message: string, duration = 3200) => {
    setFeedback({ tone, message });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), duration);
  }, []);
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);

  useEffect(() => {
    if (!fileMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (fileMenuRef.current?.contains(target) || fileTriggerRef.current?.contains(target)) return;
      closeFileMenu();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [closeFileMenu, fileMenuOpen]);

  useEffect(() => {
    if (!showLabelMenu) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !labelToolRef.current?.contains(target)) setShowLabelMenu(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [showLabelMenu]);

  useEffect(() => {
    if (!showViewMenu) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !viewToolRef.current?.contains(target)) setShowViewMenu(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [showViewMenu]);

  const downloadProjectFile = useCallback(() => {
    try {
      const contents = serializeProject(project);
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = getProjectFileName(project);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showFeedback('success', 'Project downloaded.');
      return true;
    } catch (error: unknown) {
      const message = projectOperationError(error, 'Project could not be downloaded.');
      setSaveStatus('error', message);
      showFeedback('error', message, 5200);
      return false;
    }
  }, [project, setSaveStatus, showFeedback]);
  
const renameProject = useCallback(async (): Promise<void> => {
  const nextName = window.prompt('Rename project', project.name);
  if (nextName === null) return; 
  const trimmedName = nextName.trim();
  if (trimmedName === '' || trimmedName === project.name) return;
  setSaveStatus('saving');
  try {
    const renamedProject: Project = {
      ...project,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
    };

    await saveLocalProject(renamedProject);
    replaceProject(renamedProject);
    setSaveStatus('saved');

    showFeedback('success', 'Project renamed.');
  } catch (error: unknown) {
    const message = projectOperationError(error, 'The project could not be renamed.');
    setSaveStatus('error', message);
    showFeedback('error', message, 5200);
  }
}, [
  project,
  replaceProject,
  setSaveStatus,
  showFeedback,
]);

  const startNewProject = useCallback(async () => {
    try {
      const newProject = createEmptyProject();
      await saveLocalProject(newProject);
      router.push(`/edit?project=${encodeURIComponent(newProject.id)}`);
    } catch (error: unknown) {
      const message = projectOperationError(error, 'A local project could not be created.');
      setSaveStatus('error', message);
      showFeedback('error', message, 5200);
    }
  }, [router, setSaveStatus, showFeedback]);

  const exportPng = useCallback(async (): Promise<boolean> => {
    if (exportingPng) return false;
    const bounds = getProjectExportBounds(project);
    if (!bounds) {
      showFeedback('error', 'Add a person or annotation before exporting.', 5200);
      return false;
    }

    const selection = {
      people: [...ui.selectedPersonIds],
      relationships: [...ui.selectedRelationshipIds],
      households: [...ui.selectedHouseholdIds],
      annotations: [...ui.selectedAnnotationIds],
      activePanel: ui.activePanel,
    };
    let frame: HTMLDivElement | null = null;
    setExportingPng(true);
    setSelection([]);
    setActivePanel(null);

    try {
      await waitForPaint();
      const viewport = canvasPaneRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
      if (!viewport) throw new Error('The genogram canvas is not ready.');

      const plan = createPngExportPlan(bounds);
      const clone = viewport.cloneNode(true) as HTMLElement;
      const edgeLayer = clone.querySelector<HTMLElement>('.react-flow__edges');
      if (edgeLayer) {
        edgeLayer.style.position = 'absolute';
        edgeLayer.style.inset = '0';
        edgeLayer.style.width = '100%';
        edgeLayer.style.height = '100%';
      }
      clone.querySelectorAll<SVGSVGElement>('.react-flow__edges svg').forEach((svg) => {
        svg.setAttribute('width', `${plan.width}`);
        svg.setAttribute('height', `${plan.height}`);
        svg.style.position = 'absolute';
        svg.style.inset = '0';
        svg.style.width = `${plan.width}px`;
        svg.style.height = `${plan.height}px`;
        svg.style.overflow = 'visible';
      });
      const excludedSelectors = [
        '.react-flow__handle',
        '.react-flow__selection',
        `.${styles.personQuickActions}`,
        `.${styles.secretQuickActions}`,
        `.${styles.relationshipDragHandle}`,
        `.${styles.emotionalEndpoint}`,
        `.${styles.emotionalControlPoint}`,
        `.${styles.emotionalControlPointDeleteButton}`,
        `.${styles.emotionalResetButton}`,
        `.${styles.emotionalLineHitArea}`,
        `.${styles.connectionTargetCue}`,
        `.${styles.hiddenPersonBadge}`,
      ].join(',');
      clone.querySelectorAll(excludedSelectors).forEach((element) => element.remove());
      clone.querySelectorAll('.selected').forEach((element) => element.classList.remove('selected'));
      clone.querySelectorAll('.genogram-connection-source, .genogram-connection-target, .genogram-connection-target-active').forEach((element) => {
        element.classList.remove('genogram-connection-source', 'genogram-connection-target', 'genogram-connection-target-active');
      });
      clone.style.position = 'absolute';
      clone.style.inset = '0';
      clone.style.width = '100%';
      clone.style.height = '100%';
      clone.style.transformOrigin = '0 0';
      clone.style.transform = `translate(${plan.translateX}px, ${plan.translateY}px) scale(${plan.contentScale})`;

      frame = document.createElement('div');
      frame.className = styles.pngExportFrame;
      frame.style.width = `${plan.width}px`;
      frame.style.height = `${plan.height}px`;
      frame.appendChild(clone);
      document.body.appendChild(frame);

      const dataUrl = await toPng(frame, {
        width: plan.width,
        height: plan.height,
        pixelRatio: plan.pixelRatio,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipAutoScale: true,
        style: { position: 'relative', top: '0', left: '0' },
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = getPngExportFileName(project);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showFeedback('success', 'PNG downloaded.');
      return true;
    } catch (error: unknown) {
      showFeedback('error', projectOperationError(error, 'PNG could not be exported.'), 5200);
      return false;
    } finally {
      frame?.remove();
      setSelection(selection.people, selection.relationships, selection.households, selection.annotations);
      setActivePanel(selection.activePanel);
      setExportingPng(false);
    }
  }, [exportingPng, project, setActivePanel, setSelection, showFeedback, ui.activePanel, ui.selectedAnnotationIds, ui.selectedHouseholdIds, ui.selectedPersonIds, ui.selectedRelationshipIds]);

  const handleProjectFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > MAX_PROJECT_FILE_BYTES) {
      const message = `Project file is larger than ${MAX_PROJECT_FILE_BYTES / (1024 * 1024)} MB.`;
      setSaveStatus('error', message);
      showFeedback('error', message, 5200);
      return;
    }

    try {
      const importedProject = await importLocalProject(parseProjectFile(await file.text()));
      router.push(`/edit?project=${encodeURIComponent(importedProject.id)}`);
    } catch (error: unknown) {
      const message = projectOperationError(error, 'Project file could not be opened.');
      setSaveStatus('error', message);
      showFeedback('error', message, 5200);
    }
  }, [router, setSaveStatus, showFeedback]);

  const canvasCenterPosition = useCallback((width: number, height: number) => {
    const bounds = canvasPaneRef.current?.getBoundingClientRect();
    const { x, y, zoom } = project.canvas.viewport;
    const screenWidth = bounds?.width ?? 900;
    const screenHeight = bounds?.height ?? 680;
    return {
      x: (screenWidth / 2 - x) / zoom - width / 2,
      y: (screenHeight / 2 - y) / zoom - height / 2,
    };
  }, [project.canvas.viewport]);

  const activateCanvasTool = useCallback((nextMode: CanvasToolMode) => {
    setCanvasToolMode(nextMode);
    setShowPersonMenu(false);
    setShowLabelMenu(false);
    setRelationshipMode(false);
    setRelationshipSourceId(null);
    setRelationshipTargetId(null);
    setAnnotationConnectionSourceId(null);
    setAnnotationConnectionTargetId(null);
    setSelectedAnnotationLink(null);
    setConnectionCursor(null);
    if (nextMode === 'pan') { setSelection([]); setActivePanel(null); }
    showFeedback('info', nextMode === 'select' ? 'Selection mode.' : nextMode === 'pan' ? 'Pan mode: drag the canvas.' : 'Multi-select mode: drag a box around items.');
  }, [setActivePanel, setSelection, showFeedback]);

  const addPersonFromToolbar = useCallback((input: Partial<Pick<Person, 'gender' | 'symbolKind'>>) => {
    addPerson({ ...input, position: canvasCenterPosition(132, 180) });
    setCanvasToolMode('select');
    setShowPersonMenu(false);
    setShowLabelMenu(false);
    setAnnotationConnectionSourceId(null);
    setAnnotationConnectionTargetId(null);
    setConnectionCursor(null);
  }, [addPerson, canvasCenterPosition]);

  const addAnnotationFromToolbar = useCallback((kind: CanvasAnnotationKind) => {
    const size = annotationCanvasSize(kind);
    const position = canvasCenterPosition(size.width, size.height);
    const offset = (project.annotations.length % 5) * 24;
    addAnnotation(kind, { x: position.x + offset, y: position.y + offset });
    setCanvasToolMode('select');
    setShowPersonMenu(false);
    setShowLabelMenu(false);
    setAnnotationConnectionSourceId(null);
    setAnnotationConnectionTargetId(null);
    setConnectionCursor(null);
  }, [addAnnotation, canvasCenterPosition, project.annotations.length]);

  const attemptRelationship = useCallback((source?: string | null, target?: string | null) => {
    if (mode !== 'edit') return null;
    let resolvedType = connectionType;
    let resolvedSource = source;
    let resolvedTarget = target;
    let targetRole: 'Parent' | 'Partner' | 'Child' | null = null;
    const sourcePosition = source ? project.canvas.positions[source] : null;
    const targetPosition = target ? project.canvas.positions[target] : null;
    if (connectionType === 'marriage' && source && target && sourcePosition && targetPosition) {
      const automaticRelationship = inferAutomaticRelationship(source, target, sourcePosition.y, targetPosition.y);
      resolvedType = automaticRelationship.type;
      resolvedSource = automaticRelationship.source;
      resolvedTarget = automaticRelationship.target;
      targetRole = automaticRelationship.targetRole;
    }
    const error = getRelationshipConnectionError(project, resolvedType, resolvedSource, resolvedTarget);
    if (error) { showFeedback('error', error, 4600); return null; }
    const id = addRelationship(resolvedType, resolvedSource as string, resolvedTarget as string);
    if (!id) return null;
    setSelection([], [id]);
    setActivePanel(null);
    setRelationshipSourceId(null);
    setRelationshipTargetId(null);
    setRelationshipMode(false);
    setConnectionCursor(null);
    showFeedback('success', targetRole ? `${targetRole} connection created.` : `${getRelationshipDefinition(resolvedType).label} created.`);
    return id;
  }, [addRelationship, connectionType, mode, project, setActivePanel, setSelection, showFeedback]);

  const runPersonQuickAction = useCallback((personId: string, action: PersonQuickAction) => {
    if (mode !== 'edit') return;
    if (action === 'emotional' || action === 'connection') {
      setCanvasToolMode('select');
      setConnectionType(action === 'emotional' ? 'close' : 'marriage');
      setRelationshipMode(true);
      setRelationshipSourceId(personId);
      setRelationshipTargetId(null);
      setConnectionCursor(null);
      setSelection([personId]);
      setActivePanel(null);
      showFeedback('info', action === 'emotional' ? 'Emotional line: select the second person.' : 'Select the person to connect.', 5200);
      return;
    }
    const created = quickAddRelative(personId, action);
    if (created.length > 0) showFeedback('success', `${action === 'parents' ? 'Parents' : action[0].toUpperCase() + action.slice(1)} added.`);
    else showFeedback('info', action === 'parents' ? 'This person already has two parents.' : 'No symbol was added.');
  }, [mode, quickAddRelative, setActivePanel, setSelection, showFeedback]);

  const isPersonQuickActionDisabled = useCallback((personId: string, action: PersonQuickAction) => {
    if (action !== 'parents') return false;
    const parentIds = new Set(project.relationships
      .filter((relationship) => isChildRelationship(relationship.type) && relationship.target === personId)
      .map((relationship) => relationship.source));
    return parentIds.size >= 2;
  }, [project.relationships]);

  const beginAnnotationConnection = useCallback((annotationId: string) => {
    if (mode !== 'edit') return;
    setCanvasToolMode('select');
    setRelationshipMode(false);
    setRelationshipSourceId(null);
    setRelationshipTargetId(null);
    setAnnotationConnectionSourceId(annotationId);
    setAnnotationConnectionTargetId(null);
    setSelectedAnnotationLink(null);
    setConnectionCursor(null);
    setSelection([], [], [], [annotationId]);
    setActivePanel(null);
    showFeedback('info', 'Select an item to create a dashed link.', 5200);
  }, [mode, setActivePanel, setSelection, showFeedback]);

  const personActionContext = useMemo<PersonActionContextValue | null>(
    () => mode === 'edit' ? { enabled: canvasToolMode === 'select' && !connectionModeActive && !ui.dragSnapshot, run: runPersonQuickAction, isDisabled: isPersonQuickActionDisabled } : null,
    [canvasToolMode, connectionModeActive, isPersonQuickActionDisabled, mode, runPersonQuickAction, ui.dragSnapshot],
  );
  const annotationLinkActionContext = useMemo<AnnotationLinkActionContextValue | null>(
    () => mode === 'edit' ? { enabled: canvasToolMode === 'select' && !connectionModeActive && !ui.dragSnapshot, beginConnection: beginAnnotationConnection } : null,
    [beginAnnotationConnection, canvasToolMode, connectionModeActive, mode, ui.dragSnapshot],
  );

  const attemptAnnotationLink = useCallback((sourceId: string, targetId: string) => {
    if (mode !== 'edit') return;
    const linked = addAnnotationLink(sourceId, targetId);
    setAnnotationConnectionSourceId(null);
    setAnnotationConnectionTargetId(null);
    setConnectionCursor(null);
    setSelection([], [], [], [sourceId]);
    setActivePanel(null);
    showFeedback(linked ? 'success' : 'info', linked ? 'Dashed link created.' : 'These items are already linked.');
  }, [addAnnotationLink, mode, setActivePanel, setSelection, showFeedback]);

  const onNodesChange = useCallback<OnNodesChange<FlowNode>>((changes: NodeChange<FlowNode>[]) => {
    if (mode !== 'edit') return;
    const positions: Record<string, { x: number; y: number }> = {};
    const removedPeople: string[] = [];
    const removedAnnotations: string[] = [];
    for (const change of changes) {
      if (change.type === 'position' && change.position && (project.people.some((person) => person.id === change.id) || project.annotations.some((annotation) => annotation.id === change.id))) positions[change.id] = change.position;
      if (change.type === 'remove' && project.people.some((person) => person.id === change.id)) removedPeople.push(change.id);
      if (change.type === 'remove' && project.annotations.some((annotation) => annotation.id === change.id)) removedAnnotations.push(change.id);
    }
    if (Object.keys(positions).length) updateNodePositions(positions);
    if (removedPeople.length) deletePeople(removedPeople);
    if (removedAnnotations.length) deleteAnnotations(removedAnnotations);
  }, [deleteAnnotations, deletePeople, mode, project.annotations, project.people, updateNodePositions]);

  const onEdgesChange = useCallback<OnEdgesChange<FlowEdge>>((changes: EdgeChange<FlowEdge>[]) => {
    if (mode !== 'edit') return;
    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id).filter((id) => project.relationships.some((relationship) => relationship.id === id));
    if (removed.length) deleteRelationships(removed);
  }, [deleteRelationships, mode, project.relationships]);

  const onNodeClick = useCallback((event: MouseEvent, node: FlowNode) => {
    if (mode !== 'edit' || canvasToolMode === 'pan') return;
    if (annotationConnectionSourceId && (node.type === 'person' || node.type === 'annotation')) {
      event.preventDefault();
      if (node.id !== annotationConnectionSourceId) attemptAnnotationLink(annotationConnectionSourceId, node.id);
      return;
    }
    setSelectedAnnotationLink(null);
    if (node.type === 'household') { setSelection([], [], [node.id]); setActivePanel('household'); return; }
    if (node.type === 'annotation') {
      const multi = canvasToolMode === 'multi' || event.metaKey || event.ctrlKey || event.shiftKey;
      const annotations = multi ? (ui.selectedAnnotationIds.includes(node.id) ? ui.selectedAnnotationIds.filter((id) => id !== node.id) : [...ui.selectedAnnotationIds, node.id]) : [node.id];
      setSelection([], [], [], annotations);
      setEditingAnnotationId(null);
      setActivePanel(null);
      return;
    }
    if (node.type !== 'person') return;
    if (relationshipMode) {
      event.preventDefault();
      if (!relationshipSourceId) { setRelationshipSourceId(node.id); setSelection([node.id]); setActivePanel(null); showFeedback('info', 'Select the second person.', 5200); return; }
      if (relationshipTargetId !== node.id) return;
      attemptRelationship(relationshipSourceId, node.id);
      return;
    }
    const multi = canvasToolMode === 'multi' || event.metaKey || event.ctrlKey || event.shiftKey;
    const people = multi ? (ui.selectedPersonIds.includes(node.id) ? ui.selectedPersonIds.filter((id) => id !== node.id) : [...ui.selectedPersonIds, node.id]) : [node.id];
    setSelection(people);
    setActivePanel(people.length === 1 ? 'person' : null);
  }, [annotationConnectionSourceId, attemptAnnotationLink, attemptRelationship, canvasToolMode, mode, relationshipMode, relationshipSourceId, relationshipTargetId, setActivePanel, setSelection, showFeedback, ui.selectedAnnotationIds, ui.selectedPersonIds]);

  const onNodeDoubleClick = useCallback((event: MouseEvent, node: FlowNode) => {
    if (mode !== 'edit' || canvasToolMode === 'pan' || node.type !== 'annotation' || node.data.annotation.kind === 'secret') return;
    event.preventDefault();
    setSelection([], [], [], [node.id]);
    setActivePanel(null);
    setEditingAnnotationId(node.id);
  }, [canvasToolMode, mode, setActivePanel, setSelection]);

  const onEdgeClick = useCallback((event: MouseEvent, edge: FlowEdge) => {
    if (mode !== 'edit' || canvasToolMode === 'pan') return;
    if (edge.data?.kind === 'annotation-link') {
      const sourceId = edge.data.sourceAnnotationId;
      const targetId = edge.data.targetId;
      if (typeof sourceId !== 'string' || typeof targetId !== 'string') return;
      event.preventDefault();
      setSelection([]);
      setSelectedAnnotationLink({ id: edge.id, sourceId, targetId });
      setActivePanel(null);
      return;
    }
    setSelectedAnnotationLink(null);
    const ids = edge.type === 'family' ? (() => {
      const target = event.target instanceof Element ? event.target.closest('[data-family-branch-child-id]') : null;
      const childId = target?.getAttribute('data-family-branch-child-id');
      if (!childId || !edge.data) return [];
      const single = edge.data.singles.find((branch) => branch.childId === childId);
      if (single) return single.relationshipIds;
      const twin = edge.data.twins.find((branch) => branch.first.childId === childId || branch.second.childId === childId);
      if (!twin) return [];
      const branch = twin.first.childId === childId ? twin.first : twin.second;
      return [...branch.relationshipIds, twin.twinRelationshipId];
    })() : [edge.id];
    if (ids.length === 0) return;
    const multi = canvasToolMode === 'multi' || event.metaKey || event.ctrlKey || event.shiftKey;
    const all = ids.every((id) => ui.selectedRelationshipIds.includes(id));
    const next = multi && all ? ui.selectedRelationshipIds.filter((id) => !ids.includes(id)) : multi ? [...new Set([...ui.selectedRelationshipIds, ...ids])] : ids;
    setSelection([], next);
    setActivePanel(null);
  }, [canvasToolMode, mode, setActivePanel, setSelection, ui.selectedRelationshipIds]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
    if (mode !== 'edit' || canvasToolMode === 'pan') return;
    const people = selectedNodes.filter((node) => node.type === 'person').map((node) => node.id);
    const households = selectedNodes.filter((node) => node.type === 'household').map((node) => node.id);
    const annotations = selectedNodes.filter((node) => node.type === 'annotation').map((node) => node.id);
    const relationships = selectedEdges.flatMap((edge) => edge.data?.kind === 'annotation-link' ? [] : edge.type === 'family' ? edge.data?.selectedRelationshipIds ?? [] : [edge.id]);
    setSelectedAnnotationLink(null);
    setSelection(people, relationships, households, annotations);
    setEditingAnnotationId(null);
    setActivePanel(people.length === 1 && relationships.length === 0 && households.length === 0 && annotations.length === 0 ? 'person' : households.length === 1 && people.length === 0 && relationships.length === 0 && annotations.length === 0 ? 'household' : null);
  }, [canvasToolMode, mode, setActivePanel, setSelection]);

  const onNodeDragStart = useCallback<OnNodeDrag<FlowNode>>((_, node, draggedNodes) => {
    if (mode !== 'edit' || canvasToolMode === 'pan' || (node.type !== 'person' && node.type !== 'annotation')) return;
    const people = draggedNodes.filter((item) => item.type === 'person').map((item) => item.id);
    const annotations = draggedNodes.filter((item) => item.type === 'annotation').map((item) => item.id);
    setSelection(people, [], [], annotations);
    setEditingAnnotationId(null);
    setActivePanel(people.length === 1 && annotations.length === 0 ? 'person' : null);
    const ids = [...people, ...annotations];
    beginNodeDrag(ids);
  }, [beginNodeDrag, canvasToolMode, mode, setActivePanel, setSelection]);
  const onNodeDragStop = useCallback<OnNodeDrag<FlowNode>>(() => {
    if (mode !== 'edit') return;
    endNodeDrag();
  }, [endNodeDrag, mode]);

  useEffect(() => {
    if (mode !== 'edit') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        event.preventDefault();
        if (fileMenuOpen) closeFileMenu(true);
        setShowPersonMenu(false);
        setShowLabelMenu(false);
        setRelationshipMode(false);
        setRelationshipSourceId(null);
        setRelationshipTargetId(null);
        setAnnotationConnectionSourceId(null);
        setAnnotationConnectionTargetId(null);
        setSelectedAnnotationLink(null);
        setConnectionCursor(null);
        setSelection([]);
        setActivePanel(null);
        return;
      }
      if (event.defaultPrevented || (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName)))) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier && key === 'v') { event.preventDefault(); activateCanvasTool('select'); return; }
      if (!modifier && key === 'h') { event.preventDefault(); activateCanvasTool('pan'); return; }
      if (!modifier && key === 'm') { event.preventDefault(); activateCanvasTool('multi'); return; }
      if (modifier && key === 'a') {
        event.preventDefault();
        setCanvasToolMode('multi');
        setShowPersonMenu(false);
        setShowLabelMenu(false);
        setRelationshipMode(false);
        setRelationshipSourceId(null);
        setRelationshipTargetId(null);
        setAnnotationConnectionSourceId(null);
        setAnnotationConnectionTargetId(null);
        setSelectedAnnotationLink(null);
        setConnectionCursor(null);
        setSelection(
          project.people.map((person) => person.id),
          project.relationships.map((relationship) => relationship.id),
          project.households.map((household) => household.id),
          project.annotations.map((annotation) => annotation.id),
        );
        setActivePanel(null);
        return;
      }
      if (modifier && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (modifier && key === 'y') { event.preventDefault(); redo(); return; }
      if (modifier && key === 'd' && ui.selectedPersonIds.length) { event.preventDefault(); duplicatePeople(ui.selectedPersonIds); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedAnnotationLink) {
          event.preventDefault();
          deleteAnnotationLink(selectedAnnotationLink.sourceId, selectedAnnotationLink.targetId);
          setSelectedAnnotationLink(null);
          return;
        }
        if (!ui.selectedPersonIds.length && !ui.selectedRelationshipIds.length && !ui.selectedHouseholdIds.length && !ui.selectedAnnotationIds.length) return;
        event.preventDefault();
        deletePeople(ui.selectedPersonIds); deleteRelationships(ui.selectedRelationshipIds); deleteHouseholds(ui.selectedHouseholdIds); deleteAnnotations(ui.selectedAnnotationIds);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activateCanvasTool, closeFileMenu, deleteAnnotationLink, deleteAnnotations, deleteHouseholds, deletePeople, deleteRelationships, duplicatePeople, fileMenuOpen, mode, project.annotations, project.households, project.people, project.relationships, redo, selectedAnnotationLink, setActivePanel, setSelection, ui.selectedAnnotationIds, ui.selectedHouseholdIds, ui.selectedPersonIds, ui.selectedRelationshipIds, undo]);

  const addSelectionBackground = () => {
    const id = addHousehold(ui.selectedPersonIds, 'Background');
    if (id) showFeedback('success', 'Background added.');
    else showFeedback('error', 'Select at least two people first.');
  };

  const deleteSelection = () => {
    if (!selectedItemCount) return;
    deletePeople(ui.selectedPersonIds);
    deleteRelationships(ui.selectedRelationshipIds);
    deleteHouseholds(ui.selectedHouseholdIds);
    deleteAnnotations(ui.selectedAnnotationIds);
    showFeedback('success', `${selectedItemCount} selected ${selectedItemCount === 1 ? 'item' : 'items'} deleted.`);
  };

  return (
    <div className={`${styles.editorShell} ${mode === 'preview' ? styles.previewShell : styles.editShell}`} data-mode={mode} data-testid="genogram-editor">
      {mode === 'edit' && (
        <header className={styles.workspaceHeader} aria-label="Editor header">
          <div className={styles.workspaceFile}>
            <button
              ref={fileTriggerRef}
              className={`${styles.workspaceFileTrigger} ${fileMenuOpen ? styles.workspaceFileTriggerOpen : ''}`}
              type="button"
              aria-label="Open file menu"
              aria-haspopup="menu"
              aria-expanded={fileMenuOpen}
              aria-controls={fileMenuId}
              onClick={() => setFileMenuOpen((open) => !open)}
            >
              <GitBranch size={17} aria-hidden="true" />
            </button>
            {fileMenuOpen && (
              <div ref={fileMenuRef} className={styles.fileMenu} id={fileMenuId} role="menu" aria-label="File actions" aria-describedby={`${fileMenuId}-local-storage-note`}>
                <div className={styles.fileMenuLabel}>FILE</div>
                <p className={styles.fileMenuNotice} id={`${fileMenuId}-local-storage-note`}>
                  Saved as one local project in this browser. Download JSON for backup.
                </p>
                <button className={styles.fileMenuItem} type="button" role="menuitem" onClick={() => { closeFileMenu(); router.push('/'); }}><House size={16} aria-hidden="true" /><span>Back to dashboard</span></button>
                <div className={styles.fileMenuSeparator} role="separator" />
                <button className={styles.fileMenuItem} type="button" role="menuitem" onClick={() => { closeFileMenu(); void startNewProject(); }}><Plus size={16} aria-hidden="true" /><span>New project</span></button>
                <button className={styles.fileMenuItem} type="button" role="menuitem" onClick={() => { closeFileMenu(); projectFileInputRef.current?.click(); }}><FolderOpen size={16} aria-hidden="true" /><span>Import JSON as new project</span></button>
                <button className={styles.fileMenuItem} type="button" role="menuitem" onClick={() => { closeFileMenu(); downloadProjectFile(); }}><Download size={16} aria-hidden="true" /><span>Save local copy</span></button>
                <div className={styles.fileMenuSeparator} role="separator" />
                <button className={styles.fileMenuItem} type="button" role="menuitem" onClick={() => { closeFileMenu(); void exportPng(); }} disabled={exportingPng}><ImageDown size={16} aria-hidden="true" /><span>{exportingPng ? 'Exporting…' : 'Export PNG (no watermark)'}</span></button>
              </div>
            )}
          </div>
          <div className={styles.workspaceTitle}><strong>{project.name}</strong><span>Private local project</span></div>
          <button className={styles.workspaceRename} type="button" onClick={() => { void renameProject(); }} disabled={ui.saveStatus === 'saving'} aria-label={`Rename ${project.name}`} title="Rename"><Pencil size={16} /></button>
          <span className={styles.workspaceSaveStatus} data-save-status={ui.saveStatus} title={ui.saveError ?? undefined} role="status" aria-live="polite">{ui.saveStatus === 'saving' ? 'Saving on this device…' : ui.saveStatus === 'error' ? 'Error' : 'Saved on this device'}</span>
          <button className={`${styles.workspaceToggle} ${showLegend ? styles.workspaceToggleActive : ''}`} type="button" onClick={() => setShowLegend((visible) => !visible)} aria-expanded={showLegend}><BookOpen size={16} aria-hidden="true" />Legend</button>
          <input ref={projectFileInputRef} className={styles.hiddenFileInput} type="file" accept=".json,application/json" onChange={handleProjectFileChange} aria-label="Open project file" />
        </header>
      )}
      {mode === 'edit' && showLegend && <aside className={styles.legendRail} aria-label="Genogram legend area"><Legend project={project} /></aside>}
      <div
        ref={canvasPaneRef}
        className={styles.canvasPane}
        aria-label={mode === 'preview' ? 'Genogram preview canvas' : 'Genogram editing canvas'}
        onPointerMove={(event) => {
          if (!relationshipMode && !annotationConnectionSourceId) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          setConnectionCursor({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
          const { x, y, zoom } = project.canvas.viewport;
          const point = {
            x: (event.clientX - bounds.left - x) / zoom,
            y: (event.clientY - bounds.top - y) / zoom,
          };
          if (annotationConnectionSourceId) {
            const annotationTarget = project.annotations.find((annotation) => {
              if (annotation.id === annotationConnectionSourceId) return false;
              const position = project.canvas.positions[annotation.id];
              if (!position) return false;
              const size = annotationCanvasSize(annotation);
              return point.x >= position.x && point.x <= position.x + size.width && point.y >= position.y && point.y <= position.y + size.height;
            });
            const personTarget = project.people.find((person) => {
              const position = project.canvas.positions[person.id];
              return Boolean(position && pointHitsPersonSymbol(person, position, point));
            });
            setAnnotationConnectionTargetId(annotationTarget?.id ?? personTarget?.id ?? null);
            return;
          }
          if (!relationshipMode || !relationshipSourceId) return;
          const target = project.people.find((person) => {
            if (person.id === relationshipSourceId) return false;
            const position = project.canvas.positions[person.id];
            return Boolean(position && pointHitsPersonSymbol(person, position, point));
          });
          setRelationshipTargetId(target?.id ?? null);
        }}
        onPointerLeave={() => { if (connectionModeActive) { setConnectionCursor(null); setRelationshipTargetId(null); setAnnotationConnectionTargetId(null); } }}
      >
        <CanvasViewContext.Provider value={canvasViewContext}><PersonLabelContext.Provider value={personLabelContext}><AnnotationActionContext.Provider value={annotationActionContext}><AnnotationLinkActionContext.Provider value={annotationLinkActionContext}><PersonActionContext.Provider value={personActionContext}><ReactFlowProvider><ReactFlow<FlowNode, FlowEdge>
          className={`${styles.reactFlow} ${mode === 'preview' ? styles.previewFlow : ''} ${mode === 'edit' && canvasToolMode === 'pan' ? styles.panTool : ''} ${mode === 'edit' && canvasToolMode === 'multi' ? styles.multiTool : ''}`}
          nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={(connection: Connection) => attemptRelationship(connection.source, connection.target)}
          onNodeClick={mode === 'edit' ? onNodeClick : undefined} onNodeDoubleClick={mode === 'edit' ? onNodeDoubleClick : undefined} onEdgeClick={mode === 'edit' ? onEdgeClick : undefined} onSelectionChange={mode === 'edit' && canvasToolMode === 'multi' ? onSelectionChange : undefined}
          onNodeDragStart={mode === 'edit' ? onNodeDragStart : undefined} onNodeDragStop={mode === 'edit' ? onNodeDragStop : undefined}
          onMoveEnd={(_: unknown, viewport: FlowViewport) => { if (mode === 'edit') setViewport(viewport); }}
          onPaneClick={() => { if (mode === 'edit' && canvasToolMode !== 'pan') { setRelationshipSourceId(null); setRelationshipTargetId(null); setAnnotationConnectionSourceId(null); setAnnotationConnectionTargetId(null); setSelectedAnnotationLink(null); setConnectionCursor(null); setRelationshipMode(false); setEditingAnnotationId(null); setSelection([]); setActivePanel(null); } }}
          selectionOnDrag={mode === 'edit' && canvasToolMode === 'multi' && !connectionModeActive} selectionMode={SelectionMode.Partial} selectNodesOnDrag={mode === 'edit' && canvasToolMode === 'multi' && !connectionModeActive}
          nodesDraggable={mode === 'edit' && canvasToolMode !== 'pan' && !connectionModeActive} nodesConnectable elementsSelectable={mode === 'edit' && canvasToolMode !== 'pan' && !connectionModeActive} panOnDrag={mode === 'edit' ? (canvasToolMode === 'pan' ? [0, 1] : [1]) : false}
          panActivationKeyCode="Space" zoomOnScroll zoomOnPinch zoomOnDoubleClick deleteKeyCode={null} snapToGrid={mode === 'edit'} snapGrid={CANVAS_SNAP_GRID} defaultViewport={project.canvas.viewport} minZoom={0.35} maxZoom={2.2} aria-label={mode === 'preview' ? 'Read-only genogram preview' : 'Genogram canvas'}
        >
          <Background gap={22} size={1.2} color="#cad8d4" />
          {mode === 'edit' && <Controls showInteractive={false} />}
          <Panel className={styles.canvasHint} position={mode === 'preview' ? 'top-left' : 'top-center'}>{mode === 'preview' ? 'Starter canvas · click to begin' : 'Middle-drag or hold Space to pan · V select · H hand · M multi-select'}</Panel>
        </ReactFlow></ReactFlowProvider></PersonActionContext.Provider></AnnotationLinkActionContext.Provider></AnnotationActionContext.Provider></PersonLabelContext.Provider></CanvasViewContext.Provider>
        {mode === 'edit' && activeConnectionSourcePoint && connectionEndPoint && (
          <svg className={`${styles.connectionPreview} ${annotationConnectionSourceId ? styles.annotationConnectionPreview : ''}`} aria-hidden="true">
            <line x1={activeConnectionSourcePoint.x} y1={activeConnectionSourcePoint.y} x2={connectionEndPoint.x} y2={connectionEndPoint.y} />
            <circle cx={connectionEndPoint.x} cy={connectionEndPoint.y} r="5" />
          </svg>
        )}
      </div>
      {mode === 'preview' && <aside className={styles.previewLegendRail} aria-label="Preview legend area"><Legend project={project} /><p className={styles.previewLegendNote}>Your new canvas starts here. Open it to rename people, add family members, and build the map.</p></aside>}
      {mode === 'edit' && showInspector && <CanvasViewContext.Provider value={canvasViewContext}><aside className={styles.inspector} aria-label="Edit panel">{selectedAnnotationLink ? <AnnotationLinkInspector sourceId={selectedAnnotationLink.sourceId} targetId={selectedAnnotationLink.targetId} onClose={() => setSelectedAnnotationLink(null)} /> : ui.activePanel === 'person' ? <PersonInspector person={selectedPerson} /> : ui.activePanel === 'household' ? <HouseholdInspector household={selectedHousehold} project={project} /> : selectedRelationship ? <RelationshipInspector relationship={selectedRelationship} /> : null}</aside></CanvasViewContext.Provider>}
      {mode === 'edit' && !connectionModeActive && !ui.dragSnapshot && selectedAnnotation && ui.selectedAnnotationIds.length === 1 && annotationEditorPosition && <div className={styles.annotationEditorAnchor} style={annotationEditorPosition}><AnnotationFloatingEditor annotation={selectedAnnotation} /></div>}
      {mode === 'edit' && !relationshipMode && !ui.dragSnapshot && selectedSymbolCount > 1 && <div
        className={`${styles.selectionActionBar} ${selectionActionPosition ? styles.selectionActionBarAnchored : ''}`}
        style={selectionActionPosition ?? undefined}
        role="toolbar"
        aria-label="Selected items actions"
      >
        <span className={styles.selectionCount}>{selectedSymbolCount} selected</span>
        <span className={styles.selectionActionDivider} aria-hidden="true" />
        <button type="button" onClick={addSelectionBackground} disabled={ui.selectedPersonIds.length < 2} title="Add a background around the selected people"><Group size={16} aria-hidden="true" />Add background</button>
        <button className={styles.selectionDeleteButton} type="button" onClick={deleteSelection}><Trash2 size={16} aria-hidden="true" />Delete</button>
      </div>}
      {mode === 'edit' && feedback && <p className={`${styles.canvasFeedback} ${styles[`connectionStatus${feedback.tone[0].toUpperCase()}${feedback.tone.slice(1)}`]}`} role="status" aria-live="polite">{feedback.message}</p>}
      {mode === 'edit' && <div className={styles.toolBar} role="toolbar" aria-label="Canvas tools">
        <div className={styles.canvasModeTools}>
          <button className={`${styles.canvasToolButton} ${canvasToolMode === 'select' ? styles.canvasToolButtonActive : ''}`} type="button" data-tooltip="Select and move an item · V" aria-label="Selection mode" aria-pressed={canvasToolMode === 'select'} onClick={() => activateCanvasTool('select')}><MousePointer2 size={19} aria-hidden="true" /></button>
          <button className={`${styles.canvasToolButton} ${canvasToolMode === 'pan' ? styles.canvasToolButtonActive : ''}`} type="button" data-tooltip="Pan the canvas · H" aria-label="Pan mode" aria-pressed={canvasToolMode === 'pan'} onClick={() => activateCanvasTool('pan')}><Hand size={19} aria-hidden="true" /></button>
          <button className={`${styles.canvasToolButton} ${canvasToolMode === 'multi' ? styles.canvasToolButtonActive : ''}`} type="button" data-tooltip="Select multiple items · M" aria-label="Multi-select mode" aria-pressed={canvasToolMode === 'multi'} onClick={() => activateCanvasTool('multi')}><BoxSelect size={19} aria-hidden="true" /></button>
        </div>
        <span className={styles.toolbarDivider} aria-hidden="true" />
        <div className={styles.viewTool} ref={viewToolRef}>
          <button
            className={`${styles.canvasToolButton} ${styles.viewToolButton} ${showViewMenu ? styles.canvasToolButtonActive : ''}`}
            type="button"
            data-tooltip="Views"
            aria-label="Views"
            aria-haspopup="dialog"
            aria-expanded={showViewMenu}
            onClick={() => { setShowPersonMenu(false); setShowLabelMenu(false); setShowViewMenu((visible) => !visible); }}
          ><Layers size={19} aria-hidden="true" /><span className={styles.viewToolCount}>{canvasViewOptions.filter((option) => canvasViewContext.visibility[option.key]).length}</span></button>
          {showViewMenu && <div className={styles.viewMenu} role="dialog" aria-label="Views">
            <p className={styles.viewMenuHeading}>Views</p>
            <div className={styles.viewMenuList}>
              {canvasViewOptions.map((option) => {
                const Icon = option.icon;
                return <label className={styles.viewVisibilityOption} key={option.key}>
                  <input type="checkbox" checked={canvasViewContext.visibility[option.key]} onChange={(event) => setCanvasViewVisibility(option.key, event.target.checked)} />
                  <Icon size={14} aria-hidden="true" />
                  <span>{option.label}</span>
                </label>;
              })}
            </div>
          </div>}
        </div>
        <div className={styles.labelTool} ref={labelToolRef}>
          <button
            className={`${styles.canvasToolButton} ${showLabelMenu ? styles.canvasToolButtonActive : ''}`}
            type="button"
            data-tooltip="Display labels"
            aria-label="Display labels"
            aria-haspopup="dialog"
            aria-expanded={showLabelMenu}
            onClick={() => { setShowPersonMenu(false); setShowViewMenu(false); setShowLabelMenu((visible) => !visible); }}
          ><Tags size={19} aria-hidden="true" /></button>
          {showLabelMenu && <div className={styles.labelMenu} role="dialog" aria-label="Display labels">
            <p className={styles.labelMenuHeading}>Display labels</p>
            <div className={styles.labelMenuGrid}>
              {personLabelOptions.map((option) => <label className={styles.labelVisibilityOption} key={option.key}>
                <input type="checkbox" checked={personLabelContext.visibility[option.key]} onChange={(event) => setPersonLabelVisibility(option.key, event.target.checked)} />
                <span>{option.label}</span>
              </label>)}
            </div>
            <label className={styles.labelWrapOption}>
              <input type="checkbox" checked={personLabelContext.wrapLongText} onChange={(event) => setWrapPersonLabels(event.target.checked)} />
              <span>Wrap long text</span>
            </label>
          </div>}
        </div>
        <span className={styles.toolbarDivider} aria-hidden="true" />
        <div className={styles.addPersonTool}>
          <button className={`${styles.canvasToolButton} ${showPersonMenu ? styles.canvasToolButtonActive : ''}`} type="button" data-tooltip="Add a person" aria-label="Add person" aria-expanded={showPersonMenu} onClick={() => { setShowLabelMenu(false); setShowViewMenu(false); setShowPersonMenu((visible) => !visible); }}><UserPlus size={19} aria-hidden="true" /><ChevronDown className={styles.toolChevron} size={11} aria-hidden="true" /></button>
          {showPersonMenu && <div className={styles.personMenu} aria-label="Choose person symbol">
            <p className={styles.personMenuHeading}>Gender symbols</p>
            {addPersonGenders.map((gender) => <button type="button" key={gender} onClick={() => addPersonFromToolbar({ gender })}><ToolSymbol gender={gender} /><span>{genderLabels[gender]}</span></button>)}
          </div>}
        </div>
        <button className={styles.canvasToolButton} type="button" data-tooltip="Add a note" aria-label="Add note" onClick={() => addAnnotationFromToolbar('note')}><StickyNote size={19} aria-hidden="true" /></button>
        <button className={styles.canvasToolButton} type="button" data-tooltip="Add a connectable family secret" aria-label="Add secret" onClick={() => addAnnotationFromToolbar('secret')}><Triangle size={19} aria-hidden="true" /></button>
        <button className={styles.canvasToolButton} type="button" data-tooltip="Add text" aria-label="Add text" onClick={() => addAnnotationFromToolbar('text')}><Type size={19} aria-hidden="true" /></button>
      </div>}
    </div>
  );
}

export default function GenogramEditor({ mode = 'edit', initialProject, projectId = null }: GenogramEditorProps) {
  return mode === 'edit'
    ? <EditProjectLifecycle projectId={projectId} />
    : <GenogramCanvas mode={mode} initialProject={initialProject} />;
}
