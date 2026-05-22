import express from 'express';
import linkRoutes from './modules/links/link.routes';
import authRoutes from './modules/auth/auth.routes';
import { errorHandler } from './middleware/error';
import { authMiddleware } from './middleware/auth';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/links', authMiddleware, linkRoutes);
app.use(errorHandler);

export default app;