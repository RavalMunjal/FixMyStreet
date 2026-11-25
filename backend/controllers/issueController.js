const Issue = require('../models/Issue');
const { checkDB, escapeRegex, parsePagination } = require('../utils/helpers');

const parseValidCoordinates = (latitude, longitude) => {
  if (
    latitude === undefined ||
    latitude === null ||
    latitude === '' ||
    longitude === undefined ||
    longitude === null ||
    longitude === ''
  ) {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
};

// @desc    Get all issues with optional filtering & search + real MongoDB counts
// @route   GET /api/issues
// @access  Public
const getIssues = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { category, status, search, limit = 50, page = 1 } = req.query;

    const query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
      ];
    }

    const pagination = parsePagination(page, limit, 100);

    const [issues, total, totalAll, pendingCount, inProgressCount, resolvedCount] =
      await Promise.all([
        Issue.find(query)
          .populate('reportedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(pagination.skip)
          .limit(pagination.limit),
        Issue.countDocuments(query),
        Issue.countDocuments(),
        Issue.countDocuments({ status: 'Pending' }),
        Issue.countDocuments({ status: 'In Progress' }),
        Issue.countDocuments({ status: 'Resolved' }),
      ]);

    res.status(200).json({
      success: true,
      message: 'Issues retrieved successfully',
      data: {
        total,
        page: pagination.page,
        count: issues.length,
        stats: {
          total: totalAll,
          pending: pendingCount,
          inProgress: inProgressCount,
          resolved: resolvedCount,
        },
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
    if (!checkDB(res)) return;

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
    if (!checkDB(res)) return;

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

    if (
      !title ||
      !title.trim() ||
      !description ||
      !description.trim() ||
      !category ||
      !imageUrl ||
      !String(imageUrl).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Please provide all required fields: title, description, category, and photo',
      });
    }

    const coords = parseValidCoordinates(latitude, longitude);
    if (!coords) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS latitude (-90..90) and longitude (-180..180) coordinates are required',
      });
    }

    const issue = await Issue.create({
      title: title.trim(),
      description: description.trim(),
      category,
      imageUrl: String(imageUrl).trim(),
      imagePublicId: imagePublicId || '',
      latitude: coords.lat,
      longitude: coords.lng,
      address: address && address.trim() ? address.trim() : 'Location captured via GPS',
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
    if (!checkDB(res)) return;

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
    if (!checkDB(res)) return;

    const { latitude, longitude, radiusKm = 15 } = req.query;
    const coords = parseValidCoordinates(latitude, longitude);

    if (!coords) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude coordinates are required for nearby query',
      });
    }

    const parsedRadius = Math.max(0.1, Number(radiusKm) || 15);
    const cosLat = Math.max(Math.abs(Math.cos((coords.lat * Math.PI) / 180)), 0.01);

    const latDelta = parsedRadius / 111;
    const lngDelta = parsedRadius / (111 * cosLat);

    const issues = await Issue.find({
      latitude: { $gte: coords.lat - latDelta, $lte: coords.lat + latDelta },
      longitude: { $gte: coords.lng - lngDelta, $lte: coords.lng + lngDelta },
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
