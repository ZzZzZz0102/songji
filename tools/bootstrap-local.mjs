import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase,id,now,audit } from '../server/database.mjs';
import { hashPassword } from '../server/security.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const directory=path.resolve(root,process.env.DATA_DIR || 'data');
const db=openDatabase(directory);
if(!db.prepare("SELECT id FROM users WHERE role='admin'").get()) {
  const username='songgai_admin',password=randomBytes(18).toString('base64url'),uid=id();
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(uid,username,'平台管理员',await hashPassword(password),'admin',1,now());
  audit(db,uid,'admin.created',uid);
  await fs.writeFile(path.join(directory,'initial-admin.txt'),`Local administrator\nUsername: ${username}\nPassword: ${password}\nThis file is outside the public website. Keep it private.\n`,{flag:'wx'});
  console.log(`Local administrator created. Credentials: ${path.join(directory,'initial-admin.txt')}`);
} else console.log('Administrator already exists; credentials unchanged.');
db.close();
