const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluatePassStatus } = require('../server');

test('evaluates pass or fail using a 60 point passing score by default', () => {
  assert.deepEqual(evaluatePassStatus(60), {
    passingScore: 60,
    passed: true,
    passStatus: 'PASS',
  });
  assert.deepEqual(evaluatePassStatus(59), {
    passingScore: 60,
    passed: false,
    passStatus: 'FAIL',
  });
});

test('preserves recorded pass status on existing submissions', () => {
  assert.deepEqual(evaluatePassStatus({ totalScore: 92, passingScore: 60, passed: true, passStatus: 'PASS' }), {
    passingScore: 60,
    passed: true,
    passStatus: 'PASS',
  });
});
