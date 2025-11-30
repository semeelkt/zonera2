// ======== GEMINI API IMPORT ========
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// ======== GLOBAL STATE ========
let matchData = { leagues: [] };
let apiMatches = { live: [], finished: [], upcoming: [] };
let footballDataMatches = [];
let currentFilter = 'all';
let dateOffset = 0;
let selectedDateIndex = 3;

// ======== GEMINI API CONFIG ========
const GEMINI_API_KEY = 'AIzaSyDaghpiFzUM5QsAWG617mOh3QAMQrH_isQ';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ======== FETCH FIREBASE MATCHES ========
async function fetchMatchesFromFirebase() {
  try {
    if (typeof db === 'undefined') {
      console.warn('⚠ Firebase not initialized');
      return;
    }
    
    const matchesSnapshot = await db.collection('matches').get();
    const leaguesSnapshot = await db.collection('leagues').get();
    
    if (matchesSnapshot.empty && leaguesSnapshot.empty) {
      console.warn('⚠ No Firebase data found - using mock data');
      return;
    }
    
    const leaguesMap = {};
    
    leaguesSnapshot.forEach(doc => {
      const data = doc.data();
      leaguesMap[doc.id] = { id: doc.id, name: data.name, country: data.country, logo: data.logo || '⚽', matches: [] };
    });

    matchesSnapshot.forEach(doc => {
      const match = { id: doc.id, ...doc.data() };
      const leagueId = match.leagueId || 'other';
      if (leaguesMap[leagueId]) {
        leaguesMap[leagueId].matches.push(match);
      }
    });

    matchData.leagues = Object.values(leaguesMap).filter(l => l.matches.length > 0);
    if (matchData.leagues.length > 0) {
      console.log('✓ Firebase matches loaded:', matchData.leagues.length, 'leagues');
    }
  } catch (err) {
    console.warn('⚠ Firebase fetch error:', err.message);
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
          { id: 3, homeTeam: 'Man United', awayTeam: 'Tottenham', homeScore: null, awayScore: null, status: 'upcoming', time:'17:30' },
          { id: 4, homeTeam: 'Everton', awayTeam: 'Leeds', homeScore: 0, awayScore: 1, status: 'live', time:'16:00' },
          { id: 5, homeTeam: 'West Ham', awayTeam: 'Leicester', homeScore: 3, awayScore: 2, status: 'live', time:'16:30' }
        ]
      },
      {
        name: 'La Liga',
        country: 'Spain',
        logo: '🇪🇸',
        matches: [
          { id: 6, homeTeam: 'Real Madrid', awayTeam: 'Barcelona', homeScore: 1, awayScore: 1, status: 'live', time:'18:00' },
          { id: 7, homeTeam: 'Atletico', awayTeam: 'Sevilla', homeScore: 2, awayScore: 2, status: 'live', time:'18:30' },
          { id: 8, homeTeam: 'Valencia', awayTeam: 'Villarreal', homeScore: 0, awayScore: 0, status: 'upcoming', time:'20:00' }
        ]
      }
    ]
  };
}

// ======== FETCH GEMINI API ========
async function fetchApiMatches() {
  try {
    console.log('🤖 Fetching live matches from Gemini API...');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `Get me current live football/soccer matches happening right now. 
    For each match provide in JSON format:
    {
      "matches": [
        {
          "homeTeam": "team name",
          "awayTeam": "team name", 
          "homeScore": number,
          "awayScore": number,
          "status": "live",
          "league": "league name",
          "country": "country",
          "time": "HH:MM UTC"
        }
      ]
    }
    Only return JSON, no other text.`;
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      apiMatches.live = data.matches || [];
      console.log('✓ Gemini API returned', apiMatches.live.length, 'live matches');
    } else {
      console.warn('⚠ Could not parse Gemini response');
      apiMatches = { live: [], finished: [], upcoming: [] };
    }
  } catch (err) {
    console.warn('⚠ Gemini API error:', err.message);
    apiMatches = { live: [], finished: [], upcoming: [] };
  }
}

// ======== NORMALIZE FOOTBALL DATA ========
async function fetchFootballData() {
  try {
    // Skip if CORS is blocked - Football-Data API doesn't support CORS from browsers
    console.log('⚠ Football-Data API requires backend proxy (CORS blocked in browser)');
    footballDataMatches = [];
  } catch (err) {
    console.warn('⚠ Football-Data error:', err.message);
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

  // Firebase/Mock Data - already in the right format
  matchData.leagues.forEach(l => {
    l.matches.forEach(m => {
      merged.push({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        time: m.time,
        league: { id: l.id, name: l.name, country: l.country, logo: l.logo }
      });
    });
  });

  // Gemini API - convert from teams.home format
  ['live','finished','upcoming'].forEach(type=>{
    apiMatches[type].forEach(m=>{
      try {
        merged.push({
          homeTeam: m.teams?.home?.name || m.homeTeam || 'Team A',
          awayTeam: m.teams?.away?.name || m.awayTeam || 'Team B',
          homeScore: m.goals?.home ?? m.homeScore,
          awayScore: m.goals?.away ?? m.awayScore,
          status: type,
          time: m.fixture?.timestamp ? new Date(m.fixture.timestamp*1000).toISOString() : null,
          league: { 
            id: m.league?.id || 1, 
            name: m.league?.name || 'League', 
            country: m.league?.country || '', 
            logo: m.league?.logo 
          }
        });
      } catch (e) {
        console.warn('Error processing Gemini match:', e, m);
      }
    });
  });

  // Football-Data.org
  footballDataMatches.forEach(m => {
    try {
      merged.push(normalizeFD(m));
    } catch (e) {
      console.warn('Error processing Football-Data match:', e);
    }
  });

  if(currentFilter!=='all') merged = merged.filter(m=>m.status===currentFilter);
  return merged;
}

// ======== RENDER MATCHES ========
// ======== RENDER LIVE MATCHES ========
function renderLiveMatches() {
  const liveContainer = document.getElementById('live-matches');
  if (!liveContainer) {
    console.warn('Live matches container not found');
    return;
  }
  
  let liveMatches = getAllMatches().filter(m => m.status === 'live');
  liveContainer.innerHTML = '';
  liveContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  
  if (!liveMatches.length) {
    const noMatch = document.createElement('div');
    noMatch.style.cssText = 'color:#8B92A1;text-align:center;padding:24px;';
    noMatch.textContent = 'No live matches';
    liveContainer.appendChild(noMatch);
    return;
  }
  
  liveMatches.forEach((m, idx) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:#1a1d1e;border-left:4px solid #ff1a3c;padding:16px;border-radius:8px;display:flex;gap:16px;align-items:center;';
    
    card.innerHTML = `
      <div style="flex:0;font-size:2rem;">${m.league.logo || '⚽'}</div>
      <div style="flex:1;">
        <div style="font-weight:bold;color:#fff;margin-bottom:4px;">${m.homeTeam} vs ${m.awayTeam}</div>
        <div style="font-size:1.5rem;font-weight:bold;color:#00D266;margin-bottom:4px;">${m.homeScore} - ${m.awayScore}</div>
        <div style="font-size:0.85rem;color:#8B92A1;">
          <span style="color:#ff1a3c;font-weight:bold;">● LIVE</span> • ${m.league.name}
        </div>
      </div>
    `;
    liveContainer.appendChild(card);
  });
  
  console.log('✓ Live matches rendered:', liveMatches.length);
}
function renderMatches() {
  const container = document.getElementById('league-groups');
  if (!container) {
    console.error('❌ Container #league-groups not found!');
    return;
  }
  
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  
  const matches = getAllMatches();
  
  console.log('📊 renderMatches:', {
    totalMatches: matches.length,
    leaguesCount: matchData.leagues.length,
    containerFound: !!container,
    mockDataLoaded: matchData.leagues.length > 0
  });
  
  if(!matches.length){
    const noMatch = document.createElement('div');
    noMatch.style.cssText = 'color:#8B92A1;text-align:center;padding:32px;';
    noMatch.textContent = 'No matches - loading data...';
    container.appendChild(noMatch);
    console.warn('⚠ No matches to render yet');
    return;
  }

  const leagues = {};
  matches.forEach(m=>{
    const id = m.league.id || m.league.name;
    if(!leagues[id]) leagues[id]={...m.league,matches:[]};
    leagues[id].matches.push(m);
  });

  console.log('📋 Rendering', Object.keys(leagues).length, 'leagues');

  Object.values(leagues).forEach(l=>{
    const leagueGroup = document.createElement('div');
    leagueGroup.className='league-group-card';
    leagueGroup.style.cssText = 'background:#181a1b;border-radius:14px;margin-bottom:18px;padding:0;overflow:hidden;';
    
    const header = document.createElement('div');
    header.className = 'league-group-header';
    header.style.cssText = 'background:#222325;padding:12px 20px;font-size:1rem;font-weight:700;color:#e8e8e8;border-bottom:1px solid #232323;';
    header.innerHTML = `<span>${l.logo?l.logo:'⚽'}</span> <span>${l.name} - ${l.country}</span>`;
    leagueGroup.appendChild(header);
    
    l.matches.forEach(m=>{
      const row=document.createElement('div');
      row.className='match-row'+(m.status==='live'?' live-match':'');
      row.style.cssText = 'display:grid;grid-template-columns:1fr auto 1fr auto;gap:12px;padding:12px 20px;align-items:center;border-bottom:1px solid #232323;';
      
      const homeTeam = document.createElement('div');
      homeTeam.style.cssText = 'text-align:right;';
      homeTeam.textContent = m.homeTeam;
      
      const score = document.createElement('div');
      score.style.cssText = 'font-weight:bold;text-align:center;color:#fff;';
      score.textContent = (m.homeScore ?? '-') + ' - ' + (m.awayScore ?? '-');
      
      const awayTeam = document.createElement('div');
      awayTeam.style.cssText = 'text-align:left;';
      awayTeam.textContent = m.awayTeam;
      
      const time = document.createElement('div');
      time.style.cssText = 'text-align:right;font-size:0.9rem;color:#8B92A1;';
      time.textContent = m.time ? new Date(m.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
      
      row.appendChild(homeTeam);
      row.appendChild(score);
      row.appendChild(awayTeam);
      row.appendChild(time);
      leagueGroup.appendChild(row);
    });
    container.appendChild(leagueGroup);
  });
  
  console.log('✓ Rendered', Object.keys(leagues).length, 'leagues');
  renderLiveMatches();
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
function listenToMatchUpdates() {
  // Placeholder for real-time updates if needed
  try {
    if (typeof db !== 'undefined') {
      db.collection('matches').onSnapshot(() => {
        fetchMatchesFromFirebase();
        renderMatches();
      });
    }
  } catch (err) {
    console.log('Firebase listening not available');
  }
}

setInterval(async ()=>{
  console.log('🔄 Refreshing live match data...');
  await fetchApiMatches();
  await fetchFootballData();
  await fetchMatchesFromFirebase();
  renderMatches();
  renderLiveMatches();
},30000); // Update every 30 seconds for live data

// ======== INIT ========
async function initializeApp() {
  try {
    console.log('🚀 Initializing Zonera app...');
    
    // Verify DOM is ready
    const container = document.getElementById('league-groups');
    const dateList = document.getElementById('date-list');
    if (!container || !dateList) {
      console.error('❌ Required DOM elements not found');
      return;
    }
    
    // Load mock data as fallback
    loadMockData();
    console.log('✓ Mock data loaded as fallback:', matchData.leagues.length, 'leagues');
    
    // Load dates
    loadDates();
    console.log('✓ Dates loaded');
    
    // Fetch LIVE data from Gemini API FIRST
    console.log('⏳ Fetching LIVE matches from Gemini API...');
    try {
      await fetchApiMatches();
      if (apiMatches.live.length > 0) {
        console.log('✅ Got', apiMatches.live.length, 'live matches from Gemini!');
      }
    } catch (e) {
      console.warn('⚠ Gemini API fetch failed');
    }
    
    // Try to fetch Gemini API for other matches
    try {
      await fetchFootballData();
    } catch (e) {
      console.warn('⚠ Football Data fetch failed');
    }
    
    // Try Firebase
    try {
      await fetchMatchesFromFirebase();
    } catch (e) {
      console.warn('⚠ Firebase fetch failed');
    }
    
    // Try to listen to Firebase updates
    try {
      listenToMatchUpdates();
    } catch (e) {
      console.warn('⚠ Firebase listener failed');
    }
    
    // Render everything
    console.log('📊 Rendering matches...');
    renderMatches();
    console.log('✓ Matches rendered');
    
    renderLiveMatches();
    console.log('✓ Live matches rendered');
    
    console.log('✅ App ready!');
    
  } catch (err) {
    console.error('❌ Fatal error:', err);
    // Last resort - render mock data
    loadMockData();
    renderMatches();
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  
  // Date navigation
  const prevBtn = document.querySelector('.date-btn.prev');
  const nextBtn = document.querySelector('.date-btn.next');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', ()=>{
      dateOffset--;
      loadDates();
      renderMatches();
      renderLiveMatches();
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', ()=>{
      dateOffset++;
      loadDates();
      renderMatches();
      renderLiveMatches();
    });
  }
});
