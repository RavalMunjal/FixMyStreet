const Issue = require('../models/Issue');
const { URGENCY_LEVELS } = require('../models/Issue');
const { checkDB, escapeRegex, parsePagination } = require('../utils/helpers');
const {
  createAndSendNotification,
  findResponsibleAdminsForIssue,
} = require('../utils/notificationService');

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

// Haversine formula to compute accurate distance in kilometers
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

const buildStatusFilter = (status) => {
  if (!status || status === 'All') return null;
  if (status === 'Reported') {
    return { $in: ['Reported', 'Pending'] };
  }
  return status;
};

// @desc    Get all issues with optional filtering, search, sorting & real MongoDB counts
// @route   GET /api/issues
// @access  Public
const getIssues = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const {
      category,
      status,
      search,
      sort = 'newest',
      limit = 50,
      page = 1,
    } = req.query;

    const query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    const statusCond = buildStatusFilter(status);
    if (statusCond) {
      query.status = statusCond;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
      ];
    }

    const sortOrder =
      sort === 'most_supported'
        ? { supportCount: -1, createdAt: -1 }
        : { createdAt: -1 };

    const pagination = parsePagination(page, limit, 100);

    const [
      issues,
      total,
      totalAll,
      reportedCount,
      underReviewCount,
      inProgressCount,
      resolvedCount,
    ] = await Promise.all([
      Issue.find(query)
        .populate('reportedBy', 'name email')
        .sort(sortOrder)
        .skip(pagination.skip)
        .limit(pagination.limit),
      Issue.countDocuments(query),
      Issue.countDocuments(),
      Issue.countDocuments({ status: { $in: ['Reported', 'Pending'] } }),
      Issue.countDocuments({ status: 'Under Review' }),
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
          reported: reportedCount,
          underReview: underReviewCount,
          pending: reportedCount + underReviewCount,
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
      organization,
      requestedUrgency = 'Normal',
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

    if (!URGENCY_LEVELS.includes(requestedUrgency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid urgency level. Allowed values are Normal or High',
      });
    }

    const coords = parseValidCoordinates(latitude, longitude);
    if (!coords) {
      return res.status(400).json({
        success: false,
        message:
          'Valid GPS latitude (-90..90) and longitude (-180..180) coordinates are required',
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
      location: {
        type: 'Point',
        coordinates: [coords.lng, coords.lat],
      },
      address:
        address && address.trim() ? address.trim() : 'Location captured via GPS',
      status: 'Reported',
      requestedUrgency,
      confirmedUrgency: 'Normal', // Admin independently confirms urgency later
      supporters: [],
      supportCount: 0,
      reportedBy: req.user._id,
      organization: organization ? String(organization).trim() : '',
      statusHistory: [
        {
          status: 'Reported',
          updatedBy: req.user._id,
          updatedByRole: req.user.role || 'citizen',
          note:
            requestedUrgency === 'High'
              ? 'Complaint reported by citizen (Requested urgency: High)'
              : 'Complaint reported by citizen',
          updatedAt: new Date(),
        },
      ],
    });

    const populatedIssue = await Issue.findById(issue._id).populate(
      'reportedBy',
      'name email'
    );

    // Event A: Create notifications ONLY after issue is persisted in MongoDB
    await createAndSendNotification({
      recipientId: req.user._id,
      senderId: req.user._id,
      issueId: issue._id,
      type: 'ISSUE_SUBMITTED',
      title: 'Report Submitted Successfully',
      message: `Your issue ${issue.title} has been submitted. Track its progress in My Issues.`,
      dedupeKey: `submitted:${issue._id}`,
      targetRole: 'citizen',
    });

    const responsibleAdmins = await findResponsibleAdminsForIssue(issue);
    await Promise.all(
      responsibleAdmins.map((adminUser) =>
        createAndSendNotification({
          recipientId: adminUser._id,
          senderId: req.user._id,
          issueId: issue._id,
          type: 'NEW_ISSUE_ADMIN',
          title: 'New Issue Reported',
          message: `A new ${issue.category} issue has been reported in your assigned area.`,
          dedupeKey: `new_issue_admin:${issue._id}:${adminUser._id}`,
          targetRole: 'admin',
        })
      )
    );

    res.status(201).json({
      success: true,
      message:
        'Complaint submitted successfully! An administrator will review it.',
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

// @desc    Get nearby issues using MongoDB GeoJSON 2dsphere query + accurate km distance
// @route   GET /api/issues/nearby
// @access  Public
const getNearbyIssues = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { latitude, longitude, radiusKm = 5, category, status } = req.query;
    const coords = parseValidCoordinates(latitude, longitude);

    if (!coords) {
      return res.status(400).json({
        success: false,
        message:
          'Valid latitude and longitude coordinates are required for nearby query',
      });
    }

    const parsedRadius = Math.min(100, Math.max(0.1, Number(radiusKm) || 5));
    const maxDistanceMeters = parsedRadius * 1000;

    const baseFilter = {};
    if (category && category !== 'All') {
      baseFilter.category = category;
    }
    const statusCond = buildStatusFilter(status);
    if (statusCond) {
      baseFilter.status = statusCond;
    }

    // Use MongoDB GeoJSON $geoWithin + $centerSphere on 2dsphere index
    const earthRadiusKm = 6378.1;
    let issues = await Issue.find({
      ...baseFilter,
      location: {
        $geoWithin: {
          $centerSphere: [[coords.lng, coords.lat], parsedRadius / earthRadiusKm],
        },
      },
    })
      .populate('reportedBy', 'name email')
      .limit(100);

    // Fallback for any legacy records missing GeoJSON `location.coordinates`
    const legacyIssues = await Issue.find({
      ...baseFilter,
      'location.coordinates.0': { $exists: false },
      latitude: { $type: 'number' },
      longitude: { $type: 'number' },
    })
      .populate('reportedBy', 'name email')
      .limit(100);

    const seenIds = new Set(issues.map((i) => i._id.toString()));
    for (const legacy of legacyIssues) {
      if (!seenIds.has(legacy._id.toString())) {
        issues.push(legacy);
      }
    }

    // Attach accurate distanceKm & strictly enforce radius filter + nearest-first order
    const issuesWithDistance = issues
      .map((doc) => {
        const obj = doc.toObject();
        const dist = calculateDistanceKm(
          coords.lat,
          coords.lng,
          obj.latitude,
          obj.longitude
        );
        return { ...obj, distanceKm: dist };
      })
      .filter((item) => item.distanceKm * 1000 <= maxDistanceMeters + 50)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json({
      success: true,
      message: 'Nearby issues retrieved',
      data: {
        radiusKm: parsedRadius,
        count: issuesWithDistance.length,
        issues: issuesWithDistance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Support / Upvote a complaint ("I Face This Too") — 1 per user
// @route   POST /api/issues/:id/support
// @access  Private
const supportIssue = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const userId = req.user._id;
    const issueId = req.params.id;

    // Atomic conditional update guarantees duplicate rapid requests cannot double-increment
    let updatedIssue = await Issue.findOneAndUpdate(
      { _id: issueId, supporters: { $ne: userId } },
      { $addToSet: { supporters: userId }, $inc: { supportCount: 1 } },
      { new: true }
    )
      .populate('reportedBy', 'name email role')
      .populate('statusHistory.updatedBy', 'name email role');

    if (!updatedIssue) {
      const existing = await Issue.findById(issueId)
        .populate('reportedBy', 'name email role')
        .populate('statusHistory.updatedBy', 'name email role');

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found',
        });
      }

      // Sync exact count cleanly
      if (existing.supportCount !== existing.supporters.length) {
        existing.supportCount = existing.supporters.length;
        await existing.save();
      }

      return res.status(200).json({
        success: true,
        alreadySupported: true,
        message: 'You already support this complaint',
        data: {
          issue: existing,
          supportCount: existing.supporters.length,
          supported: true,
        },
      });
    }

    // Ensure count matches supporters length exactly
    if (updatedIssue.supportCount !== updatedIssue.supporters.length) {
      updatedIssue.supportCount = updatedIssue.supporters.length;
      await updatedIssue.save();
    }

    // Event D: Notify original reporter when another citizen supports (deduped)
    const reporterId =
      updatedIssue.reportedBy?._id?.toString() ||
      updatedIssue.reportedBy?.toString();
    if (reporterId && reporterId !== userId.toString()) {
      await createAndSendNotification({
        recipientId: reporterId,
        senderId: userId,
        issueId: updatedIssue._id,
        type: 'ISSUE_SUPPORTED',
        title: 'Someone Supported Your Report',
        message: `Another citizen supported your issue ${updatedIssue.title}.`,
        dedupeKey: `support:${updatedIssue._id}:${userId}`,
        priority: 'normal',
        targetRole: 'citizen',
      });
    }

    res.status(200).json({
      success: true,
      alreadySupported: false,
      message: 'Complaint supported successfully',
      data: {
        issue: updatedIssue,
        supportCount: updatedIssue.supporters.length,
        supported: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove support from a complaint
// @route   DELETE /api/issues/:id/support
// @access  Private
const removeSupport = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const userId = req.user._id;
    const issueId = req.params.id;

    const updatedIssue = await Issue.findOneAndUpdate(
      { _id: issueId, supporters: userId },
      { $pull: { supporters: userId }, $inc: { supportCount: -1 } },
      { new: true }
    )
      .populate('reportedBy', 'name email role')
      .populate('statusHistory.updatedBy', 'name email role');

    if (!updatedIssue) {
      const existing = await Issue.findById(issueId)
        .populate('reportedBy', 'name email role')
        .populate('statusHistory.updatedBy', 'name email role');

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Support already removed',
        data: {
          issue: existing,
          supportCount: existing.supporters.length,
          supported: false,
        },
      });
    }

    if (
      updatedIssue.supportCount < 0 ||
      updatedIssue.supportCount !== updatedIssue.supporters.length
    ) {
      updatedIssue.supportCount = updatedIssue.supporters.length;
      await updatedIssue.save();
    }

    res.status(200).json({
      success: true,
      message: 'Support removed successfully',
      data: {
        issue: updatedIssue,
        supportCount: updatedIssue.supporters.length,
        supported: false,
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
  supportIssue,
  removeSupport,
};
