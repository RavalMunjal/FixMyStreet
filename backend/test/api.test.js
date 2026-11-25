const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Issue = require('../models/Issue');
const { ensureDefaultAccounts } = require('../utils/seedAdmin');

async function runTests() {
  console.log('🧪 Starting FixMyStreet Backend API Verification...\n');

  // Give connectDB() a brief moment to settle in case MongoDB is running locally
  await new Promise((r) => setTimeout(r, 800));

  let server;
  const PORT = 5099;

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server running on http://localhost:${PORT}`);
      resolve();
    });
  });

  let testsPassed = 0;
  let testsFailed = 0;

  const request = (method, path, body = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          ...(body instanceof Buffer
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      });

      req.on('error', reject);
      if (body instanceof Buffer) {
        req.write(body);
      } else if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  const buildMultipartImage = (filename = 'test.png', mime = 'image/png') => {
    const boundary = '----FixMyStreetTestBoundary12345';
    // 1x1 transparent PNG bytes
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    return {
      body: Buffer.concat([header, pngBytes, footer]),
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  };

  const assert = (description, condition, extra = '') => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${description}${extra ? ` -> ${extra}` : ''}`);
      testsFailed++;
    }
  };

  const testCitizenEmail = `e2e_citizen_${Date.now()}@test.com`;
  let createdIssueId = null;

  try {
    // 1. Health check
    const health = await request('GET', '/api/health');
    assert(
      'GET /api/health returns 200 and healthy status',
      health.status === 200 && health.body.success === true
    );

    // 2. Protected route rejects missing token
    const protectedRes = await request('GET', '/api/auth/me');
    assert(
      'GET /api/auth/me rejects missing token with 401',
      protectedRes.status === 401 && protectedRes.body.success === false
    );

    // 3. Invalid/expired JWT returns 401
    const expiredToken = jwt.sign(
      { id: new mongoose.Types.ObjectId(), role: 'citizen' },
      process.env.JWT_SECRET || 'fixmystreet_super_secret_jwt_key_2026',
      { expiresIn: -10 }
    );
    const expiredRes = await request('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${expiredToken}`,
    });
    assert(
      'GET /api/auth/me rejects expired JWT with 401',
      expiredRes.status === 401 && expiredRes.body.success === false
    );

    // 4. Register missing fields validation
    const badRegister = await request('POST', '/api/auth/register', {
      email: 'test@example.com',
    });
    assert(
      'POST /api/auth/register rejects missing fields with 400',
      badRegister.status === 400 && badRegister.body.success === false
    );

    // 5. Root API metadata
    const rootRes = await request('GET', '/');
    assert(
      'GET / returns API metadata and version',
      rootRes.status === 200 && rootRes.body.version === '1.0.0'
    );

    // 6. 404 route handling
    const notFound = await request('GET', '/api/unknown-endpoint');
    assert(
      'Unrecognized routes return 404 with structured JSON error',
      notFound.status === 404 && notFound.body.success === false
    );

    // Run full DB end-to-end tests when MongoDB is connected
    if (mongoose.connection.readyState === 1) {
      await ensureDefaultAccounts();

      // 7. Register new citizen
      const regRes = await request('POST', '/api/auth/register', {
        name: 'E2E Test Citizen',
        email: testCitizenEmail,
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      assert(
        'POST /api/auth/register creates new citizen & returns JWT',
        regRes.status === 201 && !!regRes.body?.data?.token
      );
      const citizenToken = regRes.body?.data?.token;

      // 8. Wrong password login returns 401
      const wrongPass = await request('POST', '/api/auth/login', {
        email: testCitizenEmail,
        password: 'WrongPassword',
      });
      assert(
        'POST /api/auth/login rejects wrong password with 401',
        wrongPass.status === 401 && wrongPass.body.success === false
      );

      // 9. Valid citizen login
      const goodLogin = await request('POST', '/api/auth/login', {
        email: testCitizenEmail,
        password: 'Password123',
      });
      assert(
        'POST /api/auth/login succeeds with valid credentials',
        goodLogin.status === 200 && !!goodLogin.body?.data?.token
      );

      // 10. Citizen blocked from admin endpoint (403)
      const adminBlock = await request('GET', '/api/admin/dashboard', null, {
        Authorization: `Bearer ${citizenToken}`,
      });
      assert(
        'GET /api/admin/dashboard blocks citizen role with 403',
        adminBlock.status === 403 && adminBlock.body.success === false
      );

      // 11. Image upload multipart works (even without live Cloudinary keys)
      const mp = buildMultipartImage('street.png', 'image/png');
      const uploadRes = await request('POST', '/api/uploads/image', mp.body, {
        Authorization: `Bearer ${citizenToken}`,
        'Content-Type': mp.contentType,
        'Content-Length': mp.body.length,
      });
      assert(
        'POST /api/uploads/image uploads multipart image cleanly',
        uploadRes.status === 201 && !!uploadRes.body?.data?.url,
        JSON.stringify(uploadRes.body)
      );
      const uploadedUrl = uploadRes.body?.data?.url;

      // 12. Issue creation rejects invalid coordinates
      const badCoords = await request(
        'POST',
        '/api/issues',
        {
          title: 'Test pothole',
          description: 'Deep pothole near market',
          category: 'Pothole',
          imageUrl: uploadedUrl,
          latitude: '',
          longitude: 72.5,
        },
        { Authorization: `Bearer ${citizenToken}` }
      );
      assert(
        'POST /api/issues rejects empty/invalid coordinates with 400',
        badCoords.status === 400 && badCoords.body.success === false
      );

      // 13. Valid issue creation persists to MongoDB
      const createRes = await request(
        'POST',
        '/api/issues',
        {
          title: 'E2E Streetlight Broken',
          description: 'Flickering lamp post near crossing',
          category: 'Broken Streetlight',
          imageUrl: uploadedUrl,
          latitude: 23.025,
          longitude: 72.575,
          address: 'Test Crossing, Sector 5',
        },
        { Authorization: `Bearer ${citizenToken}` }
      );
      createdIssueId = createRes.body?.data?.issue?._id;
      assert(
        'POST /api/issues saves complaint & returns populated issue',
        createRes.status === 201 && !!createdIssueId,
        JSON.stringify(createRes.body)
      );

      // 14. GET /api/issues handles regex metacharacters & negative page safely
      const searchRes = await request(
        'GET',
        '/api/issues?search=(test[&page=0&limit=-5'
      );
      assert(
        'GET /api/issues handles regex chars & returns real stats',
        searchRes.status === 200 && typeof searchRes.body?.data?.stats?.total === 'number'
      );

      // 15. Admin login & status update persistence
      const adminLogin = await request('POST', '/api/auth/login', {
        email: process.env.ADMIN_EMAIL || 'admin@fixmystreet.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      });
      const adminToken = adminLogin.body?.data?.token;
      assert(
        'Admin demo account logs in with role admin',
        adminLogin.status === 200 && adminLogin.body?.data?.user?.role === 'admin'
      );

      if (adminToken && createdIssueId) {
        const updateRes = await request(
          'PATCH',
          `/api/admin/issues/${createdIssueId}/status`,
          { status: 'In Progress', adminNote: 'Crew assigned for repair' },
          { Authorization: `Bearer ${adminToken}` }
        );
        assert(
          'PATCH /api/admin/issues/:id/status persists In Progress & adminNote',
          updateRes.status === 200 &&
            updateRes.body?.data?.issue?.status === 'In Progress' &&
            updateRes.body?.data?.issue?.adminNote === 'Crew assigned for repair'
        );
      }

      // Cleanup synthetic test records
      if (createdIssueId) {
        await Issue.findByIdAndDelete(createdIssueId);
      }
      await User.deleteOne({ email: testCitizenEmail });
    } else {
      console.log('  ℹ️ MongoDB not connected in test env; skipping DB E2E assertions.');
    }
  } catch (err) {
    console.error('Test suite error:', err);
    testsFailed++;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    server.close(() => {
      console.log('\n=======================================');
      console.log(`🏁 API Verification Completed:`);
      console.log(`   Passed: ${testsPassed}`);
      console.log(`   Failed: ${testsFailed}`);
      console.log('=======================================\n');
      process.exit(testsFailed > 0 ? 1 : 0);
    });
  }
}

runTests();
