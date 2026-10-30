// Players come in late (reaction time, device sound delay); each take is lined up with the lines it dubs.
// A synthetic player speaks every line of a clip a fixed time late; the take must play back on time.
// An on-time player must be left alone.
const {chromium}=require('../.test-tools/node_modules/playwright'),assert=require('assert');
const base=process.env.GAME_URL||'http://127.0.0.1:8765/';
const pass=n=>console.log('PASS '+n);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const errors=[];
 try{
 const p=await (await b.newContext({permissions:['microphone']})).newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(base);await p.waitForFunction(()=>S.clips.length&&typeof lateness==='function');
 // the "voice" is on while the picture is inside a line, `late` seconds after the line's own times
 await p.evaluate(()=>{window.__late=0;getMic=async()=>{if(micStream)return micStream;initAudio();const o=ctx.createOscillator(),g=ctx.createGain(),d=ctx.createMediaStreamDestination();o.frequency.value=220;g.gain.value=0;o.connect(g).connect(d);o.start();
   (function speak(){const t=v.currentTime-window.__late,on=tape.live&&S.current&&(S.current.timed||[]).some(l=>t>=l.start&&t<l.end);g.gain.value=on?.3:0;requestAnimationFrame(speak);})();return micStream=d.stream;};});
 await p.locator('#pname').fill('سارة');await p.locator('#addForm button').click();await p.locator('#startBtn').click();
 async function take(late){
   await p.evaluate(l=>window.__late=l,late);
   await p.locator('#chooseClipBtn').click();await p.locator('#clipLibrary button').filter({hasText:'موشو'}).click();
   const chip=p.locator('#dubChips button').filter({hasText:'سارة'});if(await chip.getAttribute('aria-pressed')!=='true')await chip.click();
   await p.locator('#soloCharacter').selectOption('*');
   await p.locator('#toWatchBtn').click();await p.waitForFunction(()=>shownControls==='c-watch'&&!v.paused,null,{timeout:120000});
   await p.evaluate(()=>stopAll());await p.locator('#recBtn').click();
   await p.waitForFunction(()=>shownControls==='c-result',null,{timeout:120000});
   // how far the voice still is from the lines: the shift that best lines the whole take up with them (0 = in time)
   return p.evaluate(async()=>{const e=S.last,buf=await getBuffer(e.id,e.blob),x=buf.getChannelData(0),r=buf.sampleRate,lines=e.clip.timed,hop=.01,n=Math.floor(v.duration/hop);
     const on=new Uint8Array(n),blk=new Uint8Array(n);
     for(let k=0;k<n;k++){const t=k*hop,i=Math.floor((t+e.offset)*r);on[k]=i>=0&&i<x.length&&Math.abs(x[i])+Math.abs(x[i+40]||0)>.05?1:0;blk[k]=lines.some(l=>t>=l.start&&t<l.end)?1:0;}
     let best=0,bestHits=-1;for(let s=-100;s<=100;s++){let hits=0;for(let k=0;k<n;k++)if(blk[k]&&on[k+s])hits++;if(hits>bestHits){bestHits=hits;best=s;}}
     return {remaining:+(best*hop).toFixed(2)};});
 }
 const late=await take(.5);
 assert(Math.abs(late.remaining)<=.05,'a half-second-late take should play on time, still off by '+late.remaining);
 pass(`A take spoken 0.5 s late plays back on time (left over: ${Math.round(late.remaining*1000)} ms)`);
 await p.locator('#resultBackBtn').click();await p.locator('#castBackBtn').click();
 const onTime=await take(0);
 assert(Math.abs(onTime.remaining)<=.05,'an on-time take should stay on time, off by '+onTime.remaining);
 pass(`An on-time take stays on time (left over: ${Math.round(onTime.remaining*1000)} ms)`);
 assert.deepEqual(errors,[]);pass('No page errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
