
const mongoose = require('mongoose');
const { Readable } = require('stream');

const Candidate = require('../models/Candidate');
const Position = require('../models/Position');
const Election = require('../models/election');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

const uploadImage = (file, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) return reject(error);

        resolve({
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });

const removeUploadedImages = async (images) => {
  await Promise.allSettled(
    images.map((image) =>
      cloudinary.uploader.destroy(image.publicId, {
        resource_type: 'image'
      })
    )
  );
};

// Admin: create a candidate with optional media
const createCandidate = async (req, res) => {
  const uploadedImages = [];

  try {
    const { name, manifesto } = req.body || {};
    const { electionId, positionId } = req.params;
    const files = req.files || {};

    if (
      !mongoose.isValidObjectId(electionId) ||
      !mongoose.isValidObjectId(positionId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election or position ID'
      });
    }

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name is required'
      });
    }

    if (name.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name cannot exceed 120 characters'
      });
    }

    if (
      typeof manifesto === 'string' &&
      manifesto.trim().length > 3000
    ) {
      return res.status(400).json({
        success: false,
        message: 'Manifesto cannot exceed 3000 characters'
      });
    }

    const election = await Election.findById(electionId);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    if (!['draft', 'scheduled'].includes(election.status)) {
      return res.status(400).json({
        success: false,
        message:
          'Candidates can only be added to draft or scheduled elections'
      });
    }

    const position = await Position.findOne({
      _id: positionId,
      election: election._id
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found in this election'
      });
    }

    const folder = 'ballottrust/candidates';

    const photoPromise = files.photo?.[0]
      ? uploadImage(files.photo[0], `${folder}/photos`)
      : Promise.resolve(null);

    const flyerPromise = files.flyer?.[0]
      ? uploadImage(files.flyer[0], `${folder}/flyers`)
      : Promise.resolve(null);

    const manifestoFiles = files.manifestoImages || [];

    if (manifestoFiles.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'A maximum of 5 manifesto images is allowed'
      });
    }

    const manifestoPromises = manifestoFiles.map((file) =>
      uploadImage(file, `${folder}/manifestos`)
    );

    // allSettled lets us clean up images even if one upload fails.
    const uploadResults = await Promise.allSettled([
      photoPromise,
      flyerPromise,
      ...manifestoPromises
    ]);

    for (const result of uploadResults) {
      if (result.status === 'fulfilled' && result.value) {
        uploadedImages.push(result.value);
      }
    }

    const failedUpload = uploadResults.find(
      (result) => result.status === 'rejected'
    );

    if (failedUpload) {
      await removeUploadedImages(uploadedImages);

      return res.status(502).json({
        success: false,
        message: 'One or more candidate images could not be uploaded'
      });
    }

    const photo = uploadResults[0].value;
    const flyer = uploadResults[1].value;
    const manifestoImages = uploadResults
      .slice(2)
      .map((result) => result.value.url);

    const candidate = await Candidate.create({
      name: name.trim(),
      manifesto:
        typeof manifesto === 'string' ? manifesto.trim() : '',
      photoUrl: photo?.url || '',
      flyerUrl: flyer?.url || '',
      manifestoImages,
      position: position._id,
      election: election._id
    });

    return res.status(201).json({
      success: true,
      message: 'Candidate created successfully',
      candidate
    });
  } catch (error) {
    await removeUploadedImages(uploadedImages);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Create candidate error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create candidate'
    });
  }
};

// Public: list candidates for a position
const getCandidatesByPosition = async (req, res) => {
  try {
    const { electionId, positionId } = req.params;

    if (
      !mongoose.isValidObjectId(electionId) ||
      !mongoose.isValidObjectId(positionId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election or position ID'
      });
    }

    const position = await Position.findOne({
      _id: positionId,
      election: electionId
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found in this election'
      });
    }

    const candidates = await Candidate.find({
      position: position._id,
      election: electionId
    })
      .sort({ name: 1 })
      .lean();

    const formattedCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        let candidateName = candidate.name;

        // Preserve support for older records containing a user reference.
        if (!candidateName && candidate.user) {
          const user = await User.findById(candidate.user)
            .select('name')
            .lean();

          candidateName = user?.name;
        }

        return {
          ...candidate,
          name: candidateName || 'Unnamed candidate',
          photoUrl: candidate.photoUrl || '',
          flyerUrl: candidate.flyerUrl || '',
          manifestoImages: candidate.manifestoImages || []
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: formattedCandidates.length,
      candidates: formattedCandidates
    });
  } catch (error) {
    console.error('Get candidates error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve candidates'
    });
  }
};

module.exports = {
  createCandidate,
  getCandidatesByPosition
};
