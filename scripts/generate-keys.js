#!/usr/bin/env node
/**
 * CIDS Suites Pro - License Key Generator
 * Janakan 500 unique license keys format: CIDS-XXXX-XXXX-XXXX
 * Output: SQL file untuk import ke Supabase
 * 
 * Cara guna: node scripts/generate-keys.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Karakter yang dibenarkan - buang 0, O, 1, I untuk elak keliru
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEY_PREFIX = 'CIDS';
const SEGMENT_LENGTH = 4;
const SEGMENTS = 3; // 3 segmen selepas prefix
const TOTAL_KEYS = 500;
const MAX_DEVICES = 2;

function generateSegment() {
    let segment = '';
    for (let i = 0; i < SEGMENT_LENGTH; i++) {
        const randomIndex = crypto.randomInt(0, CHARSET.length);
        segment += CHARSET[randomIndex];
    }
    return segment;
}

function generateKey(usedKeys) {
    let key;
    let attempts = 0;
    do {
        const segments = [];
        for (let i = 0; i < SEGMENTS; i++) {
            segments.push(generateSegment());
        }
        key = `${KEY_PREFIX}-${segments.join('-')}`;
        attempts++;
        if (attempts > 10000) throw new Error('Terlalu banyak percubaan - tukar CHARSET atau SEGMENTS');
    } while (usedKeys.has(key));
    
    return key;
}

// Generate 500 unique keys
console.log('🔑 Menjana 500 license keys...');
const usedKeys = new Set();
const keys = [];

for (let i = 0; i < TOTAL_KEYS; i++) {
    const key = generateKey(usedKeys);
    usedKeys.add(key);
    keys.push(key);
    
    if ((i + 1) % 100 === 0) {
        console.log(`  ${i + 1}/${TOTAL_KEYS} keys dijana...`);
    }
}

console.log(`✅ ${keys.length} unique keys berjaya dijana!\n`);

// =====================
// Output 1: SQL file untuk Supabase
// =====================
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// SQL Schema + Seed
const sqlContent = `-- ============================================
-- CIDS Suites Pro - License Database Schema
-- Generated: ${new Date().toISOString()}
-- ============================================

-- Buat jadual license_keys
CREATE TABLE IF NOT EXISTS license_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key          TEXT UNIQUE NOT NULL,
    max_devices  INT NOT NULL DEFAULT ${MAX_DEVICES},
    is_active    BOOLEAN NOT NULL DEFAULT true,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Buat jadual license_devices
CREATE TABLE IF NOT EXISTS license_devices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key          TEXT NOT NULL REFERENCES license_keys(key) ON DELETE CASCADE,
    machine_id   TEXT NOT NULL,
    device_name  TEXT,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(key, machine_id)
);

-- Index untuk carian cepat
CREATE INDEX IF NOT EXISTS idx_license_devices_key ON license_devices(key);
CREATE INDEX IF NOT EXISTS idx_license_devices_machine_id ON license_devices(machine_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_active ON license_keys(is_active);

-- Row Level Security (RLS) - API guna service role key jadi disable RLS
-- Tapi tetap setup untuk keselamatan
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_devices ENABLE ROW LEVEL SECURITY;

-- Policy: Hanya service role boleh baca/tulis (API backend kita)
-- (Service role key bypass RLS secara automatik)

-- ============================================
-- INSERT 500 LICENSE KEYS
-- ============================================
INSERT INTO license_keys (key, max_devices, is_active) VALUES
${keys.map((key, index) => `  ('${key}', ${MAX_DEVICES}, true)${index < keys.length - 1 ? ',' : ';'}`).join('\n')}

-- ============================================
-- Semak: Kira jumlah keys
-- ============================================
SELECT COUNT(*) as total_keys FROM license_keys;
SELECT COUNT(*) as active_keys FROM license_keys WHERE is_active = true;
`;

const sqlFile = path.join(__dirname, '..', `license_keys_${timestamp}.sql`);
fs.writeFileSync(sqlFile, sqlContent, 'utf8');
console.log(`📄 SQL file: ${sqlFile}`);

// =====================
// Output 2: JSON backup semua keys
// =====================
const jsonOutput = {
    generated: new Date().toISOString(),
    totalKeys: keys.length,
    maxDevicesPerKey: MAX_DEVICES,
    keyFormat: `${KEY_PREFIX}-XXXX-XXXX-XXXX`,
    keys: keys
};

const jsonFile = path.join(__dirname, '..', `license_keys_${timestamp}.json`);
fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2), 'utf8');
console.log(`📋 JSON backup: ${jsonFile}`);

// =====================
// Output 3: CSV untuk pengedaran
// =====================
const csvContent = `Key,MaxDevices,Status,Notes\n${keys.map(k => `${k},${MAX_DEVICES},Active,`).join('\n')}`;
const csvFile = path.join(__dirname, '..', `license_keys_${timestamp}.csv`);
fs.writeFileSync(csvFile, csvContent, 'utf8');
console.log(`📊 CSV file: ${csvFile}`);

console.log('\n🎉 Selesai! Output files:');
console.log(`   SQL  → ${path.basename(sqlFile)}`);
console.log(`   JSON → ${path.basename(jsonFile)}`);
console.log(`   CSV  → ${path.basename(csvFile)}`);
console.log('\n📌 Langkah seterusnya:');
console.log('   1. Buka Supabase Dashboard > SQL Editor');
console.log('   2. Copy-paste kandungan SQL file dan Execute');
console.log('   3. Semak Table Editor untuk confirm 500 keys di-insert');
console.log('\n💾 Simpan JSON dan CSV sebagai backup - JANGAN kongsi dengan orang lain!');
