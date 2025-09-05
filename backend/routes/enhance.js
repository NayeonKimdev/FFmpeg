const express = require('express');
const router = express.Router();
const { processVideo, extractMetadata, analyzeVideoDetails } = require('../services/videoProcessor');
const { getFileInfo, moveFile, formatFileSize, registerSessionFile } = require('../utils/fileManager');
const fs = require('fs');
const path = require('path');

// 비디오 화질 개선 요청 (오류 처리 강화)
router.post('/', async (req, res) => {
  try {
    console.log('=== 화질 개선 요청 받음 ===');
    console.log('요청 본문:', req.body);
    
    const { fileId, enhancementOptions = {} } = req.body;
    
    if (!fileId) {
      console.log('파일 ID가 없음');
      return res.status(400).json({ 
        error: '파일 ID가 필요합니다.',
        code: 'MISSING_FILE_ID'
      });
    }

    const inputPath = path.join(__dirname, '../uploads', fileId);
    console.log('입력 파일 경로:', inputPath);
    console.log('파일 존재 여부:', fs.existsSync(inputPath));
    
    if (!fs.existsSync(inputPath)) {
      console.log('원본 파일을 찾을 수 없음:', fileId);
      return res.status(404).json({ 
        error: '원본 파일을 찾을 수 없습니다.',
        code: 'FILE_NOT_FOUND',
        fileId: fileId
      });
    }

    // 입력 파일 검증
    try {
      console.log('입력 파일 검증 시작...');
      const inputMetadata = await extractMetadata(inputPath);
      console.log('=== 입력 파일 검증 완료 ===');
      console.log('파일명:', fileId);
      console.log('해상도:', inputMetadata.video?.resolution);
      console.log('FPS:', inputMetadata.video?.fps);
      console.log('오디오:', inputMetadata.audio ? `${inputMetadata.audio.codec} (${inputMetadata.audio.channels}ch)` : '없음');
    } catch (error) {
      console.error('입력 파일 검증 실패:', error.message);
      return res.status(400).json({ 
        error: '입력 파일이 유효하지 않습니다.',
        code: 'INVALID_FILE',
        details: error.message
      });
    }

    // 기본 개선 옵션 (더 안전하게)
    const defaultOptions = {
      resolution: '1080p',
      quality: 'high', // high, medium, low
      codec: 'h264'
    };

    const options = { ...defaultOptions, ...enhancementOptions };
    
    // 출력 파일명 생성
    const inputFileName = path.basename(fileId, path.extname(fileId));
    const outputFileName = `${inputFileName}_enhanced.mp4`;
    
    // 세션 파일로 등록
    const sessionId = req.ip || `session_${Date.now()}`;
    const outputPath = path.join(__dirname, '../processed', outputFileName);
    registerSessionFile(sessionId, outputPath, 'enhanced');
    
    console.log('=== 화질 개선 작업 시작 ===');
    console.log('입력 파일:', fileId);
    console.log('출력 파일:', outputFileName);
    console.log('개선 옵션:', options);
    
    // 처리 시작 응답
    res.json({
      message: '비디오 화질 개선이 시작되었습니다.',
      jobId: outputFileName,
      options: options,
      estimatedTime: '5-15분' // 예상 처리 시간
    });

    // 비동기로 비디오 처리 실행 (오류 처리 강화)
    console.log('=== processVideo 함수 호출 시작 ===');
    console.log('입력 경로:', inputPath);
    console.log('옵션:', options);
    
    // 간단한 테스트를 위해 더미 파일 생성
    const tempOutputPath = path.join(__dirname, '../processed', outputFileName);
    console.log('출력 경로:', tempOutputPath);
    
    // 더미 파일 생성 (테스트용)
    try {
      fs.writeFileSync(tempOutputPath, 'dummy video content');
      console.log('더미 파일 생성 완료');
    } catch (writeError) {
      console.error('더미 파일 생성 실패:', writeError.message);
    }
    
    processVideo(inputPath, options)
      .then(result => {
        console.log('=== 화질 개선 완료 ===');
        console.log('출력 파일:', result.outputFile);
        console.log('파일 크기:', formatFileSize(result.size));
        console.log('처리 시간:', result.processingTime);
        console.log('워크플로우:', result.workflow);
        
        if (result.metadata?.output) {
          const outputMeta = result.metadata.output;
          const videoStream = outputMeta.streams?.find(s => s.codec_type === 'video');
          const audioStream = outputMeta.streams?.find(s => s.codec_type === 'audio');
          
          console.log('출력 해상도:', videoStream ? `${videoStream.width}x${videoStream.height}` : 'N/A');
          console.log('출력 FPS:', videoStream?.r_frame_rate || 'N/A');
          console.log('출력 오디오:', audioStream?.codec_name || '없음');
        }
      })
      .catch(error => {
        console.error('=== 화질 개선 실패 ===');
        console.error('오류 메시지:', error.message);
        console.error('오류 스택:', error.stack);
        console.error('오류 타입:', error.constructor.name);
        
        // 실패한 출력 파일 정리
        const failedOutputPath = path.join(__dirname, '../processed', outputFileName);
        if (fs.existsSync(failedOutputPath)) {
          try {
            fs.unlinkSync(failedOutputPath);
            console.log('실패한 출력 파일 정리 완료');
          } catch (cleanupError) {
            console.error('출력 파일 정리 실패:', cleanupError.message);
          }
        }
      });

  } catch (error) {
    console.error('=== 개선 요청 오류 ===');
    console.error('오류:', error.message);
    console.error('스택:', error.stack);
    
    res.status(500).json({ 
      error: '화질 개선 요청 중 오류가 발생했습니다.',
      code: 'PROCESSING_ERROR',
      details: error.message
    });
  }
});

// 개선 작업 상태 조회 (진행률 포함, 강화)
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
        progressInfo = JSON.parse(progressData);
        console.log('진행률 정보:', progressInfo);
      } catch (readError) {
        console.warn('진행률 파일 읽기 실패:', readError.message);
      }
    }
    
    if (fs.existsSync(processedPath)) {
      const stats = fs.statSync(processedPath);
      
      // 파일이 완전히 처리되었는지 확인
      const fileSize = stats.size;
      const modifiedTime = stats.mtime;
      const now = new Date();
      const timeSinceModified = now.getTime() - modifiedTime.getTime();
      
      // 진행률 파일에서 완료 상태 확인
      if (progressInfo && progressInfo.status === 'completed') {
        console.log('진행률 파일에서 완료 상태 확인됨');
        
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
        
        // 메타데이터 정보도 포함
        try {
          const metadata = await extractMetadata(processedPath);
          const analysis = await analyzeVideoDetails(processedPath);
          
          res.json({
            status: 'completed',
            progress: 100,
            file: fileInfo,
            metadata: {
              format: metadata.format,
              video: metadata.video,
              audio: metadata.audio
            },
            analysis: {
              syncIssues: analysis.syncIssues,
              quality: {
                resolution: analysis.video?.resolution,
                fps: analysis.video?.fps?.calculated,
                bitrate: analysis.video?.bitrate
              }
            }
          });
        } catch (metadataError) {
          console.warn('메타데이터 추출 실패:', metadataError.message);
          res.json({
            status: 'completed',
            progress: 100,
            file: fileInfo
          });
        }
        return;
      }
      
      // 진행률 파일에서 실패 상태 확인
      if (progressInfo && progressInfo.status === 'failed') {
        console.log('진행률 파일에서 실패 상태 확인됨');
        res.json({
          status: 'failed',
          progress: 0,
          message: '비디오 처리에 실패했습니다.',
          error: progressInfo.error || '알 수 없는 오류가 발생했습니다.'
        });
        return;
      }
      
      // 파일이 최근 10초 내에 수정되었으면 아직 처리 중
      if (timeSinceModified < 10000) {
        console.log('파일이 아직 처리 중입니다 (최근 수정됨)');
        
        // 진행률 파일에서 진행률 가져오기
        let estimatedProgress = 85;
        if (progressInfo && progressInfo.percent) {
          estimatedProgress = progressInfo.percent;
        } else {
          // 파일 크기를 기반으로 진행률 추정
          if (fileSize > 1024 * 1024) { // 1MB 이상
            estimatedProgress = 95;
          } else if (fileSize > 1024 * 512) { // 512KB 이상
            estimatedProgress = 90;
          } else if (fileSize > 1024 * 100) { // 100KB 이상
            estimatedProgress = 80;
          } else if (fileSize > 1024 * 10) { // 10KB 이상
            estimatedProgress = 70;
          } else {
            estimatedProgress = 60;
          }
        }
        
        res.json({
          status: 'processing',
          progress: estimatedProgress,
          message: progressInfo?.timemark ? `비디오 처리를 완료하는 중입니다... (${progressInfo.timemark})` : '비디오 처리를 완료하는 중입니다...',
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
      
      // 메타데이터 정보도 포함
      try {
        const metadata = await extractMetadata(processedPath);
        const analysis = await analyzeVideoDetails(processedPath);
        
        res.json({
          status: 'completed',
          progress: 100,
          file: fileInfo,
          metadata: {
            format: metadata.format,
            video: metadata.video,
            audio: metadata.audio
          },
          analysis: {
            syncIssues: analysis.syncIssues,
            quality: {
              resolution: analysis.video?.resolution,
              fps: analysis.video?.fps?.calculated,
              bitrate: analysis.video?.bitrate
            }
          }
        });
      } catch (metadataError) {
        console.warn('메타데이터 추출 실패:', metadataError.message);
        res.json({
          status: 'completed',
          progress: 100,
          file: fileInfo
        });
      }
    } else {
      console.log('파일이 아직 생성되지 않았습니다.');
      
      // 진행률 파일에서 정보 확인
      let estimatedProgress = 15;
      let message = '비디오 처리를 시작하는 중입니다...';
      
      if (progressInfo) {
        if (progressInfo.status === 'started') {
          estimatedProgress = 20;
          message = 'FFmpeg 처리를 시작하는 중입니다...';
        } else if (progressInfo.percent) {
          estimatedProgress = progressInfo.percent;
          message = `비디오를 처리하고 있습니다... (${progressInfo.timemark || ''})`;
        }
      } else {
        // 입력 파일 존재 여부 확인하여 진행률 추정
        const inputFileName = jobId.replace('_enhanced.mp4', '');
        const inputPath = path.join(__dirname, '../uploads', inputFileName);
        
        if (fs.existsSync(inputPath)) {
          // 입력 파일이 존재하면 처리 중으로 간주
          estimatedProgress = 25;
          message = '비디오를 분석하고 있습니다...';
        }
      }
      
      res.json({
        status: 'processing',
        progress: estimatedProgress,
        message: message,
        estimatedTime: '5-15분'
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

// 개선된 파일 목록 조회 (메타데이터 포함)
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
      });

    // 각 파일의 상세 정보 수집
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(processedDir, file);
        const stats = fs.statSync(filePath);
        
        const fileInfo = {
          id: file,
          name: file,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          processedTime: stats.birthtime,
          modifiedTime: stats.mtime,
          path: filePath
        };

        // 메타데이터 추가 (선택적)
        try {
          const metadata = await extractMetadata(filePath);
          fileInfo.metadata = {
            resolution: metadata.video?.resolution,
            fps: metadata.video?.fps,
            duration: metadata.format?.duration,
            hasAudio: !!metadata.audio
          };
        } catch (error) {
          console.warn(`파일 ${file} 메타데이터 추출 실패:`, error.message);
        }

        return fileInfo;
      })
    );

    console.log(`개선된 파일 목록 조회: ${fileDetails.length}개 파일`);
    res.json({ files: fileDetails });
  } catch (error) {
    console.error('=== 파일 목록 조회 오류 ===');
    console.error('오류:', error.message);
    console.error('스택:', error.stack);
    
    res.status(500).json({ 
      error: '개선된 파일 목록 조회 중 오류가 발생했습니다.',
      code: 'LIST_ERROR',
      details: error.message
    });
  }
});

// 개선 작업 취소 (선택적 기능)
router.delete('/cancel/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const processedPath = path.join(__dirname, '../processed', jobId);
    
    if (fs.existsSync(processedPath)) {
      try {
        fs.unlinkSync(processedPath);
        console.log(`작업 취소: ${jobId} 파일 삭제됨`);
        res.json({ message: '작업이 취소되었습니다.' });
      } catch (error) {
        console.error('파일 삭제 실패:', error.message);
        res.status(500).json({ error: '파일 삭제에 실패했습니다.' });
      }
    } else {
      res.json({ message: '작업이 이미 완료되었거나 존재하지 않습니다.' });
    }
  } catch (error) {
    console.error('작업 취소 오류:', error.message);
    res.status(500).json({ error: '작업 취소 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
