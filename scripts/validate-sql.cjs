// Optional PostgreSQL checks: node scripts/validate-sql.cjs <path-to-pglite-package>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
(async () => {
 for (const topicType of ['jsonb', 'text[]']) {
  const db = new PGlite();
  await db.exec(`
   create role anon; create role authenticated; create role service_role bypassrls; create role supabase_admin;
   create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
   grant usage on schema auth to authenticated, anon, service_role;
   create table public.user_progress(user_id uuid primary key references auth.users(id), unlocked_topics ${topicType}, xp integer default 0);
   grant select,insert,update,delete on public.user_progress to authenticated;
   insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
  `);
  await db.exec(fs.readFileSync('supabase/migrations/202610170001_secure_services.sql', 'utf8'));
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); select set_config('request.jwt.claim.role','authenticated',false);`);
  const topics = value => topicType === 'jsonb' ? `'${JSON.stringify(value)}'::jsonb` : `array[${value.map(x => `'${x}'`).join(',')}]::text[]`;
  await db.exec(`insert into user_progress(user_id,unlocked_topics) values (auth.uid(), ${topics(['percentages'])});`);
  await db.exec(`update user_progress set unlocked_topics = ${topics(['percentages','ratio'])} where user_id=auth.uid();`);
  await assert.rejects(db.exec(`update user_progress set unlocked_topics = ${topics(['*'])};`));
  await assert.rejects(db.exec(`update user_progress set unlocked_topics = ${topics(['percentages','ratio','trains'])};`));
  await assert.rejects(db.exec(`update user_progress set is_admin = true;`));
  await assert.rejects(db.exec(`insert into user_progress(user_id) values ('00000000-0000-0000-0000-000000000002');`));
  await assert.rejects(db.exec(`select fulfill_placement_pass('order_test','pay_test',auth.uid());`));
  await db.exec(`reset role; insert into payment_orders(id,user_id,amount) values ('order_test','00000000-0000-0000-0000-000000000001',149900);`);
  await db.exec(`select fulfill_placement_pass('order_test','pay_test','00000000-0000-0000-0000-000000000001');`);
  const before = await db.query('select expires_at::text from placement_passes');
  await db.exec(`select fulfill_placement_pass('order_test','pay_test','00000000-0000-0000-0000-000000000001');`);
  assert.deepEqual((await db.query('select expires_at::text from placement_passes')).rows, before.rows);
  for (let i = 0; i < 100; i++) assert.equal((await db.query(`select consume_mentor_quota('00000000-0000-0000-0000-000000000001') as allowed`)).rows[0].allowed, true);
  assert.equal((await db.query(`select consume_mentor_quota('00000000-0000-0000-0000-000000000001') as allowed`)).rows[0].allowed, false);
  await db.close();
  console.log(`SQL checks passed (${topicType} topics): owner isolation, privilege protection, two free topics, payment idempotency, quota.`);
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
