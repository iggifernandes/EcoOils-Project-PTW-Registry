const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('/tmp/claude-0/clone2/index.html','utf8').replace(/<link[^>]*fonts[^>]*>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(w){w.fetch=async()=>({json:async()=>({ok:true})});}});
const w=dom.window,d=w.document;let ok=0,bad=0;const T=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
setTimeout(()=>{
 T('login rendered',!!d.querySelector('.login'));
 const col=d.querySelector('.login .langcol');T('version above toggle',col&&col.children[0].id==='appver'&&col.children[1].classList.contains('langsw'));
 T('version text v1.2',d.getElementById('appver').textContent==='v1.2');
 T('3 language buttons',[...d.querySelectorAll('.langsw button')].map(b=>b.textContent).join()==='EN,ID,MS');
 [...d.querySelectorAll('.langsw button')].find(b=>b.textContent==='MS').click();
 T('Malay shown',d.body.textContent.includes('Kod akses')&&d.body.textContent.includes('Log masuk'));
 T('forgot link malay',d.body.textContent.includes('Lupa kod akses?'));
 [...d.querySelectorAll('.langsw button')].find(b=>b.textContent==='ID').click();
 T('Indonesian shown',d.body.textContent.includes('Kode akses'));
 [...d.querySelectorAll('.langsw button')].find(b=>b.textContent==='EN').click();
 T('English shown',d.body.textContent.includes('Access code')&&d.body.textContent.includes('Forgot access code?'));
 T('no stray null',!/\bnull\b/.test(d.getElementById('root').textContent));
 T('only one version label',d.querySelectorAll('#appver').length===1);
 console.log('ui',ok,'passed',bad,'failed');process.exit(bad?1:0)},600);
