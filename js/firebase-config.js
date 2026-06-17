import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDl8SYdtPzaw_fwtbK_o24JZ1bIb8JnbA8",
    authDomain: "saeumeconomysystem2026.firebaseapp.com",
    projectId: "saeumeconomysystem2026",
    storageBucket: "saeumeconomysystem2026.firebasestorage.app",
    messagingSenderId: "475976322417",
    appId: "1:475976322417:web:4f0e5131c178c3428e3ad0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);