// A remote player sees the host's finished dub on their own device, together with the host, and votes
// from there; in a head-to-head they do so before their own turn. Real Supabase, local server on 8765.
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
   await p.goto(base);await p.waitForFunction(()=>S.clips.length&&typeof shareResult==='function');
   await p.evaluate(()=>{getMic=async()=>{if(micStream)return micStream;initAudio();const o=ctx.createOscillator(),g=ctx.createGain(),d=ctx.createMediaStreamDestination();o.frequency.value=220;g.gain.value=.3;o.connect(g).connect(d);o.start();return micStream=d.stream;};
     window.__plays=[];v.addEventListener('playing',()=>window.__plays.push({at:Date.now(),t:v.currentTime}));});
   return p;
 }
 const waitFor=(p,fn,arg,timeout=90000)=>p.waitForFunction(fn,arg,{timeout,polling:100});
 const h=await page(),s=await page();
 await h.locator('#pname').fill('المضيف');await h.locator('#addForm button').click();
 await h.locator('#remoteToggle').check();await h.locator('#hostConnect').click();await h.waitForFunction(()=>RS.room&&document.querySelector('#roomCode').textContent);
 const room=await h.locator('#roomCode').textContent();
 await s.locator('#joinSeatBtn').click();await s.locator('#seatRoom').fill(room);await s.locator('#seatName').fill('ب');await s.locator('#seatJoinKey').click();
 await s.waitForFunction(()=>RS.accepted);await h.waitForFunction(()=>E.peers.size===1);
 await h.locator('#startBtn').click();

 /* ---- the host's take plays on the remote device too, and is voted there ---- */
 await h.locator('#chooseClipBtn').click();await h.locator('#clipLibrary button').filter({hasText:'طرزان'}).click();
 await h.locator('#dubChips button').filter({hasText:'المضيف'}).click();
 await h.locator('#toWatchBtn').click();await waitFor(h,()=>shownControls==='c-watch'&&!v.paused);
 await h.locator('#recBtn').click();
 await waitFor(h,()=>shownControls==='c-result');
 await waitFor(s,()=>shownControls==='c-seat-dub'&&!v.paused&&playing.length>=2,null,60000);
 await waitFor(h,()=>!v.paused&&playing.length>=2,null,60000);
 const [hp,sp]=await Promise.all([h,s].map(p=>p.evaluate(()=>window.__plays.at(-1).at)));
 assert(Math.abs(hp-sp)<1500,'devices started '+Math.abs(hp-sp)+' ms apart');
 assert(!(await s.locator('#seatDubVote').isHidden()),'remote voting buttons should show');
 assert((await s.locator('#seatDubTitle').textContent()).includes('المضيف'));
 pass(`The host's take plays on the remote device with the room (started ${Math.abs(hp-sp)} ms apart), with voting on screen`);

 await s.locator('#seatDubPads [data-score="7"]').click();
 await waitFor(h,()=>votes['ب']===7);await waitFor(s,()=>/وصل تصويتك/.test($('#seatDubStatus').textContent));
 pass('The remote player votes from their own device and the host receives it');

 await h.waitForTimeout(2500);
 await h.locator('#replayDubBtn').click();
 await waitFor(s,()=>!v.paused&&v.currentTime<1.5,null,20000);
 pass('عيدها on the host replays the dub on the remote device too');

 await h.locator('#nextBtn').click();
 await waitFor(s,()=>document.querySelector('#s-seat.on')&&v.paused,null,20000);
 pass('When the host moves on, the remote device goes back to waiting');

 /* ---- head-to-head: the remote player watches and votes on the host's take before their own turn ---- */
 await h.locator('#chooseClipBtn').click();await h.locator('#clipLibrary button').filter({hasText:'طرزان'}).click();
 await h.locator('#duelMode').click();await h.locator('#duelA').selectOption('المضيف');await h.locator('#duelB').selectOption('ب');
 await h.locator('#toWatchBtn').click();await waitFor(h,()=>shownControls==='c-watch'&&!v.paused);
 await h.locator('#recBtn').click();await waitFor(h,()=>shownControls==='c-result');
 await waitFor(s,()=>shownControls==='c-seat-dub'&&!$('#seatDubVote').hidden&&!RS.turn,null,60000);
 await s.locator('#seatDubPads [data-score="6"]').click();await waitFor(h,()=>votes['ب']===6);
 await h.locator('#nextBtn').click();
 await waitFor(h,()=>shownControls==='c-watch'&&S.dubbers[0]==='ب');
 await h.locator('#recBtn').click();
 await waitFor(s,()=>!!RS.turn&&shownControls==='c-seat',null,60000);
 pass('Head-to-head: the remote player sees and votes on the host\'s take, then gets their own turn');

 await s.locator('#seatRecord').click();await waitFor(s,()=>RS.take&&!$('#seatPreview').hidden,null,90000);
 await s.locator('#seatSend').click();
 await waitFor(h,()=>shownControls==='c-result'&&S.last.dubbers[0]==='ب',null,90000);
 await waitFor(s,()=>shownControls==='c-seat-dub'&&!v.paused,null,60000);
 assert(await s.locator('#seatDubVote').isHidden(),'a player does not vote on their own take');
 pass('The remote player\'s own take plays back on their device too, without voting on it');
 assert.deepEqual(errors,[]);pass('No page errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
