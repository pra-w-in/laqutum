export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
export function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Service is not configured.');
  return value;
}
export async function remote(url: string, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error('Upstream service request failed.');
  return response.status === 204 ? null : response.json();
}
export async function userFor(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Please sign in.');
  const user = await remote(required('SUPABASE_URL') + '/auth/v1/user', {
    headers: { authorization, apikey: required('SUPABASE_ANON_KEY') },
  });
  if (!user.id) throw new Error('Please sign in.');
  return user;
}
export async function admin(path: string, options: RequestInit = {}) {
  return remote(required('SUPABASE_URL') + '/rest/v1/' + path, {
    ...options,
    headers: { apikey: required('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: 'Bearer ' + required('SUPABASE_SERVICE_ROLE_KEY'),
      'Content-Type': 'application/json', ...options.headers },
  });
}
export function serve(handler: (req: Request, user: { id: string }) => Promise<Response>) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      const user = await userFor(req);
      return await handler(req, user);
    } catch (e) {
      console.error('Request failed:', e instanceof Error ? e.message : 'Unknown error');
      return json({ error: 'Unable to complete this request. Please sign in and try again shortly.' }, 400);
    }
  });
}
