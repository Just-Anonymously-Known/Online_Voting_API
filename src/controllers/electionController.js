
const mongoose = require('mongoose');
const Election = require('../models/election');

// Create a new election
const createElection = async (req, res) => {
  try {
    const { title, description, startDate, endDate } = req.body || {};

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message: 'Title, start date, and end date are required'
      });
    }

    if (title.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot exceed 150 characters'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid start and end dates'
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const election = await Election.create({
      title: title.trim(),
      description,
      startDate: start,
      endDate: end,
      createdBy: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Election created successfully',
      election
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Create election error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create election'
    });
  }
};

// Get all elections
const getElections = async (req, res) => {
  try {
    const elections = await Election.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: elections.length,
      elections
    });
  } catch (error) {
    console.error('Get elections error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve elections'
    });
  }
};

// Get one election by ID
const getElectionById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    const election = await Election.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    return res.status(200).json({
      success: true,
      election
    });
  } catch (error) {
    console.error('Get election error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve election'
    });
  }
};

// Admin: update election status
const updateElectionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    const allowedStatuses = [
      'draft',
      'scheduled',
      'active',
      'completed',
      'cancelled'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election status'
      });
    }

    const election = await Election.findById(id);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    const currentStatus = election.status;

    const allowedTransitions = {
      draft: ['scheduled', 'cancelled'],
      scheduled: ['active', 'cancelled'],
      active: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change election status from ${currentStatus} to ${status}`
      });
    }

    const now = new Date();
    const start = new Date(election.startDate);
    const end = new Date(election.endDate);

    if (status === 'scheduled' && start <= now) {
      return res.status(400).json({
        success: false,
        message: 'Only elections with a future start date can be scheduled'
      });
    }

    if (status === 'active' && (now < start || now > end)) {
      return res.status(400).json({
        success: false,
        message: 'An election can only be active during its voting period'
      });
    }

    if (status === 'completed' && now <= end) {
      return res.status(400).json({
        success: false,
        message: 'An election cannot be completed before its end date'
      });
    }

    election.status = status;
    await election.save();

    return res.status(200).json({
      success: true,
      message: `Election status updated to ${status}`,
      election
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Update election status error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update election status'
    });
  }
};

module.exports = {
  createElection,
  getElections,
  getElectionById,
  updateElectionStatus
};
