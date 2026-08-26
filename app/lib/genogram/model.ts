export const CURRENT_SCHEMA_VERSION = 3 as const;

export const GENDERS = [
  'male', 'female', 'trans-male', 'trans-female',
  'nonbinary', 'intersex', 'unspecified', 'other',
] as const;
export type Gender = (typeof GENDERS)[number];

export const SYMBOL_KINDS = ['person', 'pregnancy', 'miscarriage', 'termination', 'stillbirth'] as const;
export type SymbolKind = (typeof SYMBOL_KINDS)[number];

export const PERSON_DISPLAY_SIZES = ['small', 'medium', 'large'] as const;
export type PersonDisplaySize = (typeof PERSON_DISPLAY_SIZES)[number];

export const PERSON_LABEL_KEYS = [
  'name', 'birthYear', 'age', 'gender', 'orientation', 'heritage', 'religion', 'socialClass',
  'occupation', 'school', 'education', 'location', 'birthPlace', 'medical', 'custom', 'notes',
] as const;
export type PersonLabelKey = (typeof PERSON_LABEL_KEYS)[number];
export type PersonLabelVisibility = Record<PersonLabelKey, boolean>;

export const CANVAS_VIEW_KEYS = [
  'cultural', 'medical', 'social', 'religion', 'education', 'location', 'custom', 'backgrounds',
] as const;
export type CanvasViewKey = (typeof CANVAS_VIEW_KEYS)[number];
export type CanvasViewVisibility = Record<CanvasViewKey, boolean>;

export const CULTURAL_HERITAGE_PATTERNS = ['horizontal', 'vertical', 'diagonal-right', 'diagonal-left', 'grid', 'dots', 'waves', 'woven', 'checker'] as const;
export type CulturalHeritagePattern = (typeof CULTURAL_HERITAGE_PATTERNS)[number];

export interface CulturalHeritageLayer {
  id: string;
  pattern: CulturalHeritagePattern;
  label: string;
}

export const SYMBOL_KIND_LABELS: Record<SymbolKind, string> = {
  person: 'Person',
  pregnancy: 'Pregnancy',
  miscarriage: 'Miscarriage',
  termination: 'Termination',
  stillbirth: 'Stillbirth',
};

export const MEDICAL_CONDITION_PRESETS = [
  { label: 'Cardiovascular', color: '#dc2626' },
  { label: 'Cancer', color: '#9333ea' },
  { label: 'Diabetes', color: '#16a34a' },
  { label: 'Mental health', color: '#2563eb' },
  { label: 'Substance use', color: '#f97316' },
  { label: 'Neurological', color: '#06b6d4' },
  { label: 'Respiratory', color: '#84cc16' },
  { label: 'Autoimmune', color: '#ec4899' },
  { label: 'Genetic', color: '#8b5cf6' },
  { label: 'Reproductive', color: '#f59e0b' },
  { label: 'Anxiety', color: '#14b8a6' },
  { label: 'Bipolar', color: '#0ea5e9' },
  { label: 'Depression', color: '#6366f1' },
  { label: 'PTSD', color: '#a855f7' },
  { label: 'Other', color: '#64748b' },
  { label: 'OCD', color: '#d946ef' },
  { label: 'ADHD', color: '#fb923c' },
  { label: 'Eating disorder', color: '#e11d48' },
  { label: 'Schizophrenia', color: '#7c3aed' },
  { label: 'Trauma', color: '#b91c1c' },
  { label: 'Learning disability', color: '#0d9488' },
] as const;
export const MEDICAL_MARKER_COLORS = [
  '#3f766d', '#9a5d55', '#66728c', '#9a753f',
  ...MEDICAL_CONDITION_PRESETS.map((preset) => preset.color),
] as const;
export type MedicalMarkerColor = (typeof MEDICAL_MARKER_COLORS)[number];
export const MEDICAL_MARKER_QUADRANTS = [0, 1, 2, 3] as const;
export type MedicalMarkerQuadrant = (typeof MEDICAL_MARKER_QUADRANTS)[number];
export const MEDICAL_MARKER_STATUSES = ['active', 'recovery', 'suspected'] as const;
export type MedicalMarkerStatus = (typeof MEDICAL_MARKER_STATUSES)[number];

export interface MedicalMarker {
  id: string;
  label: string;
  color: MedicalMarkerColor;
  quadrant: MedicalMarkerQuadrant;
  status?: MedicalMarkerStatus;
}

export interface PersonProfile {
  givenName: string;
  middleName: string;
  familyName: string;
  birthName: string;
  title: string;
  suffix: string;
  nickname: string;
  alternativeName: string;
  sexualOrientation: string;
  birthDate: string;
  birthMonth: string;
  birthDay: string;
  birthPlace: string;
  deathDate: string;
  deathMonth: string;
  deathDay: string;
  deathPlace: string;
  occupation: string;
  occupationStartYear: string;
  occupationEndYear: string;
  organization: string;
  attributes: string;
  culturalHeritage: string;
  religion: string;
  socialClass: string;
  education: string;
  school: string;
  country: string;
  countryCode: string;
  city: string;
  state: string;
  location: string;
}

export interface PersonVisualSettings {
  color: string;
  showColor: boolean;
  showMedical: boolean;
  showCulturalHeritage: boolean;
  showReligion: boolean;
  showSocialClass: boolean;
  showEducation: boolean;
  showLocation: boolean;
  size: PersonDisplaySize;
  hidden: boolean;
}

export function createEmptyPersonProfile(): PersonProfile {
  return {
    givenName: '',
    middleName: '',
    familyName: '',
    birthName: '',
    title: '',
    suffix: '',
    nickname: '',
    alternativeName: '',
    sexualOrientation: '',
    birthDate: '',
    birthMonth: '',
    birthDay: '',
    birthPlace: '',
    deathDate: '',
    deathMonth: '',
    deathDay: '',
    deathPlace: '',
    occupation: '',
    occupationStartYear: '',
    occupationEndYear: '',
    organization: '',
    attributes: '',
    culturalHeritage: '',
    religion: '',
    socialClass: '',
    education: '',
    school: '',
    country: '',
    countryCode: '',
    city: '',
    state: '',
    location: '',
  };
}

export function createDefaultPersonVisualSettings(): PersonVisualSettings {
  return {
    color: '#fbfdfa',
    showColor: true,
    showMedical: true,
    showCulturalHeritage: true,
    showReligion: true,
    showSocialClass: true,
    showEducation: true,
    showLocation: true,
    size: 'medium',
    hidden: false,
  };
}

export function createDefaultPersonLabelVisibility(): PersonLabelVisibility {
  return Object.fromEntries(PERSON_LABEL_KEYS.map((key) => [key, true])) as PersonLabelVisibility;
}

export function createDefaultCanvasViewVisibility(): CanvasViewVisibility {
  return Object.fromEntries(CANVAS_VIEW_KEYS.map((key) => [key, true])) as CanvasViewVisibility;
}

export const PARTNER_RELATIONSHIP_TYPES = [
  'dating', 'cohabitation', 'engagement', 'marriage', 'life-partner', 'unknown-partner',
  'actual-separation', 'separation', 'divorce', 'annulment', 'widowed',
  'affair', 'affair-separation', 'affair-divorce', 'affair-married', 'one-night-stand', 'rape',
] as const;
export const CHILD_RELATIONSHIP_TYPES = [
  'biological-child', 'adopted-child', 'foster-child', 'step-child',
  'surrogate-child', 'sperm-donor-child', 'egg-donor-child',
] as const;
export const TWIN_RELATIONSHIP_TYPES = ['fraternal-twins', 'identical-twins'] as const;
export const EMOTIONAL_RELATIONSHIP_TYPES = [
  'connection', 'close', 'fused', 'distant', 'hostile', 'close-hostile',
  'emotional-abuse', 'physical-abuse', 'sexual-abuse', 'focused', 'negative-focused', 'caregiver',
  'cutoff', 'repaired-cutoff', 'indifferent', 'never-met', 'harmonious', 'friendship', 'love',
  'romantic-love', 'attachment', 'infatuation', 'conflict', 'hatred', 'distrust', 'distant-hostile',
  'fused-conflict', 'violence', 'distant-violence', 'close-violence', 'fused-violence', 'abuse',
  'physical-neglect', 'emotional-neglect', 'manipulation', 'control', 'jealousy', 'admirer',
] as const;
export const RELATIONSHIP_TYPES = [
  ...PARTNER_RELATIONSHIP_TYPES,
  ...CHILD_RELATIONSHIP_TYPES,
  ...TWIN_RELATIONSHIP_TYPES,
  'sibling',
  ...EMOTIONAL_RELATIONSHIP_TYPES,
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
export type RelationshipCategory = 'partner' | 'child' | 'emotional';

export type RelationshipLineKind =
  | 'single' | 'long-dashed' | 'dotted' | 'separation' | 'divorce'
  | 'separation-dashed' | 'annulment' | 'widowed' | 'affair-separation'
  | 'affair-divorce' | 'affair-married' | 'sparse-dotted' | 'unknown'
  | 'double' | 'triple' | 'dashed' | 'zigzag' | 'fused-conflict'
  | 'cutoff' | 'focused' | 'abuse'
  | 'child-solid' | 'child-dashed' | 'child-dotted' | 'child-step' | 'child-surrogate' | 'child-donor'
  | 'twin-fraternal' | 'twin-identical' | 'sibling';

export interface RelationshipTypeDefinition {
  label: string;
  category: RelationshipCategory;
  directed: boolean;
  lineKind: RelationshipLineKind;
  color?: string;
}

export const RELATIONSHIP_CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  partner: 'Partner',
  child: 'Children',
  emotional: 'Emotional',
};

export const RELATIONSHIP_DEFINITIONS: Record<RelationshipType, RelationshipTypeDefinition> = {
  dating: { label: 'Dating', category: 'partner', directed: false, lineKind: 'dashed' },
  marriage: { label: 'Marriage', category: 'partner', directed: false, lineKind: 'single' },
  engagement: { label: 'Engagement', category: 'partner', directed: false, lineKind: 'long-dashed' },
  cohabitation: { label: 'Cohabitation / partnership', category: 'partner', directed: false, lineKind: 'long-dashed' },
  'life-partner': { label: 'Life partner', category: 'partner', directed: false, lineKind: 'single' },
  'unknown-partner': { label: 'Unknown', category: 'partner', directed: false, lineKind: 'unknown' },
  'actual-separation': { label: 'Actual separation', category: 'partner', directed: false, lineKind: 'separation-dashed' },
  separation: { label: 'Legal separation', category: 'partner', directed: false, lineKind: 'separation' },
  divorce: { label: 'Divorce', category: 'partner', directed: false, lineKind: 'divorce' },
  annulment: { label: 'Annulment', category: 'partner', directed: false, lineKind: 'annulment' },
  widowed: { label: 'Widowed', category: 'partner', directed: false, lineKind: 'widowed' },
  affair: { label: 'Affair', category: 'partner', directed: false, lineKind: 'dotted' },
  'affair-separation': { label: 'Affair / separation', category: 'partner', directed: false, lineKind: 'affair-separation' },
  'affair-divorce': { label: 'Affair / divorce', category: 'partner', directed: false, lineKind: 'affair-divorce' },
  'affair-married': { label: 'Affair / married', category: 'partner', directed: false, lineKind: 'affair-married' },
  'one-night-stand': { label: 'One-night stand', category: 'partner', directed: false, lineKind: 'sparse-dotted' },
  rape: { label: 'Rape', category: 'partner', directed: false, lineKind: 'widowed' },
  'biological-child': { label: 'Biological child', category: 'child', directed: true, lineKind: 'child-solid' },
  'adopted-child': { label: 'Adopted child', category: 'child', directed: true, lineKind: 'child-dashed' },
  'foster-child': { label: 'Foster child', category: 'child', directed: true, lineKind: 'child-dotted' },
  'step-child': { label: 'Step child', category: 'child', directed: true, lineKind: 'child-step' },
  'surrogate-child': { label: 'Surrogate', category: 'child', directed: true, lineKind: 'child-surrogate' },
  'sperm-donor-child': { label: 'Sperm donor', category: 'child', directed: true, lineKind: 'child-donor' },
  'egg-donor-child': { label: 'Egg donor', category: 'child', directed: true, lineKind: 'child-donor' },
  'fraternal-twins': { label: 'Fraternal twins', category: 'child', directed: false, lineKind: 'twin-fraternal' },
  'identical-twins': { label: 'Identical twins', category: 'child', directed: false, lineKind: 'twin-identical' },
  sibling: { label: 'Sibling', category: 'child', directed: false, lineKind: 'sibling' },
  connection: { label: 'Connected', category: 'emotional', directed: false, lineKind: 'single', color: '#2563eb' },
  close: { label: 'Close', category: 'emotional', directed: false, lineKind: 'double', color: '#2563eb' },
  fused: { label: 'Fused', category: 'emotional', directed: false, lineKind: 'triple', color: '#dc2626' },
  distant: { label: 'Distant', category: 'emotional', directed: false, lineKind: 'dashed', color: '#dc2626' },
  hostile: { label: 'Hostile', category: 'emotional', directed: false, lineKind: 'zigzag', color: '#dc2626' },
  'close-hostile': { label: 'Close & hostile', category: 'emotional', directed: false, lineKind: 'fused-conflict', color: '#dc2626' },
  'emotional-abuse': { label: 'Emotional abuse', category: 'emotional', directed: true, lineKind: 'abuse', color: '#dc2626' },
  'physical-abuse': { label: 'Physical abuse', category: 'emotional', directed: true, lineKind: 'abuse', color: '#dc2626' },
  'sexual-abuse': { label: 'Sexual abuse', category: 'emotional', directed: true, lineKind: 'abuse', color: '#dc2626' },
  focused: { label: 'Focused on', category: 'emotional', directed: true, lineKind: 'focused', color: '#dc2626' },
  'negative-focused': { label: 'Focused on negatively', category: 'emotional', directed: true, lineKind: 'abuse', color: '#dc2626' },
  caregiver: { label: 'Caretaker', category: 'emotional', directed: true, lineKind: 'focused', color: '#dc2626' },
  cutoff: { label: 'Cutoff', category: 'emotional', directed: false, lineKind: 'cutoff', color: '#dc2626' },
  'repaired-cutoff': { label: 'Cutoff repaired', category: 'emotional', directed: false, lineKind: 'single', color: '#2563eb' },
  indifferent: { label: 'Indifferent', category: 'emotional', directed: false, lineKind: 'dotted', color: '#9ca3af' },
  'never-met': { label: 'Never met', category: 'emotional', directed: false, lineKind: 'dotted', color: '#9ca3af' },
  harmonious: { label: 'Harmony', category: 'emotional', directed: false, lineKind: 'single', color: '#16a34a' },
  friendship: { label: 'Friendship', category: 'emotional', directed: false, lineKind: 'double', color: '#16a34a' },
  love: { label: 'Love', category: 'emotional', directed: false, lineKind: 'single', color: '#16a34a' },
  'romantic-love': { label: 'In love', category: 'emotional', directed: false, lineKind: 'double', color: '#16a34a' },
  attachment: { label: 'Attachment', category: 'emotional', directed: false, lineKind: 'double', color: '#16a34a' },
  infatuation: { label: 'Limerence', category: 'emotional', directed: true, lineKind: 'focused', color: '#64748b' },
  conflict: { label: 'Conflict', category: 'emotional', directed: false, lineKind: 'zigzag', color: '#dc2626' },
  hatred: { label: 'Hate', category: 'emotional', directed: false, lineKind: 'zigzag', color: '#dc2626' },
  distrust: { label: 'Distrust', category: 'emotional', directed: false, lineKind: 'dashed', color: '#0f172a' },
  'distant-hostile': { label: 'Distant & hostile', category: 'emotional', directed: false, lineKind: 'fused-conflict', color: '#dc2626' },
  'fused-conflict': { label: 'Fused & hostile', category: 'emotional', directed: false, lineKind: 'fused-conflict', color: '#dc2626' },
  violence: { label: 'Violence', category: 'emotional', directed: false, lineKind: 'zigzag', color: '#b91c1c' },
  'distant-violence': { label: 'Distant & violence', category: 'emotional', directed: false, lineKind: 'fused-conflict', color: '#b91c1c' },
  'close-violence': { label: 'Close & violence', category: 'emotional', directed: false, lineKind: 'fused-conflict', color: '#b91c1c' },
  'fused-violence': { label: 'Fused & violence', category: 'emotional', directed: false, lineKind: 'fused-conflict', color: '#b91c1c' },
  abuse: { label: 'Abuse', category: 'emotional', directed: true, lineKind: 'abuse', color: '#111827' },
  'physical-neglect': { label: 'Physical neglect', category: 'emotional', directed: true, lineKind: 'focused', color: '#2563eb' },
  'emotional-neglect': { label: 'Emotional neglect', category: 'emotional', directed: true, lineKind: 'focused', color: '#2563eb' },
  manipulation: { label: 'Manipulative', category: 'emotional', directed: true, lineKind: 'abuse', color: '#dc2626' },
  control: { label: 'Control', category: 'emotional', directed: true, lineKind: 'abuse', color: '#dc2626' },
  jealousy: { label: 'Jealousy', category: 'emotional', directed: true, lineKind: 'focused', color: '#dc2626' },
  admirer: { label: 'Fan / admirer', category: 'emotional', directed: true, lineKind: 'focused', color: '#64748b' },
};

export function getRelationshipDefinition(type: RelationshipType): RelationshipTypeDefinition {
  return RELATIONSHIP_DEFINITIONS[type];
}

export function isPartnerRelationship(type: RelationshipType): boolean {
  return (PARTNER_RELATIONSHIP_TYPES as readonly string[]).includes(type);
}

export function isChildRelationship(type: RelationshipType): boolean {
  return (CHILD_RELATIONSHIP_TYPES as readonly string[]).includes(type);
}

export function isTwinRelationship(type: RelationshipType): boolean {
  return (TWIN_RELATIONSHIP_TYPES as readonly string[]).includes(type);
}

export function relationshipUsesDirection(type: RelationshipType): boolean {
  return RELATIONSHIP_DEFINITIONS[type].directed;
}

export function relationshipEndpointsMatch(
  type: RelationshipType,
  source: string,
  target: string,
  otherSource: string,
  otherTarget: string,
): boolean {
  if (relationshipUsesDirection(type)) return source === otherSource && target === otherTarget;
  return (source === otherSource && target === otherTarget) || (source === otherTarget && target === otherSource);
}

export type Position = { x: number; y: number };
export type Viewport = { x: number; y: number; zoom: number };
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  birthYear: number | null;
  deathYear: number | null;
  notes: string;
  deceased: boolean;
  symbolKind: SymbolKind;
  isIndexPerson: boolean;
  explicitlyChildless?: boolean;
  medicalMarkers: MedicalMarker[];
  culturalHeritageLayers?: CulturalHeritageLayer[];
  profile?: PersonProfile;
  visualSettings?: PersonVisualSettings;
}

export interface Relationship {
  id: string;
  type: RelationshipType;
  source: string;
  target: string;
  attributes: { [key: string]: JsonValue };
}

export interface Household {
  id: string;
  label: string;
  memberIds: string[];
}

export const CANVAS_ANNOTATION_KINDS = ['note', 'secret', 'text'] as const;
export type CanvasAnnotationKind = (typeof CANVAS_ANNOTATION_KINDS)[number];

export interface AnnotationLinkAttributes {
  label?: string;
  color?: string;
  hidden?: boolean;
}

export interface CanvasAnnotation {
  id: string;
  kind: CanvasAnnotationKind;
  text: string;
  notes?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  width?: number;
  height?: number;
  linkedIds?: string[];
  linkAttributes?: Record<string, AnnotationLinkAttributes>;
  hidden?: boolean;
}

export interface Canvas {
  positions: Record<string, Position>;
  viewport: Viewport;
  personLabelVisibility?: Partial<PersonLabelVisibility>;
  wrapPersonLabels?: boolean;
  viewVisibility?: Partial<CanvasViewVisibility>;
}

export interface Project {
  id: string;
  name: string;
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  people: Person[];
  relationships: Relationship[];
  households: Household[];
  annotations: CanvasAnnotation[];
  canvas: Canvas;
}

export type ProjectSnapshot = Pick<Project, 'people' | 'relationships' | 'households' | 'annotations' | 'canvas'>;

export class ProjectValidationError extends Error {
  readonly code = 'INVALID_PROJECT';
  constructor(message: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

export function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyProject(name = 'Untitled Genogram'): Project {
  const now = new Date().toISOString();
  return {
    id: createId('project'),
    name,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    people: [],
    relationships: [],
    households: [],
    annotations: [],
    canvas: { positions: {}, viewport: { x: 0, y: 0, zoom: 1 } },
  };
}

export function createPerson(
  id: string,
  name: string,
  gender: Gender,
  overrides: Partial<Omit<Person, 'id' | 'name' | 'gender'>> = {},
): Person {
  return {
    id,
    name,
    gender,
    birthYear: null,
    deathYear: null,
    notes: '',
    deceased: false,
    symbolKind: 'person',
    isIndexPerson: false,
    medicalMarkers: [],
    culturalHeritageLayers: [],
    profile: createEmptyPersonProfile(),
    visualSettings: createDefaultPersonVisualSettings(),
    ...overrides,
  };
}

export function createStarterProject(): Project {
  const project = createEmptyProject();
  const alex = createPerson('person-alex', 'Alex', 'male', { birthYear: 1988, isIndexPerson: true });
  const jordan = createPerson('person-jordan', 'Jordan', 'female', { birthYear: 1990 });
  const sam = createPerson('person-sam', 'Sam', 'male', { birthYear: 2016 });
  project.people = [alex, jordan, sam];
  project.relationships = [
    { id: 'relationship-couple', type: 'marriage', source: alex.id, target: jordan.id, attributes: {} },
    { id: 'relationship-alex-sam', type: 'biological-child', source: alex.id, target: sam.id, attributes: {} },
    { id: 'relationship-jordan-sam', type: 'biological-child', source: jordan.id, target: sam.id, attributes: {} },
  ];
  project.canvas.positions = {
    [alex.id]: { x: 240, y: 130 },
    [jordan.id]: { x: 470, y: 130 },
    [sam.id]: { x: 355, y: 390 },
  };
  return project;
}

export function createPreviewProject(): Project {
  const project = createEmptyProject('Genogram notation example');
  const robert = createPerson('preview-robert', 'Robert', 'male', { birthYear: 1940, deathYear: 2020, deceased: true, medicalMarkers: [{ id: 'marker-heart', label: 'Cardiac history', color: '#9a5d55', quadrant: 2 }] });
  const helen = createPerson('preview-helen', 'Helen', 'female', { birthYear: 1944 });
  const david = createPerson('preview-david', 'David', 'male', {
    birthYear: 1970,
    isIndexPerson: true,
    medicalMarkers: [
      { id: 'marker-sleep', label: 'Sleep', color: '#3f766d', quadrant: 0 },
      { id: 'marker-mood', label: 'Mood', color: '#9a5d55', quadrant: 1 },
      { id: 'marker-history', label: 'Family history', color: '#66728c', quadrant: 2 },
      { id: 'marker-medication', label: 'Medication', color: '#9a753f', quadrant: 3 },
    ],
  });
  const sarah = createPerson('preview-sarah', 'Sarah', 'female', { birthYear: 1972 });
  const liam = createPerson('preview-liam', 'Liam', 'male', { birthYear: 2001 });
  const mia = createPerson('preview-mia', 'Mia', 'female', { birthYear: 2004 });
  const ava = createPerson('preview-ava', 'Ava', 'female', { birthYear: 2004 });
  const pregnancy = createPerson('preview-pregnancy', 'Pregnancy', 'unspecified', { symbolKind: 'pregnancy' });
  project.people = [robert, helen, david, sarah, liam, mia, ava, pregnancy];
  project.relationships = [
    { id: 'rel-rh', type: 'marriage', source: robert.id, target: helen.id, attributes: { label: 'm. 1966' } },
    { id: 'rel-rd', type: 'biological-child', source: robert.id, target: david.id, attributes: {} },
    { id: 'rel-hd', type: 'biological-child', source: helen.id, target: david.id, attributes: {} },
    { id: 'rel-ds', type: 'marriage', source: david.id, target: sarah.id, attributes: { label: 'm. 1998' } },
    { id: 'rel-dl', type: 'biological-child', source: david.id, target: liam.id, attributes: {} },
    { id: 'rel-sl', type: 'biological-child', source: sarah.id, target: liam.id, attributes: {} },
    { id: 'rel-dm', type: 'biological-child', source: david.id, target: mia.id, attributes: {} },
    { id: 'rel-sm', type: 'biological-child', source: sarah.id, target: mia.id, attributes: {} },
    { id: 'rel-da', type: 'biological-child', source: david.id, target: ava.id, attributes: {} },
    { id: 'rel-sa', type: 'biological-child', source: sarah.id, target: ava.id, attributes: {} },
    { id: 'rel-twins', type: 'identical-twins', source: mia.id, target: ava.id, attributes: {} },
    { id: 'rel-dp', type: 'adopted-child', source: david.id, target: pregnancy.id, attributes: {} },
    { id: 'rel-sp', type: 'adopted-child', source: sarah.id, target: pregnancy.id, attributes: {} },
  ];
  project.households = [{ id: 'household-main', label: 'Current household', memberIds: [david.id, sarah.id, liam.id, mia.id, ava.id] }];
  project.canvas.positions = {
    [robert.id]: { x: 170, y: 70 },
    [helen.id]: { x: 390, y: 70 },
    [david.id]: { x: 210, y: 300 },
    [sarah.id]: { x: 430, y: 300 },
    [liam.id]: { x: 110, y: 560 },
    [mia.id]: { x: 315, y: 560 },
    [ava.id]: { x: 500, y: 560 },
    [pregnancy.id]: { x: 690, y: 560 },
  };
  return project;
}

export function getRelationshipConnectionError(
  project: Project,
  type: RelationshipType,
  source: string | null | undefined,
  target: string | null | undefined,
): string | null {
  if (!source || !target) return 'Choose two people to create a relationship.';
  if (source === target) return 'A relationship needs two different people.';
  const people = new Set(project.people.map((person) => person.id));
  if (!people.has(source) || !people.has(target)) return 'Choose people that are on this canvas.';
  if (isTwinRelationship(type)) {
    const sourceIsChild = project.relationships.some((relationship) => isChildRelationship(relationship.type) && relationship.target === source);
    const targetIsChild = project.relationships.some((relationship) => isChildRelationship(relationship.type) && relationship.target === target);
    if (!sourceIsChild || !targetIsChild) return 'Connect both people to their parent(s) before marking them as twins.';
  }
  const duplicate = project.relationships.some((relationship) => relationship.type === type && relationshipEndpointsMatch(type, source, target, relationship.source, relationship.target));
  return duplicate ? `A ${getRelationshipDefinition(type).label.toLowerCase()} relationship already connects these people.` : null;
}

export function snapshotProject(project: Project): ProjectSnapshot {
  return structuredClone({ people: project.people, relationships: project.relationships, households: project.households, annotations: project.annotations, canvas: project.canvas });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function validateProject(value: unknown): Project {
  if (!isRecord(value)) throw new ProjectValidationError('project must be an object');
  if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new ProjectValidationError(`schemaVersion must be ${CURRENT_SCHEMA_VERSION}`);
  for (const field of ['id', 'name', 'createdAt', 'updatedAt']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) throw new ProjectValidationError(`${field} must be a non-empty string`);
  }
  if (!Array.isArray(value.people) || !Array.isArray(value.relationships) || !Array.isArray(value.households)) throw new ProjectValidationError('people, relationships and households must be arrays');
  const annotations = value.annotations ?? [];
  if (!Array.isArray(annotations)) throw new ProjectValidationError('annotations must be an array');
  const personIds = new Set<string>();
  (value.people as unknown[]).forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || personIds.has(entry.id)) throw new ProjectValidationError(`people[${index}] has an invalid or duplicate id`);
    personIds.add(entry.id);
    if (typeof entry.name !== 'string' || !GENDERS.includes(entry.gender as Gender) || !SYMBOL_KINDS.includes(entry.symbolKind as SymbolKind)) throw new ProjectValidationError(`people[${index}] has invalid core fields`);
    if (entry.explicitlyChildless !== undefined && typeof entry.explicitlyChildless !== 'boolean') throw new ProjectValidationError(`people[${index}].explicitlyChildless must be a boolean`);
    if (entry.profile !== undefined) {
      if (!isRecord(entry.profile)) throw new ProjectValidationError(`people[${index}].profile must be an object`);
      for (const field of Object.keys(createEmptyPersonProfile())) {
        if (entry.profile[field] !== undefined && typeof entry.profile[field] !== 'string') throw new ProjectValidationError(`people[${index}].profile.${field} must be a string`);
      }
    }
    if (entry.visualSettings !== undefined) {
      if (!isRecord(entry.visualSettings)) throw new ProjectValidationError(`people[${index}].visualSettings must be an object`);
      if (entry.visualSettings.color !== undefined && typeof entry.visualSettings.color !== 'string') throw new ProjectValidationError(`people[${index}].visualSettings.color must be a string`);
      if (entry.visualSettings.size !== undefined && !PERSON_DISPLAY_SIZES.includes(entry.visualSettings.size as PersonDisplaySize)) throw new ProjectValidationError(`people[${index}].visualSettings.size is invalid`);
      for (const field of ['showColor', 'showMedical', 'showCulturalHeritage', 'showReligion', 'showSocialClass', 'showEducation', 'showLocation', 'hidden']) {
        if (entry.visualSettings[field] !== undefined && typeof entry.visualSettings[field] !== 'boolean') throw new ProjectValidationError(`people[${index}].visualSettings.${field} must be a boolean`);
      }
    }
    if (!Array.isArray(entry.medicalMarkers)) throw new ProjectValidationError(`people[${index}].medicalMarkers must be an array`);
    entry.medicalMarkers.forEach((marker, markerIndex) => {
      if (!isRecord(marker) || typeof marker.id !== 'string' || typeof marker.label !== 'string' || !MEDICAL_MARKER_COLORS.includes(marker.color as MedicalMarkerColor) || !MEDICAL_MARKER_QUADRANTS.includes(marker.quadrant as MedicalMarkerQuadrant)) {
        throw new ProjectValidationError(`people[${index}].medicalMarkers[${markerIndex}] is invalid`);
      }
      if (marker.status !== undefined && !MEDICAL_MARKER_STATUSES.includes(marker.status as MedicalMarkerStatus)) {
        throw new ProjectValidationError(`people[${index}].medicalMarkers[${markerIndex}].status is invalid`);
      }
    });
    if (entry.culturalHeritageLayers !== undefined) {
      if (!Array.isArray(entry.culturalHeritageLayers)) throw new ProjectValidationError(`people[${index}].culturalHeritageLayers must be an array`);
      entry.culturalHeritageLayers.forEach((layer, layerIndex) => {
        if (!isRecord(layer) || typeof layer.id !== 'string' || typeof layer.label !== 'string' || !CULTURAL_HERITAGE_PATTERNS.includes(layer.pattern as CulturalHeritagePattern)) {
          throw new ProjectValidationError(`people[${index}].culturalHeritageLayers[${layerIndex}] is invalid`);
        }
      });
    }
  });
  const relationshipIds = new Set<string>();
  (value.relationships as unknown[]).forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || relationshipIds.has(entry.id)) throw new ProjectValidationError(`relationships[${index}] has an invalid or duplicate id`);
    relationshipIds.add(entry.id);
    if (!RELATIONSHIP_TYPES.includes(entry.type as RelationshipType) || typeof entry.source !== 'string' || typeof entry.target !== 'string' || entry.source === entry.target) throw new ProjectValidationError(`relationships[${index}] has invalid endpoints or type`);
    if (!personIds.has(entry.source) || !personIds.has(entry.target)) throw new ProjectValidationError(`relationships[${index}] references an unknown person`);
    if (!isRecord(entry.attributes) || !isJsonValue(entry.attributes)) throw new ProjectValidationError(`relationships[${index}].attributes must be JSON data`);
  });
  (value.households as unknown[]).forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.label !== 'string' || !Array.isArray(entry.memberIds)) throw new ProjectValidationError(`households[${index}] is invalid`);
    if ((entry.memberIds as unknown[]).some((id) => typeof id !== 'string' || !personIds.has(id))) throw new ProjectValidationError(`households[${index}] references an unknown person`);
  });
  const annotationIds = new Set<string>();
  (annotations as unknown[]).forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || annotationIds.has(entry.id)) throw new ProjectValidationError(`annotations[${index}] has an invalid or duplicate id`);
    annotationIds.add(entry.id);
    if (!CANVAS_ANNOTATION_KINDS.includes(entry.kind as CanvasAnnotationKind) || typeof entry.text !== 'string') throw new ProjectValidationError(`annotations[${index}] has invalid core fields`);
    if (entry.notes !== undefined && typeof entry.notes !== 'string') throw new ProjectValidationError(`annotations[${index}].notes must be a string`);
    if (entry.fontFamily !== undefined && !['sans', 'serif', 'mono'].includes(String(entry.fontFamily))) throw new ProjectValidationError(`annotations[${index}].fontFamily is invalid`);
    if (entry.fontSize !== undefined && (typeof entry.fontSize !== 'number' || !Number.isFinite(entry.fontSize))) throw new ProjectValidationError(`annotations[${index}].fontSize is invalid`);
    for (const field of ['bold', 'italic', 'underline', 'hidden']) {
      if (entry[field] !== undefined && typeof entry[field] !== 'boolean') throw new ProjectValidationError(`annotations[${index}].${field} must be a boolean`);
    }
    if (entry.color !== undefined && typeof entry.color !== 'string') throw new ProjectValidationError(`annotations[${index}].color must be a string`);
    if (entry.backgroundColor !== undefined && typeof entry.backgroundColor !== 'string') throw new ProjectValidationError(`annotations[${index}].backgroundColor must be a string`);
    if (entry.linkedIds !== undefined && (!Array.isArray(entry.linkedIds) || entry.linkedIds.some((id) => typeof id !== 'string') || new Set(entry.linkedIds).size !== entry.linkedIds.length || entry.linkedIds.includes(entry.id))) throw new ProjectValidationError(`annotations[${index}].linkedIds is invalid`);
    if (entry.linkAttributes !== undefined) {
      if (!isRecord(entry.linkAttributes)) throw new ProjectValidationError(`annotations[${index}].linkAttributes must be an object`);
      for (const [targetId, attributes] of Object.entries(entry.linkAttributes)) {
        if (!Array.isArray(entry.linkedIds) || !entry.linkedIds.includes(targetId) || !isRecord(attributes)) throw new ProjectValidationError(`annotations[${index}].linkAttributes is invalid`);
        if (attributes.label !== undefined && typeof attributes.label !== 'string') throw new ProjectValidationError(`annotations[${index}].linkAttributes.${targetId}.label must be a string`);
        if (attributes.color !== undefined && typeof attributes.color !== 'string') throw new ProjectValidationError(`annotations[${index}].linkAttributes.${targetId}.color must be a string`);
        if (attributes.hidden !== undefined && typeof attributes.hidden !== 'boolean') throw new ProjectValidationError(`annotations[${index}].linkAttributes.${targetId}.hidden must be a boolean`);
      }
    }
    for (const field of ['width', 'height']) {
      if (entry[field] !== undefined && (typeof entry[field] !== 'number' || !Number.isFinite(entry[field]) || entry[field] <= 0)) throw new ProjectValidationError(`annotations[${index}].${field} must be a positive number`);
    }
  });
  const annotationLinkTargets = new Set([...personIds, ...annotationIds]);
  (annotations as unknown[]).forEach((entry, index) => {
    if (!isRecord(entry) || !Array.isArray(entry.linkedIds)) return;
    if (entry.linkedIds.some((id) => !annotationLinkTargets.has(String(id)))) throw new ProjectValidationError(`annotations[${index}].linkedIds references an unknown item`);
  });
  if (!isRecord(value.canvas) || !isRecord(value.canvas.positions) || !isRecord(value.canvas.viewport)) throw new ProjectValidationError('canvas is invalid');
  if (value.canvas.personLabelVisibility !== undefined) {
    if (!isRecord(value.canvas.personLabelVisibility)) throw new ProjectValidationError('canvas.personLabelVisibility must be an object');
    for (const [key, visible] of Object.entries(value.canvas.personLabelVisibility)) {
      if (!PERSON_LABEL_KEYS.includes(key as PersonLabelKey) || typeof visible !== 'boolean') throw new ProjectValidationError(`canvas.personLabelVisibility.${key} is invalid`);
    }
  }
  if (value.canvas.wrapPersonLabels !== undefined && typeof value.canvas.wrapPersonLabels !== 'boolean') throw new ProjectValidationError('canvas.wrapPersonLabels must be a boolean');
  if (value.canvas.viewVisibility !== undefined) {
    if (!isRecord(value.canvas.viewVisibility)) throw new ProjectValidationError('canvas.viewVisibility must be an object');
    for (const [key, visible] of Object.entries(value.canvas.viewVisibility)) {
      if (!CANVAS_VIEW_KEYS.includes(key as CanvasViewKey) || typeof visible !== 'boolean') throw new ProjectValidationError(`canvas.viewVisibility.${key} is invalid`);
    }
  }
  for (const id of [...personIds, ...annotationIds]) {
    const position = value.canvas.positions[id];
    if (!isRecord(position) || typeof position.x !== 'number' || typeof position.y !== 'number') throw new ProjectValidationError(`canvas position for ${id} is invalid`);
  }
  return structuredClone({ ...value, annotations }) as unknown as Project;
}
