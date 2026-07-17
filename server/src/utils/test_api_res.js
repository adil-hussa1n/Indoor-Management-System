async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/v1/available-slots?date=2026-07-17');
    const json = await res.json();
    console.log('API Response slots count:', json.slots?.length);
    if (json.slots?.length) {
      console.log('Sample night slot from API:', json.slots.find(s => s.rateType === 'night'));
    }
  } catch (err) {
    console.error('Error fetching API:', err.message);
  }
}

test();
