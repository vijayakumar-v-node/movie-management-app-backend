const express = require('express');
const router = express.Router();
const { login, register } = require('../controllers/user-controller');

// api's for register & login of the user
router.post('/register', register);
router.post('/login', login);

module.exports = router;