// The band gives every character one fixed row for the whole clip, in the game and the editing room.
// Read-only, no Supabase. Needs the local server on 8765.
const {chromium}=require('../.test-tools/node_modules/playwright'),assert=require('assert');
const base=process.env.GAME_URL||'http://127.0.0.1:8765/',pass=n=>console.log('PASS '+n);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 try{
  const p=await(await b.newContext({viewport:{width:1280,height:900}})).newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DUBLAJ={site:false}'}));
  await p.goto(base);await p.waitForFunction(()=>S.clips.length>0&&typeof recordingGuide==='function');await p.evaluate(()=>document.fonts.ready);
  // draw every line of every clip at its own moment, and note the row each one lands on
  const r=await p.evaluate(()=>{
   const cv=document.createElement('canvas');cv.style.cssText='display:block;width:1200px;position:fixed;top:0;left:0';document.body.append(cv);
   const was=CanvasRenderingContext2D.prototype.fillText;let drawn=[];
   CanvasRenderingContext2D.prototype.fillText=function(t,x,y){drawn.push({t,x,y});return was.call(this,t,x,y);};
   const out=[];
   for(const clip of S.clips){
    setupBand(clip);
    const rows=new Map(),problems=[],heights=new Set(),chars=charactersOf(clip);
    for(const l of band.texts){
     drawn=[];drawBand(cv,{...band,dur:1e4,clock:()=>l.start,countdown:false,tape:null,punchAt:null});
     heights.add(cv.style.height);
     // the line starting at the bar now, not a line with the same words elsewhere on the band
     const atBar=band.ltr?360+4:840-4,ids=lineCharacters(l),ys=drawn.filter(d=>(d.t===ltrLine(l.text)||d.t===l.text)&&Math.abs(d.x-atBar)<2).map(d=>d.y);
     if(!ys.length){problems.push('not drawn: '+l.text);continue;}
     if(ids.length<=1){const id=ids[0]||'none';if(!rows.has(id))rows.set(id,new Set());ys.forEach(y=>rows.get(id).add(Math.round(y)));}
     else if(new Set(ys).size<new Set(ids).size)problems.push('shared line not on both rows: '+l.text);
    }
    for(const [id,ys] of rows)if(ys.size!==1)problems.push('character on several rows: '+id+' '+[...ys]);
    const all=[...rows.values()].map(s=>[...s][0]);
    if(new Set(all).size!==all.length)problems.push('two characters share a row');
    if(heights.size>1)problems.push('band height changes: '+[...heights]);
    const expected=chars.map(c=>[...(rows.get(c.id)||[])][0]).filter(y=>y!=null);
    if(expected.some((y,i)=>i&&y<=expected[i-1]))problems.push('rows out of character order');
    out.push({id:clip.id,chars:chars.length,height:[...heights][0],problems});
   }
   CanvasRenderingContext2D.prototype.fillText=was;cv.remove();return out;
  });
  const bad=r.filter(c=>c.problems.length);
  assert.deepStrictEqual(bad,[]);
  pass(`${r.length} clips: each character stays on one row, in order, and the band height never changes`);
  // on a laptop screen the picture gives way so that the whole band fits
  await p.setViewportSize({width:1366,height:768});
  const fit=await p.evaluate(async()=>{
   const clip=S.clips.find(c=>c.id==='Rio');S.current=clip;document.querySelectorAll('.screen').forEach(e=>e.classList.remove('on'));$('#s-play').classList.add('on');controls('c-record');
   setupBand(clip);band.clock=()=>40;await new Promise(r=>setTimeout(r,300));
   return{page:document.documentElement.scrollHeight,height:innerHeight,band:$('#band').getBoundingClientRect().height};
  });
  assert(fit.page<=fit.height+2,'band must fit a laptop screen: '+JSON.stringify(fit));
  pass('five characters fit a 1366x768 laptop screen with no scrolling');
  // the editing room shows the same rows, and follows a line moved to another character
  const ed2=await p.evaluate(async()=>{
   document.querySelectorAll('.screen').forEach(e=>e.classList.remove('on'));$('#s-edit').classList.add('on');
   await editClip(S.clips.find(c=>c.id==='دا انجليزي؟'));await new Promise(r=>setTimeout(r,200));
   const res={chars:ed.band.chars.length,typed:ed.band.texts[0].character===ed.lines[0].character};
   res.height=$('#eband').style.height;return res;
  });
  assert.deepStrictEqual(ed2,{chars:2,typed:true,height:'184px'});
  pass('editing room band uses the same character rows');
  assert.deepStrictEqual(errors,[]);
  console.log('ALL PASS');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
