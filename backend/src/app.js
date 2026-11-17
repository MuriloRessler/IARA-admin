import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createApiRouter } from './routes/index.js';

export const createApp = (options = {}) => {
  const application = express();
  const appConfig = options.config || env;

  application.use(cors({
    origin(origin, callback) {
      if (!origin || appConfig.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      console.error('[CORS] Origem recebida:', JSON.stringify(origin));
      console.error('[CORS] Origens permitidas:', JSON.stringify(appConfig.allowedOrigins));

      callback(new Error('Origin is not allowed by CORS'));
    },
  }));
  application.use(express.json({ limit: '2mb' }));
  application.use('/api', createApiRouter(options));
  application.use(notFoundHandler);
  application.use(errorHandler);
  return application;
};

export const app = createApp();
