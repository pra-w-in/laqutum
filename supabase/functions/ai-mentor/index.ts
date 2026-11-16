import { admin, json, remote, required, serve } from '../_shared/http.ts';
import { systemInstruction } from '../_shared/mentor-prompt.ts';

serve(async (req, user) => {
  // Distributed per-user quota, enforced atomically in PostgreSQL.
  const allowed = await admin('rpc/consume_mentor_quota', { method: 'POST', body: JSON.stringify({ learner: user.id }) });
  if (!allowed) return json({ error: 'Daily mentor limit reached. Please try again tomorrow.' }, 429);
  const raw = await req.text();
  if (raw.length > 6000000) return json({ error: 'Please use a smaller image.' }, 413);
  const { query, image, history } = JSON.parse(raw);
  if (typeof query !== 'string' || query.length > 12000 || (!query.trim() && !image)) return json({ error: 'Enter a question.' }, 400);
  type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
  const parts: Part[] = [];
  if (image) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType) || typeof image.base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(image.base64)) return json({ error: 'Unsupported image.' }, 400);
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
  }
  parts.push({ text: query || 'Explain the question in this image using the LaquTum framework.' });
  const contents: { role: string; parts: Part[] }[] = (Array.isArray(history) ? history : []).slice(-6)
    .filter(m => m && typeof m.text === 'string' && ['user', 'model'].includes(m.role))
    .map(m => ({ role: m.role, parts: [{ text: m.text.slice(0, 12000) }] }));
  contents.push({ role: 'user', parts });
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest';
  const data = await remote(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': required('GEMINI_API_KEY') },
    body: JSON.stringify({ contents, system_instruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.2, topP: 0.95, maxOutputTokens: 2048 } }),
  });
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('\n');
  if (!text) throw new Error('Empty model response');
  return json({ text });
});
