/* script.js — Unified match loader + renderer for Zonera / Wuroud
   - Expects firebase-config.js to run earlier and expose `db` (Firestore)
   - Fetches: Firebase matches, API-Football (api-sports), Football-Data.org
   - Renders live matches into #live-matches and leagues into #league-groups
   - Date filtering + status tabs + auto-refresh
*/

/////////////////////// CONFIG ///////////////////////
const API_SPORTS_KEY = '617e8c14cae54043649b511c841119f4'; // replace with your key or load from server
const FOOTBALL_DATA_KEY = 'fd81f1998248477eb823f962a071cf6e'; // replace if needed
const API_SPORTS_HEADERS = {
  'x-apisports-key': API_SPORTS_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};
const AUTO_REFRESH_MS = 60_000; // 60s

/////////////////////// STATE ///////////////////////
let matchData = { leagues: [] }; // from Firebase / mock
let apiMatches = { live: [], finished: [], upcoming: [] };
let footballDataMatches = [];
let currentFilter = 'all'; // all | live | upcoming | finished
let dateOffset = 0;
let selectedDateIndex = 3; // 0..6 where 3 is 'today' in the 7-day window

/////////////////////// HELPERS ///////////////////////
function safeNowLocalISO() {
  return new Date().toISOString();
}

function startOfLocalDayISO(date) {
  const d = date ? new Date(date) : new Date();
  d.setHours(0,0,0,0);
  return d.toISOString();
}

function isSameLocalDay(dateAISO, dateBISO) {
  if (!dateAISO || !dateBISO) return false;
  const a = new Date(dateAISO);
  const b = new Date(dateBISO);
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function formatTimeShort(iso) {
  try {
    return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  } catch(e) {
    return '';
  }
}

function safeGetDb() {
  if (typeof db === 'undefined') {
    console.warn('Firestore `db` is not defined. Make sure firebase-config.js runs before script.js');
    return null;
  }
  return db;
}

/////////////////////// FIREBASE FETCH ///////////////////////
async function fetchMatchesFromFirebase() {
  const firestore = safeGetDb();
  if (!firestore) return; // nothing to fetch
  try {
    const matchesSnapshot = await firestore.collection('matches').get();
    const leaguesSnapshot = await firestore.collection('leagues').get();
    const leaguesMap = {};
    leaguesSnapshot.forEach(doc => {
      const data = doc.data();
      leaguesMap[doc.id] = { id: doc.id, name: data.name || 'Unknown', country: data.country || '', logo: data.logo || null, matches: [] };
    });
    matchesSnapshot.forEach(doc => {
      const m = { id: doc.id, ...doc.data() };
      const leagueId = m.leagueId || 'other';
      if (!leaguesMap[leagueId]) {
        leaguesMap[leagueId] = { id: leagueId, name: m.leagueName || 'Other', country: '', logo: null, matches: [] };
      }
      leaguesMap[leagueId].matches.push(m);
    });
    matchData.leagues = Object.values(leaguesMap).filter(l => l.matches && l.matches.length > 0);
    // console.log('Firebase matches loaded', matchData);
  } catch (err) {
    console.error('Error fetching Firebase matches:', err);
    loadMockData();
  }
}

function listenToMatchUpdates() {
  const firestore = safeGetDb();
  if (!firestore) return;
  // If you prefer real-time, uncomment this. (Note: real-time listeners cost reads)
  try {
    firestore.collection('matches').onSnapshot(snapshot => {
      console.info('Firebase snapshot changed, reloading matches...');
      fetchMatchesFromFirebase().then(renderAll);
    });
  } catch (e) {
    console.warn('Realtime listener not enabled or failed:', e);
  }
}

function loadMockData() {
  console.info('Loading mock data as a fallback.');
  matchData = {
    leagues: [
      {
        id: 'mock-pl',
        name: 'Premier League',
        country: 'England',
        logo: '🏴',
        matches: [
          { id: 'm1', homeTeam: 'Man City', awayTeam: 'Arsenal', homeScore: 2, awayScore: 2, status: 'live', utcDate: new Date().toISOString() },
          { id: 'm2', homeTeam: 'Liverpool', awayTeam: 'Chelsea', homeScore: 1, awayScore: 0, status: 'finished', utcDate: new Date(Date.now() - 86400e3).toISOString() },
          { id: 'm3', homeTeam: 'Man Utd', awayTeam: 'Spurs', homeScore: null, awayScore: null, status: 'upcoming', utcDate: new Date(Date.now() + 86400e3).toISOString() }
        ]
      }
    ]
  };
}

/////////////////////// API-SPORTS (api-football) ///////////////////////
async function fetchApiSports() {
  const endpoints = {
    live: 'https://v3.football.api-sports.io/fixtures?live=all',
    finished: 'https://v3.football.api-sports.io/fixtures?status=FT',
    upcoming: 'https://v3.football.api-sports.io/fixtures?status=NS'
  };
  try {
    for (const type of Object.keys(endpoints)) {
      const res = await fetch(endpoints[type], { headers: API_SPORTS_HEADERS });
      const json = await res.json();
      apiMatches[type] = (json && json.response) ? json.response : [];
    }
    // console.log('apiMatches updated', apiMatches);
  } catch (e) {
    console.error('API-Sports fetch error:', e);
    // keep previous values or empty
  }
}

/////////////////////// FOOTBALL-DATA.ORG ///////////////////////
async function fetchFootballDataOrg() {
  try {
    const res = await fetch('https://api.football-data.org/v4/matches', { headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY } });
    const json = await res.json();
    footballDataMatches = json && json.matches ? json.matches : [];
  } catch (e) {
    console.error('Football-Data fetch error:', e);
  }
}

function normalizeFD(match) {
  return {
    homeTeam: match.homeTeam?.name || 'TBD',
    awayTeam: match.awayTeam?.name || 'TBD',
    homeScore: match.score?.fullTime?.home ?? null,
    awayScore: match.score?.fullTime?.away ?? null,
    status: match.status === 'IN_PLAY' ? 'live' : match.status === 'SCHEDULED' ? 'upcoming' : 'finished',
    utcDate: match.utcDate,
    league: {
      id: match.competition?.id ?? (match.competition?.name || 'fd'),
      name: match.competition?.name || 'League',
      country: match.competition?.area?.name || '',
      logo: null
    }
  };
}

/////////////////////// MERGE + NORMALIZE ///////////////////////
function normalizeApiSportsFixture(f) {
  // f is per api-sports structure
  return {
    homeTeam: f.teams?.home?.name ?? 'TBD',
    awayTeam: f.teams?.away?.name ?? 'TBD',
    homeScore: f.goals?.home ?? null,
    awayScore: f.goals?.away ?? null,
    status: (() => {
      const s = f.fixture?.status?.short ?? '';
      if (s === 'NS') return 'upcoming';
      if (s === 'FT') return 'finished';
      if (s === '1H' || s === '2H' || s === 'LIVE' || s === 'HT' || s === 'ET' || s === 'P') return 'live';
      return 'upcoming';
    })(),
    utcDate: f.fixture?.date || (f.fixture?.timestamp ? new Date(f.fixture.timestamp * 1000).toISOString() : null),
    league: {
      id: f.league?.id ?? 'api-sports',
      name: f.league?.name ?? 'League',
      country: f.league?.country ?? '',
      logo: f.league?.logo ?? null
    }
  };
}

function getAllMatchesForRender() {
  const merged = [];

  // 1) Firebase matches
  matchData.leagues.forEach(league => {
    league.matches.forEach(m => {
      merged.push({
        homeTeam: m.homeTeam || m.home || m.home_name || 'TBD',
        awayTeam: m.awayTeam || m.away || m.away_name || 'TBD',
        homeScore: (typeof m.homeScore !== 'undefined') ? m.homeScore : (m.home_score ?? null),
        awayScore: (typeof m.awayScore !== 'undefined') ? m.awayScore : (m.away_score ?? null),
        status: m.status || 'upcoming',
        utcDate: m.utcDate || m.time || m.date || new Date().toISOString(),
        league: { id: league.id || league.name, name: league.name || 'League', country: league.country || '', logo: league.logo || null },
        source: 'firebase',
        raw: m
      });
    });
  });

  // 2) API-Sports
  ['live', 'finished', 'upcoming'].forEach(type => {
    apiMatches[type].forEach(f => merged.push({ ...normalizeApiSportsFixture(f), source: 'api-sports' }));
  });

  // 3) Football-Data.org
  footballDataMatches.forEach(fd => merged.push({ ...normalizeFD(fd), source: 'football-data' }));

  // 4) Optionally dedupe by combination home-away-date
  // For simplicity, just return merged and let UI group by league

  // 5) Apply status filter
  let filtered = merged;
  if (currentFilter !== 'all') filtered = filtered.filter(m => m.status === currentFilter);

  // 6) Apply date filter (use selected date from date-list)
  const dateListButtons = Array.from(document.querySelectorAll('#date-list .date-item'));
  const selBtn = dateListButtons[selectedDateIndex];
  if (selBtn) {
    const selectedISO = selBtn.dataset.date; // start-of-day ISO
    filtered = filtered.filter(m => {
      if (!m.utcDate) return false;
      return isSameLocalDay(m.utcDate, selectedISO);
    });
  }

  return filtered;
}

/////////////////////// RENDERERS ///////////////////////
function renderLiveMatches(matches) {
  const container = document.getElementById('live-matches');
  if (!container) return;
  // Only keep 'live' matches here
  const live = matches.filter(m => m.status === 'live');
  if (live.length === 0) {
    container.innerHTML = `<div style="color:#8B92A1;text-align:center;padding:16px;">No live matches</div>`;
    return;
  }

  // Build HTML using DocumentFragment to reduce reflow
  const frag = document.createDocumentFragment();
  live.forEach(m => {
    const card = document.createElement('div');
    card.className = 'live-match-card';
    card.innerHTML = `
      <div class="live-match-logo">${m.league.logo ? `<img src="${m.league.logo}" style="width:48px;height:48px;border-radius:50%;">` : '⚽'}</div>
      <div class="live-match-info">
        <div class="live-match-teams">${escapeHtml(m.homeTeam)} vs ${escapeHtml(m.awayTeam)}</div>
        <div class="live-match-score">${m.homeScore ?? '-'}  -  ${m.awayScore ?? '-'}</div>
        <div class="live-match-status">LIVE • ${formatTimeShort(m.utcDate)}</div>
      </div>
    `;
    frag.appendChild(card);
  });
  // Replace content smoothly
  container.innerHTML = '';
  container.appendChild(frag);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"'`]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'})[s]);
}

function renderLeagues(matches) {
  const container = document.getElementById('league-groups');
  if (!container) return;
  if (matches.length === 0) {
    container.innerHTML = `<div style="color:#8B92A1;text-align:center;padding:32px;">No matches for selected date / filter</div>`;
    return;
  }
  // Group by league.id or league.name
  const leagues = {};
  matches.forEach(m => {
    const lid = m.league?.id ?? (m.league?.name || 'unknown');
    if (!leagues[lid]) leagues[lid] = { name: m.league?.name || 'League', country: m.league?.country || '', logo: m.league?.logo || null, matches: [] };
    leagues[lid].matches.push(m);
  });

  const frag = document.createDocumentFragment();
  Object.values(leagues).forEach(l => {
    const group = document.createElement('div');
    group.className = 'league-group-card';
    // header
    const header = document.createElement('div');
    header.className = 'league-group-header';
    header.innerHTML = `
      <span class="league-logo">${l.logo ? `<img src="${l.logo}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px;">` : '⚽'}</span>
      <span>${escapeHtml(l.name)}${l.country ? ' - ' + escapeHtml(l.country) : ''}</span>
    `;
    group.appendChild(header);

    // matches rows
    l.matches.forEach(m => {
      const row = document.createElement('div');
      row.className = 'match-row' + (m.status === 'live' ? ' live' : (m.status === 'finished' ? ' finished' : ' upcoming'));
      row.innerHTML = `
        <div class="match-team">
          <span class="match-team-name">${escapeHtml(m.homeTeam)}</span>
        </div>
        <div class="match-score">${m.homeScore ?? ''} <span class="score-sep">-</span> ${m.awayScore ?? ''}</div>
        <div class="match-team">
          <span class="match-team-name">${escapeHtml(m.awayTeam)}</span>
        </div>
        <div class="match-time">${formatTimeShort(m.utcDate)}</div>
      `;
      frag.appendChild(row);
      group.appendChild(row);
    });

    frag.appendChild(group);
  });

  container.innerHTML = '';
  container.appendChild(frag);
}

function renderAll() {
  const all = getAllMatchesForRender();
  renderLiveMatches(all);
  renderLeagues(all);
}

/////////////////////// DATE NAV ///////////////////////
function loadDates() {
  const dateList = document.getElementById('date-list');
  if (!dateList) return;
  const dates = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset + i);
    dates.push({ isoStart: startOfLocalDayISO(d), weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), dayNum: d.getDate() });
  }
  dateList.innerHTML = dates.map((d, idx) => `
    <button class="date-item${idx === selectedDateIndex ? ' active' : ''}" data-date="${d.isoStart}">
      <span class="day">${d.weekday}</span>
      <span class="day-num">${d.dayNum}</span>
    </button>
  `).join('');

  Array.from(dateList.children).forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      selectedDateIndex = idx;
      loadDates();
      renderAll();
    });
  });
}

/////////////////////// TABS ///////////////////////
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderAll();
    });
  });
}

/////////////////////// INIT + AUTO-REFRESH ///////////////////////
async function initialLoad() {
  loadDates();
  initTabs();
  // Fetch everything in parallel and render
  await Promise.allSettled([ fetchMatchesFromFirebase(), fetchApiSports(), fetchFootballDataOrg() ]);
  renderAll();
  listenToMatchUpdates();

  // prev / next date controls
  document.querySelector('.date-btn.prev')?.addEventListener('click', () => { dateOffset--; loadDates(); renderAll(); });
  document.querySelector('.date-btn.next')?.addEventListener('click', () => { dateOffset++; loadDates(); renderAll(); });

  // auto refresh loop
  setInterval(async () => {
    await Promise.allSettled([ fetchApiSports(), fetchFootballDataOrg(), fetchMatchesFromFirebase() ]);
    renderAll();
  }, AUTO_REFRESH_MS);
}

window.addEventListener('load', () => {
  initialLoad().catch(err => console.error('initialLoad failed', err));
});
