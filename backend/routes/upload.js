const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const { processVideo } = require('../services/videoProcessor');
const { saveFile, getFileInfo, registerSessionFile } = require('../utils/fileManager');

// 파일 업로드 라우트
router.post('/', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '비디오 파일이 업로드되지 않았습니다.' });
    }

    const fileInfo = await getFileInfo(req.file.path);
    
    // 세션 파일로 등록 (세션 ID는 클라이언트 IP 또는 랜덤 ID 사용)
    const sessionId = req.ip || `session_${Date.now()}`;
    registerSessionFile(sessionId, req.file.path, 'original');
    
    res.json({
      message: '파일이 성공적으로 업로드되었습니다.',
      file: {
        id: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
        ...fileInfo
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

// 업로드된 파일 목록 조회
router.get('/', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '../uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(uploadsDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.avi', '.mov', '.mkv', '.wmv'].includes(ext);
      })
      .map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          id: file,
          name: file,
          size: stats.size,
          uploadTime: stats.birthtime,
          path: filePath
        };
      });

    res.json({ files });
  } catch (error) {
    console.error('File list error:', error);
    res.status(500).json({ error: '파일 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 특정 파일 정보 조회
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../uploads', fileId);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    const fileInfo = await getFileInfo(filePath);
    res.json({ file: fileInfo });
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({ error: '파일 정보 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
