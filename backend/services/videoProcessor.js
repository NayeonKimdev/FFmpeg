const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

// FFmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * 비디오 화질 개선 처리 (브라우저 호환성 최우선)
 * @param {string} inputPath - 입력 파일 경로
 * @param {object} options - 개선 옵션
 * @returns {Promise<object>} 처리 결과
 */
const processVideo = (inputPath, options = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 입력 파일 존재 확인
      if (!fs.existsSync(inputPath)) {
        throw new Error('입력 파일이 존재하지 않습니다.');
      }

      // 출력 파일명 생성
      const inputFileName = path.basename(inputPath, path.extname(inputPath));
      const outputFileName = `${inputFileName}_enhanced.mp4`;
      const outputPath = path.join(__dirname, '../processed', outputFileName);

      // 출력 디렉토리 생성
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 입력 파일의 상세 메타데이터 확인
      const inputMetadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) {
            console.warn('입력 파일 메타데이터 확인 실패:', err.message);
            resolve({ hasAudio: false, originalFPS: 30, originalBitrate: '1000k' });
          } else {
            const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            
            // 원본 FPS 계산
            let originalFPS = 30;
            if (videoStream && videoStream.r_frame_rate) {
              const parts = videoStream.r_frame_rate.split('/');
              if (parts.length === 2) {
                originalFPS = parseFloat(parts[0]) / parseFloat(parts[1]);
              }
            }
            
            // 원본 비트레이트
            const originalBitrate = videoStream?.bit_rate ? `${Math.round(parseInt(videoStream.bit_rate) / 1000)}k` : '1000k';
            
            resolve({ hasAudio, originalFPS, originalBitrate });
          }
        });
      });

      console.log(`오디오 스트림 존재 여부: ${inputMetadata.hasAudio}`);
      console.log(`원본 FPS: ${inputMetadata.originalFPS}`);
      console.log(`원본 비트레이트: ${inputMetadata.originalBitrate}`);

      const {
        resolution = '1080p',
        bitrate = `${Math.round(parseInt(inputMetadata.originalBitrate) * 1.5)}k`, // 원본 비트레이트 1.5배 (안전한 증가)
        fps = inputMetadata.originalFPS, // 원본 FPS 유지
        codec = 'h264',
        quality = 'high'
      } = options;

      // 해상도 설정
      let resolutionSettings = '';
      switch (resolution) {
        case '720p':
          resolutionSettings = '1280:720';
          break;
        case '1080p':
          resolutionSettings = '1920:1080';
          break;
        case '4k':
          resolutionSettings = '3840:2160';
          break;
        default:
          resolutionSettings = '1920:1080';
      }

      // 품질 설정
      let qualitySettings = '';
      switch (quality) {
        case 'low':
          qualitySettings = '23';
          break;
        case 'medium':
          qualitySettings = '20';
          break;
        case 'high':
          qualitySettings = '18';
          break;
        default:
          qualitySettings = '20';
      }

      // 화질 향상 + 브라우저 호환성 동시 달성
      console.log('=== 화질 향상 + 브라우저 호환성 동시 달성 시작 ===');
      const outputOptions = [
        `-c:v ${codec}`,
        `-b:v ${bitrate}`, // 원본 비트레이트 1.5배 (안전한 증가)
        `-r ${fps}`, // 원본 FPS 유지
        `-vf scale=${resolutionSettings}:flags=lanczos`, // 해상도 변경
        `-crf ${qualitySettings}`, // 화질 향상
        '-preset fast', // 빠르면서도 품질 확보
        '-pix_fmt yuv420p', // 웹 호환성 필수
        '-profile:v baseline', // 가장 넓은 호환성
        '-level 3.1', // 브라우저 호환성
        '-movflags +faststart', // 웹 최적화
        '-avoid_negative_ts make_zero', // 타임스탬프 수정
        '-g 30', // GOP 크기 제한 (브라우저 호환성)
        '-keyint_min 30', // 최소 키프레임 간격
        '-sc_threshold 0', // 장면 변화 감지 비활성화
        '-y' // 기존 파일 덮어쓰기
      ];

      // 오디오 스트림이 있을 때만 오디오 옵션 추가
      if (inputMetadata.hasAudio) {
        outputOptions.push(
          '-c:a copy', // 원본 오디오 스트림 그대로 복사
        );
        console.log('오디오 스트림이 있어 원본 오디오를 그대로 복사합니다.');
      } else {
        outputOptions.push('-an'); // 오디오 없음
        console.log('오디오 스트림이 없어 오디오 처리를 건너뜁니다.');
      }

      console.log(`설정: 해상도=${resolution}, 비트레이트=${bitrate} (원본 1.5배), FPS=${fps} (원본 유지), CRF=${qualitySettings}, 화질 향상 + 호환성`);

      // 단일 단계 실행
      await new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .outputOptions(outputOptions)
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg 명령어:', commandLine);
          })
          .on('progress', (progress) => {
            console.log(`진행률: ${progress.percent}% 완료`);
          })
          .on('end', () => {
            console.log('비디오 처리 완료');
            resolve();
          })
          .on('error', (err) => {
            console.error('FFmpeg 오류:', err);
            reject(new Error(`비디오 처리 실패: ${err.message}`));
          });

        command.run();
      });

      // 결과 정보 수집
      const stats = fs.statSync(outputPath);
      const result = {
        success: true,
        inputFile: path.basename(inputPath),
        outputFile: outputFileName,
        outputPath: outputPath,
        size: stats.size,
        processingTime: new Date().toISOString(),
        options: options,
        workflow: '화질 향상 + 브라우저 호환성 동시 달성 (비트레이트 1.5배 + 해상도 개선 + GOP 최적화)'
      };
      
      console.log('최종 처리 결과:', result);
      resolve(result);

    } catch (error) {
      console.error('비디오 처리 초기화 오류:', error);
      reject(new Error(`비디오 처리 초기화 실패: ${error.message}`));
    }
  });
};

/**
 * 비디오 메타데이터 추출
 * @param {string} filePath - 비디오 파일 경로
 * @returns {Promise<object>} 메타데이터
 */
const extractMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('FFprobe 오류:', err);
        reject(new Error(`메타데이터 추출 실패: ${err.message}`));
        return;
      }

      try {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        // FPS 계산 함수
        const calculateFPS = (rFrameRate) => {
          if (!rFrameRate) return 0;
          try {
            // "30/1" 형태의 문자열을 파싱
            const parts = rFrameRate.split('/');
            if (parts.length === 2) {
              const numerator = parseFloat(parts[0]);
              const denominator = parseFloat(parts[1]);
              return denominator > 0 ? numerator / denominator : 0;
            }
            return parseFloat(rFrameRate) || 0;
          } catch (error) {
            console.error('FPS 계산 오류:', error);
            return 0;
          }
        };

        const result = {
          format: {
            formatName: metadata.format?.format_name || 'unknown',
            duration: metadata.format?.duration || '0',
            size: metadata.format?.size || '0',
            bitrate: metadata.format?.bit_rate || '0'
          },
          video: videoStream ? {
            codec: videoStream.codec_name || 'unknown',
            resolution: `${videoStream.width || 0}x${videoStream.height || 0}`,
            fps: calculateFPS(videoStream.r_frame_rate),
            bitrate: videoStream.bit_rate || '0',
            duration: videoStream.duration || '0'
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name || 'unknown',
            sampleRate: audioStream.sample_rate || '0',
            channels: audioStream.channels || 0,
            bitrate: audioStream.bit_rate || '0'
          } : null
        };

        console.log('메타데이터 추출 성공:', {
          format: result.format.formatName,
          resolution: result.video?.resolution,
          fps: result.video?.fps,
          bitrate: result.video?.bitrate
        });

        resolve(result);
      } catch (error) {
        console.error('메타데이터 파싱 오류:', error);
        reject(new Error(`메타데이터 파싱 실패: ${error.message}`));
      }
    });
  });
};

/**
 * 파일 검증
 * @param {string} filePath - 파일 경로
 * @returns {Promise<boolean>} 유효성 여부
 */
const validateVideoFile = (filePath) => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err) => {
      resolve(!err);
    });
  });
};

/**
 * 상세한 비디오 분석 (프레임레이트, 오디오 동기화 등)
 * @param {string} filePath - 비디오 파일 경로
 * @returns {Promise<object>} 상세 분석 결과
 */
const analyzeVideoDetails = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`비디오 분석 실패: ${err.message}`));
        return;
      }

      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        // 상세한 분석 결과
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
                    return parseFloat(parts[0]) / parseFloat(parts[1]);
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
          
          analysis.syncIssues.durationDiff = durationDiff;
          analysis.syncIssues.hasSyncProblem = durationDiff > 0.1; // 0.1초 이상 차이면 문제
          
          if (durationDiff > 0.1) {
            analysis.syncIssues.details.push(`오디오/비디오 길이 차이: ${durationDiff.toFixed(3)}초`);
          }
          
          // 프레임레이트 관련 문제 분석
          const videoFPS = analysis.video.fps.calculated;
          if (videoFPS > 0) {
            const frameDuration = 1 / videoFPS;
            const expectedAudioSamples = Math.round(audioDuration * analysis.audio.sampleRate);
            const actualAudioSamples = Math.round(audioDuration * analysis.audio.sampleRate);
            const sampleDiff = Math.abs(expectedAudioSamples - actualAudioSamples);
            
            if (sampleDiff > 1000) { // 1000 샘플 이상 차이면 문제
              analysis.syncIssues.details.push(`오디오 샘플 동기화 문제: ${sampleDiff} 샘플 차이`);
              analysis.syncIssues.hasSyncProblem = true;
            }
          }
        }

        console.log('상세한 비디오 분석 결과:', JSON.stringify(analysis, null, 2));
        resolve(analysis);

      } catch (error) {
        reject(new Error(`분석 파싱 실패: ${error.message}`));
      }
    });
  });
};

/**
 * 임시 파일 정리
 * @param {string} tempDir - 임시 디렉토리 경로
 */
const cleanupTempFiles = (tempDir = path.join(__dirname, '../temp')) => {
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`임시 파일 삭제: ${file}`);
      } catch (error) {
        console.error(`임시 파일 삭제 실패: ${file}`, error);
      }
    });
  }
};

module.exports = {
  processVideo,
  extractMetadata,
  validateVideoFile,
  cleanupTempFiles,
  analyzeVideoDetails
};
