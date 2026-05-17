// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCt4jLJ3HSJQR6HblVAdn1-jCXt01tinGU",
  authDomain: "project-mjengo.firebaseapp.com",
  projectId: "project-mjengo",
  storageBucket: "project-mjengo.firebasestorage.app",
  messagingSenderId: "333484754250",
  appId: "1:333484754250:web:3a28082f1fb1f0d3abadb3",
  measurementId: "G-4PKCBDHN6J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);