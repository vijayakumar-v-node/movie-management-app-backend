const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const auth = require('../middlewares/auth');
const { createMovie, listMovies, getMovie, updateMovie, deleteMovie } = require('../controllers/movie-controller');

// REST api's for movies
router.post('/', auth, upload, createMovie);
router.get('/', auth, listMovies);
router.get('/:id', auth, getMovie);
router.put('/:id', auth, upload, updateMovie);
router.delete('/:id', auth, deleteMovie);

module.exports = router;