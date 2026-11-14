const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FixMyStreet API is healthy and running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.send('FixMyStreet Backend API Running');
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`FixMyStreet Backend running on port ${PORT}`);
  });
}

module.exports = app;
