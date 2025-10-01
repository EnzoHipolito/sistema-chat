const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const cors = require('cors');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve arquivos estáticos da pasta src
app.use(express.static('src'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/login.html'));
app.get('/register', (req, res) => res.sendFile(__dirname + '/register.html'));

// Registrar usuário
app.post('/register', (req, res) => {
  const { username, senha } = req.body;
  const senhaCript = bcrypt.hashSync(senha, 10);

  const sql = "INSERT INTO usuarios (username, senha) VALUES (?, ?)";
  db.query(sql, [username, senhaCript], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: "Usuário já existe" });
      return res.status(500).json({ erro: "Erro no servidor", detalhe: err });
    }
    res.json({ sucesso: true, username });
    console.log(`Usuário criado: ${username}`);
  });
});

// Login
app.post('/login', (req, res) => {
  const { username, senha } = req.body;

  const sql = "SELECT * FROM usuarios WHERE username = ?";
  db.query(sql, [username], (err, results) => {
    if (err) return res.status(500).send("Erro no servidor");
    if (results.length === 0) return res.status(401).send("Usuário não encontrado");

    const usuario = results[0];
    const senhaValida = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaValida) return res.status(401).send("Senha incorreta");

    // Login OK
    res.json({ username: usuario.username });
  });
});


// Socket.io
io.on('connection', (socket) => {
  console.log('Um usuário se conectou');
  
  // Inicialmente, o socket não tem username
  socket.username = null;
  socket.currentRoom = null;
  let rooms = [];

  socket.emit('listarChats', rooms);
  
  // Cliente envia seu username
  socket.on('setUsername', (name) => {
    socket.username = name;
    console.log(`Usuário identificado: ${name}`);

    // Confirma para o cliente que login foi aceito
    socket.emit('usernameConfirmed', name);

    // Mensagem do sistema
    io.emit('mensagem', { user: 'Sistema', text: `${name} entrou no chat.` });
  });

  socket.on('createRoom', (chatName) => {
    if (!rooms.includes(chatName)) {
      rooms.push(chatName);  // Adiciona o nome da sala à lista
      socket.join(chatName);  // O usuário entra na sala
      socket.currentRoom = chatName;
      
      // Envia uma mensagem para a sala informando que foi criada
      io.to(chatName).emit('mensagem', { user: 'Sistema', text: `Sala ${chatName} criada.` });

      // Atualiza a lista de chats para todos os clientes
      io.emit('listarChats', rooms);
    }
  });

  socket.on('entrarChat', (chatName) => {
    if (socket.currentRoom === chatName) return;  // Evita trocar de sala sem necessidade
  
    // Se estiver em outra sala, sai da sala atual
    if (socket.currentRoom) {
      socket.leave(socket.currentRoom);
      console.log(`${socket.username} saiu da sala ${socket.currentRoom}`);
    }
  
    // O usuário entra na nova sala
    socket.join(chatName);
    socket.currentRoom = chatName;  // Atualiza o currentRoom
  
    // Envia uma mensagem informando que o usuário entrou
    io.to(chatName).emit('mensagem', { user: 'Sistema', text: `${socket.username} entrou na sala ${chatName}.` });
  
    console.log(`Usuário ${socket.username} entrou na sala ${chatName}`);
  });

  // Receber mensagem
  socket.on('mensagem', (msg) => {
    if (!socket.username || !socket.currentRoom) return; // Ignora se o usuário não tem um username ou não está em uma sala
    const messageText = typeof msg === 'object' ? JSON.stringify(msg) : msg;

    io.to(socket.currentRoom).emit('mensagem', { user: socket.username, text: messageText });
  });

  // Logout
  socket.on('logout', () => {
    if (!socket.username) return;
    console.log(`${socket.username} fez logout`);
    io.emit('mensagem', { user: 'Sistema', text: `${socket.username} saiu do chat.` });
    socket.username = null;
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log(`${socket.username || 'Um usuário'} se desconectou`);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
