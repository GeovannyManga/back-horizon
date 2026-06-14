const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://horizon-vptj.vercel.app/",
    methods: ["GET", "POST"]
  }
});

// Almacenar qué usuarios están en cada sala
const roomUsers = new Map(); // roomId -> Set de userIds

io.on('connection', (socket) => {
  console.log('✅ Usuario conectado:', socket.id);
  let currentRoom = null;

  socket.on('join-room', (roomId) => {
    currentRoom = roomId;
    socket.join(roomId);
    
    // Inicializar la sala si no existe
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Set());
    }
    
    const usersInRoom = roomUsers.get(roomId);
    
    // Obtener usuarios existentes (excluyendo al actual)
    const existingUsers = Array.from(usersInRoom);
    
    // Agregar usuario a la sala
    usersInRoom.add(socket.id);
    
    console.log(`📌 Usuario ${socket.id} unido a sala ${roomId}`);
    console.log(`👥 Usuarios en sala (${usersInRoom.size}): ${Array.from(usersInRoom).join(', ')}`);
    
    // Enviar usuarios existentes al nuevo usuario
    if (existingUsers.length > 0) {
      socket.emit('existing-users', existingUsers);
    }
    
    // Notificar a otros usuarios que alguien se unió (solo si hay otros usuarios)
    if (existingUsers.length > 0) {
      socket.to(roomId).emit('user-joined', socket.id);
    }
  });

  socket.on('offer', ({ to, offer }) => {
    console.log(`📤 Offer de ${socket.id} para ${to}`);
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    console.log(`📥 Answer de ${socket.id} para ${to}`);
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    console.log(`🧊 ICE candidate de ${socket.id} para ${to}`);
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    console.log('❌ Usuario desconectado:', socket.id);
    
    if (currentRoom) {
      const usersInRoom = roomUsers.get(currentRoom);
      if (usersInRoom) {
        usersInRoom.delete(socket.id);
        console.log(`👋 Usuario ${socket.id} salió de sala ${currentRoom}`);
        console.log(`👥 Usuarios restantes (${usersInRoom.size}): ${Array.from(usersInRoom).join(', ')}`);
        
        // Notificar a otros usuarios
        socket.to(currentRoom).emit('user-left', socket.id);
        
        // Limpiar sala si está vacía
        if (usersInRoom.size === 0) {
          roomUsers.delete(currentRoom);
          console.log(`🗑️ Sala ${currentRoom} eliminada`);
        }
      }
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor Socket.IO corriendo en http://localhost:${PORT}`);
});