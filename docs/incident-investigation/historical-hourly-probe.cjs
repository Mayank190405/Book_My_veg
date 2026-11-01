// Offline probe of historical code. All database, network, logging and timers are mocked.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'server/node_modules/typescript'));
const revision='ffe60f9ddf7bec798f4c0ecca2065eab4d90ccab';
const get=p=>cp.execFileSync('git',['show',revision+':'+p],{cwd:root,encoding:'utf8'});
const HOUR=3600000;let now=Date.parse('2026-11-01T05:56:00Z');
const realDate=Date;class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));} static now(){return now;}}
const posts=[],audits=[],timers=[];const logger={info(){},warn(){},error(){}};
const specs=[['Synthetic Kabir',[1000,2070.8]],['Synthetic Arati',[70]],['Synthetic Aniruddha',[1,1,1,1,1,1,1,1,3799.2]],['Synthetic Mavshi',[.01,.01,.01,.01,.01,.01,.01,886.84]],['Synthetic Amol',[.01,.01,449.15]]];
const created=new realDate(now-7*24*HOUR-20*60000);
const orders=specs.flatMap(([name,values],i)=>values.map((totalAmount,n)=>({id:`probe-${i}-${n}`,userId:`probe-${i}`,user:{id:`probe-${i}`,name,phone:`999999999${i}`},totalAmount,payments:[],createdAt:created,isPaid:false,paymentStatus:'PENDING',status:'CONFIRMED'})));
const prisma={whatsAppTemplateConfig:{findFirst:async()=>null},order:{findMany:async q=>q.where.feedbackSent===false?[]:orders},user:{findMany:async()=>[]},auditLog:{findFirst:async()=>null,create:async q=>{audits.push(q);return{id:'mock'}}}};
function evaluate(source,imports){const module={exports:{}};const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2016,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:s=>{if(!(s in imports))throw Error('Unexpected import '+s);return imports[s];},process:{env:{MBGCARD_API_TOKEN:'OFFLINE_ONLY',CLIENT_URL:'https://offline.invalid'}},console:{log(){},warn(){},error(){}},Date:Clock,setTimeout:(fn,ms)=>timers.push({kind:'timeout',fn,ms}),setInterval:(fn,ms)=>timers.push({kind:'interval',fn,ms})});return module.exports;}
const mbg=evaluate(get('server/src/services/mbgcard.ts'),{dotenv:{config(){}},axios:{post:async(url,payload,config)=>{posts.push({at:new realDate(now).toISOString(),url,payload,userAgent:config.headers['User-Agent']});return{data:{success:true,messageId:'mock-'+posts.length}};}}});
const worker=evaluate(get('server/src/services/paymentReminderWorker.ts'),{'../config/prisma':{__esModule:true,default:prisma},'../utils/logger':{__esModule:true,default:logger},'./mbgcard':mbg});
(async()=>{worker.startPaymentReminderWorker();const timer=timers.find(t=>t.kind==='interval');assert.equal(timer.ms,HOUR);await timer.fn();now+=HOUR;await timer.fn();assert.equal(posts.length,10);assert.equal(audits.length,0);
for(let i=0;i<5;i++){const a=posts[i],b=posts[i+5];assert.deepEqual(a.payload.variables,b.payload.variables);console.log(JSON.stringify({synthetic:true,customer:specs[i][0],first:a.at,second:b.at,template:a.payload.templateName,invoice:a.payload.variables.body[1],amount:a.payload.variables.body[2],userAgent:a.userAgent}));}
assert.equal(posts[3].payload.variables.body[2],'₹886.9100000000001');assert.equal(posts[4].payload.variables.body[2],'₹449.16999999999996');console.log('PASS: actual historical worker/helper emitted 10 mock POSTs, repeated after one hour, matching both raw decimal tails; zero payment reminder audits. Synthetic financial inputs, NOT incident data.');
})().catch(e=>{console.error(e);process.exitCode=1;});
