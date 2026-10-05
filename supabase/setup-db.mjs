#!/usr/bin/env node
/**
 * TokenTrim - Supabase Connection & Schema Diagnostic Script
 * Validates SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from admin/.env.local
 * and verifies that required Postgres tables exist.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const envPath = resolve(__dirname, '../admin/.env.local');

// Load environment variables from admin/.env.local if present
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- TokenTrim Supabase Diagnostic ---');

if (!supabaseUrl || !serviceKey) {
  console.log('⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  console.log('   Create or update admin/.env.local with:');
  console.log('   SUPABASE_URL=https://your-project.supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key');
  console.log('\nCurrently running in DEMO mode (local JSON store).');
  process.exit(0);
}

console.log(`Connecting to: ${supabaseUrl}`);

try {
  let createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch {
    const adminSupabase = resolve(__dirname, '../admin/node_modules/@supabase/supabase-js/dist/index.mjs');
    if (existsSync(adminSupabase)) {
      ({ createClient } = await import(`file://${adminSupabase.replace(/\\/g, '/')}`));
    } else {
      throw new Error("Could not find '@supabase/supabase-js'. Run 'npm run admin:install' first.");
    }
  }
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  const tables = ['profiles', 'sessions', 'analytics_events', 'user_documents'];
  let allGood = true;

  for (const table of tables) {
    const { data, error } = await sb.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table 'public.${table}': ${error.message}`);
      allGood = false;
    } else {
      console.log(`✅ Table 'public.${table}': OK`);
    }
  }

  if (!allGood) {
    console.log('\n⚠️  Some tables are missing. Apply the SQL migrations in Supabase SQL Editor:');
    console.log('   1. supabase/migrations/0001_schema.sql');
    console.log('   2. supabase/migrations/0002_documents.sql');
    process.exit(1);
  } else {
    console.log('\n🎉 Supabase connection and all tables verified successfully!');

    // Check optional security & audit columns (migration 0004)
    const { error: secColErr } = await sb.from('sessions').select('device, ip, revoked_at').limit(1);
    if (secColErr) {
      console.log('ℹ️  Security & Audit columns (migration 0004) not yet applied (optional).');
      console.log('   The app runs in full compatibility mode with the base schema.');
      console.log('   To enable per-device session tracking & audit logs in Supabase Postgres, run:');
      console.log('   supabase/migrations/0004_user_monitoring_security.sql in your Supabase SQL Editor.\n');
    } else {
      console.log('🛡️  Security & Audit columns (migration 0004): OK');
    }

    if (process.env.SEED_ADMIN !== 'false') {
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@tokentrim.local').trim().toLowerCase();
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminPin = process.env.ADMIN_PIN || '1234';

      // Remove default demo admin if configured email has changed
      if (adminEmail !== 'admin@tokentrim.local') {
        const { error: delErr } = await sb.from('profiles').delete().eq('email', 'admin@tokentrim.local');
        if (!delErr) {
          console.log('🗑️  Removed old demo admin: admin@tokentrim.local');
        }
      }

      const { scryptSync, randomBytes, randomUUID } = await import('node:crypto');
      const salt1 = randomBytes(16).toString('hex');
      const passHash = `${salt1}:${scryptSync(adminPassword, salt1, 64).toString('hex')}`;
      const salt2 = randomBytes(16).toString('hex');
      const pinHash = `${salt2}:${scryptSync(adminPin, salt2, 64).toString('hex')}`;

      const { data: existingUser, error: findErr } = await sb
        .from('profiles')
        .select('id, email, is_admin')
        .eq('email', adminEmail)
        .maybeSingle();

      if (findErr) {
        console.log(`⚠️  Could not check admin user status: ${findErr.message}`);
      } else if (!existingUser) {
        const now = new Date().toISOString();
        const { error: insertErr } = await sb.from('profiles').insert({
          id: randomUUID(),
          email: adminEmail,
          name: 'Creator',
          plan: 'pro',
          is_admin: true,
          created_at: now,
          last_login_at: now,
          password_hash: passHash,
          pin_hash: pinHash
        });

        if (insertErr) {
          console.log(`⚠️  Could not auto-seed admin: ${insertErr.message}`);
        } else {
          console.log(`👤 Admin user created: ${adminEmail} (password: ${adminPassword}, pin: ${adminPin})`);
        }
      } else {
        // Update credentials and ensure admin role
        const { error: updateErr } = await sb.from('profiles').update({
          password_hash: passHash,
          pin_hash: pinHash,
          is_admin: true,
          plan: 'pro'
        }).eq('id', existingUser.id);

        if (updateErr) {
          console.log(`⚠️  Could not update admin credentials: ${updateErr.message}`);
        } else {
          console.log(`👤 Admin user updated: ${adminEmail} (password: ${adminPassword}, pin: ${adminPin})`);
        }
      }
    }
    process.exit(0);
  }
} catch (err) {
  console.error('❌ Connection error:', err.message);
  process.exit(1);
}
