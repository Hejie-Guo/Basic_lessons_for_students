const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildExamCatalog, createServer } = require('../server');

const rootDir = path.join(__dirname, '..');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function assertPngFile(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, pngSignature.length);
  assert.deepEqual(header, pngSignature, filePath);
}

test('local course catalog exposes API-backed cover images for each course', () => {
  const exams = readJson('data/exams.json');
  const questions = readJson('data/questions.json');
  const catalog = buildExamCatalog(exams, questions);

  assert.equal(catalog.length, 8);
  for (const course of catalog) {
    assert.equal(course.coverImage, `/api/covers/${course.id}`);
  }
});

test('each configured course cover file is a real PNG image', () => {
  const exams = readJson('data/exams.json');

  assert.equal(exams.length, 8);
  for (const course of exams) {
    assert.match(course.coverFile, /\.png$/i, course.id);
    assertPngFile(path.join(rootDir, course.coverFile));
  }
});

test('share site uses static PNG cover assets for each course', () => {
  const exams = readJson('share-site/static-data/exams.json');

  assert.equal(exams.length, 8);
  for (const course of exams) {
    assert.equal(course.coverImage, `/assets/course-covers/${course.id}.png`);
    assertPngFile(path.join(rootDir, 'share-site', course.coverImage));
  }
});

test('cover API serves PNG images inline', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/covers/abaqus-postprocessing`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.match(response.headers.get('content-disposition'), /^inline;/);

    const bytes = Buffer.from(await response.arrayBuffer()).subarray(0, pngSignature.length);
    assert.deepEqual(bytes, pngSignature);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
