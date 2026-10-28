import { Router } from 'express';
import * as ctrl from '../controllers/relationships.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/',              asyncHandler(ctrl.listCasesForSelector));
router.get('/:caseId/graph', asyncHandler(ctrl.getCaseGraph));

export default router;