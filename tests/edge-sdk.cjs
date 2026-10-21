const {chromium}=require('../.test-tools/node_modules/playwright');const fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const c=await b.newContext({permissions:['microphone']});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8765/');await p.waitForFunction(()=>S.clips.length>0);
 for(const name of ['أحمد','سارة']){await p.locator('#pname').fill(name);await p.locator('#addForm button').click();}
 await p.locator('#startBtn').click();await p.locator('#s-home.on').waitFor();
 await p.evaluate(()=>{S.current=S.clips.find(c=>c.id==='طرزان');S.dubbers=['أحمد'];return watchOriginal();});
 await p.locator('#recBtn').click();await p.waitForFunction(()=>!!S.last,null,{timeout:40000});
 const recording=await p.evaluate(async()=>({size:S.last.blob.size,offset:S.last.offset,duration:(await getBuffer(S.last.id,S.last.blob)).duration,video:v.duration,mime:S.last.blob.type}));
 assert(recording.duration>=recording.video);assert(Math.abs(recording.offset)<1);assert(recording.size>100);
 await p.locator('#vote [data-s="8"]').click();await p.locator('#nextBtn').click();assert.equal(await p.evaluate(()=>S.players[0].score),8);
 // Check the actual pinned SDK distribution loads, without opening a project or using credentials.
 await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DUBLAJ={site:false,supabaseUrl:"https://example.supabase.co",supabaseAnonKey:"public-test-key"};'}));
 await p.reload();await p.waitForFunction(()=>window.supabase?.createClient,null,{timeout:20000});assert(await p.locator('#remoteSetup').isVisible());
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'artifacts','edge-sdk.json'),JSON.stringify({result:'PASS',recording,SDK:'Actual pinned CDN 2.118.0 loaded',notes:'Synthetic mic; full clip recorded without seeking; local HTTP only'},null,2));console.log('PASS Edge full capture/playback/vote and actual pinned SDK loading',recording);await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

