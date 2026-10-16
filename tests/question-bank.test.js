const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildExamCatalog } = require('../server');

test('each configured exam has the required structure and score', () => {
  const exams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exams.json'), 'utf8'));
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const catalog = buildExamCatalog(exams, questions);
  const examCourses = catalog.filter((course) => course.hasExam);
  const materialOnlyCourses = catalog.filter((course) => !course.hasExam);

  assert.equal(catalog.length, 8);
  assert.equal(examCourses.length, 8);
  assert.deepEqual(materialOnlyCourses, []);

  for (const exam of examCourses) {
    assert.equal(exam.questionCount, 20, `${exam.id} question count`);
    assert.equal(exam.maxScore, 100, `${exam.id} max score`);
    assert.equal(exam.typeCounts.single, 15, `${exam.id} single count`);
    assert.equal(exam.typeCounts.multiple, 5, `${exam.id} multiple count`);
    assert.equal(exam.difficultyCounts.easy, 12, `${exam.id} easy count`);
    assert.equal(exam.difficultyCounts.medium, 6, `${exam.id} medium count`);
    assert.equal(exam.difficultyCounts.hard, 2, `${exam.id} hard count`);
  }

  for (const course of materialOnlyCourses) {
    assert.equal(course.questionCount, 0, `${course.id} question count`);
    assert.equal(course.maxScore, 0, `${course.id} max score`);
  }
});

test('assembly process simulation distractors stay in the engineering domain', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const assemblyQuestions = questions.filter((question) => question.examId === 'assembly-process-simulation');
  const offTopicPattern = /配色|拍摄|宣传|采购|仓储|物流|包装|网页|签到|文件夹|文档页码|照片|蓝牙版本|外包装标签|系统标题|随机输入|纹理渲染|员工座位/;

  assert.equal(assemblyQuestions.length, 20);
  for (const question of assemblyQuestions) {
    for (const option of question.options) {
      assert.doesNotMatch(option.text, offTopicPattern, `${question.id} ${option.key}`);
    }
  }
});

test('all exam distractors avoid obviously unrelated business or UI wording', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const bannedTexts = [
    'Course Picker',
    '制造成本',
    '外观一致性',
    '装配速度',
    '包装尺寸',
    '采购批次',
    '品牌定位',
    '登录区域',
    '下载区域',
    '胶层界面开裂的精细表征',
    '胶层固化后的断裂能参数',
    '直接套用胶层内聚力断裂能',
    '公差带和接触压力',
    '耳机外观颜色等级',
    '品牌宣传变化',
    '包装颜色变化',
    '颜色搭配',
    '销售渠道',
    '颜色优先理论',
    '只测试外观件',
    '包装重量 / 运输距离',
    '采购方程、工艺方程、成本方程',
    '温度方程、颜色方程、外观方程',
    '抽样方程、包装方程、库存方程',
    '直接量产',
    '只进行外观评审',
    '品牌标志颜色',
    '包装展示期',
    '只要模型外观漂亮，就可以替代所有验证',
    '只看产品宣传图判断寿命',
    '页面展示颜色的复杂度',
    '外观颜色和表面光泽',
    '采购周期和运输距离',
    '产品宣传语是否完整',
    'V&V 只表示材料颜色',
    '包装盒字体大小',
    '员工人数',
    '会议室位置',
    '颜色分级模型',
    '颜色永久变亮',
    '市场定价',
    '广告投放',
    '售后排班',
    '只设置颜色',
    '网页链接颜色',
    '员工姓名格式',
    '包装清单分析',
    '网页刷新',
    '颜色映射',
    '网页按钮',
    '材料颜色',
    '按钮颜色变化',
    '生成采购订单',
    '自动完成外观评审',
    '网页缓存',
    '员工绩效等级',
    '网页访问人数',
    '网页背景色',
    '广告区域',
    '只用于网页排版',
    '只要云图颜色好看就能直接下结论',
  ];

  const bannedSet = new Set(bannedTexts);
  for (const question of questions) {
    for (const option of question.options) {
      assert.equal(bannedSet.has(option.text), false, `${question.id} ${option.key}: ${option.text}`);
    }
  }
});

test('assembly process questions match reviewed PPT wording', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const byId = new Map(questions.map((question) => [question.id, question]));

  const asm10 = byId.get('ASM10');
  assert.equal(
    asm10.options.find((option) => option.key === 'C').text,
    '胶水固化后的界面粘接固定'
  );

  const asm13 = byId.get('ASM13');
  assert.equal(asm13.stem, '过盈量设计时，应重点关注哪些因素之间的平衡？');
  assert.equal(
    asm13.options.find((option) => option.key === 'A').text,
    '公差带、接触压力、装配力和局部应力'
  );

  const asm18 = byId.get('ASM18');
  assert.equal(
    asm18.options.find((option) => option.key === 'D').text,
    '螺钉锁付扭矩是否达标'
  );

  const asm19 = byId.get('ASM19');
  assert.equal(
    asm19.options.find((option) => option.key === 'D').text,
    '直接把材料弹性模量当作连接刚度使用'
  );
});

test('abaqus postprocessing questions match reviewed wording', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
  const byId = new Map(questions.map((question) => [question.id, question]));

  const abq02 = byId.get('ABQ02');
  assert.equal(abq02.options.find((option) => option.key === 'D').text, 'ODB Display Options');
  assert.deepEqual(abq02.answer, ['A']);

  const abq04 = byId.get('ABQ04');
  assert.equal(abq04.stem, '准静态分析中，外力做功 ALLWK 通常应与哪项能量近似相等？');
  assert.deepEqual(
    abq04.options.map((option) => option.text),
    ['内能 ALLIE', '动能 ALLKE', '粘性耗散能 ALLVD', '人工应变能 ALLAE']
  );
  assert.deepEqual(abq04.answer, ['A']);

  const abq07 = byId.get('ABQ07');
  assert.deepEqual(
    abq07.options.map((option) => option.text),
    ['Field Output / Primary Variable', 'History Output', 'ODB Display Options', 'Contour Options']
  );
  assert.deepEqual(abq07.answer, ['A']);
});
