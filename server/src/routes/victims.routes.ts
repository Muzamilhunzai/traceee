import { Router } from 'express';
import * as ctrl from '../controllers/victims.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/',    asyncHandler(ctrl.listVictims));
router.get('/:id', asyncHandler(ctrl.getVictim));
router.post('/',   asyncHandler(ctrl.createVictim));
router.put('/:id', asyncHandler(ctrl.updateVictim));
router.delete('/:id', asyncHandler(ctrl.deleteVictim));

export default router;