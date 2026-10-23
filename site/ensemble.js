/* Character casting and sequential ensemble recording. No framework or server required. */
const E={mode:'shared',assign:{},peers:new Map(),session:null,seatCharacters:null,casting:false,revision:0};
E.soloCharacter='';
const charactersOf=c=>c.characters?.length?c.characters:Array.from({length:c.voices||1},(_,i)=>({id:'c'+(i+1),name:'شخصية '+(i+1)}));
const lineCharacters=l=>Array.isArray(l.characters)?l.characters:l.character?[l.character]:[];
function activeCharacters(){return RS.role==='seat'?E.seatCharacters:E.session?.plan[E.session.index]?.characters||null;}
function assignedIntervals(clip,ids,duration){
  const chars=charactersOf(clip),lines=(clip.timed||[]).filter(l=>Number.isFinite(l.start)&&Number.isFinite(l.end)&&l.end>l.start);
  if(lines.length)return lines.filter(l=>!ids||(lineCharacters(l).length?lineCharacters(l):chars.length===1?[chars[0].id]:[]).some(id=>ids.includes(id))).map(l=>[l.start,l.end]);
  return ids?[]:[[0,duration]];
}
async function recordingGuide(clip,ids){
  initAudio();
  const original=await getBuffer('original:'+clip.video,url(clip.video));
  const music=clip.bg?await getBuffer(clip.bg,url(clip.bg)):null;
  const ranges=assignedIntervals(clip,ids,original.duration);
  const result=ctx.createBuffer(original.numberOfChannels,original.length,original.sampleRate);
  for(let ch=0;ch<result.numberOfChannels;ch++){
    const dst=result.getChannelData(ch),src=original.getChannelData(ch);dst.set(src);
    const bg=music?.getChannelData(Math.min(ch,music.numberOfChannels-1));
    for(const [start,end] of ranges){
      const a=Math.max(0,Math.floor(start*result.sampleRate)),b=Math.min(dst.length,Math.ceil(end*result.sampleRate));
      for(let i=a;i<b;i++)dst[i]=bg?.[Math.floor(i*(music.sampleRate/result.sampleRate))]||0;
    }
  }
  return result;
}
function wavBlob(buffer){
  const channels=buffer.numberOfChannels,n=buffer.length,bytes=new ArrayBuffer(44+n*channels*2),d=new DataView(bytes);
  const str=(p,s)=>[...s].forEach((x,i)=>d.setUint8(p+i,x.charCodeAt(0)));
  str(0,'RIFF');d.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,channels,true);d.setUint32(24,buffer.sampleRate,true);d.setUint32(28,buffer.sampleRate*channels*2,true);d.setUint16(32,channels*2,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,n*channels*2,true);
  const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
  for(let i=0;i<n;i++)for(let c=0;c<channels;c++)d.setInt16(44+(i*channels+c)*2,Math.round(Math.max(-1,Math.min(1,data[c][i]))*32767),true);
  return new Blob([bytes],{type:'audio/wav'});
}
async function combineTakes(session){
  const rate=ctx.sampleRate,duration=session.duration,mix=ctx.createBuffer(1,Math.ceil(duration*rate),rate),dst=mix.getChannelData(0);
  for(const take of session.takes){
    const audio=await getBuffer(take.id,take.blob),ranges=[];
    for(const [a,b] of assignedIntervals(session.clip,take.characters,duration).sort((a,b)=>a[0]-b[0])){
      if(ranges.length&&a<=ranges[ranges.length-1][1])ranges[ranges.length-1][1]=Math.max(b,ranges[ranges.length-1][1]);else ranges.push([a,b]);
    }
    const channels=Array.from({length:audio.numberOfChannels},(_,c)=>audio.getChannelData(c));
    for(const [a,b] of ranges)for(let i=Math.max(0,Math.ceil(a*rate));i<Math.min(dst.length,Math.ceil(b*rate));i++){
      if(i%131072===0)await new Promise(r=>setTimeout(r,0));
      const t=i/rate;
      const j=Math.floor((t+take.offset)*audio.sampleRate);if(j<0||j>=audio.length)continue;
      let x=0;for(const channel of channels)x+=channel[j];
      dst[i]+=x/audio.numberOfChannels;
    }
    bufCache.delete(take.id);
  }
  let peak=1;for(const x of dst)peak=Math.max(peak,Math.abs(x));if(peak>1)for(let i=0;i<dst.length;i++)dst[i]/=peak;
  return {id:session.clip.id+'-ensemble-'+Date.now(),clip:session.clip,dubbers:session.plan.map(p=>p.name),characters:session.plan.flatMap(p=>p.characters),blob:wavBlob(mix),offset:0,adjust:0,score:null};
}

const ensembleStyle=document.createElement('style');ensembleStyle.textContent=`
.cast-panel{margin:1.3rem auto;max-width:42rem;text-align:start}.cast-row{display:flex;align-items:center;gap:1rem;margin:.7rem 0;flex-wrap:wrap}.cast-row label{flex:1;min-width:8rem}.cast-row select,.character-name,.line-character{font:inherit;color:var(--ink);background:var(--key,#2c2a27);border:1px solid var(--ink-dim);border-radius:4px;padding:.55rem;max-width:100%}.cast-row select{min-width:12rem}.character-name{width:12rem}.line-character{grid-column:2/-1}.record-queue{margin:1rem 0;line-height:1.8}.device-options{display:flex;justify-content:center;gap:.7rem;flex-wrap:wrap}.device-options .sel{outline:2px solid var(--go,#f2c21a)}
`;document.head.append(ensembleStyle);
$('#dubChips').insertAdjacentHTML('beforebegin','<div class="cast-panel"><p>بتسجّلون من جهاز واحد ولا عدة أجهزة؟</p><div class="device-options"><button class="key sel" id="sharedDevice" aria-pressed="true">جهاز واحد</button><button class="key" id="manyDevices" aria-pressed="false">عدة أجهزة — واحد ورا الثاني</button></div><div id="castRows" hidden></div><p id="castHint" role="status"></p></div>');
$('#seatBoard').insertAdjacentHTML('beforebegin','<div class="cast-panel" id="seatCasting" hidden><h3>اختار شخصيتك</h3><div id="seatCastRows"></div><p id="seatCastHint" role="status"></p></div>');
$('#pickTitle').insertAdjacentHTML('afterend','<div class="record-queue" id="recordQueue" role="status"></div>');
$('#remoteName').placeholder='أسماء اللاعبين، افصل بينهم بفاصلة';
$('#remoteNameWrap').firstChild.textContent='أسماء اللاعبين البعيدين (اختياري)';
$('#remoteSetup h2').textContent='لاعبين من بعيد';
$('#remoteName').maxLength=200;
$('#hearBgWrap').lastChild.textContent=' اسمعوا الموسيقى والكلام خارج سطوركم (بالسماعة)';
$('#seatHearBg').parentElement.lastChild.textContent=' اسمع الموسيقى والكلام خارج سطورك (بالسماعة)';
$('#dubChips').insertAdjacentHTML('afterend','<div class="cast-panel" id="soloCasting" hidden><div class="cast-row"><label for="soloCharacter">اختار الشخصية اللي بتدبلجها</label><select id="soloCharacter"></select></div><p>سجّل سطور شخصيتك، وباقي الشخصيات تسمعها بأصواتها الأصلية. وقت تداخل الكلام مع سطورك تسمع الموسيقى والمؤثرات بس.</p></div>');
function renderSoloCasting(){
  const chars=S.current?charactersOf(S.current):[];
  $('#soloCasting').hidden=E.mode!=='shared'||S.dubbers.length!==1||chars.length<2;
  $('#soloCharacter').innerHTML='<option value="">اختار شخصيتك</option>'+chars.map(c=>`<option value="${esc(c.id)}" ${E.soloCharacter===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
}
$('#soloCharacter').onchange=e=>{E.soloCharacter=e.target.value;};

function castReady(){
  const chars=charactersOf(S.current),timed=S.current.timed||[];
  return timed.length>0&&timed.every(l=>l.end>l.start&&(chars.length===1||(lineCharacters(l).length&&lineCharacters(l).every(id=>chars.some(c=>c.id===id)))))&&chars.every(c=>timed.some(l=>lineCharacters(l).includes(c.id)||chars.length===1));
}
function renderCasting(){
  if(!S.current)return;
  renderSoloCasting();
  $('#sharedDevice').classList.toggle('sel',E.mode==='shared');$('#manyDevices').classList.toggle('sel',E.mode==='multi');
  $('#sharedDevice').setAttribute('aria-pressed',E.mode==='shared');$('#manyDevices').setAttribute('aria-pressed',E.mode==='multi');
  $('#castRows').hidden=E.mode!=='multi';$('#dubChips').hidden=E.mode==='multi';
  $('#castRows').innerHTML=charactersOf(S.current).map((c,i)=>`<div class="cast-row"><label for="cast-${i}">${esc(c.name)}</label><select id="cast-${i}" data-character="${esc(c.id)}"><option value="">الصوت الأصلي</option>${S.players.map(p=>`<option value="${esc(p.name)}" ${E.assign[c.id]===p.name?'selected':''}>${esc(p.name)}${p.remote?' · عن بعد':''}</option>`).join('')}</select></div>`).join('');
  $('#castRows').querySelectorAll('select').forEach(el=>el.onchange=()=>{E.assign[el.dataset.character]=el.value;broadcastCast();});
  $('#castHint').textContent=E.mode==='multi'&&!castReady()?'هذا الكليب يحتاج توقيت السطور وتحديد شخصية كل سطر في غرفة المونتاج المحلية.':E.mode==='multi'?'اختاروا الشخصيات اللي بتدبلجونها. الباقي يبقى بصوته الأصلي، واللي بعيد يقدر يختار من جهازه.':'';
}
function broadcastCast(){
  if(RS.role==='host')fire('casting',{clipId:S.current?.id,characters:S.current?charactersOf(S.current):[],assign:E.assign,open:E.casting&&E.mode==='multi',revision:++E.revision});
}
const oldSelectClip=selectClip;
selectClip=function(c){E.session=null;E.assign={};E.soloCharacter='';E.casting=true;oldSelectClip(c);$('#recordQueue').textContent='';renderCasting();broadcastCast();};
for(const [id,mode] of [['sharedDevice','shared'],['manyDevices','multi']])$('#'+id).onclick=()=>{E.mode=mode;renderCasting();broadcastCast();};
renderDubChips=function(){
  renderSoloCasting();
  $('#dubChips').innerHTML=S.players.filter(p=>!p.remote).map(p=>`<button class="tape pick ${S.dubbers.includes(p.name)?'sel':''}" style="--c:var(--wax-${p.color})" data-name="${esc(p.name)}" aria-pressed="${S.dubbers.includes(p.name)}">${esc(p.name)}</button>`).join('');
  $('#dubChips').querySelectorAll('button').forEach(b=>b.onclick=()=>{const n=b.dataset.name;S.dubbers=S.dubbers.includes(n)?S.dubbers.filter(x=>x!==n):[...S.dubbers,n];renderDubChips();});
};
$('#toWatchBtn').onclick=()=>{
  if(E.mode==='multi'){
    if(!castReady()){toast('حدّد الشخصيات وتوقيت سطورها في غرفة المونتاج أول');return;}
    const chars=charactersOf(S.current).filter(c=>player(E.assign[c.id]));if(!chars.length){toast('اختار لاعب لشخصية واحدة على الأقل');return;}
    const plan=[];for(const c of chars){const n=E.assign[c.id];let p=plan.find(p=>p.name===n);if(!p){p={name:n,characters:[]};plan.push(p);}p.characters.push(c.id);}
    E.session={clip:S.current,plan,index:0,takes:[],duration:0};S.dubbers=[plan[0].name];
  }else if(!S.dubbers.length){toast('اختاروا مين بيدبلج');return;}
  else if(S.dubbers.length===1&&charactersOf(S.current).length>1){
    if(!E.soloCharacter){toast('اختار الشخصية اللي بتدبلجها أول');return;}
    if(!castReady()){toast('حدّد الشخصيات وتوقيت سطورها في غرفة المونتاج أول');return;}
    E.session={clip:S.current,plan:[{name:S.dubbers[0],characters:[E.soloCharacter]}],index:0,takes:[],duration:0};
    $('#hearBg').checked=true;
  }else E.session=null;
  E.casting=false;broadcastCast();watchOriginal();
};
const oldWatch=watchOriginal;
watchOriginal=async function(){await oldWatch();band.assigned=activeCharacters();if(E.session){const t=E.session.plan[E.session.index];$('#recBtn').innerHTML=icon('rec')+' دور '+esc(t.name);setWho([t.name]);toast('شخصياتك: '+charactersOf(S.current).filter(c=>t.characters.includes(c.id)).map(c=>c.name).join('، '));}};
async function acceptEnsembleTake(take){
  const session=E.session;if(!session)return;
  if(session.index>=session.plan.length)return finishEnsemble();
  const turn=session.plan[session.index];session.takes.push({...take,characters:turn.characters});session.index++;
  if(typeof saveRecovery==='function')await saveRecovery();
  if(session.index===session.plan.length){await finishEnsemble();return;}
  S.dubbers=[session.plan[session.index].name];await watchOriginal();toast('انحفظ الدور. الحين دور '+S.dubbers[0]);
}
// Several players on one device: each one listens to their take and can fix it before passing on.
function showReview(entry){
  const session=E.session;if(!session)return;
  session.review=entry;
  const next=session.plan[session.index+1];
  controls('c-review');setWho(entry.dubbers);band.assigned=entry.characters;band.clock=()=>v.currentTime;
  $('#reviewWho').textContent=`اسمع دورك يا ${entry.dubbers[0]}. إذا فيه جزء تبي تعيده، اسحب الشريط له واضغط سجّل من هنا`;
  $('#reviewNext span').textContent=next?'تمام، دور '+next.name:'تمام، اجمع الأصوات';
  if(typeof saveRecovery==='function')void saveRecovery();
  playDub(entry).catch(()=>{});
}
async function reviewCapture(fromHere){
  const session=E.session,entry=session?.review;if(!entry||captureBusy)return;
  const at=v.currentTime;tape.keep=true;
  try{
    const take=await captureTake(entry.clip,{hearBg:$('#hearBg').checked,characters:entry.characters,...(fromHere?{base:basePass(entry),from:at}:{})});
    bufCache.delete(entry.id);if(E.session!==session)return;
    showReview({...entry,id:entry.clip.id+'-'+Date.now(),...take});
  }catch(e){if(E.session!==session)return;if(e.name!=='AbortError')toast('ما ضبط التسجيل. رجعنا لتسجيلك السابق');showReview(entry);}
  finally{tape.keep=false;}
}
$('#reviewListen').onclick=()=>{if(E.session?.review)playDub(E.session.review).catch(()=>{});};
$('#reviewPunch').onclick=()=>reviewCapture(true);
$('#reviewRedo').onclick=()=>reviewCapture(false);
$('#reviewNext').onclick=async()=>{const entry=E.session?.review;if(!entry)return;stopAll();delete E.session.review;await acceptEnsembleTake(entry);};
async function finishEnsemble(){
  if(E.mixing)return;
  const session=E.session;if(!session||session.index<session.plan.length)return;
  E.mixing=true;
  try{toast('نجهّز تسجيلك للتشغيل…');const result=await combineTakes(session);if(E.session!==session)return;S.last=result;E.session=null;showResult();}
  catch(e){console.error('Audio mixing failed',e);controls('c-watch');$('#recBtn').innerHTML=icon('replay')+' أعد تجهيز التسجيل';toast('التسجيلات موجودة. اضغط أعد تجهيز التسجيل بدون ما تسجّل من جديد.');}
  finally{E.mixing=false;}
}
record=async function(){
  if(captureBusy)return;
  if(E.session&&E.session.index>=E.session.plan.length)return finishEnsemble();
  if(RS.vote){fire('vote_closed',{takeId:RS.vote.takeId,avg:null});RS.vote=null;}
  if(E.session)E.session.duration=v.duration;
  if(remoteDubber())return requestRemoteTurn();
  sendHostPhase('recording');
  try{const take=await captureTake(S.current,{hearBg:$('#hearBg').checked});
    const entry={id:S.current.id+'-'+Date.now(),clip:S.current,dubbers:[...S.dubbers],...take,adjust:0,score:null};
    if(E.session)await(E.session.plan.length>1?showReview({...entry,characters:E.session.plan[E.session.index].characters}):acceptEnsembleTake(entry));else{S.last=entry;showResult();}
  }catch(e){if(e.name!=='AbortError'){toast('تعذّر التسجيل أو تحميل الصوت. جرّب مرة ثانية');controls('c-watch');}}
};$('#recBtn').onclick=record;
const oldGoHome=goHome;goHome=function(){E.session=null;E.casting=false;band.assigned=null;broadcastCast();oldGoHome();};
$('#redoBtn').onclick=()=>{if(S.last.characters&&S.last.dubbers.length===1){E.session={clip:S.last.clip,plan:[{name:S.last.dubbers[0],characters:[...S.last.characters]}],index:0,takes:[],duration:0};S.dubbers=[...S.last.dubbers];record();}else if(S.last.characters){toast('وزّعوا الأدوار من جديد لإعادة الدبلجة الجماعية');goHome();$('#chooseClipBtn').click();}else record();};

// Each player has an independent peer identity; only the active take has a deadline.
function peerFor(name){return E.peers.get(name);}
function personFor(sender){return S.players.find(p=>p.remote&&peerFor(p.name)===sender);}
sendHostPhase=function(phase){if(RS.role!=='host')return;RS.phase=phase;RS.revision++;fire('state',{phase,round:S.round,players:S.players.map(({name,color,score,dubs})=>({name,color,score,dubs})),clipTitle:S.current?.title||'',takeId:S.last?.id||RS.pending?.takeId||null,revision:RS.revision});};
connectHost=async function(){
  $('#hostConnect').disabled=true;
  try{
    RS.role='host';RS.room=[...crypto.getRandomValues(new Uint8Array(4))].map(x=>ROOM_ALPHABET[x%ROOM_ALPHABET.length]).join('');RS.peer=null;RS.ended=false;RS.phase='home';E.peers.clear();
    await remote.open(RS.room,'host');
    for(const name of $('#remoteName').value.split(/[,،\n]/).map(n=>n.trim()).filter(Boolean))addRemotePerson(name);
    $('#roomRail').hidden=false;$('#roomCode').textContent=RS.room;$('#hostRemoteNote').textContent=`كود الغرفة ${RS.room}. كل لاعب يفتح الرابط وينضم باسمه.`;renderPlayers();
  }catch{await disableRemote();toast('ما قدرنا نفتح الغرفة. جرّب مرة ثانية');}
};$('#hostConnect').onclick=connectHost;
function addRemotePerson(name){let p=player(name);if(!p){p={name,color:S.players.length%WAX,score:0,dubs:0};S.players.push(p);}p.remote=true;return p;}
remote.replace('hello',p=>{
  if(RS.role!=='host'||typeof p.name!=='string'||!p.name.trim()||p.name.length>40)return;
  let person=player(p.name);
  if(person&&!person.remote){fire('welcome',{error:'occupied',to:p.sender});return;}
  const old=peerFor(p.name);if(old&&old!==p.sender&&remote.online(old)){fire('welcome',{error:'occupied',to:p.sender});return;}
  const changed=!person||old!==p.sender;
  if(!person)person=addRemotePerson(p.name);E.peers.set(p.name,p.sender);
  if(RS.pending?.name===p.name){RS.pending.peer=p.sender;RS.peer=p.sender;RS.name=p.name;}
  fire('welcome',{name:person.name,color:person.color,scored:S.scored,to:p.sender});sendHostPhase(RS.phase);
  if(changed){renderPlayers();if(E.casting){renderCasting();broadcastCast();}}
  if(RS.ended){fire('ended',{to:p.sender});return;}
  if(RS.pending?.name===p.name&&!RS.pending.failed)fire('your_turn',{takeId:RS.pending.takeId,clipId:RS.pending.clip.id,characters:RS.pending.characters,to:p.sender});
  if(RS.vote&&!RS.vote.dubbers.includes(p.name))fire('vote_open',{takeId:RS.vote.takeId,dubbers:RS.vote.dubbers,to:p.sender});
});
remote.on('claim_character',p=>{const person=personFor(p.sender);if(!person||!E.casting||E.mode!=='multi'||p.clipId!==S.current?.id||!charactersOf(S.current).some(c=>c.id===p.character))return;
  if(!E.assign[p.character]||E.assign[p.character]===person.name)E.assign[p.character]=E.assign[p.character]?'':person.name;
  renderCasting();broadcastCast();
});
remote.on('casting',p=>{
  if(RS.role!=='seat'||p.sender!==RS.host||!RS.accepted)return;
  $('#seatCasting').hidden=!p.open;if(!p.open)return;
  $('#seatCastRows').innerHTML=p.characters.map(c=>`<div class="cast-row"><span>${esc(c.name)}${p.assign[c.id]?' — '+esc(p.assign[c.id]):''}</span><button class="key" data-char="${esc(c.id)}" ${p.assign[c.id]&&p.assign[c.id]!==RS.name?'disabled':''}>${p.assign[c.id]===RS.name?'اترك الشخصية':'اختارها'}</button></div>`).join('');
  $('#seatCastRows').querySelectorAll('button').forEach(b=>b.onclick=()=>fire('claim_character',{clipId:p.clipId,character:b.dataset.char,to:RS.host}));
});
requestRemoteTurn=async function(){
  const person=remoteDubber();if(!person)return;
  if(RS.pending)fire('turn_cancelled',{takeId:RS.pending.takeId,to:RS.pending.peer});
  clearPending();stopAll();RS.vote=null;S.last=null;
  if(!await enterBooth(S.current))return;
  if(E.session)E.session.duration=v.duration;
  const peer=peerFor(person.name);RS.peer=peer;RS.name=person.name;
  RS.pending={takeId:S.current.id+'-'+crypto.randomUUID(),clip:S.current,name:person.name,peer,characters:activeCharacters(),failed:false};
  controls('c-remote');$('#remoteRecovery').hidden=true;$('#remoteCancel').hidden=false;$('#remoteStatus').textContent='بانتظار '+person.name;sendHostPhase('recording');lamp('on blink');
  RS.pending.timer=setTimeout(()=>failRemoteTurn('طوّل التسجيل. أعد الطلب أو تخطّ الدور'),(v.duration+90)*1000);
  if(!peer||!remote.online(peer)){failRemoteTurn(person.name+' مو متصل');return;}
  try{await remote.send('your_turn',{takeId:RS.pending.takeId,clipId:S.current.id,characters:RS.pending.characters,to:peer});}catch{failRemoteTurn('ما وصل الطلب. جرّب مرة ثانية');}
};$('#remoteRetry').onclick=requestRemoteTurn;
remote.replace('your_turn',async p=>{if(RS.role!=='seat'||p.sender!==RS.host)return;E.seatCharacters=p.characters||null;await receiveTurn(p);});
const oldSeatBooth=showSeatBooth;
showSeatBooth=async function(){await oldSeatBooth();band.assigned=E.seatCharacters;if(RS.turn&&E.seatCharacters)$('#seatTakeStatus').textContent='شخصياتك: '+charactersOf(S.current).filter(c=>E.seatCharacters.includes(c.id)).map(c=>c.name).join('، ')+' — سجّل سطورك، والباقي تسمعه من الأصلي';};
$('#seatResume').onclick=showSeatBooth;
const oldShowResult=showResult;showResult=function(){band.assigned=null;oldShowResult();};
remote.replace('take_ready',async p=>{
  const pending=RS.pending;if(RS.role!=='host'||!pending||p.sender!==pending.peer||p.takeId!==pending.takeId||pending.loading)return;
  if(!Number.isFinite(p.offset)||Math.abs(p.offset)>10||!/^audio\/(webm|mp4|ogg|wav)/.test(p.mime||''))return;
  pending.loading=true;
  try{
    const r=await fetch(remote.downloadUrl(p.path,p.signedUrl),{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('download');const bytes=await r.blob();if(!bytes.size||bytes.size>50*1024*1024)throw Error('size');
    const blob=new Blob([bytes],{type:p.mime});await getBuffer(p.takeId,blob);if(RS.pending!==pending)return;
    fire('take_received',{takeId:p.takeId,path:p.path,to:p.sender});clearPending();lamp('');$('#slate').classList.remove('on');
    const entry={id:p.takeId,clip:pending.clip,dubbers:[pending.name],blob,offset:p.offset,adjust:0,score:null};
    if(E.session)await acceptEnsembleTake(entry);else{S.last=entry;showResult();}
  }catch{if(RS.pending===pending){pending.loading=false;failRemoteTurn('تعذّر تحميل التسجيل. أعد الإرسال');}}
});
const oldSeatRecord=seatRecord;
seatRecord=async function(){await oldSeatRecord();if(RS.take)RS.take.characters=E.seatCharacters;};$('#seatRecord').onclick=seatRecord;
openRemoteVote=function(){
  if(RS.role!=='host'||!S.scored)return;
  RS.vote={takeId:S.last.id,dubbers:[...S.last.dubbers],overrides:new Set()};
  for(const p of S.players.filter(p=>p.remote&&!S.last.dubbers.includes(p.name)))fire('vote_open',{takeId:RS.vote.takeId,dubbers:RS.vote.dubbers,to:peerFor(p.name)});
  decorateRemoteVote();
};
decorateRemoteVote=function(){
  if(!RS.vote)return;
  for(const row of $('#vote').querySelectorAll('.pads')){
    if(!player(row.dataset.n)?.remote)continue;const name=row.dataset.n;
    const note=document.createElement('span');note.textContent='بانتظار تصويته…';row.before(note);
    const override=document.createElement('button');override.className='key flat';override.textContent='صوّت بداله';row.after(override);row.hidden=true;
    override.onclick=()=>{row.hidden=false;override.hidden=true;};const handler=row.onclick;
    row.onclick=e=>{handler(e);if(e.target.closest('button')){RS.vote.overrides.add(name);note.textContent='تصويت من الاستوديو';}};
  }
};
remote.replace('vote',p=>{
  const person=personFor(p.sender);if(!person||!RS.vote||RS.vote.dubbers.includes(person.name)||RS.vote.overrides.has(person.name)||p.takeId!==RS.vote.takeId||!Number.isInteger(p.score)||p.score<1||p.score>10)return;
  votes[person.name]=p.score;const row=[...$('#vote').querySelectorAll('.pads')].find(x=>x.dataset.n===person.name);
  if(row){row.hidden=false;row.previousElementSibling.textContent='وصل تصويته';row.nextElementSibling.hidden=true;row.querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.s===p.score));}updateAvg();
});
endRemoteNight=function(){if(RS.role!=='host')return;if(RS.pending)fire('turn_cancelled',{takeId:RS.pending.takeId,to:RS.pending.peer});clearPending();E.session=null;E.casting=false;broadcastCast();RS.vote=null;RS.ended=true;fire('ended',{});$('#clearRemoteTakes').hidden=false;};
$('#clearRemoteTakes').onclick=async()=>{if(!confirm('تمسح التسجيلات المرفوعة لهالغرفة؟'))return;try{await remote.clear();await remote.send('clear_takes',{});toast('طلبنا مسح التسجيلات من اللاعبين المتصلين');}catch{toast('تعذّر المسح. تأكد من الاتصال');}};

// Local editor: character names and explicit per-subtitle assignment.
$('#lns').insertAdjacentHTML('beforebegin','<div class="cast-panel"><h3>الشخصيات</h3><div id="editCharacters"></div><button class="key flat" id="addCharacter">أضف شخصية</button><p>اختار شخصية كل سطر. التوقيت المتداخل يظهر في مسار إضافي تلقائيًا.</p></div>');
const oldOpenClip=editClip;
editClip=async function(c){ed.characters=charactersOf(c).map(c=>({...c}));await oldOpenClip(c);if(ed.characters.length===1)ed.lines.forEach(l=>{l.character=ed.characters[0].id;if(l.characters)l.characters=[l.character];});renderCharacters();renderLines();};
function renderCharacters(){
  $('#editCharacters').innerHTML=ed.characters.map((c,i)=>`<div class="cast-row"><label>شخصية ${i+1} <input class="character-name" data-index="${i}" value="${esc(c.name)}" aria-label="اسم الشخصية ${i+1}"></label><button class="key flat" data-remove="${i}" ${ed.characters.length===1?'disabled':''}>احذف الشخصية</button></div>`).join('');
  $('#editCharacters').querySelectorAll('input').forEach(el=>el.onchange=()=>{const name=el.value.trim();if(!name){el.value=ed.characters[+el.dataset.index].name;return;}ed.characters[+el.dataset.index].name=name;edMark();renderLines();});
  $('#editCharacters').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const c=ed.characters[+b.dataset.remove];if(ed.lines.some(l=>lineCharacters(l).includes(c.id))){toast('غيّر شخصية السطور المرتبطة فيها أول');return;}ed.characters.splice(+b.dataset.remove,1);edMark();renderCharacters();renderLines();});
}
$('#addCharacter').onclick=()=>{if(ed.characters.length>=12){toast('الحد ١٢ شخصية');return;}ed.characters.push({id:'c-'+crypto.randomUUID(),name:'شخصية '+(ed.characters.length+1)});edMark();renderCharacters();renderLines();};
const oldRenderLines=renderLines;
renderLines=function(){oldRenderLines();if(!ed.characters)return;
  $('#lns').querySelectorAll('.ln').forEach(row=>{
    const i=+row.dataset.i,l=ed.lines[i],ids=lineCharacters(l);
    const selects=[0,1].map(slot=>{
      const select=document.createElement('select');select.className='line-character';
      select.setAttribute('aria-label',(slot?'الشخصية الثانية للسطر ':'الشخصية الأولى للسطر ')+(i+1));
      select.innerHTML=`<option value="">${slot?'بدون شخصية ثانية':'اختار الشخصية'}</option>`+ed.characters.map(c=>`<option value="${esc(c.id)}" ${ids[slot]===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
      row.append(select);return select;
    });
    const update=()=>selects.forEach((s,k)=>[...s.options].forEach(o=>o.disabled=!!o.value&&o.value===selects[1-k].value));
    selects.forEach(s=>s.onchange=()=>{l.characters=selects.map(s=>s.value).filter(Boolean);l.character=l.characters[0]||'';update();edMark();});update();
  });
};
$('#seatHearBg').checked=true;
$('#backHomeBtn').onclick=goHome;
remote.replace('take_received',async p=>{
  if(RS.role!=='seat'||p.sender!==RS.host||p.path!==RS.upload?.path)return;
  await remote.remove(p.path);
  if(RS.turn?.takeId===p.takeId){RS.upload=null;RS.turn=null;RS.take=null;$('#seatResume').hidden=true;seatWaiting('وصل دورك! بانتظار باقي الدبلجة');}
});
