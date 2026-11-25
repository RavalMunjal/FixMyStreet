const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllAdminIssues,
  updateIssueStatus,
  updateIssueUrgency,
  resolveIssue,
  getUsers,
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// All admin routes require valid authentication & administrator role
router.use(protect);
router.use(requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/issues', getAllAdminIssues);
router.patch('/issues/:id/status', updateIssueStatus);
router.patch('/issues/:id/urgency', updateIssueUrgency);
router.post('/issues/:id/resolve', resolveIssue);
router.get('/users', getUsers);

module.exports = router;
