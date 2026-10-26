// Every clip, on a slow connection: downloads, plays start to end without stopping, keeps time,
// and its original sound decodes for the recording guide. Defaults to the published game.
const {chromium}=require('../.test-tools/node_modules/playwright'),assert=require('assert');
const base=process.env.GAME_URL||'https://dub-ashen-ten.vercel.app/',kbps=+(process.env.KBPS||2000);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 let failed=0;
 try{
 const c=await b.newContext({viewport:{width:1280,height:800}}),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await p.waitForFunction(()=>S.clips.length&&typeof clipFile==='function');
 const cdp=await c.newCDPSession(p);await cdp.send('Network.enable');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:60,downloadThroughput:kbps*125,uploadThroughput:62500});
 const ids=await p.evaluate(()=>S.clips.map(c=>c.id));
 for(const id of ids){
   const r=await p.evaluate(async id=>{
     initAudio();await ctx.resume();const clip=S.clips.find(c=>c.id===id),t0=performance.now();
     S.current=clip;if(!await enterBooth(clip))return {error:'load'};
     const loadS=(performance.now()-t0)/1000;let stalls=0;const w=()=>{if(!v.paused)stalls++;};v.addEventListener('waiting',w);
     const guide=await recordingGuide(clip,null);  // the original sound, decoded from the same download
     v.muted=true;await seekZero();await v.play();const w0=performance.now(),v0=v.currentTime;let worst=0;
     const cap=performance.now()+(v.duration+30)*1000;
     while(!v.ended&&v.currentTime<v.duration-.1&&performance.now()<cap){await sleep(250);worst=Math.max(worst,Math.abs((performance.now()-w0)/1000-(v.currentTime-v0)));}
     v.removeEventListener('waiting',w);stopAll();
     return {loadS:+loadS.toFixed(1),seconds:+v.duration.toFixed(1),stalls,worstMs:Math.round(worst*1000),guideS:+guide.duration.toFixed(1),lines:(clip.timed||[]).length};
   },id);
   const ok=!r.error&&r.stalls===0&&r.worstMs<300&&Math.abs(r.guideS-r.seconds)<.5;
   if(!ok)failed++;
   console.log((ok?'PASS ':'FAIL ')+id+' '+JSON.stringify(r));
 }
 assert.deepEqual(errors,[]);
 }finally{await b.close();}
 if(failed){console.error(failed+' clip(s) failed');process.exitCode=1;}else console.log('PASS every clip plays through on '+kbps/1000+' Mbit/s without stopping');
})().catch(e=>{console.error(e);process.exitCode=1;});
