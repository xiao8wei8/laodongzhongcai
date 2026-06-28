import express from 'express';
import { auth, roleAuth } from '../middleware/auth';
import { createFeedback, getAllFeedbacks, getMyFeedbacks, updateFeedbackStatus } from './controller';

const router = express.Router();

router.post('/', auth, createFeedback);
router.get('/mine', auth, getMyFeedbacks);
router.get('/', auth, roleAuth(['superadmin', 'tenant_admin']), getAllFeedbacks);
router.put('/:id/status', auth, roleAuth(['superadmin', 'tenant_admin']), updateFeedbackStatus);

export default router;
