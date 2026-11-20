// Habit Week — github.com/veraetogrex-portfolio · zero dependencies
// One habit, one week at a time: seven day cells and the current streak.
// Pick a week: the chain of walks grows day by day and a streak tag rides at its head, counting.
// On a missed day there is nothing under the tag: it falls through, and the next walk starts again from 1.

const GOAL = 20;                                  // minutes that count as a walk
const FIRST = [2026, 9, 18];                      // Sun, Oct 18 2026: the day before the first week shown
const LOG = [0,                                   // minutes walked each day from FIRST; 0 = no walk
  26, 31, 0, 24, 35, 42, 28,                      // Oct 19–25
  33, 22, 27, 12, 30, 38, 25,                     // Oct 26 – Nov 1 (Thu: 12 min, under the goal)
  0, 32, 27, 36, 14, 41, 0,                       // Nov 2–8
  34, 28, 31, 25, 38, 0, 31,                      // Nov 9–15, Sunday is today
];
const WEEKS = 4, TODAY = LOG.length - 1;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 120, GAP = 12, PITCH = CELL + GAP, LINK = 60, ODO = 184;   // px: a day, the gap, a link over both corners, the digit window
const DRAIN = 140, FADE = 240, LINK_MS = 90, FILL = 250, STEP = 240, ROLL = 300, RISE = 420;   // ms: a new week starts fast, a seen one cross-fades
const PAUSE = 350, SHOW = 220, HOP = 320, SIT = 150, FALL = 600, DROP = 500;       // ms: a break — the tag rests, steps onto the missed day, greys, falls out

const marks = new Map();                          // day → walked or not, set by clicking a day
const walked = i => marks.has(i) ? marks.get(i) : LOG[i] >= GOAL;
// the streak at the end of every day: one more than yesterday, or 0 after a missed day
const streaks = () => LOG.reduce((s, _, i) => (s.push(walked(i) ? (s[i - 1] || 0) + 1 : 0), s), []);
const dayOf = (w, k) => 1 + w * 7 + k;
const date = i => new Date(FIRST[0], FIRST[1], FIRST[2] + i);

const root  = document.querySelector('#habit');
const weekEl = root.querySelector('.hw-week');
const picker = root.querySelector('.hw-weeks');
const nums  = [...root.querySelectorAll('.hw-n')];
const asof  = root.querySelector('.hw-asof');
root.querySelector('.hw-today').textContent = date(TODAY).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const CHECK = svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>');
const face = () => `<span class="hw-dow"></span><span class="hw-date"></span>`;
// the days are buttons (date, missed edge); the chain and the tag share one layer above
weekEl.innerHTML = DOW.map((_, k) => `<button class="hw-day" style="left:${k * PITCH}px"><span class="hw-base">${face()}</span>
    <span class="hw-hole">${face()}<span class="hw-socket"></span><span class="hw-min"></span></span></button>`).join('')
  + `<div class="hw-walks">${DOW.map((_, k) => `<span class="hw-link" style="left:${k * PITCH - (LINK + GAP) / 2}px;width:${LINK}px"></span>`).join('')}
    ${DOW.map((_, k) => `<span class="hw-fill" style="left:${k * PITCH}px">${face()}<span class="hw-mark">${CHECK}</span><span class="hw-min"></span></span>`).join('')}
    <span class="hw-tag" aria-hidden="true"></span></div>`;
const days  = [...weekEl.querySelectorAll('.hw-day')];
const walks = weekEl.querySelector('.hw-walks');
const links = [...walks.querySelectorAll('.hw-link')];      // links[k] joins day k-1 to day k; links[0] comes in from last week
const fills = [...walks.querySelectorAll('.hw-fill')];
const tagEl = walks.querySelector('.hw-tag');
const holes = days.map(d => d.querySelector('.hw-hole'));
const mins  = holes.map(h => h.querySelector('.hw-min'));
const bases = days.map(d => d.querySelector('.hw-base'));

picker.innerHTML = [...Array(WEEKS)].map(() => `<button class="hw-wk" role="radio"><span class="hw-wk-t"></span><span class="hw-mini"></span></button>`).join('');
const chips = [...picker.children];

let week = 2, anim = 0, settled = 0;             // settled: the id of the last animation that finished
const seen = new Set();                          // a week seen once is switched in one motion the next time
const NO_TAG = { x: 0, y: 0, n: '', o: 0, s: 1, r: 0, lost: false };
let shown = { fill: [], hole: [], link: [], tag: NO_TAG, num: 0 };   // what is on screen right now

const lerp = (a, b, t) => a + (b - a) * t;
const out = t => 1 - Math.pow(1 - t, 3);
const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const span = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// the week as it should look when nothing is moving: the tag stands on Sunday if the streak is alive then
function target(w) {
  const s = streaks(), d = DOW.map((_, k) => walked(dayOf(w, k))), n = s[dayOf(w, 6)];
  return { fill: d.map(v => +v), hole: d.map(v => +!v), link: d.map((v, k) => +(v && (k ? d[k - 1] : walked(dayOf(w, 0) - 1)))),
    tag: n ? { ...NO_TAG, x: 6, n, o: 1 } : NO_TAG, num: n };
}

// texts of one week: dates, minutes, "Today"; a missed day says why
function print(w) {
  DOW.forEach((dow, k) => {
    const i = dayOf(w, k), on = walked(i), min = LOG[i], short = min > 0 && min < GOAL;
    [days[k], fills[k]].forEach(el => {
      el.querySelectorAll('.hw-dow').forEach(e => e.textContent = i === TODAY ? 'Today' : dow);
      el.querySelectorAll('.hw-date').forEach(e => e.textContent = date(i).getDate());
    });
    fills[k].querySelector('.hw-min').textContent = min >= GOAL ? `${min} min` : 'Done';
    holes[k].querySelector('.hw-min').innerHTML = short ? `${min} min` : 'No<br>walk';
    days[k].setAttribute('aria-pressed', on);
    days[k].setAttribute('aria-label', `${DOW[k]}, ${MON[date(i).getMonth()]} ${date(i).getDate()}: ${on ? 'walked' : short ? `${min} min, under the goal` : 'no walk'}`);
  });
  const end = date(dayOf(w, 6));
  asof.textContent = dayOf(w, 6) === TODAY ? 'as of today' : `on Sun, ${MON[end.getMonth()]} ${end.getDate()}`;
}

// the picker: a label and a small copy of each week, consecutive walks drawn as one bar
function paintChips() {
  chips.forEach((c, w) => {
    const a = date(dayOf(w, 0)), b = date(dayOf(w, 6)), on = w === week;
    c.querySelector('.hw-wk-t').textContent = dayOf(w, 6) === TODAY ? 'This week'
      : `${MON[a.getMonth()]} ${a.getDate()}–${a.getMonth() === b.getMonth() ? '' : MON[b.getMonth()] + ' '}${b.getDate()}`;
    let html = '', k = 0;
    while (k < 7) {
      let n = 1; const run = walked(dayOf(w, k));
      if (run) while (k + n < 7 && walked(dayOf(w, k + n))) n++;
      html += `<i class="${run ? 'is-run' : ''}" style="left:${k * 36}px;width:${n * 36 - 6}px"></i>`;
      k += n;
    }
    c.querySelector('.hw-mini').innerHTML = html;
    c.setAttribute('aria-checked', on); c.tabIndex = on ? 0 : -1;
  });
}

// draw one frame of the week; fade dims the chain while an old week leaves
function draw(st) {
  shown = { ...shown, fill: st.fill, hole: st.hole, link: st.link, tag: st.tag };
  walks.style.opacity = st.fade ?? 1;                                            // one layer, so overlaps never show while it fades
  st.fill.forEach((f, k) => {
    fills[k].style.clipPath = `inset(0 ${(1 - f) * 100}% 0 0 round 24px)`;      // a day is covered left to right, the chain's head stays round
    const r = f > .2 ? 0 : 24;                                                   // a link is the head until today's day passes its round end
    const l = st.link[k], from = l < .6 ? 40 : 40 * (1 - span(l, .6, 1));        // it squares yesterday's corners only once it is past the gap
    links[k].style.clipPath = `inset(0 ${(1 - l) * 100}% 0 ${from}% round 0 ${r}px ${r}px 0)`;
    holes[k].style.opacity = st.hole[k];
    mins[k].style.opacity = 1 - .7 * (st.quiet?.[k] || 0);                      // the missed day's words step back while the tag falls through
    bases[k].style.setProperty('--dim', st.dim ?? 1);                            // dates change while they are dimmed
  });
  const g = st.tag;
  tagEl.textContent = g.n;
  tagEl.style.opacity = g.o;
  tagEl.style.transform = `translate(${g.x * PITCH}px, ${g.y}px) rotate(${g.r}deg) scale(${g.s})`;
  tagEl.classList.toggle('is-lost', g.lost);
}

// the streak number: the old value leaves, the new one comes in; up when it grows, down when it drops; '' is blank
function drawNum(from, to, p) {
  if (from === to) p = 1;
  const dir = (to || 0) >= (from || 0) ? 1 : -1, [a, b] = nums;
  a.textContent = from ?? ''; b.textContent = to ?? '';
  a.classList.toggle('is-zero', from === 0); b.classList.toggle('is-zero', to === 0);
  a.style.transform = `translateY(${-dir * ODO * p}px)`; a.style.opacity = 1 - p * p;           // an odometer: one digit pushes the other out
  b.style.transform = `translateY(${dir * ODO * (1 - p)}px)`; b.style.opacity = 1 - (1 - p) * (1 - p);
  shown.num = to;
}
function numAt(t, rolls, fromNum) {   // the number at time t from a list of changes [{ at, to, ms }]
  let j = 0; while (j + 1 < rolls.length && rolls[j + 1].at <= t) j++;
  const r = rolls[j], prev = j ? rolls[j - 1].to : fromNum;
  drawNum(prev, r.to, inOut(span(t, r.at, r.at + (r.ms || ROLL))));
}

// one animation at a time; step gets the elapsed ms
function run(ms, step) {
  const id = ++anim;
  return new Promise(done => {
    const t0 = performance.now();
    const tick = now => {
      if (id !== anim) return done(false);
      const t = Math.min(ms, now - t0); step(t);
      t < ms ? requestAnimationFrame(tick) : done(true);
    };
    requestAnimationFrame(tick);
  });
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const drain = (from, t, ms) => {                               // the old week fades and its chain pulls back a little
  const q = inOut(t / ms);
  draw({ fill: from.fill.map(v => v * (1 - .3 * q)), hole: from.hole.map(v => v * (1 - q)), link: from.link, tag: from.tag, fade: 1 - q,
    dim: Math.abs(1 - 2 * span(t, ms - 100, ms)) });
};

// ── pick a week: the chain grows day by day, the tag rides its head and counts; on a missed day it falls ──
function plan(w) {
  const s = streaks(), first = dayOf(w, 0), carry = walked(first) ? s[first - 1] : 0;
  const grow = [], holeAt = [], quiet = [], tags = [], rolls = [{ at: 0, to: carry || null }];   // blank until the first walk
  let t = DRAIN, cur = carry;
  DOW.forEach((_, k) => {
    const i = first + k;
    if (walked(i)) {
      const joined = k ? walked(i - 1) : carry > 0, ms = (joined ? LINK_MS : 0) + FILL;
      grow[k] = { at: t, ms, link: joined ? LINK_MS / ms : 0 };          // one eased motion: across the gap, then over the day
      tags.push(cur > 0 ? { type: 'move', at: t, ms, from: k - 1, to: k, n: s[i] } : { type: 'pop', at: t + FILL * .45, k, n: s[i] });
      rolls.push({ at: t + ms / 2, to: cur = s[i] });
      t += STEP;
    } else if (cur > 0) {                                     // a break: the tag rests, steps onto the empty day and falls through
      t += PAUSE; holeAt[k] = t;
      const hop = t + SHOW * .8, fall = hop + HOP;
      tags.push({ type: 'hop', at: hop, ms: HOP, from: k - 1, to: k, n: cur }, { type: 'fall', at: fall, ms: SIT + FALL, k, n: cur });
      rolls.push({ at: fall, to: cur = 0, ms: DROP });
      quiet[k] = fall;
      t = fall + SIT + FALL - 150;
    } else { holeAt[k] = t; t += STEP * .6; }
  });
  if (rolls[rolls.length - 1].to === null) rolls.push({ at: t, to: 0 });
  return { grow, holeAt, quiet, tags, rolls, end: Math.max(t + FILL, ...rolls.map(r => r.at + (r.ms || ROLL))) + 40 };
}
function tagAt(t, tags) {
  let e = null; for (const x of tags) if (x.at <= t) e = x;
  if (!e) return NO_TAG;
  const p = span(t, e.at, e.at + (e.ms || 240));
  if (e.type === 'pop') return { ...NO_TAG, x: e.k, n: e.n, o: out(p), s: lerp(.6, 1, out(p)) };
  if (e.type === 'move') { const q = inOut(p); return { ...NO_TAG, x: lerp(e.from, e.to, q), n: q < .5 && e.from >= 0 ? e.n - 1 : e.n, o: e.from < 0 ? q : 1 }; }
  if (e.type === 'hop') { const q = inOut(p); return { ...NO_TAG, x: lerp(e.from, e.to, q), y: -48 * Math.sin(Math.PI * q), n: e.n, o: 1 }; }
  const f = span(t, e.at + SIT, e.at + SIT + FALL);                                   // greyed, it sits in the empty socket, then drops out of the day
  return { ...NO_TAG, x: e.k, y: 260 * f * f, r: 14 * f, n: e.n, o: 1 - span(f, .75, 1), lost: true };
}

async function showWeek(w) {
  if (w === week && anim === settled) return;
  const again = seen.has(w);
  week = w; seen.add(w); paintChips();
  if (reduced()) { print(w); return morph(1); }
  if (again) return swap(w);
  const from = shown, fromNum = shown.num, first = dayOf(w, 0), P = plan(w);
  let printed = false;
  const done = await run(P.end, t => {
    if (t < DRAIN) drain(from, t, DRAIN);
    else {
      if (!printed) { print(w); printed = true; }
      const st = { fill: [], hole: [], link: [], quiet: [], dim: span(t, DRAIN, DRAIN + 100), tag: tagAt(t, P.tags) };
      DOW.forEach((_, k) => {
        const g = P.grow[k], h = g ? inOut(span(t, g.at, g.at + g.ms)) : 0;
        st.link[k] = g && g.link ? span(h, 0, g.link) : 0;
        st.fill[k] = g ? span(h, g.link, 1) : 0;
        st.hole[k] = walked(first + k) ? 0 : out(span(t, P.holeAt[k], P.holeAt[k] + SHOW));
        const qa = P.quiet[k]; if (qa !== undefined) st.quiet[k] = span(t, qa, qa + 120) * (1 - span(t, qa + SIT + FALL, qa + SIT + FALL + 250));
      });
      draw(st);
    }
    numAt(t, P.rolls, fromNum);
  });
  if (done) settled = anim;
}

// a week seen before: the old one fades out, the new one fades in whole, the number rolls once
async function swap(w) {
  const from = shown, fromNum = shown.num, to = target(w);
  let printed = false;
  const done = await run(FADE + RISE, t => {
    if (t < FADE) drain(from, t, FADE);
    else {
      if (!printed) { print(w); printed = true; }
      const q = inOut(span(t, FADE, FADE + RISE));                    // the whole week fades in at once, nothing is counted again
      draw({ fill: to.fill, hole: to.hole.map(v => v * q), link: to.link, fade: q, dim: span(t, FADE, FADE + 120), tag: { ...to.tag, s: lerp(.85, 1, q) } });
    }
    drawNum(fromNum, to.num, inOut(span(t, FADE * .5, FADE + RISE)));
  });
  if (done) settled = anim;
}

// any other change (a day marked or unmarked): every layer moves straight to where it should be
async function morph(ms = 320) {
  const from = shown, to = target(week), fromNum = shown.num;
  const done = await run(ms, t => {
    const q = inOut(t / ms), mix = key => from[key].map((v, k) => lerp(v ?? 0, to[key][k], q));
    draw({ fill: mix('fill'), hole: mix('hole'), link: mix('link'), tag: to.tag.o ? { ...to.tag, o: q } : { ...from.tag, o: from.tag.o * (1 - q) } });
    drawNum(fromNum, to.num, q);
  });
  if (done) settled = anim;
}

function toggle(k) {
  const i = dayOf(week, k);
  marks.set(i, !walked(i));
  print(week); paintChips(); morph();
}

function reset(w = 0) {
  anim++; root.classList.add('is-reset');
  marks.clear(); seen.clear(); week = w; seen.add(week); print(week); paintChips();
  const st = target(week);
  draw(st); drawNum(st.num, st.num, 1); settled = anim;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-reset')));
}

chips.forEach((c, w) => {
  c.addEventListener('click', () => showWeek(w));
  c.addEventListener('pointerdown', () => c.classList.add('is-pressed'));   // the week gives a little under the pointer
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => c.addEventListener(ev, () => c.classList.remove('is-pressed')));
});
days.forEach((d, k) => d.addEventListener('click', () => toggle(k)));
picker.addEventListener('keydown', e => {
  const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!dir) return;
  e.preventDefault(); const w = Math.min(WEEKS - 1, Math.max(0, week + dir)); showWeek(w); chips[w].focus();
});

reset();
root.habit = { reset, week: w => chips[w], day: k => days[k], show: showWeek, shown: () => week };   // for scripted demos
