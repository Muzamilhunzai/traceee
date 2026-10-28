/**
 * =====================================================================
 *  TraceNet — Express Server Bootstrap (final)
 * =====================================================================
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import investigatorsRoutes from './routes/investigators.routes';
import { env } from './config/env';
import { initializeDatabase } from './database';
import { errorHandler, notFound } from './middleware/errorHandler';

// Routes
import authRoutes          from './routes/auth.routes';
import casesRoutes         from './routes/cases.routes';
import suspectsRoutes      from './routes/suspects.routes';
import victimsRoutes       from './routes/victims.routes';
import witnessesRoutes     from './routes/witnesses.routes';
import evidenceRoutes      from './routes/evidence.routes';
import cluesRoutes         from './routes/clues.routes';
import dashboardRoutes     from './routes/dashboard.routes';
import relationshipsRoutes from './routes/relationships.routes';

// 1. DB bootstrap
initializeDatabase();

// 2. App
const app = express();

app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

// 3. Public
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'TraceNet',
    env: env.NODE_ENV,
    time: new Date().toISOString(),
  });
});
app.use('/api/auth', authRoutes);

// 4. Protected
app.use('/api/cases',           casesRoutes);
app.use('/api/suspects',        suspectsRoutes);
app.use('/api/victims',         victimsRoutes);
app.use('/api/witnesses',       witnessesRoutes);
app.use('/api/evidence',        evidenceRoutes);
app.use('/api/clues',           cluesRoutes);
app.use('/api/dashboard-stats', dashboardRoutes);
app.use('/api/relationships',   relationshipsRoutes);
app.use('/api/investigators',   investigatorsRoutes);

// 5. Fallbacks
app.use(notFound);
app.use(errorHandler);

// 6. Listen
app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `🚀  TraceNet API listening on http://localhost:${env.PORT}  (${env.NODE_ENV})`
  );
  // eslint-disable-next-line no-console
  console.log(`    Demo login: admin@tracenet.local / Admin123!`);
});

export default app;