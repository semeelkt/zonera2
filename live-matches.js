// === ZONERA LIVE MATCHES (PRO STYLE) ===

const API_KEY = "617e8c14cae54043649b511c841119f4"; 

async function fetchLiveMatches() {
  const url = "https://v3.football.api-sports.io/fixtures?live=all";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io"
      }
    });

    const data = await response.json();
    const matchesContainer = document.getElementById("live-matches");
    matchesContainer.innerHTML = "";

    if (data.response && data.response.length > 0) {
      data.response.forEach(match => {
        const league = match.league.name;
        const home = match.teams.home;
        const away = match.teams.away;
        const scoreHome = match.goals.home ?? 0;
        const scoreAway = match.goals.away ?? 0;
        const status = match.fixture.status.short;
        const time = match.fixture.status.elapsed || 0;

        const matchCard = document.createElement("div");
        matchCard.classList.add("live-match-card");
        matchCard.innerHTML = `
          <div class="live-match-logo">⚽</div>
          <div class="live-match-info">
            <div class="league-name" style="font-weight:700;color:#0099ff;margin-bottom:4px;">${league}</div>
            <div class="live-match-teams">
              <img src="${home.logo}" alt="${home.name}" class="team-logo" style="width:28px;height:28px;vertical-align:middle;margin-right:6px;border-radius:50%;border:2px solid #00d266;box-shadow:0 0 8px #00d26688;">
              <span>${home.name}</span>
              <span style="color:#fff;font-weight:800;margin:0 10px;">${scoreHome} - ${scoreAway}</span>
              <span>${away.name}</span>
              <img src="${away.logo}" alt="${away.name}" class="team-logo" style="width:28px;height:28px;vertical-align:middle;margin-left:6px;border-radius:50%;border:2px solid #0099ff;box-shadow:0 0 8px #0099ff88;">
            </div>
            <div class="live-match-score">${status === "1H" || status === "2H" ? `<span class='live-dot'></span> ${time}'` : status}</div>
            <div class="live-match-status">${status === "1H" ? "1st Half" : status === "2H" ? "2nd Half" : status}</div>
          </div>
        `;
        matchesContainer.appendChild(matchCard);
      });
    } else {
      matchesContainer.innerHTML = "<p class='no-match'>No live matches right now ⚽</p>";
    }
  } catch (error) {
    console.error("Error fetching live matches:", error);
  }
}

fetchLiveMatches();
setInterval(fetchLiveMatches, 60000);
