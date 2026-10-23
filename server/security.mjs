import { scrypt,randomBytes,createHash,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export async function hashPassword(password) {
  const salt=randomBytes(16).toString('hex');
  const hash=await derive(password,salt,64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function checkPassword(password,encoded) {
  const [salt,stored]=encoded.split(':');
  const value=await derive(password,salt,64), original=Buffer.from(stored,'hex');
  return value.length===original.length && timingSafeEqual(value,original);
}
export function error(status,message) { return Object.assign(new Error(message),{status}); }
export function text(value,max=300,min=0) {
  if (typeof value!=='string' || value.trim().length<min || value.trim().length>max) throw error(400,'文字字段为空或长度不正确');
  return value.trim();
}
export function integer(value,min,max) {
  if (!Number.isSafeInteger(value) || value<min || value>max) throw error(400,'数字字段超出允许范围');
  return value;
}
export function passwordValue(value) {
  if(typeof value!=='string' || value.length<12 || value.length>128)throw error(400,'密码需为12至128个字符');
  return value;
}
export function usernameValue(value) {
  if(typeof value!=='string' || !/^[a-zA-Z0-9_-]{3,40}$/.test(value))throw error(400,'账号需为3至40位字母、数字、下划线或短横线');
  return value.toLowerCase();
}
export function rateLimit(db,key,max,ms) {
  const time=Date.now(), row=db.prepare('SELECT * FROM limits WHERE key=?').get(key);
  if(row && row.until>time && row.count>=max)throw error(429,'操作过于频繁，请稍后重试');
  if(!row || row.until<=time)db.prepare('INSERT OR REPLACE INTO limits VALUES (?,?,?)').run(key,1,time+ms);
  else db.prepare('UPDATE limits SET count=count+1 WHERE key=?').run(key);
  if(Math.random()<.01)db.prepare('DELETE FROM limits WHERE until<?').run(time);
}
