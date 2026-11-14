const express = require('express');
const router = express.Router();
const {
  getIssues,
  getIssueById,
  createIssue,
  getMyIssues,
  getNearbyIssues,
} = require('../controllers/issueController');
const { protect } = require('../middleware/auth');

// Public route to view issues & nearby issues
router.get('/', getIssues);
router.get('/nearby', getNearbyIssues);

// Protected citizen routes (must be placed before dynamic /:id)
router.get('/my', protect, getMyIssues);
router.post('/', protect, createIssue);

// Single issue detail by ID
router.get('/:id', getIssueById);

module.exports = router;
