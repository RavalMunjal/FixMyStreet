const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Issue = require('../models/Issue');
const { ensureDefaultAccounts } = require('../utils/seedAdmin');

async function runTests() {
  console.log('🧪 Starting FixMyStreet Complete Backend API Verification...\n');

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
  const createdIds = [];

  try {
    const health = await request('GET', '/api/health');
    assert(
      'GET /api/health returns 200 and healthy status',
      health.status === 200 && health.body.success === true
    );

    const protectedRes = await request('GET', '/api/auth/me');
    assert(
      'GET /api/auth/me rejects missing token with 401',
      protectedRes.status === 401 && protectedRes.body.success === false
    );

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

    const badRegister = await request('POST', '/api/auth/register', {
      email: 'test@example.com',
    });
    assert(
      'POST /api/auth/register rejects missing fields with 400',
      badRegister.status === 400 && badRegister.body.success === false
    );

    if (mongoose.connection.readyState === 1) {
      await ensureDefaultAccounts();

      // Auth & Role tests
      const regRes = await request('POST', '/api/auth/register', {
        name: 'E2E Test Citizen',
        email: testCitizenEmail,
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      const citizenToken = regRes.body?.data?.token;
      assert(
        'POST /api/auth/register creates citizen & returns JWT',
        regRes.status === 201 && !!citizenToken
      );

      const wrongPass = await request('POST', '/api/auth/login', {
        email: testCitizenEmail,
        password: 'WrongPassword',
      });
      assert(
        'POST /api/auth/login rejects wrong password with 401',
        wrongPass.status === 401 && wrongPass.body.success === false
      );

      const adminBlock = await request('GET', '/api/admin/dashboard', null, {
        Authorization: `Bearer ${citizenToken}`,
      });
      assert(
        'GET /api/admin/dashboard blocks citizen role with 403',
        adminBlock.status === 403 && adminBlock.body.success === false
      );

      // Multipart upload
      const mp = buildMultipartImage('street.png', 'image/png');
      const uploadRes = await request('POST', '/api/uploads/image', mp.body, {
        Authorization: `Bearer ${citizenToken}`,
        'Content-Type': mp.contentType,
        'Content-Length': mp.body.length,
      });
      const uploadedUrl = uploadRes.body?.data?.url;
      assert(
        'POST /api/uploads/image uploads multipart image cleanly',
        uploadRes.status === 201 && !!uploadedUrl
      );

      // Urgency validation
      const invalidUrgency = await request(
        'POST',
        '/api/issues',
        {
          title: 'Invalid urgency test',
          description: 'Testing validation',
          category: 'Pothole',
          imageUrl: uploadedUrl,
          latitude: 23.0225,
          longitude: 72.5714,
          requestedUrgency: 'Emergency',
        },
        { Authorization: `Bearer ${citizenToken}` }
      );
      assert(
        'POST /api/issues rejects invalid requestedUrgency with 400',
        invalidUrgency.status === 400 && invalidUrgency.body.success === false
      );

      // Create Issue A (~0.4km from 23.0225, 72.5714) with requestedUrgency High
      const issueARes = await request(
        'POST',
        '/api/issues',
        {
          title: 'E2E Close Pothole',
          description: 'Very deep crater',
          category: 'Pothole',
          imageUrl: uploadedUrl,
          latitude: 23.0255,
          longitude: 72.572,
          address: 'Close Street',
          requestedUrgency: 'High',
        },
        { Authorization: `Bearer ${citizenToken}` }
      );
      const issueA = issueARes.body?.data?.issue;
      if (issueA?._id) createdIds.push(issueA._id);
      assert(
        'POST /api/issues creates Reported issue, GeoJSON [lng,lat], requested High, confirmed Normal',
        issueARes.status === 201 &&
          issueA?.status === 'Reported' &&
          issueA?.requestedUrgency === 'High' &&
          issueA?.confirmedUrgency === 'Normal' &&
          issueA?.location?.coordinates?.[0] === 72.572 &&
          issueA?.location?.coordinates?.[1] === 23.0255 &&
          issueA?.statusHistory?.length === 1
      );

      // Create Issue B (~3.8km away) with default Normal urgency
      const issueBRes = await request(
        'POST',
        '/api/issues',
        {
          title: 'E2E Far Streetlight',
          description: 'Dark road',
          category: 'Broken Streetlight',
          imageUrl: uploadedUrl,
          latitude: 23.056,
          longitude: 72.572,
          address: 'Far Street',
        },
        { Authorization: `Bearer ${citizenToken}` }
      );
      const issueB = issueBRes.body?.data?.issue;
      if (issueB?._id) createdIds.push(issueB._id);
      assert(
        'POST /api/issues defaults requestedUrgency to Normal',
        issueBRes.status === 201 && issueB?.requestedUrgency === 'Normal'
      );

      // Support / Upvote deduplication & removal
      if (issueA?._id && issueB?._id) {
        const [s1, s2] = await Promise.all([
          request('POST', `/api/issues/${issueB._id}/support`, null, {
            Authorization: `Bearer ${citizenToken}`,
          }),
          request('POST', `/api/issues/${issueB._id}/support`, null, {
            Authorization: `Bearer ${citizenToken}`,
          }),
        ]);
        assert(
          'Parallel duplicate POST /:id/support keeps supportCount === 1',
          s1.status === 200 &&
            s2.status === 200 &&
            s2.body?.data?.supportCount === 1
        );

        const sortedRes = await request('GET', '/api/issues?sort=most_supported');
        const idxB = sortedRes.body?.data?.issues?.findIndex(
          (i) => i._id === issueB._id
        );
        const idxA = sortedRes.body?.data?.issues?.findIndex(
          (i) => i._id === issueA._id
        );
        assert(
          'GET /api/issues?sort=most_supported places supported issue before unsupported issue',
          idxB !== -1 && (idxA === -1 || idxB < idxA)
        );

        const remRes = await request('DELETE', `/api/issues/${issueB._id}/support`, null, {
          Authorization: `Bearer ${citizenToken}`,
        });
        assert(
          'DELETE /api/issues/:id/support decrements supportCount back to 0',
          remRes.status === 200 && remRes.body?.data?.supportCount === 0
        );
      }

      // Nearby filter tests (1km vs 5km)
      const near1 = await request(
        'GET',
        '/api/issues/nearby?latitude=23.0225&longitude=72.5714&radiusKm=1'
      );
      const hasA1 = near1.body?.data?.issues?.some((i) => i._id === issueA._id);
      const hasB1 = near1.body?.data?.issues?.some((i) => i._id === issueB._id);
      assert(
        'GET /api/issues/nearby radiusKm=1 includes 0.34km issue and excludes 3.7km issue',
        near1.status === 200 && hasA1 && !hasB1
      );

      const near5 = await request(
        'GET',
        '/api/issues/nearby?latitude=23.0225&longitude=72.5714&radiusKm=5'
      );
      const idxNearA = near5.body?.data?.issues?.findIndex(
        (i) => i._id === issueA._id
      );
      const idxNearB = near5.body?.data?.issues?.findIndex(
        (i) => i._id === issueB._id
      );
      assert(
        'GET /api/issues/nearby radiusKm=5 includes both sorted nearest-first with distanceKm',
        near5.status === 200 &&
          idxNearA !== -1 &&
          idxNearB !== -1 &&
          idxNearA < idxNearB &&
          typeof near5.body.data.issues[idxNearA].distanceKm === 'number'
      );

      // Admin timeline & urgency confirmation
      const adminLogin = await request('POST', '/api/auth/login', {
        email: process.env.ADMIN_EMAIL || 'admin@fixmystreet.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      });
      const adminToken = adminLogin.body?.data?.token;
      assert(
        'Admin demo account logs in with role admin',
        adminLogin.status === 200 && adminLogin.body?.data?.user?.role === 'admin'
      );

      if (adminToken && issueA?._id) {
        const urgRes = await request(
          'PATCH',
          `/api/admin/issues/${issueA._id}/urgency`,
          { confirmedUrgency: 'High' },
          { Authorization: `Bearer ${adminToken}` }
        );
        assert(
          'PATCH /api/admin/issues/:id/urgency updates confirmedUrgency to High',
          urgRes.status === 200 &&
            urgRes.body?.data?.issue?.confirmedUrgency === 'High'
        );

        await request(
          'PATCH',
          `/api/admin/issues/${issueA._id}/status`,
          { status: 'Under Review', adminNote: 'Inspection team assigned' },
          { Authorization: `Bearer ${adminToken}` }
        );
        const progRes = await request(
          'PATCH',
          `/api/admin/issues/${issueA._id}/status`,
          { status: 'In Progress', adminNote: 'Repair work underway' },
          { Authorization: `Bearer ${adminToken}` }
        );
        assert(
          'Admin status transitions build complete statusHistory timeline (Reported -> Under Review -> In Progress)',
          progRes.status === 200 &&
            progRes.body?.data?.issue?.status === 'In Progress' &&
            progRes.body?.data?.issue?.statusHistory?.length === 3 &&
            progRes.body?.data?.issue?.statusHistory[2].updatedByRole === 'admin'
        );
      }

      // Regex-unsafe query check
      const searchRes = await request(
        'GET',
        '/api/issues?search=(test[&page=0&limit=-5'
      );
      assert(
        'GET /api/issues handles regex chars & returns real stats',
        searchRes.status === 200 && typeof searchRes.body?.data?.stats?.total === 'number'
      );

      for (const cid of createdIds) {
        await Issue.findByIdAndDelete(cid);
      }
      await User.deleteOne({ email: testCitizenEmail });
    } else {
      console.log('  ℹ️ MongoDB not connected; skipping DB E2E assertions.');
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
