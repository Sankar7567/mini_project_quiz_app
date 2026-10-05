const Question = require('../models/Question');
const Domain = require('../models/Domain');

// @desc    Get all questions for a domain
// @route   GET /api/domains/:id/questions
const getQuestionsByDomain = async (req, res, next) => {
  try {
    const domain = await Domain.findById(req.params.id);
    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found',
      });
    }

    const questions = await Question.find({
      domainId: req.params.id,
      isActive: true,
    })
      .select('-correctOptionIndex -explanation -__v') // hide answers from client
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      count: questions.length,
      domainName: domain.name,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single question by ID (admin)
// @route   GET /api/questions/:id
const getQuestionById = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('domainId', 'name')
      .select('-__v');

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a question
// @route   POST /api/questions
const createQuestion = async (req, res, next) => {
  try {
    const domain = await Domain.findById(req.body.domainId);
    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found',
      });
    }

    const question = await Question.create(req.body);

    res.status(201).json({
      success: true,
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a question
// @route   PUT /api/questions/:id
const updateQuestion = async (req, res, next) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a question (soft delete)
// @route   DELETE /api/questions/:id
const deleteQuestion = async (req, res, next) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Question deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuestionsByDomain,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
