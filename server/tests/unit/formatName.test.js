import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatShortName } from '../../src/utils/formatName.js';

test('formatShortName matches the doc 08-09-10 §10.2 worked example', () => {
  assert.equal(formatShortName('Nusrat Jahan'), 'Nusrat J.');
});

test('formatShortName uses the last word for the initial with three or more names', () => {
  assert.equal(formatShortName('Abdul Karim Rahman'), 'Abdul R.');
});

test('formatShortName returns a single-word name unchanged', () => {
  assert.equal(formatShortName('Cher'), 'Cher');
});

test('formatShortName tolerates extra whitespace', () => {
  assert.equal(formatShortName('  Nusrat   Jahan  '), 'Nusrat J.');
});
