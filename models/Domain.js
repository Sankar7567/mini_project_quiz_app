const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Domain name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Domain name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Domain description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    icon: {
      type: String,
      required: [true, 'Domain icon is required'],
      trim: true,
    },
    questionCount: {
      type: Number,
      default: 20,
      min: [1, 'Question count must be at least 1'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    color: {
      type: String,
      default: '#6c63ff',
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Intermediate',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug from name before saving
domainSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

// Virtual to get related questions count
domainSchema.virtual('questions', {
  ref: 'Question',
  localField: '_id',
  foreignField: 'domainId',
  count: true,
});

module.exports = mongoose.model('Domain', domainSchema);
