'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'dist', 'cli.js');
const NODE = process.execPath;

function run(args, opts = {}) {
  return execFileSync(NODE, [CLI, ...args], { encoding: 'utf8', ...opts });
}

test('version prints a semver string', () => {
  const out = run(['version']).trim();
  assert.match(out, /^\d+\.\d+\.\d+$/);
});

test('--help exits 0 and mentions core commands', () => {
  const out = run(['--help']);
  assert.ok(out.includes('planui setup'));
  assert.ok(out.includes('planui render'));
  assert.ok(out.includes('planui check-update'));
});

test('unknown command exits non-zero', () => {
  assert.throws(
    () => run(['not-a-real-command']),
    (err) => {
      assert.ok(err.status !== 0);
      return true;
    }
  );
});
