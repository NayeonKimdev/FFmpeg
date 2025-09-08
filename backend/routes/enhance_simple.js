const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { formatFileSize } = require('../utils/fileManager');

// 간단한 상태 확인 API
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const processedPath = path.join(__dirname, '../processed', jobId);
    const progressFilePath = path.join(__dirname, '../temp', `${jobId}.progress`);
    
    console.log(`=== 상태 조회 ===`);
    console.log(`작업 ID: ${jobId}`);
    console.log(`파일 경로: ${processedPath}`);
    console.log(`진행률 파일: ${progressFilePath}`);
    console.log(`파일 존재: ${fs.existsSync(processedPath)}`);
    console.log(`진행률 파일 존재: ${fs.existsSync(progressFilePath)}`);
    
    // 진행률 파일에서 정보 읽기
    let progressInfo = null;
    if (fs.existsSync(progressFilePath)) {
      try {
        const progressData = fs.readFileSync(progressFilePath, 'utf8');
        console.log('진행률 파일 원본 데이터:', progressData);
        progressInfo = JSON.parse(progressData);
        console.log('진행률 정보 파싱됨:', progressInfo);
      } catch (readError) {
        console.warn('진행률 파일 읽기 실패:', readError.message);
      }
    }
    
    // 진행률 파일에서 완료 상태 확인
    if (progressInfo && progressInfo.status === 'completed' && fs.existsSync(processedPath)) {
      console.log('진행률 파일에서 완료 상태 확인됨');
      
      const stats = fs.statSync(processedPath);
      const fileSize = stats.size;
      
      if (fileSize > 0 && fileSize >= 1024) {
        console.log('완료된 파일 확인됨, 크기:', fileSize);
        
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
        return;
      }
    }
    
    // 파일이 존재하는 경우
    if (fs.existsSync(processedPath)) {
      const stats = fs.statSync(processedPath);
      const fileSize = stats.size;
      const modifiedTime = stats.mtime;
      const now = new Date();
      const timeSinceModified = now.getTime() - modifiedTime.getTime();
      
      // 파일이 최근 5초 내에 수정되었으면 아직 처리 중
      if (timeSinceModified < 5000) {
        console.log('파일이 아직 처리 중입니다 (최근 수정됨)');
        
        let estimatedProgress = 85;
        if (progressInfo && progressInfo.percent) {
          estimatedProgress = progressInfo.percent;
        }
        
        res.json({
          status: 'processing',
          progress: estimatedProgress,
          message: progressInfo?.message || '비디오 처리를 완료하는 중입니다...',
          lastModified: modifiedTime
        });
        return;
      }
      
      // 파일 크기가 0이면 처리 실패
      if (fileSize === 0) {
        console.log('출력 파일이 빈 파일입니다 (처리 실패)');
        res.json({
          status: 'failed',
          progress: 0,
          message: '비디오 처리에 실패했습니다.',
          error: '출력 파일이 비어있습니다.'
        });
        return;
      }

      // 파일 크기가 너무 작으면 처리 실패 (1KB 미만)
      if (fileSize < 1024) {
        console.log(`출력 파일이 너무 작습니다: ${fileSize} bytes (처리 실패)`);
        res.json({
          status: 'failed',
          progress: 0,
          message: '비디오 처리에 실패했습니다.',
          error: `출력 파일이 너무 작습니다: ${fileSize} bytes`
        });
        return;
      }
      
      // 파일 정보 반환 (완료된 것으로 간주)
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
      
      // 진행률 파일에서 정보 확인
      let estimatedProgress = 5;
      let message = '비디오 처리를 시작하는 중입니다...';
      
      if (progressInfo) {
        if (progressInfo.status === 'processing') {
          estimatedProgress = progressInfo.percent || 15;
          message = progressInfo.message || '비디오를 처리하고 있습니다...';
        }
      }
      
      res.json({
        status: 'processing',
        progress: estimatedProgress,
        message: message,
        estimatedTime: '3-10분'
      });
    }
  } catch (error) {
    console.error('=== 상태 조회 오류 ===');
    console.error('오류:', error.message);
    console.error('스택:', error.stack);
    
    res.status(500).json({ 
      error: '상태 조회 중 오류가 발생했습니다.',
      code: 'STATUS_CHECK_ERROR',
      details: error.message
    });
  }
});

module.exports = router;


