import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

export const validateSocketSession = async (token, socketId) => {
  try {
    if (!token) {
      console.log('No token provided');
      return null;
    }

    const db = readDB();

    if (!db.sessions[token]) {
      console.log('Session not found for token:', token);
      return null;
    }

    const session = db.sessions[token];

    session.socketId = socketId;
    session.lastActivity = new Date().toISOString();

    db.sessions[token] = session;
    writeDB(db);

    console.log(`Session validated for user ${session.userId}, socket: ${socketId}`);

    return session;

  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
};

export const removeSession = async (token) => {
  try {
    if (!token) {
      return false;
    }

    const db = readDB();

    if (db.sessions[token]) {
      const userId = db.sessions[token].userId;
      delete db.sessions[token];
      writeDB(db);
      
      console.log(`Session removed for user ${userId}, token: ${token}`);
      return true;
    }

    return false;

  } catch (error) {
    console.error('Error removing session:', error);
    return false;
  }
};


export const getSession = async (token) => {
  try {
    if (!token) {
      return null;
    }

    const db = readDB();
    return db.sessions[token] || null;

  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};


export const updateSessionActivity = async (token) => {
  try {
    if (!token) {
      return false;
    }

    const db = readDB();

    if (db.sessions[token]) {
      db.sessions[token].lastActivity = new Date().toISOString();
      writeDB(db);
      return true;
    }

    return false;

  } catch (error) {
    console.error('Error updating session activity:', error);
    return false;
  }
};

export const cleanupExpiredSessions = async (maxInactiveMinutes = 60) => {
  try {
    const db = readDB();
    const now = new Date();
    let removedCount = 0;

    Object.keys(db.sessions).forEach((token) => {
      const session = db.sessions[token];
      const lastActivity = new Date(session.lastActivity);
      const minutesInactive = (now - lastActivity) / (1000 * 60);

      if (minutesInactive > maxInactiveMinutes) {
        delete db.sessions[token];
        removedCount++;
        console.log(`Expired session removed for user ${session.userId}`);
      }
    });

    if (removedCount > 0) {
      writeDB(db);
    }

    return removedCount;

  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }
};