// ====== FIREBASE DATA MANAGEMENT ======
let matchData = {
  leagues: []
};

// Fetch matches from Firebase Firestore
async function fetchMatchesFromFirebase() {
  try {
    console.log('Fetching matches from Firebase...');
    const matchesSnapshot = await db.collection('matches').get();
    const leaguesSnapshot = await db.collection('leagues').get();
    
    // Build leagues map
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
    
    // Add matches to corresponding leagues
    matchesSnapshot.forEach(doc => {
      const match = { id: doc.id, ...doc.data() };
      const leagueId = match.leagueId || 'other';
      
      if (leaguesMap[leagueId]) {
        leaguesMap[leagueId].matches.push(match);
      }
    });
    
    // Convert map to array
    matchData.leagues = Object.values(leaguesMap).filter(league => league.matches.length > 0);
    
    console.log('Firebase data loaded:', matchData);
    loadMatches();
  } catch (error) {
    console.error('Error fetching from Firebase:', error);
    // Fallback to mock data if Firebase fails
    loadMockData();
  }
}

// Real-time listener for matches (optional - for live updates)
function listenToMatchUpdates() {
  db.collection('matches').onSnapshot((snapshot) => {
    console.log('Matches updated in real-time');
    fetchMatchesFromFirebase();
  });
}

// Mock data structured by leagues (FotMob style) - FALLBACK
function loadMockData() {
  matchData = {
    leagues: [
      {
        name: 'Premier League',
        country: 'England',
        logo: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        matches: [
        { 
          id: 1,
          homeTeam: 'Manchester City', 
          awayTeam: 'Arsenal', 
          homeScore: 2, 
          awayScore: 2, 
          status: 'live',
          minute: '78\'',
          homeShots: 14,
          awayShots: 11,
          homePossession: 58,
          awayPossession: 42,
          time: '15:00'
        },
        { 
          id: 2,
          homeTeam: 'Liverpool', 
          awayTeam: 'Chelsea', 
          homeScore: 1, 
          awayScore: 0, 
          status: 'finished',
          minute: 'FT',
          homeShots: 16,
          awayShots: 8,
          homePossession: 62,
          awayPossession: 38,
          time: '12:30'
        },
        { 
          id: 3,
          homeTeam: 'Manchester United', 
          awayTeam: 'Tottenham', 
          homeScore: null, 
          awayScore: null, 
          status: 'upcoming',
          minute: '',
          time: '17:30'
        }
      ]
    },
    {
      name: 'La Liga',
      country: 'Spain',
      logo: '🇪🇸',
      matches: [
        { 
          id: 4,
          homeTeam: 'Real Madrid', 
          awayTeam: 'Barcelona', 
          homeScore: 1, 
          awayScore: 1, 
          status: 'live',
          minute: '65\'',
          homeShots: 12,
          awayShots: 15,
          homePossession: 48,
          awayPossession: 52,
          time: '16:00'
        },
        { 
          id: 5,
          homeTeam: 'Atletico Madrid', 
          awayTeam: 'Sevilla', 
          homeScore: null, 
          awayScore: null, 
          status: 'upcoming',
          minute: '',
          time: '19:00'
        }
      ]
    },
    {
      name: 'Serie A',
      country: 'Italy',
      logo: '🇮🇹',
      matches: [
        { 
          id: 6,
          homeTeam: 'AC Milan', 
          awayTeam: 'Inter Milan', 
          homeScore: 2, 
          awayScore: 3, 
          status: 'finished',
          minute: 'FT',
          homeShots: 13,
          awayShots: 17,
          homePossession: 51,
          awayPossession: 49,
          time: '14:00'
        }
      ]
    }
  ]
  };
  loadMatches();
}

let currentFilter = 'all';
// Store API matches by type
let apiMatches = {
  live: [],
  finished: [],
  upcoming: []
};

// Fetch matches from API for all types
async function fetchApiMatches() {
  const endpoints = {
    live: 'https://v3.football.api-sports.io/fixtures?live=all',
    finished: 'https://v3.football.api-sports.io/fixtures?status=FT',
    upcoming: 'https://v3.football.api-sports.io/fixtures?status=NS'
  };
  const headers = {
    'x-apisports-key': '617e8c14cae54043649b511c841119f4',
    'x-rapidapi-host': 'v3.football.api-sports.io'
  };
  for (const type of Object.keys(endpoints)) {
    try {
      const response = await fetch(endpoints[type], { method: 'GET', headers });
      const data = await response.json();
      apiMatches[type] = data.response || [];
    } catch (err) {
      apiMatches[type] = [];
      console.error('API error for', type, err);
    }
  }
  renderApiMatches();
}

// Render matches from API grouped by league
function renderApiMatches() {
  const container = document.getElementById('league-groups');
  container.innerHTML = '';
  let type = currentFilter;
  if (type === 'all') type = 'live'; // Default to live if 'all'
  const matches = apiMatches[type];
  if (!matches || matches.length === 0) {
    container.innerHTML = '<div style="color:#8B92A1;text-align:center;padding:32px;">No matches scheduled</div>';
    return;
  }
  // Group by league
  const leagues = {};
  matches.forEach(match => {
    const leagueId = match.league.id;
    if (!leagues[leagueId]) {
      leagues[leagueId] = {
        name: match.league.name,
        country: match.league.country,
        logo: match.league.logo || '⚽',
        matches: []
      };
    }
    leagues[leagueId].matches.push(match);
  });
  Object.values(leagues).forEach(league => {
    const leagueGroup = document.createElement('div');
    leagueGroup.className = 'league-group-card';
    const leagueHeader = document.createElement('div');
    leagueHeader.className = 'league-group-header';
    leagueHeader.innerHTML = `
      <span class="league-logo">${league.logo ? `<img src='${league.logo}' style='width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px;'>` : '⚽'}</span>
      <span>${league.name}${league.country ? ' - ' + league.country : ''}</span>
    `;
    leagueGroup.appendChild(leagueHeader);
    league.matches.forEach(match => {
      const row = document.createElement('div');
      row.className = 'match-row';
      row.innerHTML = `
        <div class="match-team">
          <img class="match-team-logo" src="${match.teams.home.logo || 'https://via.placeholder.com/28x28?text=H'}" alt="${match.teams.home.name}">
          <span class="match-team-name">${match.teams.home.name}</span>
        </div>
        <div class="match-score">${match.goals.home ?? ''} <span style="color:#8B92A1;font-weight:400;">-</span> ${match.goals.away ?? ''}</div>
        <div class="match-team">
          <img class="match-team-logo" src="${match.teams.away.logo || 'https://via.placeholder.com/28x28?text=A'}" alt="${match.teams.away.name}">
          <span class="match-team-name">${match.teams.away.name}</span>
        </div>
        <div class="match-time">${match.fixture.status.short === 'NS' ? new Date(match.fixture.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : match.fixture.status.short === 'FT' ? 'FT' : (match.fixture.status.elapsed ? match.fixture.status.elapsed + "'" : '')}</div>
      `;
      leagueGroup.appendChild(row);
    });
    container.appendChild(leagueGroup);
  });
}

// Load dates for date navigation
function loadDates() {
  const dateList = document.getElementById('date-list');
  const dates = [];
  
  for (let i = -3; i <= 3; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    dates.push({
      date: date,
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: date.getDate(),
      isToday: i === 0
    });
  }
  
  dateList.innerHTML = dates.map(d => `
    <button class="date-item ${d.isToday ? 'active' : ''}">
      <span class="day">${d.day}</span>
      <span class="day-num">${d.dayNum}</span>
    </button>
  `).join('');
}

// Load matches grouped by league
function loadMatches() {
  const container = document.getElementById('league-groups');
  container.innerHTML = '';

  matchData.leagues.forEach(league => {
    const filteredMatches = league.matches.filter(match => {
      if (currentFilter === 'all') return true;
      return match.status === currentFilter;
    });
    if (filteredMatches.length === 0) return;

    // FotMob-style league group card
    const leagueGroup = document.createElement('div');
    leagueGroup.className = 'league-group-card';

    // League header
    const leagueHeader = document.createElement('div');
    leagueHeader.className = 'league-group-header';
    leagueHeader.innerHTML = `
      <span class="league-logo">${league.logo}</span>
      <span>${league.name}${league.country ? ' - ' + league.country : ''}</span>
    `;
    leagueGroup.appendChild(leagueHeader);

    // Matches as rows
    filteredMatches.forEach(match => {
      const row = document.createElement('div');
      row.className = 'match-row';
      row.innerHTML = `
        <div class="match-team">
          <img class="match-team-logo" src="${match.homeLogo || 'https://via.placeholder.com/28x28?text=H'}" alt="${match.homeTeam}">
          <span class="match-team-name">${match.homeTeam}</span>
        </div>
        <div class="match-score">${match.homeScore ?? ''} <span style="color:#8B92A1;font-weight:400;">-</span> ${match.awayScore ?? ''}</div>
        <div class="match-team">
          <img class="match-team-logo" src="${match.awayLogo || 'https://via.placeholder.com/28x28?text=A'}" alt="${match.awayTeam}">
          <span class="match-team-name">${match.awayTeam}</span>
        </div>
        <div class="match-time">${match.time || match.date ? (match.time || (new Date(match.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))) : ''}</div>
      `;
      leagueGroup.appendChild(row);
    });

    container.appendChild(leagueGroup);
  });
}

// Create individual match card
function createMatchCard(match) {
  const card = document.createElement('div');
  card.className = 'match-card';
  card.dataset.matchId = match.id;

  // FotMob style: horizontal layout
  card.innerHTML = `
    <div class="match-team">
      <img class="match-team-logo" src="${match.homeLogo || 'https://via.placeholder.com/32x32?text=H'}" alt="${match.homeTeam}">
      <span class="match-team-name">${match.homeTeam}</span>
    </div>
    <div class="match-score">${match.homeScore ?? ''} <span style="color:#8B92A1;font-weight:400;">-</span> ${match.awayScore ?? ''}</div>
    <div class="match-team">
      <img class="match-team-logo" src="${match.awayLogo || 'https://via.placeholder.com/32x32?text=A'}" alt="${match.awayTeam}">
      <span class="match-team-name">${match.awayTeam}</span>
    </div>
    <div class="match-status">${match.status === 'NS' ? 'Upcoming' : match.status === 'FT' ? 'Finished' : match.status}</div>
  `;
  return card;
}

// Filter functionality
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderApiMatches();
  });
});

// Auto refresh for live matches
setInterval(() => {
  matchData.leagues.forEach(league => {
    league.matches.forEach(match => {
      if (match.status === 'live') {
        // Simulate minute progression
        const currentMinute = parseInt(match.minute);
        if (!isNaN(currentMinute) && currentMinute < 90) {
          match.minute = `${currentMinute + 1}'`;
          
          // Random score changes (10% chance)
          if (Math.random() < 0.1) {
            if (Math.random() < 0.5) {
              match.homeScore++;
            } else {
              match.awayScore++;
            }
          }
        }
      }
    });
  });
  loadMatches();
}, 60000); // Update every minute

// Initialize
window.onload = () => {
  // ...existing code for news logic...
  // ...existing code for admin login logic...

  // ...existing code for saving matches to Firestore (if needed)...


  // Site Initialization
  loadDates();
  fetchApiMatches();
  setInterval(fetchApiMatches, 60000);
}
