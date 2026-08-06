process.env.NODE_ENV = 'test';

/**
 * Deep API Verification Script
 * Tests every endpoint, edge cases, error handling, and data integrity.
 */

const BASE = 'http://127.0.0.1:5000/api/v1';
let TOKEN = '';
let USER_TOKEN = '';
let createdBookingId = null;
let createdSlotId = null;
let createdReviewId = null;
let createdMessageId = null;
const results = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: '✅ PASS' });
    passed++;
  } catch (e) {
    results.push({ name, status: '❌ FAIL', error: e.message });
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function api(method, path, body = null, auth = false, isFormData = false) {
  const headers = {
    'X-Tenant-Slug': 'apexarena',
    'X-Bypass-Rate-Limit': 'test',
  };
  if (auth) {
    if (auth === 'user') {
      headers['Authorization'] = `Bearer ${USER_TOKEN}`;
    } else {
      headers['Authorization'] = `Bearer ${TOKEN}`;
    }
  }
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ok: res.ok };
}

async function run() {
  console.log('=== DEEP API VERIFICATION ===\n');

  // Health
  await test('Health endpoint returns 200 with DB status', async () => {
    const r = await api('GET', '/health');
    assert(r.status === 200, `Status ${r.status}`);
    assert(r.data.database === 'connected', 'DB not connected');
  });

  // Login
  await test('Login with valid credentials', async () => {
    const r = await api('POST', '/auth/login', { username: 'admin', password: 'adminpassword123' });
    assert(r.status === 200, `Status ${r.status}`);
    assert(r.data.token, 'No token returned');
    TOKEN = r.data.token;
  });

  await test('Login with wrong password returns 401', async () => {
    const r = await api('POST', '/auth/login', { username: 'admin', password: 'wrongpass' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Login with missing fields returns error', async () => {
    const r = await api('POST', '/auth/login', { username: '' });
    assert(!r.ok, `Expected error, got ${r.status}`);
  });

  await test('GET /auth/me with valid token', async () => {
    const r = await api('GET', '/auth/me', null, true);
    assert(r.status === 200, `Status ${r.status}`);
    assert(r.data.admin && r.data.admin.username === 'admin', 'Wrong admin data');
  });

  await test('GET /auth/me without token returns 401', async () => {
    const r = await api('GET', '/auth/me');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('GET /auth/me with invalid token returns 401', async () => {
    const headers = { 
      'Authorization': 'Bearer invalidtoken123',
      'X-Tenant-Slug': 'apexarena'
    };
    const res = await fetch(`${BASE}/auth/me`, { headers });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // User OTP Auth
  await test('User OTP registration and verification', async () => {
    const phone = '+88015' + Math.floor(10000000 + Math.random() * 90000000);
    
    // 1. Send OTP
    const r1 = await api('POST', '/user/send-otp', { phone });
    assert(r1.status === 200, `Send OTP status ${r1.status}`);
    assert(r1.data.devOtp, 'No devOtp returned in response');
    const devOtp = r1.data.devOtp;

    // 2. Verify OTP
    const r2 = await api('POST', '/user/verify-otp', { phone, code: devOtp });
    assert(r2.status === 200, `Verify OTP status ${r2.status}`);
    assert(r2.data.token, 'No user token returned');
    USER_TOKEN = r2.data.token;
  });

  // Info / Settings
  await test('GET /info returns public settings', async () => {
    const r = await api('GET', '/info');
    assert(r.status === 200, `Status ${r.status}`);
    assert(r.data.settings || r.data.success, 'No settings data');
    const s = r.data.settings;
    assert(s.businessName, 'No businessName');
    assert(s.pricing, 'No pricing');
    assert(s.hero, 'No hero config');
  });

  await test('GET /settings requires auth', async () => {
    const r = await api('GET', '/settings');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('GET /settings with auth returns full config', async () => {
    const r = await api('GET', '/settings', null, true);
    assert(r.status === 200, `Status ${r.status}`);
    assert(r.data.settings, 'No settings');
  });

  await test('PATCH /settings updates businessName', async () => {
    const r = await api('PATCH', '/settings', { businessName: 'Apex Arena Test' }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    // Verify
    const verify = await api('GET', '/info');
    assert(verify.data.settings.businessName === 'Apex Arena Test', 'Name not updated');
    // Revert
    await api('PATCH', '/settings', { businessName: 'Apex Arena' }, true);
  });

  await test('PATCH /settings updates discounts and GET /info returns them', async () => {
    const discounts = [
      { id: 'disc-1', name: 'Summer 10% Off', type: 'percentage', value: 10, startDate: '2026-08-01', endDate: '2026-08-31', isActive: true }
    ];
    const r = await api('PATCH', '/settings', { discounts }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    const verify = await api('GET', '/info');
    assert(Array.isArray(verify.data.settings.discounts), 'discounts is not array');
    assert(verify.data.settings.discounts.length === 1, 'discount rule count mismatch');
    assert(verify.data.settings.discounts[0].name === 'Summer 10% Off', 'discount name mismatch');
  });

  await test('GET /audit-logs returns system audit logs after actions', async () => {
    const r = await api('GET', '/audit-logs', null, true);
    assert(r.status === 200, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    assert(Array.isArray(r.data.logs), 'logs is not an array');
    assert(r.data.logs.length > 0, `Audit logs empty: ${JSON.stringify(r.data)}`);
  });

  // Grounds / Arenas Management
  let createdGroundId = null;

  await test('GET /grounds returns list of playing arenas', async () => {
    const r = await api('GET', '/grounds');
    assert(r.status === 200, `Status ${r.status}`);
    assert(Array.isArray(r.data.grounds), 'grounds is not an array');
  });

  await test('POST /grounds creates a new ground/arena', async () => {
    const r = await api('POST', '/grounds', {
      name: 'Test Ground 99',
      sport: 'Basketball',
      description: 'Indoor hardwood court'
    }, true);
    assert(r.status === 201, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    assert(r.data.ground?.id, 'No ground ID returned');
    createdGroundId = r.data.ground.id;
  });

  await test('PATCH /grounds/:id updates ground info', async () => {
    if (!createdGroundId) throw new Error('No created ground ID');
    const r = await api('PATCH', `/grounds/${createdGroundId}`, {
      name: 'Updated Test Ground 99'
    }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('DELETE /grounds/:id removes created test ground', async () => {
    if (!createdGroundId) throw new Error('No created ground ID');
    const r = await api('DELETE', `/grounds/${createdGroundId}`, null, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  // Slots
  await test('GET /available-slots without date param', async () => {
    const r = await api('GET', '/available-slots');
    assert(r.status === 200 || r.status === 400, `Unexpected ${r.status}`);
  });

  await test('GET /available-slots with valid date', async () => {
    const r = await api('GET', '/available-slots?date=2026-07-20');
    assert(r.status === 200, `Status ${r.status}`);
    assert(Array.isArray(r.data.slots), 'slots not an array');
  });

  await test('GET /slots (admin) returns slot list', async () => {
    const r = await api('GET', '/slots', null, true);
    assert(r.status === 200, `Status ${r.status}`);
    assert(Array.isArray(r.data.slots), 'slots not an array');
  });

  await test('POST /slots creates a new slot', async () => {
    const r = await api('POST', '/slots', {
      dayOfWeek: 1,
      startTime: '23:00',
      endTime: '23:59',
      isActive: true,
      rateType: 'night'
    }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    createdSlotId = r.data.slot?.id;
    assert(createdSlotId, 'No slot ID returned');
  });

  await test('PATCH /slots/:id updates slot', async () => {
    const r = await api('PATCH', `/slots/${createdSlotId}`, { isActive: false }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('DELETE /slots/:id removes slot', async () => {
    const r = await api('DELETE', `/slots/${createdSlotId}`, null, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('DELETE /slots with invalid ID returns 404', async () => {
    const r = await api('DELETE', '/slots/99999', null, true);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // Bookings
  // Generate collision-free future dates based on current timestamp with random offsets to prevent run conflicts
  const randomOffset = Math.floor(Math.random() * 1000) + 35;
  const bookingDateStr = new Date(Date.now() + randomOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const adminBookingDateStr = new Date(Date.now() + (randomOffset + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  await test('POST /booking creates a public booking', async () => {
    const r = await api('POST', '/booking', {
      customerName: 'Test User',
      phone: '+8801555000111',
      email: 'testuser@example.com',
      sport: 'Futsal',
      bookingDate: bookingDateStr,
      startTime: '10:00',
      endTime: '11:00',
      duration: 1,
      players: 8,
      notes: 'Deep test booking'
    }, 'user');
    assert(r.status === 201 || r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    createdBookingId = r.data.booking?.id;
    assert(createdBookingId, 'No booking ID returned');
  });

  await test('POST /booking with missing fields returns validation error', async () => {
    const r = await api('POST', '/booking', { customerName: 'No Phone' }, 'user');
    assert(!r.ok, `Expected error, got ${r.status}`);
  });

  await test('GET /dashboard returns admin stats', async () => {
    const r = await api('GET', '/dashboard', null, true);
    assert(r.status === 200, `Status ${r.status}`);
  });

  await test('GET /bookings lists all bookings', async () => {
    const r = await api('GET', '/bookings', null, true);
    assert(r.status === 200, `Status ${r.status}`);
    assert(Array.isArray(r.data.bookings), 'bookings not an array');
  });

  await test('GET /bookings with status filter', async () => {
    const r = await api('GET', '/bookings?status=Pending', null, true);
    assert(r.status === 200, `Status ${r.status}`);
    if (r.data.bookings.length > 0) {
      r.data.bookings.forEach(b => {
        assert(b.status === 'Pending', `Found non-Pending: ${b.status}`);
      });
    }
  });

  await test('GET /bookings/:id returns specific booking', async () => {
    const r = await api('GET', `/bookings/${createdBookingId}`, null, true);
    assert(r.status === 200, `Status ${r.status}`);
    assert(r.data.booking.customerName.includes('Test User'), 'Wrong customer name');
  });

  await test('GET /bookings/:id with invalid ID returns 404', async () => {
    const r = await api('GET', '/bookings/99999', null, true);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  let createdManualBookingId = null;

  await test('POST /bookings creates admin manual booking', async () => {
    const r = await api('POST', '/bookings', {
      customerName: 'Admin Manual',
      phone: '+8801555000222',
      email: 'manual@example.com',
      sport: 'Futsal',
      bookingDate: adminBookingDateStr,
      startTime: '15:00',
      endTime: '16:00',
      duration: 1,
      players: 6,
      notes: 'Manual booking test'
    }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    createdManualBookingId = r.data.booking?.id;
  });

  await test('PATCH /bookings/:id updates booking details', async () => {
    const r = await api('PATCH', `/bookings/${createdBookingId}`, {
      customerName: 'Updated Test User',
      phone: '+8801555999999'
    }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('PATCH /booking-status/:id changes status to Confirmed', async () => {
    const r = await api('PATCH', `/booking-status/${createdBookingId}`, { status: 'Confirmed' }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('PATCH /booking-status/:id with invalid status returns error', async () => {
    const r = await api('PATCH', `/booking-status/${createdBookingId}`, { status: 'InvalidStatus' }, true);
    assert(!r.ok, `Expected error, got ${r.status}`);
  });

  await test('DELETE /bookings/:id soft-deletes booking', async () => {
    const r = await api('DELETE', `/bookings/${createdBookingId}`, null, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    if (createdManualBookingId) {
      await api('DELETE', `/bookings/${createdManualBookingId}`, null, true);
    }
  });

  // Reviews
  await test('GET /reviews returns approved reviews', async () => {
    const r = await api('GET', '/reviews');
    assert(r.status === 200, `Status ${r.status}`);
    assert(Array.isArray(r.data.reviews), 'reviews not an array');
  });

  await test('POST /reviews submits a new review (pending)', async () => {
    const r = await api('POST', '/reviews', {
      customerName: 'Deep Tester',
      rating: 4,
      comment: 'Testing the review submission flow.'
    });
    assert(r.status === 201 || r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    createdReviewId = r.data.review?.id;
    assert(createdReviewId, 'No review ID returned');
  });

  await test('POST /reviews with missing rating returns error', async () => {
    const r = await api('POST', '/reviews', { customerName: 'No Rating' });
    assert(!r.ok, `Expected error, got ${r.status}`);
  });

  await test('GET /reviews/all (admin) includes pending reviews', async () => {
    const r = await api('GET', '/reviews/all', null, true);
    assert(r.status === 200, `Status ${r.status}`);
  });

  await test('PATCH /reviews/:id approves review', async () => {
    const r = await api('PATCH', `/reviews/${createdReviewId}`, { isApproved: true, isFeatured: true }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('DELETE /reviews/:id removes review', async () => {
    const r = await api('DELETE', `/reviews/${createdReviewId}`, null, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  // Contacts
  await test('POST /contact submits a contact message', async () => {
    const r = await api('POST', '/contact', {
      name: 'Deep Checker',
      email: `deepcheck_${Math.floor(Math.random() * 100000)}@example.com`,
      subject: 'API Verification',
      message: 'This is an automated deep check test message.'
    });
    assert(r.status === 201 || r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    createdMessageId = r.data.message?.id || r.data.contact?.id;
  });

  await test('POST /contact with missing fields returns error', async () => {
    const r = await api('POST', '/contact', { name: 'No Email' });
    assert(!r.ok, `Expected error, got ${r.status}`);
  });

  await test('GET /messages lists messages (admin)', async () => {
    const r = await api('GET', '/messages', null, true);
    assert(r.status === 200, `Status ${r.status}`);
  });

  await test('PATCH /messages/:id marks as read', async () => {
    const r = await api('PATCH', `/messages/${createdMessageId}`, { isRead: true }, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('DELETE /messages/:id removes message', async () => {
    const r = await api('DELETE', `/messages/${createdMessageId}`, null, true);
    assert(r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
  });

  // Gallery
  await test('GET /gallery returns gallery items', async () => {
    const r = await api('GET', '/gallery');
    assert(r.status === 200, `Status ${r.status}`);
  });

  // Protected route authorization
  const protectedRoutes = [
    ['GET', '/dashboard'],
    ['GET', '/bookings'],
    ['GET', '/slots'],
    ['GET', '/settings'],
    ['GET', '/reviews/all'],
    ['GET', '/messages'],
  ];

  for (const [method, path] of protectedRoutes) {
    await test(`${method} ${path} requires auth`, async () => {
      const r = await api(method, path);
      assert(r.status === 401, `Expected 401 for ${path}, got ${r.status}`);
    });
  }

  // Edge cases
  await test('Non-existent route returns 404', async () => {
    const r = await api('GET', '/nonexistent-route');
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('POST /booking with past date rejects reservation', async () => {
    const r = await api('POST', '/booking', {
      customerName: 'Past Date',
      phone: '+8801555000333',
      email: 'past@example.com',
      sport: 'Futsal',
      bookingDate: '2020-01-01',
      startTime: '10:00',
      endTime: '11:00',
      duration: 1,
      players: 5
    }, 'user');
    assert(!r.ok || r.status >= 400, `Expected rejection for past date, got ${r.status}`);
  });

  // Print Results
  console.log('\n' + '═'.repeat(60));
  console.log('DEEP CHECK RESULTS');
  console.log('═'.repeat(60));

  for (const r of results) {
    if (r.error) {
      console.log(`${r.status} ${r.name}`);
      console.log(`   └─ ${r.error}`);
    } else {
      console.log(`${r.status} ${r.name}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`TOTAL: ${results.length}  |  PASSED: ${passed}  |  FAILED: ${failed}`);
  console.log('═'.repeat(60));
}

run().catch(e => console.error('Fatal:', e));
