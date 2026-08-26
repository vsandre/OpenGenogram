import { create } from 'zustand';

import {
  createDefaultCanvasViewVisibility,
  createDefaultPersonLabelVisibility,
  createDefaultPersonVisualSettings,
  createEmptyPersonProfile,
  createId,
  createStarterProject,
  getRelationshipConnectionError,
  isChildRelationship,
  isPartnerRelationship,
  isTwinRelationship,
  relationshipEndpointsMatch,
  snapshotProject,
  SYMBOL_KIND_LABELS,
  validateProject,
  type Gender,
  type AnnotationLinkAttributes,
  type CanvasAnnotation,
  type CanvasAnnotationKind,
  type Household,
  type CanvasViewKey,
  type Person,
  type PersonLabelKey,
  type Position,
  type Project,
  type ProjectSnapshot,
  type Relationship,
  type RelationshipType,
  type Viewport,
  type SymbolKind,
} from './model';
import { DEFAULT_PARTNER_LINE_OFFSET, personSymbolAnchorOffsets } from './flow-adapter';

export const MAX_HISTORY = 100;
const GENERATION_VERTICAL_GAP = 260;
const PARTNER_HORIZONTAL_GAP = 220;
const PARENT_HORIZONTAL_OFFSET = PARTNER_HORIZONTAL_GAP / 2;
const CHILD_HORIZONTAL_GAP = 176;

export type Panel = 'person' | 'household' | 'annotation' | null;

export interface UIState {
  selectedPersonIds: string[];
  selectedRelationshipIds: string[];
  selectedHouseholdIds: string[];
  selectedAnnotationIds: string[];
  activePanel: Panel;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  dragSnapshot: ProjectSnapshot | null;
}

export interface HistoryState {
  past: ProjectSnapshot[];
  future: ProjectSnapshot[];
}

export type PersonPatch = Partial<Omit<Person, 'id'>>;

export interface AddPersonInput extends PersonPatch {
  id?: string;
  position?: Position;
}

export type QuickRelativeKind = 'parents' | 'partner' | 'sibling' | 'child';

interface MoveChildToFamilyOptions {
  familyOriginOffset?: number;
  preserveTwinRelationships?: boolean;
}

export interface GenogramStore {
  project: Project;
  ui: UIState;
  history: HistoryState;
  addPerson: (input?: AddPersonInput) => string;
  quickAddRelative: (anchorId: string, kind: QuickRelativeKind) => string[];
  updatePerson: (id: string, patch: PersonPatch) => void;
  deletePeople: (ids: string[]) => void;
  duplicatePeople: (ids: string[]) => string[];
  addAnnotation: (kind: CanvasAnnotationKind, position: Position) => string;
  updateAnnotation: (id: string, patch: Partial<Omit<CanvasAnnotation, 'id' | 'kind'>>) => void;
  addAnnotationLink: (sourceId: string, targetId: string) => boolean;
  updateAnnotationLink: (sourceId: string, targetId: string, patch: Partial<AnnotationLinkAttributes>) => void;
  deleteAnnotationLink: (sourceId: string, targetId: string) => void;
  deleteAnnotations: (ids: string[]) => void;
  addRelationship: (
    type: RelationshipType,
    source: string,
    target: string,
    attributes?: Relationship['attributes'],
  ) => string | null;
  updateRelationship: (id: string, patch: Partial<Pick<Relationship, 'type' | 'attributes'>>) => void;
  deleteRelationships: (ids: string[]) => void;
  addTwinSibling: (childRelationshipId: string, type: Extract<RelationshipType, 'fraternal-twins' | 'identical-twins'>) => string[];
  moveChildToFamily: (childId: string, parentIds: [string, string], options?: MoveChildToFamilyOptions) => string[];
  addHousehold: (memberIds: string[], label?: string) => string | null;
  updateHousehold: (id: string, patch: Partial<Pick<Household, 'label' | 'memberIds'>>) => void;
  deleteHouseholds: (ids: string[]) => void;
  setSelection: (people: string[], relationships?: string[], households?: string[], annotations?: string[]) => void;
  setActivePanel: (panel: Panel) => void;
  replaceProject: (project: Project) => void;
  setSaveStatus: (status: UIState['saveStatus'], error?: string | null) => void;
  beginNodeDrag: (ids: string[]) => void;
  updateNodePositions: (updates: Record<string, Position>) => void;
  endNodeDrag: () => void;
  setViewport: (viewport: Viewport) => void;
  setPersonLabelVisibility: (key: PersonLabelKey, visible: boolean) => void;
  setWrapPersonLabels: (wrap: boolean) => void;
  setCanvasViewVisibility: (key: CanvasViewKey, visible: boolean) => void;
  undo: () => void;
  redo: () => void;
}

const initialUi: UIState = {
  selectedPersonIds: [],
  selectedRelationshipIds: [],
  selectedHouseholdIds: [],
  selectedAnnotationIds: [],
  activePanel: null,
  saveStatus: 'idle',
  saveError: null,
  dragSnapshot: null,
};

const initialHistory: HistoryState = { past: [], future: [] };

function createInitialUi(): UIState {
  return {
    ...initialUi,
    selectedPersonIds: [],
    selectedRelationshipIds: [],
    selectedHouseholdIds: [],
    selectedAnnotationIds: [],
    dragSnapshot: null,
  };
}

function createInitialHistory(): HistoryState {
  return { past: [], future: [] };
}

function snapshotsEqual(left: ProjectSnapshot, right: ProjectSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function idListsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function commit(
  state: GenogramStore,
  mutate: (project: Project) => void,
  uiPatch: Partial<UIState> = {},
): GenogramStore | Partial<GenogramStore> {
  const before = snapshotProject(state.project);
  const project = structuredClone(state.project);
  mutate(project);
  const after = snapshotProject(project);
  if (snapshotsEqual(before, after)) return state;

  project.updatedAt = new Date().toISOString();
  return {
    project,
    ui: { ...state.ui, ...uiPatch },
    history: {
      past: [...state.history.past, before].slice(-MAX_HISTORY),
      future: [],
    },
  };
}

function personIdsIn(project: Project): Set<string> {
  return new Set(project.people.map((person) => person.id));
}

function selectedPeopleIn(project: Project, ids: string[]): string[] {
  const idsInProject = personIdsIn(project);
  return ids.filter((id) => idsInProject.has(id));
}

function selectedRelationshipsIn(project: Project, ids: string[]): string[] {
  const idsInProject = new Set(project.relationships.map((relationship) => relationship.id));
  return ids.filter((id) => idsInProject.has(id));
}

function selectedHouseholdsIn(project: Project, ids: string[]): string[] {
  const idsInProject = new Set(project.households.map((household) => household.id));
  return ids.filter((id) => idsInProject.has(id));
}

function selectedAnnotationsIn(project: Project, ids: string[]): string[] {
  const idsInProject = new Set(project.annotations.map((annotation) => annotation.id));
  return ids.filter((id) => idsInProject.has(id));
}

function hasDuplicateRelationship(
  project: Project,
  type: RelationshipType,
  source: string,
  target: string,
  exceptId?: string,
): boolean {
  return project.relationships.some((relationship) => (
    relationship.id !== exceptId
      && relationship.type === type
      && relationshipEndpointsMatch(type, source, target, relationship.source, relationship.target)
  ));
}

function projectWithSnapshot(project: Project, snapshot: ProjectSnapshot): Project {
  return {
    ...project,
    people: structuredClone(snapshot.people),
    relationships: structuredClone(snapshot.relationships),
    households: structuredClone(snapshot.households),
    annotations: structuredClone(snapshot.annotations),
    canvas: structuredClone(snapshot.canvas),
    updatedAt: new Date().toISOString(),
  };
}

export const useGenogramStore = create<GenogramStore>((set) => ({
  project: createStarterProject(),
  ui: initialUi,
  history: initialHistory,

  addPerson: (input = {}) => {
    let createdId = input.id ?? createId('person');
    set((state) => {
      if (state.project.people.some((person) => person.id === createdId)) createdId = createId('person');
      const index = state.project.people.length;
      const symbolKind = input.symbolKind ?? 'person';
      return commit(
        state,
        (project) => {
          project.people.push({
            id: createdId,
            name: input.name ?? (SYMBOL_KIND_LABELS[symbolKind as SymbolKind] ?? 'New person'),
            gender: input.gender ?? ('unspecified' as Gender),
            birthYear: input.birthYear ?? null,
            deathYear: input.deathYear ?? null,
            notes: input.notes ?? '',
            deceased: input.deceased ?? false,
            symbolKind,
            isIndexPerson: input.isIndexPerson ?? false,
            medicalMarkers: structuredClone(input.medicalMarkers ?? []),
            profile: structuredClone(input.profile ?? createEmptyPersonProfile()),
            visualSettings: structuredClone(input.visualSettings ?? createDefaultPersonVisualSettings()),
          });
          project.canvas.positions[createdId] = input.position ?? {
            x: 230 + (index % 2) * 230,
            y: 130 + Math.floor(index / 2) * 230,
          };
        },
        {
          selectedPersonIds: [createdId],
          selectedRelationshipIds: [],
          selectedHouseholdIds: [],
          selectedAnnotationIds: [],
          activePanel: 'person',
        },
      );
    });
    return createdId;
  },

  quickAddRelative: (anchorId, kind) => {
    const created: string[] = [];
    set((state) => {
      const anchor = state.project.people.find((person) => person.id === anchorId);
      if (!anchor || anchor.symbolKind !== 'person') return state;

      const anchorPosition = state.project.canvas.positions[anchorId] ?? { x: 230, y: 130 };
      const incoming = state.project.relationships.filter(
        (relationship) => relationship.target === anchorId && isChildRelationship(relationship.type),
      );

      return commit(
        state,
        (project) => {
          const addPersonToProject = (name: string, gender: Gender, position: Position) => {
            const id = createId('person');
            created.push(id);
            project.people.push({
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
              profile: createEmptyPersonProfile(),
              visualSettings: createDefaultPersonVisualSettings(),
            });
            project.canvas.positions[id] = position;
            return id;
          };
          const addRelationshipToProject = (type: RelationshipType, source: string, target: string, attributes: Relationship['attributes'] = {}) => {
            if (hasDuplicateRelationship(project, type, source, target)) return;
            project.relationships.push({ id: createId('relationship'), type, source, target, attributes: structuredClone(attributes) });
          };

          if (kind === 'parents') {
            const existingParentIds = [...new Set(incoming.map((relationship) => relationship.source))];
            if (existingParentIds.length >= 2) return;
            const parentIds = [...existingParentIds];
            while (parentIds.length < 2) {
              const index = parentIds.length;
              const knownParent = project.people.find((person) => person.id === parentIds[0]);
              const gender: Gender = index === 0
                ? 'male'
                : knownParent?.gender === 'male' ? 'female' : knownParent?.gender === 'female' ? 'male' : 'female';
              parentIds.push(addPersonToProject(
                index === 0 ? 'Parent 1' : 'Parent 2',
                gender,
                { x: anchorPosition.x + (index === 0 ? -PARENT_HORIZONTAL_OFFSET : PARENT_HORIZONTAL_OFFSET), y: anchorPosition.y - GENERATION_VERTICAL_GAP },
              ));
            }
            addRelationshipToProject('marriage', parentIds[0], parentIds[1]);
            parentIds.forEach((parentId) => addRelationshipToProject('biological-child', parentId, anchorId));
          }

          if (kind === 'partner') {
            const gender: Gender = anchor.gender === 'male' ? 'female' : anchor.gender === 'female' ? 'male' : 'unspecified';
            const alignedRelationship = project.relationships.find(
              (relationship) => isPartnerRelationship(relationship.type)
                && (relationship.source === anchorId || relationship.target === anchorId),
            );
            const partnerId = addPersonToProject('Partner', gender, { x: anchorPosition.x + PARTNER_HORIZONTAL_GAP, y: anchorPosition.y });
            const attributes: Relationship['attributes'] = {};
            if (alignedRelationship) {
              const alignedPersonId = alignedRelationship.source === anchorId ? alignedRelationship.target : alignedRelationship.source;
              const alignedPerson = project.people.find((person) => person.id === alignedPersonId);
              const newPartner = project.people.find((person) => person.id === partnerId);
              const alignedPosition = project.canvas.positions[alignedPersonId];
              if (alignedPerson && newPartner && alignedPosition) {
                const savedOffset = alignedRelationship.attributes.lineOffset;
                const existingOffset = typeof savedOffset === 'number' && Number.isFinite(savedOffset)
                  ? Math.max(12, Math.min(240, savedOffset))
                  : DEFAULT_PARTNER_LINE_OFFSET;
                const anchorBottom = anchorPosition.y + personSymbolAnchorOffsets(anchor).bottom;
                const alignedBottom = alignedPosition.y + personSymbolAnchorOffsets(alignedPerson).bottom;
                const partnerBottom = anchorPosition.y + personSymbolAnchorOffsets(newPartner).bottom;
                const existingLineY = Math.max(anchorBottom, alignedBottom) + existingOffset;
                attributes.lineOffset = Math.max(12, Math.min(240, existingLineY - Math.max(anchorBottom, partnerBottom)));
              }
            }
            addRelationshipToProject('marriage', anchorId, partnerId, attributes);
          }

          if (kind === 'child') {
            const partnerRelationship = project.relationships.find(
              (relationship) => isPartnerRelationship(relationship.type)
                && (relationship.source === anchorId || relationship.target === anchorId),
            );
            const partnerId = partnerRelationship
              ? (partnerRelationship.source === anchorId ? partnerRelationship.target : partnerRelationship.source)
              : null;
            const partnerPosition = partnerId ? project.canvas.positions[partnerId] : null;
            const initialChildX = partnerPosition ? (anchorPosition.x + partnerPosition.x) / 2 : anchorPosition.x;
            const anchorChildIds = new Set(project.relationships
              .filter((relationship) => isChildRelationship(relationship.type) && relationship.source === anchorId)
              .map((relationship) => relationship.target));
            const familyChildIds = partnerId
              ? [...anchorChildIds].filter((childId) => project.relationships.some(
                (relationship) => isChildRelationship(relationship.type) && relationship.source === partnerId && relationship.target === childId,
              ))
              : [...anchorChildIds];
            const existingChildXs = familyChildIds
              .map((childId) => project.canvas.positions[childId]?.x)
              .filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
            const childX = existingChildXs.length > 0
              ? Math.max(...existingChildXs) + CHILD_HORIZONTAL_GAP
              : initialChildX;
            const familyChildCount = familyChildIds.length;
            const childGender: Gender = familyChildCount % 2 === 0 ? 'male' : 'female';
            const childId = addPersonToProject('Person', childGender, { x: childX, y: anchorPosition.y + GENERATION_VERTICAL_GAP });
            addRelationshipToProject('biological-child', anchorId, childId);
            if (partnerId) addRelationshipToProject('biological-child', partnerId, childId);
          }

          if (kind === 'sibling') {
            const siblingGender: Gender = anchor.gender === 'male' ? 'female' : 'male';
            const siblingId = addPersonToProject('Sibling', siblingGender, { x: anchorPosition.x + 280, y: anchorPosition.y });
            if (incoming.length > 0) {
              incoming.forEach((relationship) => addRelationshipToProject(relationship.type, relationship.source, siblingId));
            } else {
              addRelationshipToProject('sibling', anchorId, siblingId);
            }
          }
        },
        {
          selectedPersonIds: [anchorId],
          selectedRelationshipIds: [],
          selectedHouseholdIds: [],
          selectedAnnotationIds: [],
          activePanel: 'person',
        },
      );
    });
    if (created.length > 0) {
      set((state) => ({ ...state, ui: { ...state.ui, selectedPersonIds: [created[0]], activePanel: 'person' } }));
    }
    return created;
  },

  updatePerson: (id, patch) => {
    set((state) => commit(state, (project) => {
      const person = project.people.find((item) => item.id === id);
      if (person) Object.assign(person, patch, { id });
    }));
  },

  deletePeople: (ids) => {
    const chosen = new Set(ids);
    if (chosen.size === 0) return;
    set((state) => {
      const nextPeople = state.project.people.filter((person) => !chosen.has(person.id));
      return commit(
        state,
        (project) => {
          project.people = nextPeople;
          project.relationships = project.relationships.filter(
            (relationship) => !chosen.has(relationship.source) && !chosen.has(relationship.target),
          );
          project.households = project.households
            .map((household) => ({ ...household, memberIds: household.memberIds.filter((id) => !chosen.has(id)) }))
            .filter((household) => household.memberIds.length > 0);
          project.annotations.forEach((annotation) => {
            if (annotation.linkedIds) annotation.linkedIds = annotation.linkedIds.filter((id) => !chosen.has(id));
            if (annotation.linkAttributes) {
              for (const id of chosen) delete annotation.linkAttributes[id];
              if (Object.keys(annotation.linkAttributes).length === 0) delete annotation.linkAttributes;
            }
          });
          for (const id of chosen) delete project.canvas.positions[id];
        },
        {
          selectedPersonIds: selectedPeopleIn({ ...state.project, people: nextPeople }, state.ui.selectedPersonIds),
          selectedRelationshipIds: [],
          selectedHouseholdIds: selectedHouseholdsIn({ ...state.project, people: nextPeople, households: state.project.households.filter((household) => household.memberIds.some((id) => !chosen.has(id))) }, state.ui.selectedHouseholdIds),
          activePanel: null,
        },
      );
    });
  },

  duplicatePeople: (ids) => {
    const chosen = new Set(ids);
    const created: string[] = [];
    if (chosen.size === 0) return created;
    set((state) => commit(
      state,
      (project) => {
        const idMap = new Map<string, string>();
        for (const source of project.people.filter((person) => chosen.has(person.id))) {
          const id = createId('person');
          idMap.set(source.id, id);
          created.push(id);
          const position = project.canvas.positions[source.id] ?? { x: 0, y: 0 };
          project.people.push({
            ...source,
            id,
            name: source.name ? `${source.name} copy` : 'New person copy',
          });
          project.canvas.positions[id] = { x: position.x + 40, y: position.y + 40 };
        }
        for (const relationship of project.relationships.filter(
          (item) => chosen.has(item.source) && chosen.has(item.target),
        )) {
          const source = idMap.get(relationship.source);
          const target = idMap.get(relationship.target);
          if (!source || !target) continue;
          project.relationships.push({
            ...relationship,
            id: createId('relationship'),
            source,
            target,
            attributes: structuredClone(relationship.attributes),
          });
        }
      },
      {
        selectedPersonIds: created,
        selectedRelationshipIds: [],
        selectedHouseholdIds: [],
        selectedAnnotationIds: [],
        activePanel: created.length > 0 ? 'person' : null,
      },
    ));
    return created;
  },

  addAnnotation: (kind, position) => {
    const id = createId('annotation');
    const defaultText = kind === 'note' ? 'Note' : kind === 'secret' ? 'Family secret' : 'Text';
    set((state) => commit(
      state,
      (project) => {
        project.annotations.push({
          id,
          kind,
          text: defaultText,
          notes: '',
          fontFamily: 'sans',
          fontSize: kind === 'text' ? 18 : 12,
          bold: kind === 'text',
          italic: false,
          underline: false,
          color: '#000000',
          backgroundColor: kind === 'note' ? '#f4efe4' : undefined,
          width: kind === 'note' ? 190 : undefined,
          height: kind === 'note' ? 116 : undefined,
          linkedIds: kind === 'text' ? undefined : [],
          hidden: false,
        });
        project.canvas.positions[id] = { ...position };
      },
      {
        selectedPersonIds: [],
        selectedRelationshipIds: [],
        selectedHouseholdIds: [],
        selectedAnnotationIds: [id],
        activePanel: 'annotation',
      },
    ));
    return id;
  },

  updateAnnotation: (id, patch) => {
    set((state) => commit(state, (project) => {
      const annotation = project.annotations.find((item) => item.id === id);
      if (annotation) Object.assign(annotation, patch, { id, kind: annotation.kind });
    }));
  },

  addAnnotationLink: (sourceId, targetId) => {
    let linked = false;
    set((state) => {
      const source = state.project.annotations.find((annotation) => annotation.id === sourceId && annotation.kind !== 'text');
      const targetExists = state.project.people.some((person) => person.id === targetId)
        || state.project.annotations.some((annotation) => annotation.id === targetId);
      if (!source || !targetExists || sourceId === targetId || source.linkedIds?.includes(targetId)) return state;
      linked = true;
      return commit(state, (project) => {
        const annotation = project.annotations.find((item) => item.id === sourceId);
        if (annotation) annotation.linkedIds = [...(annotation.linkedIds ?? []), targetId];
      });
    });
    return linked;
  },

  updateAnnotationLink: (sourceId, targetId, patch) => {
    set((state) => commit(state, (project) => {
      const annotation = project.annotations.find((item) => item.id === sourceId && item.linkedIds?.includes(targetId));
      if (!annotation) return;
      const current = annotation.linkAttributes?.[targetId] ?? {};
      annotation.linkAttributes = { ...(annotation.linkAttributes ?? {}), [targetId]: { ...current, ...patch } };
    }));
  },

  deleteAnnotationLink: (sourceId, targetId) => {
    set((state) => commit(state, (project) => {
      const annotation = project.annotations.find((item) => item.id === sourceId);
      if (!annotation?.linkedIds?.includes(targetId)) return;
      annotation.linkedIds = annotation.linkedIds.filter((id) => id !== targetId);
      if (annotation.linkAttributes) {
        delete annotation.linkAttributes[targetId];
        if (Object.keys(annotation.linkAttributes).length === 0) delete annotation.linkAttributes;
      }
    }));
  },

  deleteAnnotations: (ids) => {
    const chosen = new Set(ids);
    if (chosen.size === 0) return;
    set((state) => commit(
      state,
      (project) => {
        project.annotations = project.annotations.filter((annotation) => !chosen.has(annotation.id));
        project.annotations.forEach((annotation) => {
          if (annotation.linkedIds) annotation.linkedIds = annotation.linkedIds.filter((id) => !chosen.has(id));
          if (annotation.linkAttributes) {
            for (const id of chosen) delete annotation.linkAttributes[id];
            if (Object.keys(annotation.linkAttributes).length === 0) delete annotation.linkAttributes;
          }
        });
        for (const id of chosen) delete project.canvas.positions[id];
      },
      {
        selectedAnnotationIds: state.ui.selectedAnnotationIds.filter((id) => !chosen.has(id)),
        activePanel: null,
      },
    ));
  },

  addRelationship: (type, source, target, attributes = {}) => {
    let createdId: string | null = null;
    set((state) => {
      if (getRelationshipConnectionError(state.project, type, source, target)) return state;
      const id = createId('relationship');
      createdId = id;
      return commit(
        state,
        (project) => {
          project.relationships.push({ id, type, source, target, attributes: structuredClone(attributes) });
        },
        { selectedPersonIds: [], selectedRelationshipIds: [id], selectedHouseholdIds: [], selectedAnnotationIds: [] },
      );
    });
    return createdId;
  },

  updateRelationship: (id, patch) => {
    set((state) => {
      const relationship = state.project.relationships.find((item) => item.id === id);
      if (!relationship) return state;
      if (patch.type && patch.type !== relationship.type && hasDuplicateRelationship(
        state.project,
        patch.type,
        relationship.source,
        relationship.target,
        relationship.id,
      )) return state;
      return commit(state, (project) => {
        const current = project.relationships.find((item) => item.id === id);
        if (!current) return;
        if (patch.type) current.type = patch.type;
        if (patch.attributes) current.attributes = structuredClone(patch.attributes);
      });
    });
  },

  deleteRelationships: (ids) => {
    const chosen = new Set(ids);
    if (chosen.size === 0) return;
    set((state) => commit(
      state,
      (project) => {
        project.relationships = project.relationships.filter((relationship) => !chosen.has(relationship.id));
      },
      {
        selectedRelationshipIds: state.ui.selectedRelationshipIds.filter((id) => !chosen.has(id)),
      },
    ));
  },

  addTwinSibling: (childRelationshipId, type) => {
    const createdIds: string[] = [];
    set((state) => {
      const selectedRelationship = state.project.relationships.find((relationship) => relationship.id === childRelationshipId && isChildRelationship(relationship.type));
      if (!selectedRelationship) return state;
      const child = state.project.people.find((person) => person.id === selectedRelationship.target);
      const childPosition = state.project.canvas.positions[selectedRelationship.target];
      if (!child || !childPosition) return state;
      const parentRelationships = state.project.relationships.filter(
        (relationship) => isChildRelationship(relationship.type) && relationship.target === child.id,
      );
      if (parentRelationships.length === 0) return state;
      const twinId = createId('person');
      const mutate = (project: Project) => {
        project.people.push({
          ...structuredClone(child),
          id: twinId,
          name: 'Twin sibling',
          birthYear: child.birthYear,
          deathYear: child.deathYear,
          notes: '',
          isIndexPerson: false,
        });
        project.canvas.positions[twinId] = { x: childPosition.x + 176, y: childPosition.y };
        for (const relationship of parentRelationships) {
          const id = createId('relationship');
          project.relationships.push({
            ...structuredClone(relationship),
            id,
            target: twinId,
          });
          createdIds.push(id);
        }
        const twinRelationshipId = createId('relationship');
        project.relationships.push({ id: twinRelationshipId, type, source: child.id, target: twinId, attributes: {} });
        createdIds.push(twinRelationshipId);
      };
      return commit(state, mutate, {
        selectedPersonIds: [twinId],
        selectedRelationshipIds: [],
        selectedHouseholdIds: [],
        selectedAnnotationIds: [],
        activePanel: 'person',
      });
    });
    return createdIds;
  },

  moveChildToFamily: (childId, parentIds, options = {}) => {
    const createdIds: string[] = [];
    set((state) => {
      const people = personIdsIn(state.project);
      if (!people.has(childId) || parentIds.includes(childId) || parentIds.some((id) => !people.has(id))) return state;
      const incoming = state.project.relationships.filter(
        (relationship) => isChildRelationship(relationship.type) && relationship.target === childId,
      );
      const currentParents = [...new Set(incoming.map((relationship) => relationship.source))].sort();
      const nextParents = [...new Set(parentIds)].sort();
      if (nextParents.length !== 2 || currentParents.length === 2 && currentParents.every((id, index) => id === nextParents[index])) return state;

      const childType: RelationshipType = incoming[0]?.type ?? 'biological-child';
      const attributes = structuredClone(incoming[0]?.attributes ?? {});
      if (typeof options.familyOriginOffset === 'number' && Number.isFinite(options.familyOriginOffset)) {
        attributes.familyOriginOffset = options.familyOriginOffset;
      }
      const mutate = (project: Project) => {
        project.relationships = project.relationships.filter((relationship) => (
          !(isChildRelationship(relationship.type) && relationship.target === childId)
          && !(!options.preserveTwinRelationships && isTwinRelationship(relationship.type) && (relationship.source === childId || relationship.target === childId))
        ));
        createdIds.length = 0;
        parentIds.forEach((parentId) => {
          const id = createId('relationship');
          project.relationships.push({ id, type: childType, source: parentId, target: childId, attributes: structuredClone(attributes) });
          createdIds.push(id);
        });
      };

      if (!state.ui.dragSnapshot) {
        return commit(state, mutate, {
          selectedPersonIds: [childId],
          selectedRelationshipIds: [],
          selectedHouseholdIds: [],
          selectedAnnotationIds: [],
          activePanel: 'person',
        });
      }

      const project = structuredClone(state.project);
      mutate(project);
      project.updatedAt = new Date().toISOString();
      return {
        ...state,
        project,
        ui: {
          ...state.ui,
          selectedPersonIds: [childId],
          selectedRelationshipIds: [],
          selectedHouseholdIds: [],
          selectedAnnotationIds: [],
          activePanel: 'person',
        },
      };
    });
    return createdIds;
  },

  addHousehold: (memberIds, label = 'Current household') => {
    let createdId: string | null = null;
    set((state) => {
      const people = personIdsIn(state.project);
      const members = [...new Set(memberIds)].filter((id) => people.has(id));
      if (members.length === 0) return state;
      createdId = createId('household');
      return commit(
        state,
        (project) => {
          project.households.push({ id: createdId as string, label, memberIds: members });
        },
        { selectedPersonIds: [], selectedRelationshipIds: [], selectedHouseholdIds: [createdId], selectedAnnotationIds: [], activePanel: 'household' },
      );
    });
    return createdId;
  },

  updateHousehold: (id, patch) => {
    set((state) => commit(state, (project) => {
      const household = project.households.find((item) => item.id === id);
      if (!household) return;
      if (typeof patch.label === 'string') household.label = patch.label;
      if (patch.memberIds) {
        const people = personIdsIn(project);
        household.memberIds = [...new Set(patch.memberIds)].filter((memberId) => people.has(memberId));
      }
    }));
  },

  deleteHouseholds: (ids) => {
    const chosen = new Set(ids);
    if (chosen.size === 0) return;
    set((state) => commit(
      state,
      (project) => {
        project.households = project.households.filter((household) => !chosen.has(household.id));
      },
      { selectedHouseholdIds: [], activePanel: null },
    ));
  },

  setSelection: (people, relationships = [], households = [], annotations = []) => {
    set((state) => {
      const nextPeople = [...new Set(people)];
      const nextRelationships = [...new Set(relationships)];
      const nextHouseholds = [...new Set(households)];
      const nextAnnotations = [...new Set(annotations)];
      if (
        idListsEqual(state.ui.selectedPersonIds, nextPeople)
        && idListsEqual(state.ui.selectedRelationshipIds, nextRelationships)
        && idListsEqual(state.ui.selectedHouseholdIds, nextHouseholds)
        && idListsEqual(state.ui.selectedAnnotationIds, nextAnnotations)
      ) return state;
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedPersonIds: nextPeople,
          selectedRelationshipIds: nextRelationships,
          selectedHouseholdIds: nextHouseholds,
          selectedAnnotationIds: nextAnnotations,
        },
      };
    });
  },

  setActivePanel: (activePanel) => set((state) => state.ui.activePanel === activePanel ? state : ({ ...state, ui: { ...state.ui, activePanel } })),

  replaceProject: (project) => {
    const validatedProject = validateProject(project);
    set(() => ({
      project: structuredClone(validatedProject),
      ui: createInitialUi(),
      history: createInitialHistory(),
    }));
  },

  setSaveStatus: (saveStatus, saveError = null) => set((state) => ({
    ...state,
    ui: { ...state.ui, saveStatus, saveError },
  })),

  beginNodeDrag: () => set((state) => ({
    ...state,
    ui: { ...state.ui, dragSnapshot: state.ui.dragSnapshot ?? snapshotProject(state.project) },
  })),

  updateNodePositions: (updates) => set((state) => {
    const project = structuredClone(state.project);
    let changed = false;
    for (const [id, position] of Object.entries(updates)) {
      if (!project.people.some((person) => person.id === id) && !project.annotations.some((annotation) => annotation.id === id)) continue;
      const current = project.canvas.positions[id];
      if (!current || current.x !== position.x || current.y !== position.y) {
        project.canvas.positions[id] = { x: position.x, y: position.y };
        changed = true;
      }
    }
    return changed ? { ...state, project: { ...project, updatedAt: new Date().toISOString() } } : state;
  }),

  endNodeDrag: () => set((state) => {
    const before = state.ui.dragSnapshot;
    if (!before) return state;
    const after = snapshotProject(state.project);
    if (snapshotsEqual(before, after)) {
      return { ...state, ui: { ...state.ui, dragSnapshot: null } };
    }
    return {
      ...state,
      project: { ...state.project, updatedAt: new Date().toISOString() },
      ui: { ...state.ui, dragSnapshot: null },
      history: { past: [...state.history.past, before].slice(-MAX_HISTORY), future: [] },
    };
  }),

  setViewport: (viewport) => set((state) => {
    const current = state.project.canvas.viewport;
    if (current.x === viewport.x && current.y === viewport.y && current.zoom === viewport.zoom) return state;
    return {
      ...state,
      project: {
        ...state.project,
        updatedAt: new Date().toISOString(),
        canvas: { ...state.project.canvas, viewport: { ...viewport } },
      },
    };
  }),

  setPersonLabelVisibility: (key, visible) => set((state) => commit(state, (project) => {
    project.canvas.personLabelVisibility = {
      ...createDefaultPersonLabelVisibility(),
      ...project.canvas.personLabelVisibility,
      [key]: visible,
    };
  })),

  setWrapPersonLabels: (wrap) => set((state) => commit(state, (project) => {
    project.canvas.wrapPersonLabels = wrap;
  })),

  setCanvasViewVisibility: (key, visible) => set((state) => commit(state, (project) => {
    project.canvas.viewVisibility = {
      ...createDefaultCanvasViewVisibility(),
      ...project.canvas.viewVisibility,
      [key]: visible,
    };
  })),

  undo: () => set((state) => {
    const previous = state.history.past.at(-1);
    if (!previous) return state;
      const previousProject = {
      ...state.project,
      people: previous.people,
      relationships: previous.relationships,
      households: previous.households,
      annotations: previous.annotations,
    };
    return {
      ...state,
      project: projectWithSnapshot(state.project, previous),
      ui: {
        ...state.ui,
        dragSnapshot: null,
        selectedPersonIds: selectedPeopleIn(previousProject, state.ui.selectedPersonIds),
        selectedRelationshipIds: selectedRelationshipsIn(previousProject, state.ui.selectedRelationshipIds),
        selectedHouseholdIds: selectedHouseholdsIn({ ...previousProject, households: previous.households }, state.ui.selectedHouseholdIds),
        selectedAnnotationIds: selectedAnnotationsIn(previousProject, state.ui.selectedAnnotationIds),
      },
      history: {
        past: state.history.past.slice(0, -1),
        future: [snapshotProject(state.project), ...state.history.future].slice(0, MAX_HISTORY),
      },
    };
  }),

  redo: () => set((state) => {
    const next = state.history.future[0];
    if (!next) return state;
    return {
      ...state,
      project: projectWithSnapshot(state.project, next),
      ui: {
        ...state.ui,
        dragSnapshot: null,
        selectedPersonIds: selectedPeopleIn({ ...state.project, people: next.people }, state.ui.selectedPersonIds),
        selectedRelationshipIds: selectedRelationshipsIn({ ...state.project, relationships: next.relationships }, state.ui.selectedRelationshipIds),
        selectedHouseholdIds: selectedHouseholdsIn({ ...state.project, households: next.households }, state.ui.selectedHouseholdIds),
        selectedAnnotationIds: selectedAnnotationsIn({ ...state.project, annotations: next.annotations }, state.ui.selectedAnnotationIds),
      },
      history: {
        past: [...state.history.past, snapshotProject(state.project)].slice(-MAX_HISTORY),
        future: state.history.future.slice(1),
      },
    };
  }),
}));
