const express = require('express');
const router = express.Router();
const { processVideo } = require('../services/videoProcessor');
const { getFileInfo, moveFile, formatFileSize, registerSessionFile } = require('../utils/fileManager');
const fs = require('fs');
const path = require('path');

// 비디오 화질 개선 요청
router.post('/', async (req, res) => {
  try {
    const { fileId, enhancementOptions = {} } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: '파일 ID가 필요합니다.' });
    }

    const inputPath = path.join(__dirname, '../uploads', fileId);
    
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: '원본 파일을 찾을 수 없습니다.' });
    }

    // 기본 개선 옵션
    const defaultOptions = {
      resolution: '1080p',
      bitrate: '5000k',
      fps: 30,
      codec: 'h264',
      quality: 'high'
    };

    const options = { ...defaultOptions, ...enhancementOptions };
    
    // 출력 파일명 생성 (videoProcessor와 일치)
    const inputFileName = path.basename(fileId, path.extname(fileId));
    const outputFileName = `${inputFileName}_enhanced.mp4`;
    
    // 세션 파일로 등록 (세션 ID는 클라이언트 IP 또는 랜덤 ID 사용)
    const sessionId = req.ip || `session_${Date.now()}`;
    const outputPath = path.join(__dirname, '../processed', outputFileName);
    registerSessionFile(sessionId, outputPath, 'enhanced');
    
    // 처리 시작 응답
    res.json({
      message: '비디오 화질 개선이 시작되었습니다.',
      jobId: outputFileName, // 실제 출력 파일명으로 jobId 설정
      options
    });

    // 비동기로 비디오 처리 실행
    processVideo(inputPath, options)
      .then(result => {
        console.log('Video enhancement completed:', result);
      })
      .catch(error => {
        console.error('Video enhancement failed:', error);
      });

  } catch (error) {
    console.error('Enhancement request error:', error);
    res.status(500).json({ error: '화질 개선 요청 중 오류가 발생했습니다.' });
  }
});

// 개선 작업 상태 조회 (진행률 포함)
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const processedPath = path.join(__dirname, '../processed', jobId);
    
    console.log(`상태 조회 요청: ${jobId}`);
    console.log(`파일 경로: ${processedPath}`);
    console.log(`파일 존재 여부: ${fs.existsSync(processedPath)}`);
    
    if (fs.existsSync(processedPath)) {
      const stats = fs.statSync(processedPath);
      
      // 파일이 완전히 처리되었는지 확인 (파일 크기가 안정화되었는지)
      const fileSize = stats.size;
      const modifiedTime = stats.mtime;
      const now = new Date();
      const timeSinceModified = now.getTime() - modifiedTime.getTime();
      
      // 파일이 최근 3초 내에 수정되었으면 아직 처리 중
      if (timeSinceModified < 3000) {
        console.log('파일이 아직 처리 중입니다 (최근 수정됨)');
        res.json({
          status: 'processing',
          progress: 85, // 85%로 설정
          message: '비디오 처리를 완료하는 중입니다...'
        });
        return;
      }
      
      // 파일 정보 반환
      const fileInfo = {
        name: path.basename(processedPath),
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        created: stats.birthtime,
        modified: stats.mtime,
        path: processedPath
      };
      
      console.log('파일 처리 완료:', fileInfo);
      
      res.json({
        status: 'completed',
        progress: 100,
        file: fileInfo
      });
    } else {
      console.log('파일이 아직 생성되지 않았습니다.');
      res.json({
        status: 'processing',
        progress: 10, // 초기 진행률
        message: '비디오 처리를 시작하는 중입니다...'
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: '상태 조회 중 오류가 발생했습니다.' });
  }
});

// 개선된 파일 목록 조회
router.get('/list', async (req, res) => {
  try {
    const processedDir = path.join(__dirname, '../processed');
    
    if (!fs.existsSync(processedDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(processedDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.avi', '.mov', '.mkv'].includes(ext);
      })
      .map(file => {
        const filePath = path.join(processedDir, file);
        const stats = fs.statSync(filePath);
        return {
          id: file,
          name: file,
          size: stats.size,
          processedTime: stats.birthtime,
          path: filePath
        };
      });

    res.json({ files });
  } catch (error) {
    console.error('Enhanced files list error:', error);
    res.status(500).json({ error: '개선된 파일 목록 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
