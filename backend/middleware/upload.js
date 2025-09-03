const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 허용된 비디오 형식
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/avi',
  'video/mov',
  'video/mkv',
  'video/wmv',
  'video/webm',
  'video/flv'
];

// 허용된 파일 확장자
const ALLOWED_EXTENSIONS = [
  '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.webm', '.flv'
];

// 파일 크기 제한 (500MB)
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // 업로드 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 원본 파일명에서 확장자 추출
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    
    // 타임스탬프를 추가하여 중복 방지
    const timestamp = Date.now();
    const uniqueName = `${name}_${timestamp}${ext}`;
    
    cb(null, uniqueName);
  }
});

// 파일 필터링 함수
const fileFilter = (req, file, cb) => {
  // 파일 형식 검사
  if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(new Error('지원하지 않는 파일 형식입니다.'), false);
  }
  
  // 파일 확장자 검사
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('지원하지 않는 파일 확장자입니다.'), false);
  }
  
  cb(null, true);
};

// Multer 인스턴스 생성
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // 한 번에 하나의 파일만 업로드
  }
});

// 에러 핸들링 미들웨어
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: '파일 크기가 너무 큽니다. 최대 500MB까지 업로드 가능합니다.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: '한 번에 하나의 파일만 업로드 가능합니다.'
      });
    }
    return res.status(400).json({
      error: '파일 업로드 중 오류가 발생했습니다.'
    });
  }
  
  if (error.message) {
    return res.status(400).json({
      error: error.message
    });
  }
  
  next(error);
};

// 파일 검증 미들웨어
const validateUploadedFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      error: '업로드할 파일을 선택해주세요.'
    });
  }
  
  // 파일 존재 여부 확인
  if (!fs.existsSync(req.file.path)) {
    return res.status(500).json({
      error: '업로드된 파일을 찾을 수 없습니다.'
    });
  }
  
  // 파일 크기 확인
  const stats = fs.statSync(req.file.path);
  if (stats.size === 0) {
    // 빈 파일 삭제
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      error: '빈 파일은 업로드할 수 없습니다.'
    });
  }
  
  next();
};

module.exports = {
  upload,
  handleUploadError,
  validateUploadedFile,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE
};
