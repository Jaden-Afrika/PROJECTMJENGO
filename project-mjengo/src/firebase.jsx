
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCt4jLJ3HSJQR6HblVAdn1-jCXt01tinGU",
  authDomain: "project-mjengo.firebaseapp.com",
  projectId: "project-mjengo",
  storageBucket: "project-mjengo.firebasestorage.app",
  messagingSenderId: "333484754258",
  appId: "1:333484754258:web:3a20882f1fb1f8d3ebabd3",
  measurementId: "G-4PKCBDHN83"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
