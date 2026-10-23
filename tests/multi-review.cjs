// Several players on one device: each player reviews their own take (listen, re-record a part, redo)
// before the next player's turn, and a refresh during the review brings it back.
const {chromium}=require('../.test-tools/node_modules/playwright'),assert=require('assert');
const base=process.env.GAME_URL||'http://127.0.0.1:8765/';
const pass=n=>console.log('PASS '+n);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const errors=[];
 try{
 const c=await b.newContext({permissions:['microphone'],viewport:{width:1400,height:900}});
 const mic=()=>{getMic=async()=>{if(micStream)return micStream;initAudio();const o=ctx.createOscillator(),g=ctx.createGain(),d=ctx.createMediaStreamDestination();o.frequency.value=220;g.gain.value=.3;o.connect(g).connect(d);o.start();window.__mic=g;return micStream=d.stream;};};
 const open=async()=>{const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(base);await p.waitForFunction(()=>S.clips.length&&typeof showReview==='function'&&typeof saveRecovery==='function');await p.evaluate(mic);return p;};
 const waitFor=(p,fn,arg,timeout=90000)=>p.waitForFunction(fn,arg,{timeout,polling:100});
 const rms=(p,a,z,src='S.last')=>p.evaluate(([a,z,src])=>(async()=>{const e=eval(src),buf=await ctx.decodeAudioData(await e.blob.arrayBuffer()),x=buf.getChannelData(0),r=buf.sampleRate,o=e.offset||0;let s=0;const A=Math.floor((a+o)*r),Z=Math.floor((z+o)*r);for(let i=A;i<Z;i++)s+=x[i]*x[i];return Math.sqrt(s/(Z-A));})(),[a,z,src]);
 let p=await open();
 for(const n of ['سارة','خالد']){await p.locator('#pname').fill(n);await p.locator('#addForm button').click();}
 await p.locator('#startBtn').click();await p.locator('#chooseClipBtn').click();await p.locator('#clipLibrary button').filter({hasText:'موشو'}).click();
 await p.locator('#manyDevices').click();
 const sel=p.locator('#castRows select');await sel.nth(0).selectOption('سارة');await sel.nth(1).selectOption('خالد');
 await p.locator('#toWatchBtn').click();await waitFor(p,()=>shownControls==='c-watch');
 await p.locator('#recBtn').click();
 await waitFor(p,()=>shownControls==='c-review'&&E.session.review);
 assert.equal(await p.evaluate(()=>E.session.index),0);
 assert((await p.locator('#reviewNext').textContent()).includes('خالد'));
 await waitFor(p,()=>!v.paused&&playing.length>=2);
 pass('First player gets a review step after their take, with playback, before the next player');

 await p.evaluate(()=>{stopAll();v.currentTime=4;});await p.evaluate(()=>window.__mic.gain.value=.6);
 await p.locator('#reviewPunch').click();
 await waitFor(p,()=>tape.live&&!$('#pauseRecBtn').disabled&&v.currentTime>=5.5);
 await p.locator('#pauseRecBtn').click();await waitFor(p,()=>!!tape.menu);await p.locator('#tapeDone').click();
 await waitFor(p,()=>shownControls==='c-review'&&E.session.review.mime==='audio/wav');
 const [r1,r2]=await Promise.all([rms(p,2,3,'E.session.review'),rms(p,4.3,5.3,'E.session.review')]);
 assert(Math.abs(r2/r1-2)<.3,`review re-record ${r1} ${r2}`);
 pass('Re-record from here inside the review replaces only that part');

 // refresh during the review: the take waits for its player again
 await p.close();p=await open();
 await waitFor(p,()=>!$('#recoveryNotice').hidden,null,15000);await p.locator('#restoreRecordings').click();
 await waitFor(p,()=>shownControls==='c-review'&&E.session?.review);
 assert.equal(await p.evaluate(()=>E.session.review.dubbers[0]),'سارة');
 pass('A take waiting for review survives a refresh and returns to the review');

 await p.locator('#reviewNext').click();
 await waitFor(p,()=>shownControls==='c-watch'&&S.dubbers[0]==='خالد');
 await p.locator('#recBtn').click();
 await waitFor(p,()=>shownControls==='c-review'&&E.session.index===1);
 assert((await p.locator('#reviewNext').textContent()).includes('اجمع'));
 await p.locator('#reviewNext').click();
 await waitFor(p,()=>shownControls==='c-result');
 assert.deepEqual(await p.evaluate(()=>S.last.dubbers),['سارة','خالد']);
 const [m1,m2]=await Promise.all([rms(p,2,3),rms(p,4.3,5.3)]);
 assert(Math.abs(m2/m1-2)<.3,`mix lost the re-recorded part ${m1} ${m2}`);
 pass('Second player reviews too; the final mix keeps the first player\'s re-recorded part');
 // one player does every part of a multi-character clip
 await p.locator('#vote .pads button[data-s="7"]').first().click();await p.locator('#nextBtn').click();
 await p.locator('#chooseClipBtn').click();await p.locator('#clipLibrary button').filter({hasText:'موشو'}).click();
 await p.locator('#sharedDevice').click();await p.locator('#dubChips button').filter({hasText:'سارة'}).click();
 await p.locator('#soloCharacter').selectOption('*');await p.locator('#toWatchBtn').click();
 await waitFor(p,()=>shownControls==='c-watch'&&!E.session);
 await p.locator('#recBtn').click();await waitFor(p,()=>shownControls==='c-result');
 const all=await p.evaluate(()=>({dubbers:S.last.dubbers,characters:S.last.characters||null,punch:!$('#punchBtn').hidden}));
 assert.deepEqual(all,{dubbers:['سارة'],characters:null,punch:true});
 const [a1,a2]=await Promise.all([rms(p,2,3),rms(p,19,21)]);  // a Mushu line and a Mulan line, both in the one take
 assert(a1>.1&&a2>.1,`one take should cover every character ${a1} ${a2}`);
 pass('One player can take every character of a multi-character clip in a single take');
 assert.deepEqual(errors,[]);pass('No page errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
