const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildExamCatalog } = require('../server');

function localAssetPath(assetUrl) {
  const url = new URL(assetUrl, 'http://localhost');
  return path.join(__dirname, '..', 'public', url.pathname);
}

test('course catalog exposes PDF material metadata for each course', () => {
  const exams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exams.json'), 'utf8'));
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const catalog = buildExamCatalog(exams, questions);

  assert.equal(catalog.length, 8);
  for (const course of catalog) {
    assert.match(course.materialTitle, /\.pdf$/i);
    assert.match(course.materialUrl, new RegExp(`^/api/materials/${course.id}$`));
    assert.equal(course.materialType, 'pdf');
    assert.ok(course.materialCount >= 1);
    assert.ok((course.previewImages || []).length === 0);
    for (const material of course.materials || []) {
      assert.equal(material.type, 'pdf');
      assert.equal(material.previewUrl, '');
      assert.equal(material.previewType, '');
    }
  }
});

test('reliability course only exposes its own PDF material', () => {
  const exams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exams.json'), 'utf8'));
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const catalog = buildExamCatalog(exams, questions);
  const reliability = catalog.find((course) => course.id === 'reliability');

  assert.equal(reliability.materialCount, 1);
  assert.deepEqual(
    reliability.materials.map((material) => material.title),
    ['可靠性设计与力学仿真概述.pdf']
  );
  assert.equal(reliability.materials.some((material) => material.title.includes('网格前处理')), false);
});

test('mesh preprocessing remains a standalone course with material and exam', () => {
  const exams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exams.json'), 'utf8'));
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const catalog = buildExamCatalog(exams, questions);
  const meshCourse = catalog.find((course) => course.id === 'mesh-preprocessing');

  assert.ok(meshCourse);
  assert.equal(meshCourse.hasExam, true);
  assert.equal(meshCourse.questionCount, 20);
  assert.equal(meshCourse.materialCount, 1);
  assert.equal(meshCourse.materials[0].type, 'pdf');
  assert.equal(meshCourse.materials[0].title, '仿真模型网格前处理SOP_202606.pdf');
});

test('all course material files are real PDF files', () => {
  const exams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exams.json'), 'utf8'));
  const pdfSignature = Buffer.from('%PDF', 'ascii');
  const materials = exams.flatMap((course) =>
    (course.materials || []).map((material) => ({ courseId: course.id, ...material }))
  );

  assert.equal(materials.length, 8);
  for (const material of materials) {
    assert.match(material.file, /\.pdf$/i, material.file);
    const materialPath = path.join(__dirname, '..', material.file);
    const header = fs.readFileSync(materialPath).subarray(0, pdfSignature.length);
    assert.deepEqual(header, pdfSignature, `${material.courseId} ${material.file}`);
  }
});

test('PDF material is served inline with the PDF MIME type', async () => {
  const { createServer } = require('../server');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/materials/simulation-modeling`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('content-disposition'), /^inline;/);
    const bytes = Buffer.from(await response.arrayBuffer()).subarray(0, 4);
    assert.deepEqual(bytes, Buffer.from('%PDF', 'ascii'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('course catalog exposes PDF page counts for the local reader', () => {
  const exams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exams.json'), 'utf8'));
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const catalog = buildExamCatalog(exams, questions);

  for (const course of catalog) {
    assert.ok(course.materialPageCount > 1, course.id);
    assert.ok(course.materials[0].pageCount > 1, course.id);
  }
});

test('frontend renders PDF iframe preview and does not depend on slide images', () => {
  const publicApp = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const shareApp = fs.readFileSync(path.join(__dirname, '..', 'share-site', 'app.js'), 'utf8');

  assert.match(publicApp, /material-frame/);
  assert.match(publicApp, /canPreviewPdf/);
  assert.match(publicApp, /pdf-reader-toolbar/);
  assert.match(publicApp, /data-pdf-next/);
  assert.match(publicApp, /requestFullscreen/);
  assert.match(publicApp, /is-reader-fullscreen/);
  assert.doesNotMatch(publicApp, /renderSlidePreview|slide-preview-list|previewImageDir/);
  assert.match(shareApp, /material-frame/);
  assert.match(shareApp, /canPreviewPdf/);
  assert.doesNotMatch(shareApp, /renderSlidePreview|slide-preview-list|previewImageDir|\/assets\/slide-previews/);
});

test('course catalog does not expose slide image previews for PDF-backed materials', () => {
  const exams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exams.json'), 'utf8'));
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const catalog = buildExamCatalog(exams, questions);
  const previewImages = catalog.flatMap((course) =>
    (course.materials || []).flatMap((material) => material.previewImages || [])
  );

  assert.deepEqual(previewImages, []);
});
