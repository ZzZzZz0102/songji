import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase,id,now,audit } from '../server/database.mjs';
import { hashPassword,passwordValue,usernameValue } from '../server/security.mjs';
import { createInterface } from 'node:readline/promises';
import fs from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(fs.existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const rl=createInterface({input:process.stdin,output:process.stdout});
try {
  const username=usernameValue(process.env.ADMIN_USER || await rl.question('Admin username: '));
  if(!process.env.ADMIN_PASSWORD)throw new Error('Set ADMIN_PASSWORD in this terminal environment (minimum 12 characters). It is never written to a file.');
  const password=await hashPassword(passwordValue(process.env.ADMIN_PASSWORD));
  const db=openDatabase(path.resolve(root,process.env.DATA_DIR || 'data'));
  const uid=id();
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(uid,username,'平台管理员',password,'admin',1,now());
  audit(db,uid,'admin.created',uid); db.close();
  console.log(`Administrator ${username} created. No default merchant accounts were created.`);
} finally { rl.close(); }
