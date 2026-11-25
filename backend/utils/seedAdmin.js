const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Issue = require('../models/Issue');

dotenv.config();

/**
 * Idempotently ensure the configured admin account (and demo citizen in dev)
 * exist in MongoDB once connected. Safe to call on server startup.
 */
const ensureDefaultAccounts = async () => {
  if (mongoose.connection.readyState !== 1) return;

  const adminEmail = (
    process.env.ADMIN_EMAIL || 'admin@fixmystreet.com'
  ).toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const adminName = process.env.ADMIN_NAME || 'Super Administrator';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      await existingAdmin.save();
    }
  } else {
    const passwordHash = await User.hashPassword(adminPassword);
    await User.create({
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: 'admin',
    });
    console.log(`🎉 Created default Admin account: ${adminEmail}`);
  }

  // Ensure demo citizen exists in development/local testing environments
  if (process.env.NODE_ENV !== 'production') {
    const demoEmail = 'citizen@fixmystreet.com';
    const existingCitizen = await User.findOne({ email: demoEmail });
    if (!existingCitizen) {
      const demoHash = await User.hashPassword('Citizen@123456');
      await User.create({
        name: 'Demo Citizen',
        email: demoEmail,
        passwordHash: demoHash,
        role: 'citizen',
      });
      console.log(`🎉 Created demo Citizen account: ${demoEmail}`);
    }
  }

  // Safely backfill GeoJSON coordinates on any legacy complaints missing them
  const legacyIssues = await Issue.find({
    'location.coordinates.0': { $exists: false },
    latitude: { $type: 'number' },
    longitude: { $type: 'number' },
  });

  for (const doc of legacyIssues) {
    doc.location = {
      type: 'Point',
      coordinates: [doc.longitude, doc.latitude],
    };
    if (typeof doc.supportCount !== 'number') {
      doc.supportCount = Array.isArray(doc.supporters) ? doc.supporters.length : 0;
    }
    await doc.save();
  }
};

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found. Please configure it in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for admin provisioning');

    await ensureDefaultAccounts();

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB. Account provisioning complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during admin seeding:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;
module.exports.ensureDefaultAccounts = ensureDefaultAccounts;
