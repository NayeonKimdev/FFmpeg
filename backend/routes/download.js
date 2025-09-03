const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { deleteFile } = require('../utils/fileManager');

// OPTIONS 요청 처리 (CORS preflight)
router.options('/stream/:fileId', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range');
  res.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  res.status(200).end();
});

// 비디오 스트리밍 (미리보기용)
router.get('/stream/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = 'enhanced' } = req.query;
    
    console.log(`비디오 스트리밍 요청: ${fileId}, 타입: ${type}`);
    
    let filePath;
    if (type === 'original') {
      filePath = path.join(__dirname, '../uploads', fileId);
    } else {
      // 개선된 파일의 경우 _enhanced.mp4 접미사 추가
      const inputFileName = path.basename(fileId, path.extname(fileId));
      const enhancedFileName = `${inputFileName}_enhanced.mp4`;
      filePath = path.join(__dirname, '../processed', enhancedFileName);
      
      // _enhanced.mp4 파일이 없으면 원본 파일명으로 시도
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '../processed', fileId);
      }
    }
    
    console.log(`스트리밍 파일 경로: ${filePath}`);
    console.log(`파일 존재 여부: ${fs.existsSync(filePath)}`);
    
    if (!fs.existsSync(filePath)) {
      console.error('스트리밍 파일을 찾을 수 없음:', filePath);
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    console.log(`파일 크기: ${fileSize}, Range 요청: ${range}`);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
      };
      console.log('Range 응답 헤더:', head);
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
      };
      console.log('전체 파일 응답 헤더:', head);
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
    
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: '비디오 스트리밍 중 오류가 발생했습니다.' });
  }
});

// 파일 다운로드
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = 'enhanced' } = req.query; // 'original' 또는 'enhanced'
    
    let filePath;
    if (type === 'original') {
      filePath = path.join(__dirname, '../uploads', fileId);
    } else {
      // 개선된 파일의 경우 _enhanced.mp4 접미사 추가
      const inputFileName = path.basename(fileId, path.extname(fileId));
      const enhancedFileName = `${inputFileName}_enhanced.mp4`;
      filePath = path.join(__dirname, '../processed', enhancedFileName);
      
      // _enhanced.mp4 파일이 없으면 원본 파일명으로 시도
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '../processed', fileId);
      }
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    // 파일 정보 가져오기
    const stats = fs.statSync(filePath);
    const fileName = path.basename(fileId);
    
    // 다운로드 헤더 설정
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);
    
    // 파일 스트림 생성 및 전송
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // 스트림 에러 처리
    fileStream.on('error', (error) => {
      console.error('Download stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: '파일 다운로드 중 오류가 발생했습니다.' });
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: '파일 다운로드 중 오류가 발생했습니다.' });
  }
});

// 파일 삭제 (다운로드 후)
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = 'enhanced' } = req.query;
    
    let filePath;
    if (type === 'original') {
      filePath = path.join(__dirname, '../uploads', fileId);
    } else {
      // 개선된 파일의 경우 _enhanced.mp4 접미사 추가
      const inputFileName = path.basename(fileId, path.extname(fileId));
      const enhancedFileName = `${inputFileName}_enhanced.mp4`;
      filePath = path.join(__dirname, '../processed', enhancedFileName);
      
      // _enhanced.mp4 파일이 없으면 원본 파일명으로 시도
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '../processed', fileId);
      }
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    await deleteFile(filePath);
    
    res.json({
      message: '파일이 성공적으로 삭제되었습니다.',
      deletedFile: fileId
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다.' });
  }
});

// 다운로드 가능한 파일 목록
router.get('/list/available', async (req, res) => {
  try {
    const processedDir = path.join(__dirname, '../processed');
    const uploadsDir = path.join(__dirname, '../uploads');
    
    const availableFiles = [];
    
    // 개선된 파일들
    if (fs.existsSync(processedDir)) {
      const enhancedFiles = fs.readdirSync(processedDir)
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
            type: 'enhanced',
            size: stats.size,
            availableAt: stats.birthtime,
            path: filePath
          };
        });
      availableFiles.push(...enhancedFiles);
    }
    
    // 원본 파일들
    if (fs.existsSync(uploadsDir)) {
      const originalFiles = fs.readdirSync(uploadsDir)
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
            type: 'original',
            size: stats.size,
            availableAt: stats.birthtime,
            path: filePath
          };
        });
      availableFiles.push(...originalFiles);
    }
    
    res.json({ files: availableFiles });
  } catch (error) {
    console.error('Available files list error:', error);
    res.status(500).json({ error: '다운로드 가능한 파일 목록 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
