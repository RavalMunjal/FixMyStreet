const Issue = require('../models/Issue');
const { URGENCY_LEVELS } = require('../models/Issue');
const {
  checkDB,
  escapeRegex,
  parsePagination,
  parseValidCoordinates,
  calculateDistanceKm,
  buildStatusFilter,
} = require('../utils/helpers');
const {
  createAndSendNotification,
  findResponsibleAdminsForIssue,
} = require('../utils/notificationService');

// Get all issues with optional search, category, status filter, and sort order
const getIssues = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { category, status, search, sort = 'newest', limit = 50, page = 1 } = req.query;
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

    const issues = await Issue.find(query)
      .populate('reportedBy', 'name email')
      .sort(sortOrder)
      .skip(pagination.skip)
      .limit(pagination.limit);

    const total = await Issue.countDocuments(query);
    const totalAll = await Issue.countDocuments();
    const reportedCount = await Issue.countDocuments({
      status: { $in: ['Reported', 'Pending'] },
    });
    const underReviewCount = await Issue.countDocuments({ status: 'Under Review' });
    const inProgressCount = await Issue.countDocuments({ status: 'In Progress' });
    const resolvedCount = await Issue.countDocuments({ status: 'Resolved' });

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

// Get one issue by its ID with reporter and timeline details
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
      data: { issue },
    });
  } catch (error) {
    next(error);
  }
};

// Create a new civic complaint and send submission notifications
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
      !title?.trim() ||
      !description?.trim() ||
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
      address: address?.trim() ? address.trim() : 'Location captured via GPS',
      status: 'Reported',
      requestedUrgency,
      confirmedUrgency: 'Normal',
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

    // Notify citizen and responsible admins only after MongoDB save succeeds
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
    for (const adminUser of responsibleAdmins) {
      await createAndSendNotification({
        recipientId: adminUser._id,
        senderId: req.user._id,
        issueId: issue._id,
        type: 'NEW_ISSUE_ADMIN',
        title: 'New Issue Reported',
        message: `A new ${issue.category} issue has been reported in your assigned area.`,
        dedupeKey: `new_issue_admin:${issue._id}:${adminUser._id}`,
        targetRole: 'admin',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully! An administrator will review it.',
      data: { issue: populatedIssue },
    });
  } catch (error) {
    next(error);
  }
};

// Get complaints reported by the currently logged-in citizen
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

// Get issues within radiusKm (1, 3, 5 km) sorted nearest-first
const getNearbyIssues = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { latitude, longitude, radiusKm = 5, category, status } = req.query;
    const coords = parseValidCoordinates(latitude, longitude);

    if (!coords) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude coordinates are required for nearby query',
      });
    }

    const parsedRadius = Math.min(100, Math.max(0.1, Number(radiusKm) || 5));
    const earthRadiusKm = 6378.1;

    const baseFilter = {};
    if (category && category !== 'All') baseFilter.category = category;
    const statusCond = buildStatusFilter(status);
    if (statusCond) baseFilter.status = statusCond;

    const geoIssues = await Issue.find({
      ...baseFilter,
      location: {
        $geoWithin: {
          $centerSphere: [[coords.lng, coords.lat], parsedRadius / earthRadiusKm],
        },
      },
    })
      .populate('reportedBy', 'name email')
      .limit(100);

    // Include older complaints saved before GeoJSON coordinates were added
    const legacyIssues = await Issue.find({
      ...baseFilter,
      'location.coordinates.0': { $exists: false },
      latitude: { $type: 'number' },
      longitude: { $type: 'number' },
    })
      .populate('reportedBy', 'name email')
      .limit(100);

    const seenIds = new Set(geoIssues.map((i) => i._id.toString()));
    const combined = [...geoIssues];
    for (const legacy of legacyIssues) {
      if (!seenIds.has(legacy._id.toString())) {
        combined.push(legacy);
      }
    }

    const nearbyIssues = combined
      .map((doc) => {
        const obj = doc.toObject();
        const distanceKm = calculateDistanceKm(
          coords.lat,
          coords.lng,
          obj.latitude,
          obj.longitude
        );
        return { ...obj, distanceKm };
      })
      .filter((item) => item.distanceKm <= parsedRadius + 0.05)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json({
      success: true,
      message: 'Nearby issues retrieved',
      data: {
        radiusKm: parsedRadius,
        count: nearbyIssues.length,
        issues: nearbyIssues,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Support a complaint ("I Face This Too"), max once per user
const supportIssue = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const userId = req.user._id;
    const issueId = req.params.id;

    const updatedIssue = await Issue.findOneAndUpdate(
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

    if (updatedIssue.supportCount !== updatedIssue.supporters.length) {
      updatedIssue.supportCount = updatedIssue.supporters.length;
      await updatedIssue.save();
    }

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

// Remove support from a complaint
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
