const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const classRoutes = require('./routes/classRoutes');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', classRoutes);

const PORT = process.env.PORT || 8080;
// Authenticate DB connection and sync
sequelize.authenticate()
  .then(() => {
    console.log(' DB connected');
    return sequelize.sync();
  })
  .then(() => {
    app.listen(PORT , () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(' Error connecting or syncing DB:', error);
  });
  sequelize.sync({ alter: true })  // Use alter: true for non-destructive changes
  .then(() => console.log('DB synced successfully'))
  .catch(error => console.error('Error syncing DB:', error));

