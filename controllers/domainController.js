const Domain = require('../models/Domain');
const { isOffline, mockDomains, mockDomainMap } = require('../services/fallbackStore');

// @desc    Get all active domains
// @route   GET /api/domains
const getAllDomains = async (req, res, next) => {
  try {
    if (isOffline()) {
      return res.status(200).json({
        success: true,
        count: mockDomains.length,
        data: mockDomains,
        mode: 'offline',
      });
    }

    const domains = await Domain.find({ isActive: true })
      .sort({ name: 1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: domains.length,
      data: domains,
    });
  } catch (error) {
    // If DB error happens, fall back to mock data
    return res.status(200).json({
      success: true,
      count: mockDomains.length,
      data: mockDomains,
      mode: 'offline_fallback',
    });
  }
};

// @desc    Get single domain by ID
// @route   GET /api/domains/:id
const getDomainById = async (req, res, next) => {
  try {
    if (isOffline()) {
      const domain = mockDomainMap[req.params.id];
      if (!domain) {
        return res.status(404).json({
          success: false,
          message: 'Domain not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: domain,
      });
    }

    const domain = await Domain.findById(req.params.id).select('-__v');

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found',
      });
    }

    res.status(200).json({
      success: true,
      data: domain,
    });
  } catch (error) {
    if (isOffline() || error.name === 'CastError') {
      const domain = mockDomainMap[req.params.id];
      if (domain) {
        return res.status(200).json({ success: true, data: domain });
      }
    }
    next(error);
  }
};

// @desc    Create a new domain
// @route   POST /api/domains
const createDomain = async (req, res, next) => {
  try {
    const domain = await Domain.create(req.body);
    res.status(201).json({
      success: true,
      data: domain,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update domain
// @route   PUT /api/domains/:id
const updateDomain = async (req, res, next) => {
  try {
    const domain = await Domain.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found',
      });
    }

    res.status(200).json({
      success: true,
      data: domain,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete domain (soft delete)
// @route   DELETE /api/domains/:id
const deleteDomain = async (req, res, next) => {
  try {
    const domain = await Domain.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Domain deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDomains,
  getDomainById,
  createDomain,
  updateDomain,
  deleteDomain,
};
