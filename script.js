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
  const statuses = ['NS', 'FT']; // Upcoming & finished
  try {
    for (let status of statuses) {
      const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?status=${status}`, {
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
          status: match.fixture.status.short,
          date: new Date(match.fixture.timestamp * 1000)
        };
        saveMatchResult(matchData);
      });
    }
  } catch (err) {
    console.error(err);
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
