/* Bounded, elapsed-time actor roulette and prominent production-budget display. */
const gf152ScheduleBefore = gf78SpinSchedule;
gf78SpinSchedule = function(labels, final) {
  const original = gf152ScheduleBefore(labels, final);
  if (labels.length <= 5 || original.total <= 3500) return original;
  const total = 3500;
  const delays = original.delays.map(ms => Math.round(ms * total / original.total));
  delays[delays.length - 1] += total - delays.reduce((sum, ms) => sum + ms, 0);
  return {...original, delays, total};
};

const gf152SpinBefore = gf21Spin;
gf21Spin = function(p, screen, id, labels, final, done) {
  if (screen !== 'draft') return gf152SpinBefore(p, screen, id, labels, final, done);
  const started = performance.now(), schedule = gf78SpinSchedule(labels, final);
  const boundaries = [];
  let cumulative = 0, shown = -1;
  for (const gap of schedule.delays) boundaries.push(cumulative += gap);
  spinning = true;
  render();
  function tick() {
    if (view !== screen || db?.draft !== p) { spinning = false; rouletteInterval = null; return; }
    const elapsed = Math.max(0, performance.now() - started);
    if (elapsed >= schedule.total) {
      rouletteInterval = null;
      spinning = false;
      done(); save(); render();
      return;
    }
    let step = 0;
    while (step < schedule.count && elapsed >= boundaries[step]) step++;
    if (step !== shown) {
      const el = $(id), last = step === schedule.count;
      if (el) {
        gf27SetSpinLabel(el, last ? final : labels[step % labels.length]);
        el.classList.remove('rolling');
        el.classList.add('gf21-ticking');
        el.classList.toggle('gf43-landed', last);
      }
      shown = step;
    }
    // Absolute elapsed time avoids adding each late browser callback to the next delay.
    const next = step === schedule.count ? schedule.total : boundaries[step];
    rouletteInterval = setTimeout(tick, Math.max(1, Math.ceil(next - (performance.now() - started))));
  }
  tick();
};

function gf152Money(value) { return '$' + Number(value).toFixed(1) + 'M'; }
function gf152Budget(p) {
  if (!p || !Number.isFinite(p.budget)) return '';
  const used = (p.cast || []).reduce((sum, actor) => sum + (Number(actor.fee) || 0), 0);
  const left = p.budget - used, ratio = Math.max(0, Math.min(100, used / Math.max(1, p.budget) * 100));
  const selected = p.selected ? ACTORS.find(actor => actor.id === p.selected) : null;
  const preview = selected ? '<p class="gf152-budget-preview">선택 배우 출연료 <b>' + gf152Money(selected.fee) + '</b><span>캐스팅 후 잔여 <b>' + gf152Money(left - selected.fee) + '</b></span></p>' : '';
  return '<section class="gf152-budget' + (left <= p.budget * .2 ? ' is-low' : '') + '" aria-label="제작비 현황">' +
    '<div class="gf152-budget-top"><div><small>배정 제작비</small><strong>' + gf152Money(p.budget) + '</strong></div><div class="gf152-budget-left"><small>남은 제작비</small><strong>' + gf152Money(left) + '</strong></div></div>' +
    '<div class="gf152-budget-track" role="progressbar" aria-label="배우 출연료 사용액" aria-valuemin="0" aria-valuemax="' + Math.max(1, p.budget) + '" aria-valuenow="' + Math.max(0, Math.min(p.budget, used)) + '" aria-valuetext="사용 ' + gf152Money(used) + ', 남음 ' + gf152Money(left) + '"><span style="width:' + ratio.toFixed(2) + '%"></span></div>' +
    '<div class="gf152-budget-foot"><span>배우 출연료 사용 <b>' + gf152Money(used) + '</b></span><span>캐스팅 ' + (p.cast || []).length + '/10</span></div>' + preview + '</section>';
}
function gf152WithBudget(html, p) {
  if (!p || p.met || html.includes('class="gf152-budget')) return html;
  const card = gf152Budget(p);
  html = html.replace(/<span>남은 제작비 <b>[^<]*<\/b><\/span>/, '');
  if (html.includes('<div class="draft-meta">')) return html.replace('<div class="draft-meta">', card + '<div class="draft-meta">');
  return html.replace(/<\/h2>/, '</h2>' + card);
}
const gf152CastPageBefore = castPage;
castPage = function() { return gf152WithBudget(gf152CastPageBefore(), db?.draft); };
const gf152RevealPageBefore = revealPage;
revealPage = function() { return gf152WithBudget(gf152RevealPageBefore(), db?.draft); };
const gf152DirectorPageBefore = directorPage;
directorPage = function() { return gf152WithBudget(gf152DirectorPageBefore(), db?.draft); };
const gf152TitlePageBefore = titlePage;
titlePage = function() { return gf152WithBudget(gf152TitlePageBefore(), db?.draft); };
const gf152HomeBefore = home;
home = function() {
  return gf152HomeBefore().replace(/<p[^>]*>이번 영화 배정 제작비[\s\S]*?<\/p>/, paragraph => {
    const amount = paragraph.match(/\$([\d.]+)M/);
    return amount ? '<section class="gf152-allocation" aria-label="다음 영화 배정 제작비"><small>이번 영화 배정 제작비</small><strong>' + gf152Money(Number(amount[1])) + '</strong><span>이 예산 안에서 출연진을 구성하세요</span></section>' : paragraph;
  });
};
