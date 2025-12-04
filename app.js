// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";


const firebaseConfig = {
      //Dados do servidor
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
