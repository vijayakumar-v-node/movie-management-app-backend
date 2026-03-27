const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

// File Filter (Type Validation)
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'thumbnail') {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed for thumbnail'), false);
    }
  }

  if (file.fieldname === 'video') {
    if (file.mimetype !== 'video/mp4') {
      return cb(new Error('Only MP4 videos allowed'), false);
    }
  }

  cb(null, true);
};

// Multer Instance with limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 2, // total files allowed (1 thumbnail + 1 video)
    fileSize: 200 * 1024 * 1024 // allow up to 200MB (for videos)
  }
});

const uploadImageToCloudinary = (filePath) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      {
        folder: 'movies/thumbnails',
        resource_type: 'image',
        timeout: 120000
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });

const uploadVideoToCloudinary = (filePath) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      {
        folder: 'movies/videos',
        resource_type: 'video',
        chunk_size: 6 * 1024 * 1024,
        timeout: 600000
      },
      (error, result) => {
        if (error) return reject(error);

        // upload_large may emit chunk progress payloads before final URL payload.
        if (result?.secure_url || result?.url) {
          return resolve(result);
        }

        if (result?.done === true) {
          return resolve(result);
        }
      }
    );
  });

const uploadToCloudinary = async (file) => {
  if (file.fieldname === 'video') {
    return uploadVideoToCloudinary(file.path);
  }

  return uploadImageToCloudinary(file.path);
};

const getFinalCloudinaryResult = (result) => {
  if (!result) return null;

  // upload_large can return intermediate chunk responses in some SDK versions.
  if (Array.isArray(result)) {
    for (let i = result.length - 1; i >= 0; i -= 1) {
      if (result[i]?.secure_url || result[i]?.url) return result[i];
    }
    return result[result.length - 1] || null;
  }

  if (typeof result === 'object' && Array.isArray(result.responses)) {
    for (let i = result.responses.length - 1; i >= 0; i -= 1) {
      if (result.responses[i]?.secure_url || result.responses[i]?.url) {
        return result.responses[i];
      }
    }
  }

  if (result?.result && (result.result.secure_url || result.result.url)) {
    return result.result;
  }

  return result || null;
};

const safeDeleteTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (_error) {
    // Best effort cleanup for temp files.
  }
};

const uploadWithRetry = async (file, attempts = 2) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await uploadToCloudinary(file);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }
  }
  throw lastError;
};

const uploadFields = (req, res, next) => {
  const handler = upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]);

  handler(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    try {
      const entries = Object.entries(req.files || {});
      await Promise.all(
        entries.flatMap(([field, files]) =>
          files.map(async (file) => {
            const tempPath = file.path;
            try {
              const rawResult = await uploadWithRetry(file);
              const result = getFinalCloudinaryResult(rawResult);
              const uploadedUrl = result?.secure_url || result?.url;

              if (!uploadedUrl) {
                throw new Error('Cloudinary upload succeeded but returned no file URL.');
              }

              file.path = uploadedUrl;
              file.filename = result.public_id;
              file.cloudinary = result;
              file.fieldname = field;
            } finally {
              await safeDeleteTempFile(tempPath);
            }
          })
        )
      );
      next();
    } catch (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }
  });
};

module.exports = uploadFields;