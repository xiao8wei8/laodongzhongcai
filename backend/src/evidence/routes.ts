import express from 'express';
import { uploadEvidence, getCaseEvidence, getEvidenceDetail, deleteEvidence, recognizeEvidence, getRecognitionResult, reRecognizeEvidence } from './controller';

const router = express.Router();

// 证据相关路由
router.post('/', uploadEvidence);
router.get('/case/:caseId', getCaseEvidence);
router.get('/:id', getEvidenceDetail);
router.delete('/:id', deleteEvidence);

// 文件识别相关路由
router.post('/recognize', recognizeEvidence);
router.get('/:id/recognition', getRecognitionResult);
router.put('/:id/recognition', reRecognizeEvidence);

export default router;
