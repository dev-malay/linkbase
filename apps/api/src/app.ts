import express from 'express';
import linkRoutes from './modules/links/link.routes';
import authRoutes from './modules/auth/auth.routes';
import { errorHandler } from './middleware/error';
import { authMiddleware } from './middleware/auth';
import presetRoutes from './modules/presets/preset.routes';
import intelligenceRoutes from './modules/intelligence/intelligence.routes';
import audienceRoutes from './modules/audience/audience.routes';


const app = express();

app.use('/api/audience', audienceRoutes);

app.use('/api/intelligence', authMiddleware, intelligenceRoutes);

app.use('/api/presets', authMiddleware, presetRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/links', authMiddleware, linkRoutes);
app.use(errorHandler);

export default app;