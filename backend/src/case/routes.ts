/**
 * @swagger
 * tags:
 *   name: Case
 *   description: 案件管理相关接口
 */

import express from 'express';
import { 
  getCases, 
  getCaseById, 
  createCase, 
  updateCaseStatus, 
  assignMediator, 
  closeCase, 
  getCaseMeetings, 
  createCaseMeeting, 
  addCaseProgress,
  addCaseSchedule,
  getCaseSchedules,
  updateCaseSchedule,
  deleteCaseSchedule,
  handleMediationAgreement,
  exportFile,
  getAIAnalysis
} from './controller';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /case:
 *   get:
 *     summary: 获取案件列表
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 按状态筛选
 *       - in: query
 *         name: mediatorId
 *         schema:
 *           type: string
 *         description: 按调解员ID筛选
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词
 *     responses:
 *       200: 
 *         description: 获取成功
 *       401: 
 *         description: 未认证
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/', auth, getCases);

/**
 * @swagger
 * /case/{id}:
 *   get:
 *     summary: 获取案件详情
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     responses:
 *       200: 
 *         description: 获取成功
 *       401: 
 *         description: 未认证
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/:id', auth, getCaseById);

/**
 * @swagger
 * /case:
 *   post:
 *     summary: 创建案件
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caseNumber
 *               - applicantId
 *               - respondentId
 *               - disputeType
 *               - requestItems
 *               - factsReasons
 *               - status
 *             properties:
 *               caseNumber: 
 *                 type: string
 *                 description: 案件编号
 *               applicantId: 
 *                 type: string
 *                 description: 申请人ID
 *               respondentId: 
 *                 type: string
 *                 description: 被申请人ID
 *               disputeType: 
 *                 type: string
 *                 description: 争议类型
 *               caseAmount: 
 *                 type: number
 *                 description: 案件金额
 *               requestItems: 
 *                 type: string
 *                 description: 请求事项
 *               factsReasons: 
 *                 type: string
 *                 description: 事实与理由
 *               status: 
 *                 type: string
 *                 description: 案件状态
 *                 enum: [pending, processing, completed, failed]
 *               mediatorId: 
 *                 type: string
 *                 description: 调解员ID
 *     responses:
 *       201: 
 *         description: 创建成功
 *       401: 
 *         description: 未认证
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/', auth, createCase);

/**
 * @swagger
 * /case/{id}/status:
 *   put:
 *     summary: 更新案件状态
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status: 
 *                 type: string
 *                 description: 案件状态
 *                 enum: [pending, processing, completed, failed]
 *     responses:
 *       200: 
 *         description: 更新成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.put('/:id/status', [auth, roleAuth(['mediator', 'admin'])], updateCaseStatus);

/**
 * @swagger
 * /case/{id}/mediator:
 *   put:
 *     summary: 分配调解员
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediatorId
 *             properties:
 *               mediatorId: 
 *                 type: string
 *                 description: 调解员ID
 *     responses:
 *       200: 
 *         description: 分配成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.put('/:id/mediator', [auth, roleAuth(['admin'])], assignMediator);

/**
 * @swagger
 * /case/{id}/close:
 *   put:
 *     summary: 结案
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     responses:
 *       200: 
 *         description: 结案成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.put('/:id/close', [auth, roleAuth(['mediator', 'admin'])], closeCase);

/**
 * @swagger
 * /case/{id}/meetings:
 *   get:
 *     summary: 获取案件会议列表
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     responses:
 *       200: 
 *         description: 获取成功
 *       401: 
 *         description: 未认证
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/:id/meetings', auth, getCaseMeetings);

/**
 * @swagger
 * /case/{id}/meetings:
 *   post:
 *     summary: 创建案件会议
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - meetingType
 *               - meetingTime
 *               - location
 *             properties:
 *               meetingType: 
 *                 type: string
 *                 description: 会议类型
 *               meetingTime: 
 *                 type: string
 *                 format: date-time
 *                 description: 会议时间
 *               location: 
 *                 type: string
 *                 description: 会议地点
 *               participants: 
 *                 type: array
 *                 items: 
 *                   type: string
 *                 description: 参与者
 *               agenda: 
 *                 type: string
 *                 description: 会议议程
 *     responses:
 *       201: 
 *         description: 创建成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/:id/meetings', [auth, roleAuth(['mediator', 'admin'])], createCaseMeeting);

/**
 * @swagger
 * /case/{id}/progress:
 *   post:
 *     summary: 添加案件进度
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content: 
 *                 type: string
 *                 description: 进度内容
 *               attachments: 
 *                 type: array
 *                 items: 
 *                   type: string
 *                 description: 附件
 *     responses:
 *       201: 
 *         description: 添加成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/:id/progress', [auth, roleAuth(['mediator', 'admin'])], addCaseProgress);

/**
 * @swagger
 * /case/{id}/evidences:
 *   get:
 *     summary: 获取案件证据列表
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     responses:
 *       302: 
 *         description: 重定向到证据路由
 */
router.get('/:id/evidences', auth, (req, res) => {
  const caseId = req.params.id;
  res.redirect(`/api/evidence/case/${caseId}`);
});

/**
 * @swagger
 * /case/{id}/schedule:
 *   get:
 *     summary: 获取案件日程列表
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     responses:
 *       200: 
 *         description: 获取成功
 *       401: 
 *         description: 未认证
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/:id/schedule', auth, getCaseSchedules);

/**
 * @swagger
 * /case/{id}/schedule:
 *   post:
 *     summary: 添加案件日程
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - title
 *               - category
 *             properties:
 *               date: 
 *                 type: string
 *                 format: date-time
 *                 description: 日程日期
 *               title: 
 *                 type: string
 *                 description: 日程标题
 *               description: 
 *                 type: string
 *                 description: 日程描述
 *               category: 
 *                 type: string
 *                 description: 日程分类
 *     responses:
 *       201: 
 *         description: 添加成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/:id/schedule', [auth, roleAuth(['mediator', 'admin'])], addCaseSchedule);

/**
 * @swagger
 * /case/{id}/schedule/{scheduleId}:
 *   put:
 *     summary: 更新案件日程
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 日程ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date: 
 *                 type: string
 *                 format: date-time
 *                 description: 日程日期
 *               title: 
 *                 type: string
 *                 description: 日程标题
 *               description: 
 *                 type: string
 *                 description: 日程描述
 *               category: 
 *                 type: string
 *                 description: 日程分类
 *     responses:
 *       200: 
 *         description: 更新成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件或日程不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.put('/:id/schedule/:scheduleId', [auth, roleAuth(['mediator', 'admin'])], updateCaseSchedule);

/**
 * @swagger
 * /case/{id}/schedule/{scheduleId}:
 *   delete:
 *     summary: 删除案件日程
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 日程ID
 *     responses:
 *       200: 
 *         description: 删除成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件或日程不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.delete('/:id/schedule/:scheduleId', [auth, roleAuth(['mediator', 'admin'])], deleteCaseSchedule);

/**
 * @swagger
 * /case/{id}/mediation-agreement:
 *   post:
 *     summary: 处理调解协议
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agreementContent
 *             properties:
 *               agreementContent: 
 *                 type: string
 *                 description: 协议内容
 *               status: 
 *                 type: string
 *                 description: 协议状态
 *     responses:
 *       200: 
 *         description: 处理成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/:id/mediation-agreement', [auth, roleAuth(['mediator', 'admin'])], handleMediationAgreement);

/**
 * @swagger
 * /case/{id}/export:
 *   get:
 *     summary: 导出卷宗
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     responses:
 *       200: 
 *         description: 导出成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/:id/export', [auth, roleAuth(['mediator', 'admin'])], exportFile);

/**
 * @swagger
 * /case/{id}/ai-analysis:
 *   get:
 *     summary: 获取AI分析报告
 *     tags: [Case]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 案件ID
 *     responses:
 *       200: 
 *         description: 获取成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 案件不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/:id/ai-analysis', [auth, roleAuth(['mediator', 'admin'])], getAIAnalysis);

export default router;
