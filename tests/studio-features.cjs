// Re-recording parts, band scrubbing, typed editor times and effects, head-to-head with a
// remote player who re-records parts (real Supabase, WAV upload), bloopers and points reset.
// Needs config.local.json and the local server on 8765. Synthetic microphones: a tone whose loudness
// the test changes between passes, so each pass can be told apart in the final audio.
const {chromium}=require('../.test-tools/node_modules/playwright'),fs=require('fs'),assert=require('assert');
const config=JSON.parse(fs.readFileSync('config.local.json','utf8'));
const base=process.env.GAME_URL||'http://127.0.0.1:8765/';
const pass=n=>console.log('PASS '+n);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const errors=[];
 try{
 async function page(){
   const c=await b.newContext({permissions:['microphone'],viewport:{width:1280,height:1000}}),p=await c.newPage();
   p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
   if(!process.env.GAME_URL)await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DUBLAJ='+JSON.stringify({site:false,...config})}));
   await p.goto(base);await p.waitForFunction(()=>S.clips.length>0&&typeof playBloopers==='function');
   // a tone instead of the fake camera's beeps; window.__mic.gain sets its loudness
   await p.evaluate(()=>{getMic=async()=>{if(micStream)return micStream;initAudio();const o=ctx.createOscillator(),g=ctx.createGain(),d=ctx.createMediaStreamDestination();o.frequency.value=220;g.gain.value=.3;o.connect(g).connect(d);o.start();window.__mic=g;return micStream=d.stream;};});
   return p;
 }
 const rms=(p,a,z)=>p.evaluate(async([a,z])=>{const buf=await ctx.decodeAudioData(await S.last.blob.arrayBuffer()),x=buf.getChannelData(0),r=buf.sampleRate;let s=0;const A=Math.floor(a*r),Z=Math.floor(z*r);for(let i=A;i<Z;i++)s+=x[i]*x[i];return Math.sqrt(s/(Z-A));},[a,z]);
 const gain=(p,g)=>p.evaluate(g=>window.__mic.gain.value=g,g);
 const waitFor=(p,fn,arg,timeout=60000)=>p.waitForFunction(fn,arg,{timeout,polling:100});
 // drag the band by `seconds` (negative = back in time); pps = band width / 7.5
 async function dragBand(p,seconds){
   const box=await p.locator('#band').boundingBox(),y=box.y+box.height/2,x=box.x+box.width/2,dx=seconds*box.width/7.5;
   await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx/2,y);await p.mouse.move(x+dx,y);await p.mouse.up();
 }
 // record until `until` seconds, then press stop
 async function stopAt(p,until){await waitFor(p,t=>tape.live&&!$('#pauseRecBtn').disabled&&v.currentTime>=t,until);await p.locator('#pauseRecBtn').click();await waitFor(p,()=>!!tape.menu);}

 const h=await page(),s=await page();
 for(const n of ['أ','حكم']){await h.locator('#pname').fill(n);await h.locator('#addForm button').click();}
 await h.locator('#remoteToggle').check();await h.locator('#remoteName').fill('ب');await h.locator('#hostConnect').click();
 await h.waitForFunction(()=>RS.role==='host'&&document.querySelector('#roomCode').textContent);
 const room=await h.locator('#roomCode').textContent();
 await s.locator('#joinSeatBtn').click();await s.locator('#seatRoom').fill(room);await s.locator('#seatName').fill('ب');await s.evaluate(()=>{const up=remote.upload;window.__uploads=[];remote.upload=async(path,blob)=>{try{await up(path,blob);window.__uploads.push(blob.type);}catch(e){window.__uploads.push('rejected '+blob.type);throw e;}};});await s.locator('#seatJoinKey').click();
 await s.waitForFunction(()=>RS.accepted);await h.waitForFunction(()=>E.peers.size===1);
 await h.locator('#startBtn').click();
 await h.evaluate(()=>S.players.forEach(p=>p.score=0));

 /* ---- local take: stop, drag back, re-record a part, finish ---- */
 await h.locator('#chooseClipBtn').click();await h.locator('#clipLibrary button').filter({hasText:'طرزان'}).click();
 await h.locator('#dubChips button').filter({hasText:'أ'}).click();await h.locator('#toWatchBtn').click();
 await h.locator('#recBtn').click();
 await stopAt(h,4);
 assert(!(await h.locator('#recPaused').isHidden()));
 await dragBand(h,-2.2);
 const at=await h.evaluate(()=>v.currentTime);assert(at>1.3&&at<2.3,'band drag moved to '+at);
 await h.locator('#tapeListen').click();await waitFor(h,()=>tape.listening&&!v.paused&&playing.length>=2);
 await h.locator('#tapeListen').click();await waitFor(h,()=>!tape.listening);
 await h.evaluate(t=>v.currentTime=t,at);await gain(h,.6);
 await h.locator('#tapePunch').click();
 await waitFor(h,a=>band.punchAt===a&&v.currentTime<a,at);  // lead-in plays the earlier take first
 await stopAt(h,at+1.5);
 await h.locator('#tapeDone').click();await waitFor(h,()=>shownControls==='c-result');
 const [r1,r2,r3]=await Promise.all([rms(h,.5,1.2),rms(h,at+.3,at+1.2),rms(h,at+1.75,3.95)]);
 assert(Math.abs(r2/r1-2)<.25&&Math.abs(r3/r1-1)<.15,`passes mixed wrongly ${r1} ${r2} ${r3}`);
 assert.equal(await h.evaluate(()=>S.last.blob.type),'audio/wav');
 pass('Stop mid-take, drag the band, listen, re-record one part with a lead-in; before and after are kept');

 await h.evaluate(()=>stopAll());await dragBand(h,3);
 await waitFor(h,()=>!v.paused&&playing.length>=2);const t1=await h.evaluate(()=>v.currentTime);assert(t1>2.5,'scrub start '+t1);
 pass('Dragging the band on the result plays the dub from that spot');

 await h.evaluate(()=>{stopAll();v.currentTime=8;});await gain(h,.15);
 await h.locator('#punchBtn').click();await stopAt(h,9.5);await h.locator('#tapeDone').click();await waitFor(h,()=>shownControls==='c-result');
 const [q1,q2]=await Promise.all([rms(h,at+.3,at+1.2),rms(h,8.2,9.2)]);
 assert(Math.abs(q1-r2)<.03&&Math.abs(q2/r1-.5)<.1,`result re-record ${q1} ${q2}`);
 pass('Re-record from the result screen replaces only that part');
 await h.locator('#vote .pads[data-n="حكم"] button[data-s="7"]').click();await h.locator('#nextBtn').click();await waitFor(h,()=>document.querySelector('#s-home.on'));

 /* ---- head-to-head: local أ against remote ب, same character ---- */
 await h.locator('#chooseClipBtn').click();await h.locator('#clipLibrary button').filter({hasText:'طرزان'}).click();
 await h.locator('#duelMode').click();await h.locator('#duelA').selectOption('أ');await h.locator('#duelB').selectOption('ب');
 await h.locator('#toWatchBtn').click();await h.locator('#recBtn').click();
 await waitFor(h,()=>shownControls==='c-result');
 assert.deepEqual(await h.evaluate(()=>voters()),['حكم']);
 await h.locator('#vote .pads[data-n="حكم"] button[data-s="5"]').click();await h.locator('#nextBtn').click();
 await waitFor(h,()=>shownControls==='c-watch'&&S.dubbers[0]==='ب');
 assert(!(await h.locator('#duelHearBtn').isHidden()));
 pass('Head-to-head: first take voted by the others only; second player can hear the first take');

 await h.locator('#recBtn').click();
 await waitFor(s,()=>shownControls==='c-seat');await gain(s,.3);
 await s.locator('#seatRecord').click();
 await stopAt(s,4);await dragBand(s,-2);
 const sat=await s.evaluate(()=>v.currentTime);await gain(s,.6);
 await s.locator('#tapePunch').click();await stopAt(s,sat+1.5);await s.locator('#tapeDone').click();
 await waitFor(s,()=>RS.take&&!$('#seatPreview').hidden);
 await s.evaluate(()=>{stopAll();v.currentTime=7;});await gain(s,.15);
 await s.locator('#seatPunch').click();await stopAt(s,8.5);await s.locator('#tapeDone').click();
 await waitFor(s,()=>!$('#seatPreview').hidden&&RS.take.mime==='audio/wav');
 const hostStatus=await h.locator('#remoteStatus').textContent();
 await s.locator('#seatSend').click();
 await waitFor(h,()=>shownControls==='c-result'&&S.last.dubbers[0]==='ب',null,90000);
 const uploads=await s.evaluate(()=>window.__uploads);assert.deepEqual(uploads,['audio/wav'],'uploads '+uploads);
 const [w1,w2,w3]=await Promise.all([rms(h,.5,1.2),rms(h,sat+.3,sat+1.2),rms(h,7.2,8.2)]);
 assert(w1>.05&&Math.abs(w2/w1-2)<.3&&Math.abs(w3/w1-.5)<.15,`remote passes ${w1} ${w2} ${w3}`);
 pass(`Remote player re-records parts during the take and from the preview; WAV upload reaches the host (status seen: ${hostStatus.trim()})`);

 await h.locator('#vote .pads[data-n="حكم"] button[data-s="9"]').click();await h.locator('#nextBtn').click();
 await waitFor(h,()=>$('#slate').classList.contains('on')&&$('#slate').textContent.includes('الفايز'));
 await waitFor(h,()=>document.querySelector('#s-home.on'),null,15000);
 const scores=await h.evaluate(()=>Object.fromEntries(S.players.map(p=>[p.name,p.score])));
 assert.equal(scores['أ'],7+5);assert.equal(scores['ب'],9+2);
 pass('Head-to-head winner gets the +2 bonus on top of the vote average');

 /* ---- points reset, bloopers ---- */
 await h.locator('#resetPoints').click();
 assert(await h.evaluate(()=>S.players.every(p=>p.score===0)));
 pass('Reset points sets every player to 0');
 await h.locator('#endBtn').click();
 const n=await h.evaluate(()=>S.bloopers.length);assert(n>=3,'bloopers '+n);
 assert((await h.locator('#bloopersBtn').textContent()).includes(String(n)));
 await h.locator('#bloopersBtn').click();await waitFor(h,()=>$('#slate').textContent.includes('أخطاء الكواليس'));
 await waitFor(h,()=>!$('#slate').classList.contains('on')&&!v.paused);
 await h.locator('#reelStopBtn').click();await waitFor(h,()=>document.querySelector('#s-final.on'));
 pass(`Bloopers reel: ${n} stops kept and played`);

 /* ---- editing room: typed seconds and voice effects (not saved) ---- */
 // the published copy has no editing room
 if(!(await h.evaluate(()=>DUBLAJ.site))){
 await h.locator('#backHomeBtn').click();await h.evaluate(()=>show('s-setup'));
 await h.locator('#toEditBtn').click();await h.locator('#edList .reel').filter({hasText:'طرزان'}).click();
 await waitFor(h,()=>ed.clip&&ed.dur>0);
 const start=h.locator('#lns .ln input.num[data-k="start"]').first(),end=h.locator('#lns .ln input.num[data-k="end"]').first();
 await start.fill('2.25');await start.press('Enter');await end.fill('1');await end.press('Enter');
 assert.equal(await h.evaluate(()=>ed.lines[0].start),2.25);assert.notEqual(await h.evaluate(()=>ed.lines[0].end),1);
 await h.locator('#trimOutNum').fill('11.5');await h.locator('#trimOutNum').press('Enter');
 assert.equal(await h.evaluate(()=>ed.trim.out),11.5);
 await h.locator('#lns .ln select.line-fx').first().selectOption('robot');
 assert.equal(await h.evaluate(()=>ed.lines[0].fx),'robot');
 await h.evaluate(()=>{ed.dirty=false;});await h.locator('#edBack').click();
 pass('Editing room: typed line and scene times, invalid end rejected, per-line effect menu');
 }

 assert.deepEqual(errors,[]);pass('No page errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
