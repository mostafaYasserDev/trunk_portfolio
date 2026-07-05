import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    initializeFirestore,
    memoryLocalCache,
    collection,
    getDocs,
    getDoc,
    addDoc,
    doc,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAqK2VazT29vjowHKS1fOVhZhPD0vDC-uc",
    authDomain: "jidhe-trunk.firebaseapp.com",
    projectId: "jidhe-trunk",
    storageBucket: "jidhe-trunk.firebasestorage.app",
    messagingSenderId: "722522762042",
    appId: "1:722522762042:web:1ed434e2402c944a2b7e03",
    measurementId: "G-CBV9VR0ELW"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
    localCache: memoryLocalCache()
});

export {
    app,
    db,
    collection,
    getDocs,
    getDoc,
    addDoc,
    doc,
    query,
    where,
    orderBy,
    limit
};
