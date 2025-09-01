import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, Play, Settings, Zap, Sparkles, Maximize, Minimize, Palette, Camera, BarChart3, FileText, GitCompare } from 'lucide-react';

const FFmpegWebTool = () => {
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [processedVideos, setProcessedVideos] = useState({});
  const [processing, setProcessing] = useState(false);
  const [currentProcess, setCurrentProcess] = useState('');
  const [videoMetadata, setVideoMetadata] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [processingStep, setProcessingStep] = useState('idle');
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // 서버 상태 확인
  const checkServerStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (response.ok) {
        setServerStatus('connected');
      } else {
        setServerStatus('error');
      }
    } catch (error) {
      console.error('서버 연결 실패:', error);
      setServerStatus('error');
    }
  }, []);

  // 컴포넌트 마운트 시 서버 상태 확인
  React.useEffect(() => {
    checkServerStatus();
  }, [checkServerStatus]);

  // 시뮬레이션된 비디오 메타데이터 추출
  const extractMetadata = useCallback((file) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const metadata = {
        filename: file.name,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        size: (file.size / (1024 * 1024)).toFixed(2),
        bitrate: Math.round((file.size * 8) / video.duration / 1000),
        codec: '원본',
        fps: 30
      };
      setVideoMetadata(metadata);
      setAnalysisComplete(true);
    };
    
    video.src = URL.createObjectURL(file);
  }, []);

  // 파일 업로드 처리 - 메타데이터 분석과 함께
  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    console.log('📁 선택된 파일:', file);
    console.log('📁 파일 타입:', file.type);
    console.log('📁 파일 확장자:', file.name.split('.').pop());
    
    // 비디오 파일 검증 (더 유연하게)
    const isVideoFile = file && (
      file.type.startsWith('video/') || 
      ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'ogv'].includes(file.name.split('.').pop().toLowerCase())
    );
    
    if (isVideoFile) {
      console.log('✅ 비디오 파일 확인됨');
      setUploadedVideo(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setProcessedVideos({});
      setAnalysisComplete(false);
      setProcessingStep('analyzing');
      
      // 메타데이터 분석 시작
      extractMetadata(file);
      
      // 서버에 메타데이터 분석 요청
      try {
        const formData = new FormData();
        formData.append('video', file);
        
        const response = await fetch('http://localhost:3001/api/analyze-video', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('📊 서버 메타데이터 분석 완료:', result);
          
          // 분석 완료 후 자동으로 화질 개선 시작
          setTimeout(() => {
            setProcessingStep('processing');
            // 서버에서 결정된 자동 처리 타입 사용
            const autoProcessType = result.autoProcessType || 'upscale_1080p_enhanced';
            processVideoWithFFmpeg(autoProcessType, file);
          }, 1000);
        }
      } catch (error) {
        console.error('서버 메타데이터 분석 실패:', error);
        // 서버 분석 실패 시 기본 처리
        setTimeout(() => {
          setProcessingStep('processing');
          processVideoWithFFmpeg('upscale_1080p_enhanced', file);
        }, 2000);
      }
      
      // 비디오 업로드 후 원본 비디오 섹션으로 스크롤
      setTimeout(() => {
        const originalVideoSection = document.querySelector('[data-section="original-video"]');
        if (originalVideoSection) {
          originalVideoSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
    } else {
      console.error('❌ 비디오 파일이 아닙니다:', file);
      alert('비디오 파일만 업로드 가능합니다. (MP4, AVI, MOV, MKV, WebM 등)');
    }
  }, [extractMetadata]);

  // 실제 FFmpeg 비디오 처리 함수
  const processVideoWithFFmpeg = useCallback(async (processType, videoFile = null) => {
    const videoToProcess = videoFile || uploadedVideo;
    
    if (!videoToProcess) {
      alert('업로드된 비디오가 없습니다. 먼저 비디오를 업로드해주세요.');
      return;
    }

    if (videoToProcess.size === 0) {
      alert('업로드된 파일이 비어있습니다. 다시 업로드해주세요.');
      return;
    }

    setProcessing(true);
    setCurrentProcess(processType);
    setProcessingStep('processing');

    try {
      const formData = new FormData();
      formData.append('video', videoToProcess);
      formData.append('processType', processType);

      console.log(`FFmpeg 처리 시작: ${processType}`);
      console.log(`파일 크기: ${(videoToProcess.size / (1024 * 1024)).toFixed(2)}MB`);

      const response = await fetch('http://localhost:3001/api/process-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const processedUrl = `http://localhost:3001${result.outputUrl}`;
        
        const processedResolution = result.metadata 
          ? `${result.metadata.width}x${result.metadata.height}`
          : `${videoMetadata.width}x${videoMetadata.height}`;
        
                    setProcessedVideos(prev => ({
              ...prev,
              [processType]: {
                url: processedUrl,
                name: '화질 개선 + 해상도 상승',
                description: '노이즈 제거, 샤프닝, 색상 보정으로 전체적인 화질을 개선 & 해상도를 향상',
                stats: {
                  resolution: processedResolution,
                  sizeChange: `${result.fileSize}MB`,
                  quality: '실제 처리됨'
                },
                fileSize: result.fileSize,
                metadata: result.metadata,
                originalMetadata: result.originalMetadata,
                comparison: result.comparison
              }
            }));

        console.log(`FFmpeg 처리 완료: ${processType}`);
        setProcessingStep('comparing');
      } else {
        throw new Error(result.error || '처리 실패');
      }

    } catch (error) {
      console.error('FFmpeg 처리 오류:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('서버 오류: 500')) {
        errorMessage = '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message.includes('서버 오류: 400')) {
        errorMessage = '잘못된 요청입니다. 파일을 다시 업로드해주세요.';
      } else if (error.message.includes('타임아웃')) {
        errorMessage = '처리 시간이 초과되었습니다. 더 낮은 해상도로 시도해주세요.';
      } else if (error.message.includes('메모리')) {
        errorMessage = '메모리 부족으로 처리할 수 없습니다. 더 낮은 해상도로 시도해주세요.';
      }
      
      alert(`비디오 처리 중 오류가 발생했습니다:\n${errorMessage}`);
    } finally {
      setProcessing(false);
      setCurrentProcess('');
    }
  }, [uploadedVideo, videoMetadata]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-900/20 to-black text-white font-sans">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-md border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-2xl shadow-lg">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-emerald-400 bg-clip-text text-transparent">
                FFmpeg 체험관
              </h1>
              <p className="text-purple-200 text-lg font-medium">무료로 비디오 화질을 극대화하세요!</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* 서버 상태 표시 */}
        <div className="mb-6">
          {serverStatus === 'checking' && (
            <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-400/40">
              <p className="text-blue-200 font-medium">🔍 FFmpeg 서버 연결 확인 중...</p>
            </div>
          )}
          {serverStatus === 'connected' && (
            <div className="bg-emerald-500/20 rounded-xl p-4 border border-emerald-400/40">
              <p className="text-emerald-200 font-medium">✅ FFmpeg 서버 연결됨 - 실제 처리가 가능합니다!</p>
            </div>
          )}
          {serverStatus === 'error' && (
            <div className="bg-red-500/20 rounded-xl p-4 border border-red-400/40">
              <p className="text-red-200 font-medium">❌ FFmpeg 서버 연결 실패</p>
              <p className="text-red-300 text-sm mt-2">
                서버를 시작하려면: <code className="bg-red-900/50 px-2 py-1 rounded">cd server && npm install && npm start</code>
              </p>
            </div>
          )}
        </div>

        {/* 처리 단계 표시 */}
        {uploadedVideo && (
          <div className="mb-6 bg-black/40 backdrop-blur-md rounded-3xl border border-purple-500/30 p-4 sm:p-6 shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center text-white">
              <BarChart3 className="mr-2 sm:mr-4 text-purple-400 w-6 h-6 sm:w-8 sm:h-8" />
              📊 처리 단계
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* 1단계: 메타데이터 분석 */}
              <div className={`rounded-2xl p-4 border-2 transition-all duration-500 ${
                processingStep === 'analyzing' || analysisComplete 
                  ? 'bg-emerald-500/20 border-emerald-400/60' 
                  : 'bg-gray-500/20 border-gray-400/40'
              }`}>
                <div className="flex items-center mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    analysisComplete ? 'bg-emerald-500' : 'bg-gray-500'
                  }`}>
                    {analysisComplete ? '✓' : '1'}
                  </div>
                  <h3 className="font-bold text-lg">메타데이터 분석</h3>
                </div>
                <p className="text-sm text-gray-300">
                  {analysisComplete ? '✅ 완료' : '🔍 분석 중...'}
                </p>
              </div>

              {/* 2단계: 화질 개선 + 해상도 상승 */}
              <div className={`rounded-2xl p-4 border-2 transition-all duration-500 ${
                processingStep === 'processing' 
                  ? 'bg-purple-500/20 border-purple-400/60' 
                  : processingStep === 'comparing'
                  ? 'bg-emerald-500/20 border-emerald-400/60'
                  : 'bg-gray-500/20 border-gray-400/40'
              }`}>
                <div className="flex items-center mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    processingStep === 'comparing' ? 'bg-emerald-500' : 
                    processingStep === 'processing' ? 'bg-purple-500' : 'bg-gray-500'
                  }`}>
                    {processingStep === 'comparing' ? '✓' : 
                     processingStep === 'processing' ? '⚡' : '2'}
                  </div>
                  <h3 className="font-bold text-lg">화질 개선</h3>
                </div>
                <p className="text-sm text-gray-300">
                  {processingStep === 'comparing' ? '✅ 완료' : 
                   processingStep === 'processing' ? '⚡ 처리 중...' : '대기 중'}
                </p>
              </div>

              {/* 3단계: 메타데이터 비교 */}
              <div className={`rounded-2xl p-4 border-2 transition-all duration-500 ${
                processingStep === 'comparing' 
                  ? 'bg-blue-500/20 border-blue-400/60' 
                  : 'bg-gray-500/20 border-gray-400/40'
              }`}>
                <div className="flex items-center mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    processingStep === 'comparing' ? 'bg-blue-500' : 'bg-gray-500'
                  }`}>
                    {processingStep === 'comparing' ? '⚡' : '3'}
                  </div>
                  <h3 className="font-bold text-lg">메타데이터 비교</h3>
                </div>
                <p className="text-sm text-gray-300">
                  {processingStep === 'comparing' ? '⚡ 비교 중...' : '대기 중'}
                </p>
              </div>

              {/* 4단계: 다운로드 준비 */}
              <div className={`rounded-2xl p-4 border-2 transition-all duration-500 ${
                Object.keys(processedVideos).length > 0 
                  ? 'bg-purple-500/20 border-purple-400/60' 
                  : 'bg-gray-500/20 border-gray-400/40'
              }`}>
                <div className="flex items-center mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    Object.keys(processedVideos).length > 0 ? 'bg-purple-500' : 'bg-gray-500'
                  }`}>
                    {Object.keys(processedVideos).length > 0 ? '✓' : '4'}
                  </div>
                  <h3 className="font-bold text-lg">다운로드 준비</h3>
                </div>
                <p className="text-sm text-gray-300">
                  {Object.keys(processedVideos).length > 0 ? '✅ 준비 완료' : '대기 중'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 파일 업로드 섹션 */}
        <div className="bg-black/40 backdrop-blur-md rounded-3xl border border-purple-500/30 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center text-white">
            <Upload className="mr-2 sm:mr-4 text-purple-400 w-6 h-6 sm:w-8 sm:h-8" />
            비디오 업로드
          </h2>
          
          <div 
            className="border-2 border-dashed border-purple-400/60 rounded-2xl p-6 sm:p-8 lg:p-12 text-center hover:border-purple-400 hover:bg-purple-500/5 transition-all duration-300 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('border-purple-400', 'bg-purple-500/10');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-500/10');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-purple-400', 'bg-purple-500/10');
              const files = e.dataTransfer.files;
              if (files.length > 0) {
                const file = files[0];
                console.log('📁 드래그 앤 드롭 파일:', file);
                // 파일 업로드 처리
                const event = { target: { files: [file] } };
                handleFileUpload(event);
              }
            }}
          >
                          <Upload className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 text-purple-400" />
              <p className="text-lg sm:text-xl mb-2 sm:mb-3 font-medium text-white">비디오 파일을 업로드하세요</p>
              <p className="text-purple-200 text-sm sm:text-base">MP4, AVI, MOV, MKV, WebM 지원</p>
              <p className="text-purple-300 text-xs sm:text-sm mt-2">클릭하거나 파일을 드래그해서 업로드하세요</p>
              <p className="text-purple-300 text-xs sm:text-sm mt-1">업로드 시 자동으로 메타데이터 분석 → 화질 개선 → 비교가 진행됩니다</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* 원본 비디오 미리보기 */}
        {videoUrl && (
          <div className="bg-black/40 backdrop-blur-md rounded-3xl border border-purple-500/30 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 shadow-xl" data-section="original-video">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center text-white">
              <FileText className="mr-2 sm:mr-4 text-purple-400 w-6 h-6 sm:w-8 sm:h-8" />
              📊 원본 비디오 메타데이터
            </h2>
            
            <div className="bg-black/40 rounded-2xl p-4 sm:p-6 border border-purple-500/30 mb-4 sm:mb-6">
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <div>
                  <h3 className="font-bold text-lg sm:text-xl text-white">📹 원본 영상</h3>
                  <p className="text-sm sm:text-base text-gray-200 font-medium">업로드된 원본 비디오 파일</p>
                </div>
              </div>

              {/* 원본 비디오 통계 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm mb-3 sm:mb-4">
                <div className="bg-purple-500/20 rounded-xl p-2 sm:p-3 text-center border border-purple-400/30">
                  <div className="text-purple-200 font-medium">해상도</div>
                  <div className="font-semibold text-white">{videoMetadata?.width}x{videoMetadata?.height}</div>
                </div>
                <div className="bg-purple-500/20 rounded-xl p-2 sm:p-3 text-center border border-purple-400/30">
                  <div className="text-purple-200 font-medium">파일 크기</div>
                  <div className="font-semibold text-white">{videoMetadata?.size}MB</div>
                </div>
                <div className="bg-purple-500/20 rounded-xl p-2 sm:p-3 text-center border border-purple-400/30">
                  <div className="text-purple-200 font-medium">비트레이트</div>
                  <div className="font-semibold text-white">{videoMetadata?.bitrate}kbps</div>
                </div>
                <div className="bg-purple-500/20 rounded-xl p-2 sm:p-3 text-center border border-purple-400/30">
                  <div className="text-purple-200 font-medium">길이</div>
                  <div className="font-semibold text-white">{videoMetadata?.duration ? videoMetadata.duration.toFixed(1) + '초' : 'N/A'}</div>
                </div>
              </div>

              {/* 원본 상세 메타데이터 */}
              <div className="bg-black/20 rounded-xl p-3 sm:p-4 border border-purple-400/20 mb-3 sm:mb-4">
                <h4 className="font-semibold text-purple-300 mb-2 sm:mb-3 text-xs sm:text-sm">📊 상세 메타데이터</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">파일명:</span>
                    <span className="text-white ml-2 font-medium">
                      {videoMetadata?.filename || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">코덱:</span>
                    <span className="text-white ml-2 font-medium">{videoMetadata?.codec || '원본'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">FPS:</span>
                    <span className="text-white ml-2 font-medium">{videoMetadata?.fps || '30.0'}</span>
                  </div>
                </div>
              </div>

              {/* 원본 비디오 플레이어 */}
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full rounded-xl shadow-lg"
                style={{ maxHeight: '200px' }}
              />
            </div>
          </div>
        )}

        {/* 처리 중 표시 */}
        {processing && (
          <div className="bg-black/40 backdrop-blur-md rounded-3xl border border-purple-500/30 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center text-white">
              <Sparkles className="mr-2 sm:mr-4 text-purple-400 w-6 h-6 sm:w-8 sm:h-8" />
              ⚡ 화질 개선 + 해상도 상승 중
            </h2>
            
            <div className="bg-purple-500/20 rounded-2xl p-4 sm:p-6 border border-purple-400/40">
              <div className="flex items-center justify-center space-x-2 sm:space-x-4 mb-4">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-3 border-purple-400 border-t-transparent"></div>
                <span className="font-semibold text-sm sm:text-lg text-white">
                  화질 개선 + 해상도 상승 처리 중... (실제 FFmpeg 실행)
                </span>
              </div>
              <div className="mt-3 sm:mt-4 bg-purple-900/30 rounded-xl h-2 sm:h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 animate-pulse"></div>
              </div>
              <p className="text-center mt-3 sm:mt-4 text-purple-200 text-xs sm:text-sm">
                🎬 실제 비디오 처리가 진행 중입니다. 시간이 걸릴 수 있습니다...
              </p>
            </div>
          </div>
        )}

        {/* 처리된 결과들 - 비교 및 다운로드 */}
        {Object.keys(processedVideos).length > 0 && (
          <div className="bg-black/40 backdrop-blur-md rounded-3xl border border-purple-500/30 p-4 sm:p-6 lg:p-8 shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 flex items-center text-white">
              <GitCompare className="mr-2 sm:mr-4 text-purple-400 w-6 h-6 sm:w-8 sm:h-8" />
              📊 원본 vs 개선된 비디오 비교
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
              {/* 원본 비디오 (왼쪽) */}
              <div className="bg-black/40 rounded-2xl p-4 sm:p-6 border border-purple-500/30 shadow-lg">
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div>
                    <h3 className="font-bold text-lg sm:text-xl text-white">📹 원본 영상</h3>
                    <p className="text-sm sm:text-base text-gray-200 font-medium">업로드된 원본 비디오</p>
                  </div>
                </div>

                {/* 원본 비디오 통계 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm mb-3 sm:mb-4">
                  <div className="bg-purple-500/20 rounded-xl p-2 sm:p-3 text-center border border-purple-400/30">
                    <div className="text-purple-200 font-medium">해상도</div>
                    <div className="font-semibold text-white">{videoMetadata?.width}x{videoMetadata?.height}</div>
                  </div>
                  <div className="bg-purple-500/20 rounded-xl p-2 sm:p-3 text-center border border-purple-400/30">
                    <div className="text-purple-200 font-medium">파일 크기</div>
                    <div className="font-semibold text-white">{videoMetadata?.size}MB</div>
                  </div>
                  <div className="bg-purple-500/20 rounded-xl p-2 sm:p-3 text-center border border-purple-400/30">
                    <div className="text-purple-200 font-medium">비트레이트</div>
                    <div className="font-semibold text-white">{videoMetadata?.bitrate}kbps</div>
                  </div>
                  <div className="bg-purple-500/20 rounded-xl p-2 sm:p-3 text-center border border-purple-400/30">
                    <div className="text-purple-200 font-medium">길이</div>
                    <div className="font-semibold text-white">{videoMetadata?.duration ? videoMetadata.duration.toFixed(1) + '초' : 'N/A'}</div>
                  </div>
                </div>

                {/* 원본 상세 메타데이터 */}
                <div className="bg-black/20 rounded-xl p-3 sm:p-4 border border-purple-400/20 mb-3 sm:mb-4">
                  <h4 className="font-semibold text-purple-300 mb-2 sm:mb-3 text-xs sm:text-sm">📊 상세 메타데이터</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                    <div>
                      <span className="text-gray-400">길이:</span>
                      <span className="text-white ml-2 font-medium">
                        {videoMetadata?.duration ? videoMetadata.duration.toFixed(1) + '초' : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">비트레이트:</span>
                      <span className="text-white ml-2 font-medium">
                        {videoMetadata?.bitrate ? videoMetadata.bitrate + 'kbps' : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">원본 대비:</span>
                      <span className="text-white ml-2 font-medium">100%</span>
                    </div>
                    <div>
                      <span className="text-gray-400">코덱:</span>
                      <span className="text-white ml-2 font-medium">{videoMetadata?.codec || '원본'}</span>
                    </div>
                  </div>
                </div>

                {/* 원본 비디오 플레이어 */}
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-xl shadow-lg"
                  style={{ maxHeight: '200px' }}
                />
              </div>

              {/* 개선된 비디오들 (오른쪽) */}
              {Object.entries(processedVideos).map(([type, result]) => (
                <div key={type} className="bg-black/40 rounded-2xl p-4 sm:p-6 border border-purple-500/30 shadow-lg">
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div>
                      <h3 className="font-bold text-lg sm:text-xl text-white">{result.name}</h3>
                      <p className="text-sm sm:text-base text-gray-200 font-medium">{result.description}</p>
                    </div>
                  </div>

                  {/* 처리 통계 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm mb-3 sm:mb-4">
                    <div className="bg-emerald-500/20 rounded-xl p-2 sm:p-3 text-center border border-emerald-400/30">
                      <div className="text-emerald-200 font-medium">해상도</div>
                      <div className="font-semibold text-white">{result.stats.resolution}</div>
                    </div>
                    <div className="bg-emerald-500/20 rounded-xl p-2 sm:p-3 text-center border border-emerald-400/30">
                      <div className="text-emerald-200 font-medium">파일 크기</div>
                      <div className="font-semibold text-white">{result.fileSize}MB</div>
                    </div>
                    <div className="bg-emerald-500/20 rounded-xl p-2 sm:p-3 text-center border border-emerald-400/30">
                      <div className="text-emerald-200 font-medium">코덱</div>
                      <div className="font-semibold text-white">{result.metadata?.codec || 'h264'}</div>
                    </div>
                    <div className="bg-emerald-500/20 rounded-xl p-2 sm:p-3 text-center border border-emerald-400/30">
                      <div className="text-emerald-200 font-medium">FPS</div>
                      <div className="font-semibold text-white">{result.metadata?.fps ? result.metadata.fps.toFixed(1) : '24.0'}</div>
                    </div>
                  </div>

                  {/* 상세 메타데이터 */}
                  {result.metadata && (
                    <div className="bg-black/20 rounded-xl p-3 sm:p-4 border border-emerald-400/20 mb-3 sm:mb-4">
                      <h4 className="font-semibold text-emerald-300 mb-2 sm:mb-3 text-xs sm:text-sm">📊 상세 메타데이터</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                        <div>
                          <span className="text-gray-400">길이:</span>
                          <span className="text-white ml-2 font-medium">
                            {result.metadata.duration ? result.metadata.duration.toFixed(1) + '초' : '8.0초'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">비트레이트:</span>
                          <span className="text-white ml-2 font-medium">
                            {result.metadata.bitrate ? Math.round(result.metadata.bitrate / 1000) + 'kbps' : '161701kbps'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">원본 대비:</span>
                          <span className="text-white ml-2 font-medium">
                            {videoMetadata && result.metadata ? 
                              `${Math.round((result.metadata.width / videoMetadata.width) * 100)}%` : '300%'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">코덱:</span>
                          <span className="text-white ml-2 font-medium">{result.metadata?.codec || 'h264'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 미리보기 비디오 */}
                  <video
                    src={result.url}
                    controls
                    className="w-full rounded-xl shadow-lg"
                    style={{ maxHeight: '200px' }}
                  />

                  {/* 비교 정보 */}
                  {result.comparison && (
                    <div className="bg-emerald-500/10 rounded-xl p-3 sm:p-4 border border-emerald-500/30 mt-3 sm:mt-4">
                      <h4 className="font-semibold text-emerald-300 mb-2 sm:mb-3 text-xs sm:text-sm">📈 처리 결과 비교</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                        <div>
                          <span className="text-gray-400">해상도 변화:</span>
                          <span className="text-white ml-2 font-medium">{result.comparison.resolutionChange}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">파일 크기:</span>
                          <span className="text-white ml-2 font-medium">{result.comparison.sizeChange}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-gray-400">품질 개선:</span>
                          <span className="text-white ml-2 font-medium">{result.comparison.qualityImprovement}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 다운로드 버튼들 */}
                  <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-3 mt-3 sm:mt-4">
                    <button
                      onClick={() => window.open(result.url, '_blank')}
                      className="bg-purple-500 hover:bg-purple-600 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-white shadow-md"
                    >
                      새 탭에서 보기
                    </button>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = result.url;
                        link.download = `${result.name}.mp4`;
                        link.click();
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors text-white shadow-md"
                    >
                      📥 다운로드
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 서버 연결 안됨 시 안내 */}
        {uploadedVideo && serverStatus !== 'connected' && (
          <div className="bg-black/40 backdrop-blur-md rounded-3xl border border-purple-500/30 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center text-white">
              <Settings className="mr-2 sm:mr-4 text-red-400 w-6 h-6 sm:w-8 sm:h-8" />
              ⚠️ 서버 연결 필요
            </h2>
            <div className="bg-red-500/10 rounded-2xl p-4 sm:p-6 border border-red-500/30">
              <p className="text-red-200 font-medium mb-3 sm:mb-4 text-sm sm:text-base">
                실제 FFmpeg 처리를 위해서는 백엔드 서버가 필요합니다.
              </p>
              <div className="bg-black/50 rounded-xl p-3 sm:p-4 font-mono text-xs sm:text-sm text-green-400">
                <p>다음 명령어를 실행하세요:</p>
                <p className="mt-2">1. cd server</p>
                <p>2. npm install</p>
                <p>3. npm start</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 sm:mt-12 text-gray-300 font-medium">
          <p className="text-base sm:text-lg">🔥 FFmpeg 체험관으로 무료 비디오 마스터 되기!</p>
        </div>
      </div>
    </div>
  );
};

export default FFmpegWebTool;

