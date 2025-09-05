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
            resolve({ 
              hasAudio: false, 
              originalFPS: 30, 
              originalBitrate: '1000k',
              audioCodec: null,
              videoCodec: null,
              duration: 0
            });
          } else {
            const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            
            const hasAudio = !!audioStream;
            
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
            
            // 오디오/비디오 코덱 정보
            const audioCodec = audioStream?.codec_name || null;
            const videoCodec = videoStream?.codec_name || null;
            
            // 영상 길이
            const duration = parseFloat(metadata.format?.duration) || 0;
            
            resolve({ 
              hasAudio, 
              originalFPS, 
              originalBitrate, 
              audioCodec,
              videoCodec,
              duration,
              audioStream,
              videoStream
            });
          }
        });
      });

      console.log('=== 입력 파일 메타데이터 ===');
      console.log(`오디오 스트림: ${inputMetadata.hasAudio ? '있음' : '없음'}`);
      console.log(`오디오 코덱: ${inputMetadata.audioCodec || 'N/A'}`);
      console.log(`비디오 코덱: ${inputMetadata.videoCodec || 'N/A'}`);
      console.log(`원본 FPS: ${inputMetadata.originalFPS}`);
      console.log(`원본 비트레이트: ${inputMetadata.originalBitrate}`);
      console.log(`영상 길이: ${inputMetadata.duration}초`);

      const {
        resolution = '1080p',
        bitrate = `${Math.round(parseInt(inputMetadata.originalBitrate) * 1.2)}k`, // 1.2배로 줄임 (안전)
        fps = inputMetadata.originalFPS,
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

      // 품질 설정 (더 보수적으로)
      let qualitySettings = '';
      switch (quality) {
        case 'low':
          qualitySettings = '28';
          break;
        case 'medium':
          qualitySettings = '23';
          break;
        case 'high':
          qualitySettings = '20'; // 18에서 20으로 변경 (더 안전)
          break;
        default:
          qualitySettings = '23';
      }

      console.log('=== 처리 설정 ===');
      console.log(`해상도: ${resolution} (${resolutionSettings})`);
      console.log(`비트레이트: ${bitrate}`);
      console.log(`FPS: ${fps}`);
      console.log(`CRF: ${qualitySettings}`);

      // 오디오 처리 전략 결정
      let audioOptions = [];
      
      // 비디오 처리 옵션 (최대 단순화 - 호환성 우선)
      const videoOptions = [
        `-c:v ${codec}`,
        `-crf 30`, // 28에서 30으로 변경 (더 안전)
        `-maxrate ${Math.round(parseInt(bitrate) * 0.5)}k`, // 비트레이트 더 보수적으로
        `-bufsize ${Math.round(parseInt(bitrate) * 0.8)}k`, // 버퍼 크기 더 줄임
        `-r ${Math.min(fps, 24)}`, // FPS 제한 (25에서 24로)
        `-vf scale=${resolutionSettings}:flags=lanczos`, // format=yuv420p 제거
        '-preset ultrafast', // ultrafast 유지
        '-pix_fmt yuv420p',
        '-profile:v baseline',
        '-level 3.0', // 3.1에서 3.0으로 (더 안전)
        '-movflags +faststart', // 복잡한 플래그 제거
        '-avoid_negative_ts make_zero',
        '-fflags +genpts', // igndts 제거
        '-vsync cfr',
        '-max_muxing_queue_size 512' // 큐 크기 더 줄임
      ];

      // 오디오 처리 (더 단순하게)
      if (!inputMetadata.hasAudio) {
        audioOptions.push('-an');
        console.log('오디오 처리: 오디오 스트림 없음');
      } else {
        // 단순한 AAC 재인코딩
        audioOptions = [
          '-c:a aac',
          '-b:a 64k', // 96k에서 64k로 줄임
          '-ar 44100',
          '-ac 2'
        ];
        console.log(`오디오 처리: ${inputMetadata.audioCodec} -> AAC 재인코딩 (단순화)`);
      }

      // GOP 설정 (더 단순하게)
      const gopSize = Math.min(Math.round(fps * 0.8), 20); // 1.0초에서 0.8초로
      videoOptions.push(
        `-g ${gopSize}`,
        `-keyint_min ${Math.round(gopSize / 2)}`, // 2에서 2로 유지
        '-sc_threshold 0' // 0 유지 (장면 변화 감지 비활성화)
      );

      console.log(`GOP 크기: ${gopSize} (${gopSize/fps}초)`);

      // 전체 출력 옵션 조합
      const outputOptions = [
        ...videoOptions,
        ...audioOptions,
        '-y' // 기존 파일 덮어쓰기
      ];

      console.log('=== FFmpeg 시작 ===');
      console.log('출력 옵션:', outputOptions.join(' '));

      // FFmpeg 실행
      await new Promise((resolve, reject) => {
        let stderrOutput = [];
        let progressData = {
          percent: 0,
          timemark: '00:00:00',
          fps: 0,
          q: 0,
          size: 0,
          time: 0,
          bitrate: 0,
          speed: 0
        };
        
        // 진행률 파일 경로
        const progressFilePath = path.join(__dirname, '../temp', `${outputFileName}.progress`);
        
        const command = ffmpeg(inputPath)
          .outputOptions(outputOptions)
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg 명령어:', commandLine);
            // 진행률 파일 초기화
            fs.writeFileSync(progressFilePath, JSON.stringify({ percent: 0, status: 'started' }));
          })
          .on('progress', (progress) => {
            progressData = progress;
            
            // 진행률 계산 (더 정확하게)
            let percent = 0;
            if (progress.percent) {
              percent = Math.round(progress.percent);
            } else if (progress.timemark && inputMetadata.duration > 0) {
              // 시간 기반 진행률 계산
              const timeParts = progress.timemark.split(':');
              const currentTime = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseFloat(timeParts[2]);
              percent = Math.round((currentTime / inputMetadata.duration) * 100);
            }
            
            // 진행률을 0-100 범위로 제한
            percent = Math.max(0, Math.min(100, percent));
            
            if (percent > 0) {
              console.log(`진행률: ${percent}% 완료 (${progress.timemark})`);
              
              // 진행률 정보를 파일에 저장
              const progressInfo = {
                percent: percent,
                timemark: progress.timemark,
                fps: progress.fps,
                speed: progress.speed,
                status: 'processing',
                timestamp: new Date().toISOString()
              };
              
              try {
                fs.writeFileSync(progressFilePath, JSON.stringify(progressInfo));
              } catch (writeError) {
                console.warn('진행률 파일 쓰기 실패:', writeError.message);
              }
            }
          })
          .on('stderr', (stderrLine) => {
            stderrOutput.push(stderrLine);
            // 모든 stderr 출력 (디버깅용)
            console.log('FFmpeg stderr:', stderrLine);
          })
          .on('end', () => {
            console.log('=== FFmpeg 완료 ===');
            
            // 완료 상태를 진행률 파일에 저장
            try {
              const finalProgress = {
                percent: 100,
                status: 'completed',
                timestamp: new Date().toISOString()
              };
              fs.writeFileSync(progressFilePath, JSON.stringify(finalProgress));
            } catch (writeError) {
              console.warn('최종 진행률 파일 쓰기 실패:', writeError.message);
            }
            
            resolve();
          })
          .on('error', (err) => {
            console.error('=== FFmpeg 오류 ===');
            console.error('오류 메시지:', err.message);
            console.error('오류 스택:', err.stack);
            console.error('FFmpeg stderr 출력:', stderrOutput.join('\n'));
            
            // 오류 상태를 진행률 파일에 저장
            try {
              const errorProgress = {
                percent: 0,
                status: 'failed',
                error: err.message,
                timestamp: new Date().toISOString()
              };
              fs.writeFileSync(progressFilePath, JSON.stringify(errorProgress));
            } catch (writeError) {
              console.warn('오류 진행률 파일 쓰기 실패:', writeError.message);
            }
            
            reject(new Error(`비디오 처리 실패: ${err.message}`));
          });

        // 타임아웃 설정 (30분)
        const timeout = setTimeout(() => {
          command.kill('SIGKILL');
          
          // 타임아웃 상태를 진행률 파일에 저장
          try {
            const timeoutProgress = {
              percent: 0,
              status: 'timeout',
              error: '비디오 처리 타임아웃 (30분 초과)',
              timestamp: new Date().toISOString()
            };
            fs.writeFileSync(progressFilePath, JSON.stringify(timeoutProgress));
          } catch (writeError) {
            console.warn('타임아웃 진행률 파일 쓰기 실패:', writeError.message);
          }
          
          reject(new Error('비디오 처리 타임아웃 (30분 초과)'));
        }, 30 * 60 * 1000);

        command.on('end', () => clearTimeout(timeout));
        command.on('error', () => clearTimeout(timeout));

        command.run();
      });

      // 출력 파일 검증 (강화)
      if (!fs.existsSync(outputPath)) {
        throw new Error('출력 파일이 생성되지 않았습니다.');
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        fs.unlinkSync(outputPath);
        throw new Error('출력 파일이 빈 파일입니다.');
      }

      // 최소 파일 크기 검증 (1KB 미만이면 오류)
      if (stats.size < 1024) {
        fs.unlinkSync(outputPath);
        throw new Error(`출력 파일이 너무 작습니다: ${stats.size} bytes (최소 1KB 필요)`);
      }

      // 비디오 스트림 존재 여부 확인
      try {
        const outputMetadata = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(outputPath, (err, metadata) => {
            if (err) {
              reject(new Error(`출력 파일 메타데이터 확인 실패: ${err.message}`));
            } else {
              resolve(metadata);
            }
          });
        });

        const videoStream = outputMetadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          fs.unlinkSync(outputPath);
          throw new Error('출력 파일에 비디오 스트림이 없습니다.');
        }

                 console.log('=== 출력 파일 검증 완료 ===');
         console.log(`파일 크기: ${Math.round(stats.size / 1024)}KB`);
         console.log(`비디오 스트림: ${videoStream.codec_name} ${videoStream.width}x${videoStream.height}`);

         // 웹 호환성 검증
         const compatibilityCheck = await validateWebCompatibility(outputPath);
         if (!compatibilityCheck.compatible) {
           console.warn('웹 호환성 문제 발견:', compatibilityCheck.issues);
         } else {
           console.log('웹 호환성 검증 통과');
         }
      } catch (metadataError) {
        fs.unlinkSync(outputPath);
        throw new Error(`출력 파일 검증 실패: ${metadataError.message}`);
      }

      // 출력 파일 메타데이터 검증
      const outputMetadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(outputPath, (err, metadata) => {
          if (err) {
            console.warn('출력 파일 메타데이터 확인 실패:', err.message);
            resolve(null);
          } else {
            resolve(metadata);
          }
        });
      });

      console.log('=== 처리 완료 ===');
      if (outputMetadata) {
        const outVideoStream = outputMetadata.streams.find(s => s.codec_type === 'video');
        const outAudioStream = outputMetadata.streams.find(s => s.codec_type === 'audio');
        
        console.log(`출력 해상도: ${outVideoStream?.width}x${outVideoStream?.height}`);
        console.log(`출력 비트레이트: ${Math.round((outVideoStream?.bit_rate || 0) / 1000)}k`);
        console.log(`출력 FPS: ${outVideoStream?.r_frame_rate}`);
        console.log(`출력 오디오: ${outAudioStream?.codec_name || '없음'}`);
        console.log(`출력 파일 크기: ${Math.round(stats.size / 1024 / 1024)}MB`);
      }

      // 결과 정보 수집
      const result = {
        success: true,
        inputFile: path.basename(inputPath),
        outputFile: outputFileName,
        outputPath: outputPath,
        size: stats.size,
        processingTime: new Date().toISOString(),
        options: options,
        metadata: {
          input: inputMetadata,
          output: outputMetadata
        },
        workflow: '안정화된 화질 향상 (오디오 호환성 보장)'
      };
      
      resolve(result);

    } catch (error) {
      console.error('=== 비디오 처리 실패 ===');
      console.error('오류:', error.message);
      console.error('스택:', error.stack);
      reject(new Error(`비디오 처리 실패: ${error.message}`));
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

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('FFprobe 오류:', err);
        reject(new Error(`메타데이터 추출 실패: ${err.message}`));
        return;
      }

      try {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        // FPS 계산 함수 (더 안전하게)
        const calculateFPS = (rFrameRate) => {
          if (!rFrameRate) return 0;
          try {
            const parts = String(rFrameRate).split('/');
            if (parts.length === 2) {
              const numerator = parseFloat(parts[0]);
              const denominator = parseFloat(parts[1]);
              if (denominator > 0) {
                return Math.round((numerator / denominator) * 100) / 100; // 소수점 2자리까지
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
          video: videoStream ? {
            codec: videoStream.codec_name || 'unknown',
            resolution: `${videoStream.width || 0}x${videoStream.height || 0}`,
            fps: calculateFPS(videoStream.r_frame_rate),
            bitrate: String(videoStream.bit_rate || '0'),
            duration: String(videoStream.duration || '0')
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name || 'unknown',
            sampleRate: String(audioStream.sample_rate || '0'),
            channels: audioStream.channels || 0,
            bitrate: String(audioStream.bit_rate || '0')
          } : null
        };

        console.log('메타데이터 추출 성공:', {
          format: result.format.formatName,
          resolution: result.video?.resolution,
          fps: result.video?.fps,
          videoBitrate: result.video ? `${Math.round(Number(result.video.bitrate) / 1000)}k` : 'N/A',
          audioCodec: result.audio?.codec,
          hasAudio: !!result.audio
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
 * 파일 검증 (강화)
 */
const validateVideoFile = (filePath) => {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      resolve(false);
      return;
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('파일 검증 실패:', err.message);
        resolve(false);
        return;
      }

      // 비디오 스트림이 있는지 확인
      const hasVideo = metadata.streams.some(stream => stream.codec_type === 'video');
      resolve(hasVideo);
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

        // 동기화 문제 분석 (더 정확하게)
        if (videoStream && audioStream) {
          const videoDuration = analysis.video.duration;
          const audioDuration = analysis.audio.duration;
          const durationDiff = Math.abs(videoDuration - audioDuration);
          
          analysis.syncIssues.durationDiff = Math.round(durationDiff * 1000) / 1000; // ms 단위
          analysis.syncIssues.hasSyncProblem = durationDiff > 0.1;
          
          if (durationDiff > 0.1) {
            analysis.syncIssues.details.push(`오디오/비디오 길이 차이: ${durationDiff.toFixed(3)}초`);
          }

          // 시작 시간 차이 확인
          const startTimeDiff = Math.abs(analysis.video.start_time - analysis.audio.start_time);
          if (startTimeDiff > 0.05) { // 50ms 이상
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

/**
 * 출력 파일 후처리 (FFmpeg 완료 후)
 */
const postProcessOutput = async (outputPath) => {
  // MP4 파일 최적화
  const tempPath = outputPath + '.temp';
  
  return new Promise((resolve, reject) => {
    ffmpeg(outputPath)
      .outputOptions([
        '-c copy', // 재인코딩 없이 컨테이너만 최적화
        '-movflags faststart',
        '-fflags +genpts'
      ])
      .output(tempPath)
      .on('end', () => {
        // 원본 파일을 최적화된 파일로 교체
        fs.renameSync(tempPath, outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.warn('후처리 실패, 원본 유지:', err.message);
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        resolve(outputPath); // 실패해도 원본 파일 유지
      })
      .run();
  });
};

/**
 * 웹 호환성 검증 함수
 */
const validateWebCompatibility = async (filePath) => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        resolve({ compatible: false, issues: ['메타데이터 읽기 실패'] });
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const issues = [];

      if (!videoStream) {
        issues.push('비디오 스트림 없음');
      } else {
        // 프로필 확인
        if (videoStream.profile && !['Baseline', 'Main', 'baseline', 'main'].includes(videoStream.profile)) {
          issues.push(`비호환 프로필: ${videoStream.profile}`);
        }

        // 픽셀 포맷 확인
        if (videoStream.pix_fmt !== 'yuv420p') {
          issues.push(`비호환 픽셀 포맷: ${videoStream.pix_fmt}`);
        }

        // 해상도 확인
        const width = videoStream.width;
        const height = videoStream.height;
        if (width % 2 !== 0 || height % 2 !== 0) {
          issues.push(`홀수 해상도: ${width}x${height}`);
        }
      }

      resolve({
        compatible: issues.length === 0,
        issues: issues
      });
    });
  });
};

module.exports = {
  processVideo,
  extractMetadata,
  validateVideoFile,
  cleanupTempFiles,
  analyzeVideoDetails,
  postProcessOutput,
  validateWebCompatibility
};
