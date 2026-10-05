const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Option text is required'],
      trim: true,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Domain',
      required: [true, 'Domain reference is required'],
      index: true,
    },
    prompt: {
      type: String,
      required: [true, 'Question prompt is required'],
      trim: true,
      maxlength: [1000, 'Question prompt cannot exceed 1000 characters'],
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: function (opts) {
          return opts.length >= 2 && opts.length <= 6;
        },
        message: 'A question must have between 2 and 6 options',
      },
      required: [true, 'Options are required'],
    },
    correctOptionIndex: {
      type: Number,
      required: [true, 'Correct option index is required'],
      min: [0, 'Correct option index must be non-negative'],
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
      default: 'Refer to the official documentation for more details.',
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
    points: {
      type: Number,
      default: 1,
      min: [1, 'Points must be at least 1'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying
questionSchema.index({ domainId: 1, isActive: 1 });

// Validate correctOptionIndex is within options array bounds
questionSchema.pre('save', function (next) {
  if (this.correctOptionIndex >= this.options.length) {
    return next(
      new Error(
        `Correct option index (${this.correctOptionIndex}) is out of bounds for options array of length ${this.options.length}`
      )
    );
  }
  next();
});

module.exports = mongoose.model('Question', questionSchema);
