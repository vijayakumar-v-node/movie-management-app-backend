const Movie = require('../models/movie-model');
const fs = require('fs');

exports.createMovie = async (req, res) => {
  try {
    const { body, files } = req;
    if (!body.title || !body.description || !body.cast || !body.crew || !body.releaseDate) {
      return res.status(400).json({ message: 'All fields are required' });
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
      startDate,
      endDate,
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
    if (startDate || endDate) {
      query.releaseDate = {};
      if (startDate) query.releaseDate.$gte = new Date(startDate);
      if (endDate) query.releaseDate.$lte = new Date(endDate);
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

    // Full URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const updatedMovies = movies.map(movie => {
      const m = movie.toObject();

      return {
        ...m,
        thumbnailUrl: m.thumbnailUrl ? `${baseUrl}/${m.thumbnailUrl}` : null,
        videoUrl: m.videoUrl ? `${baseUrl}/${m.videoUrl}` : null
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
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const updatedMovie = {
      ...movie.toObject(),
      thumbnailUrl: movie.thumbnailUrl ? `${baseUrl}/${movie.thumbnailUrl}` : null,
      videoUrl: movie.videoUrl ? `${baseUrl}/${movie.videoUrl}` : null
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
    let updateFields = {
      ...(req.body),
      cast: JSON.parse(body.cast || '[]'),
      crew: JSON.parse(body.crew || '[]'),
      thumbnailUrl: files?.thumbnail?.[0]?.path,
      videoUrl: files?.video?.[0]?.path
    }
    // update movie
    await Movie.findByIdAndUpdate(req.params.id, updateFields);
    res.status(200).json({ message: 'Movie updated successfully' });
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
    // delete movie files from storage
    if (findMovie.thumbnailUrl) {
      fs.unlinkSync(`${findMovie.thumbnailUrl}`);
    }
    if (findMovie.videoUrl) {
      fs.unlinkSync(`${findMovie.videoUrl}`);
    }
    // delete movie
    await Movie.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Movie deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};