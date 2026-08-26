import {
  CHILD_RELATIONSHIP_TYPES,
  GENDERS,
  PARTNER_RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPES,
  createEmptyProject,
  createPerson,
  getRelationshipConnectionError,
  isChildRelationship,
  isPartnerRelationship,
  isTwinRelationship,
  validateProject,
  type CanvasAnnotationKind,
  type ChildRelationshipType,
  type Gender,
  type JsonValue,
  type PartnerRelationshipType,
  type Project,
  type RelationshipType,
} from './model';

export interface GenogramGenerationPerson {
  key: string;
  name: string;
  gender?: Gender;
  birthYear?: number | null;
  deathYear?: number | null;
  deceased?: boolean;
  notes?: string;
  isIndexPerson?: boolean;
}

export interface GenogramGenerationChild {
  key: string;
  relationship?: ChildRelationshipType;
}

export interface GenogramGenerationFamily {
  parents: string[];
  children: Array<string | GenogramGenerationChild>;
  partnerRelationship?: PartnerRelationshipType;
}

export interface GenogramGenerationRelationship {
  type: RelationshipType;
  source: string;
  target: string;
  label?: string;
}

export interface GenogramGenerationHousehold {
  label: string;
  members: string[];
}

export interface GenogramGenerationAnnotation {
  kind: CanvasAnnotationKind;
  text: string;
  linkedTo?: string[];
}

export interface GenogramGenerationSpec {
  name: string;
  people: GenogramGenerationPerson[];
  families?: GenogramGenerationFamily[];
  relationships?: GenogramGenerationRelationship[];
  households?: GenogramGenerationHousehold[];
  annotations?: GenogramGenerationAnnotation[];
}

export interface GenerateGenogramOptions {
  now?: string;
}

export interface GeneratedGenogram {
  project: Project;
  warnings: string[];
}

export class GenogramGenerationError extends Error {
  readonly code = 'INVALID_GENERATION_SPEC';

  constructor(message: string) {
    super(message);
    this.name = 'GenogramGenerationError';
  }
}

type EqualGenerationRelationship = Extract<RelationshipType, PartnerRelationshipType | 'sibling' | 'fraternal-twins' | 'identical-twins'>;

const MAX_PEOPLE = 200;
const MAX_FAMILIES = 200;
const MAX_RELATIONSHIPS = 500;
const MAX_HOUSEHOLDS = 100;
const MAX_ANNOTATIONS = 100;
const NODE_HORIZONTAL_GAP = 230;
const NODE_VERTICAL_GAP = 280;
const CANVAS_PADDING = 120;

function assertNonEmptyString(value: unknown, label: string, maxLength: number): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GenogramGenerationError(`${label} must be a non-empty string.`);
  }
  if (value.length > maxLength) throw new GenogramGenerationError(`${label} is too long.`);
}

function assertCollectionLimit(items: unknown[], limit: number, label: string) {
  if (items.length > limit) throw new GenogramGenerationError(`${label} supports at most ${limit} items.`);
}

function optionalYear(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 9999) {
    throw new GenogramGenerationError(`${label} must be an integer between 0 and 9999.`);
  }
  return Number(value);
}

function safeIdPart(value: string, fallback: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || fallback;
}

function personIdMap(people: GenogramGenerationPerson[]): Map<string, string> {
  const keys = new Set<string>();
  const ids = new Set<string>();
  const result = new Map<string, string>();

  people.forEach((person, index) => {
    assertNonEmptyString(person.key, `people[${index}].key`, 80);
    if (keys.has(person.key)) throw new GenogramGenerationError(`people[${index}].key duplicates “${person.key}”.`);
    keys.add(person.key);

    const base = `person-${safeIdPart(person.key, String(index + 1))}`;
    let id = base;
    let suffix = 2;
    while (ids.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    ids.add(id);
    result.set(person.key, id);
  });

  return result;
}

class DisjointSet {
  private readonly parent = new Map<string, string>();

  constructor(ids: string[]) {
    ids.forEach((id) => this.parent.set(id, id));
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (!parent) throw new GenogramGenerationError(`Unknown person id “${id}”.`);
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(first: string, second: string) {
    const firstRoot = this.find(first);
    const secondRoot = this.find(second);
    if (firstRoot !== secondRoot) this.parent.set(secondRoot, firstRoot);
  }
}

function isEqualGenerationRelationship(type: RelationshipType): type is EqualGenerationRelationship {
  return isPartnerRelationship(type) || type === 'sibling' || isTwinRelationship(type);
}

function layoutProject(project: Project, inputOrder: Map<string, number>) {
  const ids = project.people.map((person) => person.id);
  const generations = new DisjointSet(ids);

  project.relationships.forEach((relationship) => {
    if (isEqualGenerationRelationship(relationship.type)) generations.union(relationship.source, relationship.target);
  });

  const members = new Map<string, string[]>();
  ids.forEach((id) => {
    const root = generations.find(id);
    const group = members.get(root) ?? [];
    group.push(id);
    members.set(root, group);
  });

  const outgoing = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  members.forEach((_, root) => {
    outgoing.set(root, new Set());
    indegree.set(root, 0);
  });

  project.relationships.forEach((relationship) => {
    if (!isChildRelationship(relationship.type)) return;
    const sourceRoot = generations.find(relationship.source);
    const targetRoot = generations.find(relationship.target);
    if (sourceRoot === targetRoot) {
      throw new GenogramGenerationError(`Child relationship “${relationship.source} → ${relationship.target}” creates a generation conflict.`);
    }
    const targets = outgoing.get(sourceRoot) as Set<string>;
    if (!targets.has(targetRoot)) {
      targets.add(targetRoot);
      indegree.set(targetRoot, (indegree.get(targetRoot) ?? 0) + 1);
    }
  });

  const componentOrder = (root: string) => Math.min(...(members.get(root) ?? []).map((id) => inputOrder.get(id) ?? Number.MAX_SAFE_INTEGER));
  const queue = [...members.keys()]
    .filter((root) => indegree.get(root) === 0)
    .sort((left, right) => componentOrder(left) - componentOrder(right));
  const rank = new Map<string, number>(queue.map((root) => [root, 0]));
  const visited: string[] = [];

  while (queue.length > 0) {
    const root = queue.shift() as string;
    visited.push(root);
    for (const target of outgoing.get(root) ?? []) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(root) ?? 0) + 1));
      const nextIndegree = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(target);
        queue.sort((left, right) => componentOrder(left) - componentOrder(right));
      }
    }
  }

  if (visited.length !== members.size) {
    throw new GenogramGenerationError('Child relationships contain a generation cycle.');
  }

  const rows = new Map<number, string[]>();
  visited.forEach((root) => {
    const row = rank.get(root) ?? 0;
    const roots = rows.get(row) ?? [];
    roots.push(root);
    rows.set(row, roots);
  });
  rows.forEach((roots) => roots.sort((left, right) => componentOrder(left) - componentOrder(right)));

  const rowPeople = new Map<number, string[]>();
  rows.forEach((roots, row) => {
    rowPeople.set(row, roots.flatMap((root) => (members.get(root) ?? [])
      .sort((left, right) => (inputOrder.get(left) ?? 0) - (inputOrder.get(right) ?? 0))));
  });

  const widestRow = Math.max(1, ...[...rowPeople.values()].map((people) => people.length));
  rowPeople.forEach((people, row) => {
    const offset = ((widestRow - people.length) * NODE_HORIZONTAL_GAP) / 2;
    people.forEach((id, index) => {
      project.canvas.positions[id] = {
        x: CANVAS_PADDING + offset + index * NODE_HORIZONTAL_GAP,
        y: CANVAS_PADDING + row * NODE_VERTICAL_GAP,
      };
    });
  });
}

export function generateGenogramProject(spec: GenogramGenerationSpec, options: GenerateGenogramOptions = {}): GeneratedGenogram {
  if (!spec || typeof spec !== 'object') throw new GenogramGenerationError('Generation spec must be an object.');
  assertNonEmptyString(spec.name, 'name', 120);
  if (!Array.isArray(spec.people) || spec.people.length === 0) throw new GenogramGenerationError('people must contain at least one person.');
  assertCollectionLimit(spec.people, MAX_PEOPLE, 'people');
  const families = spec.families ?? [];
  const relationships = spec.relationships ?? [];
  const households = spec.households ?? [];
  const annotations = spec.annotations ?? [];
  if (!Array.isArray(families) || !Array.isArray(relationships) || !Array.isArray(households) || !Array.isArray(annotations)) {
    throw new GenogramGenerationError('families, relationships, households and annotations must be arrays.');
  }
  assertCollectionLimit(families, MAX_FAMILIES, 'families');
  assertCollectionLimit(relationships, MAX_RELATIONSHIPS, 'relationships');
  assertCollectionLimit(households, MAX_HOUSEHOLDS, 'households');
  assertCollectionLimit(annotations, MAX_ANNOTATIONS, 'annotations');

  const keyToId = personIdMap(spec.people);
  const now = options.now ?? new Date().toISOString();
  const project = createEmptyProject(spec.name.trim());
  project.createdAt = now;
  project.updatedAt = now;
  project.people = spec.people.map((person, index) => {
    assertNonEmptyString(person.name, `people[${index}].name`, 120);
    const gender = person.gender ?? 'unspecified';
    if (!GENDERS.includes(gender)) throw new GenogramGenerationError(`people[${index}].gender is invalid.`);
    if (person.notes !== undefined && typeof person.notes !== 'string') throw new GenogramGenerationError(`people[${index}].notes must be a string.`);
    if (person.notes && person.notes.length > 20_000) throw new GenogramGenerationError(`people[${index}].notes is too long.`);
    if (person.deceased !== undefined && typeof person.deceased !== 'boolean') throw new GenogramGenerationError(`people[${index}].deceased must be a boolean.`);
    if (person.isIndexPerson !== undefined && typeof person.isIndexPerson !== 'boolean') throw new GenogramGenerationError(`people[${index}].isIndexPerson must be a boolean.`);
    const birthYear = optionalYear(person.birthYear, `people[${index}].birthYear`);
    const deathYear = optionalYear(person.deathYear, `people[${index}].deathYear`);
    if (birthYear !== null && deathYear !== null && deathYear < birthYear) {
      throw new GenogramGenerationError(`people[${index}].deathYear cannot be earlier than birthYear.`);
    }
    return createPerson(keyToId.get(person.key) as string, person.name.trim(), gender, {
      birthYear,
      deathYear,
      deceased: person.deceased ?? deathYear !== null,
      notes: person.notes ?? '',
      isIndexPerson: person.isIndexPerson ?? false,
    });
  });

  const warnings: string[] = [];
  let relationshipNumber = 0;
  const resolvePerson = (key: string, label: string) => {
    const id = keyToId.get(key);
    if (!id) throw new GenogramGenerationError(`${label} references unknown person key “${key}”.`);
    return id;
  };
  const addRelationship = (type: RelationshipType, sourceKey: string, targetKey: string, attributes: Record<string, JsonValue>, label: string) => {
    if (project.relationships.length >= MAX_RELATIONSHIPS) {
      throw new GenogramGenerationError(`Generated projects support at most ${MAX_RELATIONSHIPS} relationships.`);
    }
    const source = resolvePerson(sourceKey, `${label}.source`);
    const target = resolvePerson(targetKey, `${label}.target`);
    const error = getRelationshipConnectionError(project, type, source, target);
    if (error) throw new GenogramGenerationError(`${label}: ${error}`);
    relationshipNumber += 1;
    project.relationships.push({ id: `relationship-${relationshipNumber}`, type, source, target, attributes });
  };

  families.forEach((family, familyIndex) => {
    if (!Array.isArray(family.parents) || family.parents.length < 1 || family.parents.length > 2) {
      throw new GenogramGenerationError(`families[${familyIndex}].parents must contain one or two person keys.`);
    }
    if (!Array.isArray(family.children) || family.children.length === 0) {
      throw new GenogramGenerationError(`families[${familyIndex}].children must contain at least one child.`);
    }
    family.parents.forEach((key, parentIndex) => resolvePerson(key, `families[${familyIndex}].parents[${parentIndex}]`));
    if (new Set(family.parents).size !== family.parents.length) throw new GenogramGenerationError(`families[${familyIndex}].parents contains a duplicate person.`);
    if (family.parents.length === 2) {
      const partnerRelationship = family.partnerRelationship ?? 'unknown-partner';
      if (!PARTNER_RELATIONSHIP_TYPES.includes(partnerRelationship)) throw new GenogramGenerationError(`families[${familyIndex}].partnerRelationship is invalid.`);
      if (family.partnerRelationship === undefined) warnings.push(`families[${familyIndex}] used “unknown-partner” because no partner relationship was supplied.`);
      addRelationship(partnerRelationship, family.parents[0], family.parents[1], {}, `families[${familyIndex}].partnerRelationship`);
    }
    family.children.forEach((child, childIndex) => {
      const childKey = typeof child === 'string' ? child : child.key;
      const childRelationship = typeof child === 'string' ? 'biological-child' : child.relationship ?? 'biological-child';
      if (!CHILD_RELATIONSHIP_TYPES.includes(childRelationship)) throw new GenogramGenerationError(`families[${familyIndex}].children[${childIndex}].relationship is invalid.`);
      resolvePerson(childKey, `families[${familyIndex}].children[${childIndex}]`);
      family.parents.forEach((parentKey, parentIndex) => {
        addRelationship(childRelationship, parentKey, childKey, {}, `families[${familyIndex}].children[${childIndex}].parent[${parentIndex}]`);
      });
    });
  });

  const explicitRelationships = [...relationships].sort((left, right) => {
    const priority = (type: RelationshipType) => isPartnerRelationship(type) ? 0 : isChildRelationship(type) ? 1 : isTwinRelationship(type) ? 2 : 3;
    return priority(left.type) - priority(right.type);
  });
  explicitRelationships.forEach((relationship, index) => {
    if (!RELATIONSHIP_TYPES.includes(relationship.type)) throw new GenogramGenerationError(`relationships[${index}].type is invalid.`);
    if (relationship.label !== undefined && typeof relationship.label !== 'string') throw new GenogramGenerationError(`relationships[${index}].label must be a string.`);
    addRelationship(
      relationship.type,
      relationship.source,
      relationship.target,
      relationship.label ? { label: relationship.label } : {},
      `relationships[${index}]`,
    );
  });

  households.forEach((household, index) => {
    assertNonEmptyString(household.label, `households[${index}].label`, 120);
    if (!Array.isArray(household.members) || household.members.length === 0) throw new GenogramGenerationError(`households[${index}].members must contain at least one person.`);
    const memberIds = household.members.map((key, memberIndex) => resolvePerson(key, `households[${index}].members[${memberIndex}]`));
    if (new Set(memberIds).size !== memberIds.length) throw new GenogramGenerationError(`households[${index}].members contains a duplicate person.`);
    project.households.push({ id: `household-${index + 1}`, label: household.label.trim(), memberIds });
  });

  annotations.forEach((annotation, index) => {
    if (!['note', 'secret', 'text'].includes(annotation.kind)) throw new GenogramGenerationError(`annotations[${index}].kind is invalid.`);
    assertNonEmptyString(annotation.text, `annotations[${index}].text`, 10_000);
    const id = `annotation-${index + 1}`;
    const linkedIds = annotation.linkedTo?.map((key, linkIndex) => resolvePerson(key, `annotations[${index}].linkedTo[${linkIndex}]`));
    if (linkedIds && new Set(linkedIds).size !== linkedIds.length) throw new GenogramGenerationError(`annotations[${index}].linkedTo contains a duplicate person.`);
    project.annotations.push({ id, kind: annotation.kind, text: annotation.text, linkedIds });
  });

  const inputOrder = new Map(project.people.map((person, index) => [person.id, index]));
  layoutProject(project, inputOrder);
  const annotationX = CANVAS_PADDING + Math.max(1, project.people.length) * NODE_HORIZONTAL_GAP;
  project.annotations.forEach((annotation, index) => {
    project.canvas.positions[annotation.id] = { x: annotationX, y: CANVAS_PADDING + index * 190 };
  });

  return { project: validateProject(project), warnings };
}
