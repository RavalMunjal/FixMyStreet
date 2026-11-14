const Issue = require('../models/Issue');

// @desc    Get all issues with optional filtering & search
// @route   GET /api/issues
// @access  Public
const getIssues = async (req, res, next) => {
  try {
    const { category, status, search, limit = 50, page = 1 } = req.query;

    const query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const issues = await Issue.find(query)
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Issue.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Issues retrieved successfully',
      data: {
        total,
        page: parseInt(page, 10),
        count: issues.length,
        issues,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single issue by ID
// @route   GET /api/issues/:id
// @access  Public
const getIssueById = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'name email role')
      .populate('statusHistory.updatedBy', 'name email role');

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Issue details retrieved',
      data: {
        issue,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Report a new civic issue
// @route   POST /api/issues
// @access  Private (Citizen)
const createIssue = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      imageUrl,
      imagePublicId,
      latitude,
      longitude,
      address,
    } = req.body;

    // Validation
    if (!title || !description || !category || !imageUrl) {
      return res.status(400).json({
        success: false,
        message:
          'Please provide all required fields: title, description, category, and photo',
      });
    }

    if (latitude === undefined || longitude === undefined || isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS latitude and longitude coordinates are required',
      });
    }

    const issue = await Issue.create({
      title: title.trim(),
      description: description.trim(),
      category,
      imageUrl,
      imagePublicId: imagePublicId || '',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address ? address.trim() : 'Location captured via GPS',
      status: 'Pending',
      reportedBy: req.user._id,
      statusHistory: [
        {
          status: 'Pending',
          updatedBy: req.user._id,
          note: 'Complaint submitted by citizen',
          updatedAt: new Date(),
        },
      ],
    });

    const populatedIssue = await Issue.findById(issue._id).populate(
      'reportedBy',
      'name email'
    );

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully! An administrator will review it.',
      data: {
        issue: populatedIssue,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get complaints submitted by the logged-in citizen
// @route   GET /api/issues/my
// @access  Private (Citizen)
const getMyIssues = async (req, res, next) => {
  try {
    const issues = await Issue.find({ reportedBy: req.user._id })
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'My complaints retrieved successfully',
      data: {
        count: issues.length,
        issues,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get nearby issues based on coordinates
// @route   GET /api/issues/nearby
// @access  Public
const getNearbyIssues = async (req, res, next) => {
  try {
    const { latitude, longitude, radiusKm = 15 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude coordinates are required for nearby query',
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radius = parseFloat(radiusKm);

    // Approximate bounding box calculation: 1 deg lat ~ 111km, 1 deg lng ~ 111 * cos(lat) km
    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

    const issues = await Issue.find({
      latitude: { $gte: lat - latDelta, $lte: lat + latDelta },
      longitude: { $gte: lng - lngDelta, $lte: lng + lngDelta },
    })
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      message: 'Nearby issues retrieved',
      data: {
        count: issues.length,
        issues,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getIssues,
  getIssueById,
  createIssue,
  getMyIssues,
  getNearbyIssues,
};
