/**
 * Tests for getDerivedAge using node:test and node:assert/strict
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getDerivedAge } from '../../app/components/PersonSymbol';

function makePerson(
  birthYear: number | null,
  deathYear: number | null,
  deceased: boolean,
  profile: {
    birthMonth?: string | number | null;
    birthDay?: string | number | null;
    deathMonth?: string | number | null;
    deathDay?: string | number | null;
  } = {}
): Person {
  return {
    id: "person-test",
    name: "Test Person",
    gender: "female",
    birthYear,
    deathYear,
    deceased,
    profile,
  };
}

test('getDerivedAge: returns null if birthYear is null', () => {
  const p = makePerson(null, null, false);
  assert.strictEqual(getDerivedAge(p), null);
});

test('getDerivedAge: returns null if birthYear is invalid (non-integer)', () => {
  // In our types birthYear is number | null, but isValidYear only accepts integers.
  const p = makePerson(202.5 as unknown as number, null, false);
  assert.strictEqual(getDerivedAge(p), null);
});

test('getDerivedAge: living person with only birth year', () => {
  const p = makePerson(1990, null, false);
  const age = getDerivedAge(p);
  assert.ok(typeof age === 'number' && age >= 0);

  const currentYear = new Date().getFullYear();
  assert.strictEqual(age, currentYear - 1990);
});

test('getDerivedAge: living person with birth year and month', () => {
  // Born 1990-06, no day
  const p = makePerson(1990, null, false, {
    birthMonth: 6,
  });
  const age = getDerivedAge(p);

  const today = new Date();
  // June is monthIndex 5 (0-based)
  const expected =
    today.getFullYear() -
    1990 -
    (today.getMonth() < 5 ? 1 : 0);

  assert.strictEqual(age, expected);
});

test('getDerivedAge: living person with full birth date', () => {
  // Born 1990-06-15
  const p = makePerson(1990, null, false, {
    birthMonth: 6,
    birthDay: 15,
  });
  const age = getDerivedAge(p);

  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), 5, 15);
  const expected =
    today.getFullYear() -
    1990 -
    (today < birthdayThisYear ? 1 : 0);

  assert.strictEqual(age, expected);
});

test('getDerivedAge: deceased with only years', () => {
  // Born 1950, died 2020
  const p = makePerson(1950, 2020, true);
  assert.strictEqual(getDerivedAge(p), 70);
});

test('getDerivedAge: deceased with same birth and death year', () => {
  const p = makePerson(2000, 2000, true);
  assert.strictEqual(getDerivedAge(p), 0);
});

test('getDerivedAge: deceased with deathYear < birthYear', () => {
  const p = makePerson(2000, 1990, true);
  assert.strictEqual(getDerivedAge(p), null);
});

test('getDerivedAge: deceased with year and month only', () => {
  // Born 1990-06, died 2020-03
  const p = makePerson(1990, 2020, true, {
    birthMonth: 6,
    deathMonth: 3,
  });
  // Birthday in June not reached by March → age = 2020 - 1990 - 1 = 29
  assert.strictEqual(getDerivedAge(p), 29);
});

test('getDerivedAge: deceased with full dates, birthday already passed', () => {
  // Born 1990-06-15, died 2020-07-01
  const p = makePerson(1990, 2020, true, {
    birthMonth: 6,
    birthDay: 15,
    deathMonth: 7,
    deathDay: 1,
  });
  // Birthday in 2020 already passed → age = 30
  assert.strictEqual(getDerivedAge(p), 30);
});

test('getDerivedAge: deceased with full dates, birthday not yet passed', () => {
  // Born 1990-06-15, died 2020-05-01
  const p = makePerson(1990, 2020, true, {
    birthMonth: 6,
    birthDay: 15,
    deathMonth: 5,
    deathDay: 1,
  });
  // Birthday in 2020 not yet reached → age = 29
  assert.strictEqual(getDerivedAge(p), 29);
});

test('getDerivedAge: deceased but no valid death year → null', () => {
  const p = makePerson(1990, null, true);
  assert.strictEqual(getDerivedAge(p), null);
});

test('getDerivedAge: invalid day (31.02.) leads to fallback', () => {
  // Born 1990-02-31 (invalid), but month is valid
  const p = makePerson(1990, null, false, {
    birthMonth: 2,
    birthDay: 31,
  });
  // Should fall back to year+month logic, not crash
  const age = getDerivedAge(p);
  assert.ok(typeof age === 'number' && age >= 0);
});

test('getDerivedAge: string months and days are parsed correctly', () => {
  // Born 1990-06-15 as strings
  const p = makePerson(1990, null, false, {
    birthMonth: '6',
    birthDay: '15',
  });
  const age = getDerivedAge(p);

  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), 5, 15);
  const expected =
    today.getFullYear() -
    1990 -
    (today < birthdayThisYear ? 1 : 0);

  assert.strictEqual(age, expected);
});

test('getDerivedAge: null month and day treated as missing', () => {
  const p = makePerson(1990, null, false, {
    birthMonth: null,
    birthDay: null,
  });
  const age = getDerivedAge(p);
  const currentYear = new Date().getFullYear();
  assert.strictEqual(age, currentYear - 1990);
});