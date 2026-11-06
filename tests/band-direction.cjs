// The band follows the script's language: English clips run left to right, Arabic clips right to left.
// Checks the detection, where the first word meets the sync bar, and which way dragging moves time.
// Read-only, no Supabase. Needs the local server on 8765. Set ENGLISH_CLIP / ARABIC_CLIP to try others.
const {chromium}=require('../.test-tools/node_modules/playwright'),assert=require('assert'),fs=require('fs');
const base=process.env.GAME_URL||'http://127.0.0.1:8765/',english=process.env.ENGLISH_CLIP||'Rio',arabic=process.env.ARABIC_CLIP||'14 سنة خدمة';
const pass=n=>console.log('PASS '+n);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']}),errors=[];
 try{
  const p=await(await b.newContext({viewport:{width:1280,height:1000}})).newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DUBLAJ={site:false}'}));
  await p.goto(base);await p.waitForFunction(()=>S.clips.length>0&&typeof drawBand==='function');await p.evaluate(()=>document.fonts.ready);
  assert.strictEqual(await p.evaluate(()=>scriptIsLtr('Hello there, يا')),true);
  assert.strictEqual(await p.evaluate(()=>scriptIsLtr('مرحبا OK')),false);
  assert.strictEqual(await p.evaluate(()=>scriptIsLtr('')),false);
  assert.strictEqual(await p.evaluate(()=>ltrLine('?but you are a bird')),'but you are a bird?');
  assert.strictEqual(await p.evaluate(()=>ltrLine('!ok')),'ok!');
  assert.strictEqual(await p.evaluate(()=>ltrLine('hey!')),'hey!');
  pass('detection: mostly Latin is left to right; Arabic and empty are right to left');
  // every clip of the game: the English-named ones flip, all the rest stay as they were
  const directions=await p.evaluate(()=>S.clips.map(c=>{setupBand(c);return{title:c.title,ltr:band.ltr};}));
  for(const c of directions)assert.strictEqual(c.ltr,/[A-Za-z]/.test(c.title),'wrong direction for '+c.title);
  pass('all clips: left to right = '+directions.filter(c=>c.ltr).map(c=>c.title).join(', ')+'; right to left = '+directions.filter(c=>!c.ltr).length+' clips');
  // draw a clip at the moment its first line reaches the bar and read back where the ink is
  const measure=id=>p.evaluate(id=>{
   const clip=S.clips.find(c=>c.id===id);setupBand(clip);
   const ln=[...band.texts].sort((a,b)=>a.start-b.start)[0];
   document.querySelector('#bandProbe')?.remove();
   const cv=document.createElement('canvas');cv.id='bandProbe';cv.style.cssText='display:block;width:1200px;height:140px;position:fixed;top:0;left:0;z-index:99';document.body.append(cv);
   drawBand(cv,{...band,dur:60,clock:()=>ln.start,countdown:false,tape:null,punchAt:null});
   const g=cv.getContext('2d'),W=cv.width,H=cv.height,scale=W/1200,d=g.getImageData(0,0,W,H).data,y0=Math.round(H*.18),y1=Math.round(H*.82);
   let red=[],ink=[];
   for(let x=0;x<W;x++){let r=0,k=0;for(let y=y0;y<y1;y++){const i=(y*W+x)*4,R=d[i],G=d[i+1],B=d[i+2];if(R>220&&G<80&&B<80)r++;else if(R<70&&G<70&&B<70)k++;}if(r>(y1-y0)*.8)red.push(x);if(k)ink.push(x);}
   const bar=(red[0]+red[red.length-1])/2/scale,xs=ink.map(x=>x/scale);
   return{ltr:band.ltr,bar,inkLeftOfBar:xs.filter(x=>x<bar-6).length,inkRightOfBar:xs.filter(x=>x>bar+6).length,text:ln.text};
  },id);
  const en=await measure(english);
  await p.locator('#bandProbe').screenshot({path:'tests/artifacts/band-english.png'}).catch(()=>{});
  assert.strictEqual(en.ltr,true,'English clip should run left to right');
  assert(Math.abs(en.bar-360)<6,'bar sits at 30%: '+en.bar);
  assert(en.inkRightOfBar>en.inkLeftOfBar*3,'first English line should lie right of the bar: '+JSON.stringify(en));
  pass('English: bar on the left, first line starts at it and runs off to the right');
  const ar=await measure(arabic);
  await p.locator('#bandProbe').screenshot({path:'tests/artifacts/band-arabic.png'}).catch(()=>{});
  assert.strictEqual(ar.ltr,false,'Arabic clip should stay right to left');
  assert(Math.abs(ar.bar-840)<6,'bar sits at 70%: '+ar.bar);
  assert(ar.inkLeftOfBar>ar.inkRightOfBar*3,'first Arabic line should lie left of the bar: '+JSON.stringify(ar));
  pass('Arabic: bar on the right, first line starts at it and runs off to the left, as before');
  await p.evaluate(()=>document.querySelector('#bandProbe').remove());
  // dragging: the band follows the finger, so the same drag moves time opposite ways
  const drag=async id=>{
   await p.evaluate(async id=>{
    const clip=S.clips.find(c=>c.id===id);S.current=clip;
    document.querySelectorAll('.screen,[id^="s-"]').forEach(e=>e.classList.remove('on'));$('#s-play').classList.add('on');
    v.src=clip.video;await new Promise(r=>v.addEventListener('loadedmetadata',r,{once:true}));v.pause();setupBand(clip);
    captureBusy=false;downloadBusy=false;shownControls='c-watch';v.currentTime=5;await new Promise(r=>setTimeout(r,200));
   },id);
   await p.locator('#band').scrollIntoViewIfNeeded();
   const box=await p.locator('#band').boundingBox(),y=box.y+box.height/2,x=box.x+box.width/2,dx=box.width/7.5;
   await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x-dx/2,y);await p.mouse.move(x-dx,y);await p.mouse.up();
   await p.waitForTimeout(200);
   return p.evaluate(()=>v.currentTime);
  };
  const tEn=await drag(english),tAr=await drag(arabic);
  assert(Math.abs(tEn-6)<.2,'English: dragging left one second goes forward: '+tEn);
  assert(Math.abs(tAr-4)<.2,'Arabic: dragging left one second goes back: '+tAr);
  pass('dragging follows the band in both directions');
  // the editing room reads the direction from the lines typed there
  const edDir=id=>p.evaluate(async id=>{document.querySelectorAll('.screen,[id^="s-"]').forEach(e=>e.classList.remove('on'));$('#s-edit').classList.add('on');await editClip(S.clips.find(c=>c.id===id));await new Promise(r=>setTimeout(r,200));return ed.band.ltr;},id);
  assert.strictEqual(await edDir(english),true);assert.strictEqual(await edDir(arabic),false);
  pass('editing room band follows the same direction');
  assert.deepStrictEqual(errors,[]);
  console.log('ALL PASS');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
