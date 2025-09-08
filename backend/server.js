const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// 라우트 임포트
const uploadRoutes = require('./routes/upload');
const enhanceRoutes = require('./routes/enhance'); // 완전한 버전 사용
const metadataRoutes = require('./routes/metadata');
const downloadRoutes = require('./routes/download');
const analyzeRoutes = require('./routes/analyze');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS 설정
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length']
}));

// 레이트 리미팅 설정 (완전 해제)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15분
//   max: 5000, // IP당 최대 요청 수 (1000에서 5000으로 증가)
//   message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
// });
// app.use('/api/', limiter);

// 파일 업로드용 더 높은 제한
// const uploadLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1시간
//   max: 100, // IP당 최대 업로드 수 (50에서 100으로 증가)
//   message: '업로드 제한에 도달했습니다. 잠시 후 다시 시도해주세요.'
// });

// 스트리밍 전용 리미터 (매우 관대하게)
// const streamingLimiter = rateLimit({
//   windowMs: 1 * 60 * 1000, // 1분
//   max: 1000, // IP당 최대 스트리밍 요청 수
//   message: '스트리밍 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
// });
// app.use('/api/download/stream', streamingLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/processed', express.static(path.join(__dirname, 'processed')));
app.use('/videos', express.static(path.join(__dirname, 'uploads')));
app.use('/videos', express.static(path.join(__dirname, 'processed')));

// 라우트 설정
app.use('/api/upload', uploadRoutes);
app.use('/api/enhance', enhanceRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/analyze', analyzeRoutes);

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: '서버 내부 오류가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 핸들러 (모든 라우트 이후에 배치)
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// 파일 정리 함수 (15분 이상 된 파일만 삭제)
const cleanupExpiredFiles = () => {
  try {
    console.log('파일 정리 시작...');
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15분 (밀리초)
    let deletedCount = 0;
    
    // uploads 디렉토리 정리
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const uploadFiles = fs.readdirSync(uploadsDir);
      for (const file of uploadFiles) {
        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`업로드 파일 삭제: ${file} (${Math.round(fileAge / 60000)}분 전)`);
            deletedCount++;
          }
        } catch (error) {
          console.error(`업로드 파일 처리 실패: ${file}`, error);
        }
      }
    }
    
    // processed 디렉토리 정리
    const processedDir = path.join(__dirname, 'processed');
    if (fs.existsSync(processedDir)) {
      const processedFiles = fs.readdirSync(processedDir);
      for (const file of processedFiles) {
        const filePath = path.join(processedDir, file);
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`처리된 파일 삭제: ${file} (${Math.round(fileAge / 60000)}분 전)`);
            deletedCount++;
          }
        } catch (error) {
          console.error(`처리된 파일 처리 실패: ${file}`, error);
        }
      }
    }
    
    // temp 디렉토리 정리 (진행률 파일)
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
      const tempFiles = fs.readdirSync(tempDir);
      for (const file of tempFiles) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`임시 파일 삭제: ${file} (${Math.round(fileAge / 60000)}분 전)`);
            deletedCount++;
          }
        } catch (error) {
          console.error(`임시 파일 처리 실패: ${file}`, error);
        }
      }
    }
    
    console.log(`파일 정리 완료: ${deletedCount}개 파일 삭제됨`);
  } catch (error) {
    console.error('파일 정리 실패:', error);
  }
};

// 파일 정리 스케줄러 활성화 (15분마다 실행)
setInterval(() => {
  console.log('=== 자동 파일 정리 시작 ===');
  cleanupExpiredFiles();
  console.log('=== 자동 파일 정리 완료 ===');
}, 15 * 60 * 1000); // 15분 = 15 * 60 * 1000ms

// 서버 시작
app.listen(PORT, async () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
  
  // 필요한 디렉토리 생성
  const dirs = ['uploads', 'processed', 'temp'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
  
  // 서버 시작 시 파일 정리 비활성화 (개발 중 파일 보존)
  // try {
  //   console.log('서버 시작 시 모든 파일 삭제 시작...');
  //   cleanupExpiredFiles();
  //   console.log('서버 시작 시 모든 파일 삭제 완료');
  // } catch (error) {
  //   console.error('서버 시작 시 파일 삭제 실패:', error);
  // }
});

module.exports = app;