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
T('version 1.2',JSON.parse(vm.runInContext('doGet',ctx)().s).version==='1.2');
let r=post({action:'forgotCode'});T('forgot ok no secrets',r.ok===true&&!JSON.stringify(r).includes(props.CODE_ADMIN));
T('mail sent to owner',mails.length===1&&mails[0].to==='owner@example.com'&&mails[0].body.includes(props.CODE_ADMIN));
for(let i=0;i<8;i++)post({action:'forgotCode'});
T('rate limited to 5',mails.length===5);
T('bad code rejected',post({action:'login',code:'nope'}).error==='BAD_CODE');
vm.runInContext('rotateAllCodes()',ctx);
T('rotate emails new list',mails.length===6&&mails[5].body.includes(props.CODE_ADMIN));
console.log('backend',ok,'passed',bad,'failed');
