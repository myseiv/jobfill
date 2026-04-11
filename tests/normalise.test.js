// tests/normalise.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, lookup } from '../shared/normalise.js';

test('normalise lowercases the name', () => {
  assert.equal(normalise('ACME Corp'), 'acme');
});

test('normalise strips legal suffixes', () => {
  assert.equal(normalise('Acme Ltd'), 'acme');
  assert.equal(normalise('Acme Limited'), 'acme');
  assert.equal(normalise('Acme PLC'), 'acme');
  assert.equal(normalise('Acme LLP'), 'acme');
  assert.equal(normalise('Acme Group'), 'acme');
});

test('normalise strips punctuation', () => {
  assert.equal(normalise('Acme & Sons'), 'acme sons');
  assert.equal(normalise("O'Brien Ltd"), 'obrien');
});

test('normalise collapses whitespace', () => {
  assert.equal(normalise('Acme   Solutions  Ltd'), 'acme solutions');
});

test('lookup returns entry for exact normalised match', () => {
  const entries = { 'acme': { status: 'licensed', tier: 'Skilled Worker', route: 'Worker' } };
  const result = lookup('Acme Ltd', entries);
  assert.equal(result.status, 'licensed');
  assert.equal(result.tier, 'Skilled Worker');
});

test('lookup returns entry for fuzzy match within distance 2', () => {
  const entries = { 'acme solutions': { status: 'licensed', tier: 'Skilled Worker', route: 'Worker' } };
  const result = lookup('Acme Solutons Ltd', entries); // typo: "Solutons"
  assert.ok(result !== null);
  assert.equal(result.status, 'licensed');
});

test('lookup returns null for no match', () => {
  const entries = { 'globex': { status: 'licensed', tier: 'Skilled Worker', route: 'Worker' } };
  assert.equal(lookup('Completely Different Company', entries), null);
});
