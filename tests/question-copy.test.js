const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('question stems are written as objective exam questions without classroom wording', () => {
  const questions = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8')
  );
  const offenders = questions
    .filter((question) => /(课程|课件|讲义)/.test(question.stem))
    .map((question) => question.id);

  assert.deepEqual(offenders, []);
});
