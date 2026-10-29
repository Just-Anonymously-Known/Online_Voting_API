
const multer = require('multer');

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 7,
    fields: 10,
    parts: 20
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return callback(
        new Error('Only JPEG, PNG and WebP images are allowed.')
      );
    }

    return callback(null, true);
  }
});

const candidateMediaUpload = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'flyer', maxCount: 1 },
  { name: 'manifestoImages', maxCount: 5 }
]);

module.exports = {
  candidateMediaUpload
};
