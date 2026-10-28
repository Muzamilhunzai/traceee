import { Router } from 'express';
import * as ctrl from '../controllers/witnesses.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/',    asyncHandler(ctrl.listWitnesses));
router.get('/:id', asyncHandler(ctrl.getWitness));
router.post('/',   asyncHandler(ctrl.createWitness));
router.put('/:id', asyncHandler(ctrl.updateWitness));
router.delete('/:id', asyncHandler(ctrl.deleteWitness));

export default router;