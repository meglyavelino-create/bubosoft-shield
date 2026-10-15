import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBGJFO9qxu1C-gn-NTtN6jwzIc0e_KC0iw",
  authDomain: "bubosoft-shield.firebaseapp.com",
  databaseURL: "https://bubosoft-shield-default-rtdb.firebaseio.com",
  projectId: "bubosoft-shield",
  storageBucket: "bubosoft-shield.firebasestorage.app",
  messagingSenderId: "954224143317",
  appId: "1:954224143317:web:d977fae3da914c11302b5c",
  measurementId: "G-0PJP98E63G"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
