import { useId } from 'react';
import { Coins, GraduationCap, MapPin, type LucideIcon } from 'lucide-react';

import {
  createDefaultCanvasViewVisibility,
  SYMBOL_KIND_LABELS,
  type CanvasViewVisibility,
  type CulturalHeritagePattern,
  type Gender,
  type Person,
  type SymbolKind,
} from '../lib/genogram/model';
import { countryFlag } from '../lib/countries';

export interface PersonSymbolProps {
  person: Person;
  size?: number;
  showAnnotations?: boolean;
  showProfileBadges?: boolean;
  viewVisibility?: Partial<CanvasViewVisibility>;
  className?: string;
}

const INK = 'var(--symbol-ink, #1d2f3a)';
const PAPER = 'var(--symbol-paper, #fbfdfa)';
const BADGE_INK = '#111111';
const HERITAGE_INK = '#000000';

function isValidYear(value: number | null): value is number {
  return value !== null && Number.isInteger(value);
}

function isValidMonth(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 12;
}

function isValidDay(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 31;
}

/**
 * Converts String/Number-Wert in number | null.
 */
function parseNumericField(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * Trys to build a save date-object.
 * month and day starts with 1
 * returns null, if date is invalid or does not exists 30th of feburary
 */
function tryMakeDate(year: number | null, month: number | null, day?: number | null): Date | null {
  if (!isValidYear(year) || !isValidMonth(month)) {
    return null;
  }

  if (day !== undefined && day !== null && !isValidDay(day)) {
    return null;
  }

  const m = month - 1; // JS: 0-based
  const d = day ?? 1;

  const date = new Date(year, m, d);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== m ||
    (day !== undefined && day !== null && date.getDate() !== d)
  ) {
    return null;
  }

  return date;
}

/**
 * Calculates the age in years between two given dates
 * birthdate <= referenceDate
 */
function calculateAge(birthdate: Date, referenceDate: Date): number {
  if (!birthdate || !referenceDate) {
    throw new Error('Invalid dates given to calculateAge()');
  }
  let age = referenceDate.getFullYear() - birthdate.getFullYear();

  const birthMonth = birthdate.getMonth();
  const birthDay = birthdate.getDate();

  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age -= 1;
  }

  return age;
}

/**
 * Calculates a person's age in years based on available birth and death data.
 *
 * - Returns null if the birth year is missing or invalid.
 * - If a valid death year exists:
 *   - Returns null if deathYear < birthYear.
 *   - Returns 0 if deathYear === birthYear.
 *   - Otherwise, computes the age at death using the most specific available
 *     date information (year + month + day, year + month, or year only).
 * - If the person is marked as deceased but has no valid death year, returns null.
 * - If the person is alive (no valid death year and not deceased):
 *   - Computes the current age using today's date and the most specific
 *     available birth date information (year + month + day, year + month, or year only).
 *
 * Invalid or inconsistent dates (e.g., impossible days like 31.02.) are treated
 * as missing, causing the function to fall back to less specific calculations
 * or to return null.
 */
export function getDerivedAge(person: Person): number | null {
  // 1) birth year have to be valid
  if (!isValidYear(person.birthYear)) {
    return null;
  }

  // 2) death year exists an is valid
  if (isValidYear(person.deathYear)) {
    if (person.deathYear < person.birthYear) {
      return null;
    }
    if (person.deathYear === person.birthYear) {
      return 0;
    }

    const profile = person.profile;
    if (!profile) {

      const birthMonth = parseNumericField(person.profile?.birthMonth);
      const birthDay   = parseNumericField(person.profile?.birthDay);
      const deathMonth = parseNumericField(person.profile?.deathMonth);
      const deathDay   = parseNumericField(person.profile?.deathDay);

      const bMonthValid : boolean = isValidMonth(birthMonth);
      const dMonthValid : boolean = isValidMonth(deathMonth);
      const bDayValid   : boolean = isValidDay(birthDay);
      const dDayValid   : boolean = isValidDay(deathDay);

      // 2a) year + month + day for birth and death
      if (bMonthValid && dMonthValid && bDayValid && dDayValid) {
        const birthdate = tryMakeDate(person.birthYear, birthMonth, birthDay);
        const deathdate = tryMakeDate(person.deathYear, deathMonth, deathDay);
        if (birthdate && deathdate) {
          return calculateAge(birthdate, deathdate);
        }
      }

      // 2b) year + month (no day) for birth and death
      if (bMonthValid && dMonthValid) {
        const birthdate = tryMakeDate(person.birthYear, birthMonth);
        const deathdate = tryMakeDate(person.deathYear, deathMonth);
        if (birthdate && deathdate) {
          return calculateAge(birthdate, deathdate);
        }
      }
    }
    // 2c) only years
    return person.deathYear - person.birthYear;
  }

  // 3) person is marked as dead, but deathyear is unknown -> no age
  if (person.deceased) {
    return null;
  }

  // 4) Living person: age until today
  const today = new Date();

  const profile = person.profile;
  if (!profile) {
    const birthMonth  = parseNumericField(person.profile?.birthMonth);
    const birthDay    = parseNumericField(person.profile?.birthDay);

    const bMonthValid = isValidMonth(birthMonth);
    const bDayValid   = isValidDay(birthDay);

    // 4a) year + month + day
    if (bMonthValid && bDayValid) {
      const birthdate = tryMakeDate(person.birthYear, birthMonth, birthDay);
      if (birthdate) {
        return calculateAge(birthdate, today);
      }
    }

    // 4b) year + month
    if (bMonthValid) {
      const birthdate = tryMakeDate(person.birthYear, birthMonth);
      if (birthdate) {
        return calculateAge(birthdate, today);
      }
    }
  }
  // 4c) only year
  const currentYear = today.getFullYear();
  if (currentYear < person.birthYear) {
    return null;
  }
  return currentYear - person.birthYear;
}

function personShapeKind(person: Person): SymbolKind | Gender {
  if (person.symbolKind !== 'person' && person.symbolKind !== 'stillbirth') return person.symbolKind;
  return person.gender;
}

function renderShape(
  kind: SymbolKind | Gender,
  props: { fill: string; stroke: string; strokeWidth?: number },
  stillbirth = false,
) {
  const strokeWidth = props.strokeWidth ?? 2.4;
  const circularGender = kind === 'female' || kind === 'trans-female' || kind === 'intersex';
  const diamondGender = kind === 'unspecified' || kind === 'other';
  if (kind === 'pregnancy') {
    return <polygon points="56,36 78,80 34,80" {...props} strokeWidth={strokeWidth} />;
  }
  if (kind === 'miscarriage') {
    return <circle cx="56" cy="58" r="10" {...props} fill={INK} stroke={INK} strokeWidth={strokeWidth} />;
  }
  if (kind === 'termination') return null;
  if (stillbirth) {
    if (circularGender) return <circle cx="56" cy="58" r="22" {...props} strokeWidth={strokeWidth} />;
    if (diamondGender) return <polygon points="56,34 80,58 56,82 32,58" {...props} strokeWidth={strokeWidth} />;
    if (kind === 'nonbinary') return <path d="M 36 56 A 22 22 0 0 1 58 34 A 22 22 0 0 1 80 56 V 78 H 36 Z" {...props} strokeWidth={strokeWidth} />;
    return <rect x="34" y="36" width="44" height="44" {...props} strokeWidth={strokeWidth} />;
  }
  if (circularGender) return <circle cx="56" cy="58" r="28" {...props} strokeWidth={strokeWidth} />;
  if (diamondGender) return <polygon points="56,28 86,58 56,88 26,58" {...props} strokeWidth={strokeWidth} />;
  if (kind === 'nonbinary') return <path d="M 30 56 A 28 28 0 0 1 58 28 A 28 28 0 0 1 86 56 V 84 H 30 Z" {...props} strokeWidth={strokeWidth} />;
  return <rect x="28" y="30" width="56" height="56" {...props} strokeWidth={strokeWidth} />;
}

function renderGenderDetail(kind: SymbolKind | Gender, stillbirth = false) {
  const strokeWidth = 2.4;
  if (stillbirth) {
    if (kind === 'trans-male') return <circle cx="56" cy="58" r="22" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
    if (kind === 'trans-female') return <rect x="41" y="43" width="30" height="29" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
    if (kind === 'intersex') return <line x1="56" y1="36" x2="56" y2="80" stroke={INK} strokeWidth={strokeWidth+2} vectorEffect="scaling-stroke" />;
    if (kind === 'other') return <><circle cx="56" cy="58" r="17" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" /><line x1="44" y1="72" x2="68" y2="46" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" /></>;
  }
  if (kind === 'trans-male') return <circle cx="56" cy="58" r="28" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
  if (kind === 'trans-female') return <rect x="36.5" y="38.5" width="39" height="38" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
  if (kind === 'intersex') return <line x1="56" y1="30" x2="56" y2="86" stroke={INK} strokeWidth={strokeWidth+2} vectorEffect="scaling-stroke" />;
  if (kind === 'other') return <><circle cx="56" cy="58" r="21" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" /><line x1="41" y1="73" x2="71" y2="43" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" /></>;
  return null;
}

function renderSexualOrientationMark(orientation: string) {
  const normalizedOrientation = orientation.trim().toLowerCase();
  if (!normalizedOrientation || normalizedOrientation === 'heterosexual' || normalizedOrientation === 'prefer not to say') return null;

  const markProps = {
    fill: 'none',
    stroke: INK,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  const showDot = normalizedOrientation === 'asexual';
  const showQuestion = normalizedOrientation === 'unknown' || normalizedOrientation === 'questioning' || normalizedOrientation === 'other';

  return (
    <>
      <path d="M 47 69 L 65 69 L 56 84 Z" {...markProps} />
      {showDot && <circle cx="56" cy="75" r="2.2" fill={INK} />}
      {showQuestion && <text x="56" y="78" textAnchor="middle" fontSize="9" fontWeight="800" fill={INK}>?</text>}
    </>
  );
}

function renderIndexOutline(kind: SymbolKind | Gender, stillbirth = false) {
  const strokeWidth = 2.4;
  const circularGender = kind === 'female' || kind === 'trans-female' || kind === 'intersex';
  const diamondGender = kind === 'unspecified' || kind === 'other';
  if (kind === 'pregnancy' || kind === 'miscarriage' || kind === 'termination') {
    return <circle cx="56" cy="58" r="35" fill="none" stroke={INK} strokeWidth={strokeWidth} strokeDasharray="2 2" vectorEffect="scaling-stroke" />;
  }
  if (stillbirth) {
    if (circularGender) return <circle cx="56" cy="58" r="30" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
    if (diamondGender) return <polygon points="56,25 89,58 56,91 23,58" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
    if (kind === 'nonbinary') return <path d="M 30 56 A 28 28 0 0 1 58 28 A 28 28 0 0 1 86 56 V 84 H 30 Z" fill="none" stroke={INK} strokeWidth={strokeWidth} />;
    return <rect x="25" y="27" width="62" height="62" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
  }
  if (circularGender) return <circle cx="56" cy="58" r="35" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
  if (diamondGender) return <polygon points="56,21 93,58 56,95 19,58" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
  if (kind === 'nonbinary') return <path d="M 24 56 A 32 32 0 0 1 58 22 A 32 32 0 0 1 92 56 V 90 H 24 Z" fill="none" stroke={INK} strokeWidth={strokeWidth} />;
  return <rect x="22" y="24" width="68" height="68" fill="none" stroke={INK} strokeWidth={strokeWidth} vectorEffect="scaling-stroke" />;
}

function sectorPoint(angle: number, radius = 58) {
  const radians = angle * Math.PI / 180;
  return { x: 56 + Math.cos(radians) * radius, y: 58 + Math.sin(radians) * radius };
}

function markerSector(index: number, total: number) {
  const startAngle = -90 + (index * 360) / total;
  const endAngle = -90 + ((index + 1) * 360) / total;
  const start = sectorPoint(startAngle);
  const end = sectorPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M 56 58 L ${start.x.toFixed(3)} ${start.y.toFixed(3)} A 58 58 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)} Z`;
}

function markerOpacity(status: Person['medicalMarkers'][number]['status']) {
  if (status === 'recovery') return 0.62;
  if (status === 'suspected') return 0.34;
  return 1;
}

const continuousPatternOffsets = Array.from({ length: 21 }, (_, index) => -112 + index * 12);
const continuousWaveRows = Array.from({ length: 11 }, (_, index) => -4 + index * 12);

function continuousWavePath(y: number) {
  return `M-16 ${y} Q-8 ${y - 5} 0 ${y} T16 ${y} T32 ${y} T48 ${y} T64 ${y} T80 ${y} T96 ${y} T112 ${y} T128 ${y}`;
}

function renderHeritagePattern(id: string, pattern: CulturalHeritagePattern) {
  const lineProps = { fill: 'none', stroke: HERITAGE_INK, strokeWidth: 2 } as const;
  if (pattern === 'horizontal') return <pattern key={id} id={id} width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 3.5H14M0 10.5H14" {...lineProps} /></pattern>;
  if (pattern === 'vertical') return <pattern key={id} id={id} width="14" height="14" patternUnits="userSpaceOnUse"><path d="M3.5 0V14M10.5 0V14" {...lineProps} /></pattern>;
  if (pattern === 'diagonal-right') return <pattern key={id} id={id} width="112" height="112" patternUnits="userSpaceOnUse">{continuousPatternOffsets.map((offset) => <line key={offset} x1={offset} y1="112" x2={offset + 112} y2="0" {...lineProps} />)}</pattern>;
  if (pattern === 'diagonal-left') return <pattern key={id} id={id} width="112" height="112" patternUnits="userSpaceOnUse">{continuousPatternOffsets.map((offset) => <line key={offset} x1={offset} y1="0" x2={offset + 112} y2="112" {...lineProps} />)}</pattern>;
  if (pattern === 'grid') return <pattern key={id} id={id} width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 3.5H14M0 10.5H14M3.5 0V14M10.5 0V14" {...lineProps} /></pattern>;
  if (pattern === 'dots') return <pattern key={id} id={id} width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.6" fill={HERITAGE_INK} /><circle cx="10.5" cy="10.5" r="1.6" fill={HERITAGE_INK} /></pattern>;
  if (pattern === 'waves') return <pattern key={id} id={id} width="112" height="112" patternUnits="userSpaceOnUse">{continuousWaveRows.map((row) => <path key={row} d={continuousWavePath(row)} {...lineProps} />)}</pattern>;
  if (pattern === 'woven') return <pattern key={id} id={id} width="14" height="14" patternUnits="userSpaceOnUse"><path d="M3.5-2C3.5 2.5 10.5 4.5 10.5 7S3.5 11.5 3.5 16M10.5-2C10.5 2.5 3.5 4.5 3.5 7s7 4.5 7 9" {...lineProps} /></pattern>;
  return <pattern key={id} id={id} width="12" height="12" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={HERITAGE_INK} /><rect x="6" y="6" width="6" height="6" fill={HERITAGE_INK} /></pattern>;
}

export function ReligionIcon({ religion, size = 18, x, y, color = 'currentColor' }: { religion: string; size?: number; x?: number; y?: number; color?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let mark;
  if (religion === 'Christian') mark = <path d="M12 4v16M8 8h8" {...common} />;
  else if (religion === 'Catholic') mark = <><path d="M12 4v16M8 8h8" {...common} /><circle cx="12" cy="4" r="2" {...common} /></>;
  else if (religion === 'Orthodox') mark = <path d="M12 2v20M8.5 5.5h7M5 9.5h14M8 18.5l8-3" {...common} strokeWidth="1.8" />;
  else if (religion === 'Mormon') mark = <text x="12" y="16" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor">M</text>;
  else if (religion === "Jehovah's Witness") mark = <text x="12" y="16" textAnchor="middle" fontSize="14" fontWeight="bold" fill="currentColor">JW</text>;
  else if (religion === 'Jewish') mark = <><path d="M12 2.5 20.2 16.75H3.8Z" {...common} strokeWidth="1.6" /><path d="M12 21.5 3.8 7.25h16.4Z" {...common} strokeWidth="1.6" /></>;
  else if (religion === 'Islam') mark = <><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" {...common} /><path d="M19 3v4M21 5h-4" {...common} /></>;
  else if (religion === 'Buddhist') mark = <><circle cx="12" cy="12" r="9" {...common} strokeWidth="1.5" /><circle cx="12" cy="12" r="3" {...common} strokeWidth="1.5" /><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.3 4.3M14.1 14.1l4.3 4.3M5.6 18.4l4.3-4.3M14.1 9.9l4.3-4.3" {...common} strokeWidth="1.5" /></>;
  else if (religion === 'Hindu') mark = <text x="12" y="17" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor">ॐ</text>;
  else if (religion === 'Sikh') mark = <text x="12" y="17" textAnchor="middle" fontSize="18" fill="currentColor">☬</text>;
  else if (religion === 'Spiritual') mark = <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" {...common} /><path d="M5 3v4M19 17v4M3 5h4M17 19h4" {...common} /></>;
  else if (religion === 'None') mark = <path d="M5 12h14" {...common} />;
  else mark = <><circle cx="12" cy="12" r="10" {...common} /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" {...common} /></>;
  return <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" color={color} aria-hidden="true">{mark}</svg>;
}

function ProfileBadge({ x, y, label, Icon }: { x: number; y: number; label: string; Icon: LucideIcon }) {
  return (
    <g aria-label={label} data-profile-badge={label}>
      <circle cx={x} cy={y} r="10.5" fill={PAPER} stroke="#d7e3df" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <Icon x={x - 7.15} y={y - 7.15} width="14.3" height="14.3" color={BADGE_INK} strokeWidth={2.1} aria-hidden="true" />
    </g>
  );
}

function ReligionBadge({ x, y, religion }: { x: number; y: number; religion: string }) {
  return (
    <g aria-label={`Religion: ${religion}`} data-profile-badge={`Religion: ${religion}`}>
      <circle cx={x} cy={y} r="10.5" fill={PAPER} stroke="#d7e3df" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <ReligionIcon religion={religion} x={x - 7.15} y={y - 7.15} size={14.3} color={BADGE_INK} />
    </g>
  );
}

function CountryFlagBadge({ x, y, label, countryCode }: { x: number; y: number; label: string; countryCode: string }) {
  return (
    <g aria-label={label} data-profile-badge={label}>
      <circle cx={x} cy={y} r="10.5" fill={PAPER} stroke="#d7e3df" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontFamily="'Apple Color Emoji', 'Segoe UI Emoji', sans-serif" fontSize="14.3" aria-hidden="true">{countryFlag(countryCode)}</text>
    </g>
  );
}

export function PersonSymbol({ person, size = 82, showAnnotations = false, showProfileBadges = false, viewVisibility, className }: PersonSymbolProps) {
  const clipId = `person-symbol-clip-${useId().replace(/:/g, '')}`;
  const kind = personShapeKind(person);
  const isStillbirth = person.symbolKind === 'stillbirth';
  const views = viewVisibility
    ? { ...createDefaultCanvasViewVisibility(), ...viewVisibility }
    : {
        ...createDefaultCanvasViewVisibility(),
        medical: person.visualSettings?.showMedical !== false,
        cultural: person.visualSettings?.showCulturalHeritage !== false,
        religion: person.visualSettings?.showReligion !== false,
        social: person.visualSettings?.showSocialClass !== false,
        education: person.visualSettings?.showEducation !== false,
        location: person.visualSettings?.showLocation !== false,
      };
  const supportsMarkers = person.symbolKind === 'person' && views.medical && person.medicalMarkers.length > 0;
  const heritageLayers = person.culturalHeritageLayers ?? [];
  const supportsHeritage = person.symbolKind === 'person' && views.cultural && heritageLayers.length > 0;
  const hasVisualFill = supportsMarkers || supportsHeritage;
  const profile = person.profile;
  const religion = showProfileBadges && views.religion ? profile?.religion.trim() : '';
  const socialClass = showProfileBadges && views.social ? profile?.socialClass.trim() : '';
  const education = showProfileBadges && views.education ? profile?.education.trim() : '';
  const location = showProfileBadges && views.location ? profile?.location.trim() : '';
  const countryCode = showProfileBadges && views.location ? profile?.countryCode.trim().toUpperCase() : '';
  const symbolFill = person.visualSettings?.showColor !== false && person.visualSettings?.color
    ? person.visualSettings.color
    : PAPER;
  const age = showAnnotations ? getDerivedAge(person) : null;
  const symbolLabel = SYMBOL_KIND_LABELS[person.symbolKind];
  const name = person.name || symbolLabel;
  const showDeceasedMark = person.symbolKind === 'person' && person.deceased;
  const showStillbirthMark = isStillbirth;
  const sexualOrientation = person.symbolKind === 'person' ? profile?.sexualOrientation?.trim() ?? '' : '';
  const sexualOrientationMark = renderSexualOrientationMark(sexualOrientation);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 112 112"
      role="img"
      aria-label={`${name}, ${symbolLabel}${sexualOrientation ? `, ${sexualOrientation}` : ''}${person.deceased ? ', deceased' : ''}`}
      data-symbol-kind={person.symbolKind}
      data-index-person={person.isIndexPerson ? 'true' : 'false'}
      data-sexual-orientation={sexualOrientation}
      data-medical-marker-count={supportsMarkers ? person.medicalMarkers.length : 0}
      data-heritage-layer-count={supportsHeritage ? heritageLayers.length : 0}
    >
      {(supportsMarkers || supportsHeritage) && (
        <defs>
          <clipPath id={clipId}>{renderShape(kind, { fill: '#000', stroke: 'none', strokeWidth: 0 })}</clipPath>
          {supportsHeritage && heritageLayers.map((layer, index) => renderHeritagePattern(`${clipId}-heritage-${index}`, layer.pattern))}
        </defs>
      )}
      {renderShape(kind, { fill: symbolFill, stroke: 'none', strokeWidth: 0 })}
      {supportsMarkers && (
        <g clipPath={`url(#${clipId})`} aria-label="Medical markers">
          {person.medicalMarkers.length === 1
            ? <rect x="0" y="0" width="112" height="112" fill={person.medicalMarkers[0].color} fillOpacity={markerOpacity(person.medicalMarkers[0].status)} data-medical-marker={person.medicalMarkers[0].label} data-medical-status={person.medicalMarkers[0].status ?? 'active'} />
            : person.medicalMarkers.map((marker, index) => <path key={marker.id} d={markerSector(index, person.medicalMarkers.length)} fill={marker.color} fillOpacity={markerOpacity(marker.status)} data-medical-marker={marker.label} data-medical-status={marker.status ?? 'active'} />)}
        </g>
      )}
      {supportsHeritage && (
        <g clipPath={`url(#${clipId})`} aria-label="Cultural heritage layers">
          <g>
            {heritageLayers.length === 1
              ? <rect x="0" y="0" width="112" height="112" fill={`url(#${clipId}-heritage-0)`} data-heritage-layer={heritageLayers[0].label || heritageLayers[0].pattern} />
              : heritageLayers.map((layer, index) => <path key={layer.id} d={markerSector(index, heritageLayers.length)} fill={`url(#${clipId}-heritage-${index})`} data-heritage-layer={layer.label || layer.pattern} />)}
          </g>
          {heritageLayers.length > 1 && heritageLayers.map((layer, index) => {
            const endpoint = sectorPoint(-90 + (index * 360) / heritageLayers.length);
            return (
              <line
                key={`divider-${layer.id}`}
                x1="56"
                y1="58"
                x2={endpoint.x}
                y2={endpoint.y}
                stroke={HERITAGE_INK}
                strokeWidth="1.6"
                strokeLinecap="square"
                vectorEffect="non-scaling-stroke"
                data-heritage-divider="true"
              />
            );
          })}
        </g>
      )}
      {renderShape(kind, { fill: 'none', stroke: INK })}
      {person.symbolKind === 'person' && renderGenderDetail(kind, isStillbirth)}
      {person.symbolKind === 'person' && sexualOrientationMark && (
        <g aria-label={`Sexual orientation: ${sexualOrientation}`} data-sexual-orientation-mark={sexualOrientation}>
          {sexualOrientationMark}
        </g>
      )}
      {person.isIndexPerson && renderIndexOutline(kind, isStillbirth)}
      {(showDeceasedMark || showStillbirthMark) && (
        <g aria-label="Deceased mark" stroke={INK} strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <line x1="26" y1="28" x2="86" y2="88" />
          <line x1="86" y1="28" x2="26" y2="88" />
        </g>
      )}
      {person.symbolKind === 'termination' && (
        <g aria-label="Termination mark" stroke={INK} strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <line x1="56" y1="24" x2="56" y2="38" />
          <line x1="39" y1="41" x2="73" y2="75" />
          <line x1="73" y1="41" x2="39" y2="75" />
        </g>
      )}
      {showAnnotations && (
        <g className="person-symbol-annotations" fill={INK} fontFamily="inherit" fontWeight="500">
          {age !== null && <text x="56" y="66" textAnchor="middle" fontSize="25" fontWeight="800" fill={hasVisualFill ? PAPER : INK} stroke={hasVisualFill ? INK : PAPER} strokeWidth="3" paintOrder="stroke">{age}</text>}
        </g>
      )}
      {person.symbolKind === 'person' && religion && <ReligionBadge x={24} y={28} religion={religion} />}
      {person.symbolKind === 'person' && location && (countryCode ? <CountryFlagBadge x={88} y={28} label={`Location: ${location}`} countryCode={countryCode} /> : <ProfileBadge x={88} y={28} label={`Location: ${location}`} Icon={MapPin} />)}
      {person.symbolKind === 'person' && socialClass && <ProfileBadge x={24} y={88} label={`Social class: ${socialClass}`} Icon={Coins} />}
      {person.symbolKind === 'person' && education && <ProfileBadge x={88} y={88} label={`Education: ${education}`} Icon={GraduationCap} />}
    </svg>
  );
}
