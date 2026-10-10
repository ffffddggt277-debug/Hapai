// node replay.cjs config.json — покадровый рендер записанного матча
const {chromium}=require('playwright');const fs=require('fs');
const cfg=JSON.parse(fs.readFileSync(process.argv[2]));const rec=JSON.parse(fs.readFileSync(cfg.rec));
(async()=>{const browser=await chromium.launch({executablePath:require('child_process').execSync('which chromium').toString().trim(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:cfg.w||1280,height:cfg.h||720},deviceScaleFactor:cfg.dpr||1,isMobile:!!cfg.mobile,hasTouch:!!cfg.mobile});
await ctx.addInitScript({path:require('path').join(__dirname,'vt.js')});if(cfg.quality)await ctx.addInitScript(q=>localStorage.setItem('hapai-quality',q),cfg.quality);
const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await page.goto('http://localhost:3000');await page.waitForFunction(()=>window.__hapai&&document.querySelector('canvas'),null,{timeout:60000});await page.waitForTimeout(cfg.loadWait||9000);
if(cfg.nick)await page.evaluate(n=>{const i=document.querySelector('input');if(i){const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,n);i.dispatchEvent(new Event('input',{bubbles:true}))}},cfg.nick);
await page.evaluate(()=>window.__VT.install());
const dir=cfg.out;fs.mkdirSync(dir,{recursive:true});let frame=cfg.startFrame||0;const fdt=1000/(cfg.fps||30);
const snap=async()=>{await page.waitForTimeout(cfg.settle||30);{const t=Date.now();await page.screenshot({path:`${dir}/${String(frame++).padStart(5,'0')}.png`,timeout:300000});if(process.env.DBG)console.log('shot',Date.now()-t);}};
const step=async ms=>{const t=Date.now();await page.evaluate(ms=>window.__VT.step(ms),ms);if(process.env.DBG)console.log('step',Date.now()-t);};
const states=rec.states,notices=rec.notices,inputs=rec.inputs;let si=0,ni=0,ii=0,entered=false;const id=states.find(s=>s.st.you).st.you.id;
const feedTo=async(at)=>{const batch=[];while(si<states.length&&states[si].at<=at)batch.push(states[si++].st);const nb=[];while(ni<notices.length&&notices[ni].at<=at)nb.push(notices[ni++].n);let inp=null;while(ii<inputs.length&&inputs[ii].at<=at)inp=inputs[ii++];
 if(!batch.length&&!nb.length&&!inp)return;await page.evaluate(({batch,nb,inp,id,entered})=>{const H=window.__hapai;if(!entered)H.enter(id);for(const st of batch){// события из пропущенных пакетов не терять
   H.feed(st);}for(const n of nb)H.toast(n);if(inp){H.input.touchMove={x:inp.x,z:inp.z};H.input.touchLook=inp.angle;H.input.touchInteract=inp.interact;}},{batch,nb,inp,id,entered});entered=true;};
for(const seg of cfg.segments){
 if(seg.menu){for(let k=0;k<seg.frames;k++){await step(fdt);await snap();}continue;}
 if(seg.shotAt!==undefined){continue;}
 // прокрутка до начала сегмента без записи
 let at=seg.from-(seg.warm||1500);if(si===0&&!entered)at=Math.max(0,at);
 const cur=()=>si?states[si-1].at:0;let t=Math.max(cur(),at);
 const fine=seg.from-(seg.warmFine||500);for(;t<fine;t+=200){await feedTo(t);await step(50);} // быстрый прогон (dt движка ограничен .05)
 for(t=Math.max(t,fine);t<seg.from;t+=fdt){await feedTo(t);await step(fdt);}
 t=seg.from;const t0=t;for(let k=0;t<seg.to;k++,t=t0+k*fdt*(seg.speed||1)){await feedTo(t);await step(fdt);await snap();if(seg.shots)for(const s of seg.shots)if(Math.abs(t-s.at)<fdt/2)await page.screenshot({path:s.path});}
 console.log('segment',seg.from,seg.to,'frames',frame);
}
console.log('errors',errs.slice(0,10));await browser.close();})();
