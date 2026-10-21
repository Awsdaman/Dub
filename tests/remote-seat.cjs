const {chromium} = require('../.test-tools/node_modules/playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];let seq=0,events=[],presence={},storage=new Map();
const json=(res,x)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');let body=Buffer.alloc(0);for await(const part of req)body=Buffer.concat([body,part]);
 if(u.pathname==='/__test/cursor')return json(res,seq);
 if(u.pathname==='/__test/track'){const d=JSON.parse(body);presence[d.sid]={...d,seen:Date.now()};return json(res,{});}
 if(u.pathname==='/__test/leave'){delete presence[JSON.parse(body).sid];return json(res,{});}
 if(u.pathname==='/__test/poll'){
   const sid=u.searchParams.get('sid'),room=u.searchParams.get('room');if(presence[sid])presence[sid].seen=Date.now();
   const active=Object.fromEntries(Object.entries(presence).filter(([k,p])=>p.room===room&&Date.now()-p.seen<1100).map(([k,p])=>[k,[p.p]]));
   return json(res,{cursor:seq,events:events.filter(e=>e.n>+u.searchParams.get('since')&&e.room===room&&e.sid!==sid),presence:active});
 }
 if(u.pathname==='/__test/send'){events.push({...JSON.parse(body),n:++seq});return json(res,{});}
 if(u.pathname==='/__test/list'){const room=u.searchParams.get('room');return json(res,{data:[...storage.keys()].filter(k=>k.startsWith(room+'/')).map(k=>({id:k,name:k.slice(room.length+1)})),error:null});}
 if(u.pathname==='/__test/remove'){JSON.parse(body).forEach(k=>storage.delete(k));return json(res,{error:null});}
 if(u.pathname.startsWith('/__test/storage/')){const key=u.pathname.slice('/__test/storage/'.length);if(req.method==='POST'){storage.set(key,{body,type:req.headers['content-type']});return json(res,{});}const f=storage.get(key);if(!f){res.statusCode=404;return res.end();}res.setHeader('Content-Type',f.type);return res.end(f.body);}
 let p=path.resolve(root,'.'+decodeURIComponent(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
 if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.statusCode=404;return res.end();}
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.mp4':'video/mp4','.mp3':'audio/mpeg','.jpg':'image/jpeg','.otf':'font/otf'};
 res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.setHeader('Access-Control-Allow-Origin','*');
 const size=fs.statSync(p).size,range=req.headers.range;
 if(range){const m=/bytes=(\d+)-(\d*)/.exec(range);let a=+m[1],b=m[2]?Math.min(+m[2],size-1):size-1;res.writeHead(206,{'Content-Range':`bytes ${a}-${b}/${size}`,'Content-Length':b-a+1});fs.createReadStream(p,{start:a,end:b}).pipe(res);}else{res.setHeader('Content-Length',size);fs.createReadStream(p).pipe(res);}
});
const wait=(p,fn)=>p.waitForFunction(fn,null,{timeout:25000});
const report=(name,extra='')=>{results.push({name,result:'PASS',detail:extra});console.log('PASS '+name+' '+extra);};
(async()=>{
 await new Promise(r=>server.listen(8877,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 async function page(remote=false){
   const ctx=await browser.newContext({viewport:{width:1440,height:1000},permissions:['microphone']});
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
   await p.route('https://test.supabase.co/storage/v1/object/sign/takes/**',r=>{
     const key=new URL(r.request().url()).pathname.split('/takes/')[1],f=storage.get(key);
     return r.fulfill(f?{body:f.body,contentType:f.type}:{status:404,body:''});
   });
   if(remote){await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DUBLAJ={site:false,supabaseUrl:"https://test.supabase.co",supabaseAnonKey:"test"};'}));await p.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({path:path.join(__dirname,'supabase-double.js'),contentType:'application/javascript'}));}
   return p;
 }
 async function load(p,url){await p.goto(url);await wait(p,()=>S.clips.length>0);}
 async function add(p,name){await p.locator('#pname').fill(name);await p.locator('#addForm button').click();}
 async function choose(p,names){await p.evaluate(names=>{S.current=S.clips.find(c=>c.id==='طرزان')||S.clips[0];S.dubbers=names;return watchOriginal();},names);}
 async function capture(p,button){await p.locator(button).click();await wait(p,()=>recorder?.state==='recording');await p.waitForTimeout(700);await p.evaluate(()=>v.currentTime=v.duration-.15);await wait(p,()=>!captureBusy);}
 async function voteLocal(p){await p.locator('#vote .pads').first().locator('[data-s="8"]').click();await p.locator('#nextBtn').click();}
 for(const [label,url] of (process.env.REMOTE_ONLY ? [] : [['local','http://127.0.0.1:8765/'],['export','http://127.0.0.1:8877/site/']])){
   const p=await page();await load(p,url);await add(p,'أحمد');await add(p,'سارة');
   assert.equal(await p.locator('#toEditBtn').isVisible(),label==='local');await p.locator('#startBtn').click();
   await p.getByRole('button',{name:'اختار اللي تحس انك حتبدع فيه',exact:true}).click();
   assert.equal(await p.locator('#clipLibrary button').count(),await p.evaluate(()=>S.clips.length));
   await p.setViewportSize({width:375,height:812});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:path.join(out,label+'-clip-library-mobile.png'),fullPage:true});
   const chosenTitle=await p.locator('#clipLibrary button > span').first().textContent();
   await p.locator('#clipLibrary button').first().click();assert.equal(await p.locator('#pickTitle').textContent(),chosenTitle);
   assert.equal(await p.locator('#film').isVisible(),false);
   await p.locator('#dubChips button').first().click();await p.locator('#toWatchBtn').click();await wait(p,()=>!v.paused);
   await p.evaluate(()=>goHome());await p.locator('#chooseClipBtn').click();await p.locator('#libraryBack').click();
   await p.setViewportSize({width:1440,height:1000});
   report(label+' clip library selection, playback, mobile layout and return');
   await p.locator('#spinBtn').click();await p.locator('#pickArea.on').waitFor();assert(await p.locator('#film').isVisible());
   await p.locator('#dubChips button').first().click();await p.locator('#toWatchBtn').click();
   await capture(p,'#recBtn');await wait(p,()=>!!S.last);assert((await p.evaluate(()=>S.last.blob.size))>0);
   await voteLocal(p);assert.equal(await p.evaluate(()=>S.dubs.length),1);await p.locator('#endBtn').click();await p.locator('#reelBtn').click();await wait(p,()=>!v.paused);
   report(label+' full round, voting, final and reel','Synthetic microphone; recording shortened by seeking near end.');await p.context().close();
 }
 const host=await page(true),seat=await page(true);await load(host,'http://127.0.0.1:8877/');await load(seat,'http://127.0.0.1:8877/');
 await add(host,'أحمد');await add(host,'سارة');await host.locator('#remoteSetup').waitFor({state:'visible'});await host.locator('#remoteToggle').check();await host.locator('#remoteName').fill('عوس');await host.locator('#hostConnect').click();await wait(host,()=>RS.role==='host'&&S.players.some(p=>p.remote));
 const room=await host.locator('#roomCode').textContent();await seat.locator('#joinSeatBtn').click();await seat.locator('#seatRoom').fill(room);await seat.locator('#seatName').fill('خطأ');await seat.locator('#seatJoinKey').click();await wait(seat,()=>document.querySelector('#seatNotice').textContent.includes('مو مسجّل'));report('Unknown remote name rejected');
 await seat.locator('#seatName').fill('عوس');await seat.locator('#seatJoinKey').click();await wait(seat,()=>RS.accepted);await wait(host,()=>remote.online(RS.peer));report('Remote join and presence');
 await host.evaluate(()=>{S.dubbers=['أحمد'];renderDubChips();});
 await host.locator('#dubChips button').filter({hasText:'عوس'}).evaluate(b=>b.click());assert.deepEqual(await host.evaluate(()=>S.dubbers),['عوس']);
 await host.locator('#dubChips button').filter({hasText:'سارة'}).evaluate(b=>b.click());assert.deepEqual(await host.evaluate(()=>S.dubbers),['سارة']);report('Remote/local mixed selection stays solo');
 await host.screenshot({path:path.join(out,'host-setup.png')});await seat.screenshot({path:path.join(out,'seat-wait.png')});
 await host.locator('#startBtn').click();await host.locator('#s-home.on').waitFor();await choose(host,['عوس']);await host.locator('#recBtn').click();await seat.locator('#seatRecord').waitFor({state:'visible'});
 await seat.screenshot({path:path.join(out,'seat-turn.png')});
 await seat.setViewportSize({width:375,height:812});await seat.screenshot({path:path.join(out,'seat-mobile.png')});assert(await seat.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await seat.setViewportSize({width:1440,height:1000});await capture(seat,'#seatRecord');await wait(seat,()=>!!RS.take);await seat.route('**/__test/storage/**',r=>r.request().method()==='POST'?r.fulfill({status:503,body:'test upload failure'}):r.continue());
 await seat.locator('#seatSend').click();await host.locator('#remoteRecovery').waitFor({state:'visible'});assert(await seat.evaluate(()=>!!RS.take));
 await seat.unroute('**/__test/storage/**');await seat.locator('#seatSend').click();await wait(host,()=>!!S.last);report('Upload failure keeps take and resend succeeds');await wait(host,()=>!v.paused);assert.equal(await host.evaluate(()=>S.last.dubbers[0]),'عوس');
 assert((await host.evaluate(()=>S.last.blob.size))>0);report('Remote record, preview, upload, host decode/playback');await voteLocal(host);
 await choose(host,['أحمد']);await capture(host,'#recBtn');await seat.locator('#seatPads button').first().waitFor({state:'visible'});await seat.locator('#seatPads [data-score="9"]').click();await wait(host,()=>votes['عوس']===9);await host.locator('#vote .pads').filter({has:host.locator('[data-s="9"].on')}).locator('[data-s="7"]').click();await seat.locator('#seatPads [data-score="10"]').click();await seat.waitForTimeout(250);assert.equal(await host.evaluate(()=>votes['عوس']),7);report('Host manual vote override wins');await host.locator('#nextBtn').click();await wait(seat,()=>RS.vote.closed);report('Local take with remote vote and vote close');

 // Reconnection while previewing must not overwrite an unsent take.

 await choose(host,['عوس']);await host.locator('#recBtn').click();await wait(seat,()=>!!RS.turn);const id=await seat.evaluate(()=>RS.turn.takeId);
 await seat.reload();await wait(seat,()=>S.clips.length>0);await seat.locator('#joinSeatBtn').click();await seat.waitForTimeout(1300);await seat.locator('#seatJoinKey').click();await wait(seat,()=>RS.accepted&&RS.turn);assert.equal(await seat.evaluate(()=>RS.turn.takeId),id);report('Seat reload/rejoin resumes pending take');
 await seat.context().close();await host.waitForTimeout(1400);await wait(host,()=>!remote.online(RS.peer));
 // Exercise the actual timer by requesting a short test deadline, without sleeping for a long movie.
 if(process.env.REAL_TIMEOUT) await host.waitForFunction(()=>RS.pending?.failed,null,{timeout:180000}); else await host.evaluate(()=>{clearTimeout(RS.pending.timer);RS.pending.timer=setTimeout(()=>failRemoteTurn('انتهى وقت الانتظار'),150);});
 await host.locator('#remoteRecovery').waitFor({state:'visible'});await host.locator('#remoteRetry').click();await host.locator('#remoteRecovery').waitFor({state:'visible'});assert.notEqual(await host.evaluate(()=>RS.pending.takeId),id);await host.locator('#remoteSkip').click();assert.equal(await host.evaluate(()=>RS.pending),null);report('Seat disconnect, timeout recovery and skip',process.env.REAL_TIMEOUT?'Actual clip duration + 90 seconds elapsed.':'Deadline accelerated to 150 ms; uses production timeout recovery.');
 await host.locator('#endBtn').click();host.once('dialog',d=>d.accept());await host.locator('#clearRemoteTakes').click();await host.waitForTimeout(400);assert.equal(storage.size,0);report('Night recording cleanup');
 await host.setViewportSize({width:375,height:812});await host.screenshot({path:path.join(out,'mobile.png')});
 await host.context().close();
 const missing=await page();await missing.route('**/config.js',r=>r.fulfill({status:404,body:''}));await load(missing,'http://127.0.0.1:8877/');assert(!(await missing.locator('#remoteSetup').isVisible()));assert(await missing.locator('#toEditBtn').isVisible());report('Missing config preserves local game');await missing.context().close();
 const offline=await page();await offline.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DUBLAJ={supabaseUrl:"https://test.supabase.co",supabaseAnonKey:"test"};'}));await offline.route('https://cdn.jsdelivr.net/**',r=>r.abort());await load(offline,'http://127.0.0.1:8877/');assert(!(await offline.locator('#remoteSetup').isVisible()));report('Unavailable SDK hides remote UI without breaking local setup');await offline.context().close();
 await browser.close();assert.deepEqual(errors,[]);report('No browser JavaScript errors');
})().catch(e=>{results.push({name:'run',result:'FAIL',detail:e.stack});console.error(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,process.env.REAL_TIMEOUT?'real-timeout-results.json':process.env.REMOTE_ONLY?'remote-final-results.json':'results.json'),JSON.stringify(results,null,2));server.close();setTimeout(()=>process.exit(process.exitCode||0),500);});






