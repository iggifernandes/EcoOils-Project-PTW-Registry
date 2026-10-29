const fs=require('fs'),vm=require('vm');
const props={},cache={},mails=[];
const ctx={console,JSON,Math,Date,Number,String,Object,Array,Error,parseInt,parseFloat,isNaN,RegExp,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v}})},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v}})},
 MailApp:{sendEmail:(to,sub,body)=>mails.push({to,sub,body})},
 Session:{getEffectiveUser:()=>({getEmail:()=>'owner@example.com'})},
 Utilities:{getUuid:()=>Math.random().toString(16).slice(2).padEnd(32,'a')},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({s,setMimeType(){return this}})},
 LockService:{},SpreadsheetApp:{},Logger:{log:()=>{}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('/tmp/claude-0/clone2/backend/Code.gs','utf8'),ctx);
let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
const post=o=>JSON.parse(vm.runInContext('doPost',ctx)({postData:{contents:JSON.stringify(o)}}).s);
vm.runInContext('newCodes_(false)',ctx);
T('codes made',props.CODE_ADMIN&&props.CODE_GSB);
T('version 1.8',JSON.parse(vm.runInContext('doGet',ctx)().s).version==='1.8');
let r=post({action:'forgotCode'});T('forgot ok no secrets',r.ok===true&&!JSON.stringify(r).includes(props.CODE_ADMIN));
T('mail sent to owner',mails.length===1&&mails[0].to==='owner@example.com'&&mails[0].body.includes(props.CODE_ADMIN));
for(let i=0;i<8;i++)post({action:'forgotCode'});
T('rate limited to 5',mails.length===5);
T('bad code rejected',post({action:'login',code:'nope'}).error==='BAD_CODE');
vm.runInContext('rotateAllCodes()',ctx);
T('rotate emails new list',mails.length===6&&mails[5].body.includes(props.CODE_ADMIN));
const xe=o=>vm.runInContext('day1ExtError_',ctx)(o);
T('ext 4h exactly ok',xe({day1End:'16:00',day1ExtEnd:'20:00'})===null);
T('ext 4h01 blocked',!!xe({day1End:'16:00',day1ExtEnd:'20:01'}));
T('ext 5h blocked',!!xe({day1End:'16:00',day1ExtEnd:'21:00'}));
T('ext past midnight within 4h ok',xe({day1End:'22:00',day1ExtEnd:'01:30'})===null);
T('ext past midnight over 4h blocked',!!xe({day1End:'22:00',day1ExtEnd:'03:00'}));
T('no ext ok',xe({day1End:'16:00',day1ExtEnd:''})===null);
T('ext without end blocked',!!xe({day1End:'',day1ExtEnd:'18:00'}));
const na=x=>vm.runInContext('normApplicant_',ctx)(x), ia=x=>vm.runInContext('isApplicant_',ctx)(x);
T('norm EcoOils project',na(' ecooils (project) ')==='ECOOILS (PROJECT)');
T('norm other forms',na('other - abc co')==='OTHER: ABC CO'&&na('Other:  abc   co')==='OTHER: ABC CO'&&na('OTHER – x1')==='OTHER: X1');
T('applicants valid',ia('GSB')&&ia('ECOOILS (PROJECT)')&&ia('ECOOILS (OPERATIONS)')&&ia('OTHER: ABC CO'));
T('applicants invalid',!ia('')&&!ia('RANDOM')&&!ia('OTHER: ')&&!ia('OTHER: A')&&!ia('OTHER: '+'X'.repeat(60)));
const errs=[];const rc=vm.runInContext('resolveContractor_',ctx);
T('admin may pick EcoOils',rc({role:'admin'},{contractor:'EcoOils (Operations)'},'PTW',5,errs)==='ECOOILS (OPERATIONS)'&&!errs.length);
T('entry may use other',rc({role:'entry'},{contractor:'other: sub co'},'PTW',6,errs)==='OTHER: SUB CO'&&!errs.length);
T('admin bad company rejected',rc({role:'admin'},{contractor:'NOPE'},'PTW',7,errs)===''&&errs.length===1);
T('contractor stays locked to own',rc({role:'contractor',contractor:'GSB'},{contractor:'ECOOILS (PROJECT)'},'PTW',8,errs)===''&&errs.length===2);
T('contractor blank takes own',rc({role:'contractor',contractor:'WEN'},{contractor:''},'PTW',9,errs)==='WEN');
T('schema lists applicants',vm.runInContext('schema_()',ctx).applicants.join()==='GSB,WEN,KKS,PBS,ECOOILS (PROJECT),ECOOILS (OPERATIONS)');
const lc=vm.runInContext("ptwCols_().filter(c=>c.k==='location')[0]",ctx);
const nl=v=>vm.runInContext('normVal_',ctx)(lc,v), cl=v=>vm.runInContext('checkVal_',ctx)(lc,v);
T('loc main only rejected',!!cl(nl('Extraction Plant')));
T('loc trailing dash rejected',!!cl(nl('Extraction Plant - ')));
T('loc detail 1 char rejected',!!cl(nl('Extraction Plant - E')));
T('loc hyphen -> en dash',nl('Extraction Plant - Elevation')==='Extraction Plant \u2013 Elevation');
T('loc main+detail ok',cl(nl('Extraction Plant \u2013 RVDF'))===null);
T('loc other specific ok',cl(nl('Other specific location - Gate 3 road'))===null);
T('no site-wide default',vm.runInContext('DEFAULT_LISTS',ctx).location.indexOf('Site-wide')<0&&vm.runInContext('DEFAULT_LISTS',ctx).location.indexOf('Block 6B')>=0);
const wr=o=>vm.runInContext('workRuleErrors_',ctx)(o);
T('hot needs fire watcher',wr({wt_hot:'Y'}).length===1&&wr({wt_hot:'Y',fireWatcher:'Budi'}).length===0);
{const o={wt_lifting:'Y'};wr(o);T('lifting auto-ticks plan',o.doc_lifting==='Y');}
T('electrical needs isolation or note',wr({wt_electrical:'Y'}).length===1&&wr({wt_electrical:'Y',doc_isolation:'Y'}).length===0&&wr({wt_electrical:'Y',isoNote:'Lighting only, de-energised by switch'}).length===0);
const hd=vm.runInContext('PTW_HEAD()',ctx);T('new cols at end of header',hd.slice(-2).join()==='fireWatcher,isoNote'&&hd.indexOf('voided')<hd.indexOf('fireWatcher'));
console.log('backend',ok,'passed',bad,'failed');
