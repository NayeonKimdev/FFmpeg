const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// 라우트 임포트
const uploadRoutes = require('./routes/upload');
const enhanceRoutes = require('./routes/enhance');
const metadataRoutes = require('./routes/metadata');
const downloadRoutes = require('./routes/download');
const analyzeRoutes = require('./routes/analyze');

// 유틸리티 임포트
const { cleanupExpiredFiles, cleanupAllSessionFiles } = require('./utils/fileManager');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "http://localhost:5000", "http://localhost:3000"],
      connectSrc: ["'self'", "http://localhost:5000", "http://localhost:3000"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length']
}));

// 레이트 리미팅 설정 (완화)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5000, // IP당 최대 요청 수 (1000에서 5000으로 증가)
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
});
app.use('/api/', limiter);

// 파일 업로드용 더 높은 제한
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 100, // IP당 최대 업로드 수 (50에서 100으로 증가)
  message: '업로드 제한에 도달했습니다. 잠시 후 다시 시도해주세요.'
});

// 스트리밍 전용 리미터 (매우 관대하게)
const streamingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 1000, // IP당 최대 스트리밍 요청 수
  message: '스트리밍 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
});
app.use('/api/download/stream', streamingLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/processed', express.static(path.join(__dirname, 'processed')));
app.use('/videos', express.static(path.join(__dirname, 'uploads')));
app.use('/videos', express.static(path.join(__dirname, 'processed')));

// 라우트 설정
app.use('/api/upload', uploadLimiter, uploadRoutes);
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

// 파일 정리 스케줄러 (1시간마다 실행)
setInterval(() => {
  cleanupExpiredFiles();
}, 60 * 60 * 1000);

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
  
  // 서버 시작 시 모든 파일 삭제 (새로고침 시 파일 정리)
  try {
    console.log('서버 시작 시 모든 파일 삭제 시작...');
    
    // uploads 디렉토리 정리
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const uploadFiles = fs.readdirSync(uploadsDir);
      for (const file of uploadFiles) {
        const filePath = path.join(uploadsDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`업로드 파일 삭제: ${file}`);
        } catch (error) {
          console.error(`업로드 파일 삭제 실패: ${file}`, error);
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
          fs.unlinkSync(filePath);
          console.log(`처리된 파일 삭제: ${file}`);
        } catch (error) {
          console.error(`처리된 파일 삭제 실패: ${file}`, error);
        }
      }
    }
    
    // 세션 파일도 정리
    await cleanupAllSessionFiles();
    console.log('서버 시작 시 모든 파일 삭제 완료');
  } catch (error) {
    console.error('서버 시작 시 파일 삭제 실패:', error);
  }
});

module.exports = app;
