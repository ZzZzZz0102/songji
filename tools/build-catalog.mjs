import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
const guide = await fs.readFile(path.join(root, 'public/guide.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(app.slice(0, app.indexOf('const load =')), ctx);
vm.runInContext(guide.slice(0, guide.indexOf('let guideRouteId')), ctx);
const data = vm.runInContext('({sights,crafts,products,sources:SOURCES,routes:GUIDE_ROUTES})', ctx);
const bindings = {'4504':'luo','4496':'county','4498':'yuhuang','4493':'kuixing','4499':'craft-umbrella','4502':'craft-palm','4488':'oil','4505':'market','4487':'tea'};
const points = new Map();
for (const s of data.sights) points.set(s.id, { id:s.id, name:s.name, text:s.detail, tip:s.tip, image:`assets/${s.image}.webp`, source:s.source===null ? null : data.sources[s.source], verified:false });
for (const c of data.crafts) points.set(`craft-${c.id}`, { id:`craft-${c.id}`, name:c.name, text:c.desc, image:`assets/${c.image}.webp`, source:null, verified:false, productId:c.product, tip:'工坊、经营主体、营业时间与课程安排待核实。' });
for (const route of data.routes) for (const [name,text,qrId] of route.stops) {
  const id=bindings[qrId] || `qr-${qrId}`;
  if (!points.has(id)) points.set(id,{id,name,text,source:{title:'原二维码智慧导览',url:'https://tour.mapapp.cn/?appid=yeeabk287'},verified:false,tip:'现场开放与通行条件待核实。'});
  const p=points.get(id); p.qrId=qrId; p.routes=[...new Set([...(p.routes || []),route.id])];
}
const catalog={ generatedFrom:'existing-site', points:[...points.values()], routes:data.routes, products:data.products };
await fs.writeFile(path.join(root,'server/catalog.json'),JSON.stringify(catalog,null,2));
await fs.writeFile(path.join(root,'public/business-data.json'),JSON.stringify(catalog));
console.log(`Exported ${catalog.points.length} point records and ${catalog.routes.length} original routes.`);
