// Isolated test harness only. Never imported by server.js or deployed as an API.
const fs = require("node:fs");
const crypto = require("node:crypto");
const { hashToken } = require("../../tokens");
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  OUTSIDER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
async function start(pool) {
  const tables = await pool.query(
    "select tablename from pg_tables where schemaname='public'",
  );
  if (tables.rows.length) throw Error("Fixture database must be empty.");
  await pool.query(
    "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key)",
  );
  await pool.query(fs.readFileSync("supabase/schema.sql", "utf8"));
  for (const file of fs.readdirSync("supabase/migrations").sort())
    await pool.query(fs.readFileSync("supabase/migrations/" + file, "utf8"));
  for (const [id, name, email, role, token] of [
    [
      ADMIN,
      "Fixture Administrator",
      "admin@fixture.test",
      "super_admin",
      "fixture-admin-session",
    ],
    [
      USER,
      "Fixture Developer",
      "developer@fixture.test",
      "user",
      "fixture-developer-session",
    ],
    [
      OUTSIDER,
      "Fixture Outsider",
      "outsider@fixture.test",
      "user",
      "fixture-outsider-session",
    ],
  ]) {
    await pool.query("insert into auth.users(id) values($1)", [id]);
    await pool.query(
      "insert into profiles(id,full_name,email,platform_role) values($1,$2,$3,$4)",
      [id, name, email, role],
    );
    await pool.query(
      "insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '2 hours')",
      [hashToken(token), id],
    );
  }
  await pool.query(
    "insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '2 hours')",
    [hashToken("fixture-admin-second-session"), ADMIN],
  );
  for(const [suffix,label] of [['1','desktop'],['2','mobile']]){
   const id='c0c0c0c0-1111-4111-8111-11111111111'+suffix;
   await pool.query('insert into auth.users values($1)',[id]);await pool.query("insert into profiles(id,full_name,email) values($1,$2,$3)",[id,'Profile '+label,'profile-'+label+'@fixture.test']);
   await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '2 hours')",[hashToken('fixture-profile-'+label),id]);
  }
  await require("./hrms-fixture")(pool,ADMIN);
  require("./github-fixture")();
  await require('./organization-fixture')(pool);
  await require('./finance-journal-fixture')(pool,ADMIN);
  const mfaId='ffffffff-3333-4333-8333-333333333333';
  await pool.query('insert into auth.users values($1)',[mfaId]);
  await pool.query("insert into profiles(id,full_name,email) values($1,'MFA fixture','mfa@fixture.test')",[mfaId]);
  for(const [suffix,layout] of [['1','desktop'],['2','mobile']]){
   const id='fafafafa-1111-4111-8111-11111111111'+suffix;
   await pool.query('insert into auth.users values($1)',[id]);await pool.query("insert into profiles(id,full_name,email) values($1,'Consent fixture',$2)",[id,'link-'+layout+'@fixture.test']);
   await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '2 hours')",[hashToken('fixture-link-'+layout),id]);
  }
  const identity=require('../fixtures/identity-provider')(async email=>(await pool.query('select id,email from profiles where email=$1',[email])).rows[0],{mfaEmails:['mfa@fixture.test','customer-owner@fixture.test','link-desktop@fixture.test','link-mobile@fixture.test']});
  const app = require("../database/http-fixture")(pool,undefined,identity);
  const server = app.listen(Number(process.env.PORT || 3100), "127.0.0.1");
  return { server, pool };
}
if (require.main === module) {
  const url = new URL(
    process.env.TEST_DATABASE_URL || "http://missing.invalid",
  );
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/vsph_test"
  )
    throw Error("Only isolated loopback vsph_test is allowed.");
  const { Pool } = require("pg");
  start(new Pool({ connectionString: url.toString() })).catch(() => {
    console.error("Isolated browser fixture boot failed");
    process.exitCode = 1;
  });
}
module.exports = { start };
