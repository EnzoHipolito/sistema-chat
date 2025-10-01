// Conectar socket
// const socket = io("https://sesichat.onrender.com");

const socket = io()

// Variável para armazenar o username atual
let username = null;

// Pegar elementos
const input = document.getElementById('input');
const send = document.getElementById('sendBtn');
const messages = document.getElementById('messages');

const authArea = document.getElementById("authArea"); // div login/registro
const userArea = document.getElementById("userArea"); // div com saudação + logout
const saudacao = document.getElementById("saudacao");
const logoutBtn = document.getElementById("logoutBtn");
const roomList = document.getElementById('roomList');
// Adiciona evento no botão de criar chat


// Inicialmente, input e botão estão desativados
if (input) input.disabled = true;
if (send) send.disabled = true;

// Recupera username do localStorage, mas só desbloqueia após confirmação do servidor
const savedUsername = localStorage.getItem("username");
if (savedUsername) {
  socket.emit("setUsername", savedUsername);
}

// Recebe confirmação do servidor
socket.on('usernameConfirmed', (name) => {
  username = name;
  localStorage.setItem('username', username);

  // Desbloqueia input e botão
  if (input) input.disabled = false;
  if (send) send.disabled = false;

  // Ajusta interface
  if (authArea && userArea && saudacao) {
    authArea.classList.add("hidden");
    userArea.classList.remove("hidden");
    saudacao.textContent = `Olá, ${username}`;
  }
});


function atualizarChats() {
  socket.emit('listarChats'); // Pede ao servidor para enviar a lista de chats
}

function criarNovoChat() {
  const chatName = prompt("Digite o nome do novo chat:");
  if (chatName) {
    socket.emit('createRoom', chatName); // Cria a sala no servidor
  }
}

function entrarNoChat(chatName) {
  socket.emit('entrarChat', chatName);  // O usuário entra na sala selecionada
  messages.innerHTML = ''; // Limpa as mensagens anteriores
  socket.emit('mensagem', { user: 'Sistema', text: `Entrou na sala: ${chatName}` });
}

socket.on('listarChats', (chats) => {
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = ''; // Limpa a lista de chats

  // Adiciona cada sala à lista
  chats.forEach(chat => {
    const li = document.createElement('li');
    const chatName = chat;
    li.textContent = chatName;
    li.addEventListener('click', () => entrarNoChat(chat)); // Entrar na sala ao clicar
    chatList.appendChild(li);
  });
});

document.getElementById('criarChatBtn').addEventListener('click', function(event) {
  event.preventDefault(); // Previne a ação padrão (se houver)
  criarNovoChat();  // Chama a função ao clicar no botão
});

// Função para enviar mensagem
function enviarMensagem() {
  const msg = input.value.trim();
  if (msg && username) {
    socket.emit('mensagem', msg);
    input.value = '';
  }
}

// Clique no botão enviar
send?.addEventListener('click', enviarMensagem);

// Enter para enviar
input?.addEventListener('keydown', (e) => {
  if (e.code === "Enter") enviarMensagem();
});

// Receber mensagens
socket.on('mensagem', (msg) => {
  const li = document.createElement('li');

  if (msg.user === 'Sistema') {
    li.textContent = `${msg.text}`;
    li.classList.add('mb-2', 'text-yellow-600', 'font-semibold', 'text-center');

  } else if (msg.user === username) {
    // Mensagem sua → azul
    li.textContent = `Você: ${msg.text}`;
    li.classList.add(
      'mb-2',
      'px-3',
      'py-2',
      'rounded-lg',
      'bg-blue-500',
      'text-white',
      'max-w-xs',
      'self-end'
    );

  } else {
    // Mensagem de outro usuário → cinza
    li.textContent = `${msg.user}: ${msg.text}`;
    li.classList.add(
      'mb-2',
      'px-3',
      'py-2',
      'rounded-lg',
      'bg-gray-200',
      'text-gray-800',
      'max-w-xs',
      'self-start'
    );
  }

  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
});

// Logout
logoutBtn?.addEventListener("click", () => {
  if (username) {
    socket.emit("logout");
    username = null;
  }
  localStorage.removeItem("username");

  // Volta para tela de login
  if (authArea && userArea) {
    authArea.classList.remove("hidden");
    userArea.classList.add("hidden");
  }

  messages.innerHTML = ''; // limpa chat
});
