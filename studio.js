/* Per-line voice effects, the timing meter and the bloopers reel. Loaded after ensemble.js and recovery.js. */

/* ================= voice effects ================= */
// Set per line in the editing room so the dub matches the original (Mushu's echo, a giant's voice...).
const FX = {
  echo: {name: 'صدى', tail: 1.2},
  cave: {name: 'كهف / قاعة كبيرة', tail: 2.4},
  deep: {name: 'صوت ضخم', tail: .9},
  high: {name: 'صوت رفيع كرتوني', tail: 0},
  robot: {name: 'روبوت', tail: 0},
  radio: {name: 'راديو / تلفون', tail: 0},
};
const lineFx = clip => (clip.timed || []).filter(l => FX[l.fx] && Number.isFinite(l.start) && Number.isFinite(l.end) && l.end > l.start);

// pitch without changing speed: two sliding read heads, crossfaded where each one jumps back
function shiftPitch(x, rate, ratio) {
  const W = Math.round(rate * .06), y = new Float32Array(x.length), step = (1 - ratio) / W;
  const read = p => { const i = Math.floor(p), f = p - i; return i < 0 || i + 1 >= x.length ? 0 : x[i] + (x[i + 1] - x[i]) * f; };
  let ph = 0;
  for (let n = 0; n < x.length; n++) {
    ph = ((ph + step) % 1 + 1) % 1;
    const p2 = (ph + .5) % 1;
    // the two heads are not in phase, so the crossfade loses some loudness: make it up
    y[n] = 1.3 * (1 - Math.abs(2 * ph - 1)) * read(n - ph * W) + 1.3 * (1 - Math.abs(2 * p2 - 1)) * read(n - p2 * W);
  }
  return y;
}
async function offline(x, rate, tail, build) {
  const oc = new OfflineAudioContext(1, x.length + Math.ceil(tail * rate), rate);
  const buf = oc.createBuffer(1, x.length, rate); buf.copyToChannel(x, 0);
  const src = oc.createBufferSource(); src.buffer = buf;
  build(oc, src); src.start();
  return (await oc.startRendering()).getChannelData(0);
}
function impulse(oc, seconds) {
  const ir = oc.createBuffer(2, Math.ceil(seconds * oc.sampleRate), oc.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
  return ir;
}
const wire = (oc, ...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); nodes.at(-1).connect(oc.destination); };
const gainOf = (oc, value) => { const g = oc.createGain(); g.gain.value = value; return g; };
const fxProcess = {
  // a heavy voice that is still the dubber's: a little lower, more chest, a hint of size
  deep: (x, rate) => offline(shiftPitch(x, rate, .84), rate, FX.deep.tail, (oc, src) => {
    const chest = oc.createBiquadFilter(), verb = oc.createConvolver();
    chest.type = 'lowshelf'; chest.frequency.value = 220; chest.gain.value = 6;
    verb.buffer = impulse(oc, .9);
    wire(oc, src, chest, gainOf(oc, .85)); wire(oc, src, verb, gainOf(oc, .16));
  }),
  high: (x, rate) => shiftPitch(x, rate, 1.45),
  echo: (x, rate) => offline(x, rate, FX.echo.tail, (oc, src) => {
    const delay = oc.createDelay(1); delay.delayTime.value = .24;
    const feedback = gainOf(oc, .3), wet = gainOf(oc, .3);
    src.connect(oc.destination); src.connect(delay); delay.connect(feedback).connect(delay); delay.connect(wet).connect(oc.destination);
  }),
  cave: (x, rate) => offline(x, rate, FX.cave.tail, (oc, src) => {
    const verb = oc.createConvolver(); verb.buffer = impulse(oc, 2.2);
    wire(oc, src, gainOf(oc, .85)); wire(oc, src, verb, gainOf(oc, .55));
  }),
  robot: (x, rate) => offline(x, rate, 0, (oc, src) => {
    const ring = gainOf(oc, 0), osc = oc.createOscillator(); osc.frequency.value = 50; osc.connect(ring.gain); osc.start();
    wire(oc, src, ring, gainOf(oc, 1.6)); wire(oc, src, gainOf(oc, .2));
  }),
  radio: (x, rate) => offline(x, rate, 0, (oc, src) => {
    const hp = oc.createBiquadFilter(), lp = oc.createBiquadFilter(), mid = oc.createBiquadFilter(), clip = oc.createWaveShaper();
    hp.type = 'highpass'; hp.frequency.value = 450; lp.type = 'lowpass'; lp.frequency.value = 3200;
    mid.type = 'peaking'; mid.frequency.value = 1600; mid.gain.value = 7;
    clip.curve = Float32Array.from({length: 1024}, (_, i) => Math.tanh((i / 511.5 - 1) * 2.5));
    wire(oc, src, hp, lp, mid, clip, gainOf(oc, 1.3));
  }),
};
// buffer is the voice on the video's own timeline; returns a copy with each line's effect applied
async function applyVoiceFx(buffer, clip) {
  const rate = buffer.sampleRate, out = ctx.createBuffer(1, buffer.length, rate), dst = out.getChannelData(0), fade = Math.round(rate * .015);
  dst.set(buffer.getChannelData(0));
  for (const l of lineFx(clip)) {
    // a little past the line, so the last syllable of a late dubber still gets the effect
    const a = Math.max(0, Math.floor((l.start - .05) * rate)), b = Math.min(dst.length, Math.ceil((l.end + .2) * rate));
    if (b - a < fade * 2) continue;
    const y = await fxProcess[l.fx](dst.slice(a, b), rate), L = b - a;
    for (let i = 0; i < Math.min(y.length, dst.length - a); i++) {
      if (i >= L) { dst[a + i] += y[i]; continue; }  // echo and reverb tails ring on after the line
      const k = Math.min(1, i / fade, (L - 1 - i) / fade);
      dst[a + i] = dst[a + i] * (1 - k) + y[i] * k;
    }
  }
  return out;
}
const plainVoiceTrack = voiceTrack;
let fxCache = {key: null, p: null};
voiceTrack = async entry => {
  if (!lineFx(entry.clip).length || !v.duration) return plainVoiceTrack(entry);
  const key = entry.id + ':' + entry.adjust;
  if (fxCache.key !== key) {
    const p = (async () => {
      const raw = await plainVoiceTrack(entry);
      const aligned = await renderTape([{id: entry.id, blob: entry.blob, offset: raw.offset, from: 0, to: Infinity}], v.duration);
      return applyVoiceFx(aligned, entry.clip);
    })();
    fxCache = {key, p}; p.catch(() => { if (fxCache.p === p) fxCache = {key: null, p: null}; });
  }
  return {buf: await fxCache.p, gain: voiceGain, offset: 0};
};

// editing room: one effect menu per line
const beforeFxLines = renderLines;
renderLines = function() {
  beforeFxLines();
  $('#lns').querySelectorAll('.ln').forEach(row => {
    const l = ed.lines[+row.dataset.i], select = document.createElement('select');
    select.className = 'line-character line-fx';
    select.setAttribute('aria-label', 'مؤثر الصوت للسطر ' + (+row.dataset.i + 1));
    select.innerHTML = '<option value="">بدون مؤثر على الصوت</option>' + Object.entries(FX).map(([k, f]) => `<option value="${k}" ${l.fx === k ? 'selected' : ''}>مؤثر: ${f.name}</option>`).join('');
    select.onchange = () => { if (select.value) l.fx = select.value; else delete l.fx; edMark(); };
    row.append(select);
  });
};

/* ================= timing meter ================= */
// Shown to the room only. It never touches the votes.
// a badge on the picture, where the room is already looking
document.querySelector('#monitor .scr').insertAdjacentHTML('beforeend',
  `<div class="timing" id="timingWrap" hidden>
    <span>نسبة دقتك في الدبلجة كانت <bdi dir="ltr"><span class="counter" id="timingPct"></span>%</bdi></span>
    <span id="timingNote" class="note"></span>
    <button class="why" id="timingWhy" aria-expanded="false" aria-controls="timingInfo" aria-label="وش معنى النسبة؟">!</button>
  </div>`);
// the explanation sits just under the picture, which clips anything inside it
$('#monitor').insertAdjacentHTML('beforeend',
  `<p class="timing-info" id="timingInfo" hidden>النسبة تقيس قد إيش صوتك جا داخل المربعات الصفراء على شريط النص، وهي الأوقات اللي تتكلم فيها الشخصية في الكليب الأصلي، وقد إيش عبّيتها بصوتك. الكلام برا الأصفر أو السكوت داخله ينزّلها. ١٠٠٪ يعني توقيتك مطابق للأصلي. هالنسبة للفلة بس وما تدخل في التصويت.</p>`);
const timingInfo = open => { $('#timingInfo').hidden = !open; $('#timingWhy').setAttribute('aria-expanded', open); };
$('#timingWhy').onclick = () => timingInfo($('#timingInfo').hidden);
document.addEventListener('pointerdown', e => { if (!e.target.closest('#timingWrap, #timingInfo')) timingInfo(false); });
async function timingScore(entry) {
  const dur = v.duration;
  const blocks = entry.characters ? assignedIntervals(entry.clip, entry.characters, dur)
    : entry.clip.timed?.length ? assignedIntervals(entry.clip, null, dur) : entry.clip.speech || [];
  if (!blocks.length || !dur) return null;
  const {buf, offset} = await plainVoiceTrack(entry), x = buf.getChannelData(0), rate = buf.sampleRate;
  const hop = .02, n = Math.floor(dur / hop), db = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = Math.floor((k * hop + offset) * rate), b = a + Math.floor(hop * rate);
    let sum = 0, cnt = 0;
    for (let i = Math.max(0, a); i < Math.min(x.length, b); i += 4) { sum += x[i] * x[i]; cnt++; }
    db[k] = cnt ? 10 * Math.log10(sum / cnt + 1e-10) : -100;
  }
  const sorted = [...db].sort((a, b) => a - b), floor = sorted[Math.floor(n * .2)], peak = sorted[Math.floor(n * .98)];
  if (peak < -55) return 0;  // silence
  // someone talking through most of the clip leaves no quiet part to measure the room from
  const thr = peak - floor < 12 ? Math.max(-55, peak - 20) : Math.max(floor + 10, peak - 30);
  const inside = (t, pad) => blocks.some(([a, b]) => t >= a - pad && t <= b + pad);
  let talk = 0, talkIn = 0, block = 0, blockTalk = 0;
  for (let k = 0; k < n; k++) {
    const t = k * hop, on = db[k] > thr;
    if (on) { talk++; if (inside(t, .25)) talkIn++; }
    if (inside(t, 0)) { block++; if (on) blockTalk++; }
  }
  if (!talk || !block) return 0;
  // talking inside the yellow blocks, and filling them
  const P = talkIn / talk, R = Math.min(1, blockTalk / block / .7);
  return Math.round(100 * 2 * P * R / (P + R || 1));
}
// the badge belongs to the result only
const beforeTimingControls = controls;
controls = function(id) { if (id !== 'c-result') { $('#timingWrap').hidden = true; timingInfo(false); } return beforeTimingControls.apply(this, arguments); };
const beforeTimingResult = showResult;
showResult = function() {
  $('#timingWrap').hidden = true;
  const r = beforeTimingResult.apply(this, arguments), entry = S.last;
  if (entry) timingScore(entry).then(score => {
    if (S.last !== entry || score == null) return;
    const el = $('#timingPct'); delete el.dataset.v; el.innerHTML = '';
    counter(el, String(Math.min(100, score)));
    $('#timingNote').textContent = score >= 85 ? 'مضبوط على الشعرة' : score >= 65 ? 'قريب' : 'الصوت طالع برا الأصفر';
    $('#timingWrap').hidden = false;
  }).catch(e => console.warn('Timing meter unavailable', e));
  return r;
};

/* ================= bloopers ================= */
// Every time a dubber stops to fix a mistake, the few seconds before the stop are kept.
function keepBlooper(b) {
  if (RS.role === 'seat') return;
  S.bloopers.push({id: 'blooper-' + crypto.randomUUID(), adjust: 0, score: null, ...b});
  if (S.bloopers.length > 30) S.bloopers.shift();
  if (typeof saveRecovery === 'function') void saveRecovery();
}
$('#reelBtn').insertAdjacentHTML('afterend', '<button class="key" id="bloopersBtn" hidden><svg class="i"><use href="#i-replay"/></svg><span></span></button>');
const beforeBloopersFinal = goFinal;
goFinal = function() {
  beforeBloopersFinal.apply(this, arguments);
  // mark head-to-head takes in the list of the night's takes
  $('#dubList').querySelectorAll('.t').forEach(row => {
    const d = S.dubs[+row.querySelector('button[data-i]')?.dataset.i];
    if (d?.duel) row.querySelector('.b small').textContent += d.duelWin ? ` · فاز بالتحدي +${DUEL_BONUS}` : ' · تحدي';
  });
  $('#bloopersBtn').hidden = !S.bloopers.length;
  $('#bloopersBtn span').textContent = `أخطاء الكواليس (${S.bloopers.length})`;
};
$('#endBtn').onclick = goFinal;
async function playBloopers() {
  const list = [...S.bloopers];
  if (!list.length) return;
  stopAll();
  const my = ++reelId, sl = $('#slate');
  controls('c-reel');
  for (const [i, b] of list.entries()) {
    if (my !== reelId) return;
    S.current = b.clip;
    if (!await enterBooth(b.clip)) continue;
    setWho(b.dubbers);
    sl.innerHTML = `<div class="clap"></div><div class="pl">${i ? 'غلطة ' + (i + 1) : 'أخطاء الكواليس'}</div><div class="tt">${esc(b.clip.title)}</div>
      <div class="tapes" style="justify-content:center">${b.dubbers.map(n => tapeHTML(n)).join('')}</div>`;
    sl.classList.add('on'); beep(520, .05, .2);
    await sleep(i ? 1600 : 2600);
    if (my !== reelId) return;
    sl.classList.remove('on');
    try { await playDub(b, {from: b.from, to: b.to + .3}); } catch (e) { console.warn('Blooper skipped', e); }
    await sleep(500);
  }
  if (my !== reelId) return;
  sl.innerHTML = '<div class="clap"></div><div class="pl">النهاية</div>';
  sl.classList.add('on');
  applause();
}
$('#bloopersBtn').onclick = playBloopers;

/* ================= head-to-head ================= */
// Two players dub the same clip (the same character on multi-character clips), one after the other.
// Each take is voted 1-10 as usual; the higher average gets a bonus on top.
const DUEL_BONUS = 2;
let D = null;
E.duelPick = {a: '', b: '', character: '', clip: null};
$('#manyDevices').insertAdjacentHTML('afterend', '<button class="key" id="duelMode" aria-pressed="false">تحدي: واحد ضد واحد</button>');
$('#soloCasting').insertAdjacentHTML('afterend', `<div class="cast-panel" id="duelPanel" hidden>
  <div class="cast-row"><label for="duelA">المتحدي الأول</label><select id="duelA"></select></div>
  <div class="cast-row"><label for="duelB">المتحدي الثاني</label><select id="duelB"></select></div>
  <div class="cast-row" id="duelCharRow"><label for="duelChar">الشخصية اللي بيدبلجونها</label><select id="duelChar"></select></div>
  <p>كل واحد يسجّل لحاله والثاني ينتظر. الباقين يقيّمون كل دبلجة من ١٠، واللي معدّله أعلى ياخذ +${DUEL_BONUS} فوق تقييمه.</p>
</div>`);
$('#duelMode').onclick = () => { E.mode = 'duel'; renderCasting(); broadcastCast(); };
const beforeDuelCasting = renderCasting;
renderCasting = function() {
  beforeDuelCasting();
  if (!S.current) return;
  const duel = E.mode === 'duel', pick = E.duelPick, chars = charactersOf(S.current);
  $('#duelMode').classList.toggle('sel', duel); $('#duelMode').setAttribute('aria-pressed', duel);
  $('#duelPanel').hidden = !duel;
  if (!duel) return;
  $('#dubChips').hidden = true; $('#castHint').textContent = '';
  if (pick.clip !== S.current.id) { pick.clip = S.current.id; pick.character = chars.length === 1 ? chars[0].id : ''; }
  const options = chosen => '<option value="">اختار لاعب</option>' + S.players.map(p => `<option value="${esc(p.name)}" ${chosen === p.name ? 'selected' : ''}>${esc(p.name)}${p.remote ? ' · عن بعد' : ''}</option>`).join('');
  $('#duelA').innerHTML = options(pick.a); $('#duelB').innerHTML = options(pick.b);
  $('#duelCharRow').hidden = chars.length < 2;
  $('#duelChar').innerHTML = '<option value="">اختار الشخصية</option>' + chars.map(c => `<option value="${esc(c.id)}" ${pick.character === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
};
$('#duelA').onchange = e => { E.duelPick.a = e.target.value; };
$('#duelB').onchange = e => { E.duelPick.b = e.target.value; };
$('#duelChar').onchange = e => { E.duelPick.character = e.target.value; };

function startDuelTurn() {
  const name = D.players[D.index];
  S.dubbers = [name];
  E.session = D.character ? {clip: D.clip, plan: [{name, characters: [D.character]}], index: 0, takes: [], duration: 0} : null;
  if (D.character) $('#hearBg').checked = true;
  E.casting = false; broadcastCast();
  watchOriginal();
  toast(D.index ? `دور ${name}. بعدها نشوف مين أبدع` : `التحدي بدأ! أول واحد ${name}`);
}
const beforeDuelWatch = $('#toWatchBtn').onclick;
$('#toWatchBtn').onclick = function() {
  if (E.mode !== 'duel') return beforeDuelWatch.apply(this, arguments);
  const {a, b, character} = E.duelPick, chars = charactersOf(S.current);
  if (!a || !b) { toast('اختاروا المتحديين'); return; }
  if (a === b) { toast('التحدي يبي لاعبين مختلفين'); return; }
  if (chars.length > 1 && !character) { toast('اختاروا الشخصية اللي بيدبلجونها'); return; }
  if (chars.length > 1 && !castReady()) { toast('حدّد الشخصيات وتوقيت سطورها في غرفة المونتاج أول'); return; }
  D = {clip: S.current, players: [a, b], character: chars.length > 1 ? character : null, index: 0, results: [], keep: false};
  startDuelTurn();
};
// the second player can hear the first take before recording
$('#replayOrigBtn').insertAdjacentHTML('afterend', '<button class="key" id="duelHearBtn" hidden><svg class="i"><use href="#i-play"/></svg><span></span></button>');
const beforeDuelWatchOriginal = watchOriginal;
watchOriginal = async function() {
  const first = D?.index === 1 ? D.results[0] : null;
  $('#duelHearBtn').hidden = !first;
  if (first) $('#duelHearBtn span').textContent = 'اسمع دبلجة ' + first.dubbers[0];
  return beforeDuelWatchOriginal.apply(this, arguments);
};
$('#replayOrigBtn').onclick = watchOriginal;
$('#duelHearBtn').onclick = () => { if (D?.results[0]) playDub(D.results[0]).catch(() => toast('تعذّر تشغيل الدبلجة')); };
// With others in the room, neither duelist votes on either take. When the two duelists are the whole
// room, each votes on the other's take (never on their own), as usual.
const duelOutsiders = () => S.players.filter(p => !D.players.includes(p.name)).map(p => p.name);
const beforeDuelVoters = voters;
voters = function() {
  if (!D || !duelOutsiders().length) return beforeDuelVoters();
  return duelOutsiders();
};
const beforeDuelRemoteVote = openRemoteVote;
openRemoteVote = function() {
  if (!D || !S.last || !duelOutsiders().length) return beforeDuelRemoteVote.apply(this, arguments);
  const real = S.last.dubbers;
  S.last.dubbers = [...new Set([...real, ...D.players])];
  try { return beforeDuelRemoteVote.apply(this, arguments); } finally { S.last.dubbers = real; }
};
const beforeDuelHome = goHome;
goHome = function() { if (D && !D.keep) D = null; return beforeDuelHome.apply(this, arguments); };
const beforeDuelNext = $('#nextBtn').onclick;
$('#nextBtn').onclick = function() {
  const duel = D, entry = S.last;
  if (!duel || !entry) return beforeDuelNext.apply(this, arguments);
  duel.keep = true;
  try { beforeDuelNext.apply(this, arguments); } finally { duel.keep = false; }
  if (!S.dubs.includes(entry)) return;  // still waiting for votes
  entry.duel = true; duel.results.push(entry);
  if (duel.index === 0) { duel.index = 1; startDuelTurn(); } else finishDuel(duel);
};
async function finishDuel(duel) {
  D = null;
  const [a, b] = duel.results;
  const win = S.scored && a.score != null && b.score != null && a.score !== b.score ? (a.score > b.score ? a : b) : null;
  if (win) { const p = player(win.dubbers[0]); if (p) p.score += DUEL_BONUS; win.duelWin = true; save(); }
  show('s-play'); controls('none'); setWho([a.dubbers[0], b.dubbers[0]]);
  const sl = $('#slate'), row = e => `<div class="tt">${tapeHTML(e.dubbers[0])}${e.score != null ? ` <span class="sc">${fmt(e.score)}</span>` : ''}</div>`;
  sl.innerHTML = `<div class="clap"></div><div class="pl">${win ? 'الفايز ' + esc(win.dubbers[0]) : S.scored ? 'تعادل!' : 'خلص التحدي'}</div>${row(a)}${row(b)}${win ? `<div class="sc">+${DUEL_BONUS} نقاط فوق تقييمه</div>` : ''}`;
  sl.classList.add('on');
  if (win) applause(); else beep(660, .1, .2);
  await sleep(5000);
  sl.classList.remove('on');
  goHome();
}

/* ================= reset points ================= */
$('#boardCard').insertAdjacentHTML('beforeend', '<button class="key flat" id="resetPoints" style="margin-top:1rem">صفّر النقاط</button>');
$('#resetPoints').onclick = () => {
  if (!confirm('تصفّر نقاط كل اللاعبين؟')) return;
  S.players.forEach(p => p.score = 0);
  save(); renderBoard(); sendHostPhase('home');
  toast('صفّرنا النقاط');
};

/* ================= going back ================= */
// From watching, reviewing or a finished take, back to choosing characters and players for the
// same clip. The choices made so far stay selected, so only what needs changing is changed.
function backToCasting(loses) {
  if (loses && !confirm('التسجيل اللي ما انحفظ بيروح. ترجعون لاختيار الأدوار؟')) return;
  recCancelled = true; stopAll(); lamp(''); $('#slate').classList.remove('on');
  if (RS.pending) { fire('turn_cancelled', {takeId: RS.pending.takeId, to: RS.pending.peer}); clearPending(); }
  if (RS.vote) { fire('vote_closed', {takeId: RS.vote.takeId, avg: null}); RS.vote = null; }
  E.session = null; D = null; S.last = null; band.assigned = null;
  show('s-spin'); $('#film').hidden = true; $('#pickArea').classList.add('on');
  E.casting = true; renderDubChips(); renderCasting(); broadcastCast();
  if (typeof saveRecovery === 'function') void saveRecovery();
}
$('#castBackBtn').onclick = () => goHome();
$('#watchBackBtn').onclick = () => backToCasting(!!(E.session?.takes.length || D?.results.length));
$('#reviewBackBtn').onclick = () => backToCasting(true);
$('#resultBackBtn').onclick = () => backToCasting(true);

/* ================= watching the original together ================= */
// When the host plays the original, every connected device loads the same clip and all of them
// start together. The host waits for the devices (or presses شغّلوا الحين for a slow one).
let watchSync = null;
async function watchTogether(clip) {
  if (RS.role !== 'host') return true;
  const seats = [...E.peers.values()].filter(id => remote.online(id));
  if (!seats.length) return true;
  const token = playToken, sync = watchSync = {clipId: clip.id, ready: new Set(), now: false};
  fire('watch_prepare', {clipId: clip.id});
  $('#syncWait').hidden = false;
  const started = performance.now();
  while (seats.some(id => !sync.ready.has(id)) && !sync.now && performance.now() - started < 60000) {
    if (token !== playToken || watchSync !== sync) { $('#syncWait').hidden = true; return false; }
    $('#syncWait span').textContent = `ننتظر أجهزة الشباب يحمّلون الكليب… ${sync.ready.size} من ${seats.length}`;
    await sleep(150);
  }
  $('#syncWait').hidden = true;
  if (token !== playToken || watchSync !== sync) return false;
  fire('watch_play', {clipId: clip.id});
  return true;
}
$('#syncNow').onclick = () => { if (watchSync) watchSync.now = true; if (dubShare) dubShare.now = true; };
remote.on('watch_ready', p => { if (RS.role === 'host' && watchSync?.clipId === p.clipId) watchSync.ready.add(p.sender); });
const beforeSyncControls = controls;
controls = function(id) { if (id !== 'c-watch') { watchSync = null; $('#syncWait').hidden = true; } return beforeSyncControls.apply(this, arguments); };

// on a remote player's device
let seatWatch = null;
function stopSeatWatch() {
  if (!seatWatch) return;
  seatWatch = null; stopAll();
  if (!RS.turn) seatWaiting();
}
remote.on('watch_prepare', async p => {
  if (RS.role !== 'seat' || !RS.accepted || p.sender !== RS.host || RS.turn || captureBusy) return;
  const clip = S.clips.find(c => c.id === p.clipId);
  if (!clip) return;
  const watch = seatWatch = {clipId: clip.id, playAt: null};
  stopAll(); S.current = clip;
  if (!await enterBooth(clip) || seatWatch !== watch) return;
  controls('none'); setWho([]); v.muted = false; await seekZero();
  if (seatWatch !== watch) return;
  watch.ready = true;
  fire('watch_ready', {clipId: clip.id, to: RS.host});
  // a device that finished downloading after the others started joins at their position
  if (watch.playAt != null) { await seekTo(Math.min(v.duration - .1, (performance.now() - watch.playAt) / 1000)); v.play().catch(() => {}); }
});
remote.on('watch_play', p => {
  if (RS.role !== 'seat' || p.sender !== RS.host || seatWatch?.clipId !== p.clipId) return;
  seatWatch.playAt = performance.now();
  if (seatWatch.ready) v.play().catch(() => {});
});
// the host moved on from watching: back to the waiting screen (a player whose turn it is goes to their booth)
remote.on('state', p => { if (RS.role === 'seat' && p.sender === RS.host && p.phase !== 'watch') stopSeatWatch(); });
remote.on('your_turn', () => { seatWatch = null; });
v.addEventListener('ended', () => { if (RS.role === 'seat' && seatWatch) stopSeatWatch(); });

/* ================= a finished dub on every device ================= */
// The host sends each finished take to the connected devices, so remote players watch it with the
// room and vote from their own screen (in a head-to-head, before their own turn).
let dubShare = null;
const forgetShare = () => { if (dubShare?.path) remote.remove(dubShare.path).catch(() => {}); dubShare = null; };
async function shareResult(entry) {
  forgetShare();
  if (RS.role !== 'host') return true;
  const seats = [...E.peers.values()].filter(id => remote.online(id));
  if (!seats.length) return true;
  const token = playToken, share = dubShare = {takeId: entry.id, ready: new Set(), now: false};
  const gone = () => token !== playToken || dubShare !== share || S.last !== entry;
  $('#syncWait').hidden = false; $('#syncWait span').textContent = 'نرسل الدبلجة لأجهزة الشباب…';
  try {
    const path = RS.room + '/' + crypto.randomUUID() + '.' + extension(entry.blob.type);
    await remote.upload(path, entry.blob); share.path = path;
    const signedUrl = await remote.sign(path);
    if (gone()) return false;
    fire('dub_prepare', {takeId: entry.id, clipId: entry.clip.id, path, signedUrl, offset: entry.offset, adjust: entry.adjust || 0,
      mime: entry.blob.type, dubbers: entry.dubbers, characters: entry.characters || null});
  } catch (e) {
    console.warn('The dub could not be sent to the other devices', e);
    $('#syncWait').hidden = true;
    return !gone();
  }
  const started = performance.now();
  while (seats.some(id => !share.ready.has(id)) && !share.now && performance.now() - started < 45000) {
    if (gone()) { $('#syncWait').hidden = true; return false; }
    $('#syncWait span').textContent = `ننتظر أجهزة الشباب يجهّزون الدبلجة… ${share.ready.size} من ${seats.length}`;
    await sleep(150);
  }
  $('#syncWait').hidden = true;
  share.live = true;
  return !gone();
}
remote.on('dub_ready', p => { if (RS.role === 'host' && dubShare?.takeId === p.takeId) dubShare.ready.add(p.sender); });
// every playback of the shared dub on the result screen (the first one, عيدها, dragging the band) plays there too
const beforeSharePlay = playDub;
playDub = function(entry, opts = {}) {
  if (RS.role === 'host' && dubShare?.live && dubShare.takeId === entry?.id && entry === S.last && !opts.exportFile && shownControls === 'c-result')
    fire('dub_play', {takeId: entry.id, from: opts.from || 0});
  return beforeSharePlay.apply(this, arguments);
};
const beforeShareHome = goHome;
goHome = function() { forgetShare(); return beforeShareHome.apply(this, arguments); };

// on a remote device
let seatDub = null;
function renderSeatDub() {
  const dub = seatDub; if (!dub?.entry) return;
  show('s-play'); controls('c-seat-dub'); setWho(dub.entry.dubbers);
  $('#seatDubTitle').textContent = 'دبلجة ' + names(dub.entry.dubbers);
  const voting = S.scored && RS.vote?.takeId === dub.takeId;
  $('#seatDubVote').hidden = !voting;
  if (!voting) { $('#seatDubStatus').textContent = dub.entry.dubbers.includes(RS.name) ? 'هذي دبلجتك! الشباب يقيّمونها الحين' : ''; return; }
  $('#seatDubPads').style.setProperty('--c', waxOf(RS.name));
  $('#seatDubPads').innerHTML = Array.from({length: 10}, (_, i) => `<button class="pad" data-score="${i + 1}" ${RS.vote.closed ? 'disabled' : ''}>${i + 1}</button>`).join('');
  $('#seatDubStatus').textContent = RS.vote.closed ? 'تقفل التصويت' : '';
  $('#seatDubPads').onclick = async e => {
    const b = e.target.closest('button'), vote = RS.vote;
    if (!b || !vote || vote.closed || vote.takeId !== dub.takeId) return;
    try {
      await remote.send('vote', {takeId: vote.takeId, score: +b.dataset.score, to: RS.host});
      $('#seatDubPads').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      $('#seatDubStatus').textContent = 'وصل تصويتك';
    } catch { $('#seatDubStatus').textContent = 'ما وصل التصويت. جرّب مرة ثانية'; }
  };
}
function playSeatDub(from) {
  const dub = seatDub; if (!dub?.entry) return;
  playDub(dub.entry, {from: Math.max(0, Math.min(v.duration - .1, from))}).catch(() => {});
}
function stopSeatDub() {
  if (!seatDub) return;
  seatDub = null; stopAll();
  if (!RS.turn && !seatWatch) seatWaiting();
}
remote.on('dub_prepare', async p => {
  if (RS.role !== 'seat' || !RS.accepted || p.sender !== RS.host || captureBusy) return;
  if (RS.turn && RS.turn.takeId !== p.takeId) return;  // busy with their own turn
  const clip = S.clips.find(c => c.id === p.clipId);
  if (!clip || !Number.isFinite(p.offset) || !/^audio\/(webm|mp4|ogg|wav)/.test(p.mime || '')) return;
  const dub = seatDub = {takeId: p.takeId, playAt: null, from: 0};
  seatWatch = null;
  try {
    const r = await fetch(remote.downloadUrl(p.path, p.signedUrl), {signal: AbortSignal.timeout(60000)});
    if (!r.ok) throw new Error('download');
    const blob = new Blob([await r.blob()], {type: p.mime});
    const entry = {id: 'shared-' + p.takeId, clip, dubbers: p.dubbers || [], blob, offset: p.offset, adjust: +p.adjust || 0, characters: p.characters, score: null};
    stopAll(); S.current = clip;
    if (!await enterBooth(clip) || seatDub !== dub) return;
    await getBuffer(entry.id, blob);
    if (seatDub !== dub) return;
    dub.entry = entry; renderSeatDub();
    fire('dub_ready', {takeId: p.takeId, to: RS.host});
    // the host already started: join at its position
    if (dub.playAt != null) playSeatDub(dub.from + (performance.now() - dub.playAt) / 1000);
  } catch (e) { console.warn('Shared dub unavailable', e); if (seatDub === dub) stopSeatDub(); }
});
remote.on('dub_play', p => {
  if (RS.role !== 'seat' || p.sender !== RS.host || seatDub?.takeId !== p.takeId) return;
  if (seatDub.entry) playSeatDub(+p.from || 0);
  else { seatDub.playAt = performance.now(); seatDub.from = +p.from || 0; }
});
$('#seatDubReplay').onclick = () => playSeatDub(0);
// voting opens or closes while the dub is on screen
// (the stock handler registered at start-up shows the waiting screen; this one runs after it)
remote.on('vote_open', p => { if (RS.role === 'seat' && p.sender === RS.host && seatDub?.entry && seatDub.takeId === p.takeId) setTimeout(renderSeatDub, 0); });
remote.on('vote_closed', p => { if (seatDub?.takeId === p.takeId) { $('#seatDubPads').querySelectorAll('button').forEach(b => b.disabled = true); $('#seatDubStatus').textContent = `تقفل التصويت. المعدّل ${p.avg == null ? '—' : fmt(p.avg)}`; } });
// the host moved on: back to waiting, or straight to their own turn
remote.on('state', p => { if (RS.role === 'seat' && p.sender === RS.host && p.phase !== 'result') stopSeatDub(); });
remote.on('your_turn', () => { seatDub = null; });
remote.on('watch_prepare', () => { seatDub = null; });
