// On a slow connection the clip must not stop to buffer, and picture, subtitles, sound and the
// recording must stay together. Uses the published copy (site/) at 2 Mbit/s, on the largest clip.
const {chromium}=require('../.test-tools/node_modules/playwright'),assert=require('assert');
const base=process.env.GAME_URL||'http://127.0.0.1:8765/site/',clipName=process.env.CLIP||'هاكونا',kbps=+(process.env.KBPS||2000);
const pass=n=>console.log('PASS '+n);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const errors=[];
 try{
 const c=await b.newContext({permissions:['microphone'],viewport:{width:1280,height:800}}),p=await c.newPage();
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(base);await p.waitForFunction(()=>S.clips.length&&typeof watchTogether==='function');
 const cdp=await c.newCDPSession(p);await cdp.send('Network.enable');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:60,downloadThroughput:kbps*125,uploadThroughput:62500});
 await p.evaluate(()=>{getMic=async()=>{if(micStream)return micStream;initAudio();const o=ctx.createOscillator(),d=ctx.createMediaStreamDestination();o.connect(d);o.start();return micStream=d.stream;};
   window.__stalls=0;v.addEventListener('waiting',()=>{if(!v.paused)window.__stalls++;});});
 await p.locator('#pname').fill('سارة');await p.locator('#addForm button').click();await p.locator('#startBtn').click();
 await p.locator('#chooseClipBtn').click();await p.locator('#clipLibrary button').filter({hasText:clipName}).click();
 await p.locator('#dubChips button').filter({hasText:'سارة'}).click();
 if(await p.locator('#soloCharacter').isVisible())await p.locator('#soloCharacter').selectOption('*');
 await p.waitForFunction(()=>/\d+%/.test($('#clipProgress').textContent),null,{timeout:30000});
 const t0=Date.now();
 await p.locator('#toWatchBtn').click();
 await p.waitForFunction(()=>shownControls==='c-watch'&&!v.paused,null,{timeout:300000});
 const wait=Math.round((Date.now()-t0)/1000);
 pass(`Download progress shows while people choose; the clip starts after one complete download (${wait}s at ${kbps/1000} Mbit/s)`);

 await p.evaluate(()=>stopAll());await p.locator('#recBtn').click();
 await p.waitForFunction(()=>tape.live&&v.currentTime>.3,null,{timeout:120000});
 await p.evaluate(()=>{window.__stalls=0;window.__wall=performance.now();window.__vt=v.currentTime;});
 let worst=0;
 while(await p.evaluate(()=>!!tape.live)){worst=Math.max(worst,await p.evaluate(()=>Math.abs((performance.now()-window.__wall)/1000-(v.currentTime-window.__vt))));await p.waitForTimeout(1000);}
 const stalls=await p.evaluate(()=>window.__stalls);
 assert.equal(stalls,0,'video stopped to buffer during the recording');
 assert(worst<.15,'picture fell behind real time by '+worst+'s');
 pass(`Whole clip recorded with no buffering stops; picture and microphone within ${Math.round(worst*1000)} ms`);

 await p.waitForFunction(()=>shownControls==='c-result'&&!v.paused&&playing.length>=2,null,{timeout:120000});
 // the safety net: a forced stop of the picture pauses the sound and recording and restarts them aligned
 const net=await p.evaluate(async()=>{
   const before=playing.map(n=>n.lead);
   v.dispatchEvent(new Event('waiting'));const held=playing.every(n=>n.held);
   v.pause();await sleep(800);await v.play();await sleep(300);
   const after=playing.map(n=>n.lead);
   return {held,same:JSON.stringify(before.map(x=>x.toFixed(3)))===JSON.stringify(after.map(x=>x.toFixed(3))),count:[before.length,after.length]};
 });
 assert(net.held&&net.same,'stall guard '+JSON.stringify(net));
 pass('If the picture ever stops, the sound stops with it and restarts aligned to the same frame');
 assert.deepEqual(errors,[]);pass('No page errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
