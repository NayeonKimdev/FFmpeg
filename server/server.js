const express = require('express');
const multer = require('multer');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 3001;

// CORS 설정
app.use(cors());
app.use(express.json());

// 업로드된 파일 저장 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('비디오 파일만 업로드 가능합니다.'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB 제한
  }
});

// 결과 파일 저장 디렉토리
const outputDir = path.join(__dirname, 'outputs');
fs.ensureDirSync(outputDir);

// 정적 파일 서빙
app.use('/outputs', express.static(outputDir));

// 비디오 처리 함수들
const processVideo = (inputPath, outputPath, processType) => {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    switch (processType) {
      case 'upscale':
        command = command
          .videoFilters('scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:1.2')
          .videoCodec('libx264')
          .outputOptions('-crf 16');
        break;

      case 'upscale_4k':
        command = command
          .videoFilters('scale=3840:2160:flags=lanczos,unsharp=7:7:1.5')
          .videoCodec('libx264')
          .outputOptions('-crf 18');
        break;

      case 'upscale_1080p':
        command = command
          .videoFilters('scale=1920:1080:flags=lanczos,unsharp=5:5:1.2')
          .videoCodec('libx264')
          .outputOptions('-crf 16');
        break;

      case 'enhance':
        command = command
          .videoFilters('hqdn3d=4:3:6:4.5,unsharp=5:5:0.8,eq=brightness=0.02:contrast=1.1')
          .videoCodec('libx264')
          .outputOptions('-crf 20');
        break;

      case 'compress':
        command = command
          .videoCodec('libx265')
          .outputOptions('-crf 23 -preset veryslow -movflags faststart');
        break;

      case 'cinematic':
        command = command
          .videoFilters('eq=brightness=0.03:contrast=1.1:saturation=1.3:gamma=0.9')
          .videoCodec('libx264')
          .outputOptions('-crf 18');
        break;

      case 'stabilize':
        command = command
          .videoFilters('deshake=rx=16:ry=16')
          .videoCodec('libx264')
          .outputOptions('-crf 20');
        break;

      case 'ultimate':
        command = command
          .videoFilters('scale=iw*2:ih*2:flags=lanczos,hqdn3d=4:3:6:4.5,unsharp=5:5:0.8,eq=brightness=0.02:contrast=1.1:saturation=1.2')
          .videoCodec('libx264')
          .outputOptions('-crf 16');
        break;

      default:
        reject(new Error('지원하지 않는 처리 타입입니다.'));
        return;
    }

    command
      .output(outputPath)
      .on('end', () => {
        console.log(`비디오 처리 완료: ${processType}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`비디오 처리 오류: ${err.message}`);
        reject(err);
      })
      .run();
  });
};

// 비디오 메타데이터 추출 함수
const extractVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('비디오 스트림을 찾을 수 없습니다.'));
        return;
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: parseFloat(metadata.format.duration),
        bitrate: parseInt(metadata.format.bit_rate),
        codec: videoStream.codec_name,
        fps: eval(videoStream.r_frame_rate),
        size: metadata.format.size
      });
    });
  });
};

// 비디오 업로드 및 처리 API
app.post('/api/process-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '비디오 파일이 업로드되지 않았습니다.' });
    }

    const { processType } = req.body;
    const inputPath = req.file.path;
    const outputFilename = `processed-${Date.now()}-${processType}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    console.log(`처리 시작: ${processType}`);
    console.log(`입력 파일: ${inputPath}`);
    console.log(`출력 파일: ${outputPath}`);

    // 비디오 처리 실행
    await processVideo(inputPath, outputPath, processType);

    // 처리된 파일 정보 반환
    const fileStats = await fs.stat(outputPath);
    const fileSizeInMB = (fileStats.size / (1024 * 1024)).toFixed(2);

    // 처리된 비디오의 메타데이터 추출
    let processedMetadata = null;
    try {
      processedMetadata = await extractVideoMetadata(outputPath);
    } catch (metadataError) {
      console.warn('메타데이터 추출 실패:', metadataError.message);
    }

    res.json({
      success: true,
      message: '비디오 처리 완료',
      outputUrl: `/outputs/${outputFilename}`,
      fileSize: fileSizeInMB,
      processType: processType,
      metadata: processedMetadata
    });

    // 입력 파일 정리 (선택사항)
    // await fs.remove(inputPath);

  } catch (error) {
    console.error('서버 오류:', error);
    res.status(500).json({ 
      error: '비디오 처리 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 서버 상태 확인 API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'FFmpeg 서버가 정상적으로 실행 중입니다.',
    timestamp: new Date().toISOString()
  });
});

// FFmpeg 버전 확인
app.get('/api/ffmpeg-version', (req, res) => {
  ffmpeg.getAvailableCodecs((err, codecs) => {
    if (err) {
      res.status(500).json({ error: 'FFmpeg 정보를 가져올 수 없습니다.' });
    } else {
      res.json({ 
        message: 'FFmpeg이 정상적으로 설치되어 있습니다.',
        availableCodecs: Object.keys(codecs).length
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 FFmpeg 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📁 업로드 디렉토리: ${path.join(__dirname, 'uploads')}`);
  console.log(`📁 출력 디렉토리: ${outputDir}`);
  console.log(`🌐 API 엔드포인트: http://localhost:${PORT}/api`);
});
