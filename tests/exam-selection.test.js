const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildExamCatalog,
  getQuestionsForExam,
  scoreExam,
} = require('../server');

const exams = [
  { id: 'reliability', title: '可靠性设计与力学仿真概述' },
  { id: 'materials', title: '耳机常见工程材料及其力学本构' },
  { id: 'exploded-view', title: '耳机结构爆炸图标注版', examEnabled: false },
];

const questions = [
  { id: 'R01', examId: 'reliability', type: 'single', difficulty: 'easy', points: 4, answer: ['A'] },
  { id: 'R02', examId: 'reliability', type: 'multiple', difficulty: 'hard', points: 8, answer: ['A', 'B'] },
  { id: 'M01', examId: 'materials', type: 'single', difficulty: 'medium', points: 4, answer: ['B'] },
];

test('builds an exam catalog with independent question counts and max scores', () => {
  const catalog = buildExamCatalog(exams, questions);

  assert.deepEqual(catalog, [
    {
      id: 'reliability',
      title: '可靠性设计与力学仿真概述',
      hasExam: true,
      questionCount: 2,
      maxScore: 12,
      typeCounts: { single: 1, multiple: 1 },
      difficultyCounts: { easy: 1, hard: 1 },
    },
    {
      id: 'materials',
      title: '耳机常见工程材料及其力学本构',
      hasExam: true,
      questionCount: 1,
      maxScore: 4,
      typeCounts: { single: 1 },
      difficultyCounts: { medium: 1 },
    },
    {
      id: 'exploded-view',
      title: '耳机结构爆炸图标注版',
      hasExam: false,
      questionCount: 0,
      maxScore: 0,
      typeCounts: {},
      difficultyCounts: {},
    },
  ]);
});

test('filters scoring questions by selected exam id', () => {
  const selected = getQuestionsForExam(questions, 'materials');
  const scored = scoreExam(selected, { M01: ['B'], R01: ['A'], R02: ['A', 'B'] });

  assert.equal(selected.length, 1);
  assert.equal(scored.maxScore, 4);
  assert.equal(scored.totalScore, 4);
  assert.equal(scored.results[0].questionId, 'M01');
});
