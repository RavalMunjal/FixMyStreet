const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found. Please configure it in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for admin provisioning');

    const adminEmail = (
      process.env.ADMIN_EMAIL || 'admin@fixmystreet.com'
    ).toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminName = process.env.ADMIN_NAME || 'Super Administrator';

    let existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`ℹ️ Admin account already exists: ${adminEmail}`);
      // Ensure role is admin
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('Updated existing account to admin role.');
      }
    } else {
      const passwordHash = await User.hashPassword(adminPassword);
      const newAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'admin',
      });
      console.log(`🎉 Created default Admin successfully!`);
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Role: ${newAdmin.role}`);
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB. Admin provisioning complete.');
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
