const firebaseConfig = {
  apiKey: "AIzaSyAbdohB61du6uE627zE7suf7kRk9eIw60U",
  authDomain: "zonera-e4b13.firebaseapp.com",
  projectId: "zonera-e4b13",
  storageBucket: "zonera-e4b13.firebasestorage.app",
  messagingSenderId: "176063306389",
  appId: "1:176063306389:web:b4dfadc3f89b502eed999c"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log('Firebase initialized successfully!');