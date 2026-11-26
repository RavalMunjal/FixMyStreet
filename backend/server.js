const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { ensureDefaultAccounts } = require('./utils/seedAdmin');

// Route imports
const authRoutes = require('./routes/authRoutes');
const issueRoutes = require('./routes/issueRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Load environment variables
dotenv.config();

// Connect to MongoDB and provision default accounts if needed
connectDB().then((connected) => {
  if (connected && process.env.NODE_ENV !== 'test') {
    ensureDefaultAccounts().catch((err) =>
      console.warn('Default account check skipped:', err.message)
    );
  }
});

const app = express();
const PORT = process.env.PORT || 5000;

// Security & middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic rate limiting for authentication & uploads
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FixMyStreet API is healthy and operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    name: 'FixMyStreet REST API',
    version: '1.0.0',
    documentation: 'See README.md for endpoint specifications',
  });
});

// 404 Route handler for unrecognized paths
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found on FixMyStreet API`,
  });
});

// Centralized error handling middleware
app.use(errorHandler);

// Start server unless imported for testing
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FixMyStreet Server listening on port ${PORT} (0.0.0.0)`);
    console.log(`📡 Health check available at http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
