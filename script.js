// ======== GLOBAL STATE ========
let matchData = { leagues: [] };
let apiMatches = { live: [], finished: [], upcoming: [] };
let footballDataMatches = [];
let currentFilter = 'all';
let dateOffset = 0;
let selectedDateIndex = 3;

// ======== FETCH FIREBASE MATCHES ========
async function fetchMatchesFromFirebase() {
  try {
    const matchesSnapshot = await db.collection('matches').get();
    const leaguesSnapshot = await db.collection('leagues').get();
    const leaguesMap = {};
    
    leaguesSnapshot.forEach(doc => {
      const data = doc.data();
      leaguesMap[doc.id] = { id: doc.id, name: data.name, country: data.country, logo: data.logo || '⚽', matches: [] };
    });

    matchesSnapshot.forEach(doc => {
      const match = { id: doc.id, ...doc.data() };
      const leagueId = match.leagueId || 'other';
      if (leaguesMap[leagueId]) leaguesMap[leagueId].matches.push(match);
    });

    matchData.leagues = Object.values(leaguesMap).filter(l => l.matches.length > 0);
  } catch (err) {
    console.error('Firebase fetch error', err);
    loadMockData();
  }
}

// ======== MOCK DATA ========
function loadMockData() {
  matchData = {
    leagues: [
      {
        name: 'Premier League',
        country: 'England',
        logo: '🏴',
        matches: [
          { id: 1, homeTeam: 'Man City', awayTeam: 'Arsenal', homeScore: 2, awayScore: 2, status: 'live', time:'15:00' },
          { id: 2, homeTeam: 'Liverpool', awayTeam: 'Chelsea', homeScore: 1, awayScore: 0, status: 'finished', time:'12:30' },
          { id: 3, homeTeam: 'Man United', awayTeam: 'Tottenham', homeScore: null, awayScore: null, status: 'upcoming', time:'17:30' }
        ]
      }
    ]
  };
}

// ======== FETCH API SPORTS ========
const API_KEY = '617e8c14cae54043649b511c841119f4';
async function fetchApiMatches() {
  const endpoints = {
    live: 'https://v3.football.api-sports.io/fixtures?live=all',
    finished: 'https://v3.football.api-sports.io/fixtures?status=FT',
    upcoming: 'https://v3.football.api-sports.io/fixtures?status=NS'
  };
  const headers = { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' };

  for (const type of Object.keys(endpoints)) {
    try {
      const res = await fetch(endpoints[type], { headers });
      const data = await res.json();
      apiMatches[type] = data.response || [];
    } catch (err) {
      console.error('API error', type, err);
      apiMatches[type] = [];
    }
  }
}

// ======== NORMALIZE FOOTBALL DATA ========
async function fetchFootballData() {
  try {
    const res = await fetch('https://api.football-data.org/v4/matches', {
      headers: { 'X-Auth-Token': 'fd81f1998248477eb823f962a071cf6e' }
    });
    const data = await res.json();
    footballDataMatches = data.matches || [];
  } catch (err) {
    console.error('Football-Data error', err);
  }
}

function normalizeFD(match) {
  return {
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    homeScore: match.score.fullTime.home,
    awayScore: match.score.fullTime.away,
    status: match.status === 'IN_PLAY' ? 'live' : match.status === 'SCHEDULED' ? 'upcoming' : 'finished',
    time: match.utcDate,
    league: { id: match.competition.id, name: match.competition.name, country: match.competition.area.name, logo: null }
  };
}

// ======== MERGE ALL MATCHES ========
function getAllMatches() {
  let merged = [];

  // Firebase
  matchData.leagues.forEach(l => l.matches.forEach(m => merged.push({...m, league:{id:l.id,name:l.name,country:l.country,logo:l.logo}})));

  // API-Sports
  ['live','finished','upcoming'].forEach(type=>{
    apiMatches[type].forEach(m=>{
      merged.push({
        homeTeam: m.teams.home.name,
        awayTeam: m.teams.away.name,
        homeScore: m.goals.home,
        awayScore: m.goals.away,
        status: type,
        time: m.fixture.timestamp ? new Date(m.fixture.timestamp*1000).toISOString() : null,
        league: { id:m.league.id, name:m.league.name, country:m.league.country, logo:m.league.logo }
      });
    });
  });

  // Football-Data.org
  footballDataMatches.forEach(m => merged.push(normalizeFD(m)));

  if(currentFilter!=='all') merged = merged.filter(m=>m.status===currentFilter);
  return merged;
}

// ======== RENDER MATCHES ========
function renderMatches() {
  const container = document.getElementById('league-groups');
  container.innerHTML = '';
  const matches = getAllMatches();
  if(!matches.length){
    container.innerHTML='<div style="color:#8B92A1;text-align:center;padding:32px;">No matches</div>';
    return;
  }

  const leagues = {};
  matches.forEach(m=>{
    const id = m.league.id || m.league.name;
    if(!leagues[id]) leagues[id]={...m.league,matches:[]};
    leagues[id].matches.push(m);
  });

  Object.values(leagues).forEach(l=>{
    const leagueGroup = document.createElement('div');
    leagueGroup.className='league-group-card';
    leagueGroup.innerHTML=`
      <div class="league-group-header">
        <span>${l.logo?`<img src="${l.logo}" style="width:20px;height:20px;border-radius:50%;margin-right:6px;">`:'⚽'}</span>
        <span>${l.name} - ${l.country}</span>
      </div>
    `;
    l.matches.forEach(m=>{
      const row=document.createElement('div');
      row.className='match-row'+(m.status==='live'?' live-match':'');
      row.innerHTML=`
        <div class="match-team"><span class="match-team-name">${m.homeTeam}</span></div>
        <div class="match-score">${m.homeScore??''} - ${m.awayScore??''}</div>
        <div class="match-team"><span class="match-team-name">${m.awayTeam}</span></div>
        <div class="match-time">${m.time?new Date(m.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''}</div>
      `;
      leagueGroup.appendChild(row);
    });
    container.appendChild(leagueGroup);
  });
}

// ======== FILTER TABS ========
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter=btn.dataset.filter;
    renderMatches();
  });
});

// ======== DATE NAVIGATION ========
function loadDates() {
  const dateList=document.getElementById('date-list');
  const dates=[];
  for(let i=-3;i<=3;i++){
    const date=new Date();
    date.setDate(date.getDate()+dateOffset+i);
    dates.push({date:new Date(date),day:date.toLocaleDateString('en-US',{weekday:'short'}),dayNum:date.getDate()});
  }
  dateList.innerHTML=dates.map((d,idx)=>`
    <button class="date-item${idx===selectedDateIndex?' active':''}" data-date="${d.date.toISOString()}">
      <span class="day">${d.day}</span>
      <span class="day-num">${d.dayNum}</span>
    </button>
  `).join('');
  Array.from(dateList.children).forEach((btn,idx)=>{
    btn.addEventListener('click',()=>{
      selectedDateIndex=idx;
      loadDates();
      renderMatches();
    });
  });
}

// ======== AUTO UPDATE ========
setInterval(async ()=>{
  await fetchApiMatches();
  await fetchFootballData();
  await fetchMatchesFromFirebase();
  renderMatches();
},60000);

// ======== INIT ========
window.onload=async()=>{
  loadDates();
  await fetchMatchesFromFirebase();
  listenToMatchUpdates();
  await fetchApiMatches();
  await fetchFootballData();
  renderMatches();

  document.querySelector('.date-btn.prev')?.addEventListener('click',()=>{dateOffset--;loadDates();renderMatches();});
  document.querySelector('.date-btn.next')?.addEventListener('click',()=>{dateOffset++;loadDates();renderMatches();});
};
