const {chromium}=require('../.test-tools/node_modules/playwright'),assert=require('assert'),fs=require('fs');
const url='https://dub-ashen-ten.vercel.app/';
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 try{
 const hc=await b.newContext({permissions:['microphone']}),sc=await b.newContext({permissions:['microphone']});
 const h=await hc.newPage(),s=await sc.newPage();await Promise.all([h.goto(url),s.goto(url)]);
 await h.screenshot({path:'tests/artifacts/public-game.png',fullPage:true});
 await h.locator('#pname').fill('المضيف');await h.locator('#addForm button').click();await h.locator('#remoteToggle').check();await h.locator('#remoteName').fill('البعيد');await h.locator('#hostConnect').click();await h.waitForFunction(()=>S.players.some(p=>p.remote));
 await s.locator('#joinSeatBtn').click();await s.locator('#seatRoom').fill(await h.locator('#roomCode').textContent());await s.locator('#seatName').fill('البعيد');await s.locator('#seatJoinKey').click();await s.waitForFunction(()=>RS.accepted);
 await h.locator('#startBtn').click();await h.locator('#chooseClipBtn').click();await h.locator('#clipLibrary button').filter({hasText:'طرزان'}).click();await h.locator('#dubChips button').filter({hasText:'البعيد'}).click();await h.locator('#toWatchBtn').click();await h.locator('#recBtn').click();await s.waitForFunction(()=>!!RS.turn);const id=await s.evaluate(()=>RS.turn.takeId);
 await s.reload();await s.locator('#joinSeatBtn').click();await h.waitForFunction(()=>!remote.online(RS.peer));await s.locator('#seatJoinKey').click();await s.waitForFunction(()=>RS.accepted&&RS.turn);assert.equal(await s.evaluate(()=>RS.turn.takeId),id);console.log('PASS live reload/rejoin resumes pending turn');
 await sc.close();await h.waitForFunction(()=>!remote.online(RS.peer));
 await h.waitForFunction(()=>RS.pending?.failed,null,{timeout:180000});await h.locator('#remoteRetry').click();await h.locator('#remoteRecovery').waitFor();assert.notEqual(await h.evaluate(()=>RS.pending.takeId),id);await h.locator('#remoteSkip').click();assert.equal(await h.evaluate(()=>RS.pending),null);
 console.log('PASS live disconnection, actual clip+90-second timeout, retry and skip');
 fs.writeFileSync('tests/artifacts/live-recovery-results.json',JSON.stringify({url,reconnect:'PASS',realTimeoutRetrySkip:'PASS',secondPhysicalDevice:false},null,2));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
