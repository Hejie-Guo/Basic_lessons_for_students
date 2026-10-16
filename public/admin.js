const loginPanel = document.querySelector('#login-panel');
const dashboardPanel = document.querySelector('#dashboard-panel');
const detailPanel = document.querySelector('#detail-panel');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const dashboardStatus = document.querySelector('#dashboard-status');
const submissionBody = document.querySelector('#submission-body');
const refreshButton = document.querySelector('#refresh-button');
const logoutButton = document.querySelector('#logout-button');

let token = sessionStorage.getItem('examAdminToken') || '';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function authHeaders() {
  return { Authorization: `Bearer ${token}` };
}

function getPassOutcome(submission) {
  const passingScore = Number(submission.passingScore || 60);
  const passed =
    typeof submission.passed === 'boolean'
      ? submission.passed
      : Number(submission.totalScore || 0) >= passingScore;
  return {
    passingScore,
    passStatus: submission.passStatus || (passed ? 'PASS' : 'FAIL'),
  };
}

function renderPassBadge(submission) {
  const { passStatus } = getPassOutcome(submission);
  const normalizedStatus = passStatus === 'PASS' ? 'PASS' : 'FAIL';
  const statusClass = normalizedStatus === 'PASS' ? 'status-pass' : 'status-fail';
  return `<span class="status-badge ${statusClass}">${normalizedStatus}</span>`;
}

async function adminFetch(url) {
  const response = await fetch(url, { headers: authHeaders() });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || '后台请求失败');
  return payload;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
}

function showLogin() {
  token = '';
  sessionStorage.removeItem('examAdminToken');
  dashboardPanel.hidden = true;
  detailPanel.hidden = true;
  loginPanel.hidden = false;
}

function renderSubmissions(submissions) {
  if (!submissions.length) {
    submissionBody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无答卷记录</td></tr>';
    return;
  }
  submissionBody.innerHTML = submissions
    .map(
      (submission) => `
        <tr>
          <td>${escapeHtml(formatDate(submission.submittedAt))}</td>
          <td>${escapeHtml(submission.exam?.title || '未指定考试')}</td>
          <td>${escapeHtml(submission.candidate.name)}</td>
          <td>${escapeHtml(submission.candidate.employeeId)}</td>
          <td><strong>${submission.totalScore}</strong> / ${submission.maxScore}</td>
          <td>${renderPassBadge(submission)}</td>
          <td>${submission.correctCount} / ${submission.questionCount}</td>
          <td>
            <button class="small-button" type="button" data-id="${escapeHtml(submission.id)}">查看</button>
          </td>
        </tr>
      `
    )
    .join('');
}

function formatAnswer(keys, options) {
  if (!keys || keys.length === 0) return '未作答';
  const optionMap = new Map(options.map((option) => [option.key, option.text]));
  return keys.map((key) => `${key}. ${optionMap.get(key) || ''}`).join('；');
}

function renderDetail(submission) {
  const passOutcome = getPassOutcome(submission);
  const rows = submission.results
    .map(
      (result, index) => `
        <tr class="${result.correct ? 'is-correct' : 'is-wrong'}">
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(result.stem)}</strong>
            <p class="source-line">${escapeHtml(result.course)} · ${escapeHtml(result.topic)}</p>
          </td>
          <td>${escapeHtml(formatAnswer(result.submittedAnswer, result.options))}</td>
          <td>${escapeHtml(formatAnswer(result.correctAnswer, result.options))}</td>
          <td>${result.correct ? '正确' : '错误'}</td>
          <td>${result.score} / ${result.points}</td>
        </tr>
      `
    )
    .join('');

  detailPanel.hidden = false;
  detailPanel.innerHTML = `
    <div class="detail-heading">
      <div>
        <p class="eyebrow">Detail</p>
        <h2>${escapeHtml(submission.candidate.name)} 的答卷</h2>
      </div>
      <div class="detail-score-block">
        <div class="detail-score">${submission.totalScore}<span> / ${submission.maxScore}</span></div>
        <div class="detail-outcome">${renderPassBadge(submission)}<span>${passOutcome.passingScore} 分通过</span></div>
      </div>
    </div>
    <p class="muted-line">考试项目：${escapeHtml(submission.exam?.title || '未指定考试')}</p>
    <p class="muted-line">工号：${escapeHtml(submission.candidate.employeeId)} · ${escapeHtml(formatDate(submission.submittedAt))}</p>
    <div class="table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>#</th>
            <th>题目</th>
            <th>考生答案</th>
            <th>标准答案</th>
            <th>结果</th>
            <th>得分</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadSubmissions() {
  try {
    dashboardStatus.textContent = '正在加载...';
    const payload = await adminFetch('/api/admin/submissions');
    renderSubmissions(payload.submissions);
    dashboardStatus.textContent = '';
  } catch (error) {
    dashboardStatus.textContent = error.message;
    if (error.message.includes('登录')) showLogin();
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = '正在登录...';
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.querySelector('#admin-password').value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '登录失败');
    token = payload.token;
    sessionStorage.setItem('examAdminToken', token);
    loginStatus.textContent = '';
    showDashboard();
    await loadSubmissions();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

submissionBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;
  try {
    dashboardStatus.textContent = '正在加载答卷...';
    const payload = await adminFetch(`/api/admin/submissions/${encodeURIComponent(button.dataset.id)}`);
    renderDetail(payload.submission);
    dashboardStatus.textContent = '';
  } catch (error) {
    dashboardStatus.textContent = error.message;
  }
});

refreshButton.addEventListener('click', loadSubmissions);
logoutButton.addEventListener('click', showLogin);

if (token) {
  showDashboard();
  loadSubmissions();
}
