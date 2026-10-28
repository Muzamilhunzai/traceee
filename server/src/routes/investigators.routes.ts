import { Router } from 'express';
import { listInvestigators } from '../controllers/investigators.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(listInvestigators));

export default router;