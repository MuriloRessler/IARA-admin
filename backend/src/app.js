import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS'));
  },
}));
app.use(express.json());
app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
