import { Router } from 'express';
import * as ctrl from '../controllers/evidence.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/',    asyncHandler(ctrl.listEvidence));
router.get('/:id', asyncHandler(ctrl.getEvidence));
router.post('/',   asyncHandler(ctrl.createEvidence));
router.put('/:id', asyncHandler(ctrl.updateEvidence));
router.delete('/:id', asyncHandler(ctrl.deleteEvidence));

router.post('/:id/custody', asyncHandler(ctrl.addCustody));

export default router;