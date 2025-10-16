# Firebase Setup Guide for Zonera

## ✅ What's Done
Your website is now connected to Firebase! Here's what was added:

1. **Firebase SDK** loaded in `index.html`
2. **Firebase initialized** in `firebase-config.js`
3. **Script.js updated** to fetch data from Firestore

## 🗄️ Database Structure

You need to create two collections in your Firebase Firestore:

### Collection 1: `leagues`
Each document represents a league:

```javascript
// Document ID: premier-league
{
  name: "Premier League",
  country: "England",
  logo: "🏴󠁧󠁢󠁥󠁮󠁧󠁿"
}

// Document ID: la-liga
{
  name: "La Liga",
  country: "Spain",
  logo: "🇪🇸"
}

// Document ID: serie-a
{
  name: "Serie A",
  country: "Italy",
  logo: "🇮🇹"
}
```

### Collection 2: `matches`
Each document represents a match:

```javascript
// Example Match Document
{
  leagueId: "premier-league",          // Links to leagues collection
  homeTeam: "Manchester City",
  awayTeam: "Arsenal",
  homeScore: 2,
  awayScore: 2,
  status: "live",                      // "live", "finished", or "upcoming"
  minute: "78'",
  homeShots: 14,
  awayShots: 11,
  homePossession: 58,
  awayPossession: 42,
  time: "15:00"
}
```

## 📝 How to Add Data to Firebase

### Option 1: Firebase Console (Manual)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **zonera-e4b13**
3. Click **Firestore Database** in the left menu
4. Click **Start collection**
5. Create `leagues` collection and add documents
6. Create `matches` collection and add documents

### Option 2: Use the Data Upload Script (Automated)
I can create a script that uploads sample data automatically. Just let me know!

## 🔥 Features Now Available

✅ **Real-time data** from Firestore  
✅ **Automatic fallback** to mock data if Firebase fails  
✅ **Live updates** (optional - uncomment in code)  
✅ **Scalable structure** - easy to add more leagues/matches

## 🚀 Testing

1. Open `index.html` in your browser
2. Open Developer Console (F12)
3. You should see: "Firebase initialized successfully!"
4. If no data in Firestore, it will show mock data

## 📊 Real-time Updates (Optional)

To enable live updates when data changes in Firebase, uncomment this line in `script.js`:

```javascript
// listenToMatchUpdates();  // Remove the // to enable
```

## 🔒 Security Rules (Important!)

Your Firestore needs proper security rules. Go to Firestore → Rules and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to everyone
    match /{document=**} {
      allow read: if true;
      allow write: if false;  // Change this if you want to allow writes
    }
  }
}
```

## 🎉 You're All Set!

Your website is now Firebase-ready. Add some data to Firestore and watch it appear on your site!
