const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

// FFmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * 비디오 화질 개선 처리 (오디오 문제 해결)
 * @param {string} inputPath - 입력 파일 경로
 * @param {object} options - 개선 옵션
 * @returns {Promise<object>} 처리 결과
 */
const processVideo = (inputPath, options = {}) => {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    
    try {
      console.log('=== 비디오 처리 시작 ===');
      console.log('입력 파일:', inputPath);
      console.log('입력 파일 존재:', fs.existsSync(inputPath));
      
      // 입력 파일 존재 확인
      if (!fs.existsSync(inputPath)) {
        throw new Error('입력 파일이 존재하지 않습니다.');
      }

      // 파일 크기 확인
      const inputStats = fs.statSync(inputPath);
      if (inputStats.size === 0) {
        throw new Error('입력 파일이 비어있습니다.');
      }
      
      console.log('입력 파일 크기:', Math.round(inputStats.size / 1024 / 1024), 'MB');

      // 출력 파일명 생성
      const inputFileName = path.basename(inputPath, path.extname(inputPath));
      const outputFileName = `${inputFileName}_enhanced.mp4`;
      const outputPath = path.join(__dirname, '../processed', outputFileName);
      const progressFilePath = path.join(__dirname, '../temp', `${outputFileName}.progress`);

      console.log('출력 파일 경로:', outputPath);
      console.log('진행률 파일 경로:', progressFilePath);

      // 출력 디렉토리 생성
      const outputDir = path.dirname(outputPath);
      const tempDir = path.dirname(progressFilePath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 기존 출력 파일 삭제 (있다면)
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      // 입력 파일의 상세 메타데이터 확인
      const inputMetadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) {
            console.error('입력 파일 메타데이터 확인 실패:', err.message);
            reject(new Error(`입력 파일 분석 실패: ${err.message}`));
          } else {
            const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            
            if (!videoStream) {
              reject(new Error('비디오 스트림을 찾을 수 없습니다.'));
              return;
            }
            
            const hasAudio = !!audioStream;
            
            // 원본 FPS 계산
            let originalFPS = 25;
            if (videoStream && videoStream.r_frame_rate) {
              const parts = videoStream.r_frame_rate.split('/');
              if (parts.length === 2) {
                const fps = parseFloat(parts[0]) / parseFloat(parts[1]);
                originalFPS = Math.min(fps, 30); // 최대 30fps로 제한
              }
            }
            
            // 원본 해상도
            const originalWidth = videoStream.width || 640;
            const originalHeight = videoStream.height || 480;
            
            // 영상 길이
            const duration = parseFloat(metadata.format?.duration) || 0;
            
            resolve({ 
              hasAudio, 
              originalFPS, 
              originalWidth,
              originalHeight,
              audioStream,
              videoStream,
              duration,
              metadata
            });
          }
        });
      });

      console.log('=== 입력 파일 메타데이터 ===');
      console.log(`해상도: ${inputMetadata.originalWidth}x${inputMetadata.originalHeight}`);
      console.log(`FPS: ${inputMetadata.originalFPS}`);
      console.log(`오디오: ${inputMetadata.hasAudio ? '있음' : '없음'}`);
      console.log(`길이: ${inputMetadata.duration}초`);

      // 처리 옵션 설정 (더 보수적으로)
      const {
        resolution = 'auto', // 자동 해상도 선택
        quality = 'medium',   // 품질을 medium으로 기본값 설정
        codec = 'h264'
      } = options;

      // 해상도 자동 선택 로직 (원본 해상도 완전 유지, 화질 중심 개선)
      let targetWidth, targetHeight;
      
      if (resolution === 'auto') {
        // 원본 해상도 완전 유지 (화질 개선에만 집중)
        targetWidth = inputMetadata.originalWidth;
        targetHeight = inputMetadata.originalHeight;
      } else {
        // 수동 해상도 설정
        switch (resolution) {
          case '720p':
            targetWidth = 1280;
            targetHeight = 720;
            break;
          case '1080p':
            targetWidth = 1920;
            targetHeight = 1080;
            break;
          default:
            targetWidth = Math.floor(inputMetadata.originalWidth / 2) * 2;
            targetHeight = Math.floor(inputMetadata.originalHeight / 2) * 2;
        }
      }

      // 품질 설정 (CRF 값)
      let crfValue;
      switch (quality) {
        case 'low':
          crfValue = 28;
          break;
        case 'medium':
          crfValue = 25;
          break;
        case 'high':
          crfValue = 22;
          break;
        default:
          crfValue = 25;
      }

      // FPS 설정 (원본보다 높지 않게)
      const targetFPS = Math.min(inputMetadata.originalFPS, 25);

      console.log('=== 처리 설정 ===');
      console.log(`목표 해상도: ${targetWidth}x${targetHeight}`);
      console.log(`목표 FPS: ${targetFPS}`);
      console.log(`CRF: ${crfValue}`);
      console.log(`코덱: ${codec}`);

      // 진행률 초기화
      const updateProgress = (percent, message, status = 'processing') => {
        const progressInfo = {
          percent: Math.max(0, Math.min(100, percent)),
          message: message,
          status: status,
          timestamp: new Date().toISOString()
        };
        
        try {
          fs.writeFileSync(progressFilePath, JSON.stringify(progressInfo));
        } catch (writeError) {
          console.warn('진행률 파일 쓰기 실패:', writeError.message);
        }
      };

      updateProgress(5, 'FFmpeg 초기화 중...');

      // 해상도에 따른 비트레이트 설정
      let videoBitrate, maxBitrate, bufferSize;
      
      if (targetWidth <= 640) {
        // 480p 이하: 2-3Mbps
        videoBitrate = '2500k';
        maxBitrate = '3000k';
        bufferSize = '6000k';
      } else if (targetWidth <= 1280) {
        // 720p: 4-5Mbps
        videoBitrate = '4000k';
        maxBitrate = '5000k';
        bufferSize = '10000k';
      } else if (targetWidth <= 1920) {
        // 1080p: 6-8Mbps
        videoBitrate = '6000k';
        maxBitrate = '8000k';
        bufferSize = '16000k';
      } else {
        // 4K 이상: 10-12Mbps
        videoBitrate = '10000k';
        maxBitrate = '12000k';
        bufferSize = '24000k';
      }

      console.log(`=== 비트레이트 설정 ===`);
      console.log(`해상도: ${targetWidth}x${targetHeight}`);
      console.log(`비트레이트: ${videoBitrate}`);
      console.log(`최대 비트레이트: ${maxBitrate}`);
      console.log(`버퍼 크기: ${bufferSize}`);

      // FFmpeg 명령 구성 (명시적 고비트레이트 설정)
      const videoOptions = [
        `-c:v libx264`, // 명시적으로 libx264 사용
        `-b:v ${videoBitrate}`, // 해상도별 최적 비트레이트
        `-maxrate ${maxBitrate}`, // 최대 비트레이트
        `-bufsize ${bufferSize}`, // 버퍼 크기
        `-preset slow`, // 최고 품질을 위한 느린 프리셋
        `-pix_fmt yuv420p`, // 웹 호환 픽셀 포맷
        `-profile:v high`, // 고품질 프로필
        `-level 4.0`, // 높은 레벨로 더 나은 압축
        `-r ${targetFPS}`,
        `-vf scale=${targetWidth}:${targetHeight}:flags=lanczos`, // 고품질 스케일링
        `-movflags +faststart`, // 웹 스트리밍 최적화
        `-bf 2`, // B-프레임 증가로 압축 효율 향상
        `-refs 3`, // 참조 프레임 증가로 품질 향상
        `-me_method umh`, // 고급 모션 추정
        `-subq 7`, // 서브픽셀 정밀도 최대화
        `-trellis 1`, // 트렐리스 양자화로 품질 향상
        `-aq-mode 2` // 적응형 양자화로 디테일 보존
      ];

      // 오디오 옵션 (초고품질 오디오)
      let audioOptions = [];
      
      if (!inputMetadata.hasAudio) {
        audioOptions.push('-an');
        console.log('오디오 처리: 오디오 스트림 없음');
      } else {
        // 초고품질 오디오 설정
        audioOptions = [
          '-c:a aac',
          '-b:a 320k', // 최고 비트레이트로 품질 극대화
          '-ar 48000', // 높은 샘플레이트
          '-ac 2', // 스테레오
          '-aac_coder twoloop' // 고품질 AAC 인코더
        ];
        console.log('오디오 처리: 초고품질 AAC (320k, 48kHz, 스테레오)');
      }

      // 전체 옵션 결합
      const allOptions = [
        ...videoOptions,
        ...audioOptions,
        '-y' // 기존 파일 덮어쓰기
      ];

      console.log('=== FFmpeg 실행 ===');
      console.log('명령 옵션:', allOptions.join(' '));

      updateProgress(10, 'FFmpeg 처리 시작...');

      // FFmpeg 실행
      let lastProgressTime = Date.now();
      
      const ffmpegCommand = ffmpeg(inputPath)
        .outputOptions(allOptions)
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg 시작:', commandLine);
          updateProgress(15, '비디오 인코딩 시작...');
        })
        .on('progress', (progress) => {
          // 진행률 계산 (더 정확하게)
          let percent = 15; // 시작 진행률
          
          if (progress.percent && !isNaN(progress.percent)) {
            // FFmpeg에서 제공하는 진행률 사용
            percent = 15 + (progress.percent * 0.8); // 15%~95% 범위
          } else if (progress.timemark && inputMetadata.duration > 0) {
            // 시간 기반 진행률 계산
            const timeParts = progress.timemark.split(':');
            if (timeParts.length === 3) {
              const currentTime = parseInt(timeParts[0]) * 3600 + 
                                parseInt(timeParts[1]) * 60 + 
                                parseFloat(timeParts[2]);
              percent = 15 + ((currentTime / inputMetadata.duration) * 80);
            }
          }
          
          percent = Math.max(15, Math.min(95, percent));
          
          // 진행률 업데이트 (너무 자주 하지 않도록 제한)
          const now = Date.now();
          if (now - lastProgressTime > 2000) { // 2초마다 업데이트
            const message = progress.timemark ? 
              `처리 중... (${progress.timemark})` : 
              '처리 중...';
            
            updateProgress(Math.round(percent), message);
            console.log(`진행률: ${Math.round(percent)}% - ${message}`);
            lastProgressTime = now;
          }
        })
        .on('stderr', (stderrLine) => {
          // 에러나 중요한 정보만 로그
          if (stderrLine.includes('error') || stderrLine.includes('Error')) {
            console.error('FFmpeg stderr:', stderrLine);
          } else if (stderrLine.includes('frame=')) {
            // 진행 상황은 가끔만 출력
            if (Math.random() < 0.1) {
              console.log('FFmpeg 진행:', stderrLine.trim());
            }
          }
        })
        .on('end', async () => {
          try {
            console.log('FFmpeg 처리 완료');
            updateProgress(95, '후처리 중...');
            
            // 파일 생성 완료 대기 (최대 5초)
            let retryCount = 0;
            const maxRetries = 50; // 5초 대기 (100ms * 50)
            
            while (retryCount < maxRetries) {
              if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                // 파일이 최근 1초 내에 수정되지 않았으면 완료로 간주
                const now = Date.now();
                const modifiedTime = stats.mtime.getTime();
                const timeSinceModified = now - modifiedTime;
                
                if (timeSinceModified > 1000 && stats.size > 1024) {
                  console.log('파일 생성 완료 확인됨');
                  break;
                }
              }
              
              await new Promise(resolve => setTimeout(resolve, 100));
              retryCount++;
            }
            
            if (retryCount >= maxRetries) {
              throw new Error('파일 생성 완료 확인 시간 초과');
            }
            
            // 출력 파일 검증
            if (!fs.existsSync(outputPath)) {
              throw new Error('출력 파일이 생성되지 않았습니다.');
            }

            const outputStats = fs.statSync(outputPath);
            if (outputStats.size === 0) {
              fs.unlinkSync(outputPath);
              throw new Error('출력 파일이 비어있습니다.');
            }

            if (outputStats.size < 1024) {
              fs.unlinkSync(outputPath);
              throw new Error(`출력 파일이 너무 작습니다: ${outputStats.size} bytes`);
            }

            console.log('출력 파일 크기:', Math.round(outputStats.size / 1024 / 1024), 'MB');

            // 출력 파일 메타데이터 검증
            const outputMetadata = await new Promise((resolve, reject) => {
              ffmpeg.ffprobe(outputPath, (err, metadata) => {
                if (err) {
                  console.warn('출력 파일 메타데이터 확인 실패:', err.message);
                  resolve(null);
                } else {
                  const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                  if (!videoStream) {
                    reject(new Error('출력 파일에 비디오 스트림이 없습니다.'));
                  } else {
                    resolve(metadata);
                  }
                }
              });
            });

            updateProgress(100, '완료!', 'completed');

            const processingTime = Date.now() - startTime;
            console.log('=== 처리 완료 ===');
            console.log('처리 시간:', Math.round(processingTime / 1000), '초');
            
            if (outputMetadata) {
              const outVideoStream = outputMetadata.streams.find(s => s.codec_type === 'video');
              const outAudioStream = outputMetadata.streams.find(s => s.codec_type === 'audio');
              
              console.log(`출력 해상도: ${outVideoStream?.width}x${outVideoStream?.height}`);
              console.log(`출력 코덱: ${outVideoStream?.codec_name}`);
              console.log(`출력 오디오: ${outAudioStream?.codec_name || '없음'}`);
            }

            // 결과 반환
            const result = {
              success: true,
              inputFile: path.basename(inputPath),
              outputFile: outputFileName,
              outputPath: outputPath,
              size: outputStats.size,
              processingTime: `${Math.round(processingTime / 1000)}초`,
              options: options,
              metadata: {
                input: inputMetadata.metadata,
                output: outputMetadata
              },
              workflow: '안정화된 화질 향상 (오디오 보존)'
            };
            
            resolve(result);

          } catch (postError) {
            console.error('후처리 오류:', postError);
            updateProgress(0, '후처리 실패', 'failed');
            reject(postError);
          }
        })
        .on('error', (err) => {
          console.error('FFmpeg 오류:', err.message);
          updateProgress(0, `처리 실패: ${err.message}`, 'failed');
          
          // 실패한 파일 정리
          if (fs.existsSync(outputPath)) {
            try {
              fs.unlinkSync(outputPath);
            } catch (cleanupError) {
              console.warn('실패한 파일 정리 실패:', cleanupError.message);
            }
          }
          
          reject(new Error(`비디오 처리 실패: ${err.message}`));
        });

      // 타임아웃 설정 (20분 - 고품질 처리를 위해 시간 증가)
      const timeout = setTimeout(() => {
        console.log('FFmpeg 타임아웃');
        ffmpegCommand.kill('SIGKILL');
        updateProgress(0, '처리 시간 초과', 'timeout');
        reject(new Error('비디오 처리 타임아웃 (20분 초과)'));
      }, 20 * 60 * 1000);

      ffmpegCommand.on('end', () => clearTimeout(timeout));
      ffmpegCommand.on('error', () => clearTimeout(timeout));

      // FFmpeg 실행
      ffmpegCommand.run();

    } catch (error) {
      console.error('=== 비디오 처리 실패 ===');
      console.error('오류:', error.message);
      
      // 진행률 파일에 오류 상태 기록
      const progressFilePath = path.join(__dirname, '../temp', `${path.basename(inputPath, path.extname(inputPath))}_enhanced.mp4.progress`);
      try {
        const errorProgress = {
          percent: 0,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        fs.writeFileSync(progressFilePath, JSON.stringify(errorProgress));
      } catch (writeError) {
        console.warn('오류 진행률 파일 쓰기 실패:', writeError.message);
      }
      
      reject(error);
    }
  });
};

/**
 * 비디오 메타데이터 추출 (오류 처리 강화)
 */
const extractMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
      reject(new Error('파일이 존재하지 않습니다.'));
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      reject(new Error('파일이 비어있습니다.'));
      return;
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('FFprobe 오류:', err);
        reject(new Error(`메타데이터 추출 실패: ${err.message}`));
        return;
      }

      try {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        if (!videoStream) {
          reject(new Error('비디오 스트림을 찾을 수 없습니다.'));
          return;
        }

        // FPS 계산 함수 (더 안전하게)
        const calculateFPS = (rFrameRate) => {
          if (!rFrameRate) return 0;
          try {
            const parts = String(rFrameRate).split('/');
            if (parts.length === 2) {
              const numerator = parseFloat(parts[0]);
              const denominator = parseFloat(parts[1]);
              if (denominator > 0) {
                return Math.round((numerator / denominator) * 100) / 100;
              }
            }
            const fps = parseFloat(rFrameRate);
            return isNaN(fps) ? 0 : Math.round(fps * 100) / 100;
          } catch (error) {
            console.error('FPS 계산 오류:', error);
            return 0;
          }
        };

        const result = {
          format: {
            formatName: metadata.format?.format_name || 'unknown',
            duration: String(metadata.format?.duration || '0'),
            size: String(metadata.format?.size || '0'),
            bitrate: String(metadata.format?.bit_rate || '0')
          },
          video: {
            codec: videoStream.codec_name || 'unknown',
            resolution: `${videoStream.width || 0}x${videoStream.height || 0}`,
            fps: calculateFPS(videoStream.r_frame_rate),
            bitrate: String(videoStream.bit_rate || '0'),
            duration: String(videoStream.duration || '0')
          },
          audio: audioStream ? {
            codec: audioStream.codec_name || 'unknown',
            sampleRate: String(audioStream.sample_rate || '0'),
            channels: audioStream.channels || 0,
            bitrate: String(audioStream.bit_rate || '0')
          } : null
        };

        resolve(result);
      } catch (error) {
        console.error('메타데이터 파싱 오류:', error);
        reject(new Error(`메타데이터 파싱 실패: ${error.message}`));
      }
    });
  });
};

/**
 * 상세한 비디오 분석
 */
const analyzeVideoDetails = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error('파일이 존재하지 않습니다.'));
      return;
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`비디오 분석 실패: ${err.message}`));
        return;
      }

      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        const analysis = {
          filePath: filePath,
          fileName: path.basename(filePath),
          format: {
            formatName: metadata.format?.format_name,
            duration: parseFloat(metadata.format?.duration) || 0,
            size: parseInt(metadata.format?.size) || 0,
            bitrate: parseInt(metadata.format?.bit_rate) || 0
          },
          video: videoStream ? {
            codec: videoStream.codec_name,
            resolution: `${videoStream.width}x${videoStream.height}`,
            fps: {
              r_frame_rate: videoStream.r_frame_rate,
              avg_frame_rate: videoStream.avg_frame_rate,
              calculated: (() => {
                if (videoStream.r_frame_rate) {
                  const parts = videoStream.r_frame_rate.split('/');
                  if (parts.length === 2) {
                    const fps = parseFloat(parts[0]) / parseFloat(parts[1]);
                    return Math.round(fps * 100) / 100;
                  }
                }
                return 0;
              })()
            },
            bitrate: parseInt(videoStream.bit_rate) || 0,
            duration: parseFloat(videoStream.duration) || 0,
            time_base: videoStream.time_base,
            start_time: parseFloat(videoStream.start_time) || 0
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            sampleRate: parseInt(audioStream.sample_rate) || 0,
            channels: parseInt(audioStream.channels) || 0,
            bitrate: parseInt(audioStream.bit_rate) || 0,
            duration: parseFloat(audioStream.duration) || 0,
            time_base: audioStream.time_base,
            start_time: parseFloat(audioStream.start_time) || 0
          } : null,
          syncIssues: {
            durationDiff: 0,
            hasSyncProblem: false,
            details: []
          }
        };

        // 동기화 문제 분석
        if (videoStream && audioStream) {
          const videoDuration = analysis.video.duration;
          const audioDuration = analysis.audio.duration;
          const durationDiff = Math.abs(videoDuration - audioDuration);
          
          analysis.syncIssues.durationDiff = Math.round(durationDiff * 1000) / 1000;
          analysis.syncIssues.hasSyncProblem = durationDiff > 0.1;
          
          if (durationDiff > 0.1) {
            analysis.syncIssues.details.push(`오디오/비디오 길이 차이: ${durationDiff.toFixed(3)}초`);
          }

          const startTimeDiff = Math.abs(analysis.video.start_time - analysis.audio.start_time);
          if (startTimeDiff > 0.05) {
            analysis.syncIssues.details.push(`시작 시간 차이: ${startTimeDiff.toFixed(3)}초`);
            analysis.syncIssues.hasSyncProblem = true;
          }
        }

        resolve(analysis);
      } catch (error) {
        reject(new Error(`분석 파싱 실패: ${error.message}`));
      }
    });
  });
};

/**
 * 파일 검증
 */
const validateVideoFile = (filePath) => {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      resolve(false);
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      resolve(false);
      return;
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('파일 검증 실패:', err.message);
        resolve(false);
        return;
      }

      const hasVideo = metadata.streams.some(stream => stream.codec_type === 'video');
      resolve(hasVideo);
    });
  });
};

/**
 * 임시 파일 정리
 */
const cleanupTempFiles = (tempDir = path.join(__dirname, '../temp')) => {
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`임시 파일 삭제: ${file}`);
        } catch (error) {
          console.error(`임시 파일 삭제 실패: ${file}`, error.message);
        }
      });
    }
  } catch (error) {
    console.error('임시 파일 정리 실패:', error.message);
  }
};

module.exports = {
  processVideo,
  extractMetadata,
  validateVideoFile,
  cleanupTempFiles,
  analyzeVideoDetails
};