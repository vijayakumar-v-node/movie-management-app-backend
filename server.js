require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const movieRoutes = require('./routes/movie-routes');
const userRoutes = require('./routes/user-routes')
const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/movies', movieRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('Movie-Management-App-Backend is running successfully!');
});
app.use((req, res, next) => {
  res.status(404).json({
    status: 404,
    message: "Sorry, the requested resource was not found on this server.",
  });
});

connectDB();

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));