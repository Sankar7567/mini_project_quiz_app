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
  timerSeconds: 30 * 60,   // default 30 minutes
  isQuizActive: false,
  lastResult: null,
  isSubmitting: false,
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
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
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
  if (str === null || str === undefined) return '';
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
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Format date to a readable string
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleString('en-IN', {
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
    if (!el) return;
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
  if (!overlay) return;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
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

  if (loading) loading.style.display = 'flex';
  if (grid) grid.style.display = 'none';
  if (error) error.style.display = 'none';

  try {
    const data = await apiFetch('/domains');
    state.domains = data.data || [];

    if (loading) loading.style.display = 'none';
    renderDomains(state.domains);
    if (grid) grid.style.display = 'grid';
  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'block';
    showToast(`Failed to load domains: ${err.message}`, 'error');
  }
}

function renderDomains(domains) {
  const grid = document.getElementById('domains-grid');
  if (!grid) return;

  grid.innerHTML = (domains || [])
    .map(
      (domain) => `
    <div class="domain-card" data-id="${domain._id}" style="--card-color: ${domain.color || '#6c63ff'}">
      <div class="domain-icon">${domain.icon || '📚'}</div>
      <div class="domain-info">
        <h3 class="domain-name">${escapeHtml(domain.name)}</h3>
        <p class="domain-desc">${escapeHtml(domain.description)}</p>
      </div>
      <div class="domain-meta">
        <div class="domain-badge">
          <div class="badge-dot"></div>
          ${domain.questionCount || 20} Questions · ${domain.difficulty || 'Intermediate'}
        </div>
        <button class="btn-start" data-id="${domain._id}">Start →</button>
      </div>
    </div>
  `
    )
    .join('');

  // Event delegation for domain card clicks
  grid.onclick = (e) => {
    const startBtn = e.target.closest('.btn-start');
    const card = e.target.closest('.domain-card');

    if (startBtn || card) {
      const domainId = (startBtn || card).dataset.id;
      const domain = state.domains.find((d) => d._id === domainId);
      if (domain) openRegistrationModal(domain);
    }
  };
}

/* ================================================================
   REGISTRATION MODAL
   ================================================================ */

function openRegistrationModal(domain) {
  state.currentDomain = domain;

  const iconEl = document.getElementById('modal-domain-icon');
  if (iconEl) iconEl.textContent = domain.icon || '📚';

  const subtitleEl = document.getElementById('modal-domain-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `${domain.name} · ${domain.questionCount || 20} Questions · 30 minutes`;
  }

  // Pre-fill if we have saved data
  const nameInput = document.getElementById('input-name');
  const rollInput = document.getElementById('input-roll');
  if (nameInput) nameInput.value = state.studentName;
  if (rollInput) rollInput.value = state.rollNumber;

  // Clear errors
  const errName = document.getElementById('err-name');
  const errRoll = document.getElementById('err-roll');
  if (errName) errName.classList.remove('visible');
  if (errRoll) errRoll.classList.remove('visible');

  openModal('register-overlay');

  // Focus first empty field
  setTimeout(() => {
    if (nameInput && rollInput) {
      (nameInput.value ? rollInput : nameInput).focus();
    }
  }, 150);
}

function validateRegistrationForm() {
  const nameInput = document.getElementById('input-name');
  const rollInput = document.getElementById('input-roll');
  const name = nameInput ? nameInput.value.trim() : '';
  const roll = rollInput ? rollInput.value.trim() : '';

  let valid = true;

  const errName = document.getElementById('err-name');
  if (!name || name.length < 2) {
    if (errName) errName.classList.add('visible');
    valid = false;
  } else {
    if (errName) errName.classList.remove('visible');
  }

  const errRoll = document.getElementById('err-roll');
  if (!roll || !/^[a-zA-Z0-9]{3,20}$/.test(roll)) {
    if (errRoll) errRoll.classList.add('visible');
    valid = false;
  } else {
    if (errRoll) errRoll.classList.remove('visible');
  }

  return valid ? { name, roll } : null;
}

document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = validateRegistrationForm();
  if (!formData) return;

  state.studentName = formData.name;
  state.rollNumber = formData.roll.toUpperCase();

  closeModal('register-overlay');
  await startQuiz(state.currentDomain);
});

document.getElementById('modal-close-btn')?.addEventListener('click', () => {
  closeModal('register-overlay');
});

/* ================================================================
   QUIZ ENGINE
   ================================================================ */

async function startQuiz(domain) {
  showView('quiz');

  // Show loading state
  const promptEl = document.getElementById('question-prompt');
  if (promptEl) promptEl.textContent = 'Loading questions…';

  const gridEl = document.getElementById('options-grid');
  if (gridEl) {
    gridEl.innerHTML = `
      <div class="loading-spinner" style="padding: 40px 0">
        <div class="spinner"></div>
      </div>
    `;
  }

  // Reset submit button state
  const submitBtn = document.getElementById('btn-submit');
  if (submitBtn) {
    submitBtn.textContent = 'Submit Quiz 🚀';
    submitBtn.disabled = false;
  }
  state.isSubmitting = false;

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
    const domainIconEl = document.getElementById('quiz-domain-icon');
    if (domainIconEl) domainIconEl.textContent = domain.icon || '📚';

    const domainLabelEl = document.getElementById('quiz-domain-label');
    if (domainLabelEl) domainLabelEl.textContent = domain.name;

    const qTotalEl = document.getElementById('q-total');
    if (qTotalEl) qTotalEl.textContent = data.data.length;

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
  if (!container) return;

  container.innerHTML = Array.from(
    { length: count },
    (_, i) => `
    <button class="q-dot ${i === 0 ? 'current' : ''}" data-index="${i}" title="Question ${i + 1}">
      ${i + 1}
    </button>
  `
  ).join('');

  container.onclick = (e) => {
    const dot = e.target.closest('.q-dot');
    if (dot) {
      navigateToQuestion(parseInt(dot.dataset.index, 10));
    }
  };
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
  if (!state.currentQuestions || state.currentQuestions.length === 0) return;
  const q = state.currentQuestions[index];
  if (!q) return;

  const total = state.currentQuestions.length;

  // Progress
  const pct = Math.round(((index + 1) / total) * 100);
  const qCurrentEl = document.getElementById('q-current');
  if (qCurrentEl) qCurrentEl.textContent = index + 1;

  const pctEl = document.getElementById('progress-pct');
  if (pctEl) pctEl.textContent = `${pct}%`;

  const barEl = document.getElementById('progress-bar');
  if (barEl) barEl.style.width = `${pct}%`;

  // Question Prompt
  const numEl = document.getElementById('question-num');
  if (numEl) numEl.textContent = `Question ${index + 1}`;

  const promptEl = document.getElementById('question-prompt');
  if (promptEl) promptEl.textContent = q.prompt;

  // Options
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const savedAnswer = state.answers[index];
  const optionsHtml = (q.options || [])
    .map((opt, i) => {
      const isSelected = savedAnswer === i;
      const optText = typeof opt === 'string' ? opt : opt.text;
      return `
      <button class="option-btn ${isSelected ? 'selected' : ''}" data-option="${i}">
        <div class="option-letter">${letters[i] || i + 1}</div>
        <div class="option-text">${escapeHtml(optText)}</div>
      </button>
    `;
    })
    .join('');

  const gridEl = document.getElementById('options-grid');
  if (gridEl) {
    gridEl.innerHTML = optionsHtml;
    gridEl.querySelectorAll('.option-btn').forEach((btn) => {
      btn.onclick = () => selectOption(parseInt(btn.dataset.option, 10));
    });
  }

  // Navigation buttons
  const prevBtn = document.getElementById('btn-prev');
  if (prevBtn) prevBtn.disabled = index === 0;

  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.style.display = index === total - 1 ? 'none' : 'inline-flex';

  const submitBtn = document.getElementById('btn-submit');
  if (submitBtn) {
    submitBtn.style.display = index === total - 1 ? 'inline-flex' : 'none';
  }

  updateDots();
}

function selectOption(optionIndex) {
  state.answers[state.currentQuestionIndex] = optionIndex;

  // Update UI selection
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
    if (display) display.textContent = formatTime(state.timerSeconds);

    const warningThreshold = state.currentQuestions.length * 15; // 15s/q
    if (timerEl && state.timerSeconds <= warningThreshold) {
      timerEl.classList.add('warning');
    }

    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
      showToast('Time is up! Submitting your answers…', 'info');
      submitQuiz(true);
    }
  };

  if (display) display.textContent = formatTime(state.timerSeconds);
  state.timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

// Quiz navigation buttons
document.getElementById('btn-prev')?.addEventListener('click', () => {
  navigateToQuestion(state.currentQuestionIndex - 1);
});

document.getElementById('btn-next')?.addEventListener('click', () => {
  navigateToQuestion(state.currentQuestionIndex + 1);
});

document.getElementById('btn-submit')?.addEventListener('click', () => {
  if (state.isSubmitting) return;

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

// Quit quiz modal controls
document.getElementById('btn-quit-quiz')?.addEventListener('click', () => {
  openModal('confirm-overlay');
});

document.getElementById('btn-confirm-cancel')?.addEventListener('click', () => {
  closeModal('confirm-overlay');
});

document.getElementById('btn-confirm-quit')?.addEventListener('click', () => {
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
  if (state.isSubmitting) return;
  state.isSubmitting = true;

  stopTimer();
  state.isQuizActive = false;

  const timeTaken = Math.max(
    1,
    Math.round((Date.now() - (state.quizStartTime || Date.now())) / 1000)
  );

  // Build answers array (fill skipped with -1)
  const answersPayload = (state.currentQuestions || []).map((q, i) => ({
    questionId: q._id,
    selectedOptionIndex:
      state.answers[i] !== undefined ? state.answers[i] : -1,
  }));

  // Update button state
  const submitBtn = document.getElementById('btn-submit');
  if (submitBtn) {
    submitBtn.textContent = 'Submitting…';
    submitBtn.disabled = true;
  }

  let submissionResult = null;

  try {
    const data = await apiFetch('/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({
        studentName: state.studentName,
        rollNumber: state.rollNumber,
        domainId: state.currentDomain ? state.currentDomain._id : '',
        answers: answersPayload,
        timeTaken,
      }),
    });

    submissionResult = data.data;
    state.lastResult = data.data;
  } catch (err) {
    showToast(`Submission failed: ${err.message}`, 'error');
    if (submitBtn) {
      submitBtn.textContent = 'Submit Quiz 🚀';
      submitBtn.disabled = false;
    }
    state.isSubmitting = false;
    return;
  }

  // Render results cleanly
  try {
    renderResult(submissionResult);
    showView('result');
    if (autoSubmit) {
      showToast('Quiz auto-submitted due to time limit!', 'info');
    }
  } catch (renderErr) {
    console.error('Error rendering result view:', renderErr);
    showView('result');
  } finally {
    if (submitBtn) {
      submitBtn.textContent = 'Submit Quiz 🚀';
      submitBtn.disabled = false;
    }
    state.isSubmitting = false;
  }
}

/* ================================================================
   RESULT VIEW
   ================================================================ */

function renderResult(result) {
  if (!result) return;
  const {
    score = 0,
    totalQuestions = 0,
    percentage = 0,
    grade = 'F',
    timeTaken = 0,
    answers = [],
  } = result;

  // Score ring animation
  const circumference = 2 * Math.PI * 60; // r=60
  const ring = document.getElementById('ring-fill');
  if (ring) {
    ring.style.strokeDasharray = `${circumference}`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const offset =
          circumference - ((percentage || 0) / 100) * circumference;
        ring.style.strokeDashoffset = `${offset}`;
      });
    });

    // Use setAttribute('class', ...) for SVG elements to avoid getter-only error!
    let ringClass = 'ring-fill';
    if (percentage >= 75) ringClass += ' success';
    else if (percentage >= 50) ringClass += ' warning';
    else ringClass += ' danger';
    ring.setAttribute('class', ringClass);
  }

  // Text Elements
  const pctEl = document.getElementById('result-pct');
  if (pctEl) pctEl.textContent = `${percentage}%`;

  const gradeEl = document.getElementById('result-grade');
  if (gradeEl) gradeEl.textContent = grade;

  const scoreEl = document.getElementById('result-score');
  if (scoreEl) scoreEl.textContent = `${score} / ${totalQuestions}`;

  const labels = {
    'A+': '🏆 Outstanding! Perfect-near performance!',
    A: '⭐ Excellent work! Keep it up!',
    'B+': '👍 Great job! A bit more polish needed.',
    B: '😊 Good performance! Keep practicing.',
    C: '📚 Average score. Review the material.',
    D: '💪 Below average. More practice needed.',
    F: '❗ Needs significant improvement.',
  };

  const labelEl = document.getElementById('result-label');
  if (labelEl) labelEl.textContent = labels[grade] || 'Quiz Complete!';

  const correct = (answers || []).filter((a) => a && a.isCorrect).length;
  const wrong = (answers || []).filter((a) => a && !a.isCorrect).length;

  const correctEl = document.getElementById('result-correct');
  if (correctEl) correctEl.textContent = `${correct} Correct`;

  const wrongEl = document.getElementById('result-wrong');
  if (wrongEl) wrongEl.textContent = `${wrong} Wrong`;

  const timeEl = document.getElementById('result-time');
  if (timeEl) timeEl.textContent = formatTime(timeTaken);

  // Review List
  const reviewList = document.getElementById('review-list');
  if (!reviewList) return;

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  if (!answers || answers.length === 0) {
    reviewList.innerHTML =
      '<p style="color: var(--text-secondary);">No answer details available.</p>';
    return;
  }

  reviewList.innerHTML = answers
    .map((ans, i) => {
      if (!ans) return '';
      const isCorrect = !!ans.isCorrect;
      const userIdx =
        ans.selectedOptionIndex !== undefined ? ans.selectedOptionIndex : -1;
      const correctIdx =
        ans.correctOptionIndex !== undefined ? ans.correctOptionIndex : 0;
      const options = Array.isArray(ans.options) ? ans.options : [];

      let userAnswerHtml = '';
      if (userIdx === -1 || userIdx === null || userIdx < 0) {
        userAnswerHtml = `
          <div class="review-answer user-wrong">
            <span class="answer-icon">⏭️</span>
            <span>Skipped / Not answered</span>
          </div>
        `;
      } else if (!isCorrect) {
        const letter = letters[userIdx] || `Option ${userIdx + 1}`;
        const text = options[userIdx] || '';
        userAnswerHtml = `
          <div class="review-answer user-wrong">
            <span class="answer-icon">❌</span>
            <span>Your answer: <strong>${letter}. ${escapeHtml(text)}</strong></span>
          </div>
        `;
      } else {
        const letter = letters[userIdx] || `Option ${userIdx + 1}`;
        const text = options[userIdx] || '';
        userAnswerHtml = `
          <div class="review-answer user-correct">
            <span class="answer-icon">✅</span>
            <span>Your answer: <strong>${letter}. ${escapeHtml(text)}</strong></span>
          </div>
        `;
      }

      const correctLetter = letters[correctIdx] || `Option ${correctIdx + 1}`;
      const correctText = options[correctIdx] || '';
      const correctHtml = !isCorrect
        ? `<div class="review-answer correct-answer">
            <span class="answer-icon">✔️</span>
            <span>Correct: <strong>${correctLetter}. ${escapeHtml(correctText)}</strong></span>
          </div>`
        : '';

      const explanationHtml =
        !isCorrect && ans.explanation
          ? `<div class="review-explanation">
              <strong>💡 Explanation:</strong> ${escapeHtml(ans.explanation)}
            </div>`
          : '';

      return `
        <div class="review-item ${isCorrect ? 'correct-item' : 'wrong-item'}">
          <div class="review-q-num">Q${i + 1} · ${isCorrect ? 'Correct ✅' : 'Incorrect ❌'}</div>
          <p class="review-prompt">${escapeHtml(ans.prompt || '')}</p>
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
document.getElementById('btn-retake')?.addEventListener('click', async () => {
  if (state.currentDomain) {
    await startQuiz(state.currentDomain);
  } else {
    showView('home');
  }
});

document.getElementById('btn-back-home')?.addEventListener('click', () => {
  showView('home');
});

document.getElementById('btn-view-history')?.addEventListener('click', () => {
  showView('history');
  const rollInput = document.getElementById('history-roll-input');
  if (rollInput) {
    rollInput.value = state.rollNumber;
    if (state.rollNumber) searchHistory(state.rollNumber);
  }
});

/* ================================================================
   HISTORY VIEW
   ================================================================ */

async function searchHistory(rollNumber) {
  const content = document.getElementById('history-content');
  const statsSection = document.getElementById('history-stats');

  if (content) {
    content.innerHTML = `
      <div class="loading-spinner" style="padding: 48px 0">
        <div class="spinner"></div>
        <p>Fetching history for ${escapeHtml(rollNumber)}…</p>
      </div>
    `;
  }
  if (statsSection) statsSection.style.display = 'none';

  try {
    const data = await apiFetch(`/quiz/history/${encodeURIComponent(rollNumber)}`);

    if (!data.data || data.data.length === 0) {
      if (content) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3>No history found</h3>
            <p>No quiz attempts found for roll number <strong>${escapeHtml(rollNumber)}</strong>.</p>
          </div>
        `;
      }
      return;
    }

    // Stats
    const { stats, data: attempts } = data;
    if (statsSection) statsSection.style.display = 'block';

    const statsGrid = document.getElementById('stats-grid');
    if (statsGrid && stats) {
      statsGrid.innerHTML = `
        <div class="stat-card">
          <div class="stat-card-value">${stats.totalAttempts || 0}</div>
          <div class="stat-card-label">Total Attempts</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${stats.averagePercentage || 0}%</div>
          <div class="stat-card-label">Average Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${stats.bestPercentage || 0}%</div>
          <div class="stat-card-label">Best Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${stats.uniqueDomainsAttempted || 0}</div>
          <div class="stat-card-label">Domains Attempted</div>
        </div>
      `;
    }

    // Table
    const gradeClass = (g) => `grade-${(g || 'F').replace('+', '-plus')}`;
    const barColor = (pct) => {
      if (pct >= 75) return 'var(--accent-success)';
      if (pct >= 50) return 'var(--accent-warning)';
      return 'var(--accent-danger)';
    };

    if (content) {
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
                  <td style="font-weight: 600">${escapeHtml(a.domainName || a.domainId?.name || '—')}</td>
                  <td style="font-family: var(--font-mono)">${a.score} / ${a.totalQuestions}</td>
                  <td>
                    <div class="score-bar">
                      <div class="score-bar-track">
                        <div class="score-bar-fill" style="width: ${a.percentage}%; background: ${barColor(a.percentage)}"></div>
                      </div>
                      <span style="font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap">${a.percentage}%</span>
                    </div>
                  </td>
                  <td><span class="grade-badge ${gradeClass(a.grade)}">${a.grade || 'F'}</span></td>
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
    }
  } catch (err) {
    if (content) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Error fetching history</h3>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    }
    showToast(`History fetch failed: ${err.message}`, 'error');
  }
}

document.getElementById('btn-search-history')?.addEventListener('click', () => {
  const rollInput = document.getElementById('history-roll-input');
  const roll = rollInput ? rollInput.value.trim() : '';
  if (!roll) {
    showToast('Please enter a Roll Number', 'error');
    if (rollInput) rollInput.focus();
    return;
  }
  searchHistory(roll.toUpperCase());
});

document.getElementById('history-roll-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-search-history')?.click();
  }
});

/* ================================================================
   NAVIGATION
   ================================================================ */

document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;

    if (state.isQuizActive) {
      openModal('confirm-overlay');
      return;
    }

    if (view === 'history') {
      showView('history');
      const rollInput = document.getElementById('history-roll-input');
      if (rollInput && state.rollNumber && !rollInput.value) {
        rollInput.value = state.rollNumber;
        searchHistory(state.rollNumber);
      }
    } else {
      showView('home');
    }
  });
});

document.getElementById('logo-link')?.addEventListener('click', (e) => {
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

  // Don't intercept if an input or textarea is currently focused
  if (
    e.target &&
    (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
  ) {
    return;
  }

  const key = e.key;

  // A-F keys to select options
  const optionKeys = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
  if (optionKeys[key.toLowerCase()] !== undefined && !e.ctrlKey && !e.metaKey) {
    const target = document.querySelector(
      `.option-btn[data-option="${optionKeys[key.toLowerCase()]}"]`
    );
    if (target) target.click();
    return;
  }

  // Arrow keys for question navigation
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    e.preventDefault();
    navigateToQuestion(state.currentQuestionIndex + 1);
  } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
    e.preventDefault();
    navigateToQuestion(state.currentQuestionIndex - 1);
  }

  // Enter to go next or submit
  if (
    key === 'Enter' &&
    state.answers[state.currentQuestionIndex] !== undefined
  ) {
    const nextBtn = document.getElementById('btn-next');
    const submitBtn = document.getElementById('btn-submit');
    if (nextBtn && nextBtn.style.display !== 'none') {
      nextBtn.click();
    } else if (submitBtn && submitBtn.style.display !== 'none') {
      submitBtn.click();
    }
  }
});

/* ================================================================
   INITIALIZATION
   ================================================================ */

(async function init() {
  await loadDomains();

  try {
    const health = await apiFetch('/health');
    if (health.db !== 'connected') {
      showToast(
        'Offline Mode: Running on mock dataset with full functionality.',
        'info',
        4000
      );
    }
  } catch (_) {
    // Health check skipped
  }
})();
