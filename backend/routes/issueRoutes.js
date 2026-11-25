const express = require('express');
const router = express.Router();
const {
  getIssues,
  getIssueById,
  createIssue,
  getMyIssues,
  getNearbyIssues,
  supportIssue,
  removeSupport,
} = require('../controllers/issueController');
const { protect } = require('../middleware/auth');

// Public route to view issues & nearby issues
router.get('/', getIssues);
router.get('/nearby', getNearbyIssues);

// Protected citizen routes (must be placed before dynamic /:id)
router.get('/my', protect, getMyIssues);
router.post('/', protect, createIssue);
router.post('/:id/support', protect, supportIssue);
router.delete('/:id/support', protect, removeSupport);

// Single issue detail by ID
router.get('/:id', getIssueById);

module.exports = router;
