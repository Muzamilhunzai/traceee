import { Router } from 'express';
import * as ctrl from '../controllers/clues.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

router.get('/',    asyncHandler(ctrl.listClues));
router.get('/:id', asyncHandler(ctrl.getClue));
router.post('/',   asyncHandler(ctrl.createClue));
router.put('/:id', asyncHandler(ctrl.updateClue));
router.delete('/:id', asyncHandler(ctrl.deleteClue));

router.post('/:id/evidence/:evidenceId',   asyncHandler(ctrl.linkEvidence));
router.delete('/:id/evidence/:evidenceId', asyncHandler(ctrl.unlinkEvidence));

export default router;