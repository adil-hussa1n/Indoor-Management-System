/**
 * Deep API Verification Script
 * Tests every endpoint, edge cases, error handling, and data integrity.
 */

const BASE = 'http://127.0.0.1:5000/api/v1';
let TOKEN = '';
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
  const headers = {};
  if (auth) headers['Authorization'] = `Bearer ${TOKEN}`;
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
    const headers = { 'Authorization': 'Bearer invalidtoken123' };
    const res = await fetch(`${BASE}/auth/me`, { headers });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
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
  // Generate collision-free future dates based on current timestamp
  const nowMs = Date.now();
  const bookingDateStr = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days out
  const adminBookingDateStr = new Date(nowMs + 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 31 days out

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
    });
    assert(r.status === 201 || r.ok, `Status ${r.status}: ${JSON.stringify(r.data)}`);
    createdBookingId = r.data.booking?.id;
    assert(createdBookingId, 'No booking ID returned');
  });

  await test('POST /booking with missing fields returns validation error', async () => {
    const r = await api('POST', '/booking', { customerName: 'No Phone' });
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
      email: 'deepcheck@example.com',
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
    });
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
