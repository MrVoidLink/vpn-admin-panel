// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD4c53PvKYBK_KCEkVjl6ugR5mu1dPbKMQ",
  authDomain: "my-app-64fa0.firebaseapp.com",
  projectId: "my-app-64fa0",
  storageBucket: "my-app-64fa0.firebasestorage.app",
  messagingSenderId: "838490999723",
  appId: "1:838490999723:web:eaf6a6668b646fc1d2e0ee",
  measurementId: "G-6B9CZKEL0Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export default app;
