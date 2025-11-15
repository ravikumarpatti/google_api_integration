import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readDB = () => {
  try {
    const dbPath = join(__dirname, '../db.json');
    const data = readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading db.json:', error);
    throw error;
  }
};

const writeDB = (data) => {
  try {
    const dbPath = join(__dirname, '../db.json');
    writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to db.json:', error);
    throw error;
  }
};

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const db = readDB();

    const user = db.users.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const sessionToken = uuidv4();

    db.sessions[sessionToken] = {
      userId: user.id,
      username: user.username,
      socketId: null, 
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    writeDB(db);

    console.log(`User ${username} logged in successfully. Session: ${sessionToken}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

router.post('/logout', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const db = readDB();

    if (db.sessions[token]) {
      delete db.sessions[token];
      writeDB(db);

      console.log(`Session ${token} logged out`);

      return res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    }

    res.status(404).json({
      success: false,
      message: 'Session not found'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;