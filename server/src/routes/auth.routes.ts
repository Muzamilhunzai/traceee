/**
 * TraceNet — Auth Routes
 * Mounted at /api/auth
 */
import { Router } from 'express';
import { login, me, register } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login',    asyncHandler(login));
router.get('/me',        authenticate, asyncHandler(me));

export default router;