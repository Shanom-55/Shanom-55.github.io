// ===== Firebase Configuration =====
// Shanom Portfolio — Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBPIIkqBkMKhX9JV3e2JAt_Hj3-Dkicg94",
  authDomain: "shanom-2944f.firebaseapp.com",
  projectId: "shanom-2944f",
  storageBucket: "shanom-2944f.firebasestorage.app",
  messagingSenderId: "973027895131",
  appId: "1:973027895131:web:180750f659c05e12c79c7e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
