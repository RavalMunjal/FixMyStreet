const http = require('http');
const app = require('../server');

// Simple standalone integration test suite for FixMyStreet
async function runTests() {
  console.log('🧪 Starting FixMyStreet Backend API Automated Verification...\n');

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
          'Content-Type': 'application/json',
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
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  const assert = (description, condition) => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      testsFailed++;
    }
  };

  try {
    // Test 1: Health check endpoint
    const health = await request('GET', '/api/health');
    assert(
      'GET /api/health returns 200 and healthy status',
      health.status === 200 && health.body.success === true
    );

    // Test 2: Unauthenticated access to protected endpoint
    const protectedRes = await request('GET', '/api/auth/me');
    assert(
      'GET /api/auth/me rejects missing token with 401',
      protectedRes.status === 401 && protectedRes.body.success === false
    );

    // Test 3: Invalid login credentials handling
    const badLogin = await request('POST', '/api/auth/login', {
      email: 'nonexistent@test.com',
      password: 'WrongPassword',
    });
    assert(
      'POST /api/auth/login validates credentials (returns 401 or 503 when DB pending)',
      (badLogin.status === 401 || badLogin.status === 503) && badLogin.body.success === false
    );

    // Test 4: Register missing fields validation
    const badRegister = await request('POST', '/api/auth/register', {
      email: 'test@example.com',
    });
    assert(
      'POST /api/auth/register rejects missing fields with 400',
      badRegister.status === 400 && badRegister.body.success === false
    );

    // Test 5: Root API information
    const rootRes = await request('GET', '/');
    assert(
      'GET / returns API metadata and version',
      rootRes.status === 200 && rootRes.body.version === '1.0.0'
    );

    // Test 6: 404 Route handling
    const notFound = await request('GET', '/api/unknown-endpoint');
    assert(
      'Unrecognized routes return 404 with structured JSON error',
      notFound.status === 404 && notFound.body.success === false
    );
  } catch (err) {
    console.error('Test suite error:', err);
  } finally {
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
