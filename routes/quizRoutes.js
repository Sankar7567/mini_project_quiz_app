const express = require('express');
const router = express.Router();
const {
  submitQuiz,
  getQuizHistory,
  getLeaderboard,
  getAttemptById,
} = require('../controllers/quizController');

// Submit quiz answers
router.post('/submit', submitQuiz);

// Get quiz history by roll number
router.get('/history/:rollNo', getQuizHistory);

// Get leaderboard for a domain
router.get('/leaderboard/:domainId', getLeaderboard);

// Get single attempt
router.get('/attempt/:id', getAttemptById);

module.exports = router;
