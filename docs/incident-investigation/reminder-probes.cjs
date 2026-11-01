// Offline investigation probes. No real database, environment loading, logger, or network.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'server/node_modules/typescript'));
const cache = new Map();
const sent = [], flows = [], delays = [], audits = [];
let failAudit = false, failQuery = false, networkFailures = 0, responseData = { messageId: 'mock-id' };
const prisma = { auditLog: {
  create: async ({data}) => { if(failAudit) throw new Error('mock audit failure'); audits.push(data); return {id:'mock-audit'}; },
  findFirst: async () => { if(failQuery) throw new Error('mock query failure'); return null; }
}};
const axios = { post: async (url, payload) => {
  if(url.includes('send_flow')) flows.push(payload); else sent.push(payload);
  if(networkFailures-- > 0) throw Object.assign(new Error('mock timeout after possible acceptance'),{code:'ECONNABORTED'});
  return {data:responseData};
}};
const logger = {info(){},warn(){},error(){}};
function load(file) {
  file = path.resolve(file); if(cache.has(file)) return cache.get(file).exports;
  const module = {exports:{}}; cache.set(file,module);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2016,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const safeRequire = spec => {
    if(spec === 'axios') return axios;
    if(spec === 'decimal.js') return require(path.join(root,'server/node_modules/decimal.js'));
    if(!spec.startsWith('.')) throw new Error('Unexpected dependency: '+spec);
    let target = path.resolve(path.dirname(file),spec)+'.ts';
    if(target.endsWith('/config/prisma.ts')) return {__esModule:true,default:prisma};
    if(target.endsWith('/utils/logger.ts')) return {__esModule:true,default:logger};
    return load(target);
  };
  vm.runInNewContext(code,{require:safeRequire,module,exports:module.exports,process:{env:{}},console,setTimeout:(fn,ms)=>{delays.push(ms);fn();}}, {filename:file});
  return module.exports;
}
const base = path.join(root,'server/src/modules/messaging');
(async()=>{
 const {TemplateService} = load(base+'/application/template.service.ts');
 const {NotificationRepository} = load(base+'/infrastructure/repositories/notification.repository.ts');
 const {NotificationService} = load(base+'/application/notification.service.ts');
 const {CooldownPolicy} = load(base+'/policies/cooldown.policy.ts');
 const {MbgWhatsAppProvider} = load(base+'/infrastructure/providers/mbg-whatsapp.provider.ts');
 const options={phone:'9999999999',templateName:'payment_due_reminder',variables:['Offline probe','All Dues (9 Bills)','₹3807.20','Immediate'],actorId:'STORE_mock'};
 const r1=await TemplateService.getInstance().sendCustomTemplate(options);
 const r2=await TemplateService.getInstance().sendCustomTemplate(options);
 assert(r1.success && r2.success); assert.equal(sent.length,2); assert.equal(sent[0].variables.body[1],'All Dues (9 Bills)'); assert.equal(audits[0].action,'NOTIFICATION_DISPATCH'); assert.equal(audits[0].entityType,'SYSTEM');
 console.log('PASS: two sequential custom reminders preserve supplied 9-bill / ₹3807.20 variables and both submit; audits are SYSTEM/NOTIFICATION_DISPATCH.');
 failAudit=true;
 const r3=await TemplateService.getInstance().sendCustomTemplate(options);
 assert(r3.success); assert.equal(sent.length,3); assert.equal(audits.length,2);
 console.log('PASS: successful provider submission is returned despite failed dispatch audit.');
 failAudit=false;
 const prior=audits.length;
 await NotificationService.getInstance().sendChatHubFlow('9999999999','offline-flow','Offline probe',{amount:'3807.20'},'mock-actor');
 assert.equal(flows.length,1); assert.equal(audits.length,prior);
 console.log('PASS: flow submits supplied custom fields without a dispatch audit. No external flow definition is simulated.');
 failQuery=true; assert.equal((await CooldownPolicy.checkCustomerReminderCooldown('mock-customer')).allowed,true);
 console.log('PASS: standalone CooldownPolicy allows send after query error (not the canonical claim path).');
 networkFailures=2; const n=sent.length; await new MbgWhatsAppProvider().sendTemplate({recipientPhone:'9999999999',templateName:'payment_due_reminder',variables:{body:options.variables}});
 assert.equal(sent.length-n,3); assert.deepEqual(delays,[1000,2000]);
 console.log('PASS: ambiguous timeouts trigger three POST attempts with 1s and 2s backoff, without provider idempotency key.');
 responseData={success:false,message:'mock business rejection'};
 const rejected=await new MbgWhatsAppProvider().sendTemplate({recipientPhone:'9999999999',templateName:'payment_due_reminder',variables:{body:options.variables}});
 assert.equal(rejected.success,true);
 console.log('PASS: HTTP 200 with success:false is classified as ACCEPTED_BY_PROVIDER.');
 console.log('All six offline probes passed; no production services contacted.');
})().catch(err=>{console.error(err);process.exitCode=1;});
