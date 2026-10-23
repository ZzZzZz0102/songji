import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function openDatabase(directory) {
  fs.mkdirSync(directory,{recursive:true});
  fs.mkdirSync(path.join(directory,'files'),{recursive:true});
  const db=new DatabaseSync(path.join(directory,'songgai.sqlite'));
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
      password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('visitor','merchant','admin')),
      active INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,user_id TEXT UNIQUE NOT NULL REFERENCES users(id),name TEXT NOT NULL,
      location TEXT NOT NULL,contact TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS offerings (
      id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id), point_id TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT NOT NULL, price_cents INTEGER NOT NULL,
      capacity INTEGER NOT NULL, slots TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),offering_id TEXT NOT NULL REFERENCES offerings(id),
      merchant_id TEXT NOT NULL REFERENCES merchants(id), date TEXT NOT NULL,slot TEXT NOT NULL,
      count INTEGER NOT NULL,total_cents INTEGER NOT NULL,status TEXT NOT NULL,
      note TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,expires TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,request_key TEXT NOT NULL,UNIQUE(user_id,request_key)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id),user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,
      mime TEXT NOT NULL,bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,path TEXT NOT NULL,created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES bookings(id),merchant_id TEXT NOT NULL REFERENCES merchants(id),
      kind TEXT NOT NULL CHECK(kind IN ('receipt','refund','payout','labor','cost')),
      cents INTEGER NOT NULL CHECK(cents>0),beneficiary TEXT NOT NULL,evidence_id TEXT NOT NULL REFERENCES files(id),
      reference TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',reviewer_id TEXT REFERENCES users(id),reviewed TEXT,review_note TEXT,
      UNIQUE(merchant_id,kind,reference)
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,point_id TEXT NOT NULL,title TEXT NOT NULL,kind TEXT NOT NULL,
      file_id TEXT REFERENCES files(id),archive TEXT,source TEXT NOT NULL,method TEXT NOT NULL,
      capture_date TEXT NOT NULL,accuracy TEXT NOT NULL,scale_m REAL,verified INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL REFERENCES users(id),created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,type TEXT NOT NULL,page TEXT,point_id TEXT,user_id TEXT REFERENCES users(id),
      created TEXT NOT NULL, UNIQUE(user_id,id)
    );
    CREATE TABLE IF NOT EXISTS task_progress (
      user_id TEXT NOT NULL REFERENCES users(id),point_id TEXT NOT NULL,answer TEXT NOT NULL,
      correct INTEGER NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(user_id,point_id)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,actor_id TEXT,action TEXT NOT NULL,object_id TEXT NOT NULL,
      detail TEXT NOT NULL,created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES bookings(id),status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,updated TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS bookings_merchant ON bookings(merchant_id,status,date);
    CREATE INDEX IF NOT EXISTS ledger_booking ON ledger(booking_id,status);
  `);
  return db;
}

export const id=()=>randomUUID();
export const now=()=>new Date().toISOString();
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result=fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function audit(db, actor, action, object, detail={}) {
  db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?)').run(id(),actor || null,action,object,JSON.stringify(detail),now());
}
