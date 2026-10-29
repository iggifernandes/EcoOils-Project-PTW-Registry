const {JSDOM}=require('jsdom');const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('/tmp/claude-0/clone2/backend/Code.gs','utf8');
const c={console,JSON,Math,Date,Number,String,Object,Array,Error,RegExp,PropertiesService:{},CacheService:{},LockService:{},SpreadsheetApp:{},Utilities:{},ContentService:{},Session:{},MailApp:{},Logger:{}};
vm.createContext(c);vm.runInContext(code,c);const schema=JSON.parse(JSON.stringify(vm.runInContext('schema_()',c)));
const iso=x=>new Date(Date.now()+x*864e5).toISOString().slice(0,10);const T0=iso(0),T6=iso(6);
const html=fs.readFileSync('/tmp/claude-0/clone2/index.html','utf8').replace(/<script src="https:\/\/cdnjs[^>]*><\/script>/,'').replace(/<link[^>]*fonts[^>]*>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(w){w.scrollTo=()=>{};w.fetch=async(u,o)=>{const a=JSON.parse(o.body).action;return{json:async()=>a==='login'?{ok:true,role:'admin',contractor:'',schema,lists:{dept:[],location:[]},settings:{testMode:true}}:{ok:true,ptw:[{contractor:'GSB',ptwNo:'7001',issueDate:T0,validFrom:T0,validTo:T6,ram:'Medium',location:'SBE',wt_hot:'Y',doc_jha:'Y',doc_wms:'Y',jcName:'A',aoName:'B',paName:'C'}],reval:[],corrections:[],log:[],settings:{}}}};}});
const w=dom.window,d=w.document;let ok=0,bad=0;const T=(n,x)=>{x?ok++:(bad++,console.log('FAIL',n))};
setTimeout(async()=>{
 await w.eval("doLogin('X',true)");await new Promise(r=>setTimeout(r,300));
 const root=d.getElementById('root');
 T('header present',!!root.querySelector('header.eh'));
 T('titlebar present',!!root.querySelector('.titlebar'));
 T('role chip + logout inside titlebar',!!root.querySelector('.titlebar .chip')&&[...root.querySelectorAll('.titlebar button')].some(b=>b.textContent==='Log out'));
 T('header has no chip/logout',!root.querySelector('header.eh .chip')&&![...root.querySelectorAll('header.eh button')].some(b=>b.textContent==='Log out'));
 T('version above toggle',root.querySelector('header.eh .eh-r').children[0].id==='appver'&&root.querySelector('header.eh .eh-r').children[1].classList.contains('eh-l'));
 T('v1.4.2 shown',d.getElementById('appver').textContent==='v1.4.2');
 T('single title block',root.querySelectorAll('.brand').length===1);
 T('tabs present',root.querySelectorAll('nav.tabs button').length>=3);
 T('no stray null',!/\bnull\b/.test(root.textContent));
 T('log new PTW button',[...root.querySelectorAll('nav.tabs button.newbtn')].some(b=>b.textContent==='Log new PTW'));
 T('old Day 1 label gone',![...root.querySelectorAll('nav.tabs button')].some(b=>/Day 1/.test(b.textContent)));
 const rb=root.querySelector('.revalbtn');T('Revalidate button in registry',!!rb);
 if(rb){rb.click();await new Promise(r=>setTimeout(r,100));T('opens revalidation tab prefilled',w.eval('S.tab')==='reval'&&w.eval('S.draft.reval.ptwNo')==='7001'&&w.eval('S.draft.reval.contractor')==='GSB');}
 console.log('ui2',ok,'passed',bad,'failed');process.exit(bad?1:0)},500);
