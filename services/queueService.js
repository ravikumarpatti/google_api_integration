import { getGeminiSuggestion } from './geminiService.js';

let queue = [];
let isProcessing = false;
let requestIdCounter = 0;

let io = null;

export const setSocketIO = (socketIoInstance) => {
  io = socketIoInstance;
  console.log('Queue service: Socket.IO instance set');
};


export const addToQueue = async (request) => {
  try {
    const existingRequest = queue.find(item => item.socketId === request.socketId);
    
    if (existingRequest) {
      const position = queue.indexOf(existingRequest) + 1;
      return {
        id: existingRequest.id,
        position,
        queueLength: queue.length,
        message: 'You already have a pending request in queue'
      };
    }

    const queueItem = {
      id: ++requestIdCounter,
      userId: request.userId,
      socketId: request.socketId,
      code: request.code,
      addedAt: request.timestamp || Date.now(),
      status: 'queued'
    };

    queue.push(queueItem);

    const position = queue.length;
    
    console.log(`Queue: Added request ${queueItem.id} for user ${request.userId}, position: ${position}`);

    broadcastQueueUpdate();

    if (!isProcessing) {
      processQueue();
    }

    return {
      id: queueItem.id,
      position,
      queueLength: queue.length
    };

  } catch (error) {
    console.error('Error adding to queue:', error);
    throw error;
  }
};

export const removeFromQueue = async (socketId) => {
  try {
    const index = queue.findIndex(item => item.socketId === socketId);
    
    if (index === -1) {
      return false;
    }

    const removed = queue.splice(index, 1)[0];
    console.log(`Queue: Removed request ${removed.id} for user ${removed.userId}`);

    broadcastQueueUpdate();

    return true;

  } catch (error) {
    console.error('Error removing from queue:', error);
    return false;
  }
};


export const getQueueStatus = (socketId) => {
  const index = queue.findIndex(item => item.socketId === socketId);
  
  if (index === -1) {
    return {
      inQueue: false,
      position: 0,
      queueLength: queue.length,
      estimatedWaitTime: 0
    };
  }

  const position = index + 1;
  const estimatedWaitTime = position * 3; 
  return {
    inQueue: true,
    position,
    queueLength: queue.length,
    estimatedWaitTime,
    requestId: queue[index].id
  };
};


const processQueue = async () => {
  if (isProcessing || queue.length === 0) {
    return;
  }

  try {
    isProcessing = true;

    const request = queue.shift();

    if (!request) {
      isProcessing = false;
      return;
    }

    console.log(`Queue: Processing request ${request.id} for user ${request.userId}`);

    request.status = 'processing';

    if (io) {
      io.to(request.socketId).emit('processing-started', {
        requestId: request.id,
        message: 'Your request is being processed'
      });
    }

    broadcastQueueUpdate();

    const startTime = Date.now();
    const suggestion = await getGeminiSuggestion(request.code);
    const processingTime = Date.now() - startTime;

    console.log(`Queue: Request ${request.id} completed in ${processingTime}ms`);

    if (io) {
      io.to(request.socketId).emit('suggestion-response', {
        success: true,
        requestId: request.id,
        suggestion,
        processingTime,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Queue: Error processing request:', error);

    if (io && queue.length > 0) {
      const failedRequest = queue[0];
      io.to(failedRequest.socketId).emit('error', {
        message: 'Failed to get suggestion from Gemini API',
        error: error.message,
        requestId: failedRequest.id
      });
    }

  } finally {
    isProcessing = false;

    if (queue.length > 0) {
      console.log(`Queue: ${queue.length} request(s) remaining`);
      setTimeout(() => processQueue(), 100);
    } else {
      console.log('Queue: All requests processed');
    }
  }
};


const broadcastQueueUpdate = () => {
  if (!io) return;

  queue.forEach((item, index) => {
    const position = index + 1;
    const estimatedWaitTime = position * 3; 

    io.to(item.socketId).emit('queue-position-update', {
      position,
      queueLength: queue.length,
      estimatedWaitTime,
      requestId: item.id
    });
  });
};


export const getQueueStats = () => {
  return {
    queueLength: queue.length,
    isProcessing,
    totalProcessed: requestIdCounter,
    currentQueue: queue.map(item => ({
      id: item.id,
      userId: item.userId,
      status: item.status,
      addedAt: item.addedAt
    }))
  };
};


export const clearQueue = () => {
  const clearedCount = queue.length;
  queue = [];
  isProcessing = false;
  console.log(`Queue: Cleared ${clearedCount} request(s)`);
  return clearedCount;
};