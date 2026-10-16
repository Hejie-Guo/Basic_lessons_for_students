const test = require('node:test');
const assert = require('node:assert/strict');

const { scoreExam } = require('../server');

const singleQuestion = {
  id: 'S1',
  type: 'single',
  points: 4,
  answer: ['B'],
};

const multipleQuestion = {
  id: 'M1',
  type: 'multiple',
  points: 8,
  answer: ['A', 'C', 'D'],
};

test('scores a single-choice answer as correct only when it matches the answer', () => {
  const correct = scoreExam([singleQuestion], { S1: ['B'] });
  const incorrect = scoreExam([singleQuestion], { S1: ['C'] });

  assert.equal(correct.totalScore, 4);
  assert.equal(correct.results[0].correct, true);
  assert.equal(incorrect.totalScore, 0);
  assert.equal(incorrect.results[0].correct, false);
});

test('scores a multiple-choice answer as correct regardless of option order', () => {
  const scored = scoreExam([multipleQuestion], { M1: ['D', 'A', 'C'] });

  assert.equal(scored.totalScore, 8);
  assert.equal(scored.results[0].correct, true);
});

test('scores multiple-choice answers as wrong when missing, extra, or incorrect options are present', () => {
  const missing = scoreExam([multipleQuestion], { M1: ['A', 'C'] });
  const extra = scoreExam([multipleQuestion], { M1: ['A', 'B', 'C', 'D'] });
  const wrong = scoreExam([multipleQuestion], { M1: ['A', 'B', 'D'] });

  assert.equal(missing.totalScore, 0);
  assert.equal(extra.totalScore, 0);
  assert.equal(wrong.totalScore, 0);
  assert.equal(missing.results[0].correct, false);
  assert.equal(extra.results[0].correct, false);
  assert.equal(wrong.results[0].correct, false);
});

test('scores a 15 single-choice and 5 multiple-choice exam as 100 points', () => {
  const questions = [
    ...Array.from({ length: 15 }, (_, index) => ({
      id: `S${index + 1}`,
      type: 'single',
      points: 4,
      answer: ['A'],
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `M${index + 1}`,
      type: 'multiple',
      points: 8,
      answer: ['A', 'B'],
    })),
  ];
  const answers = Object.fromEntries(
    questions.map((question) => [question.id, [...question.answer]])
  );

  const scored = scoreExam(questions, answers);

  assert.equal(scored.totalScore, 100);
  assert.equal(scored.maxScore, 100);
  assert.equal(scored.results.every((result) => result.correct), true);
});
