const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  cast: [{ name: String, role: String }],
  crew: [{ name: String, role: String }],
  releaseDate: String,
  genre: String,
  rating: { type: Number, min: 0, max: 10 },
  thumbnailUrl: String,
  videoUrl: String
}, { timestamps: true });

module.exports = mongoose.model('Movie', movieSchema);