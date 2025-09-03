const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 비디오 스트리밍 (강화된 호환성)
router.get('/stream/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = 'enhanced' } = req.query;
    
    console.log(`비디오 스트리밍 요청: ${fileId}, 타입: ${type}`);
    
    let filePath;
    if (type === 'original') {
      filePath = path.join(__dirname, '../uploads', fileId);
    } else {
      const inputFileName = path.basename(fileId, path.extname(fileId));
      const enhancedFileName = `${inputFileName}_enhanced.mp4`;
      filePath = path.join(__dirname, '../processed', enhancedFileName);
      
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '../processed', fileId);
      }
    }
    
    if (!fs.existsSync(filePath)) {
      console.error('스트리밍 파일을 찾을 수 없음:', filePath);
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    // MIME 타입 정확하게 설정
    const mimeType = 'video/mp4';
    
    // CORS 헤더 (더 포괄적)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Range, Accept-Encoding, Accept, User-Agent');
    res.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
    
    console.log(`파일 크기: ${fileSize}, Range 요청: ${range}`);

    if (range) {
      // Range 요청 처리 (스트리밍)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      // 청크 크기 제한 (너무 크면 메모리 문제)
      const maxChunkSize = 1024 * 1024; // 1MB
      const actualEnd = Math.min(end, start + maxChunkSize - 1);
      const actualChunkSize = (actualEnd - start) + 1;
      
      const file = fs.createReadStream(filePath, { start, end: actualEnd });
      
      const head = {
        'Content-Range': `bytes ${start}-${actualEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': actualChunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Accept-Encoding, Accept, User-Agent',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type'
      };
      
      console.log('Range 응답 헤더:', head);
      res.writeHead(206, head);
      
      file.on('error', (error) => {
        console.error('스트리밍 파일 읽기 오류:', error);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      
      file.pipe(res);
    } else {
      // 전체 파일 제공
      const head = {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Accept-Encoding, Accept, User-Agent',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type'
      };
      
      console.log('전체 파일 응답 헤더:', head);
      res.writeHead(200, head);
      
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('error', (error) => {
        console.error('전체 파일 스트리밍 오류:', error);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      
      fileStream.pipe(res);
    }
    
  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '비디오 스트리밍 중 오류가 발생했습니다.' });
    }
  }
});

// OPTIONS 요청 처리 개선
router.options('/stream/:fileId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range, Accept-Encoding, Accept, User-Agent');
  res.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
  res.header('Access-Control-Max-Age', '86400'); // 24시간 캐시
  res.status(204).end();
});

// 파일 다운로드 (기존 기능 유지)
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = 'enhanced' } = req.query;
    
    let filePath;
    if (type === 'original') {
      filePath = path.join(__dirname, '../uploads', fileId);
    } else {
      const inputFileName = path.basename(fileId, path.extname(fileId));
      const enhancedFileName = `${inputFileName}_enhanced.mp4`;
      filePath = path.join(__dirname, '../processed', enhancedFileName);
      
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '../processed', fileId);
      }
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    const fileName = path.basename(filePath);
    res.download(filePath, fileName);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: '파일 다운로드 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
