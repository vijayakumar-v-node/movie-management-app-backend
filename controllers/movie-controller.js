const Movie = require('../models/movie-model');
const cloudinary = require('../config/cloudinary');

const extractCloudinaryPublicId = (fileUrl) => {
  if (!fileUrl || !fileUrl.includes('res.cloudinary.com')) return null;

  try {
    const pathnameParts = new URL(fileUrl).pathname.split('/').filter(Boolean);
    const uploadIndex = pathnameParts.indexOf('upload');
    if (uploadIndex === -1) return null;

    const maybeVersion = pathnameParts[uploadIndex + 1] || '';
    const startIndex = maybeVersion.startsWith('v') ? uploadIndex + 2 : uploadIndex + 1;
    const publicIdWithExtension = pathnameParts.slice(startIndex).join('/');
    return publicIdWithExtension.replace(/\.[^/.]+$/, '');
  } catch (error) {
    return null;
  }
};

const deleteCloudinaryAsset = async (fileUrl) => {
  const publicId = extractCloudinaryPublicId(fileUrl);
  if (!publicId) return;

  const resourceType = fileUrl.includes('/video/upload/') ? 'video' : 'image';
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

exports.createMovie = async (req, res) => {
  try {
    const { body, files } = req;

    if (!body.title || !body.description || !body.releaseDate) {
      return res.status(400).json({ message: 'Title, description and release date is required.' });
    }
    let findMovie = await Movie.findOne({ title: body.title, releaseDate: body.releaseDate });
    if (findMovie) {
      return res.status(400).json({ message: 'Movie already exists' });
    }

    const movie = new Movie({
      ...body,
      cast: JSON.parse(body.cast || '[]'),
      crew: JSON.parse(body.crew || '[]'),
      thumbnailUrl: files?.thumbnail?.[0]?.path,
      videoUrl: files?.video?.[0]?.path
    });

    await movie.save();
    res.status(200).json({
      message: 'Movie created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listMovies = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      minRating,
      releaseDate,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {};

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    // Filter by rating
    if (minRating) {
      query.rating = { $gte: Number(minRating) };
    }

    // Filter by release date range
    if (releaseDate) {
      query.releaseDate = {};
      if (releaseDate) query.releaseDate = releaseDate;
    }

    // Sorting
    const allowedSortFields = ['title', 'releaseDate', 'genre', 'rating', 'createdAt'];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;

    const sortQuery = { [sortField]: sortOrder };
    // Fetch Data
    const movies = await Movie.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort(sortQuery);

    const updatedMovies = movies.map(movie => {
      const m = movie.toObject();

      return {
        ...m,
        thumbnailUrl: m.thumbnailUrl || null
      };
    });

    // Total Count 
    const total = await Movie.countDocuments(query);

    res.status(200).json({
      total,
      page: Number(page),
      limit: Number(limit),
      data: updatedMovies
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    const updatedMovie = {
      ...movie.toObject(),
      thumbnailUrl: movie.thumbnailUrl || null,
      videoUrl: movie.videoUrl || null
    };
    res.status(200).json(updatedMovie);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateMovie = async (req, res) => {
  try {
    const { body, files } = req;
    if (!body.title || !body.description || !body.cast || !body.crew || !body.releaseDate) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    // find existing movie with same title and release date
    let findMovie = await Movie.findOne({ _id: { $ne: req.params.id }, title: req.body.title, releaseDate: req.body.releaseDate });
    if (findMovie) {
      return res.status(400).json({ message: `The movie ${body.title} exists already.` });
    }
    const existingMovie = await Movie.findById(req.params.id);
    if (!existingMovie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    let updateFields = {
      ...(req.body),
      cast: JSON.parse(body.cast || '[]'),
      crew: JSON.parse(body.crew || '[]')
    };

    if (files?.thumbnail?.[0]?.path) {
      updateFields.thumbnailUrl = files.thumbnail[0].path;
      if (existingMovie.thumbnailUrl) {
        await deleteCloudinaryAsset(existingMovie.thumbnailUrl);
      }
    }

    if (files?.video?.[0]?.path) {
      updateFields.videoUrl = files.video[0].path;
      if (existingMovie.videoUrl) {
        await deleteCloudinaryAsset(existingMovie.videoUrl);
      }
    }

    // update movie
    const updatedMovie = await Movie.findByIdAndUpdate(req.params.id, updateFields, {
      new: true
    });
    res.status(200).json({
      message: 'Movie updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMovie = async (req, res) => {
  try {
    // find movie by id
    let findMovie = await Movie.findById(req.params.id);
    if (!findMovie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    // delete movie files from cloudinary
    if (findMovie.thumbnailUrl) {
      await deleteCloudinaryAsset(findMovie.thumbnailUrl);
    }
    if (findMovie.videoUrl) {
      await deleteCloudinaryAsset(findMovie.videoUrl);
    }
    // delete movie
    await Movie.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Movie deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};