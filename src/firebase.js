// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC8Zz7GTCyCP8k5nXnlHjBEIWhW5DJ39aU",
  authDomain: "dreidel-ea72b.firebaseapp.com",
  databaseURL: "https://dreidel-ea72b-default-rtdb.firebaseio.com",
  projectId: "dreidel-ea72b",
  storageBucket: "dreidel-ea72b.firebasestorage.app",
  messagingSenderId: "726076256547",
  appId: "1:726076256547:web:808d4d392d6ae73b7d1c96",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
