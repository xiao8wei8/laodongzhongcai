import express from 'express';
import { createApplication, getApplications, getApplicationById, saveDraft, getDraft } from './controller';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

// 提交调解申请
router.post('/', [auth, roleAuth(['personal', 'company', 'admin'])], createApplication);

// 获取申请列表
router.get('/', [auth, roleAuth(['mediator', 'admin'])], getApplications);

// 获取申请详情
router.get('/:id', auth, getApplicationById);

// 保存申请草稿
router.post('/draft', [auth, roleAuth(['personal', 'company'])], saveDraft);

// 获取申请草稿
router.get('/draft/:id', [auth, roleAuth(['personal', 'company'])], getDraft);

export default router;
