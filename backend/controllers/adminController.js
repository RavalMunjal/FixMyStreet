const User = require('../models/User');
const Issue = require('../models/Issue');
const { ISSUE_STATUSES, URGENCY_LEVELS } = require('../models/Issue');
const { checkDB, escapeRegex, parsePagination } = require('../utils/helpers');
const { createAndSendNotification } = require('../utils/notificationService');

// @desc    Get admin dashboard metrics & counts
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
const getDashboardStats = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const [
      total,
      reported,
      underReview,
      inProgress,
      resolved,
      highUrgency,
      totalUsers,
      recentIssues,
    ] = await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: { $in: ['Reported', 'Pending'] } }),
      Issue.countDocuments({ status: 'Under Review' }),
      Issue.countDocuments({ status: 'In Progress' }),
      Issue.countDocuments({ status: 'Resolved' }),
      Issue.countDocuments({ confirmedUrgency: 'High' }),
      User.countDocuments({ role: 'citizen' }),
      Issue.find()
        .populate('reportedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(6),
    ]);

    res.status(200).json({
      success: true,
      message: 'Admin dashboard data retrieved successfully',
      data: {
        stats: {
          total,
          reported,
          underReview,
          pending: reported + underReview,
          inProgress,
          resolved,
          highUrgency,
          totalUsers,
        },
        recentIssues,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all issues for admin review (supports urgency/status/category filters & sorting)
// @route   GET /api/admin/issues
// @access  Private (Admin)
const getAllAdminIssues = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const {
      category,
      status,
      confirmedUrgency,
      requestedUrgency,
      search,
      sort = 'newest',
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (status && status !== 'All') {
      if (status === 'Reported') {
        query.status = { $in: ['Reported', 'Pending'] };
      } else {
        query.status = status;
      }
    }

    if (confirmedUrgency && confirmedUrgency !== 'All') {
      query.confirmedUrgency = confirmedUrgency;
    }

    if (requestedUrgency && requestedUrgency !== 'All') {
      query.requestedUrgency = requestedUrgency;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
      ];
    }

    let sortOrder = { createdAt: -1 };
    if (sort === 'most_supported') {
      sortOrder = { supportCount: -1, createdAt: -1 };
    } else if (sort === 'urgency') {
      // 'High' comes before 'Normal' alphabetically
      sortOrder = { confirmedUrgency: 1, supportCount: -1, createdAt: -1 };
    }

    const pagination = parsePagination(page, limit, 100);

    const issues = await Issue.find(query)
      .populate('reportedBy', 'name email role')
      .populate('statusHistory.updatedBy', 'name email role')
      .sort(sortOrder)
      .skip(pagination.skip)
      .limit(pagination.limit);

    const total = await Issue.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'All issues retrieved for admin',
      data: {
        total,
        page: pagination.page,
        count: issues.length,
        issues,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update complaint status, optional confirmedUrgency, & add admin note
// @route   PATCH /api/admin/issues/:id/status
// @access  Private (Admin)
const updateIssueStatus = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { status, adminNote, confirmedUrgency } = req.body;

    if (!status || !ISSUE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid status. Status must be Reported, Under Review, In Progress, or Resolved',
      });
    }

    if (confirmedUrgency !== undefined && !URGENCY_LEVELS.includes(confirmedUrgency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmed urgency. Must be Normal or High',
      });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    const previousStatus = issue.status;
    issue.status = status;

    if (adminNote !== undefined) {
      issue.adminNote = String(adminNote).trim();
    }

    if (confirmedUrgency !== undefined) {
      issue.confirmedUrgency = confirmedUrgency;
    }

    issue.statusHistory.push({
      status,
      updatedBy: req.user._id,
      updatedByRole: 'admin',
      note:
        (adminNote && String(adminNote).trim()) ||
        `Status updated from ${previousStatus} to ${status} by administrator`,
      updatedAt: new Date(),
    });

    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate('reportedBy', 'name email role')
      .populate('statusHistory.updatedBy', 'name email role');

    // Event B & Event C: Notify citizen after status change persists in MongoDB
    const reporterId = populated?.reportedBy?._id || issue.reportedBy;
    if (status === 'Resolved') {
      await createAndSendNotification({
        recipientId: reporterId,
        senderId: req.user._id,
        issueId: issue._id,
        type: 'ISSUE_RESOLVED',
        title: 'Your Issue Has Been Resolved',
        message: issue.resolutionImageUrl
          ? `Your reported issue ${issue.title} has been marked as resolved. Open details to review the resolution proof.`
          : `Your reported issue ${issue.title} has been marked as resolved.`,
        targetRole: 'citizen',
      });
    } else if (previousStatus !== status) {
      await createAndSendNotification({
        recipientId: reporterId,
        senderId: req.user._id,
        issueId: issue._id,
        type: 'STATUS_UPDATED',
        title: 'Issue Status Updated',
        message: `Your complaint ${issue.title} has been updated to ${status}.`,
        targetRole: 'citizen',
      });
    }

    res.status(200).json({
      success: true,
      message: `Complaint status updated to ${status}`,
      data: {
        issue: populated,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm or update issue urgency independently
// @route   PATCH /api/admin/issues/:id/urgency
// @access  Private (Admin)
const updateIssueUrgency = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { confirmedUrgency } = req.body;
    if (!confirmedUrgency || !URGENCY_LEVELS.includes(confirmedUrgency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid urgency level. Must be Normal or High',
      });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    issue.confirmedUrgency = confirmedUrgency;
    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate('reportedBy', 'name email role')
      .populate('statusHistory.updatedBy', 'name email role');

    res.status(200).json({
      success: true,
      message: `Confirmed urgency set to ${confirmedUrgency}`,
      data: {
        issue: populated,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve complaint with resolution note & optional proof photo
// @route   POST /api/admin/issues/:id/resolve
// @access  Private (Admin)
const resolveIssue = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { adminNote, resolutionImageUrl, confirmedUrgency } = req.body;

    if (confirmedUrgency !== undefined && !URGENCY_LEVELS.includes(confirmedUrgency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmed urgency. Must be Normal or High',
      });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    issue.status = 'Resolved';
    if (adminNote !== undefined) {
      issue.adminNote = String(adminNote).trim();
    }
    if (resolutionImageUrl !== undefined) {
      issue.resolutionImageUrl = String(resolutionImageUrl).trim();
    }
    if (confirmedUrgency !== undefined) {
      issue.confirmedUrgency = confirmedUrgency;
    }

    issue.statusHistory.push({
      status: 'Resolved',
      updatedBy: req.user._id,
      updatedByRole: 'admin',
      note:
        (adminNote && String(adminNote).trim()) ||
        'Complaint marked resolved by administrator',
      updatedAt: new Date(),
    });

    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate('reportedBy', 'name email role')
      .populate('statusHistory.updatedBy', 'name email role');

    // Event C: Complaint resolved notification
    const reporterId = populated?.reportedBy?._id || issue.reportedBy;
    await createAndSendNotification({
      recipientId: reporterId,
      senderId: req.user._id,
      issueId: issue._id,
      type: 'ISSUE_RESOLVED',
      title: 'Your Issue Has Been Resolved',
      message: issue.resolutionImageUrl
        ? `Your reported issue ${issue.title} has been marked as resolved. Open details to review the resolution proof.`
        : `Your reported issue ${issue.title} has been marked as resolved.`,
      targetRole: 'citizen',
    });

    res.status(200).json({
      success: true,
      message: 'Complaint resolved successfully',
      data: {
        issue: populated,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get list of registered users
// @route   GET /api/admin/users
// @access  Private (Admin)
const getUsers = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const users = await User.find({ role: 'citizen' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    const usersWithCounts = await Promise.all(
      users.map(async (u) => {
        const count = await Issue.countDocuments({ reportedBy: u._id });
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          complaintsCount: count,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Registered users retrieved',
      data: {
        count: usersWithCounts.length,
        users: usersWithCounts,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAllAdminIssues,
  updateIssueStatus,
  updateIssueUrgency,
  resolveIssue,
  getUsers,
};
