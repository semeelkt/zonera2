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
    
    const leagueSection = document.createElement('div');
    leagueSection.className = 'league-section';
    
    const leagueHeader = document.createElement('div');
    leagueHeader.className = 'league-header';
    leagueHeader.innerHTML = `
      <div class="league-info">
        <span class="league-logo">${league.logo}</span>
        <div>
          <h3>${league.name}</h3>
          <p>${league.country}</p>
        </div>
      </div>
      <button class="expand-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    `;
    
    const matchList = document.createElement('div');
    matchList.className = 'match-list';
    
    filteredMatches.forEach((match, index) => {
      const matchCard = createMatchCard(match);
      matchList.appendChild(matchCard);
      
      // Animate
      setTimeout(() => {
        matchCard.style.opacity = '1';
        matchCard.style.transform = 'translateY(0)';
      }, index * 50);
    });
    
    leagueSection.appendChild(leagueHeader);
    leagueSection.appendChild(matchList);
    container.appendChild(leagueSection);
  });
}

// Create individual match card
function createMatchCard(match) {
  const card = document.createElement('div');
  card.className = `match-card ${match.status}`;
  card.dataset.matchId = match.id;
  
  const scoreDisplay = match.status === 'upcoming' 
    ? `<div class="match-time">${match.time}</div>`
    : `
      <div class="match-score">
        <span class="score-home">${match.homeScore}</span>
        <span class="score-separator">-</span>
        <span class="score-away">${match.awayScore}</span>
      </div>
    `;
  
  const statusBadge = match.status === 'live' 
    ? `<span class="status-badge live-badge"><span class="live-pulse"></span>${match.minute}</span>`
    : match.status === 'finished'
    ? `<span class="status-badge finished-badge">${match.minute}</span>`
    : `<span class="status-badge upcoming-badge">VS</span>`;
  
  card.innerHTML = `
    <div class="match-main">
      <div class="match-header">
        <span class="match-time-small">${match.time}</span>
        ${statusBadge}
      </div>
      <div class="match-teams">
        <div class="team home-team">
          <span class="team-logo">🔵</span>
          <span class="team-name">${match.homeTeam}</span>
        </div>
        ${scoreDisplay}
        <div class="team away-team">
          <span class="team-name">${match.awayTeam}</span>
          <span class="team-logo">🔴</span>
        </div>
      </div>
      ${match.status !== 'upcoming' ? `
        <div class="view-details-hint">
          <span>Tap for match details</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      ` : ''}
    </div>
    ${match.status !== 'upcoming' ? `
      <div class="match-details">
        <div class="details-header">
          <h4>Match Statistics</h4>
          <button class="close-details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
        </div>
        <div class="match-stats">
          <div class="stat-row">
            <span class="stat-value-home">${match.homeShots}</span>
            <div class="stat-info">
              <span class="stat-label">Shots</span>
              <div class="stat-bar">
                <div class="stat-bar-fill home" style="width: ${(match.homeShots / (match.homeShots + match.awayShots) * 100)}%"></div>
                <div class="stat-bar-fill away" style="width: ${(match.awayShots / (match.homeShots + match.awayShots) * 100)}%"></div>
              </div>
            </div>
            <span class="stat-value-away">${match.awayShots}</span>
          </div>
          <div class="stat-row">
            <span class="stat-value-home">${Math.floor(match.homeShots * 0.4)}</span>
            <div class="stat-info">
              <span class="stat-label">Shots on Target</span>
              <div class="stat-bar">
                <div class="stat-bar-fill home" style="width: ${match.homePossession}%"></div>
                <div class="stat-bar-fill away" style="width: ${match.awayPossession}%"></div>
              </div>
            </div>
            <span class="stat-value-away">${Math.floor(match.awayShots * 0.35)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-value-home">${match.homePossession}%</span>
            <div class="stat-info">
              <span class="stat-label">Possession</span>
              <div class="stat-bar">
                <div class="stat-bar-fill home" style="width: ${match.homePossession}%"></div>
                <div class="stat-bar-fill away" style="width: ${match.awayPossession}%"></div>
              </div>
            </div>
            <span class="stat-value-away">${match.awayPossession}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-value-home">${Math.floor(Math.random() * 8 + 3)}</span>
            <div class="stat-info">
              <span class="stat-label">Corners</span>
              <div class="stat-bar">
                <div class="stat-bar-fill home" style="width: 55%"></div>
                <div class="stat-bar-fill away" style="width: 45%"></div>
              </div>
            </div>
            <span class="stat-value-away">${Math.floor(Math.random() * 7 + 2)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-value-home">${Math.floor(Math.random() * 3 + 1)}</span>
            <div class="stat-info">
              <span class="stat-label">Fouls</span>
              <div class="stat-bar">
                <div class="stat-bar-fill home" style="width: 50%"></div>
                <div class="stat-bar-fill away" style="width: 50%"></div>
              </div>
            </div>
            <span class="stat-value-away">${Math.floor(Math.random() * 3 + 1)}</span>
          </div>
        </div>
        <div class="match-actions">
          <button class="action-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Watch Highlights
          </button>
          <button class="action-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            Save Match
          </button>
        </div>
      </div>
    ` : ''}
  `;
  
  // Add click handler to toggle details
  card.addEventListener('click', (e) => {
    // Don't toggle if clicking close button or action buttons
    if (e.target.closest('.close-details') || e.target.closest('.action-btn')) {
      return;
    }
    
    // Close all other open cards
    document.querySelectorAll('.match-card.expanded').forEach(openCard => {
      if (openCard !== card) {
        openCard.classList.remove('expanded');
      }
    });
    
    // Toggle current card
    card.classList.toggle('expanded');
  });
  
  // Close button handler
  const closeBtn = card.querySelector('.close-details');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.remove('expanded');
    });
  }
  
  return card;
}

// Filter functionality
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadMatches();
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
  // News Form Logic
  const newsForm = document.getElementById('news-form');
  const newsSuccess = document.getElementById('news-success');
  const newsList = document.getElementById('news-list');

  // Helper: Upload image to Firebase Storage (if available)
  async function uploadImage(file) {
    if (!file || typeof firebase === 'undefined' || !firebase.storage) return null;
    const storageRef = firebase.storage().ref('news-images/' + Date.now() + '-' + file.name);
    await storageRef.put(file);
    return await storageRef.getDownloadURL();
  }

  // Add News
  if (newsForm) {
    newsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('news-title').value.trim();
      const content = document.getElementById('news-content').value.trim();
      const imageInput = document.getElementById('news-image');
      let imageUrl = '';
      newsSuccess.style.display = 'none';
      if (imageInput && imageInput.files && imageInput.files[0]) {
        // Try upload image to Firebase Storage
        try {
          imageUrl = await uploadImage(imageInput.files[0]);
        } catch (err) {
          console.error('Image upload error:', err);
          imageUrl = '';
        }
      }
      // Save news to Firestore
      if (typeof db !== 'undefined') {
        try {
          await db.collection('news').add({
            title,
            content,
            imageUrl,
            created: new Date().toISOString()
          });
          newsSuccess.textContent = 'News added!';
          newsSuccess.style.display = 'block';
          newsForm.reset();
          await loadNews();
        } catch (err) {
          console.error('Error saving news:', err);
          newsSuccess.textContent = 'Error saving news.';
          newsSuccess.style.display = 'block';
        }
      } else {
        newsSuccess.textContent = 'Firebase not available.';
        newsSuccess.style.display = 'block';
        console.error('Firebase not available.');
      }
    });
  }

  // Load News and Display Cards
  async function loadNews() {
    if (typeof db === 'undefined' || !newsList) {
      console.error('Cannot load news: Firebase or newsList missing');
      return;
    }
    try {
      const snapshot = await db.collection('news').orderBy('created', 'desc').get();
      newsList.innerHTML = '';
      // Create a unique container box for news
      const newsContainer = document.createElement('div');
      newsContainer.className = 'news-container-box';
      snapshot.forEach(doc => {
        const news = doc.data();
        const card = document.createElement('div');
        card.className = 'news-card';
        // Use a fallback if imageUrl is missing or invalid
        let imgSrc = news.imageUrl && news.imageUrl.startsWith('http') ? news.imageUrl : 'https://via.placeholder.com/80x80?text=No+Image';
        card.innerHTML = `
          <img class="news-card-img" src="${imgSrc}" alt="News Image" onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'">
          <div class="news-card-content">
            <div class="news-card-title">${news.title}</div>
            <div class="news-card-preview">${news.content}</div>
          </div>
          <button class="news-delete-btn" title="Delete News">🗑️</button>
        `;
        card.addEventListener('click', (e) => {
          // Prevent modal if clicking delete button
          if (e.target.classList.contains('news-delete-btn')) return;
          showNewsModal(news);
        });
        // Delete button handler
        card.querySelector('.news-delete-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('Are you sure you want to delete this news?')) {
            try {
              await db.collection('news').doc(doc.id).delete();
              await loadNews();
            } catch (err) {
              alert('Error deleting news.');
              console.error('Delete error:', err);
            }
          }
        });
        newsContainer.appendChild(card);
      });
      newsList.appendChild(newsContainer);
    } catch (err) {
      console.error('Error loading news:', err);
    }
  }

  // Show full news modal (simple implementation)
  function showNewsModal(news) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:500px;">
        <span class="close" id="close-news-modal">&times;</span>
        <h2>${news.title}</h2>
        <img src="${news.imageUrl || 'https://via.placeholder.com/300x180?text=No+Image'}" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;margin-bottom:16px;">
        <p style="color:#E8E8E8;font-size:1.08rem;">${news.content}</p>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('close-news-modal').onclick = () => {
      modal.remove();
    };
    window.onclick = (event) => {
      if (event.target === modal) modal.remove();
    };
  }

  // Initial load
  loadNews();
  // Admin Login Modal & Panel Logic
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const adminModal = document.getElementById('admin-modal');
  const closeAdminModal = document.getElementById('close-admin-modal');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminLoginError = document.getElementById('admin-login-error');
  const adminPanel = document.getElementById('admin-panel');

  if (adminLoginBtn && adminModal && closeAdminModal) {
    adminLoginBtn.addEventListener('click', () => {
      adminModal.style.display = 'flex';
    });
    closeAdminModal.addEventListener('click', () => {
      adminModal.style.display = 'none';
    });
    window.addEventListener('click', (event) => {
      if (event.target === adminModal) {
        adminModal.style.display = 'none';
      }
    });
  }

  // Admin Login Authentication
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value;
      const password = document.getElementById('admin-password').value;
      adminLoginError.style.display = 'none';
      try {
        // Only allow specific admin credentials
  if (email === 'mrflux3602@gmail.com' && password === '3602mskt') {
          adminModal.style.display = 'none';
          if (adminPanel) adminPanel.style.display = 'block';
        } else {
          throw new Error('Invalid credentials');
        }
      } catch (err) {
        adminLoginError.textContent = 'Invalid email or password.';
        adminLoginError.style.display = 'block';
      }
    });
  }

    // Fetch all matches (live, finished, fixtures)
    async function fetchAllMatches() {
      const url = 'https://api-football-v1.p.rapidapi.com/v3/fixtures?season=2025&league=your_league_id';
      // Replace 'your_league_id' with the actual league ID you want, or remove for all
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': '617e8c14cae54043649b511c841119f4',
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
          }
        });
        const data = await response.json();
        data.response.forEach(match => {
          const matchData = {
            homeTeam: match.teams.home.name,
            awayTeam: match.teams.away.name,
            homeScore: match.goals.home,
            awayScore: match.goals.away,
            status: match.fixture.status.short, // FT, NS, 1H, 2H, etc.
            minute: match.fixture.status.elapsed || '',
            date: new Date(match.fixture.timestamp * 1000)
          };
          saveMatchResult(matchData);
        });
      } catch (error) {
        console.error('Error fetching all matches:', error);
      }
    }

    // Save match to Firestore
    async function saveMatchResult(matchData) {
      try {
        await db.collection('matches').add(matchData);
        console.log('Match saved ✅', matchData);
      } catch (error) {
        console.error('Error saving match: ', error);
      }
    }

    // Fetch all matches every 60 seconds
    fetchAllMatches();
    setInterval(fetchAllMatches, 60000);


  // Site Initialization
  loadDates();
  // Check if Firebase is available
  if (typeof db !== 'undefined') {
    console.log('Loading data from Firebase...');
    fetchMatchesFromFirebase();
    // Enable real-time updates (optional)
    // listenToMatchUpdates();
  } else {
    console.log('Firebase not available, using mock data...');
    loadMockData();
  }
}
