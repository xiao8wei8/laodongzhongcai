import express from 'express';
import { getUsers, getUserDetail, updateUser, deleteUser, createUser, setOnDutyMediator, getOnDutyMediator, getReminderSetting, updateReminderSetting } from './controller';

const router = express.Router();

// 值班管理路由
router.post('/on-duty', setOnDutyMediator);
router.get('/on-duty', getOnDutyMediator);
// 兼容旧端点
router.post('/set-duty', setOnDutyMediator);

// 用户管理路由
router.get('/', getUsers);
router.get('/:id', getUserDetail);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

// 提醒设置路由
router.get('/reminder/setting', getReminderSetting);
router.put('/reminder/setting', updateReminderSetting);

export default router;
