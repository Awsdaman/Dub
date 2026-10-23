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
    const feedback = gainOf(oc, .3), wet = gainOf(oc, .35);
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
  '<div class="timing" id="timingWrap" hidden>دقة التوقيت <span class="counter" id="timingPct"></span><span id="timingNote" style="font-weight:500"></span></div>');
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
controls = function(id) { if (id !== 'c-result') $('#timingWrap').hidden = true; return beforeTimingControls.apply(this, arguments); };
const beforeTimingResult = showResult;
showResult = function() {
  $('#timingWrap').hidden = true;
  const r = beforeTimingResult.apply(this, arguments), entry = S.last;
  if (entry) timingScore(entry).then(score => {
    if (S.last !== entry || score == null) return;
    const el = $('#timingPct'); delete el.dataset.v; el.innerHTML = '';
    counter(el, pad2(Math.min(99, score)));
    $('#timingNote').textContent = score >= 85 ? ' مضبوط على الشعرة' : score >= 65 ? ' قريب' : ' الصوت طالع برا الأصفر';
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
// neither duelist votes on either take
const beforeDuelVoters = voters;
voters = function() {
  if (!D) return beforeDuelVoters();
  const vs = S.players.filter(p => !D.players.includes(p.name)).map(p => p.name);
  return vs.length ? vs : ['الجمهور'];
};
const beforeDuelRemoteVote = openRemoteVote;
openRemoteVote = function() {
  if (!D || !S.last) return beforeDuelRemoteVote.apply(this, arguments);
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
