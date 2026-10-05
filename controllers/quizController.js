const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');
const Domain = require('../models/Domain');

// @desc    Submit quiz answers & calculate score
// @route   POST /api/quiz/submit
const submitQuiz = async (req, res, next) => {
  try {
    const { studentName, rollNumber, domainId, answers, timeTaken } = req.body;

    // Validate required fields
    if (!studentName || !rollNumber || !domainId || !answers) {
      return res.status(400).json({
        success: false,
        message: 'studentName, rollNumber, domainId, and answers are required',
      });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Answers must be a non-empty array',
      });
    }

    // Verify domain exists
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found',
      });
    }

    // Fetch all questions for this submission with correct answers
    const questionIds = answers.map((a) => a.questionId);
    const questions = await Question.find({
      _id: { $in: questionIds },
      domainId: domainId,
      isActive: true,
    }).lean();

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid questions found for this domain',
      });
    }

    // Build a lookup map for quick access
    const questionMap = {};
    questions.forEach((q) => {
      questionMap[q._id.toString()] = q;
    });

    // Grade each answer
    let score = 0;
    const gradedAnswers = [];

    for (const answer of answers) {
      const qId = answer.questionId?.toString();
      const question = questionMap[qId];

      if (!question) continue; // Skip unknown question ids

      const selectedIdx =
        answer.selectedOptionIndex !== undefined
          ? answer.selectedOptionIndex
          : -1;
      const isCorrect = selectedIdx === question.correctOptionIndex;

      if (isCorrect) score += question.points || 1;

      gradedAnswers.push({
        questionId: question._id,
        selectedOptionIndex: selectedIdx,
        isCorrect,
        correctOptionIndex: question.correctOptionIndex,
        prompt: question.prompt,
        options: question.options.map((o) => o.text),
        explanation: question.explanation || '',
      });
    }

    // Save attempt to DB
    const attempt = await QuizAttempt.create({
      studentName: studentName.trim(),
      rollNumber: rollNumber.trim().toUpperCase(),
      domainId,
      domainName: domain.name,
      score,
      totalQuestions: gradedAnswers.length,
      timeTaken: timeTaken || 0,
      answers: gradedAnswers,
      completedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      data: {
        attemptId: attempt._id,
        studentName: attempt.studentName,
        rollNumber: attempt.rollNumber,
        domainName: attempt.domainName,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage,
        grade: attempt.grade,
        timeTaken: attempt.timeTaken,
        answers: attempt.answers,
        completedAt: attempt.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get quiz history for a student by roll number
// @route   GET /api/quiz/history/:rollNo
const getQuizHistory = async (req, res, next) => {
  try {
    const rollNumber = req.params.rollNo.toUpperCase();

    const attempts = await QuizAttempt.find({ rollNumber })
      .sort({ completedAt: -1 })
      .populate('domainId', 'name icon color')
      .select('-answers -__v')
      .lean();

    if (attempts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No quiz history found for this roll number',
        count: 0,
        data: [],
        stats: null,
      });
    }

    // Compute aggregate statistics
    const totalAttempts = attempts.length;
    const avgScore =
      attempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts;
    const bestScore = Math.max(...attempts.map((a) => a.percentage));
    const totalQuizzesCompleted = new Set(
      attempts.map((a) => a.domainId?._id?.toString())
    ).size;

    res.status(200).json({
      success: true,
      count: totalAttempts,
      data: attempts,
      stats: {
        totalAttempts,
        averagePercentage: parseFloat(avgScore.toFixed(2)),
        bestPercentage: bestScore,
        uniqueDomainsAttempted: totalQuizzesCompleted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leaderboard for a domain
// @route   GET /api/quiz/leaderboard/:domainId
const getLeaderboard = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const leaderboard = await QuizAttempt.aggregate([
      { $match: { domainId: require('mongoose').Types.ObjectId.createFromHexString(domainId) } },
      {
        $group: {
          _id: '$rollNumber',
          studentName: { $first: '$studentName' },
          rollNumber: { $first: '$rollNumber' },
          bestScore: { $max: '$score' },
          bestPercentage: { $max: '$percentage' },
          bestGrade: { $first: '$grade' },
          attempts: { $sum: 1 },
          lastAttempt: { $max: '$completedAt' },
        },
      },
      { $sort: { bestScore: -1, lastAttempt: 1 } },
      { $limit: limit },
    ]);

    res.status(200).json({
      success: true,
      count: leaderboard.length,
      data: leaderboard,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single attempt by ID
// @route   GET /api/quiz/attempt/:id
const getAttemptById = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.id)
      .populate('domainId', 'name icon color')
      .select('-__v');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found',
      });
    }

    res.status(200).json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitQuiz,
  getQuizHistory,
  getLeaderboard,
  getAttemptById,
};
