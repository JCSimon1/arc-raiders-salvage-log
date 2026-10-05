(function(){

// ---------- Übersetzungen (können später nach i18n.js verschoben werden) ----------
Object.assign(translations.de, {
  navTrophy: 'Trophy Room',
  tcEyebrow: 'TROPHY ROOM',
  tcInProgress: 'LÄUFT NOCH',
  tcOpenHint: 'Die Wertung folgt nach Monatsende.',
  tcTier_bronze: 'BRONZE', tcTier_silver: 'SILBER', tcTier_gold: 'GOLD', tcTier_platinum: 'PLATIN',
  tcVsPrev: 'zum Vormonat',
  tcRuns: 'RUNDEN', tcDeaths: 'TODE', tcSurvival: 'ÜBERLEBT', tcActiveDays: 'AKTIVE TAGE', tcBestRunShort: 'BEST RUN',
  tcBestRun: 'BEST RUN', tcBestMap: 'PROFITABELSTE MAP', tcAvgPerRun: 'Ø {v} / Runde',
  tcFavMap: 'MEISTGESPIELT', tcFavMapSub: '{n} Runden',
  tcStreak: 'LÄNGSTE DEATHLESS-SERIE', tcStreakValue: '{n} Runden',
  tcBestDay: 'BESTER TAG', tcBestDaySub: '{n} Runden',
  tcRank: 'PLATZ IM RANKING', tcRankValue: '{n} von {total}',
  tcGoal: 'MONATSZIEL', tcActivity: 'AKTIVITÄT', tcBadges: 'BADGES',
  tcTitle_lucky: 'Der Glückspilz', tcTitle_grinder: 'Der Grinder', tcTitle_survivor: 'Der Überlebenskünstler',
  tcWeekdays: ['M','D','M','D','F','S','S'],
  tcEmpty: 'Noch keine Monate vorhanden. Sobald du Runden erfasst, entsteht hier deine Sammlung.',
  tcNone: '—'
});
Object.assign(translations.en, {
  navTrophy: 'Trophy Room',
  tcEyebrow: 'TROPHY ROOM',
  tcInProgress: 'IN PROGRESS',
  tcOpenHint: 'Rated once the month is over.',
  tcTier_bronze: 'BRONZE', tcTier_silver: 'SILVER', tcTier_gold: 'GOLD', tcTier_platinum: 'PLATINUM',
  tcVsPrev: 'vs. previous month',
  tcRuns: 'RUNS', tcDeaths: 'DEATHS', tcSurvival: 'SURVIVED', tcActiveDays: 'ACTIVE DAYS', tcBestRunShort: 'BEST RUN',
  tcBestRun: 'BEST RUN', tcBestMap: 'MOST PROFITABLE MAP', tcAvgPerRun: 'Avg {v} / run',
  tcFavMap: 'MOST PLAYED', tcFavMapSub: '{n} runs',
  tcStreak: 'LONGEST DEATHLESS STREAK', tcStreakValue: '{n} runs',
  tcBestDay: 'BEST DAY', tcBestDaySub: '{n} runs',
  tcRank: 'RANKING', tcRankValue: '{n} of {total}',
  tcGoal: 'MONTHLY GOAL', tcActivity: 'ACTIVITY', tcBadges: 'BADGES',
  tcTitle_lucky: 'The Lucky One', tcTitle_grinder: 'The Grinder', tcTitle_survivor: 'The Survivor',
  tcWeekdays: ['M','T','W','T','F','S','S'],
  tcEmpty: 'No months yet. Log some runs and your collection starts here.',
  tcNone: '—'
});

// ---------- Config ----------
const DEFAULTS = {
  tiers: { money: { bronze: 100000, silver: 250000, gold: 500000, platinum: 1000000 }, minRounds: 10 },
  titles: { luckyShare: 0.3, grinderRounds: 40, survivorRate: 0.9 },
  monthlyGoal: { money: 0 },
  imageVersion: null
};
const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
const IMG = '/images/misc/monthly_trophy_background.webp';

function cfg(){
  const c = (CONFIG && CONFIG.trophyRoom) || {};
  const tiers = c.tiers || {};
  return {
    tiers: { ...DEFAULTS.tiers, ...tiers, money: { ...DEFAULTS.tiers.money, ...(tiers.money || {}) } },
    titles: { ...DEFAULTS.titles, ...(c.titles || {}) },
    monthlyGoal: { ...DEFAULTS.monthlyGoal, ...(c.monthlyGoal || {}) },
    imageVersion: c.imageVersion || DEFAULTS.imageVersion
  };
}

const tf = (key, vars) => Object.entries(vars || {}).reduce(
  (s, [k, v]) => s.replace('{' + k + '}', v), t(key));

function tierFor(total, count, c){
  if(count < c.tiers.minRounds) return null;
  let tier = null;
  for(const name of TIER_ORDER){
    if(total >= c.tiers.money[name]) tier = name;
  }
  return tier;
}

function titleFor(s, c){
  if(s.count < c.tiers.minRounds) return null;
  if(s.bestRun && s.totalMoney > 0 && Number(s.bestRun.money) / s.totalMoney >= c.titles.luckyShare) return 'lucky';
  if(s.count >= c.titles.grinderRounds) return 'grinder';
  if(s.survivalRate >= c.titles.survivorRate) return 'survivor';
  return null;
}

function buildSummaries(){
  const c = cfg();
  const groups = groupBy(rounds.filter(r => r.date), r => r.date.slice(0, 7));
  const keys = [...groups.keys()].sort();
  const stats = new Map(keys.map(k => [k, statsFor(groups.get(k))]));
  const byTotal = [...keys].sort((a, b) => stats.get(b).totalMoney - stats.get(a).totalMoney);
  const nowKey = dateKey(new Date()).slice(0, 7);

  const out = keys.map((ym, idx) => {
    const list = groups.get(ym);
    const s = stats.get(ym);
    const prev = idx > 0 ? stats.get(keys[idx - 1]) : null;
    const [y, m] = ym.split('-').map(Number);

    let streak = 0, bestStreak = 0;
    for(const r of sortedRounds(list).reverse()){
      streak = isDeath(r) ? 0 : streak + 1;
      bestStreak = Math.max(bestStreak, streak);
    }

    const byDay = groupBy(list, r => r.date);
    const days = new Date(y, m, 0).getDate();
    const dayCounts = Array.from({ length: days }, () => 0);
    byDay.forEach((l, d) => { dayCounts[Number(d.slice(8, 10)) - 1] = l.length; });
    const bestDay = [...byDay.entries()]
      .map(([day, l]) => ({ day, ...statsFor(l) }))
      .sort((a, b) => b.totalMoney - a.totalMoney)[0];

    const byMap = [...groupBy(list, r => r.map || '—').entries()]
      .map(([map, l]) => ({ map, ...statsFor(l) }));
    const favMap = [...byMap].sort((a, b) => b.count - a.count)[0];
    const bestMap = [...byMap].filter(x => x.count >= 3)
      .sort((a, b) => b.avgMoney - a.avgMoney)[0] || null;

    const bestRun = [...list].sort((a, b) => (Number(b.money) || 0) - (Number(a.money) || 0))[0];
    const isOpen = ym === nowKey;

    const sum = {
      ym, y, m, ...s, isOpen,
      activeDays: byDay.size,
      survivalRate: s.count ? 1 - s.deaths / s.count : 0,
      deltaMoney: prev && prev.totalMoney > 0 ? s.totalMoney / prev.totalMoney - 1 : null,
      bestStreak, bestDay, favMap, bestMap, bestRun,
      dayCounts, offset: (new Date(y, m - 1, 1).getDay() + 6) % 7,
      rank: byTotal.indexOf(ym) + 1, monthCount: keys.length
    };
    sum.tier = isOpen ? null : tierFor(s.totalMoney, s.count, c);
    sum.title = isOpen ? null : titleFor(sum, c);
    return sum;
  });
  return out.reverse(); // neuester zuerst
}

function monthParts(s){
  const d = new Date(Date.UTC(s.y, s.m - 1, 1));
  return {
    name: d.toLocaleDateString(t('dateLocale'), { month: 'long', timeZone: 'UTC' }),
    year: s.y
  };
}

function heroHTML(s, full){
  const c = cfg();
  const v = c.imageVersion ? '?v=' + encodeURIComponent(c.imageVersion) : '';
  const { name, year } = monthParts(s);
  const bgMap = (s.bestMap || s.favMap || {}).map;
  const fallbackImg = IMG + v;
  const bgImg = bgMap ? mapImgSrc(bgMap) : fallbackImg;
  let delta = '';
  if(s.deltaMoney != null){
    const pct = Math.round(Math.abs(s.deltaMoney) * 100);
    const neg = s.deltaMoney < 0;
    delta = `<div class="tc-hero-delta"><b class="${neg ? 'neg' : ''}">${neg ? '▼ ' : '▲ +'}${pct}%</b> ${t('tcVsPrev')}</div>`;
  }
  const stamp = s.isOpen
    ? `<div class="tc-tier tc-tier-open">${t('tcInProgress')}</div>`
    : s.tier ? `<div class="tc-tier">${t('tcTier_' + s.tier)}</div>` : '';
  const title = full && s.title ? `<div class="tc-title-chip">${escapeHTML(t('tcTitle_' + s.title))}</div>` : '';
  return `
    <div class="tc-hero">
      <img class="tc-hero-img" src="${bgImg}" data-fb="${fallbackImg}" alt=""
     onerror="if(this.dataset.fb && this.src.indexOf(this.dataset.fb)<0){this.src=this.dataset.fb}else{this.style.display='none'}">
      <div class="tc-scrim"></div>
      <div class="tc-eyebrow">${t('tcEyebrow')}</div>
      ${stamp}
      <div class="tc-hero-content">
        <div class="tc-month">${escapeHTML(name)} <span>${year}</span></div>
        ${title}
        <div class="tc-hero-value">${fmtMoney(s.totalMoney)}</div>
        ${delta}
      </div>
    </div>`;
}

function statTile(value, label, cls){
  return `<div class="tc-stat"><div class="v ${cls || ''}">${value}</div><div class="k">${label}</div></div>`;
}

function highlight(label, value, sub, accent){
  return `
    <div>
      <div class="tc-label">${label}</div>
      <div class="tc-hl-value ${accent ? 'accent' : ''}">${value}</div>
      <div class="tc-hl-sub">${sub || ''}</div>
    </div>`;
}

function heatHTML(s){
  const max = Math.max(1, ...s.dayCounts);
  const wd = t('tcWeekdays').map(d => `<span class="tc-heat-wd">${d}</span>`).join('');
  const lead = '<span></span>'.repeat(s.offset);
  const cells = s.dayCounts.map((v, i) => {
    const lvl = v === 0 ? 0 : Math.min(4, Math.ceil(4 * v / max));
    const day = s.ym + '-' + String(i + 1).padStart(2, '0');
    return `<span class="tc-heat-cell l${lvl}" title="${formatDate(day)} · ${v} ${t('thRounds')}"></span>`;
  }).join('');
  return `<div class="tc-heat">${wd}${lead}${cells}</div>`;
}

function badgesHTML(s){
  const list = computeBadges('month', new Date(s.y, s.m - 1, 1));
  if(list.length === 0) return `<span class="badge-none">${t('badgeNone')}</span>`;
  return list.map(({ key, n }) => {
    const tip = t('badgeTip_' + key).replace('{n}', n ?? '');
    return `<span class="badge-chip" title="${escapeHTML(tip)}">
      <img src="/images/misc/badge_${key}.webp" alt="" onerror="this.remove()">
      ${escapeHTML(t('badge_' + key))}
    </span>`;
  }).join('');
}

function goalHTML(s){
  const goal = Number(cfg().monthlyGoal.money) || 0;
  if(goal <= 0) return '';
  const pct = Math.min(100, Math.round(s.totalMoney / goal * 100));
  return `
    <div class="tc-section">
      <div class="tc-label">${t('tcGoal')} · ${fmtMoney(s.totalMoney)} / ${fmtMoney(goal)} (${Math.round(s.totalMoney / goal * 100)}%)</div>
      <div class="tc-goal-bar"><div class="tc-goal-fill ${pct >= 100 ? 'done' : ''}" style="width:${pct}%"></div></div>
    </div>`;
}

function cardHTML(s, full){
  const cls = ['tc-card', s.isOpen ? 'tc-open' : '', s.tier ? 'tc-tier-' + s.tier : ''].join(' ');
  const bestRunVal = s.bestRun ? fmtMoney(s.bestRun.money) : t('tcNone');

  if(!full){
    return `
      <div class="${cls}">
        ${heroHTML(s, false)}
        <div class="tc-inner">
          <div class="tc-stats">
            ${statTile(s.count, t('tcRuns'))}
            ${statTile(s.deaths, t('tcDeaths'), s.deaths ? 'neg' : '')}
            ${statTile(bestRunVal, t('tcBestRunShort'), 'accent')}
          </div>
          ${s.isOpen ? `<div class="tc-open-hint">${t('tcOpenHint')}</div>` : ''}
        </div>
      </div>`;
  }

  const bestRunSub = s.bestRun
    ? `#${s.bestRun.number} · ${escapeHTML(s.bestRun.map)} · ${formatDate(s.bestRun.date)}` : '';
  const showRank = !s.isOpen && s.monthCount >= 2;

  return `
    <div class="${cls}">
      <button class="tc-close" type="button">${t('rcClose')}</button>
      ${heroHTML(s, true)}
      <div class="tc-inner">
        <div class="tc-stats four">
          ${statTile(s.count, t('tcRuns'))}
          ${statTile(s.deaths, t('tcDeaths'), s.deaths ? 'neg' : '')}
          ${statTile(Math.round(s.survivalRate * 100) + ' %', t('tcSurvival'))}
          ${statTile(s.activeDays, t('tcActiveDays'))}
        </div>

        <div class="tc-section tc-highlights">
          ${highlight(t('tcBestRun'), bestRunVal, bestRunSub, true)}
          ${s.bestMap
            ? highlight(t('tcBestMap'), escapeHTML(s.bestMap.map), tf('tcAvgPerRun', { v: fmtMoney(Math.round(s.bestMap.avgMoney)) }))
            : highlight(t('tcFavMap'), escapeHTML(s.favMap.map), tf('tcFavMapSub', { n: s.favMap.count }))}
          ${highlight(t('tcStreak'), tf('tcStreakValue', { n: s.bestStreak }), '')}
          ${highlight(t('tcBestDay'), fmtMoney(s.bestDay.totalMoney), formatDate(s.bestDay.day) + ' · ' + tf('tcBestDaySub', { n: s.bestDay.count }))}
          ${s.bestMap ? highlight(t('tcFavMap'), escapeHTML(s.favMap.map), tf('tcFavMapSub', { n: s.favMap.count })) : ''}
          ${showRank ? highlight(t('tcRank'), tf('tcRankValue', { n: s.rank, total: s.monthCount }), '') : ''}
        </div>

        ${goalHTML(s)}

        <div class="tc-section">
          <div class="tc-label">${t('tcActivity')}</div>
          ${heatHTML(s)}
        </div>

        <div class="tc-section">
          <div class="tc-label">${t('tcBadges')}</div>
          <div class="badge-list">${badgesHTML(s)}</div>
        </div>
      </div>
    </div>`;
}

let cache = [];
let openYm = null;

function overlayEl(){
  let el = document.getElementById('tcOverlay');
  if(el) return el;
  el = document.createElement('div');
  el.className = 'tc-overlay';
  el.id = 'tcOverlay';
  el.innerHTML = '<div class="tc-modal" id="tcModal"></div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if(e.target === el || e.target.closest('.tc-close')) closeModal();
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });
  return el;
}

function fillModal(){
  const s = cache.find(x => x.ym === openYm);
  if(!s){ closeModal(); return; }
  overlayEl().dataset.tier = s.tier || '';
  document.getElementById('tcModal').innerHTML = cardHTML(s, true);
}

function openModal(ym){
  const el = overlayEl();
  openYm = ym;
  fillModal();
  el.classList.remove('open');
  void el.offsetWidth;
  el.classList.add('open');
}

function closeModal(){
  openYm = null;
  const el = document.getElementById('tcOverlay');
  if(el) el.classList.remove('open');
}

function renderTrophy(){
  const grid = document.getElementById('tcGrid');
  if(!grid) return;
  cache = buildSummaries();
  if(cache.length === 0){
    grid.innerHTML = `<div class="empty-state">${t('tcEmpty')}</div>`;
    return;
  }
  grid.innerHTML = cache.map((s, i) =>
    `<div class="tc-slot${i === 0 ? ' tc-featured' : ''}" data-ym="${s.ym}">${cardHTML(s, false)}</div>`
  ).join('');
  if(openYm) fillModal();
}

document.addEventListener('click', e => {
  const slot = e.target.closest('#tcGrid .tc-slot');
  if(slot) openModal(slot.dataset.ym);
});

window.renderTrophy = renderTrophy;
})();
