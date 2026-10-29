
const mongoose = require('mongoose');
const { Readable } = require('stream');

const Candidate = require('../models/Candidate');
const Position = require('../models/Position');
const Election = require('../models/election');
const User = require('../models/User');
const Vote = require('../models/Vote');
const cloudinary = require('../config/cloudinary');

const normalizeStatus = (status) => {
  if (typeof status !== 'string') return '';

  const value = status.trim().toLowerCase();
  return value === 'upcoming' ? 'scheduled' : value;
};

const canManageElection = (election) =>
  ['draft', 'scheduled'].includes(normalizeStatus(election.status));

const uploadImage = (file, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) return reject(error);

        if (!result?.secure_url || !result?.public_id) {
          return reject(
            new Error('Cloudinary returned an invalid upload result.')
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });

const removeUploadedImages = async (images) => {
  const publicIds = [
    ...new Set(images.map((image) => image?.publicId).filter(Boolean))
  ];

  await removeCloudinaryAssets(publicIds);
};

const removeCloudinaryAssets = async (publicIds) => {
  const uniqueIds = [...new Set(publicIds.filter(Boolean))];

  const results = await Promise.allSettled(
    uniqueIds.map((publicId) =>
      cloudinary.uploader.destroy(publicId, {
        resource_type: 'image'
      })
    )
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Cloudinary asset cleanup failed:', result.reason);
    }
  });
};

const getUploadedFiles = (req) => req.files || {};

const isTrue = (value) =>
  typeof value === 'string' && value.trim().toLowerCase() === 'true';

const validateIds = (electionId, positionId, candidateId = null) =>
  mongoose.isValidObjectId(electionId) &&
  mongoose.isValidObjectId(positionId) &&
  (candidateId === null || mongoose.isValidObjectId(candidateId));

const findCandidateContext = async ({
  electionId,
  positionId,
  candidateId
}) => {
  const election = await Election.findById(electionId);

  if (!election) {
    return {
      error: { status: 404, message: 'Election not found' }
    };
  }

  const position = await Position.findOne({
    _id: positionId,
    election: election._id
  });

  if (!position) {
    return {
      error: {
        status: 404,
        message: 'Position not found in this election'
      }
    };
  }

  const candidate = await Candidate.findOne({
    _id: candidateId,
    election: election._id,
    position: position._id
  });

  if (!candidate) {
    return {
      error: {
        status: 404,
        message: 'Candidate not found in this position and election'
      }
    };
  }

  return { election, position, candidate };
};

const respondWithContextError = (res, context) => {
  if (!context.error) return false;

  res.status(context.error.status).json({
    success: false,
    message: context.error.message
  });

  return true;
};

// Admin: create a candidate with optional media.
const createCandidate = async (req, res) => {
  const uploadedImages = [];
  let candidateSaved = false;

  try {
    const { name, manifesto } = req.body || {};
    const { electionId, positionId } = req.params;
    const files = getUploadedFiles(req);

    if (!validateIds(electionId, positionId)) {
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

    if (manifesto !== undefined && typeof manifesto !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Manifesto must be text'
      });
    }

    if (typeof manifesto === 'string' && manifesto.trim().length > 3000) {
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

    if (!canManageElection(election)) {
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

    const manifestoFiles = files.manifestoImages || [];

    if (manifestoFiles.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'A maximum of 5 manifesto images is allowed'
      });
    }

    const folder = 'ballottrust/candidates';

    const uploadResults = await Promise.allSettled([
      files.photo?.[0]
        ? uploadImage(files.photo[0], `${folder}/photos`)
        : Promise.resolve(null),

      files.flyer?.[0]
        ? uploadImage(files.flyer[0], `${folder}/flyers`)
        : Promise.resolve(null),

      ...manifestoFiles.map((file) =>
        uploadImage(file, `${folder}/manifestos`)
      )
    ]);

    uploadResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        uploadedImages.push(result.value);
      }
    });

    if (uploadResults.some((result) => result.status === 'rejected')) {
      await removeUploadedImages(uploadedImages);

      return res.status(502).json({
        success: false,
        message: 'One or more candidate images could not be uploaded'
      });
    }

    const photo = uploadResults[0].value;
    const flyer = uploadResults[1].value;
    const manifestoUploads = uploadResults.slice(2).map(
      (result) => result.value
    );

    const candidate = await Candidate.create({
      name: name.trim(),
      manifesto: typeof manifesto === 'string' ? manifesto.trim() : '',
      photoUrl: photo?.url || '',
      photoPublicId: photo?.publicId || '',
      flyerUrl: flyer?.url || '',
      flyerPublicId: flyer?.publicId || '',
      manifestoImages: manifestoUploads.map((image) => image.url),
      manifestoImagePublicIds: manifestoUploads.map(
        (image) => image.publicId
      ),
      position: position._id,
      election: election._id
    });

    candidateSaved = true;

    return res.status(201).json({
      success: true,
      message: 'Candidate created successfully',
      candidate
    });
  } catch (error) {
    if (!candidateSaved) {
      await removeUploadedImages(uploadedImages);
    }

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

// Public: list candidates for a position.
const getCandidatesByPosition = async (req, res) => {
  try {
    const { electionId, positionId } = req.params;

    if (!validateIds(electionId, positionId)) {
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
      .select(
        'name manifesto photoUrl flyerUrl manifestoImages position election createdAt updatedAt user'
      )
      .sort({ name: 1 })
      .lean();

    const formattedCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        let candidateName = candidate.name;

        if (!candidateName && candidate.user) {
          const user = await User.findById(candidate.user)
            .select('name')
            .lean();

          candidateName = user?.name;
        }

        // Explicitly expose only public candidate fields.
        return {
          _id: candidate._id,
          name: candidateName || 'Unnamed candidate',
          manifesto: candidate.manifesto || '',
          photoUrl: candidate.photoUrl || '',
          flyerUrl: candidate.flyerUrl || '',
          manifestoImages: candidate.manifestoImages || [],
          position: candidate.position,
          election: candidate.election,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt
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

// Admin: retrieve one candidate with election and position details.
const getCandidateById = async (req, res) => {
  try {
    const { electionId, positionId, candidateId } = req.params;

    if (!validateIds(electionId, positionId, candidateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election, position or candidate ID'
      });
    }

    const context = await findCandidateContext({
      electionId,
      positionId,
      candidateId
    });

    if (respondWithContextError(res, context)) return;

    const candidate = context.candidate.toObject();

    return res.status(200).json({
      success: true,
      candidate: {
        ...candidate,
        photoUrl: candidate.photoUrl || '',
        flyerUrl: candidate.flyerUrl || '',
        manifestoImages: candidate.manifestoImages || [],
        positionDetails: {
          id: String(context.position._id),
          title: context.position.title
        },
        electionDetails: {
          id: String(context.election._id),
          title: context.election.title,
          status: normalizeStatus(context.election.status)
        }
      }
    });
  } catch (error) {
    console.error('Get candidate details error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve candidate details'
    });
  }
};

// Admin: update candidate details and optionally replace media.
const updateCandidate = async (req, res) => {
  const newUploads = [];

  try {
    const { electionId, positionId, candidateId } = req.params;
    const files = getUploadedFiles(req);
    const body = req.body || {};

    if (!validateIds(electionId, positionId, candidateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election, position or candidate ID'
      });
    }

    const context = await findCandidateContext({
      electionId,
      positionId,
      candidateId
    });

    if (respondWithContextError(res, context)) return;

    if (!canManageElection(context.election)) {
      return res.status(400).json({
        success: false,
        message:
          'Candidates can only be edited in draft or scheduled elections'
      });
    }

    const candidate = context.candidate;

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Candidate name cannot be empty'
        });
      }

      if (body.name.trim().length > 120) {
        return res.status(400).json({
          success: false,
          message: 'Candidate name cannot exceed 120 characters'
        });
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'manifesto')) {
      if (typeof body.manifesto !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Manifesto must be text'
        });
      }

      if (body.manifesto.trim().length > 3000) {
        return res.status(400).json({
          success: false,
          message: 'Manifesto cannot exceed 3000 characters'
        });
      }
    }

    const manifestoFiles = files.manifestoImages || [];

    if (manifestoFiles.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'A maximum of 5 manifesto images is allowed'
      });
    }

    if (isTrue(body.clearManifestoImages) && manifestoFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Choose new manifesto images or clear existing images, not both'
      });
    }

    if (
      isTrue(body.removePhoto) &&
      files.photo?.[0]
    ) {
      return res.status(400).json({
        success: false,
        message: 'Choose a new photo or remove the existing photo, not both'
      });
    }

    if (
      isTrue(body.removeFlyer) &&
      files.flyer?.[0]
    ) {
      return res.status(400).json({
        success: false,
        message: 'Choose a new flyer or remove the existing flyer, not both'
      });
    }

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      candidate.name = body.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'manifesto')) {
      candidate.manifesto = body.manifesto.trim();
    }

    const folder = 'ballottrust/candidates';
    const oldAssetsToRemove = [];

    if (files.photo?.[0]) {
      const photo = await uploadImage(
        files.photo[0],
        `${folder}/photos`
      );

      newUploads.push(photo);

      if (candidate.photoPublicId) {
        oldAssetsToRemove.push(candidate.photoPublicId);
      }

      candidate.photoUrl = photo.url;
      candidate.photoPublicId = photo.publicId;
    } else if (isTrue(body.removePhoto)) {
      if (candidate.photoPublicId) {
        oldAssetsToRemove.push(candidate.photoPublicId);
      }

      candidate.photoUrl = '';
      candidate.photoPublicId = '';
    }

    if (files.flyer?.[0]) {
      const flyer = await uploadImage(
        files.flyer[0],
        `${folder}/flyers`
      );

      newUploads.push(flyer);

      if (candidate.flyerPublicId) {
        oldAssetsToRemove.push(candidate.flyerPublicId);
      }

      candidate.flyerUrl = flyer.url;
      candidate.flyerPublicId = flyer.publicId;
    } else if (isTrue(body.removeFlyer)) {
      if (candidate.flyerPublicId) {
        oldAssetsToRemove.push(candidate.flyerPublicId);
      }

      candidate.flyerUrl = '';
      candidate.flyerPublicId = '';
    }

    if (manifestoFiles.length > 0) {
      const results = await Promise.allSettled(
        manifestoFiles.map((file) =>
          uploadImage(file, `${folder}/manifestos`)
        )
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          newUploads.push(result.value);
        }
      });

      if (results.some((result) => result.status === 'rejected')) {
        await removeUploadedImages(newUploads);
        newUploads.length = 0;

        return res.status(502).json({
          success: false,
          message: 'One or more manifesto images could not be uploaded'
        });
      }

      oldAssetsToRemove.push(
        ...(candidate.manifestoImagePublicIds || [])
      );

      candidate.manifestoImages = results.map(
        (result) => result.value.url
      );

      candidate.manifestoImagePublicIds = results.map(
        (result) => result.value.publicId
      );
    } else if (isTrue(body.clearManifestoImages)) {
      oldAssetsToRemove.push(
        ...(candidate.manifestoImagePublicIds || [])
      );

      candidate.manifestoImages = [];
      candidate.manifestoImagePublicIds = [];
    }

    try {
      await candidate.save();
    } catch (saveError) {
      await removeUploadedImages(newUploads);
      newUploads.length = 0;
      throw saveError;
    }

    // Only remove old media after the database save succeeds.
    await removeCloudinaryAssets(oldAssetsToRemove);

    return res.status(200).json({
      success: true,
      message: 'Candidate updated successfully',
      candidate
    });
  } catch (error) {
    // Clean up new uploads only once when the update fails.
    await removeUploadedImages(newUploads);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Update candidate error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update candidate'
    });
  }
};

// Admin: delete a candidate only when no submitted ballot references them.
const deleteCandidate = async (req, res) => {
  try {
    const { electionId, positionId, candidateId } = req.params;

    if (!validateIds(electionId, positionId, candidateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election, position or candidate ID'
      });
    }

    const context = await findCandidateContext({
      electionId,
      positionId,
      candidateId
    });

    if (respondWithContextError(res, context)) return;

    if (!canManageElection(context.election)) {
      return res.status(400).json({
        success: false,
        message:
          'Candidates can only be deleted from draft or scheduled elections'
      });
    }

    const hasVotes = await Vote.exists({
      election: context.election._id,
      'selections.candidate': context.candidate._id
    });

    if (hasVotes) {
      return res.status(409).json({
        success: false,
        message:
          'This candidate is referenced by a submitted ballot and cannot be deleted.'
      });
    }

    const publicIds = [
      context.candidate.photoPublicId,
      context.candidate.flyerPublicId,
      ...(context.candidate.manifestoImagePublicIds || [])
    ].filter(Boolean);

    await Candidate.deleteOne({
      _id: context.candidate._id
    });

    // Media cleanup failures are logged; the deleted candidate is not restored.
    await removeCloudinaryAssets(publicIds);

    return res.status(200).json({
      success: true,
      message: 'Candidate deleted successfully'
    });
  } catch (error) {
    console.error('Delete candidate error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete candidate'
    });
  }
};

module.exports = {
  createCandidate,
  getCandidatesByPosition,
  getCandidateById,
  updateCandidate,
  deleteCandidate
};
