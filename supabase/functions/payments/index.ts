import { admin, json, remote, required, serve } from '../_shared/http.ts';

const AMOUNT = 149900;
async function razor(path: string, options: RequestInit = {}) {
  return remote('https://api.razorpay.com/v1/' + path, {
    ...options, headers: { 'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(required('RAZORPAY_KEY_ID') + ':' + required('RAZORPAY_KEY_SECRET')) },
  });
}
serve(async (req, user) => {
  const body = await req.json();
  if (body.action === 'create') {
    const order = await razor('orders', { method: 'POST', body: JSON.stringify({ amount: AMOUNT, currency: 'INR',
      receipt: crypto.randomUUID(), notes: { user_id: user.id, product: 'placement_pass_6months' } }) });
    await admin('payment_orders', { method: 'POST', body: JSON.stringify({ id: order.id, user_id: user.id, amount: AMOUNT }) });
    return json({ orderId: order.id, key: required('RAZORPAY_KEY_ID'), amount: AMOUNT, currency: 'INR' });
  }
  if (body.action !== 'verify') return json({ error: 'Invalid action' }, 400);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  if (!/^order_[a-zA-Z0-9]+$/.test(orderId || '') || !/^pay_[a-zA-Z0-9]+$/.test(paymentId || '') || !/^[a-f0-9]{64}$/i.test(signature || '')) throw new Error('Invalid payment');
  const orders = await admin(`payment_orders?id=eq.${orderId}&user_id=eq.${user.id}&select=*`);
  if (orders.length !== 1) throw new Error('Order does not belong to this user');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(required('RAZORPAY_KEY_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signatureBytes = Uint8Array.from(signature.match(/../g), (x: string) => parseInt(x, 16));
  if (!await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(orderId + '|' + paymentId))) throw new Error('Invalid signature');
  const payment = await razor('payments/' + paymentId);
  if (payment.order_id !== orderId || payment.status !== 'captured' || payment.amount !== AMOUNT || payment.currency !== 'INR' || payment.amount_refunded > 0) throw new Error('Payment is not captured');
  // Atomic and idempotent: a repeated callback never extends the expiry.
  await admin('rpc/fulfill_placement_pass', { method: 'POST', body: JSON.stringify({ order_ref: orderId, payment_ref: paymentId, learner: user.id }) });
  return json({ verified: true });
});
