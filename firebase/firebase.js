import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, updatePassword, updateEmail, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, limit, setDoc, onSnapshot, startAfter } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAqK2VazT29vjowHKS1fOVhZhPD0vDC-uc",
  authDomain: "jidhe-trunk.firebaseapp.com",
  projectId: "jidhe-trunk",
  storageBucket: "jidhe-trunk.firebasestorage.app",
  messagingSenderId: "722522762042",
  appId: "1:722522762042:web:1ed434e2402c944a2b7e03",
  measurementId: "G-CBV9VR0ELW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { 
    app, 
    auth, 
    db,
    storage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail,
    updatePassword,
    updateEmail,
    createUserWithEmailAndPassword,
    collection, 
    getDocs, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    setDoc,
    onSnapshot,
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter
};
