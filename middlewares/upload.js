const multer = require('multer');
const path = require('path');

// Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      cb(null, 'uploads/images');
    } else if (file.fieldname === 'video') {
      cb(null, 'uploads/videos');
    } else {
      cb(new Error('Invalid field name'), null);
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
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
    files: 2 // total files allowed (1 thumbnail + 1 video)
  }
});

// Custom Middleware Wrapper (IMPORTANT 🔥)
const uploadFields = (req, res, next) => {
  const handler = upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]);

  handler(req, res, function (err) {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

module.exports = uploadFields;