const examTitle = document.querySelector('#exam-title');
const examSummary = document.querySelector('#exam-summary');
const examPicker = document.querySelector('#exam-picker');
const examForm = document.querySelector('#exam-form');
const materialPanel = document.querySelector('#course-material');
const questionList = document.querySelector('#question-list');
const formStatus = document.querySelector('#form-status');
const submitButton = document.querySelector('#submit-button');
const resultPanel = document.querySelector('#result-panel');

const SUBMISSION_KEY = 'campusLearningSubmissions';
const materialsByExamId = {
  reliability: [
    { title: '可靠性设计与力学仿真概述.pdf', url: '/assets/materials/reliability.pdf', type: 'pdf' },
  ],
  materials: [
    { title: '耳机常见工程材料及其力学本构.pdf', url: '/assets/materials/materials.pdf', type: 'pdf' },
  ],
  'assembly-process-simulation': [
    { title: '耳机常见装配工艺及仿真方法_20260522.pdf', url: '/assets/materials/assembly-process-simulation.pdf', type: 'pdf' },
  ],
  'simulation-modeling': [
    { title: '仿真模型搭建.pdf', url: '/assets/materials/simulation-modeling.pdf', type: 'pdf' },
  ],
  'abaqus-postprocessing': [
    { title: '基于ABAQUS的仿真结果后处理及分析_20260428.pdf', url: '/assets/materials/abaqus-postprocessing.pdf', type: 'pdf' },
  ],
  'mesh-preprocessing': [
    { title: '仿真模型网格前处理SOP_202606.pdf', url: '/assets/materials/mesh-preprocessing.pdf', type: 'pdf' },
  ],
  'exploded-view': [
    { title: '耳机结构爆炸图.pdf', url: '/assets/materials/exploded-view.pdf', type: 'pdf' },
  ],
  'simulation-review-report': [
    { title: '韶音校招生课程_主题式仿真结果评审汇报.pdf', url: '/assets/materials/simulation-review-report.pdf', type: 'pdf' },
  ],
};

const difficultyLabel = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

let config = null;
let courseCatalog = [];
let questions = [];
let exam = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('课程数据加载失败');
  return response.json();
}

function normalizeAnswer(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function sameAnswerSet(expected, actual) {
  const expectedSet = [...new Set(normalizeAnswer(expected))].sort();
  const actualSet = [...new Set(normalizeAnswer(actual))].sort();
  return (
    expectedSet.length === actualSet.length &&
    expectedSet.every((value, index) => value === actualSet[index])
  );
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function getQuestionsForExam(examId) {
  return questions.filter((question) => question.examId === examId);
}

function canTakeExam(item, examQuestions) {
  return item?.examEnabled !== false && examQuestions.length > 0;
}

function sanitizeQuestion(question) {
  const { answer, ...safeQuestion } = question;
  return safeQuestion;
}

function scoreExam(examQuestions, answers = {}) {
  const scoring = config.scoring || {};
  const results = examQuestions.map((question) => {
    const submittedAnswer = normalizeAnswer(answers[question.id]);
    const correctAnswer = normalizeAnswer(question.answer);
    const points =
      typeof question.points === 'number'
        ? question.points
        : Number(scoring[question.type] || 0);
    const correct =
      question.type === 'single'
        ? submittedAnswer.length === 1 && submittedAnswer[0] === correctAnswer[0]
        : sameAnswerSet(correctAnswer, submittedAnswer);

    return {
      questionId: question.id,
      type: question.type,
      points,
      score: correct ? points : 0,
      correct,
      submittedAnswer,
      correctAnswer,
    };
  });

  return {
    totalScore: results.reduce((sum, result) => sum + result.score, 0),
    maxScore: results.reduce((sum, result) => sum + result.points, 0),
    correctCount: results.filter((result) => result.correct).length,
    results,
  };
}

function getPassOutcome(totalScore) {
  const passingScore = Number(config.passingScore || 60);
  const passed = totalScore >= passingScore;
  return {
    passingScore,
    passed,
    passStatus: passed ? 'PASS' : 'FAIL',
  };
}

function loadStoredSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(SUBMISSION_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredSubmissions(submissions) {
  localStorage.setItem(SUBMISSION_KEY, JSON.stringify(submissions));
}

function buildCatalog(exams) {
  return exams.map((item) => {
    const examQuestions = getQuestionsForExam(item.id);
    const materials = materialsByExamId[item.id] || [];
    const primaryMaterial = materials[0] || {};
    const hasExam = canTakeExam(item, examQuestions);
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      coverImage: item.coverImage,
      hasExam,
      materialTitle: primaryMaterial.title || item.materialTitle,
      materialUrl: primaryMaterial.url,
      materialType: primaryMaterial.type,
      previewUrl: primaryMaterial.previewUrl,
      previewType: primaryMaterial.previewType,
      materialCount: materials.length || (item.materialTitle ? 1 : 0),
      materials,
      questionCount: examQuestions.length,
      maxScore: examQuestions.reduce((sum, question) => sum + Number(question.points || 0), 0),
      typeCounts: countBy(examQuestions, 'type'),
      difficultyCounts: countBy(examQuestions, 'difficulty'),
    };
  });
}

function renderExamCard(item) {
  const cover = item.coverImage
    ? `<img class="course-cover" src="${escapeHtml(item.coverImage)}" alt="${escapeHtml(item.title)}封面图" loading="lazy" />`
    : '';
  const stats = item.hasExam
    ? `
        <span>材料 ${item.materialCount || 1} 份</span>
        <span>${item.questionCount} 题</span>
        <span>${item.maxScore} 分</span>
        <span>单选 ${item.typeCounts.single || 0}</span>
        <span>多选 ${item.typeCounts.multiple || 0}</span>
      `
    : `
        <span>材料 ${item.materialCount || 1} 份</span>
        <span class="status-chip">仅学习材料</span>
      `;
  const examAction = item.hasExam
    ? `<button class="secondary-button" type="button" data-exam-id="${escapeHtml(item.id)}">进入考试</button>`
    : '';
  return `
    <article class="exam-card${item.hasExam ? '' : ' is-material-only'}">
      ${cover}
      <div>
        <p class="eyebrow">Course</p>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.description || '')}</p>
      </div>
      <div class="exam-stats">${stats}</div>
      <div class="course-actions">
        <button class="primary-button" type="button" data-material-exam-id="${escapeHtml(item.id)}">查看材料</button>
        ${examAction}
      </div>
    </article>
  `;
}

function renderMaterialPreview(material = {}, index = 0) {
  const title = material.title || `材料 ${index + 1}`;
  const previewUrl = material.previewUrl || material.url;
  const previewType = material.previewUrl ? material.previewType || material.type || '' : material.type || '';
  const canPreviewPdf = previewType === 'pdf';
  const canPreviewImage = previewType === 'image';
  const viewer = canPreviewPdf
      ? `<iframe class="material-frame" src="${escapeHtml(previewUrl)}" title="${escapeHtml(title)}"></iframe>`
      : canPreviewImage
        ? `<img class="material-image" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(title)}" />`
        : `
        <div class="material-download">
          <p class="eyebrow">PowerPoint</p>
          <h2>${escapeHtml(title)}</h2>
          <p>当前材料暂未生成在线预览，请下载后使用 PowerPoint 或 WPS 查看。</p>
          <a class="primary-button link-button" href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">下载材料</a>
        </div>
      `;

  return `
    <section class="material-preview-block" id="material-preview-${index + 1}">
      <div class="material-preview-heading">
        <h3>${index + 1}. ${escapeHtml(title)}</h3>
        <a class="secondary-button link-button" href="${escapeHtml(material.url || previewUrl)}" target="_blank" rel="noreferrer">下载原文件</a>
      </div>
      ${viewer}
    </section>
  `;
}

function renderMaterial(course) {
  exam = null;
  examTitle.textContent = course.title;
  const materialActionText = course.previewUrl ? '下载原文件' : '新窗口打开';
  const examAction = course.hasExam
    ? `<button class="primary-button" type="button" data-exam-id="${escapeHtml(course.id)}">进入考试</button>`
    : `<span class="material-only-note">仅学习材料</span>`;
  const materials = Array.isArray(course.materials) ? course.materials : [];
  const materialLinks = materials.length > 1
    ? `
      <div class="material-list">
        <p class="eyebrow">Materials</p>
        ${materials
          .map(
            (material, index) => `
              <a class="material-link" href="#material-preview-${index + 1}">
                <span>${index + 1}</span>
                <strong>${escapeHtml(material.title)}</strong>
                <em>${material.previewUrl ? '在线预览' : escapeHtml((material.type || 'file').toUpperCase())}</em>
              </a>
            `
          )
          .join('')}
      </div>
    `
    : '';
  const previewMaterials = materials.length
    ? materials
    : [
        {
          title: course.materialTitle || course.title,
          url: course.materialUrl,
          type: course.materialType,
          previewUrl: course.previewUrl,
          previewType: course.previewType,
        },
      ];
  const materialViewer = previewMaterials.map(renderMaterialPreview).join('');
  examSummary.innerHTML = `
    <button class="back-button" type="button" id="back-to-picker">返回课程列表</button>
    <span>${escapeHtml(course.title)} · 课程材料${course.hasExam ? ' · 考试为附加测评' : ' · 仅学习材料'}</span>
  `;
  examPicker.hidden = true;
  examForm.hidden = true;
  resultPanel.hidden = true;
  resultPanel.innerHTML = '';
  questionList.innerHTML = '';
  materialPanel.hidden = false;
  materialPanel.innerHTML = `
    <div class="material-heading">
      <div>
        <p class="eyebrow">Material</p>
        <h2>${escapeHtml(course.materialTitle || `${course.title}.pdf`)}</h2>
        <p>${escapeHtml(course.description || '')}</p>
      </div>
      <div class="course-actions">
        <a class="secondary-button link-button" href="${escapeHtml(course.materialUrl)}" target="_blank" rel="noreferrer">${materialActionText}</a>
        ${examAction}
      </div>
    </div>
    ${materialLinks}
    ${materialViewer}
  `;
}

function renderQuestion(question, index) {
  const inputType = question.type === 'single' ? 'radio' : 'checkbox';
  const typeLabel = question.type === 'single' ? '单选' : '多选';
  const options = question.options
    .map(
      (option) => `
        <label class="option-row" for="${question.id}-${option.key}">
          <input id="${question.id}-${option.key}" name="${question.id}" type="${inputType}" value="${option.key}" />
          <span class="option-key">${escapeHtml(option.key)}</span>
          <span>${escapeHtml(option.text)}</span>
        </label>
      `
    )
    .join('');

  return `
    <article class="question-card" data-question-id="${question.id}">
      <div class="question-meta">
        <span>第 ${index + 1} 题</span>
        <span>${typeLabel}</span>
        <span>${difficultyLabel[question.difficulty] || question.difficulty}</span>
        <span>${question.points} 分</span>
      </div>
      <h2>${escapeHtml(question.stem)}</h2>
      <p class="source-line">${escapeHtml(question.course)} · ${escapeHtml(question.topic)}</p>
      <div class="option-list">${options}</div>
    </article>
  `;
}

function renderExam(data) {
  exam = data;
  examTitle.textContent = data.title;
  examSummary.innerHTML = `
    <button class="back-button" type="button" id="back-to-picker">重新选择考试</button>
    <span>${escapeHtml(data.title)} · ${data.questionCount} 题 · 满分 ${data.maxScore} 分 · 60 分通过</span>
  `;
  questionList.innerHTML = data.questions.map(renderQuestion).join('');
  resultPanel.hidden = true;
  resultPanel.innerHTML = '';
  examPicker.hidden = true;
  materialPanel.hidden = true;
  materialPanel.innerHTML = '';
  examForm.hidden = false;
}

function collectAnswers() {
  const answers = {};
  const missing = [];
  for (const question of exam.questions) {
    const checked = [
      ...document.querySelectorAll(`input[name="${question.id}"]:checked`),
    ].map((input) => input.value);
    answers[question.id] = checked;
    if (checked.length === 0) missing.push(question.id);
  }
  return { answers, missing };
}

function markMissingQuestions(ids) {
  document.querySelectorAll('.question-card').forEach((card) => {
    card.classList.toggle('is-missing', ids.includes(card.dataset.questionId));
  });
}

function resetFormForNewExam() {
  examForm.reset();
  formStatus.textContent = '';
  submitButton.disabled = false;
}

async function loadExamCatalog() {
  try {
    config = await loadJson('/static-data/config.json');
    const exams = await loadJson('/static-data/exams.json');
    questions = await loadJson('/static-data/questions.json');
    courseCatalog = buildCatalog(exams);
    examTitle.textContent = config.title;
    examSummary.textContent = '请选择课程查看培训材料，完成学习后可进入对应考试';
    examPicker.hidden = false;
    examForm.hidden = true;
    materialPanel.hidden = true;
    materialPanel.innerHTML = '';
    resultPanel.hidden = true;
    examPicker.innerHTML = courseCatalog.map(renderExamCard).join('');
  } catch (error) {
    examSummary.textContent = error.message;
    examSummary.classList.add('is-error');
  }
}

function loadExam(examId) {
  const course = courseCatalog.find((item) => item.id === examId);
  const examQuestions = getQuestionsForExam(examId);
  if (!course || !canTakeExam(course, examQuestions)) {
    examSummary.textContent = '该课程暂未配置考试';
    examSummary.classList.add('is-error');
    return;
  }
  resetFormForNewExam();
  renderExam({
    examId: course.id,
    title: course.title,
    description: course.description,
    questionCount: examQuestions.length,
    maxScore: examQuestions.reduce((sum, question) => sum + Number(question.points || 0), 0),
    typeCounts: countBy(examQuestions, 'type'),
    difficultyCounts: countBy(examQuestions, 'difficulty'),
    questions: examQuestions.map(sanitizeQuestion),
  });
}

examPicker.addEventListener('click', (event) => {
  const materialButton = event.target.closest('button[data-material-exam-id]');
  if (materialButton) {
    const course = courseCatalog.find((item) => item.id === materialButton.dataset.materialExamId);
    if (course) renderMaterial(course);
    return;
  }
  const examButton = event.target.closest('button[data-exam-id]');
  if (!examButton) return;
  loadExam(examButton.dataset.examId);
});

examSummary.addEventListener('click', (event) => {
  if (event.target.id !== 'back-to-picker') return;
  exam = null;
  questionList.innerHTML = '';
  loadExamCatalog();
});

materialPanel.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-exam-id]');
  if (!button) return;
  loadExam(button.dataset.examId);
});

examForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!exam) return;

  const name = document.querySelector('#candidate-name').value.trim();
  const employeeId = document.querySelector('#candidate-id').value.trim();
  const { answers, missing } = collectAnswers();

  markMissingQuestions(missing);
  if (!name || !employeeId) {
    formStatus.textContent = '请填写姓名和工号。';
    return;
  }
  if (missing.length > 0) {
    formStatus.textContent = `还有 ${missing.length} 题未作答。`;
    return;
  }

  submitButton.disabled = true;
  formStatus.textContent = '正在提交...';
  const examQuestions = getQuestionsForExam(exam.examId);
  const scored = scoreExam(examQuestions, answers);
  const passOutcome = getPassOutcome(scored.totalScore);
  const submission = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    submittedAt: new Date().toISOString(),
    exam: { id: exam.examId, title: exam.title },
    candidate: { name, employeeId },
    totalScore: scored.totalScore,
    maxScore: scored.maxScore,
    passingScore: passOutcome.passingScore,
    passed: passOutcome.passed,
    passStatus: passOutcome.passStatus,
    correctCount: scored.correctCount,
    answers,
    results: scored.results,
  };
  const submissions = loadStoredSubmissions();
  submissions.unshift(submission);
  saveStoredSubmissions(submissions);

  examForm.hidden = true;
  resultPanel.hidden = false;
  resultPanel.innerHTML = `
    <p class="eyebrow">Result</p>
    <h2>提交成功</h2>
    <p class="muted-line">${escapeHtml(exam.title)}</p>
    <p class="score-line">${submission.totalScore}<span> / ${submission.maxScore} 分</span></p>
    <p>答对 ${submission.correctCount} / ${examQuestions.length} 题 · ${submission.passStatus} · ${submission.passingScore} 分通过</p>
    <button class="secondary-button" type="button" id="finish-back">返回课程项目</button>
  `;
});

resultPanel.addEventListener('click', (event) => {
  if (event.target.id !== 'finish-back') return;
  exam = null;
  questionList.innerHTML = '';
  loadExamCatalog();
});

loadExamCatalog();
