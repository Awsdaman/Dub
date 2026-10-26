// Going back to change roles from every step, and the original playing on all connected devices together.
// Real Supabase (config.local.json), local server on 8765.
const {chromium}=require('../.test-tools/node_modules/playwright'),fs=require('fs'),assert=require('assert');
const config=JSON.parse(fs.readFileSync('config.local.json','utf8'));
const base=process.env.GAME_URL||'http://127.0.0.1:8765/';
const pass=n=>console.log('PASS '+n);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const errors=[];
 try{
 async function page(){
   const c=await b.newContext({permissions:['microphone'],viewport:{width:1280,height:900}}),p=await c.newPage();
   p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
   if(!process.env.GAME_URL)await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DUBLAJ='+JSON.stringify({site:false,...config})}));
   await p.goto(base);await p.waitForFunction(()=>S.clips.length&&typeof watchTogether==='function');
   await p.evaluate(()=>{getMic=async()=>{if(micStream)return micStream;initAudio();const o=ctx.createOscillator(),d=ctx.createMediaStreamDestination();o.connect(d);o.start();return micStream=d.stream;};
     window.__plays=[];v.addEventListener('playing',()=>window.__plays.push({at:Date.now(),clip:v.dataset.clip,muted:v.muted,t:v.currentTime}));});
   return p;
 }
 const waitFor=(p,fn,arg,timeout=90000)=>p.waitForFunction(fn,arg,{timeout,polling:100});
 const h=await page(),a=await page(),z=await page();
 await h.locator('#pname').fill('المضيف');await h.locator('#addForm button').click();
 await h.locator('#remoteToggle').check();await h.locator('#hostConnect').click();await h.waitForFunction(()=>RS.room&&document.querySelector('#roomCode').textContent);
 const room=await h.locator('#roomCode').textContent();
 for(const [p,name] of [[a,'الأول'],[z,'الثاني']]){await p.locator('#joinSeatBtn').click();await p.locator('#seatRoom').fill(room);await p.locator('#seatName').fill(name);await p.locator('#seatJoinKey').click();await p.waitForFunction(()=>RS.accepted);}
 await h.waitForFunction(()=>E.peers.size===2);
 await h.locator('#startBtn').click();await h.locator('#chooseClipBtn').click();await h.locator('#clipLibrary button').filter({hasText:'موشو'}).click();
 await h.locator('#manyDevices').click();
 await h.locator('[data-character="c1"]').selectOption('المضيف');
 const mulan=await h.evaluate(()=>charactersOf(S.current)[1].id);
 await h.locator(`[data-character="${mulan}"]`).selectOption('الأول');

 /* ---- the original plays everywhere together ---- */
 const clipId=await h.evaluate(()=>S.current.id);
 await h.locator('#toWatchBtn').click();
 await waitFor(h,c=>window.__plays.some(x=>x.clip===c),clipId);
 for(const p of [a,z])await waitFor(p,c=>window.__plays.some(x=>x.clip===c)&&!v.paused,clipId,30000);
 const [hp,ap,zp]=await Promise.all([h,a,z].map(p=>p.evaluate(c=>window.__plays.filter(x=>x.clip===c).at(-1),clipId)));
 assert(!ap.muted&&!zp.muted,'seats must hear the original');
 const gap=Math.max(Math.abs(ap.at-hp.at),Math.abs(zp.at-hp.at));
 assert(gap<1500,'devices started '+gap+'ms apart');
 await h.waitForTimeout(1500);
 const times=await Promise.all([h,a,z].map(p=>p.evaluate(()=>v.currentTime)));
 assert(Math.max(...times)-Math.min(...times)<1.5,'positions '+times);
 pass(`The original plays on the host and both remote devices together (started within ${gap} ms, all with sound)`);

 /* ---- back from watching: same clip, roles kept; remote devices stop ---- */
 await h.locator('#watchBackBtn').click();
 await waitFor(h,()=>document.querySelector('#s-spin.on')&&!$('#pickArea').hidden);
 assert.equal(await h.locator('[data-character="c1"]').inputValue(),'المضيف');
 assert.equal(await h.locator(`[data-character="${mulan}"]`).inputValue(),'الأول');
 for(const p of [a,z])await waitFor(p,()=>document.querySelector('#s-seat.on')&&v.paused,null,20000);
 pass('غيّر الأدوار from watching returns to the same clip with the chosen roles; remote devices return to waiting');

 /* ---- change a role, record, then go back from the review ---- */
 await h.locator(`[data-character="${mulan}"]`).selectOption('الثاني');
 await h.locator('#toWatchBtn').click();await waitFor(h,()=>shownControls==='c-watch'&&!v.paused);
 await h.locator('#recBtn').click();await waitFor(h,()=>shownControls==='c-review');
 await h.locator('#reviewBackBtn').click();
 await waitFor(h,()=>document.querySelector('#s-spin.on')&&!E.session);
 assert.equal(await h.locator(`[data-character="${mulan}"]`).inputValue(),'الثاني');
 pass('Changed role is kept; غيّر الأدوار from the review discards the take after confirming');

 /* ---- back from a finished take ---- */
 await h.locator('#sharedDevice').click();const chip=h.locator('#dubChips button').filter({hasText:'المضيف'});if(await chip.getAttribute('aria-pressed')!=='true')await chip.click();
 await h.locator('#soloCharacter').selectOption('*');
 await h.locator('#toWatchBtn').click();await waitFor(h,()=>shownControls==='c-watch'&&!v.paused);
 await h.locator('#recBtn').click();await waitFor(h,()=>shownControls==='c-result');
 await h.locator('#resultBackBtn').click();
 await waitFor(h,()=>document.querySelector('#s-spin.on')&&!S.last);
 assert.equal(await h.evaluate(()=>S.dubs.length),0);
 pass('غيّر الأدوار from a finished take returns to casting without scoring it');

 await h.locator('#castBackBtn').click();await waitFor(h,()=>document.querySelector('#s-home.on'));
 pass('رجوع للاستوديو from casting returns home');
 /* ---- a slow device the host does not wait for joins at everyone's position ---- */
 const cdp=await z.context().newCDPSession(z);await cdp.send('Network.enable');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:1500*125,uploadThroughput:62500});
 await z.evaluate(()=>clipFiles.clear());
 await h.locator('#chooseClipBtn').click();await h.locator('#clipLibrary button').filter({hasText:'سبونج'}).click();
 await h.locator('#sharedDevice').click();const host=h.locator('#dubChips button').filter({hasText:'المضيف'});if(await host.getAttribute('aria-pressed')!=='true')await host.click();if(await h.locator('#soloCharacter').isVisible())await h.locator('#soloCharacter').selectOption('*');
 await h.locator('#toWatchBtn').click();await waitFor(h,()=>!$('#syncWait').hidden);
 await waitFor(h,()=>/1 من 2/.test($('#syncWait').textContent),null,30000);  // the fast device is ready, the slow one is not
 await h.locator('#syncNow').click();await waitFor(h,()=>!v.paused);
 await waitFor(z,()=>seatWatch?.ready&&!v.paused,null,60000);
 const [ht,zt]=await Promise.all([h,z].map(p=>p.evaluate(()=>v.currentTime)));
 assert(ht>3&&ht<27.5&&Math.abs(ht-zt)<1.2,`late device at ${zt}s, host at ${ht}s`);
 pass(`A slow device joins late at the host's position (host ${ht.toFixed(1)}s, late device ${zt.toFixed(1)}s), not from the start`);
 assert.deepEqual(errors,[]);pass('No page errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
