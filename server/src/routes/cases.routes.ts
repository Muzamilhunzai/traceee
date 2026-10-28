/**
 * TraceNet — Cases Routes
 * Mounted at /api/cases
 * All routes require authentication.
 */
import { Router } from 'express';
import * as ctrl from '../controllers/cases.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// every case route requires login
router.use(authenticate);

router.get('/',    asyncHandler(ctrl.listCases));
router.get('/:id', asyncHandler(ctrl.getCase));
router.post('/',   asyncHandler(ctrl.createCase));
router.put('/:id',    asyncHandler(ctrl.updateCase));
router.delete('/:id', asyncHandler(ctrl.deleteCase));

router.get('/:id/activity', asyncHandler(ctrl.getCaseActivity));

// Linking
router.post('/:id/suspects',               asyncHandler(ctrl.linkSuspect));
router.delete('/:id/suspects/:suspectId',  asyncHandler(ctrl.unlinkSuspect));

router.post('/:id/victims',                asyncHandler(ctrl.linkVictim));
router.delete('/:id/victims/:victimId',    asyncHandler(ctrl.unlinkVictim));

router.post('/:id/witnesses',              asyncHandler(ctrl.linkWitness));
router.delete('/:id/witnesses/:witnessId', asyncHandler(ctrl.unlinkWitness));

// Notes
router.post('/:id/notes', asyncHandler(ctrl.addNote));

export default router;