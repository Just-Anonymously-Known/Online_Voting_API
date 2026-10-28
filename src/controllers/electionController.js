
const mongoose = require('mongoose');
const Election = require('../models/election');

const VALID_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'completed',
  'cancelled'
];

const normalizeStatus = (status) => {
  if (typeof status !== 'string') return '';
  const value = status.trim().toLowerCase();

  // Compatibility with legacy records.
  if (value === 'upcoming') return 'scheduled';

  return value;
};

const getEffectiveStatus = (election, now = new Date()) => {
  const status = normalizeStatus(election.status);
  const start = new Date(election.startDate);
  const end = new Date(election.endDate);

  if (status === 'cancelled' || status === 'completed' || status === 'draft') {
    return status;
  }

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return 'needs_review';
  }

  if (now > end) return 'expired';
  if (now < start) return 'scheduled';

  // Dates alone must never activate an election.
  if (status === 'active') return 'active';

  return 'awaiting_activation';
};

const serializeElection = (election) => {
  const data = election.toObject
    ? election.toObject()
    : { ...election };

  data.status = normalizeStatus(data.status);
  data.effectiveStatus = getEffectiveStatus(data);

  return data;
};

// Create a new election.
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
      description:
        typeof description === 'string' ? description.trim() : '',
      startDate: start,
      endDate: end,
      status: 'draft',
      createdBy: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Election created successfully',
      election: serializeElection(election)
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

// Get all elections.
const getElections = async (req, res) => {
  try {
    const elections = await Election.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: elections.length,
      elections: elections.map(serializeElection)
    });
  } catch (error) {
    console.error('Get elections error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve elections'
    });
  }
};

// Get one election by ID.
const getElectionById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    const election = await Election.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean();

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    return res.status(200).json({
      success: true,
      election: serializeElection(election)
    });
  } catch (error) {
    console.error('Get election error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve election'
    });
  }
};

// Admin: update election status.
const updateElectionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedStatus = normalizeStatus(req.body?.status);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    if (!VALID_STATUSES.includes(requestedStatus)) {
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

    const currentStatus = normalizeStatus(election.status);

    // Treat legacy UPCOMING as scheduled for transition checks.
    const allowedTransitions = {
      draft: ['scheduled', 'cancelled'],
      scheduled: ['active', 'cancelled'],
      active: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    if (!allowedTransitions[currentStatus]?.includes(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message:
          `Cannot change election status from ${currentStatus} to ${requestedStatus}`
      });
    }

    const now = new Date();
    const start = new Date(election.startDate);
    const end = new Date(election.endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res.status(400).json({
        success: false,
        message: 'Election dates are invalid and must be reviewed'
      });
    }

    if (requestedStatus === 'scheduled' && start <= now) {
      return res.status(400).json({
        success: false,
        message: 'Only elections with a future start date can be scheduled'
      });
    }

    if (requestedStatus === 'active' && (now < start || now > end)) {
      return res.status(400).json({
        success: false,
        message: 'An election can only be activated during its voting period'
      });
    }

    if (requestedStatus === 'completed' && now <= end) {
      return res.status(400).json({
        success: false,
        message: 'An election cannot be completed before its end date'
      });
    }

    election.status = requestedStatus;
    await election.save();

    return res.status(200).json({
      success: true,
      message: `Election status updated to ${requestedStatus}`,
      election: serializeElection(election)
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
