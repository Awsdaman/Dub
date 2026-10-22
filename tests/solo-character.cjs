const {chromium}=require('../.test-tools/node_modules/playwright');
const assert=require('assert');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({permissions:['microphone'],viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8765');await p.waitForFunction(()=>S.clips.length&&typeof E!=='undefined');
 await p.locator('#pname').fill('لاعب');await p.locator('#addForm button').click();await p.locator('#startBtn').click();await p.locator('#chooseClipBtn').click();await p.locator('#clipLibrary button').filter({hasText:'سنجاب سنجوبي'}).click();await p.locator('#dubChips button').click();
 assert(await p.locator('#soloCasting').isVisible());assert.equal(await p.locator('#soloCharacter option').count(),4);
 await p.locator('#toWatchBtn').click();assert.equal(await p.evaluate(()=>E.session),null);
 await p.locator('#soloCharacter').selectOption('c1');await p.screenshot({path:'tests/artifacts/solo-desktop.png'});await p.setViewportSize({width:375,height:812});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'tests/artifacts/solo-mobile.png',fullPage:true});
 await p.locator('#toWatchBtn').click();await p.waitForFunction(()=>v.duration>0);assert.deepEqual(await p.evaluate(()=>activeCharacters()),['c1']);assert.deepEqual(await p.evaluate(()=>band.assigned),['c1']);
 await p.locator('#recBtn').click();await p.waitForFunction(()=>S.last?.characters?.length===1,null,{timeout:60000});assert.deepEqual(await p.evaluate(()=>S.last.characters),['c1']);
 const check=await p.evaluate(async()=>{const c=S.last.clip,g=await recordingGuide(c,['c1']),o=await getBuffer('original:'+c.video,url(c.video)),m=await getBuffer(c.bg,url(c.bg)),a=await getBuffer(S.last.id,S.last.blob);const at=(b,t)=>b.getChannelData(0)[Math.floor(t*b.sampleRate)];return {other:Math.abs(at(g,1)-at(o,1)),own:Math.abs(at(g,3)-at(m,3)),silent:at(a,1)};});assert(check.other<1e-5&&check.own<1e-5&&check.silent===0);assert.deepEqual(errors,[]);
 await p.evaluate(()=>goHome());await p.locator('#chooseClipBtn').click();await p.locator('#clipLibrary button').filter({hasText:'سنجاب سنجوبي'}).click();await p.locator('#manyDevices').click();await p.locator('[data-character="c1"]').selectOption('لاعب');await p.locator('#toWatchBtn').click();assert.equal(await p.evaluate(()=>E.session.plan.length),1);assert.deepEqual(await p.evaluate(()=>activeCharacters()),['c1']);
 console.log('PASS: three-character picker; selection required; desktop/mobile fit; solo capture and replay; other original voices retained; music during own lines; mic gated outside own lines; partial multi-device casting; no browser errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
