
const Election = require('../models/election');

// Create a new election
const createElection = async (req, res) => {
  try {
    const { title, description, startDate, endDate } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, start date, and end date are required'
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
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }

    console.error('Get election error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve election'
    });
  }
};

module.exports = {
  createElection,
  getElections,
  getElectionById
};
