const User = require('../models/User');
const Issue = require('../models/Issue');
const { ISSUE_STATUSES, URGENCY_LEVELS } = require('../models/Issue');
const {
  checkDB,
  escapeRegex,
  parsePagination,
  buildStatusFilter,
} = require('../utils/helpers');
const { notifyIssueStatusChange } = require('../utils/notificationService');

// Get admin dashboard summary counts and latest submissions
const getDashboardStats = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const total = await Issue.countDocuments();
    const reported = await Issue.countDocuments({
      status: { $in: ['Reported', 'Pending'] },
    });
    const underReview = await Issue.countDocuments({ status: 'Under Review' });
    const inProgress = await Issue.countDocuments({ status: 'In Progress' });
    const resolved = await Issue.countDocuments({ status: 'Resolved' });
    const highUrgency = await Issue.countDocuments({ confirmedUrgency: 'High' });
    const totalUsers = await User.countDocuments({ role: 'citizen' });

    const recentIssues = await Issue.find()
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(6);

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

// Get all issues for admin filtering, sorting, and review
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

    if (category && category !== 'All') query.category = category;
    const statusCond = buildStatusFilter(status);
    if (statusCond) query.status = statusCond;
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

// Update complaint status, note, and optional urgency level
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
    if (adminNote !== undefined) issue.adminNote = String(adminNote).trim();
    if (confirmedUrgency !== undefined) issue.confirmedUrgency = confirmedUrgency;

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

    await notifyIssueStatusChange({
      issue,
      reporterId: populated?.reportedBy?._id || issue.reportedBy,
      adminId: req.user._id,
      status,
      previousStatus,
    });

    res.status(200).json({
      success: true,
      message: `Complaint status updated to ${status}`,
      data: { issue: populated },
    });
  } catch (error) {
    next(error);
  }
};

// Confirm or change issue urgency level independently
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
      data: { issue: populated },
    });
  } catch (error) {
    next(error);
  }
};

// Mark complaint resolved with optional note and proof photo
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

    const previousStatus = issue.status;
    issue.status = 'Resolved';
    if (adminNote !== undefined) issue.adminNote = String(adminNote).trim();
    if (resolutionImageUrl !== undefined) {
      issue.resolutionImageUrl = String(resolutionImageUrl).trim();
    }
    if (confirmedUrgency !== undefined) issue.confirmedUrgency = confirmedUrgency;

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

    await notifyIssueStatusChange({
      issue,
      reporterId: populated?.reportedBy?._id || issue.reportedBy,
      adminId: req.user._id,
      status: 'Resolved',
      previousStatus,
    });

    res.status(200).json({
      success: true,
      message: 'Complaint resolved successfully',
      data: { issue: populated },
    });
  } catch (error) {
    next(error);
  }
};

// Get list of registered citizen accounts with complaint counts
const getUsers = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const users = await User.find({ role: 'citizen' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    const usersWithCounts = [];
    for (const u of users) {
      const count = await Issue.countDocuments({ reportedBy: u._id });
      usersWithCounts.push({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        complaintsCount: count,
      });
    }

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
