const {chromium}=require('../.test-tools/node_modules/playwright');
const fs=require('fs'),assert=require('assert');
const base=process.env.GAME_URL||'http://127.0.0.1:8765/site/';
const results=[]; const pass=n=>{results.push(n);console.log('PASS '+n);};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 try{
 const hc=await browser.newContext({permissions:['microphone']}),sc=await browser.newContext({permissions:['microphone']});
 const host=await hc.newPage(),seat=await sc.newPage();
 const errors=[];for(const p of [host,seat])p.on('pageerror',e=>errors.push(e.message));
 for(const p of [host,seat])p.on('response',async r=>{if(r.status()>=400&&r.url().includes('supabase.co'))console.log('HTTP',r.status(),new URL(r.url()).pathname,await r.text());});
 await Promise.all([host.goto(base),seat.goto(base)]);
 for(const name of ['أحمد','سارة']){await host.locator('#pname').fill(name);await host.locator('#addForm button').click();}
 await host.locator('#remoteToggle').check();await host.locator('#remoteName').fill('عوس');await host.locator('#hostConnect').click();
 await host.waitForFunction(()=>RS.role==='host'&&S.players.some(p=>p.remote));
 const room=await host.locator('#roomCode').textContent();
 await seat.locator('#joinSeatBtn').click();await seat.locator('#seatRoom').fill(room);await seat.locator('#seatName').fill('عوس');await seat.locator('#seatJoinKey').click();
 await seat.waitForFunction(()=>RS.accepted);await host.waitForFunction(()=>remote.online(RS.peer));pass('Real Supabase anonymous sessions, room join and presence');
 const fixture=await seat.evaluate(async()=>{
   const c=supabase.createClient(DUBLAJ.supabaseUrl,DUBLAJ.supabaseAnonKey),{data}=await c.auth.getSession();
   const path=data.session.user.id+'/TEST/'+crypto.randomUUID()+'.webm';
   const r=await c.storage.from('takes').upload(path,new Blob(['synthetic test fixture'],{type:'audio/webm'}));if(r.error)throw r.error;
   return {path,publicUrl:c.storage.from('takes').getPublicUrl(path).data.publicUrl};
 });
 assert((await host.request.get(fixture.publicUrl)).ok());
 const outsider=await host.evaluate(async path=>{
   const c=supabase.createClient(DUBLAJ.supabaseUrl,DUBLAJ.supabaseAnonKey);
   const signed=await c.storage.from('takes').createSignedUrl(path,60),del=await c.storage.from('takes').remove([path]);
   const put=await c.storage.from('takes').upload(path+'other',new Blob(['test'],{type:'audio/webm'}));
   return {signDenied:!!signed.error,deleteCount:del.data?.length||0,uploadDenied:!!put.error};
 },fixture.path);
 assert(outsider.signDenied&&outsider.uploadDenied&&outsider.deleteCount===0);assert((await host.request.get(fixture.publicUrl)).ok());
 await seat.evaluate(async path=>{const c=supabase.createClient(DUBLAJ.supabaseUrl,DUBLAJ.supabaseAnonKey);const {error}=await c.storage.from('takes').remove([path]);if(error)throw error;},fixture.path);
 pass('Public viewing works; another player cannot upload into, sign, or delete owner files');
 await host.locator('#startBtn').click();await host.locator('#chooseClipBtn').click();await host.locator('#clipLibrary button').filter({hasText:'طرزان'}).click();// remote players are cast per character on the many-devices panel
 await host.locator('#manyDevices').click();await host.locator('[data-character="c1"]').selectOption('عوس');await host.locator('#toWatchBtn').click();await host.locator('#recBtn').click();
 await seat.locator('#seatRecord').click();await seat.waitForFunction(()=>!!RS.take,null,{timeout:60000});
 const bytes=await seat.evaluate(()=>RS.take.blob.size);assert(bytes>1000);
 await seat.locator('#seatSend').click();await host.waitForFunction(()=>S.last?.dubbers[0]==='عوس',null,{timeout:60000});assert(await host.evaluate(()=>S.last.blob.size)>1000);await host.waitForFunction(()=>!v.paused);pass('Full-duration remote recording, real upload, signed download and host playback');
 await seat.waitForFunction(()=>RS.upload===null);pass('Owner automatically removes received recording');
 await host.locator('#vote .pads').first().locator('[data-s="8"]').click();await host.locator('#nextBtn').click();
 await host.evaluate(()=>{S.current=S.clips.find(c=>c.id==='طرزان');S.dubbers=['أحمد'];return watchOriginal();});await host.locator('#recBtn').click();await host.waitForFunction(()=>!!S.last&&S.last.dubbers[0]==='أحمد',null,{timeout:60000});
 await seat.locator('#seatPads [data-score="9"]').click();await host.waitForFunction(()=>votes['عوس']===9);pass('Real remote vote on local recording');
 await host.locator('#nextBtn').click();await seat.waitForFunction(()=>RS.vote.closed);
 await host.locator('#endBtn').click();await seat.waitForFunction(()=>document.querySelector('#seatNotice').textContent.includes('قفلنا'));pass('End-of-night event delivered');
 assert.deepEqual(errors,[]);pass('No browser JavaScript errors');
 await host.screenshot({path:'tests/artifacts/live-host.png'});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.writeFileSync('tests/artifacts/live-results.json',JSON.stringify({url:base,results,success:!process.exitCode},null,2)));
