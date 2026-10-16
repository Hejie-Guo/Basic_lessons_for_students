const examTitle = document.querySelector('#exam-title');
const examSummary = document.querySelector('#exam-summary');
const examPicker = document.querySelector('#exam-picker');
const examForm = document.querySelector('#exam-form');
const materialPanel = document.querySelector('#course-material');
const questionList = document.querySelector('#question-list');
const formStatus = document.querySelector('#form-status');
const submitButton = document.querySelector('#submit-button');
const resultPanel = document.querySelector('#result-panel');

const difficultyLabel = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

let exam = null;
let courseCatalog = [];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildPdfViewerUrl(url, page = 1) {
  const baseUrl = String(url || '').split('#')[0];
  const pageNumber = Math.max(1, Number(page) || 1);
  return `${baseUrl}#page=${pageNumber}&zoom=page-fit`;
}

function renderPdfReader(material, title, index) {
  const url = material.previewUrl || material.url;
  const pageCount = Math.max(1, Number(material.pageCount || 1));
  const readerId = `pdf-reader-${index + 1}`;
  return `
    <div class="pdf-reader" id="${readerId}" data-pdf-reader data-base-url="${escapeHtml(url)}" data-current-page="1" data-page-count="${pageCount}">
      <div class="pdf-reader-toolbar">
        <div class="pdf-reader-title">
          <span>PDF 阅读</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
        <div class="pdf-reader-controls" aria-label="PDF 翻页控制">
          <button class="small-button" type="button" data-pdf-prev disabled>上一页</button>
          <label class="pdf-page-control">
            <span>页码</span>
            <input type="number" min="1" max="${pageCount}" value="1" data-pdf-page-input />
          </label>
          <span class="pdf-page-total">/ ${pageCount}</span>
          <button class="small-button" type="button" data-pdf-next${pageCount <= 1 ? ' disabled' : ''}>下一页</button>
          <button class="small-button" type="button" data-pdf-fullscreen>全屏</button>
        </div>
      </div>
      <iframe class="material-frame" src="${escapeHtml(buildPdfViewerUrl(url, 1))}" title="${escapeHtml(title)}"></iframe>
    </div>
  `;
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
      ? renderPdfReader(material, title, index)
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
          pageCount: course.materialPageCount,
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
    <span>${escapeHtml(data.title)} · ${data.questionCount} 题 · 满分 ${data.maxScore} 分 · 单选 ${data.typeCounts.single || 0} 题，多选 ${data.typeCounts.multiple || 0} 题</span>
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
    if (checked.length === 0) {
      missing.push(question.id);
    }
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
    const response = await fetch('/api/exams');
    if (!response.ok) throw new Error('考试项目加载失败');
    const payload = await response.json();
    courseCatalog = payload.exams || [];
    examTitle.textContent = payload.title;
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

async function loadExam(examId) {
  examSummary.textContent = '正在载入试卷...';
  try {
    const response = await fetch(`/api/exam?examId=${encodeURIComponent(examId)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '考试加载失败');
    resetFormForNewExam();
    renderExam(payload);
  } catch (error) {
    examSummary.textContent = error.message;
    examSummary.classList.add('is-error');
  }
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
  const reader = event.target.closest('[data-pdf-reader]');
  const pdfButton = event.target.closest('[data-pdf-prev], [data-pdf-next], [data-pdf-fullscreen]');
  if (reader && pdfButton) {
    if (pdfButton.matches('[data-pdf-fullscreen]')) {
      togglePdfReaderFullscreen(reader);
      return;
    }

    const direction = pdfButton.matches('[data-pdf-next]') ? 1 : -1;
    updatePdfReaderPage(reader, Number(reader.dataset.currentPage || 1) + direction);
    return;
  }

  const button = event.target.closest('button[data-exam-id]');
  if (!button) return;
  loadExam(button.dataset.examId);
});

materialPanel.addEventListener('change', (event) => {
  const input = event.target.closest('[data-pdf-page-input]');
  if (!input) return;
  const reader = input.closest('[data-pdf-reader]');
  if (!reader) return;
  updatePdfReaderPage(reader, Number(input.value));
});

materialPanel.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const input = event.target.closest('[data-pdf-page-input]');
  if (!input) return;
  event.preventDefault();
  const reader = input.closest('[data-pdf-reader]');
  if (!reader) return;
  updatePdfReaderPage(reader, Number(input.value));
});

function updatePdfReaderPage(reader, requestedPage) {
  const pageCount = Math.max(1, Number(reader.dataset.pageCount || 1));
  const page = Math.min(pageCount, Math.max(1, Number(requestedPage) || 1));
  const baseUrl = reader.dataset.baseUrl || '';
  const iframe = reader.querySelector('iframe.material-frame');
  const input = reader.querySelector('[data-pdf-page-input]');
  const prevButton = reader.querySelector('[data-pdf-prev]');
  const nextButton = reader.querySelector('[data-pdf-next]');

  reader.dataset.currentPage = String(page);
  if (input) input.value = String(page);
  if (prevButton) prevButton.disabled = page <= 1;
  if (nextButton) nextButton.disabled = page >= pageCount;
  if (iframe) iframe.src = buildPdfViewerUrl(baseUrl, page);
}

function togglePdfReaderFullscreen(reader) {
  const isFullscreen = reader.classList.contains('is-reader-fullscreen') || document.fullscreenElement === reader;
  setPdfReaderFullscreen(reader, !isFullscreen);
  if (isFullscreen) {
    document.exitFullscreen?.();
    return;
  }

  const fullscreenPromise = reader.requestFullscreen?.();
  if (fullscreenPromise?.catch) {
    fullscreenPromise.catch(() => {
      setPdfReaderFullscreen(reader, true);
    });
  }
}

function setPdfReaderFullscreen(reader, active) {
  reader.classList.toggle('is-reader-fullscreen', active);
  const button = reader.querySelector('[data-pdf-fullscreen]');
  if (button) {
    button.textContent = active ? '退出全屏' : '全屏';
  }
}

document.addEventListener('fullscreenchange', () => {
  document.querySelectorAll('[data-pdf-reader]').forEach((reader) => {
    setPdfReaderFullscreen(reader, document.fullscreenElement === reader);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('[data-pdf-reader].is-reader-fullscreen').forEach((reader) => {
    setPdfReaderFullscreen(reader, false);
  });
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
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId: exam.examId,
        candidate: { name, employeeId },
        answers,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '提交失败');

    examForm.hidden = true;
    resultPanel.hidden = false;
    resultPanel.innerHTML = `
      <p class="eyebrow">Result</p>
      <h2>提交成功</h2>
      <p class="muted-line">${escapeHtml(payload.exam.title)}</p>
      <p class="score-line">${payload.totalScore}<span> / ${payload.maxScore} 分</span></p>
      <p>答对 ${payload.correctCount} / ${payload.questionCount} 题</p>
      <button class="secondary-button" type="button" id="finish-back">返回考试项目</button>
    `;
  } catch (error) {
    submitButton.disabled = false;
    formStatus.textContent = error.message;
  }
});

resultPanel.addEventListener('click', (event) => {
  if (event.target.id !== 'finish-back') return;
  exam = null;
  questionList.innerHTML = '';
  loadExamCatalog();
});

loadExamCatalog();
