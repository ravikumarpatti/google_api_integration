import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import { validateSocketSession, removeSession } from './middleware/sessionMiddleware.js';
import { addToQueue, removeFromQueue, setSocketIO } from './services/queueService.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(cors());
app.use(express.json());
app.use('/api', authRoutes);

setSocketIO(io);

app.get('/', (req, res) => {
  const serverUrl = `http://localhost:${process.env.PORT || 3000}`;
  res.render('index', { serverUrl });
});

io.on('connection', (socket) => {
  socket.on('authenticate', async (data) => {
    const session = await validateSocketSession(data.token, socket.id);
    if (session) {
      socket.userId = session.userId;
      socket.sessionToken = data.token;
      socket.emit('authenticated', { success: true, userId: session.userId });
    } else {
      socket.emit('error', { message: 'Invalid token' });
      socket.disconnect();
    }
  });

  socket.on('get-suggestion', async (data) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }
    if (!data.code) {
      socket.emit('error', { message: 'Code required' });
      return;
    }
    const queueItem = await addToQueue({
      userId: socket.userId,
      socketId: socket.id,
      code: data.code,
      timestamp: Date.now()
    });
    socket.emit('queued', queueItem);
  });

  socket.on('cancel-request', async () => {
    if (socket.userId) {
      const removed = await removeFromQueue(socket.id);
      socket.emit(removed ? 'request-cancelled' : 'error', 
        removed ? { success: true } : { message: 'No request found' });
    }
  });

  socket.on('disconnect', async () => {
    await removeFromQueue(socket.id);
    if (socket.sessionToken) await removeSession(socket.sessionToken);
  });
});

httpServer.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});