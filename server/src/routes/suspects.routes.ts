import { Router } from 'express';
import * as ctrl from '../controllers/suspects.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/',    asyncHandler(ctrl.listSuspects));
router.get('/:id', asyncHandler(ctrl.getSuspect));
router.post('/',   asyncHandler(ctrl.createSuspect));
router.put('/:id', asyncHandler(ctrl.updateSuspect));
router.delete('/:id', asyncHandler(ctrl.deleteSuspect));

export default router;