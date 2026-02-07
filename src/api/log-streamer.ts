/**
 * Log Streaming Utility
 * Intercepts console.log and streams logs to connected clients via Server-Sent Events
 */

import { Response } from 'express';

interface LogStream {
  id: string;
  res: Response;
  operation: string;
}

class LogStreamer {
  private streams: Map<string, LogStream> = new Map();
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private originalConsoleInfo: typeof console.info;

  constructor() {
    // Store original console methods
    this.originalConsoleLog = console.log.bind(console);
    this.originalConsoleError = console.error.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);
    this.originalConsoleInfo = console.info.bind(console);
  }

  /**
   * Start streaming logs for a specific operation
   */
  startStream(streamId: string, res: Response, operation: string): void {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Store the stream
    this.streams.set(streamId, { id: streamId, res, operation });

    // Send initial connection message
    this.sendToStream(streamId, { type: 'connected', message: `Connected to ${operation} logs` });

    // Handle client disconnect
    res.on('close', () => {
      this.stopStream(streamId);
    });
  }

  /**
   * Stop streaming logs for a specific operation
   */
  stopStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      try {
        this.sendToStream(streamId, { type: 'disconnected', message: 'Stream closed' });
        stream.res.end();
      } catch {
        // Stream might already be closed
      }
      this.streams.delete(streamId);
    }
  }

  /**
   * Send a log message to a specific stream
   */
  sendToStream(streamId: string, data: { type: string; message: string; timestamp?: number }): void {
    const stream = this.streams.get(streamId);
    if (stream && !stream.res.closed) {
      try {
        const payload = JSON.stringify({
          ...data,
          timestamp: data.timestamp || Date.now(),
        });
        stream.res.write(`data: ${payload}\n\n`);
      } catch (error) {
        // Stream might be closed, remove it
        this.streams.delete(streamId);
      }
    }
  }

  /**
   * Broadcast a log message to all active streams
   */
  private broadcast(message: string, level: 'log' | 'error' | 'warn' | 'info' = 'log'): void {
    // Also output to original console
    const originalMethod = 
      level === 'error' ? this.originalConsoleError :
      level === 'warn' ? this.originalConsoleWarn :
      level === 'info' ? this.originalConsoleInfo :
      this.originalConsoleLog;
    
    originalMethod(message);

    // Send to all active streams
    const data = {
      type: level,
      message: message.trim(),
      timestamp: Date.now(),
    };

    for (const streamId of this.streams.keys()) {
      this.sendToStream(streamId, data);
    }
  }

  /**
   * Enable console interception for a specific operation
   */
  enableInterception(streamId: string): void {
    // Override console methods to also broadcast
    console.log = (...args: any[]) => {
      this.originalConsoleLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      this.sendToStream(streamId, { type: 'log', message });
    };

    console.error = (...args: any[]) => {
      this.originalConsoleError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      this.sendToStream(streamId, { type: 'error', message });
    };

    console.warn = (...args: any[]) => {
      this.originalConsoleWarn(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      this.sendToStream(streamId, { type: 'warn', message });
    };

    console.info = (...args: any[]) => {
      this.originalConsoleInfo(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      this.sendToStream(streamId, { type: 'info', message });
    };
  }

  /**
   * Disable console interception and restore original methods
   */
  disableInterception(): void {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    console.info = this.originalConsoleInfo;
  }

  /**
   * Get a unique stream ID
   */
  generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const logStreamer = new LogStreamer();

