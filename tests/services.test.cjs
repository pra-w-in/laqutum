const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test('payment service verifies ownership, signatures, captured amount and rejects unauthenticated requests', async () => {
 const originalFetch = global.fetch;
 let handler; let fulfilled = 0; let amount = 149900; let owner = true; let status = 'captured';
 const secrets = { SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'public-test', SUPABASE_SERVICE_ROLE_KEY: 'server-test', RAZORPAY_KEY_ID: 'rzp_test_example', RAZORPAY_KEY_SECRET: 'test-secret' };
 global.Deno = { env: { get: k => secrets[k] }, serve: fn => { handler = fn; } };
 global.fetch = async (url, opts) => {
  if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'learner-1' });
  if (url.includes('/payment_orders?')) return Response.json(owner ? [{ id: 'order_123' }] : []);
  if (url.endsWith('/payments/pay_123')) return Response.json({ order_id: 'order_123', status, amount, currency: 'INR', amount_refunded: 0 });
  if (url.endsWith('/rpc/fulfill_placement_pass')) { fulfilled++; return Response.json(null); }
  if (url.endsWith('/orders')) {
   const body = JSON.parse(opts.body); assert.equal(body.amount, 149900); assert.equal(body.notes.user_id, 'learner-1');
   return Response.json({ id: 'order_123' });
  }
  if (url.endsWith('/payment_orders')) return Response.json(null);
  throw new Error('Unexpected URL: ' + url);
 };
 try {
  await import(pathToFileURL(path.resolve(__dirname, '../supabase/functions/payments/index.ts')).href);
  const payload = { action: 'verify', razorpay_order_id: 'order_123', razorpay_payment_id: 'pay_123', razorpay_signature: createHmac('sha256', 'test-secret').update('order_123|pay_123').digest('hex') };
  const request = (body = payload, auth = true) => new Request('https://app.test/payments', { method: 'POST', headers: auth ? { Authorization: 'Bearer test' } : {}, body: JSON.stringify(body) });
  assert.equal((await handler(request(payload, false))).status, 400);
  assert.equal((await handler(request({ ...payload, razorpay_signature: '0'.repeat(64) }))).status, 400);
  owner = false; assert.equal((await handler(request())).status, 400); owner = true;
  amount = 1; assert.equal((await handler(request())).status, 400); amount = 149900;
  status = 'authorized'; assert.equal((await handler(request())).status, 400); status = 'captured';
  assert.equal(fulfilled, 0);
  assert.equal((await handler(request())).status, 200); assert.equal(fulfilled, 1);
  const order = await (await handler(request({ action: 'create', amount: 1 }))).json();
  assert.equal(order.amount, 149900);
 } finally { global.fetch = originalFetch; delete global.Deno; }
});

test('mentor keeps the framework server-side and rejects invalid input and exhausted quotas', async () => {
 const originalFetch = global.fetch; let handler; let allowed = true; let modelCalls = 0;
 const secrets = { SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'public-test', SUPABASE_SERVICE_ROLE_KEY: 'server-test', GEMINI_API_KEY: 'server-only-key' };
 global.Deno = { env: { get: k => secrets[k] }, serve: fn => { handler = fn; } };
 global.fetch = async (url, opts) => {
  if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'learner-1' });
  if (url.endsWith('/rpc/consume_mentor_quota')) return Response.json(allowed);
  if (url.includes('generativelanguage.googleapis.com')) {
   modelCalls++; assert.equal(opts.headers['x-goog-api-key'], 'server-only-key');
   assert.match(JSON.parse(opts.body).system_instruction.parts[0].text, /LaquTum/);
   return Response.json({ candidates: [{ content: { parts: [{ text: 'A worked explanation.' }] } }] });
  }
  throw new Error('Unexpected URL');
 };
 try {
  await import(pathToFileURL(path.resolve(__dirname, '../supabase/functions/ai-mentor/index.ts')).href);
  const req = body => new Request('https://app.test/ai', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body) });
  assert.equal((await handler(req({ query: '' }))).status, 400);
  assert.equal((await handler(req({ query: 'Explain', image: { mimeType: 'text/html', base64: 'abc' } }))).status, 400);
  allowed = false; assert.equal((await handler(req({ query: 'Explain percentages' }))).status, 429);
  assert.equal(modelCalls, 0);
  allowed = true; const response = await handler(req({ query: 'Explain percentages', history: [] }));
  assert.equal((await response.json()).text, 'A worked explanation.'); assert.equal(modelCalls, 1);
 } finally { global.fetch = originalFetch; delete global.Deno; }
});
