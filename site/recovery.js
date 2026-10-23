/* Same-browser recovery. Audio stays on this device; no extra uploads. */
let recoveryPending=null,recoveryQueue=Promise.resolve(),recoveryWarned=false;
const recoveryDB=new Promise((resolve,reject)=>{
 const request=indexedDB.open('dublaj-recordings:'+location.pathname,1);
 request.onupgradeneeded=()=>request.result.createObjectStore('night');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
function recoverySnapshot(){return structuredClone({version:1,players:S.players,scored:S.scored,played:[...S.played],round:S.round,dubs:S.dubs,bloopers:S.bloopers,last:S.last,session:E.session,seat:RS.role==='seat'&&RS.take?{room:RS.room,name:RS.name,turn:RS.turn,take:RS.take}:null});}
function recoveryTransaction(mode,value){return recoveryDB.then(db=>new Promise((resolve,reject)=>{
 const tx=db.transaction('night',mode),store=tx.objectStore('night');const request=mode==='readonly'?store.get('current'):store.put(value,'current');
 tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage aborted'));
}));}
function saveRecovery(){
 if(recoveryPending)return Promise.resolve();
 const snapshot=recoverySnapshot();
 recoveryQueue=recoveryQueue.then(()=>recoveryTransaction('readwrite',snapshot)).catch(e=>{console.error('Recording recovery storage failed',e);if(!recoveryWarned){recoveryWarned=true;toast('تعذّر حفظ نسخة الاسترجاع على هذا الجهاز. نزّل تسجيلك قبل تحديث الصفحة.');}});
 return recoveryQueue;
}
const beforeRecoverySave=save;save=function(){beforeRecoverySave();void saveRecovery();};
const beforeRecoveryResult=showResult;showResult=function(){void saveRecovery();return beforeRecoveryResult();};
$('#startBtn').insertAdjacentHTML('afterend','<div id="recoveryNotice" hidden><p>فيه تسجيلات محفوظة على هذا الجهاز.</p><button class="key" id="restoreRecordings">استرجع التسجيلات</button></div>');
const recoveryReady=recoveryTransaction('readonly').then(data=>{
 if(data?.version===1&&(data.dubs?.length||data.last||data.session?.takes?.length||data.session?.review||data.seat)){recoveryPending=data;$('#recoveryNotice').hidden=false;}
}).catch(e=>console.warn('Recovery unavailable',e));
const beforeRecoveryStart=$('#startBtn').onclick;
$('#startBtn').onclick=async()=>{
 await recoveryReady;
 if(recoveryPending){if(!confirm('تبدأ ليلة جديدة وتمسح نسخة استرجاع التسجيلات السابقة؟'))return;recoveryPending=null;$('#recoveryNotice').hidden=true;await saveRecovery();}
 return beforeRecoveryStart();
};
$('#restoreRecordings').onclick=async()=>{
 const data=recoveryPending;if(!data)return;
 if(data.seat){$('#joinSeatBtn').click();$('#seatRoom').value=data.seat.room;$('#seatName').value=data.seat.name;toast('انضم لنفس الغرفة عشان ترجع ترسل تسجيلك');return;}
 initAudio();await ctx.resume();
 S.players=data.players;S.scored=data.scored;S.played=new Set(data.played);S.round=data.round;S.dubs=data.dubs||[];S.bloopers=data.bloopers||[];S.last=data.last;E.session=data.session;
 recoveryPending=null;$('#recoveryNotice').hidden=true;renderPlayers();renderMode();beforeRecoverySave();
 if(E.session){
   S.current=E.session.clip;
   if(E.session.index>=E.session.plan.length){await enterBooth(S.current);await finishEnsemble();}
   else {
     const turn=E.session.plan[E.session.index];S.dubbers=[turn.name];
     // Remote players need to join a newly opened room after a host refresh.
     if(player(turn.name)?.remote){show('s-setup');toast('رجعت التسجيلات. افتح غرفة جديدة وخَل اللاعبين يرجعون، ثم اضغط كمّل الأدوار.');$('#resumeRecovered').hidden=false;}
     // a take that was waiting for its player's review goes back to the review
     else if(E.session.review){await enterBooth(S.current);showReview(E.session.review);}
     else await watchOriginal();
   }
 }else if(S.last){S.current=S.last.clip;await enterBooth(S.current);showResult();}
 else goHome();
};
$('#recoveryNotice').insertAdjacentHTML('afterend','<button class="key" id="resumeRecovered" hidden>كمّل الأدوار</button>');
$('#resumeRecovered').onclick=async()=>{if(!E.session)return;const turn=E.session.plan[E.session.index];if(player(turn.name)?.remote&&(!E.peers.get(turn.name)||!remote.online(E.peers.get(turn.name)))){toast('اللاعب لسه ما انضم للغرفة الجديدة');return;}$('#resumeRecovered').hidden=true;S.current=E.session.clip;S.dubbers=[turn.name];await watchOriginal();};
const beforeRecoverySeatRecord=seatRecord;
seatRecord=async function(){await beforeRecoverySeatRecord();if(RS.take){recoveryPending=null;await saveRecovery();}};$('#seatRecord').onclick=seatRecord;
const beforeRecoveryTurn=receiveTurn;
receiveTurn=async function(p){await beforeRecoveryTurn(p);await recoveryReady;const seat=recoveryPending?.seat;
 if(seat&&seat.room===RS.room&&seat.name===RS.name&&seat.turn?.takeId===p.takeId){RS.take=seat.take;recoveryPending=null;$('#recoveryNotice').hidden=true;controls('c-seat');$('#seatPreview').hidden=false;$('#seatTakeStatus').textContent='رجع تسجيلك! اسمعه أو أرسله بدون ما تسجّل من جديد';}
};
