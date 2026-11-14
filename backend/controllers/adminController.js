const User = require('../models/User');
const Issue = require('../models/Issue');

// @desc    Get admin dashboard metrics & counts
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
const getDashboardStats = async (req, res, next) => {
  try {
    const total = await Issue.countDocuments();
    const pending = await Issue.countDocuments({ status: 'Pending' });
    const inProgress = await Issue.countDocuments({ status: 'In Progress' });
    const resolved = await Issue.countDocuments({ status: 'Resolved' });
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
          pending,
          inProgress,
          resolved,
          totalUsers,
        },
        recentIssues,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all issues for admin review
// @route   GET /api/admin/issues
// @access  Private (Admin)
const getAllAdminIssues = async (req, res, next) => {
  try {
    const { category, status, search, page = 1, limit = 50 } = req.query;

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
      .populate('reportedBy', 'name email role')
      .populate('statusHistory.updatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Issue.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'All issues retrieved for admin',
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

// @desc    Update complaint status & add admin note
// @route   PATCH /api/admin/issues/:id/status
// @access  Private (Admin)
const updateIssueStatus = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;

    const validStatuses = ['Pending', 'In Progress', 'Resolved'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Status must be Pending, In Progress, or Resolved',
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

    if (adminNote) {
      issue.adminNote = adminNote.trim();
    }

    // Append update to history with admin audit trail
    issue.statusHistory.push({
      status,
      updatedBy: req.user._id,
      note:
        adminNote ||
        `Status changed from ${previousStatus} to ${status} by administrator`,
      updatedAt: new Date(),
    });

    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate('reportedBy', 'name email')
      .populate('statusHistory.updatedBy', 'name email');

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

// @desc    Resolve complaint with resolution note & optional proof photo
// @route   POST /api/admin/issues/:id/resolve
// @access  Private (Admin)
const resolveIssue = async (req, res, next) => {
  try {
    const { adminNote, resolutionImageUrl } = req.body;

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    issue.status = 'Resolved';
    if (adminNote) {
      issue.adminNote = adminNote.trim();
    }
    if (resolutionImageUrl) {
      issue.resolutionImageUrl = resolutionImageUrl.trim();
    }

    issue.statusHistory.push({
      status: 'Resolved',
      updatedBy: req.user._id,
      note: adminNote || 'Complaint marked resolved by administrator',
      updatedAt: new Date(),
    });

    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate('reportedBy', 'name email')
      .populate('statusHistory.updatedBy', 'name email');

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
    const users = await User.find({ role: 'citizen' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    // Aggregate complaint counts for each user
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
  resolveIssue,
  getUsers,
};
