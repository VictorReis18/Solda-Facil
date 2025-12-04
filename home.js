import {
    getAuth, onAuthStateChanged, signOut,
    reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import {
    getStorage,
    ref,
    listAll,
    getDownloadURL,
    uploadBytes,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";

const firebaseConfig = {
  //Dados do servidor
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

let pastaAtual = ""; // caminho atual (pasta raiz do usuário)
let userRootPath = ""; // caminho raiz do usuário

const listaConteudo = document.getElementById("listaConteudo");
const pastaLabel = document.getElementById("pastaAtual");

const voltarBtn = document.getElementById("voltarBtn");
const arquivoInput = document.getElementById("arquivo");
const logoutBtn = document.getElementById("logoutBtn");
const deleteBtn = document.getElementById("deleteBtn");
const toggleUploadBtn = document.getElementById("toggleUploadBtn");
const msg = document.getElementById("msg");

// Elementos do Modal
const passwordModal = document.getElementById('passwordModal');
const passwordConfirmInput = document.getElementById('passwordConfirm');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const modalError = document.getElementById('modalError');

// Variáveis para controlar a ação do modal de senha
let actionToConfirm = null; // Guarda a ação pendente ('upload' ou 'delete')
let filesToUpload = null;   // Guarda os arquivos para upload pendente

// Controle para evitar condição de corrida ao navegar rapidamente
// Incrementa a cada chamada de `carregarConteudo` para invalidar renderizações antigas.
let loadingVersion = 0;

// Configura o worker para a biblioteca pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;


//Funcao que se o usuario nao estiver logado, ele é direcionado para o login
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    window.uid = user.uid;
    userRootPath = `users/${user.uid}/`;
    pastaAtual = userRootPath;

    pastaLabel.textContent = "Raiz/";

    carregarConteudo(); //chama a funcao para exibir os arquvios do usuario
});

// IntersectionObserver para Lazy Loading das miniaturas
const thumbnailObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const iframe = entry.target;
            const url = iframe.dataset.src; // Pega a URL que guardamos
             
            // Inicia a renderização da miniatura
            renderHTMLThumbnail(url, iframe);

            // Para de observar este iframe, pois o trabalho já foi feito
            observer.unobserve(iframe);
        }
    });
}, { rootMargin: '100px' }); // Começa a carregar 100px antes de aparecer na tela


//--------------------------- AQUI É O CORACAO DO PROJETO----------------------
async function carregarConteudo() {
    // Incrementa a versão de carregamento e captura a versão atual para esta execução.
    loadingVersion++;
    const currentVersion = loadingVersion;

    // Limpa o conteúdo anterior e exibe o indicador de carregamento.
    listaConteudo.innerHTML = `
        <div class="loader-container">
            <div class="loader"></div>
            <p>Carregando...</p>
        </div>
    `;
    deleteBtn.style.display = "none";

    const pastaRef = ref(storage, pastaAtual);
    const resultado = await listAll(pastaRef);

    // Combina pastas e arquivos em uma única lista para ordenação
    const items = [];

    //separa em duas listas: pastas (prefixes) e arquivos (items)
    resultado.prefixes.forEach(folderRef => {
        items.push({ type: 'folder', ref: folderRef, name: folderRef.name });
    });
    for (const fileRef of resultado.items) {
        items.push({ type: 'file', ref: fileRef, name: fileRef.name });
    }

    // Função para atribuir um peso de ordenação a cada tipo de item
    const getSortWeight = (item) => {
        if (item.type === 'folder') {
            return 0; // Pastas primeiro
        }
        const nameLower = item.name.toLowerCase();
        if (nameLower.endsWith('.pdf')) {
            return 1; // PDFs em segundo
        }
        if (nameLower.endsWith('.html')) {
            return 2; // HTMLs em terceiro
        }
        return 3; // Outros arquivos por último
    };

    // Ordena a lista com base no peso e, em seguida, alfabeticamente
    items.sort((a, b) => {
        const weightA = getSortWeight(a);
        const weightB = getSortWeight(b);

        if (weightA !== weightB) {
            return weightA - weightB; // Ordena pelo peso do tipo
        }
        return a.name.localeCompare(b.name); // Se o tipo for o mesmo, ordena alfabeticamente
    });

    // Cria todos os elementos da lista em paralelo para evitar o carregamento item a item
    const listItemsPromises = items.map(async (item) => {
        const li = document.createElement("li");

        if (item.type === 'folder') {
            const folderImage = document.createElement('img');
            folderImage.className = 'folder-image';

            let baseName = item.name.endsWith('/') ? item.name.slice(0, -1) : item.name;
            const imageName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
            const imagePath = `imagens/${imageName}.png`;

            try {
                const imageUrl = await getDownloadURL(ref(storage, imagePath));
                folderImage.src = imageUrl;
            } catch (error) {
                try {
                    const defaultImageUrl = await getDownloadURL(ref(storage, 'imagens/default.png'));
                    folderImage.src = defaultImageUrl;
                } catch (defaultError) {
                    console.error("ERRO ao buscar imagem padrão. Usando ícone local.", defaultError.code);
                    folderImage.src = 'img/folder-icon.png';
                    folderImage.alt = "Ícone de pasta";
                }
            }

            const folderName = document.createElement('span');
            folderName.textContent = item.name;
            li.append(folderImage, folderName);
            li.onclick = () => abrirPasta(`${item.name}/`);
        } else { // É um arquivo (file)
            const itemRef = item.ref;
            const url = await getDownloadURL(itemRef);
            const isPDF = itemRef.name.toLowerCase().endsWith('.pdf');
            const isHTML = itemRef.name.toLowerCase().endsWith('.html');

            // Checkbox para exclusão
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'delete-checkbox';
            checkbox.value = itemRef.fullPath;
            checkbox.dataset.type = 'file';
            li.appendChild(checkbox);

            // Miniatura (Thumbnail)
            if (isPDF) {
                const canvas = document.createElement('canvas');
                canvas.className = 'pdf-thumbnail';
                li.appendChild(canvas);
                renderPDFThumbnail(url, canvas);
            } else if (isHTML) {
                const iframe = document.createElement('iframe');
                iframe.className = 'html-thumbnail';
                iframe.classList.add('thumbnail-loading');
                // Adiciona o iframe ao observer para lazy loading
                iframe.dataset.src = url; // Guarda a URL para o observer
                thumbnailObserver.observe(iframe);
                li.appendChild(iframe);
            }

            // Link para o arquivo
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.textContent = itemRef.name;
            li.appendChild(link);
        }
        return li;
    });

    // Espera todas as promises serem resolvidas
    const listItems = await Promise.all(listItemsPromises);

    // Adiciona todos os itens de uma vez ao DOM
    // ❗️ Ponto Crítico: Apenas renderiza se esta for a chamada mais recente.
    if (currentVersion !== loadingVersion) {
        console.log("Renderização cancelada: uma navegação mais recente foi iniciada.");
        return; // Aborta a renderização para evitar a condição de corrida.
    }

    // Limpa o indicador de carregamento antes de adicionar o novo conteúdo.
    listaConteudo.innerHTML = "";

    const fragment = document.createDocumentFragment();
    listItems.forEach(li => fragment.appendChild(li));
    listaConteudo.appendChild(fragment);


    // Mostra o botão de deletar se houver arquivos
    deleteBtn.style.display = resultado.items.length > 0 ? "inline-block" : "none";

    // Atualiza label da pasta atual
    const displayPath = pastaAtual.replace(userRootPath, '');
    pastaLabel.textContent = displayPath;

    // Mostra ou esconde o botão de voltar
    voltarBtn.style.display = pastaAtual === userRootPath ? "none" : "inline-block";
}

window.abrirPasta = function (sub) {
    pastaAtual += sub;
    carregarConteudo();
};

voltarBtn.onclick = () => {
    // Não permite voltar além da pasta raiz do usuário
    if (pastaAtual === userRootPath) {
        return;
    }

    // Remove a última parte do caminho. Ex: "users/uid/pasta1/" -> "users/uid/"
    const pathParts = pastaAtual.split('/').filter(p => p.length > 0);
    pathParts.pop();
    pastaAtual = pathParts.join('/') + '/';
    carregarConteudo();
};

async function renderPDFThumbnail(url, canvas) {
    try {
        const loadingTask = pdfjsLib.getDocument({ url });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // Pega a primeira página

        const viewport = page.getViewport({ scale: 0.2 }); // Escala ajustada para miniatura menor
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
    } catch (error) {
        console.error('Erro ao renderizar miniatura do PDF:', error);
    }
}

async function renderHTMLThumbnail(url, iframe) {
    try {
        // 1. Busca o conteúdo do arquivo HTML como texto
        const response = await fetch(url);
        const htmlText = await response.text();

        // 2. Usa o DOMParser para criar um documento HTML em memória
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // 3. Adiciona uma tag <base> para corrigir caminhos relativos de CSS e imagens.
        //    Isso garante que o estilo seja carregado corretamente.
        const base = document.createElement('base');
        base.href = url;
        doc.head.prepend(base);
        
        // 4. Adiciona um script no final para forçar a remoção de loaders e exibir o conteúdo.
        //    Isso é executado após os scripts originais da página.
        const cleanerScript = doc.createElement('script');
        cleanerScript.textContent = `
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    const selectors = '[id*="load"], [class*="load"], [id*="spinner"], [class*="spinner"]';
                    document.querySelectorAll(selectors).forEach(el => el.style.display = 'none');
                    document.body.style.visibility = 'visible';
                    document.body.style.overflow = 'hidden'; // Evita barras de rolagem na miniatura
                }, 500); // Espera um pouco para garantir que o loader apareceu antes de ser removido.
            });
        `;
        doc.body.appendChild(cleanerScript);

        // 5. Injeta o HTML modificado no iframe.
        iframe.srcdoc = doc.documentElement.outerHTML;
        
        // 6. Torna o iframe visível após um tempo para a renderização acontecer.
        setTimeout(() => {
            iframe.classList.remove('thumbnail-loading');
        }, 1000); // Aumenta o tempo para dar chance ao script de limpeza de rodar.
    } catch (error) {
        console.error('Erro ao renderizar miniatura do HTML:', error);
    }
}

arquivoInput.onchange = () => {
    if (arquivoInput.files.length > 0) {
        filesToUpload = arquivoInput.files; // Guarda os arquivos selecionados
        actionToConfirm = 'upload';
        showPasswordModal(); // Chama o modal para confirmar o envio
    }
};

async function executeUpload() {
    if (!filesToUpload) return;

    try {
        const caminhoBase = pastaAtual;
        msg.textContent = `Enviando ${filesToUpload.length} arquivo(s)...`;
        msg.style.color = "#0d6efd";

        const uploadPromises = Array.from(filesToUpload).map(file => {
            const caminho = caminhoBase + file.name;
            const arqRef = ref(storage, caminho);
            return uploadBytes(arqRef, file);
        });

        await Promise.all(uploadPromises);

        msg.textContent = "Arquivo(s) enviado(s) com sucesso!";
        msg.style.color = "green";
    } catch (error) {
        msg.textContent = "Erro no envio. Tente novamente.";
        msg.style.color = "red";
        console.error("Erro no upload:", error);
    } finally {
        // Limpa as variáveis e o input
        filesToUpload = null;
        arquivoInput.value = "";
        setTimeout(() => msg.textContent = "", 3000);
        carregarConteudo();
    }
}

async function executeDelete() {
    msg.textContent = "Excluindo arquivo(s)...";
    msg.style.color = "#0d6efd";

    const checkboxes = document.querySelectorAll('.delete-checkbox:checked');
    const deletePromises = Array.from(checkboxes).map(cb => deleteObject(ref(storage, cb.value)));
    await Promise.all(deletePromises);

    msg.textContent = "Arquivo(s) excluído(s) com sucesso!";
    msg.style.color = "green";
    setTimeout(() => msg.textContent = "", 3000);
    carregarConteudo();
}

// Função genérica que lida com a confirmação de senha para diferentes ações
async function handlePasswordConfirmation() {
    const password = passwordConfirmInput.value;
    if (!password) {
        modalError.textContent = "A senha é obrigatória.";
        return;
    }

    try {
        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

        // Senha correta, esconde o modal e executa a ação pendente
        passwordModal.style.display = 'none';

        if (actionToConfirm === 'upload') {
            await executeUpload();
        } else if (actionToConfirm === 'delete') {
            await executeDelete();
        }

    } catch (error) {
        modalError.textContent = "Senha incorreta. Tente novamente.";
        console.error("Erro de reautenticação:", error);
    }
}

// Função para exibir e configurar o modal de senha
function showPasswordModal() {
    const modalTitle = passwordModal.querySelector('h3');
    modalTitle.textContent = actionToConfirm === 'upload' ? 'Confirmar Envio' : 'Confirmar Exclusão';
    passwordModal.querySelector('p').textContent = `Para sua segurança, digite sua senha para confirmar a ação.`;

    passwordModal.style.display = 'flex';
    passwordConfirmInput.value = '';
    modalError.textContent = '';
    passwordConfirmInput.focus();
}

// Configura os eventos do modal
confirmDeleteBtn.addEventListener('click', handlePasswordConfirmation);
cancelDeleteBtn.addEventListener('click', () => {
    passwordModal.style.display = 'none';
    // Limpa o input de arquivo se a ação de upload for cancelada
    if (actionToConfirm === 'upload') {
        arquivoInput.value = "";
        filesToUpload = null;
    }
});

deleteBtn.onclick = () => {
    const checkboxes = document.querySelectorAll('.delete-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Por favor, selecione pelo menos um arquivo para excluir.");
        return;
    }

    actionToConfirm = 'delete';
    showPasswordModal();
};

logoutBtn.onclick = () => signOut(auth);

toggleUploadBtn.onclick = () => {
    const uploadSection = document.querySelector('.upload-section');
    const isHidden = uploadSection.style.display === 'none';
    uploadSection.style.display = isHidden ? 'block' : 'none';
};
