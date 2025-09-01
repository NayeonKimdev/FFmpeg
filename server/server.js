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

// 비디오 메타데이터 추출 함수 (강화된 버전)
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

      // FPS 계산
      let fps = 30; // 기본값
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/');
        fps = parseFloat(num) / parseFloat(den);
      }

      // 비트레이트 계산
      let bitrate = 0;
      if (metadata.format.bit_rate) {
        bitrate = parseInt(metadata.format.bit_rate);
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: parseFloat(metadata.format.duration),
        bitrate: bitrate,
        codec: videoStream.codec_name,
        fps: fps,
        size: metadata.format.size,
        filename: path.basename(videoPath),
        format: metadata.format.format_name,
        // 추가 메타데이터
        aspectRatio: videoStream.display_aspect_ratio,
        pixelFormat: videoStream.pix_fmt,
        colorSpace: videoStream.color_space,
        colorRange: videoStream.color_range,
        colorTransfer: videoStream.color_transfer,
        colorPrimaries: videoStream.color_primaries
      });
    });
  });
};

// 자동 처리 타입 결정 함수
const determineAutoProcessType = (metadata) => {
  const { width, height, bitrate, fps } = metadata;
  
  // 해상도에 따른 자동 처리 타입 결정
  if (width <= 480) {
    // 낮은 해상도: 1080p로 업스케일링 + 화질 개선
    return 'upscale_1080p_enhanced';
  } else if (width <= 720) {
    // 중간 해상도: 4K로 업스케일링 + 화질 개선
    return 'upscale_4k_enhanced';
  } else if (width <= 1080) {
    // 1080p: 4K로 업스케일링 + 색상 보정
    return 'upscale_4k_color_corrected';
  } else {
    // 이미 고해상도: 화질 개선 + 색상 보정
    return 'enhance_quality_color_corrected';
  }
};

// 비디오 처리 함수들
const processVideo = (inputPath, outputPath, processType) => {
  return new Promise((resolve, reject) => {
    console.log(`🔍 처리 타입 분석: ${processType}`);
    
    // 4K 처리 시 메모리 제한 설정
    if (processType.includes('upscale_4k')) {
      console.log('⚠️ 4K 해상도 처리 - 메모리 사용량이 높을 수 있습니다.');
    }
    
    let command = ffmpeg(inputPath);
    let filters = [];

    // 해상도 처리
    if (processType.includes('upscale_144p')) {
      filters.push('scale=256:144:flags=lanczos');
    } else if (processType.includes('upscale_240p')) {
      filters.push('scale=426:240:flags=lanczos');
    } else if (processType.includes('upscale_360p')) {
      filters.push('scale=640:360:flags=lanczos');
    } else if (processType.includes('upscale_480p')) {
      filters.push('scale=854:480:flags=lanczos');
    } else if (processType.includes('upscale_720p')) {
      filters.push('scale=1280:720:flags=lanczos');
    } else if (processType.includes('upscale_1080p')) {
      filters.push('scale=1920:1080:flags=lanczos');
    } else if (processType.includes('upscale_1440p')) {
      filters.push('scale=2560:1440:flags=lanczos');
    } else if (processType.includes('upscale_2k')) {
      filters.push('scale=2048:1080:flags=lanczos');
    } else if (processType.includes('upscale_4k')) {
      filters.push('scale=3840:2160:flags=lanczos');
    } else if (processType.includes('upscale_2x')) {
      filters.push('scale=iw*2:ih*2:flags=lanczos');
    } else if (processType.includes('upscale_3x')) {
      filters.push('scale=iw*3:ih*3:flags=lanczos');
    }

    // 추가 기능들 처리
    if (processType.includes('enhanced') || processType.includes('enhance_quality')) {
      filters.push('hqdn3d=4:3:6:4.5'); // 노이즈 제거
      filters.push('unsharp=7:7:1.5:3:3:0.5'); // 샤프닝
    }

    if (processType.includes('sharpen') || processType.includes('sharpened')) {
      filters.push('unsharp=7:7:1.5:3:3:0.5');
    }

    if (processType.includes('color_correction') || processType.includes('color_corrected')) {
      filters.push('eq=brightness=0.02:contrast=1.1:saturation=1.15:gamma=0.95');
    }

    if (processType.includes('deinterlace') || processType.includes('deinterlaced')) {
      filters.push('yadif=1:1:0');
    }

    if (processType.includes('fps_boost') || processType.includes('fps_boosted')) {
      // FPS 부스트 - 4K에서는 제한적으로 적용
      if (processType.includes('upscale_4k')) {
        filters.push('fps=fps=30:round=up'); // 4K에서는 30fps로 제한
      } else {
        filters.push('fps=fps=60:round=up');
      }
    }

    if (processType.includes('hdr_enhance') || processType.includes('hdr_enhanced')) {
      // HDR 향상 - 더 간단하고 안정적인 필터 사용
      filters.push('eq=contrast=1.2:saturation=1.3:brightness=0.05');
    }

    if (processType.includes('grain_add') || processType.includes('grain_added')) {
      filters.push('noise=alls=20:allf=t');
    }

    if (processType.includes('vignette') || processType.includes('vignetted')) {
      filters.push('vignette=PI/4');
    }

    if (processType.includes('blur_bg')) {
      filters.push('boxblur=10:10');
    }

    if (processType.includes('stabilize') || processType.includes('stabilized')) {
      filters.push('deshake=rx=16:ry=16');
    }

    // 기본 샤프닝과 색상 보정 (해상도 변경 시)
    if (filters.some(f => f.includes('scale'))) {
      if (!filters.some(f => f.includes('unsharp'))) {
        filters.push('unsharp=5:5:1.0:3:3:0.5');
      }
      if (!filters.some(f => f.includes('eq='))) {
        filters.push('eq=brightness=0.01:contrast=1.05:saturation=1.1');
      }
    }

    // 필터 적용 - 안전한 방식으로 처리
    if (filters.length > 0) {
      console.log(`🔧 적용할 필터들: ${filters.join(', ')}`);
      
      try {
        // 필터 순서 최적화 (FPS 변경을 먼저 적용)
        const fpsFilters = filters.filter(f => f.includes('fps='));
        const otherFilters = filters.filter(f => !f.includes('fps='));
        const optimizedFilters = [...fpsFilters, ...otherFilters];
        
        command = command.videoFilters(optimizedFilters);
        console.log(`✅ 필터 적용 성공: ${optimizedFilters.join(', ')}`);
      } catch (filterError) {
        console.error(`❌ 필터 적용 실패: ${filterError.message}`);
        // 필터 적용 실패 시 기본 해상도만 적용
        const scaleFilter = filters.find(f => f.includes('scale='));
        if (scaleFilter) {
          command = command.videoFilters([scaleFilter]);
          console.log(`🔄 기본 해상도 필터만 적용: ${scaleFilter}`);
        }
      }
    }

    // 코덱 및 압축 설정 - 안전한 방식
    try {
      if (processType.includes('compress') || processType.includes('compressed')) {
        command = command
          .videoCodec('libx265')
          .outputOptions(['-crf', '20', '-preset', 'veryslow', '-movflags', 'faststart']);
      } else {
        // 기본 설정
        let crf = '14';
        let preset = 'slow';
        let additionalOptions = ['-movflags', 'faststart'];
        
        // 해상도에 따른 품질 조정
        if (processType.includes('upscale_4k')) {
          crf = '12'; // 4K는 적당한 CRF
          preset = 'slow';
        } else if (processType.includes('upscale_1440p') || processType.includes('upscale_2k')) {
          crf = '12';
        } else if (processType.includes('upscale_144p') || processType.includes('upscale_240p') || processType.includes('upscale_360p')) {
          crf = '18';
        }
        
        command = command
          .videoCodec('libx264')
          .outputOptions(['-crf', crf, '-preset', preset, ...additionalOptions]);
      }
      console.log(`✅ 코덱 설정 완료: ${preset}, CRF ${crf}`);
    } catch (codecError) {
      console.error(`❌ 코덱 설정 실패: ${codecError.message}`);
      // 기본 설정으로 폴백
      command = command
        .videoCodec('libx264')
        .outputOptions(['-crf', '18', '-preset', 'fast', '-movflags', 'faststart']);
      console.log(`🔄 기본 코덱 설정으로 폴백`);
    }

    // 타임아웃 설정 (4K는 더 긴 시간 허용)
    const timeout = processType.includes('upscale_4k') ? 180000 : 120000; // 4K: 3분, 기타: 2분
    
    const timeoutId = setTimeout(() => {
      console.error(`⏰ 처리 타임아웃: ${processType}`);
      reject(new Error('비디오 처리 시간이 초과되었습니다.'));
    }, timeout);

    // 안전한 FFmpeg 실행
    try {
      command
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`🔧 FFmpeg 명령어: ${commandLine}`);
        })
        .on('progress', (progress) => {
          console.log(`📊 처리 진행률: ${progress.percent}% 완료`);
        })
        .on('end', () => {
          clearTimeout(timeoutId);
          console.log(`✅ 비디오 처리 완료: ${processType}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          clearTimeout(timeoutId);
          console.error(`❌ 비디오 처리 오류: ${err.message}`);
          console.error(`🔍 오류 상세: ${err.stack}`);
          
          // 더 구체적인 오류 메시지
          let errorMsg = 'FFmpeg 처리 실패';
          if (err.message.includes('Invalid filter')) {
            errorMsg = '지원되지 않는 필터 조합입니다.';
          } else if (err.message.includes('No space left')) {
            errorMsg = '디스크 공간이 부족합니다.';
          } else if (err.message.includes('Permission denied')) {
            errorMsg = '파일 접근 권한이 없습니다.';
          } else if (err.message.includes('Invalid data')) {
            errorMsg = '입력 파일이 손상되었습니다.';
          }
          
          reject(new Error(`${errorMsg}: ${err.message}`));
        })
        .run();
    } catch (runError) {
      clearTimeout(timeoutId);
      console.error(`❌ FFmpeg 실행 실패: ${runError.message}`);
      reject(new Error(`FFmpeg 실행 실패: ${runError.message}`));
    }
  });
};

// 메타데이터 분석 API
app.post('/api/analyze-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '비디오 파일이 업로드되지 않았습니다.' });
    }

    const inputPath = req.file.path;
    
    // 입력 파일 존재 확인 및 파일 상태 검증
    if (!await fs.pathExists(inputPath)) {
      return res.status(400).json({ error: '업로드된 파일을 찾을 수 없습니다.' });
    }

    // 파일 크기 확인 (0바이트 파일 방지)
    const inputFileStats = await fs.stat(inputPath);
    if (inputFileStats.size === 0) {
      return res.status(400).json({ error: '업로드된 파일이 비어있습니다.' });
    }

    console.log(`📊 비디오 메타데이터 분석 시작: ${req.file.originalname}`);
    
    // 메타데이터 추출
    const metadata = await extractVideoMetadata(inputPath);
    
    // 자동 처리 타입 결정
    const autoProcessType = determineAutoProcessType(metadata);
    
    console.log(`🎯 자동 처리 타입 결정: ${autoProcessType}`);

    res.json({
      success: true,
      message: '메타데이터 분석 완료',
      metadata: metadata,
      autoProcessType: autoProcessType,
      recommendations: {
        suggestedResolution: autoProcessType.includes('upscale_') ? 
          autoProcessType.split('_')[1] : '원본 유지',
        suggestedEnhancements: autoProcessType.includes('enhanced') ? 
          ['화질 개선', '샤프닝'] : [],
        estimatedFileSize: '처리 후 확인 가능'
      }
    });

  } catch (error) {
    console.error('❌ 메타데이터 분석 오류:', error);
    res.status(500).json({ 
      error: '메타데이터 분석 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 비디오 업로드 및 처리 API (자동 처리 포함)
app.post('/api/process-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '비디오 파일이 업로드되지 않았습니다.' });
    }

    const { processType } = req.body;
    
    // processType이 없으면 자동 결정
    let finalProcessType = processType;
    if (!processType) {
      console.log('🤖 자동 처리 타입 결정 중...');
      const metadata = await extractVideoMetadata(req.file.path);
      finalProcessType = determineAutoProcessType(metadata);
      console.log(`🎯 자동 결정된 처리 타입: ${finalProcessType}`);
    }

    const inputPath = req.file.path;
    const outputFilename = `processed-${Date.now()}-${finalProcessType}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    // 입력 파일 존재 확인 및 파일 상태 검증
    if (!await fs.pathExists(inputPath)) {
      return res.status(400).json({ error: '업로드된 파일을 찾을 수 없습니다.' });
    }

    // 파일 크기 확인 (0바이트 파일 방지)
    const inputFileStats = await fs.stat(inputPath);
    if (inputFileStats.size === 0) {
      return res.status(400).json({ error: '업로드된 파일이 비어있습니다.' });
    }

    // 이전 출력 파일이 있다면 정리
    try {
      const existingFiles = await fs.readdir(outputDir);
      const oldFiles = existingFiles.filter(file => 
        file.startsWith('processed-') && 
        file.includes(finalProcessType.split('_')[0]) // 해상도별로 정리
      );
      
      for (const oldFile of oldFiles.slice(0, -5)) { // 최근 5개 파일만 유지
        await fs.remove(path.join(outputDir, oldFile));
        console.log(`🗑️ 이전 파일 정리: ${oldFile}`);
      }
    } catch (cleanupError) {
      console.warn('파일 정리 중 오류:', cleanupError.message);
    }

    console.log(`🎬 비디오 처리 시작: ${finalProcessType}`);
    console.log(`📁 입력 파일: ${inputPath}`);
    console.log(`📁 출력 파일: ${outputPath}`);
    
    // 처리 타입 분석 로그
    const features = [];
    if (finalProcessType.includes('upscale_')) features.push('해상도 변경');
    if (finalProcessType.includes('enhanced') || finalProcessType.includes('enhance_quality')) features.push('화질 개선');
    if (finalProcessType.includes('compress') || finalProcessType.includes('compressed')) features.push('압축');
    if (finalProcessType.includes('stabilize') || finalProcessType.includes('stabilized')) features.push('손떨림 보정');
    if (finalProcessType.includes('sharpen') || finalProcessType.includes('sharpened')) features.push('샤프닝');
    if (finalProcessType.includes('color_correction') || finalProcessType.includes('color_corrected')) features.push('색상 보정');
    if (finalProcessType.includes('deinterlace') || finalProcessType.includes('deinterlaced')) features.push('디인터레이스');
    if (finalProcessType.includes('fps_boost') || finalProcessType.includes('fps_boosted')) features.push('FPS 부스트');
    if (finalProcessType.includes('hdr_enhance') || finalProcessType.includes('hdr_enhanced')) features.push('HDR 향상');
    if (finalProcessType.includes('grain_add') || finalProcessType.includes('grain_added')) features.push('필름 그레인');
    if (finalProcessType.includes('vignette') || finalProcessType.includes('vignetted')) features.push('비네팅');
    if (finalProcessType.includes('blur_bg')) features.push('배경 블러');
    
    console.log(`✨ 적용 기능: ${features.join(', ')}`);

    // 비디오 처리 실행
    await processVideo(inputPath, outputPath, finalProcessType);

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

    // 원본 메타데이터도 추출
    let originalMetadata = null;
    try {
      originalMetadata = await extractVideoMetadata(inputPath);
    } catch (metadataError) {
      console.warn('원본 메타데이터 추출 실패:', metadataError.message);
    }

    res.json({
      success: true,
      message: '비디오 처리 완료',
      outputUrl: `/outputs/${outputFilename}`,
      fileSize: fileSizeInMB,
      processType: finalProcessType,
      metadata: processedMetadata,
      originalMetadata: originalMetadata,
      comparison: {
        resolutionChange: originalMetadata && processedMetadata ? 
          `${originalMetadata.width}x${originalMetadata.height} → ${processedMetadata.width}x${processedMetadata.height}` : 'N/A',
        sizeChange: originalMetadata && processedMetadata ? 
          `${originalMetadata.size}MB → ${fileSizeInMB}MB` : 'N/A',
        qualityImprovement: features.join(', ')
      }
    });

    // 입력 파일 정리 (선택사항)
    // await fs.remove(inputPath);

  } catch (error) {
    console.error('❌ 서버 오류:', error);
    console.error('🔍 오류 스택:', error.stack);
    console.error('📊 요청 정보:', {
      processType: req.body.processType,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      timestamp: new Date().toISOString()
    });
    
    // 오류 타입에 따른 응답
    let errorMessage = '비디오 처리 중 오류가 발생했습니다.';
    let statusCode = 500;
    
    if (error.message.includes('FFmpeg 처리 실패')) {
      errorMessage = 'FFmpeg 처리 중 오류가 발생했습니다. 지원되지 않는 필터 조합일 수 있습니다.';
    } else if (error.message.includes('메모리')) {
      errorMessage = '메모리 부족으로 처리할 수 없습니다. 더 낮은 해상도로 시도해보세요.';
    } else if (error.message.includes('파일')) {
      errorMessage = '파일 처리 중 오류가 발생했습니다.';
      statusCode = 400;
    } else if (error.message.includes('타임아웃')) {
      errorMessage = '처리 시간이 초과되었습니다. 더 낮은 해상도로 시도해보세요.';
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message,
      processType: req.body.processType || 'unknown',
      timestamp: new Date().toISOString()
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
  console.log(`✨ 지원 기능:`);
  console.log(`   📈 해상도: 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 2K, 4K, 2배, 3배`);
  console.log(`   🎨 효과: 화질 개선, 압축, 손떨림 보정, 샤프닝, 색상 보정, 디인터레이스`);
  console.log(`   🎬 고급: FPS 부스트, HDR 향상, 필름 그레인, 비네팅, 배경 블러`);
  console.log(`   🤖 자동 처리: 메타데이터 분석 기반 자동 최적화`);
});
