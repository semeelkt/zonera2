from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os
from datetime import datetime, timedelta
import json
import threading

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Global cache for all matches with intelligent updates
matches_cache = {
    'all_matches': [],
    'last_update': None,
    'is_updating': False
}

UPDATE_INTERVAL = timedelta(minutes=2)  # Update every 2 minutes for live matches

# APIs Configuration
API_TOKEN_FOOTBALL_DATA = 'fd81f1998248477eb823f962a071cf6e'
API_BASE_FOOTBALL_DATA = 'https://api.football-data.org/v4/matches'

RAPID_API_KEY = '4914c5579ad32ca25b604e5c265158b5'
RAPID_API_HOST = 'api-football-v1.p.rapidapi.com'
RAPID_API_BASE = 'https://api-football-v1.p.rapidapi.com/v3/fixtures'

def fetch_all_global_matches():
    """Fetch matches from ALL available APIs - FAST MODE"""
    all_matches = []

    # 1. Football-Data.org - ALL STATUSES at once
    print("[1] Fetching from Football-Data.org...")
    try:
        headers = {'X-Auth-Token': API_TOKEN_FOOTBALL_DATA}
        params = {'status': 'LIVE,FINISHED,SCHEDULED,PAUSED', 'limit': 500}
        response = requests.get(API_BASE_FOOTBALL_DATA, headers=headers, params=params, timeout=20)

        if response.ok:
            data = response.json()
            matches = data.get('matches', [])
            all_matches.extend(matches)
            print(f"  ✅ Got {len(matches)} matches")
    except Exception as e:
        print(f"  ✗ Error: {str(e)[:60]}")

    # 2. RapidAPI - Fetch top 5 leagues CONCURRENTLY
    print("[2] Fetching from RapidAPI (Top leagues)...")
    try:
        headers = {
            'X-RapidAPI-Key': RAPID_API_KEY,
            'X-RapidAPI-Host': RAPID_API_HOST
        }

        # Top 5 global leagues only (to avoid rate limiting)
        top_leagues = [39, 140, 78, 61, 135]  # Premier, LaLiga, Bundesliga, Serie A, Ligue1

        rapidapi_matches = 0
        for league_id in top_leagues:
            try:
                params = {'league': league_id, 'season': 2025, 'last': 50}
                response = requests.get(RAPID_API_BASE, headers=headers, params=params, timeout=8)

                if response.ok and response.status_code != 429:
                    data = response.json()
                    if data.get('response'):
                        for fixture in data['response']:
                            try:
                                match = {
                                    'id': f"rapidapi_{fixture['fixture']['id']}",
                                    'utcDate': fixture['fixture']['date'],
                                    'status': fixture['fixture']['status']['short'].upper(),
                                    'minute': fixture['fixture']['status'].get('elapsed', 0),
                                    'homeTeam': {
                                        'name': fixture['teams']['home']['name'],
                                        'crest': fixture['teams']['home'].get('logo', '')
                                    },
                                    'awayTeam': {
                                        'name': fixture['teams']['away']['name'],
                                        'crest': fixture['teams']['away'].get('logo', '')
                                    },
                                    'score': {
                                        'fullTime': {
                                            'home': fixture['goals']['home'],
                                            'away': fixture['goals']['away']
                                        }
                                    },
                                    'competition': {
                                        'name': fixture['league']['name']
                                    }
                                }
                                all_matches.append(match)
                                rapidapi_matches += 1
                            except:
                                pass
            except:
                pass

        if rapidapi_matches > 0:
            print(f"  ✅ Got {rapidapi_matches} matches")
    except Exception as e:
        print(f"  ✗ Error: {str(e)[:60]}")

    print(f"\n📊 TOTAL BEFORE DEDUP: {len(all_matches)} matches\n")
    return all_matches

def deduplicate_matches(matches):
    """Remove duplicate matches"""
    seen = {}
    unique_matches = []

    for match in matches:
        key = (
            match['homeTeam']['name'].lower(),
            match['awayTeam']['name'].lower(),
            match['utcDate'][:10] if match.get('utcDate') else 'unknown'
        )

        # Keep match with best status (LIVE > FINISHED > SCHEDULED)
        status_priority = {'LIVE': 0, 'IN_PLAY': 0, 'FINISHED': 1, 'TIMED': 2, 'SCHEDULED': 2}
        current_priority = status_priority.get(match.get('status', 'UNKNOWN'), 999)

        if key not in seen or current_priority < status_priority.get(seen[key].get('status', 'UNKNOWN'), 999):
            seen[key] = match

    unique_matches = list(seen.values())
    return unique_matches

def sort_matches(matches):
    """Sort matches: LIVE first, then FINISHED, then SCHEDULED"""
    status_order = {
        'LIVE': 0,
        'IN_PLAY': 0,
        'FINISHED': 1,
        'TIMED': 2,
        'SCHEDULED': 2,
        'PAUSED': 0.5
    }

    matches.sort(key=lambda x: (
        status_order.get(x.get('status', 'UNKNOWN'), 999),
        x.get('utcDate', '')
    ))

    return matches

def update_global_matches():
    """Update global matches cache"""
    print(f"\n{'='*60}")
    print(f"UPDATING GLOBAL MATCHES - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print('='*60)

    try:
        all_matches = fetch_all_global_matches()
        unique_matches = deduplicate_matches(all_matches)
        sorted_matches = sort_matches(unique_matches)

        matches_cache['all_matches'] = sorted_matches
        matches_cache['last_update'] = datetime.now()

        # Count statistics
        stats = {}
        for match in sorted_matches:
            status = match.get('status', 'UNKNOWN')
            stats[status] = stats.get(status, 0) + 1

        print(f"\n✅ UPDATE COMPLETE")
        print(f"Total matches: {len(sorted_matches)}")
        print(f"Status breakdown: {stats}")
        print('='*60 + '\n')

    except Exception as e:
        print(f"❌ Error updating matches: {e}")

@app.route('/')
def serve_index():
    """Serve the main HTML file"""
    return send_from_directory('.', 'index.html')

@app.route('/api/matches', methods=['GET'])
def get_matches():
    """Get ALL global matches with live status"""
    # Update if cache is stale
    if not matches_cache['last_update'] or datetime.now() - matches_cache['last_update'] > UPDATE_INTERVAL:
        update_global_matches()

    matches = matches_cache['all_matches']

    # Calculate statistics
    stats = {'total': len(matches)}
    for match in matches:
        status = match.get('status', 'UNKNOWN')
        stats[status] = stats.get(status, 0) + 1

    print(f"Serving {len(matches)} matches to client")

    return jsonify({
        'matches': matches,
        'statistics': stats,
        'lastUpdate': matches_cache['last_update'].isoformat() if matches_cache['last_update'] else None
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # Load initial data in background to not block server startup
    def load_initial_data():
        print("\n" + "="*60)
        print("Loading global matches...")
        print("="*60)
        update_global_matches()

    # Start background thread
    thread = threading.Thread(target=load_initial_data, daemon=True)
    thread.start()

    port = int(os.environ.get('PORT', 5000))
    print(f"\n✅ Server starting on port {port}...")
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
