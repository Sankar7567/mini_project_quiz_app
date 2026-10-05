'use strict';

/* ================================================================
   QuizForge — Frontend Application
   Vanilla JS · Fetch API · Async/Await · No frameworks
   ================================================================ */

// ─── API Configuration ──────────────────────────────────────────
const API_BASE = '/api';

// ─── App State ──────────────────────────────────────────────────
const state = {
  domains: [],
  currentDomain: null,
  currentQuestions: [],
  currentQuestionIndex: 0,
  answers: {},             // { questionIndex: selectedOptionIndex }
  studentName: '',
  rollNumber: '',
  quizStartTime: null,
  timerInterval: null,
  timerSeconds: 30 * 60,   // 30 minutes default
  isQuizActive: false,
  lastResult: null,
};

/* ================================================================
   UTILITIES
   ================================================================ */

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format seconds into mm:ss
 */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Format date to a readable string
 */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generic fetch wrapper
 */
async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

/* ================================================================
   VIEW MANAGEMENT
   ================================================================ */

const views = {
  home: document.getElementById('home-view'),
  quiz: document.getElementById('quiz-view'),
  result: document.getElementById('result-view'),
  history: document.getElementById('history-view'),
};

function showView(viewName) {
  Object.entries(views).forEach(([name, el]) => {
    if (name === viewName) {
      el.style.display = 'block';
      el.classList.add('active');
    } else {
      el.style.display = 'none';
      el.classList.remove('active');
    }
  });

  // Update nav buttons
  document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================================================================
   MODAL HELPERS
   ================================================================ */

function openModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

/* ================================================================
   DOMAIN HUB
   ================================================================ */

async function loadDomains() {
  const grid = document.getElementById('domains-grid');
  const loading = document.getElementById('domains-loading');
  const error = document.getElementById('domains-error');

  loading.style.display = 'flex';
  grid.style.display = 'none';
  error.style.display = 'none';

  try {
    const data = await apiFetch('/domains');
    state.domains = data.data;

    loading.style.display = 'none';
    renderDomains(state.domains);
    grid.style.display = 'grid';
  } catch (err) {
    loading.style.display = 'none';
    error.style.display = 'block';
    showToast(`Failed to load domains: ${err.message}`, 'error');
  }
}

function renderDomains(domains) {
  const grid = document.getElementById('domains-grid');

  grid.innerHTML = domains
    .map(
      (domain) => `
    <div class="domain-card" data-id="${domain._id}" style="--card-color: ${domain.color}">
      <div class="domain-icon">${domain.icon}</div>
      <div class="domain-info">
        <h3 class="domain-name">${escapeHtml(domain.name)}</h3>
        <p class="domain-desc">${escapeHtml(domain.description)}</p>
      </div>
      <div class="domain-meta">
        <div class="domain-badge">
          <div class="badge-dot"></div>
          ${domain.questionCount} Questions · ${domain.difficulty}
        </div>
        <button class="btn-start" data-id="${domain._id}">Start →</button>
      </div>
    </div>
  `
    )
    .join('');

  // Event delegation for domain card clicks
  grid.addEventListener('click', (e) => {
    const startBtn = e.target.closest('.btn-start');
    const card = e.target.closest('.domain-card');

    if (startBtn || card) {
      const domainId = (startBtn || card).dataset.id;
      const domain = state.domains.find((d) => d._id === domainId);
      if (domain) openRegistrationModal(domain);
    }
  });
}

/* ================================================================
   REGISTRATION MODAL
   ================================================================ */

function openRegistrationModal(domain) {
  state.currentDomain = domain;

  document.getElementById('modal-domain-icon').textContent = domain.icon;
  document.getElementById('modal-domain-subtitle').textContent =
    `${domain.name} · ${domain.questionCount} Questions · 30 minutes`;

  // Pre-fill if we have saved data
  document.getElementById('input-name').value = state.studentName;
  document.getElementById('input-roll').value = state.rollNumber;

  // Clear errors
  document.getElementById('err-name').classList.remove('visible');
  document.getElementById('err-roll').classList.remove('visible');

  openModal('register-overlay');

  // Focus first empty field
  setTimeout(() => {
    const nameInput = document.getElementById('input-name');
    const rollInput = document.getElementById('input-roll');
    (nameInput.value ? rollInput : nameInput).focus();
  }, 150);
}

function validateRegistrationForm() {
  const name = document.getElementById('input-name').value.trim();
  const roll = document.getElementById('input-roll').value.trim();

  let valid = true;

  if (!name || name.length < 2) {
    document.getElementById('err-name').classList.add('visible');
    valid = false;
  } else {
    document.getElementById('err-name').classList.remove('visible');
  }

  if (!roll || !/^[a-zA-Z0-9]{3,20}$/.test(roll)) {
    document.getElementById('err-roll').classList.add('visible');
    valid = false;
  } else {
    document.getElementById('err-roll').classList.remove('visible');
  }

  return valid ? { name, roll } : null;
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = validateRegistrationForm();
  if (!formData) return;

  state.studentName = formData.name;
  state.rollNumber = formData.roll.toUpperCase();

  closeModal('register-overlay');
  await startQuiz(state.currentDomain);
});

document.getElementById('modal-close-btn').addEventListener('click', () => {
  closeModal('register-overlay');
});

/* ================================================================
   QUIZ ENGINE
   ================================================================ */

async function startQuiz(domain) {
  showView('quiz');

  // Show loading state
  document.getElementById('question-prompt').textContent = 'Loading questions…';
  document.getElementById('options-grid').innerHTML = `
    <div class="loading-spinner" style="padding: 40px 0">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const data = await apiFetch(`/domains/${domain._id}/questions`);

    if (!data.data || data.data.length === 0) {
      throw new Error('No questions found for this domain');
    }

    state.currentQuestions = data.data;
    state.currentQuestionIndex = 0;
    state.answers = {};
    state.quizStartTime = Date.now();
    state.isQuizActive = true;
    state.timerSeconds = data.data.length * 90; // 90s per question

    // Setup UI
    document.getElementById('quiz-domain-icon').textContent = domain.icon;
    document.getElementById('quiz-domain-label').textContent = domain.name;
    document.getElementById('q-total').textContent = data.data.length;

    buildQuestionDots(data.data.length);
    renderQuestion(0);
    startTimer();

    showToast(`${domain.name} quiz started! Good luck 🎯`, 'success');
  } catch (err) {
    showToast(`Failed to load questions: ${err.message}`, 'error');
    showView('home');
  }
}

function buildQuestionDots(count) {
  const container = document.getElementById('question-dots');
  container.innerHTML = Array.from(
    { length: count },
    (_, i) => `
    <button class="q-dot ${i === 0 ? 'current' : ''}" data-index="${i}" title="Question ${i + 1}">
      ${i + 1}
    </button>
  `
  ).join('');

  container.addEventListener('click', (e) => {
    const dot = e.target.closest('.q-dot');
    if (dot) {
      navigateToQuestion(parseInt(dot.dataset.index));
    }
  });
}

function updateDots() {
  const dots = document.querySelectorAll('.q-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('current', 'answered');
    if (i === state.currentQuestionIndex) {
      dot.classList.add('current');
    } else if (state.answers[i] !== undefined) {
      dot.classList.add('answered');
    }
  });
}

function renderQuestion(index) {
  const q = state.currentQuestions[index];
  const total = state.currentQuestions.length;

  // Progress
  const pct = Math.round((index / total) * 100);
  document.getElementById('q-current').textContent = index + 1;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-bar').style.width = `${pct}%`;

  // Question
  document.getElementById('question-num').textContent = `Question ${index + 1}`;
  document.getElementById('question-prompt').textContent = q.prompt;

  // Options
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const savedAnswer = state.answers[index];
  const optionsHtml = q.options
    .map((opt, i) => {
      const isSelected = savedAnswer === i;
      return `
      <button class="option-btn ${isSelected ? 'selected' : ''}" data-option="${i}">
        <div class="option-letter">${letters[i]}</div>
        <div class="option-text">${escapeHtml(opt.text)}</div>
      </button>
    `;
    })
    .join('');

  document.getElementById('options-grid').innerHTML = optionsHtml;

  // Add option click handlers
  document.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectOption(parseInt(btn.dataset.option));
    });
  });

  // Navigation buttons
  document.getElementById('btn-prev').disabled = index === 0;
  document.getElementById('btn-next').style.display =
    index === total - 1 ? 'none' : 'inline-flex';
  document.getElementById('btn-submit').style.display =
    index === total - 1 ? 'inline-flex' : 'none';

  updateDots();
}

function selectOption(optionIndex) {
  state.answers[state.currentQuestionIndex] = optionIndex;

  // Update UI
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === optionIndex);
  });

  updateDots();
}

function navigateToQuestion(index) {
  if (index < 0 || index >= state.currentQuestions.length) return;
  state.currentQuestionIndex = index;
  renderQuestion(index);
}

// Timer
function startTimer() {
  clearInterval(state.timerInterval);

  const display = document.getElementById('timer-display');
  const timerEl = document.getElementById('quiz-timer');

  const tick = () => {
    state.timerSeconds--;
    display.textContent = formatTime(state.timerSeconds);

    const warningThreshold = state.currentQuestions.length * 15; // 15s/q
    if (state.timerSeconds <= warningThreshold) {
      timerEl.classList.add('warning');
    }

    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
      showToast('Time is up! Submitting your answers…', 'info');
      submitQuiz(true);
    }
  };

  display.textContent = formatTime(state.timerSeconds);
  state.timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

// Quiz navigation buttons
document.getElementById('btn-prev').addEventListener('click', () => {
  navigateToQuestion(state.currentQuestionIndex - 1);
});

document.getElementById('btn-next').addEventListener('click', () => {
  navigateToQuestion(state.currentQuestionIndex + 1);
});

document.getElementById('btn-submit').addEventListener('click', () => {
  const answeredCount = Object.keys(state.answers).length;
  const total = state.currentQuestions.length;

  if (answeredCount < total) {
    const skipped = total - answeredCount;
    const confirmed = window.confirm(
      `You have ${skipped} unanswered question(s). Submit anyway?`
    );
    if (!confirmed) return;
  }

  submitQuiz(false);
});

// Quit quiz
document.getElementById('btn-quit-quiz').addEventListener('click', () => {
  openModal('confirm-overlay');
});

document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
  closeModal('confirm-overlay');
});

document.getElementById('btn-confirm-quit').addEventListener('click', () => {
  closeModal('confirm-overlay');
  stopTimer();
  state.isQuizActive = false;
  showView('home');
  showToast('Quiz abandoned.', 'info');
});

/* ================================================================
   QUIZ SUBMISSION
   ================================================================ */

async function submitQuiz(autoSubmit = false) {
  stopTimer();
  state.isQuizActive = false;

  const timeTaken = Math.round((Date.now() - state.quizStartTime) / 1000);

  // Build answers array (fill skipped with -1)
  const answersPayload = state.currentQuestions.map((q, i) => ({
    questionId: q._id,
    selectedOptionIndex:
      state.answers[i] !== undefined ? state.answers[i] : -1,
  }));

  // Show submitting state
  document.getElementById('btn-submit').textContent = 'Submitting…';
  document.getElementById('btn-submit').disabled = true;

  try {
    const data = await apiFetch('/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({
        studentName: state.studentName,
        rollNumber: state.rollNumber,
        domainId: state.currentDomain._id,
        answers: answersPayload,
        timeTaken,
      }),
    });

    state.lastResult = data.data;
    renderResult(data.data);
    showView('result');

    if (autoSubmit) {
      showToast('Quiz auto-submitted due to time limit!', 'info');
    }
  } catch (err) {
    showToast(`Submission failed: ${err.message}`, 'error');
    document.getElementById('btn-submit').textContent = 'Submit Quiz 🚀';
    document.getElementById('btn-submit').disabled = false;
  }
}

/* ================================================================
   RESULT VIEW
   ================================================================ */

function renderResult(result) {
  const { score, totalQuestions, percentage, grade, timeTaken, answers, domainName } = result;

  // Score ring
  const circumference = 2 * Math.PI * 60; // r=60
  const ring = document.getElementById('ring-fill');
  ring.style.strokeDasharray = circumference;

  // Animate ring after a tick
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const offset = circumference - (percentage / 100) * circumference;
      ring.style.strokeDashoffset = offset;
    });
  });

  // Ring color based on grade
  ring.className = 'ring-fill';
  if (percentage >= 75) ring.classList.add('success');
  else if (percentage >= 50) ring.classList.add('warning');
  else ring.classList.add('danger');

  // Text
  document.getElementById('result-pct').textContent = `${percentage}%`;
  document.getElementById('result-grade').textContent = grade;
  document.getElementById('result-score').textContent = `${score} / ${totalQuestions}`;

  const labels = {
    'A+': '🏆 Outstanding! Perfect-near performance!',
    A: '⭐ Excellent work! Keep it up!',
    'B+': '👍 Great job! A bit more polish needed.',
    B: '😊 Good performance! Keep practicing.',
    C: '📚 Average score. Review the material.',
    D: '💪 Below average. More practice needed.',
    F: '❗ Needs significant improvement.',
  };
  document.getElementById('result-label').textContent =
    labels[grade] || 'Quiz Complete!';

  const correct = answers.filter((a) => a.isCorrect).length;
  const wrong = answers.filter((a) => !a.isCorrect).length;

  document.getElementById('result-correct').textContent = `${correct} Correct`;
  document.getElementById('result-wrong').textContent = `${wrong} Wrong`;
  document.getElementById('result-time').textContent = formatTime(timeTaken);

  // Review list (show all — correct collapsed, wrong expanded)
  const reviewList = document.getElementById('review-list');
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  if (!answers || answers.length === 0) {
    reviewList.innerHTML = '<p style="color: var(--text-secondary);">No answer details available.</p>';
    return;
  }

  reviewList.innerHTML = answers
    .map((ans, i) => {
      const isCorrect = ans.isCorrect;
      const userIdx = ans.selectedOptionIndex;
      const correctIdx = ans.correctOptionIndex;

      let userAnswerHtml = '';
      if (userIdx === -1) {
        userAnswerHtml = `
          <div class="review-answer user-wrong">
            <span class="answer-icon">⏭️</span>
            <span>Skipped / Not answered</span>
          </div>
        `;
      } else if (!isCorrect) {
        userAnswerHtml = `
          <div class="review-answer user-wrong">
            <span class="answer-icon">❌</span>
            <span>Your answer: <strong>${letters[userIdx]}. ${escapeHtml(ans.options[userIdx] || '')}</strong></span>
          </div>
        `;
      } else {
        userAnswerHtml = `
          <div class="review-answer user-correct">
            <span class="answer-icon">✅</span>
            <span>Your answer: <strong>${letters[userIdx]}. ${escapeHtml(ans.options[userIdx] || '')}</strong></span>
          </div>
        `;
      }

      const correctHtml = !isCorrect
        ? `<div class="review-answer correct-answer">
            <span class="answer-icon">✔️</span>
            <span>Correct: <strong>${letters[correctIdx]}. ${escapeHtml(ans.options[correctIdx] || '')}</strong></span>
          </div>`
        : '';

      const explanationHtml = (!isCorrect && ans.explanation)
        ? `<div class="review-explanation">
            <strong>💡 Explanation:</strong> ${escapeHtml(ans.explanation)}
          </div>`
        : '';

      return `
        <div class="review-item ${isCorrect ? 'correct-item' : 'wrong-item'}">
          <div class="review-q-num">Q${i + 1} · ${isCorrect ? 'Correct ✅' : 'Incorrect ❌'}</div>
          <p class="review-prompt">${escapeHtml(ans.prompt)}</p>
          <div class="review-answers">
            ${userAnswerHtml}
            ${correctHtml}
          </div>
          ${explanationHtml}
        </div>
      `;
    })
    .join('');
}

// Result action buttons
document.getElementById('btn-retake').addEventListener('click', async () => {
  if (state.currentDomain) {
    await startQuiz(state.currentDomain);
  }
});

document.getElementById('btn-back-home').addEventListener('click', () => {
  showView('home');
});

document.getElementById('btn-view-history').addEventListener('click', () => {
  showView('history');
  document.getElementById('history-roll-input').value = state.rollNumber;
  if (state.rollNumber) searchHistory(state.rollNumber);
});

/* ================================================================
   HISTORY VIEW
   ================================================================ */

async function searchHistory(rollNumber) {
  const content = document.getElementById('history-content');
  const statsSection = document.getElementById('history-stats');

  content.innerHTML = `
    <div class="loading-spinner" style="padding: 48px 0">
      <div class="spinner"></div>
      <p>Fetching history for ${escapeHtml(rollNumber)}…</p>
    </div>
  `;
  statsSection.style.display = 'none';

  try {
    const data = await apiFetch(`/quiz/history/${encodeURIComponent(rollNumber)}`);

    if (data.count === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>No history found</h3>
          <p>No quiz attempts found for roll number <strong>${escapeHtml(rollNumber)}</strong>.</p>
        </div>
      `;
      return;
    }

    // Stats
    const { stats, data: attempts } = data;
    statsSection.style.display = 'block';
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-card-value">${stats.totalAttempts}</div>
        <div class="stat-card-label">Total Attempts</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${stats.averagePercentage}%</div>
        <div class="stat-card-label">Average Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${stats.bestPercentage}%</div>
        <div class="stat-card-label">Best Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${stats.uniqueDomainsAttempted}</div>
        <div class="stat-card-label">Domains Attempted</div>
      </div>
    `;

    // Table
    const gradeClass = (g) => `grade-${(g || 'F').replace('+', '-plus')}`;
    const barColor = (pct) => {
      if (pct >= 75) return 'var(--accent-success)';
      if (pct >= 50) return 'var(--accent-warning)';
      return 'var(--accent-danger)';
    };

    content.innerHTML = `
      <div class="history-table-wrapper">
        <table class="history-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Domain</th>
              <th>Score</th>
              <th>Performance</th>
              <th>Grade</th>
              <th>Time Taken</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${attempts
              .map(
                (a, i) => `
              <tr>
                <td style="color: var(--text-muted)">${i + 1}</td>
                <td style="font-weight: 600">${escapeHtml(a.domainName || '—')}</td>
                <td style="font-family: var(--font-mono)">${a.score} / ${a.totalQuestions}</td>
                <td>
                  <div class="score-bar">
                    <div class="score-bar-track">
                      <div class="score-bar-fill" style="width: ${a.percentage}%; background: ${barColor(a.percentage)}"></div>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap">${a.percentage}%</span>
                  </div>
                </td>
                <td><span class="grade-badge ${gradeClass(a.grade)}">${a.grade}</span></td>
                <td style="color: var(--text-secondary); font-family: var(--font-mono)">${formatTime(a.timeTaken || 0)}</td>
                <td style="color: var(--text-muted); font-size: 0.8rem; white-space: nowrap">${formatDate(a.completedAt)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Error fetching history</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
    showToast(`History fetch failed: ${err.message}`, 'error');
  }
}

document.getElementById('btn-search-history').addEventListener('click', () => {
  const roll = document.getElementById('history-roll-input').value.trim();
  if (!roll) {
    showToast('Please enter a Roll Number', 'error');
    document.getElementById('history-roll-input').focus();
    return;
  }
  searchHistory(roll.toUpperCase());
});

document.getElementById('history-roll-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-search-history').click();
  }
});

/* ================================================================
   NAVIGATION
   ================================================================ */

document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (view === 'quiz' && !state.isQuizActive) return; // don't navigate to quiz via nav
    if (view === 'history') {
      showView('history');
    } else {
      showView('home');
    }
  });
});

document.getElementById('logo-link').addEventListener('click', (e) => {
  e.preventDefault();
  if (state.isQuizActive) {
    openModal('confirm-overlay');
  } else {
    showView('home');
  }
});

/* ================================================================
   KEYBOARD SHORTCUTS
   ================================================================ */

document.addEventListener('keydown', (e) => {
  if (!state.isQuizActive) return;

  const key = e.key;

  // A-F keys to select options
  const optionKeys = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
  if (optionKeys[key.toLowerCase()] !== undefined && !e.ctrlKey && !e.metaKey) {
    const target = document.querySelector(`.option-btn[data-option="${optionKeys[key.toLowerCase()]}"]`);
    if (target) target.click();
    return;
  }

  // Arrow keys for navigation
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    e.preventDefault();
    navigateToQuestion(state.currentQuestionIndex + 1);
  } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
    e.preventDefault();
    navigateToQuestion(state.currentQuestionIndex - 1);
  }

  // Enter to go next
  if (key === 'Enter' && state.answers[state.currentQuestionIndex] !== undefined) {
    const nextBtn = document.getElementById('btn-next');
    const submitBtn = document.getElementById('btn-submit');
    if (nextBtn.style.display !== 'none') nextBtn.click();
    else if (submitBtn.style.display !== 'none') submitBtn.click();
  }
});

/* ================================================================
   INIT
   ================================================================ */

(async function init() {
  // Load domains on startup
  await loadDomains();

  // Verify API health
  try {
    const health = await apiFetch('/health');
    if (health.db !== 'connected') {
      showToast('Database offline — some features may be unavailable', 'error', 5000);
    }
  } catch (_) {
    // Server health check failure — likely server is down
  }
})();
