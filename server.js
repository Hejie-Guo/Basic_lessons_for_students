const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const EXAMS_FILE = path.join(DATA_DIR, 'exams.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const adminTokens = new Set();
const pdfPageCountCache = new Map();

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadExams() {
  return readJson(EXAMS_FILE, []);
}

function loadQuestions() {
  return readJson(QUESTIONS_FILE, []);
}

function loadConfig() {
  const config = readJson(CONFIG_FILE, {
    title: '校招生在线学习系统',
    passingScore: 60,
    scoring: { single: 4, multiple: 8 },
  });
  return { ...config, adminPassword: process.env.ADMIN_PASSWORD || config.adminPassword || '' };
}

function loadSubmissions() {
  return readJson(SUBMISSIONS_FILE, []);
}

function saveSubmissions(submissions) {
  writeJson(SUBMISSIONS_FILE, submissions);
}

function normalizeAnswer(value) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === 'string' && value) {
    return [value];
  }
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

function scoreExam(questions, answers = {}, config = {}) {
  const scoring = config.scoring || {};
  const results = questions.map((question) => {
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

function getQuestionsForExam(questions, examId) {
  return questions.filter((question) => question.examId === examId);
}

function getMaterialItems(exam = {}) {
  const configuredMaterials = Array.isArray(exam.materials) ? exam.materials : [];
  if (configuredMaterials.length) {
    return configuredMaterials
      .map((item) => ({
        title: item.title || item.file || exam.materialTitle || exam.materialFile,
        file: item.file || item.materialFile || '',
        previewFile: item.previewFile || '',
        previewImageDir: item.previewImageDir || '',
        previewImageCount: Number(item.previewImageCount || 0),
      }))
      .filter((item) => item.file);
  }
  if (!exam.materialFile) return [];
  return [
    {
      title: exam.materialTitle || exam.materialFile,
      file: exam.materialFile,
      previewFile: exam.previewFile || '',
      previewImageDir: exam.previewImageDir || '',
      previewImageCount: Number(exam.previewImageCount || 0),
    },
  ];
}

function getMaterialType(filePath = '') {
  const ext = path.extname(filePath).toLowerCase();
  const typeByExt = {
    '.pdf': 'pdf',
    '.pptx': 'pptx',
    '.ppt': 'ppt',
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
  };
  return typeByExt[ext] || 'file';
}

function getContentType(filePath = '') {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.pdf': 'application/pdf',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

function getLocalFilePath(relativeFilePath = '') {
  const filePath = path.normalize(path.join(ROOT_DIR, relativeFilePath));
  const relativePath = path.relative(ROOT_DIR, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  return filePath;
}

function countPdfPages(relativeFilePath = '') {
  if (getMaterialType(relativeFilePath) !== 'pdf') return 0;
  const filePath = getLocalFilePath(relativeFilePath);
  if (!filePath) return 0;

  try {
    const stats = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stats.mtimeMs}:${stats.size}`;
    if (pdfPageCountCache.has(cacheKey)) {
      return pdfPageCountCache.get(cacheKey);
    }

    const content = fs.readFileSync(filePath, 'latin1');
    const matches = content.match(/\/Type\s*\/Page\b/g) || [];
    const pageCount = matches.length;
    pdfPageCountCache.clear();
    pdfPageCountCache.set(cacheKey, pageCount);
    return pageCount;
  } catch (error) {
    return 0;
  }
}

function canTakeExam(exam, questions) {
  return exam?.examEnabled !== false && questions.length > 0;
}

function getPublicPreviewUrl(previewFile = '') {
  if (!previewFile) return '';
  return previewFile.startsWith('/') ? previewFile : `/${previewFile.replace(/^\/+/, '')}`;
}

function getPreviewImages(material = {}) {
  const count = Number(material.previewImageCount || 0);
  if (!material.previewImageDir || !Number.isInteger(count) || count <= 0) {
    return [];
  }
  const baseDir = getPublicPreviewUrl(material.previewImageDir).replace(/\/+$/, '');
  return Array.from({ length: count }, (_, index) => {
    const slideNumber = String(index + 1).padStart(3, '0');
    return `${baseDir}/slide-${slideNumber}.png`;
  });
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function getPassingScore(config = {}) {
  const passingScore = Number(config.passingScore ?? 60);
  return Number.isFinite(passingScore) ? passingScore : 60;
}

function evaluatePassStatus(submissionOrScore, config = {}) {
  const totalScore =
    typeof submissionOrScore === 'number'
      ? submissionOrScore
      : Number(submissionOrScore?.totalScore || 0);
  const passingScore = Number(submissionOrScore?.passingScore ?? getPassingScore(config));
  const passed =
    typeof submissionOrScore?.passed === 'boolean'
      ? submissionOrScore.passed
      : totalScore >= passingScore;
  return {
    passingScore,
    passed,
    passStatus: submissionOrScore?.passStatus || (passed ? 'PASS' : 'FAIL'),
  };
}

function buildExamCatalog(exams, questions) {
  return exams.map((exam) => {
    const examQuestions = getQuestionsForExam(questions, exam.id);
    const materials = getMaterialItems(exam);
    const primaryMaterial = materials[0];
    const hasExam = canTakeExam(exam, examQuestions);
    const summary = {
      id: exam.id,
      title: exam.title,
      hasExam,
      questionCount: examQuestions.length,
      maxScore: examQuestions.reduce((sum, question) => sum + Number(question.points || 0), 0),
      typeCounts: countBy(examQuestions, 'type'),
      difficultyCounts: countBy(examQuestions, 'difficulty'),
    };
    if (exam.description) {
      summary.description = exam.description;
    }
    if (exam.coverFile) {
      summary.coverImage = `/api/covers/${encodeURIComponent(exam.id)}`;
    } else if (exam.coverImage) {
      summary.coverImage = exam.coverImage;
    }
    if (primaryMaterial) {
      summary.materialTitle = primaryMaterial.title || primaryMaterial.file;
      summary.materialUrl = `/api/materials/${encodeURIComponent(exam.id)}`;
      summary.materialType = getMaterialType(primaryMaterial.file);
      summary.materialPageCount = countPdfPages(primaryMaterial.file);
      if (primaryMaterial.previewFile) {
        summary.previewUrl = getPublicPreviewUrl(primaryMaterial.previewFile);
        summary.previewType = getMaterialType(primaryMaterial.previewFile);
      }
      summary.previewImages = getPreviewImages(primaryMaterial);
      summary.materialCount = materials.length;
      summary.materials = materials.map((material, index) => ({
        title: material.title || material.file,
        url:
          index === 0
            ? `/api/materials/${encodeURIComponent(exam.id)}`
            : `/api/materials/${encodeURIComponent(exam.id)}/${index}`,
        type: getMaterialType(material.file),
        pageCount: countPdfPages(material.file),
        previewUrl: getPublicPreviewUrl(material.previewFile),
        previewType: material.previewFile ? getMaterialType(material.previewFile) : '',
        previewImages: getPreviewImages(material),
      }));
    }
    return summary;
  });
}

function findExam(exams, examId) {
  return exams.find((exam) => exam.id === examId);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('请求内容过大'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('请求 JSON 格式不正确'));
      }
    });
    request.on('error', reject);
  });
}

function requireAdmin(request, response) {
  const header = request.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !adminTokens.has(token)) {
    sendError(response, 401, '请先登录后台');
    return false;
  }
  return true;
}

function sanitizeQuestion(question) {
  const { answer, ...safeQuestion } = question;
  return safeQuestion;
}

function submissionSummary(submission, config = {}) {
  const passOutcome = evaluatePassStatus(submission, config);
  return {
    id: submission.id,
    submittedAt: submission.submittedAt,
    exam: submission.exam || { id: submission.examId || '', title: submission.examTitle || '未指定考试' },
    candidate: submission.candidate,
    totalScore: submission.totalScore,
    maxScore: submission.maxScore,
    passingScore: passOutcome.passingScore,
    passed: passOutcome.passed,
    passStatus: passOutcome.passStatus,
    correctCount: submission.correctCount,
    questionCount: submission.results.length,
  };
}

function enrichSubmission(submission, questions, config = {}) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const passOutcome = evaluatePassStatus(submission, config);
  return {
    ...submission,
    passingScore: passOutcome.passingScore,
    passed: passOutcome.passed,
    passStatus: passOutcome.passStatus,
    exam: submission.exam || { id: submission.examId || '', title: submission.examTitle || '未指定考试' },
    results: submission.results.map((result) => {
      const question = questionById.get(result.questionId) || {};
      return {
        ...result,
        stem: question.stem || '',
        options: question.options || [],
        course: question.course || '',
        topic: question.topic || '',
        difficulty: question.difficulty || '',
      };
    }),
  };
}

function examPayload(config, exam, questions) {
  return {
    examId: exam.id,
    title: exam.title,
    systemTitle: config.title,
    description: exam.description,
    scoring: config.scoring,
    questionCount: questions.length,
    maxScore: questions.reduce(
      (sum, question) => sum + Number(question.points || config.scoring[question.type] || 0),
      0
    ),
    typeCounts: countBy(questions, 'type'),
    difficultyCounts: countBy(questions, 'difficulty'),
    questions: questions.map(sanitizeQuestion),
  };
}

function sendMaterialFile(response, exam, materialIndex = 0) {
  const materials = getMaterialItems(exam);
  const material = materials[materialIndex];
  if (!material) {
    sendError(response, 404, '未找到课程材料');
    return;
  }

  const materialPath = getLocalFilePath(material.file);
  if (!materialPath) {
    sendError(response, 403, '材料路径不允许访问');
    return;
  }

  fs.stat(materialPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendError(response, 404, '未找到课程材料');
      return;
    }

    const title = material.title || path.basename(materialPath);
    const contentType = getContentType(materialPath);
    const dispositionType = contentType === 'application/pdf' || contentType.startsWith('image/')
      ? 'inline'
      : 'attachment';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Content-Disposition': `${dispositionType}; filename*=UTF-8''${encodeURIComponent(title)}`,
    });
    fs.createReadStream(materialPath).pipe(response);
  });
}

function sendCoverFile(response, exam) {
  if (!exam.coverFile) {
    sendError(response, 404, 'Cover image not found');
    return;
  }

  const coverPath = getLocalFilePath(exam.coverFile);
  if (!coverPath) {
    sendError(response, 403, 'Cover path is not allowed');
    return;
  }

  fs.stat(coverPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendError(response, 404, 'Cover image not found');
      return;
    }

    const contentType = getContentType(coverPath);
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(coverPath))}`,
    });
    fs.createReadStream(coverPath).pipe(response);
  });
}

async function handleApi(request, response, pathname, searchParams) {
  if (request.method === 'GET' && pathname === '/api/exams') {
    const config = loadConfig();
    const exams = loadExams();
    const questions = loadQuestions();
    sendJson(response, 200, {
      title: config.title,
      exams: buildExamCatalog(exams, questions),
    });
    return;
  }

  const coverMatch = pathname.match(/^\/api\/covers\/([^/]+)$/);
  if (request.method === 'GET' && coverMatch) {
    const examId = decodeURIComponent(coverMatch[1]);
    const exam = findExam(loadExams(), examId);
    if (!exam) {
      sendError(response, 404, 'Cover image not found');
      return;
    }
    sendCoverFile(response, exam);
    return;
  }

  const materialMatch = pathname.match(/^\/api\/materials\/([^/]+)(?:\/(\d+))?$/);
  if (request.method === 'GET' && materialMatch) {
    const examId = decodeURIComponent(materialMatch[1]);
    const materialIndex = materialMatch[2] ? Number(materialMatch[2]) : 0;
    const exam = findExam(loadExams(), examId);
    if (!exam) {
      sendError(response, 404, '未找到课程材料');
      return;
    }
    sendMaterialFile(response, exam, materialIndex);
    return;
  }

  if (request.method === 'GET' && pathname === '/api/exam') {
    const config = loadConfig();
    const exams = loadExams();
    const questions = loadQuestions();
    const examId = searchParams.get('examId') || exams[0]?.id;
    const exam = findExam(exams, examId);
    if (!exam) {
      sendError(response, 404, '未找到该考试项目');
      return;
    }
    const examQuestions = getQuestionsForExam(questions, exam.id);
    if (!canTakeExam(exam, examQuestions)) {
      sendError(response, 404, '该课程暂未配置考试');
      return;
    }
    sendJson(response, 200, examPayload(config, exam, examQuestions));
    return;
  }

  if (request.method === 'POST' && pathname === '/api/submissions') {
    const payload = await readRequestBody(request);
    const name = String(payload.candidate?.name || '').trim();
    const employeeId = String(payload.candidate?.employeeId || '').trim();
    const examId = String(payload.examId || '').trim();
    if (!name || !employeeId) {
      sendError(response, 400, '请填写姓名和工号');
      return;
    }
    if (!examId) {
      sendError(response, 400, '请选择考试项目');
      return;
    }

    const config = loadConfig();
    const exams = loadExams();
    const exam = findExam(exams, examId);
    if (!exam) {
      sendError(response, 404, '未找到该考试项目');
      return;
    }

    const questions = getQuestionsForExam(loadQuestions(), exam.id);
    if (!canTakeExam(exam, questions)) {
      sendError(response, 400, '该课程暂未配置考试');
      return;
    }
    const scored = scoreExam(questions, payload.answers || {}, config);
    const passOutcome = evaluatePassStatus(scored.totalScore, config);
    const submission = {
      id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      submittedAt: new Date().toISOString(),
      exam: { id: exam.id, title: exam.title },
      candidate: { name, employeeId },
      totalScore: scored.totalScore,
      maxScore: scored.maxScore,
      passingScore: passOutcome.passingScore,
      passed: passOutcome.passed,
      passStatus: passOutcome.passStatus,
      correctCount: scored.correctCount,
      answers: payload.answers || {},
      results: scored.results,
    };
    const submissions = loadSubmissions();
    submissions.unshift(submission);
    saveSubmissions(submissions);

    sendJson(response, 201, {
      id: submission.id,
      submittedAt: submission.submittedAt,
      exam: submission.exam,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      passingScore: submission.passingScore,
      passed: submission.passed,
      passStatus: submission.passStatus,
      correctCount: submission.correctCount,
      questionCount: questions.length,
    });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/admin/login') {
    const payload = await readRequestBody(request);
    const config = loadConfig();
    if (!config.adminPassword || String(payload.password || '') !== String(config.adminPassword)) {
      sendError(response, 401, '管理员密码不正确');
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    adminTokens.add(token);
    sendJson(response, 200, { token });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/admin/submissions') {
    if (!requireAdmin(request, response)) return;
    const config = loadConfig();
    sendJson(response, 200, {
      submissions: loadSubmissions().map((submission) => submissionSummary(submission, config)),
    });
    return;
  }

  const detailMatch = pathname.match(/^\/api\/admin\/submissions\/([^/]+)$/);
  if (request.method === 'GET' && detailMatch) {
    if (!requireAdmin(request, response)) return;
    const id = decodeURIComponent(detailMatch[1]);
    const submission = loadSubmissions().find((item) => item.id === id);
    if (!submission) {
      sendError(response, 404, '未找到该答卷');
      return;
    }
    sendJson(response, 200, {
      submission: enrichSubmission(submission, loadQuestions(), loadConfig()),
    });
    return;
  }

  sendError(response, 404, '未找到接口');
}

function serveStatic(request, response, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('未找到页面');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };
    response.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
    });
    response.end(data);
  });
}

function createServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    try {
      if (requestUrl.pathname.startsWith('/api/')) {
        await handleApi(request, response, requestUrl.pathname, requestUrl.searchParams);
        return;
      }
      serveStatic(request, response, requestUrl.pathname);
    } catch (error) {
      sendError(response, 500, error.message || '服务器错误');
    }
  });
}

function getLanUrls(port) {
  const urls = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return urls;
}

function startServer() {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`校招生在线学习系统已启动: http://localhost:${port}`);
    if (process.env.COMPUTERNAME) {
      console.log(`固定局域网访问地址: http://${process.env.COMPUTERNAME}:${port}`);
    }
    const lanUrls = getLanUrls(port);
    if (lanUrls.length) {
      console.log('局域网访问地址:');
      lanUrls.forEach((url) => console.log(`  ${url}`));
    }
    console.log('教师后台: /admin.html（设置 ADMIN_PASSWORD 后可登录）');
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildExamCatalog,
  createServer,
  evaluatePassStatus,
  getQuestionsForExam,
  scoreExam,
  startServer,
};
