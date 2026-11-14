const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Resolved'],
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide an issue title'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide a detailed description'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      enum: {
        values: [
          'Pothole',
          'Broken Streetlight',
          'Garbage',
          'Water Leakage',
          'Drainage',
          'Road Damage',
          'Other',
        ],
        message: 'Invalid issue category selected',
      },
    },
    imageUrl: {
      type: String,
      required: [true, 'Please provide a photo of the issue'],
    },
    imagePublicId: {
      type: String,
      default: '',
    },
    latitude: {
      type: Number,
      required: [true, 'Valid GPS latitude coordinate is required'],
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: [true, 'Valid GPS longitude coordinate is required'],
      min: -180,
      max: 180,
    },
    address: {
      type: String,
      trim: true,
      default: 'Location captured via GPS',
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'In Progress', 'Resolved'],
        message: 'Status must be Pending, In Progress, or Resolved',
      },
      default: 'Pending',
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Complaint must be associated with a user'],
    },
    adminNote: {
      type: String,
      default: '',
      trim: true,
    },
    resolutionImageUrl: {
      type: String,
      default: '',
    },
    statusHistory: [statusHistorySchema],
  },
  {
    timestamps: true,
  }
);

// Indexes for high performance querying
issueSchema.index({ status: 1 });
issueSchema.index({ category: 1 });
issueSchema.index({ reportedBy: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ latitude: 1, longitude: 1 });

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;
