import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, limit, getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export { onAuthStateChanged, collection, addDoc, query, where, onSnapshot, orderBy, limit, getDoc, doc, setDoc, serverTimestamp };
export type { User };
