const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

let PGlite;
try {
  ({ PGlite } = require(process.env.FEEDBACK_PGLITE_PATH || '../work/feedback-db-check/node_modules/@electric-sql/pglite'));
} catch {
  // The PostgreSQL verification dependency is isolated from the application.
}

test('private inbox SQL enforces visitor, ordinary-user and admin permissions in PostgreSQL', { skip: !PGlite && 'Install isolated PGlite as documented in docs/visitor-feedback-setup.md' }, async () => {
  const db = new PGlite();
  const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ordinary = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
      INSERT INTO auth.users VALUES ('${admin}'), ('${ordinary}');
    `);
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261012112043_private_visitor_feedback.sql'), 'utf8');
    await db.exec(migration);
    await db.query('INSERT INTO public.feedback_admins (user_id) VALUES ($1)', [admin]);

    async function asRole(role, uid, action) {
      await db.exec(`SET ROLE ${role}`);
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [uid || '']);
      try { return await action(); }
      finally {
        await db.exec('RESET ROLE');
        await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
      }
    }
    const denied = action => assert.rejects(action, error => error.code === '42501');
    await asRole('anon', null, async () => {
      await db.query("INSERT INTO public.visitor_feedback (name,phone,message) VALUES ('زائر تجريبي','+201012345678','تعليق تجريبي للخصوصية')");
      await denied(() => db.query('SELECT * FROM public.visitor_feedback'));
      await denied(() => db.query("UPDATE public.visitor_feedback SET status = 'reviewed'"));
      await denied(() => db.query('DELETE FROM public.visitor_feedback'));
      await denied(() => db.query('SELECT * FROM public.feedback_admins'));
      await denied(() => db.query("INSERT INTO public.visitor_feedback (name,phone,message,status) VALUES ('زائر تجريبي','123456789','تعليق تجريبي','reviewed')"));
      await assert.rejects(() => db.query("INSERT INTO public.visitor_feedback (name,phone,message) VALUES ('زائر تجريبي','invalid','تعليق تجريبي')"), error => error.code === '23514');
      await assert.rejects(() => db.query("INSERT INTO public.visitor_feedback (name,phone,message) VALUES ('زائر تجريبي','123456789','')"), error => error.code === '23514');
    });

    const messageId = (await db.query('SELECT id FROM public.visitor_feedback')).rows[0].id;
    await asRole('authenticated', ordinary, async () => {
      await db.query("INSERT INTO public.visitor_feedback (name,phone,message) VALUES ('زائر آخر','123456789','رسالة ثانية تجريبية')");
      assert.deepEqual((await db.query('SELECT * FROM public.visitor_feedback')).rows, []);
      assert.deepEqual((await db.query('SELECT * FROM public.feedback_admins')).rows, []);
      assert.deepEqual((await db.query("UPDATE public.visitor_feedback SET status = 'reviewed' RETURNING id")).rows, []);
      await denied(() => db.query('INSERT INTO public.feedback_admins (user_id) VALUES ($1)', [ordinary]));
      await denied(() => db.query('DELETE FROM public.visitor_feedback'));
    });

    await asRole('authenticated', admin, async () => {
      assert.equal((await db.query('SELECT * FROM public.visitor_feedback')).rows.length, 2);
      assert.deepEqual((await db.query('SELECT user_id FROM public.feedback_admins')).rows, [{ user_id: admin }]);
      assert.deepEqual((await db.query("UPDATE public.visitor_feedback SET status = 'reviewed' WHERE id = $1 RETURNING status", [messageId])).rows, [{ status: 'reviewed' }]);
      await denied(() => db.query("UPDATE public.visitor_feedback SET phone = '123456789'"));
      await denied(() => db.query('INSERT INTO public.feedback_admins (user_id) VALUES ($1)', [ordinary]));
      await denied(() => db.query('DELETE FROM public.visitor_feedback'));
    });

    // Removing membership revokes access even while the same Auth token is valid.
    await db.query('DELETE FROM public.feedback_admins WHERE user_id = $1', [admin]);
    await asRole('authenticated', admin, async () => {
      assert.deepEqual((await db.query('SELECT * FROM public.visitor_feedback')).rows, []);
      assert.deepEqual((await db.query("UPDATE public.visitor_feedback SET status = 'reviewed' RETURNING id")).rows, []);
    });
  } finally { await db.close(); }
});
