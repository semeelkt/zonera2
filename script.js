// ===================== ZONERA LIVE MATCH SYSTEM =====================

// --- Firebase must be initialized before this script ---
let matchData = { leagues: [] };
let currentFilter = 'all';
let dateOffset = 0;
let selectedDateIndex = 3;

// Multi-source match data
let apiMatches = { live: [], finished: [], upcoming: [] };
let footballDataMatches = [];

// ===================== FETCH FIREBASE MATCHES =====================
async function fetchMatchesFromFirebase() {
  try {
    console.log('Fetching matches from Firebase...');
    const matchesSnapshot = await db.collection('matches').get();
    const leaguesSnapshot = await db.collection('leagues').get();

    const leaguesMap = {};
    leaguesSnapshot.forEach(doc => {
      const leagueData = doc.data();
      leaguesMap[doc.id] = {
        id: doc.id,
        name: leagueData.name,
        country: leagueData.country,
        logo: leagueData.logo || '⚽',
        matches: []
      };
    });

    matchesSnapshot.forEach(doc => {
      const match = { id: doc.id, ...doc.data() };
      const leagueId = match.leagueId || 'other';
      if (leaguesMap[leagueId]) leaguesMap[leagueId].matches.push(match);
    });

    matchData.leagues = Object.values(leaguesMap).filter(l => l.matches.length > 0);
    renderAllMatches();
  } catch (error) {
    console.error('Error fetching Firebase data:', error);
  }
}

// --- Real-time updates ---
function listenToMatchUpdates() {
  db.collection('matches').onSnapshot(() => {
    console.log('Firebase matches updated');
    fetchMatchesFromFirebase();
  });
}

// ===================== FETCH API-FOOTBALL MATCHES =====================
const API_KEY = '617e8c14cae54043649b511c841119f4';
async function fetchApiMatches() {
  const endpoints = {
    live: 'https://v3.football.api-sports.io/fixtures?live=all',
    finished: 'https://v3.football.api-sports.io/fixtures?status=FT',
    upcoming: 'https://v3.football.api-sports.io/fixtures?status=NS'
  };
  const headers = { 'x-apisports-key': API_KEY };

  for (const type in endpoints) {
    try {
      const res = await fetch(endpoints[type], { headers });
      const data = await res.json();
      apiMatches[type] = data.response || [];
    } catch (err) {
      console.error(`Error fetching ${type} matches:`, err);
    }
  }
}

// ===================== FETCH FOOTBALL-DATA.ORG =====================
const FOOTBALL_DATA_KEY = 'fd81f1998248477eb823f962a071cf6e';
async function fetchMatchesFromFootballData() {
  try {
    const response = await fetch('https://api.football-data.org/v4/matches', {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
    });
    const data = await response.json();
    footballDataMatches = data.matches || [];
  } catch (err) {
    console.error('Football-Data.org fetch failed:', err);
  }
}

// ===================== MERGE ALL MATCHES =====================
function getAllMatches() {
  const merged = [];

  // Firebase
  matchData.leagues.forEach(league => {
    league.matches.forEach(m => {
      merged.push({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        time: m.time,
        league: league
      });
    });
  });

  // API-Football
  for (const type in apiMatches) {
    apiMatches[type].forEach(m => {
      merged.push({
        homeTeam: m.teams.home.name,
        awayTeam: m.teams.away.name,
        homeScore: m.goals.home,
        awayScore: m.goals.away,
        status: m.fixture.status.short === 'FT' ? 'finished' : m.fixture.status.short === 'NS' ? 'upcoming' : 'live',
        time: new Date(m.fixture.timestamp * 1000).toISOString(),
        league: {
          id: m.league.id,
          name: m.league.name,
          country: m.league.country,
          logo: m.league.logo
        }
      });
    });
  }

  // Football-Data.org
  footballDataMatches.forEach(m => {
    merged.push({
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeScore: m.score.fullTime.home,
      awayScore: m.score.fullTime.away,
      status: m.status === 'IN_PLAY' ? 'live' : m.status === 'SCHEDULED' ? 'upcoming' : 'finished',
      time: m.utcDate,
      league: {
        id: m.competition.id,
        name: m.competition.name,
        country: m.competition.area.name
      }
    });
  });

  // Apply current filter
  return currentFilter === 'all' ? merged : merged.filter(m => m.status === currentFilter);
}

// ===================== RENDER MATCHES =====================
function renderAllMatches() {
  const container = document.getElementById('league-groups');
  const liveContainer = document.getElementById('live-matches');
  container.innerHTML = '';
  liveContainer.innerHTML = '';

  const all = getAllMatches();
  if (!all.length) {
    container.innerHTML = `<div class="no-data">No matches found</div>`;
    return;
  }

  // Group by league
  const leagues = {};
  all.forEach(m => {
    const lid = m.league.name;
    if (!leagues[lid]) leagues[lid] = { ...m.league, matches: [] };
    leagues[lid].matches.push(m);
  });

  Object.values(leagues).forEach(league => {
    const leagueCard = document.createElement('div');
    leagueCard.className = 'league-card';
    leagueCard.innerHTML = `
      <div class="league-header">
        <img src="${league.logo || 'https://img.icons8.com/emoji/48/soccer-ball.png'}" alt="logo" class="league-logo">
        <h3>${league.name} <span>${league.country || ''}</span></h3>
      </div>
    `;

    league.matches.forEach(match => {
      const matchRow = document.createElement('div');
      matchRow.className = `match-row ${match.status}`;
      matchRow.innerHTML = `
        <div class="teams">
          <span>${match.homeTeam}</span>
          <span>${match.awayTeam}</span>
        </div>
        <div class="score">
          ${match.homeScore ?? '-'} : ${match.awayScore ?? '-'}
        </div>
        <div class="status">
          ${match.status === 'live' ? "<span class='live-indicator'>LIVE</span>" : match.status === 'finished' ? 'FT' : '•'}
        </div>
      `;
      leagueCard.appendChild(matchRow);

      if (match.status === 'live') {
        const liveCard = matchRow.cloneNode(true);
        liveContainer.appendChild(liveCard);
      }
    });

    container.appendChild(leagueCard);
  });
}

// ===================== DATE NAVIGATION =====================
function loadDates() {
  const dateList = document.getElementById('date-list');
  const dates = [];

  for (let i = -3; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset + i);
    dates.push({
      date: d,
      label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
    });
  }

  dateList.innerHTML = dates.map((d, idx) =>
    `<button class="date-item ${idx === selectedDateIndex ? 'active' : ''}" data-date="${d.date.toISOString()}">${d.label}</button>`
  ).join('');

  document.querySelectorAll('.date-item').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      selectedDateIndex = idx;
      loadDates();
    });
  });
}

// ===================== FILTER BUTTONS =====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderAllMatches();
  });
});

// ===================== AUTO REFRESH =====================
setInterval(async () => {
  await fetchApiMatches();
  await fetchMatchesFromFootballData();
  renderAllMatches();
}, 60000);

// ===================== INITIALIZE =====================
window.onload = async () => {
  loadDates();
  listenToMatchUpdates();
  await fetchMatchesFromFirebase();
  await fetchApiMatches();
  await fetchMatchesFromFootballData();
  renderAllMatches();

  document.querySelector('.date-btn.prev').addEventListener('click', () => {
    dateOffset--;
    loadDates();
  });
  document.querySelector('.date-btn.next').addEventListener('click', () => {
    dateOffset++;
    loadDates();
  });
};
