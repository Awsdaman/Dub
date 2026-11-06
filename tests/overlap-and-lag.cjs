// Dubbing one character keeps the other characters' lines whole, in the booth and in the final cut,
// and the sound can start ahead of the picture for Bluetooth headphones, but never in a saved video.
// Read-only, no Supabase. Needs the local server on 8765. Set CLIP to try another multi-character clip.
const {chromium}=require('../.test-tools/node_modules/playwright'),assert=require('assert');
const base=process.env.GAME_URL||'http://127.0.0.1:8765/',clipId=process.env.CLIP||'دا انجليزي؟';
const pass=n=>console.log('PASS '+n);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']}),errors=[];
 try{
  const p=await(await b.newContext({viewport:{width:1280,height:1000}})).newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DUBLAJ={site:false}'}));
  await p.goto(base);await p.waitForFunction(()=>S.clips.length>0&&typeof recordingGuide==='function');
  // compare the guide with the original and the music, line by line
  const r=await p.evaluate(async clipId=>{
   initAudio();await ctx.resume();
   const clip=S.clips.find(c=>c.id===clipId),original=await getBuffer('original:'+clip.video,await clipFile(clip).blob);
   const music=await getBuffer(clip.bg,url(clip.bg)),R=original.sampleRate,x=original.getChannelData(0),mix=music.getChannelData(0);
   const same=(g,a,b,ref)=>{for(let i=Math.ceil(a*R);i<Math.floor(b*R)&&i<g.length;i+=7)if(Math.abs(g[i]-ref[i])>1e-6)return false;return true;};
   const id=clip.characters[0].id,all=clip.characters.map(c=>c.id),lines=validLines(clip);
   const mine=lines.filter(l=>isAssigned(clip,l,[id])),others=lines.filter(l=>!isAssigned(clip,l,[id]));
   const solo=(await recordingGuide(clip,[id])).getChannelData(0);
   const out={mine:mine.length,others:others.length,overlaps:0,othersBroken:[],mineBroken:[],overlapBroken:[]};
   for(const l of others)if(!same(solo,l.start,l.end,x))out.othersBroken.push(l.start);
   for(const l of mine){
    const cuts=others.filter(o=>o.start<l.end&&o.end>l.start).map(o=>[Math.max(o.start,l.start),Math.min(o.end,l.end)]).sort((a,b)=>a[0]-b[0]);
    out.overlaps+=cuts.length;
    let at=l.start;
    for(const [a,z] of cuts){if(a>at&&!same(solo,at,a,mix))out.mineBroken.push(l.start);if(!same(solo,a,z,x))out.overlapBroken.push(a);at=Math.max(at,z);}
    if(l.end>at&&!same(solo,at,l.end,mix))out.mineBroken.push(l.start);
   }
   // everyone dubbed, or one device with no roles: every line comes out, exactly as before
   const check=async ids=>{const g=(await recordingGuide(clip,ids)).getChannelData(0);return lines.every(l=>same(g,l.start,l.end,mix));};
   out.noRoles=await check(null);out.everyone=await check(all);
   return out;
  },clipId);
  console.log(JSON.stringify(r));
  assert(r.mine&&r.others&&r.overlaps,'the clip must have overlapping characters');
  assert.deepStrictEqual(r.othersBroken,[],'other characters must stay whole');
  assert.deepStrictEqual(r.overlapBroken,[],'overlaps must keep the original');
  assert.deepStrictEqual(r.mineBroken,[],'own lines must lose the original voice outside overlaps');
  pass(`one character: ${r.others} other lines stay whole, ${r.overlaps} overlaps keep the original, own lines lose it elsewhere`);
  assert(r.noRoles&&r.everyone);pass('no roles, or everyone dubbed: all original voices come out as before');

  // where each sound starts in its buffer
  const starts=(lag,exportingNow)=>p.evaluate(async([lag,exportingNow])=>{
   const was=AudioBufferSourceNode.prototype.start;let got=null;
   AudioBufferSourceNode.prototype.start=function(w,o){got=o;return was.call(this,w,o);};
   setHearLag(lag);if(exportingNow)exportRecorder={state:'recording'};
   const buf=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate),n=startBuffer(buf,bgGain,1);
   const res={offset:got,lead:n.lead+v.currentTime,auto:ctx.outputLatency||0,saved:localStorage.getItem('dub-hear-lag')};
   AudioBufferSourceNode.prototype.start=was;exportRecorder=null;stopAll();return res;
  },[lag,exportingNow]);
  let s=await starts(200,false);
  assert(Math.abs(s.offset-(1+.2+s.auto))<1e-6,'lead applied: '+JSON.stringify(s));
  assert(Math.abs(s.lead-1)<1e-6,'the stall safety net keeps the plain position');
  assert.strictEqual(s.saved,'200');
  pass('headphone correction starts the sound ahead of the picture');
  s=await starts(200,true);
  assert(Math.abs(s.offset-1)<1e-6,'no lead while saving: '+JSON.stringify(s));
  pass('a saved video gets no correction');

  // the control, on every screen that records
  await p.reload();await p.waitForFunction(()=>S.clips.length>0&&typeof recordingGuide==='function');
  const ui=await p.evaluate(()=>({lag:hearLag,boxes:document.querySelectorAll('.hear-lag').length,shown:[...document.querySelectorAll('.hearLagVal')].map(e=>e.textContent),parents:[...document.querySelectorAll('.hear-lag')].map(e=>e.parentElement.id)}));
  assert.strictEqual(ui.lag,200);assert.deepStrictEqual(ui.shown,['200','200','200']);assert.deepStrictEqual(ui.parents,['c-watch','c-record','c-seat']);
  const clamp=await p.evaluate(()=>{const b=[...document.querySelectorAll('#c-record .hear-lag button')];b[1].click();const up=hearLag;setHearLag(9999);const hi=hearLag;setHearLag(-5);const lo=hearLag;return{up,hi,lo,text:document.querySelector('.hearLagVal').textContent};});
  assert.deepStrictEqual(clamp,{up:240,hi:480,lo:0,text:'0'});
  pass('the correction survives a reload, shows on all recording screens and stays between 0 and 480 ms');

  // moved live: the sound keeps playing and lands on the new position
  const live=await p.evaluate(async()=>{
   initAudio();await ctx.resume();const clip=S.clips.find(c=>c.id==='Rio');await loadVideo(clip);
   const buf=ctx.createBuffer(1,ctx.sampleRate*30,ctx.sampleRate);
   await seekTo(0);v.muted=true;await v.play();await nextFrame();startBuffer(buf,bgGain,v.currentTime);startBuffer(buf,voiceGain,v.currentTime+.1,20);
   const was=AudioBufferSourceNode.prototype.start,seen=[];
   AudioBufferSourceNode.prototype.start=function(w,o){seen.push(o-v.currentTime);return was.call(this,w,o);};
   setHearLag(280);AudioBufferSourceNode.prototype.start=was;
   const res={playing:playing.length,leads:playing.map(n=>+n.lead.toFixed(2)),until:playing.map(n=>n.until),seen:seen.map(x=>+(x-(ctx.outputLatency||0)).toFixed(2))};
   stopAll();setHearLag(0);return res;
  });
  assert.strictEqual(live.playing,2);assert.deepStrictEqual(live.until,[null,20]);
  assert(Math.abs(live.seen[0]-.28)<.02&&Math.abs(live.seen[1]-.38)<.02,JSON.stringify(live));
  pass('changing it while playing moves the sound at once');
  assert.deepStrictEqual(errors,[]);
  console.log('ALL PASS');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
