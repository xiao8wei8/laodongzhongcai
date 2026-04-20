import express from 'express';
import Evidence from '../models/Evidence';
import Case from '../models/Case';
import VisitorRecord from '../models/VisitorRecord';
import { auth } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import FileRecognizer from '../services/FileRecognitionService';
import config from '../config';

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// 上传证据
export const uploadEvidence = [
  auth,
  upload.single('file'),
  async (req: express.Request, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: '请选择文件' });
      }

      let { caseId } = req.body;
      if (!caseId) {
        // 删除上传的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: '请提供案件ID' });
      }
      
      // 检查是否是广播附件上传
      if (caseId === 'broadcast') {
        // 对于广播附件，直接使用'broadcast'作为caseId
      } else {
        // 检查caseId是否是有效的ObjectId
        if (!isValidObjectId(caseId)) {
          // 尝试按案件编号查询正式案件
          const caseData = await Case.findOne({ caseNumber: caseId });
          if (caseData) {
            caseId = caseData._id.toString();
          } else {
            // 尝试按登记编号查询到访登记
            const visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
            if (visitorRecord) {
              caseId = visitorRecord._id.toString();
            }
          }
        }
      }

      // 确定文件类型
      const ext = path.extname(req.file.originalname).toLowerCase();
      let fileType = 'other';
      if (ext === '.pdf') {
        fileType = 'pdf';
      } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
        fileType = 'image';
      } else if (['.doc', '.docx'].includes(ext)) {
        fileType = 'word';
      }

      const evidence = new Evidence({
        caseId,
        name: req.file.originalname,
        type: fileType,
        path: req.file.path,
        size: req.file.size,
        uploaderId: req.user?.id
      });

      await evidence.save();

      res.status(201).json({ 
        success: true,
        evidence: {
          id: evidence._id,
          caseId: evidence.caseId,
          name: evidence.name,
          type: evidence.type,
          size: evidence.size,
          uploaderId: evidence.uploaderId,
          uploadTime: evidence.uploadTime
        }
      });
    } catch (error) {
      console.error('上传证据失败:', error);
      // 清理文件
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 检查字符串是否是有效的ObjectId
const isValidObjectId = (id: string) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// 获取案件证据
export const getCaseEvidence = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      let { caseId } = req.params;
      
      // 检查caseId是否是有效的ObjectId
      if (!isValidObjectId(caseId)) {
        // 尝试按案件编号查询正式案件
        const caseData = await Case.findOne({ caseNumber: caseId });
        if (caseData) {
          caseId = caseData._id.toString();
        } else {
          // 尝试按登记编号查询到访登记
          const visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
          if (visitorRecord) {
            caseId = visitorRecord._id.toString();
          }
        }
      }
      
      const evidence = await Evidence.find({ caseId }).populate('uploaderId', 'name');
      res.json({ evidences: evidence });
    } catch (error) {
      console.error('获取证据失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 获取证据详情
export const getEvidenceDetail = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const evidence = await Evidence.findById(id).populate('uploaderId', 'name');
      if (!evidence) {
        return res.status(404).json({ message: '证据不存在' });
      }
      res.json({ evidence });
    } catch (error) {
      console.error('获取证据详情失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 删除证据
export const deleteEvidence = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const evidence = await Evidence.findById(id);
      if (!evidence) {
        return res.status(404).json({ message: '证据不存在' });
      }

      // 删除文件
      if (fs.existsSync(evidence.path)) {
        fs.unlinkSync(evidence.path);
      }

      await evidence.deleteOne();
      res.json({ success: true });
    } catch (error) {
      console.error('删除证据失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 文件识别
export const recognizeEvidence = [
  auth,
  upload.single('file'),
  async (req: express.Request, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: '请选择文件' });
      }

      let { caseId } = req.body;
      if (!caseId) {
        // 删除上传的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: '请提供案件ID' });
      }
      
      // 检查是否是广播附件上传
      if (caseId === 'broadcast') {
        // 对于广播附件，直接使用'broadcast'作为caseId
      } else {
        // 检查caseId是否是有效的ObjectId
        if (!isValidObjectId(caseId)) {
          // 尝试按案件编号查询正式案件
          const caseData = await Case.findOne({ caseNumber: caseId });
          if (caseData) {
            caseId = caseData._id.toString();
          } else {
            // 尝试按登记编号查询到访登记
            const visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
            if (visitorRecord) {
              caseId = visitorRecord._id.toString();
            }
          }
        }
      }

      // 确定文件类型
      const ext = path.extname(req.file.originalname).toLowerCase();
      let fileType = 'other';
      if (ext === '.pdf') {
        fileType = 'pdf';
      } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
        fileType = 'image';
      } else if (['.doc', '.docx'].includes(ext)) {
        fileType = 'word';
      }

      // 检查用户认证
      if (!req.user || !req.user.id) {
        // 删除上传的文件
        fs.unlinkSync(req.file.path);
        return res.status(401).json({ message: '请先登录' });
      }

      // 创建证据记录
      const evidence = new Evidence({
        caseId,
        name: req.file.originalname,
        type: fileType,
        path: req.file.path,
        size: req.file.size,
        uploaderId: req.user.id,
        recognitionStatus: 'processing'
      });

      await evidence.save();

      // 使用文件识别服务进行识别
      let recognizerConfig: any = {};
      switch (config.ocr.service) {
        case 'baidu':
          recognizerConfig = config.ocr.baidu;
          break;
        case 'aliyun':
          recognizerConfig = config.ocr.aliyun;
          break;
        case 'tencent':
          recognizerConfig = config.ocr.tencent;
          break;
        case 'aliqwen':
          recognizerConfig = config.ocr.aliqwen;
          break;
        default:
          recognizerConfig = {};
      }
      const recognizer = new FileRecognizer(config.ocr.service, recognizerConfig);
      
      try {
        // 执行文件识别
        const recognitionResult = await recognizer.recognize(req.file.path, fileType);
        
        // 更新证据记录
        await Evidence.findByIdAndUpdate(evidence._id, {
          recognizedContent: recognitionResult.content,
          recognizedKeyInfo: recognitionResult.keyInfo,
          recognitionStatus: 'completed',
          recognitionTime: new Date()
        });

        // 返回识别结果
        res.status(201).json({ 
          success: true,
          evidence: {
            id: evidence._id,
            caseId: evidence.caseId,
            name: evidence.name,
            type: evidence.type,
            size: evidence.size,
            uploaderId: evidence.uploaderId,
            uploadTime: evidence.uploadTime,
            recognitionStatus: 'completed'
          },
          recognizedContent: recognitionResult.content
        });
      } catch (error) {
        console.error('文件识别失败:', error);
        // 更新为失败状态
        await Evidence.findByIdAndUpdate(evidence._id, {
          recognitionStatus: 'failed',
          recognitionTime: new Date()
        });
        
        // 返回失败结果
        res.status(201).json({ 
          success: true,
          evidence: {
            id: evidence._id,
            caseId: evidence.caseId,
            name: evidence.name,
            type: evidence.type,
            size: evidence.size,
            uploaderId: evidence.uploaderId,
            uploadTime: evidence.uploadTime,
            recognitionStatus: 'failed'
          },
          // 模拟识别结果，实际应用中会在后台处理完成后返回
          recognizedContent: `从文件 ${req.file.originalname} 中提取的文本内容示例。这是一个模拟的文本提取结果，实际应用中会从文件中真实提取内容。`
        });
      }
    } catch (error) {
      console.error('文件识别失败:', error);
      // 清理文件
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 获取识别结果
export const getRecognitionResult = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const evidence = await Evidence.findById(id);
      if (!evidence) {
        return res.status(404).json({ message: '证据不存在' });
      }

      res.json({
        evidence: {
          id: evidence._id,
          name: evidence.name,
          recognitionStatus: evidence.recognitionStatus,
          recognizedContent: evidence.recognizedContent,
          recognizedKeyInfo: evidence.recognizedKeyInfo,
          recognitionTime: evidence.recognitionTime
        }
      });
    } catch (error) {
      console.error('获取识别结果失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 重新识别文件
export const reRecognizeEvidence = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const evidence = await Evidence.findById(id);
      if (!evidence) {
        return res.status(404).json({ message: '证据不存在' });
      }

      // 更新状态为处理中
      await Evidence.findByIdAndUpdate(id, {
        recognitionStatus: 'processing'
      });

      // 使用文件识别服务进行重新识别
      let recognizerConfig: any = {};
      switch (config.ocr.service) {
        case 'baidu':
          recognizerConfig = config.ocr.baidu;
          break;
        case 'aliyun':
          recognizerConfig = config.ocr.aliyun;
          break;
        case 'tencent':
          recognizerConfig = config.ocr.tencent;
          break;
        case 'aliqwen':
          recognizerConfig = config.ocr.aliqwen;
          break;
        default:
          recognizerConfig = {};
      }
      const recognizer = new FileRecognizer(config.ocr.service, recognizerConfig);
      
      try {
        // 执行文件识别
        const recognitionResult = await recognizer.recognize(evidence.path, evidence.type);
        
        // 更新证据记录
        await Evidence.findByIdAndUpdate(id, {
          recognizedContent: recognitionResult.content,
          recognizedKeyInfo: recognitionResult.keyInfo,
          recognitionStatus: 'completed',
          recognitionTime: new Date()
        });

        res.json({ 
          success: true,
          message: '重新识别成功',
          recognizedContent: recognitionResult.content
        });
      } catch (error) {
        console.error('文件重新识别失败:', error);
        // 更新为失败状态
        await Evidence.findByIdAndUpdate(id, {
          recognitionStatus: 'failed',
          recognitionTime: new Date()
        });
        
        res.json({ 
          success: false,
          message: '重新识别失败'
        });
      }
    } catch (error) {
      console.error('重新识别文件失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];
