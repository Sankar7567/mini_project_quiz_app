const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selectedOptionIndex: {
      type: Number,
      required: true,
      min: -1, // -1 means skipped/not answered
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    correctOptionIndex: {
      type: Number,
      required: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
    },
    explanation: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      maxlength: [100, 'Student name cannot exceed 100 characters'],
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Roll number cannot exceed 20 characters'],
      index: true,
    },
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Domain',
      required: [true, 'Domain reference is required'],
    },
    domainName: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: [true, 'Score is required'],
      min: [0, 'Score cannot be negative'],
    },
    totalQuestions: {
      type: Number,
      required: [true, 'Total questions is required'],
      min: [1, 'Total questions must be at least 1'],
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    grade: {
      type: String,
      enum: ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'],
    },
    timeTaken: {
      type: Number, // in seconds
      default: 0,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate percentage and grade before saving
quizAttemptSchema.pre('save', function (next) {
  this.percentage = parseFloat(
    ((this.score / this.totalQuestions) * 100).toFixed(2)
  );

  const pct = this.percentage;
  if (pct >= 95) this.grade = 'A+';
  else if (pct >= 85) this.grade = 'A';
  else if (pct >= 75) this.grade = 'B+';
  else if (pct >= 65) this.grade = 'B';
  else if (pct >= 50) this.grade = 'C';
  else if (pct >= 35) this.grade = 'D';
  else this.grade = 'F';

  next();
});

// Compound index for leaderboard queries
quizAttemptSchema.index({ domainId: 1, score: -1 });
quizAttemptSchema.index({ rollNumber: 1, completedAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
