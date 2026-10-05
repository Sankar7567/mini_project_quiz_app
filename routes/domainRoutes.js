const express = require('express');
const router = express.Router();
const {
  getAllDomains,
  getDomainById,
  createDomain,
  updateDomain,
  deleteDomain,
} = require('../controllers/domainController');
const { getQuestionsByDomain } = require('../controllers/questionController');

// Domain CRUD routes
router.route('/').get(getAllDomains).post(createDomain);

router.route('/:id').get(getDomainById).put(updateDomain).delete(deleteDomain);

// Nested route: questions under a domain
router.get('/:id/questions', getQuestionsByDomain);

module.exports = router;
