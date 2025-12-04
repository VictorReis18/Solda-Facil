// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// ✅ TROQUE AQUI PELA SUA CONFIG
const firebaseConfig = {
      apiKey: "AIzaSyCfHezkpGYdgvt_6euD1drBZ4fb39aSNr8",
  authDomain: "soldafacil-3ea8f.firebaseapp.com",
  projectId: "soldafacil-3ea8f",
  storageBucket: "soldafacil-3ea8f.firebasestorage.app",
  messagingSenderId: "933275857351",
  appId: "1:933275857351:web:341ed83cb8de3e626d29e2",
  measurementId: "G-WL5YHJCBBJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = document.getElementById("email");
const senha = document.getElementById("senha");
const loginBtn = document.getElementById("btnLogin");
const erro = document.getElementById("erro");

loginBtn.addEventListener("click", () => {
    signInWithEmailAndPassword(auth, email.value, senha.value)
        .then(() => {
            window.location.href = "home.html";
        })
        .catch(e => {
            erro.textContent = e.message;
        });
});

// Se já está logado, vai direto ao painel
onAuthStateChanged(auth, user => {
    if (user) {
        window.location.href = "home.html";
    }
});
