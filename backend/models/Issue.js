const mongoose = require('mongoose');

const ISSUE_STATUSES = [
  'Reported',
  'Under Review',
  'In Progress',
  'Resolved',
  'Pending', // Preserved for compatibility with earlier records
];

const URGENCY_LEVELS = ['Normal', 'High'];

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ISSUE_STATUSES,
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedByRole: {
      type: String,
      enum: ['citizen', 'admin'],
      default: 'admin',
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
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },
    address: {
      type: String,
      trim: true,
      default: 'Location captured via GPS',
    },
    status: {
      type: String,
      enum: {
        values: ISSUE_STATUSES,
        message: 'Status must be Reported, Under Review, In Progress, or Resolved',
      },
      default: 'Reported',
    },
    requestedUrgency: {
      type: String,
      enum: {
        values: URGENCY_LEVELS,
        message: 'Requested urgency must be Normal or High',
      },
      default: 'Normal',
    },
    confirmedUrgency: {
      type: String,
      enum: {
        values: URGENCY_LEVELS,
        message: 'Confirmed urgency must be Normal or High',
      },
      default: 'Normal',
    },
    supporters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    supportCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Complaint must be associated with a user'],
    },
    organization: {
      type: String,
      default: '',
      trim: true,
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

// Sync GeoJSON Point coordinates [longitude, latitude] & supportCount before save
issueSchema.pre('save', function (next) {
  if (
    typeof this.latitude === 'number' &&
    typeof this.longitude === 'number' &&
    Number.isFinite(this.latitude) &&
    Number.isFinite(this.longitude)
  ) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude],
    };
  }
  if (Array.isArray(this.supporters)) {
    this.supportCount = this.supporters.length;
  }
  next();
});

// Indexes for high performance querying
issueSchema.index({ status: 1 });
issueSchema.index({ category: 1 });
issueSchema.index({ reportedBy: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ supportCount: -1, createdAt: -1 });
issueSchema.index({ confirmedUrgency: 1, createdAt: -1 });
issueSchema.index({ latitude: 1, longitude: 1 });
issueSchema.index({ location: '2dsphere' });

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;
module.exports.ISSUE_STATUSES = ISSUE_STATUSES;
module.exports.URGENCY_LEVELS = URGENCY_LEVELS;
