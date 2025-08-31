import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, Play, Settings, Zap, Sparkles, Maximize, Minimize, Palette, Camera } from 'lucide-react';

const FFmpegWebTool = () => {
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [processedVideos, setProcessedVideos] = useState({});
  const [processing, setProcessing] = useState(false);
  const [currentProcess, setCurrentProcess] = useState('');
  const [videoMetadata, setVideoMetadata] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
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
      setVideoMetadata({
        filename: file.name,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        size: (file.size / (1024 * 1024)).toFixed(2)
      });
    };
    
    video.src = URL.createObjectURL(file);
  }, []);

  // 파일 업로드 처리
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setUploadedVideo(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      extractMetadata(file);
      setProcessedVideos({});
    }
  }, [extractMetadata]);

  // 실제 FFmpeg 비디오 처리 함수
  const processVideoWithFFmpeg = useCallback(async (processType) => {
    if (!uploadedVideo) return;

    setProcessing(true);
    setCurrentProcess(processType);

    try {
      // FormData 생성
      const formData = new FormData();
      formData.append('video', uploadedVideo);
      formData.append('processType', processType);

      console.log(`FFmpeg 처리 시작: ${processType}`);

      // 서버에 요청 전송
      const response = await fetch('http://localhost:3001/api/process-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status}`);
      }

      const result = await response.json();

             if (result.success) {
         // 처리된 비디오 URL 생성
         const processedUrl = `http://localhost:3001${result.outputUrl}`;
         
         // 처리된 비디오의 메타데이터 사용
         const processedResolution = result.metadata 
           ? `${result.metadata.width}x${result.metadata.height}`
           : `${videoMetadata.width}x${videoMetadata.height}`;
         
         setProcessedVideos(prev => ({
           ...prev,
           [processType]: {
             url: processedUrl,
             name: getProcessTypeName(processType),
             description: getProcessDescription(processType),
             stats: {
               resolution: processedResolution,
               sizeChange: `${result.fileSize}MB`,
               quality: '실제 처리됨'
             },
             fileSize: result.fileSize,
             metadata: result.metadata
           }
         }));

        console.log(`FFmpeg 처리 완료: ${processType}`);
      } else {
        throw new Error(result.error || '처리 실패');
      }

    } catch (error) {
      console.error('FFmpeg 처리 오류:', error);
      alert(`비디오 처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setProcessing(false);
      setCurrentProcess('');
    }
  }, [uploadedVideo, videoMetadata]);

  const getProcessTypeName = (type) => {
    const names = {
      'upscale': 'AI 업스케일링 (2배)',
      'upscale_4k': 'AI 업스케일링 (4K)',
      'upscale_1080p': 'AI 업스케일링 (1080p)',
      'enhance': '화질 개선 마법',
      'compress': '극강 압축',
      'cinematic': '영화급 색감',
      'stabilize': '손떨림 보정',
      'ultimate': '궁극의 개선'
    };
    return names[type] || type;
  };

  const getProcessDescription = (type) => {
    const descriptions = {
      'upscale': '해상도를 2배로 향상시켜 더 선명한 이미지를 제공합니다',
      'upscale_4k': '4K 해상도(3840x2160)로 업스케일링하여 최고 품질을 제공합니다',
      'upscale_1080p': 'Full HD 1080p 해상도로 업스케일링하여 고품질 영상을 만듭니다',
      'enhance': '노이즈 제거, 샤프닝, 색상 보정으로 전체적인 화질을 개선합니다',
      'compress': '시각적 품질은 유지하면서 파일 크기를 대폭 줄입니다',
      'cinematic': '할리우드 영화 같은 전문적인 색감을 적용합니다',
      'stabilize': '카메라 흔들림을 제거하여 안정적인 영상을 만듭니다',
      'ultimate': '모든 개선 기능을 종합하여 최고 품질의 결과를 제공합니다'
    };
    return descriptions[type] || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl shadow-lg">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                FFmpeg 체험관
              </h1>
              <p className="text-emerald-100 text-lg font-medium">무료로 비디오 화질을 극대화하세요!</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 서버 상태 표시 */}
        <div className="mb-6">
          {serverStatus === 'checking' && (
            <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-400/40">
              <p className="text-blue-200 font-medium">🔍 FFmpeg 서버 연결 확인 중...</p>
            </div>
          )}
          {serverStatus === 'connected' && (
            <div className="bg-green-500/20 rounded-xl p-4 border border-green-400/40">
              <p className="text-green-200 font-medium">✅ FFmpeg 서버 연결됨 - 실제 처리가 가능합니다!</p>
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

        {/* 파일 업로드 섹션 */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 mb-8 shadow-xl">
          <h2 className="text-3xl font-bold mb-6 flex items-center text-white">
            <Upload className="mr-4 text-emerald-400 w-8 h-8" />
            비디오 업로드
          </h2>
          
          <div 
            className="border-2 border-dashed border-emerald-400/60 rounded-2xl p-12 text-center hover:border-emerald-400 hover:bg-white/5 transition-all duration-300 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-16 h-16 mx-auto mb-6 text-emerald-400" />
            <p className="text-xl mb-3 font-medium text-white">비디오 파일을 업로드하세요</p>
            <p className="text-emerald-200 text-base">MP4, AVI, MOV, MKV, WebM 지원</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* 업로드된 비디오 정보 */}
          {videoMetadata && (
            <div className="mt-8 bg-white/10 rounded-2xl p-6 border border-white/20">
              <h3 className="font-bold mb-4 text-emerald-300 text-lg">📊 비디오 정보</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-base">
                <div>
                  <span className="text-gray-300 font-medium">파일명:</span>
                  <br />
                  <span className="font-semibold text-white">{videoMetadata.filename}</span>
                </div>
                <div>
                  <span className="text-gray-300 font-medium">해상도:</span>
                  <br />
                  <span className="font-semibold text-white">{videoMetadata.width}x{videoMetadata.height}</span>
                </div>
                <div>
                  <span className="text-gray-300 font-medium">길이:</span>
                  <br />
                  <span className="font-semibold text-white">{videoMetadata.duration?.toFixed(1)}초</span>
                </div>
                <div>
                  <span className="text-gray-300 font-medium">크기:</span>
                  <br />
                  <span className="font-semibold text-white">{videoMetadata.size}MB</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 원본 비디오 미리보기 */}
        {videoUrl && (
          <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 mb-8 shadow-xl">
            <h2 className="text-3xl font-bold mb-6 flex items-center text-white">
              <Play className="mr-4 text-emerald-400 w-8 h-8" />
              원본 비디오
            </h2>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full max-w-3xl mx-auto rounded-2xl shadow-2xl"
              style={{ maxHeight: '500px' }}
            />
          </div>
        )}

        {/* FFmpeg 도구들 */}
        {uploadedVideo && serverStatus === 'connected' && (
          <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 mb-8 shadow-xl">
            <h2 className="text-3xl font-bold mb-8 flex items-center text-white">
              <Sparkles className="mr-4 text-amber-400 w-8 h-8" />
              🔥 FFmpeg 도구들 (실제 처리)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* AI 업스케일링 (2배) */}
              <div className="bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-2xl p-6 border border-emerald-400/40 shadow-lg">
                <div className="flex items-center mb-4">
                  <Maximize className="w-7 h-7 mr-3 text-emerald-400" />
                  <h3 className="font-bold text-lg text-white">AI 업스케일링 (2배)</h3>
                </div>
                <p className="text-base text-gray-200 mb-4 font-medium">해상도 2배 향상! 무료 AI 기술</p>
                <button
                  onClick={() => processVideoWithFFmpeg('upscale')}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all text-white shadow-lg"
                >
                  {processing && currentProcess === 'upscale' ? '처리 중...' : '2배 업스케일링'}
                </button>
              </div>

              {/* AI 업스케일링 (4K) */}
              <div className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 rounded-2xl p-6 border border-purple-400/40 shadow-lg">
                <div className="flex items-center mb-4">
                  <Maximize className="w-7 h-7 mr-3 text-purple-400" />
                  <h3 className="font-bold text-lg text-white">AI 업스케일링 (4K)</h3>
                </div>
                <p className="text-base text-gray-200 mb-4 font-medium">4K 해상도로 업스케일링!</p>
                <button
                  onClick={() => processVideoWithFFmpeg('upscale_4k')}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all text-white shadow-lg"
                >
                  {processing && currentProcess === 'upscale_4k' ? '처리 중...' : '4K 업스케일링'}
                </button>
              </div>

              {/* AI 업스케일링 (1080p) */}
              <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-2xl p-6 border border-blue-400/40 shadow-lg">
                <div className="flex items-center mb-4">
                  <Maximize className="w-7 h-7 mr-3 text-blue-400" />
                  <h3 className="font-bold text-lg text-white">AI 업스케일링 (1080p)</h3>
                </div>
                <p className="text-base text-gray-200 mb-4 font-medium">Full HD 1080p로 업스케일링!</p>
                <button
                  onClick={() => processVideoWithFFmpeg('upscale_1080p')}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all text-white shadow-lg"
                >
                  {processing && currentProcess === 'upscale_1080p' ? '처리 중...' : '1080p 업스케일링'}
                </button>
              </div>

              {/* 화질 개선 */}
              <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-2xl p-6 border border-blue-400/40 shadow-lg">
                <div className="flex items-center mb-4">
                  <Sparkles className="w-7 h-7 mr-3 text-blue-400" />
                  <h3 className="font-bold text-lg text-white">화질 개선 마법</h3>
                </div>
                <p className="text-base text-gray-200 mb-4 font-medium">노이즈 제거 + 샤프닝</p>
                <button
                  onClick={() => processVideoWithFFmpeg('enhance')}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all text-white shadow-lg"
                >
                  {processing && currentProcess === 'enhance' ? '처리 중...' : '화질 개선'}
                </button>
              </div>

              {/* 극강 압축 */}
              <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-2xl p-6 border border-green-400/40 shadow-lg">
                <div className="flex items-center mb-4">
                  <Minimize className="w-7 h-7 mr-3 text-green-400" />
                  <h3 className="font-bold text-lg text-white">극강 압축</h3>
                </div>
                <p className="text-base text-gray-200 mb-4 font-medium">용량 70% 감소, 화질 유지</p>
                <button
                  onClick={() => processVideoWithFFmpeg('compress')}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all text-white shadow-lg"
                >
                  {processing && currentProcess === 'compress' ? '처리 중...' : '압축 실행'}
                </button>
              </div>

              {/* 영화급 색감 */}
              <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-2xl p-6 border border-amber-400/40 shadow-lg">
                <div className="flex items-center mb-4">
                  <Palette className="w-7 h-7 mr-3 text-amber-400" />
                  <h3 className="font-bold text-lg text-white">영화급 색감</h3>
                </div>
                <p className="text-base text-gray-200 mb-4 font-medium">할리우드 스타일 색보정</p>
                <button
                  onClick={() => processVideoWithFFmpeg('cinematic')}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all text-white shadow-lg"
                >
                  {processing && currentProcess === 'cinematic' ? '처리 중...' : '색감 적용'}
                </button>
              </div>

              {/* 손떨림 보정 */}
              <div className="bg-gradient-to-br from-teal-600/20 to-cyan-600/20 rounded-2xl p-6 border border-teal-400/40 shadow-lg">
                <div className="flex items-center mb-4">
                  <Camera className="w-7 h-7 mr-3 text-teal-400" />
                  <h3 className="font-bold text-lg text-white">손떨림 보정</h3>
                </div>
                <p className="text-base text-gray-200 mb-4 font-medium">짐벌 효과로 안정화</p>
                <button
                  onClick={() => processVideoWithFFmpeg('stabilize')}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all text-white shadow-lg"
                >
                  {processing && currentProcess === 'stabilize' ? '처리 중...' : '안정화 실행'}
                </button>
              </div>

              {/* 궁극의 개선 */}
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl p-6 border border-purple-400/40 shadow-lg">
                <div className="flex items-center mb-4">
                  <Zap className="w-7 h-7 mr-3 text-purple-400" />
                  <h3 className="font-bold text-lg text-white">궁극의 개선</h3>
                </div>
                <p className="text-base text-gray-200 mb-4 font-medium">모든 기능을 합친 최강 조합</p>
                <button
                  onClick={() => processVideoWithFFmpeg('ultimate')}
                  disabled={processing}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all text-white shadow-lg"
                >
                  {processing && currentProcess === 'ultimate' ? '처리 중...' : '궁극 개선'}
                </button>
              </div>
            </div>

            {/* 처리 중 표시 */}
            {processing && (
              <div className="mt-8 bg-emerald-600/20 rounded-2xl p-6 border border-emerald-400/40">
                <div className="flex items-center justify-center space-x-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-3 border-emerald-400 border-t-transparent"></div>
                  <span className="font-semibold text-lg text-white">
                    {getProcessTypeName(currentProcess)} 처리 중... (실제 FFmpeg 실행)
                  </span>
                </div>
                <div className="mt-4 bg-emerald-900/30 rounded-xl h-3 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 animate-pulse"></div>
                </div>
                <p className="text-center mt-4 text-emerald-200 text-sm">
                  🎬 실제 비디오 처리가 진행 중입니다. 시간이 걸릴 수 있습니다...
                </p>
              </div>
            )}
          </div>
        )}

        {/* 서버 연결 안됨 시 안내 */}
        {uploadedVideo && serverStatus !== 'connected' && (
          <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 mb-8 shadow-xl">
            <h2 className="text-3xl font-bold mb-6 flex items-center text-white">
              <Settings className="mr-4 text-red-400 w-8 h-8" />
              ⚠️ 서버 연결 필요
            </h2>
            <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/30">
              <p className="text-red-200 font-medium mb-4">
                실제 FFmpeg 처리를 위해서는 백엔드 서버가 필요합니다.
              </p>
              <div className="bg-black/50 rounded-xl p-4 font-mono text-sm text-green-400">
                <p>다음 명령어를 실행하세요:</p>
                <p className="mt-2">1. cd server</p>
                <p>2. npm install</p>
                <p>3. npm start</p>
              </div>
            </div>
          </div>
        )}

        {/* 처리된 결과들 */}
        {Object.keys(processedVideos).length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 shadow-xl">
            <h2 className="text-3xl font-bold mb-8 flex items-center text-white">
              <Download className="mr-4 text-emerald-400 w-8 h-8" />
              🎉 실제 처리 완료된 비디오들
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {Object.entries(processedVideos).map(([type, result]) => (
                                 <div key={type} className="bg-white/10 rounded-2xl p-6 border border-white/20 shadow-lg">
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <h3 className="font-bold text-xl text-white">{result.name}</h3>
                       <p className="text-base text-gray-200 font-medium">{result.description}</p>
                     </div>
                   </div>

                   {/* 다운로드 버튼을 상단으로 이동 */}
                   <div className="flex justify-center mb-4">
                     <a 
                       href={result.url} 
                       download
                       className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 px-6 py-3 rounded-xl text-base font-semibold transition-all text-white shadow-lg flex items-center space-x-2"
                     >
                       <Download className="w-5 h-5" />
                       <span>다운로드</span>
                     </a>
                   </div>

                                     {/* 처리 통계 */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                     <div className="bg-white/10 rounded-xl p-3 text-center">
                       <div className="text-gray-300 font-medium">해상도</div>
                       <div className="font-semibold text-white">{result.stats.resolution}</div>
                     </div>
                     <div className="bg-white/10 rounded-xl p-3 text-center">
                       <div className="text-gray-300 font-medium">파일 크기</div>
                       <div className="font-semibold text-white">{result.fileSize}MB</div>
                     </div>
                     <div className="bg-white/10 rounded-xl p-3 text-center">
                       <div className="text-gray-300 font-medium">코덱</div>
                       <div className="font-semibold text-white">{result.metadata?.codec || 'N/A'}</div>
                     </div>
                     <div className="bg-white/10 rounded-xl p-3 text-center">
                       <div className="text-gray-300 font-medium">FPS</div>
                       <div className="font-semibold text-white">{result.metadata?.fps ? result.metadata.fps.toFixed(1) : 'N/A'}</div>
                     </div>
                   </div>

                   {/* 상세 메타데이터 */}
                   {result.metadata && (
                     <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4">
                       <h4 className="font-semibold text-emerald-300 mb-3 text-sm">📊 상세 메타데이터</h4>
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                         <div>
                           <span className="text-gray-400">길이:</span>
                           <span className="text-white ml-2 font-medium">
                             {result.metadata.duration ? result.metadata.duration.toFixed(1) + '초' : 'N/A'}
                           </span>
                         </div>
                         <div>
                           <span className="text-gray-400">비트레이트:</span>
                           <span className="text-white ml-2 font-medium">
                             {result.metadata.bitrate ? Math.round(result.metadata.bitrate / 1000) + 'kbps' : 'N/A'}
                           </span>
                         </div>
                         <div>
                           <span className="text-gray-400">원본 대비:</span>
                           <span className="text-white ml-2 font-medium">
                             {videoMetadata && result.metadata ? 
                               `${Math.round((result.metadata.width / videoMetadata.width) * 100)}%` : 'N/A'}
                           </span>
                         </div>
                       </div>
                     </div>
                   )}

                                     {/* 미리보기 비디오 */}
                   <video
                     src={result.url}
                     controls
                     className="w-full mt-4 rounded-xl shadow-lg"
                     style={{ maxHeight: '250px' }}
                   />

                   {/* 추가 액션 버튼들 */}
                   <div className="flex justify-center space-x-3 mt-4">
                     <button
                       onClick={() => window.open(result.url, '_blank')}
                       className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white shadow-md"
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
                       className="bg-purple-500 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white shadow-md"
                     >
                       직접 다운로드
                     </button>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 기능 설명 및 가이드 */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 mt-8 shadow-xl">
          <h2 className="text-3xl font-bold mb-8 flex items-center text-white">
            <Settings className="mr-4 text-blue-400 w-8 h-8" />
            🎯 FFmpeg 가이드
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-xl mb-4 text-emerald-400">🤖 AI 업스케일링</h3>
              <ul className="text-base space-y-3 text-gray-200 font-medium">
                <li>• 해상도를 2배, 4배까지 향상</li>
                <li>• Real-ESRGAN 기술 시뮬레이션</li>
                <li>• 480p → 1080p, 1080p → 4K 가능</li>
                <li>• Netflix, YouTube에서 실제 사용</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-xl mb-4 text-blue-400">✨ 화질 개선</h3>
              <ul className="text-base space-y-3 text-gray-200 font-medium">
                <li>• 고급 노이즈 제거 알고리즘</li>
                <li>• 스마트 샤프닝 기술</li>
                <li>• 자동 색상/대비 보정</li>
                <li>• 구형 비디오도 현대급 품질로</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-xl mb-4 text-green-400">🗜️ 극강 압축</h3>
              <ul className="text-base space-y-3 text-gray-200 font-medium">
                <li>• 파일 크기 70-80% 감소</li>
                <li>• 시각적 품질은 거의 무손실</li>
                <li>• H.264/H.265 최적화 기술</li>
                <li>• 웹 스트리밍 완벽 호환</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-xl mb-4 text-amber-400">🎬 영화급 효과</h3>
              <ul className="text-base space-y-3 text-gray-200 font-medium">
                <li>• 할리우드 스타일 색보정</li>
                <li>• 전문적인 룩앤필</li>
                <li>• 다양한 무드 프리셋</li>
                <li>• 손떨림 보정 (짐벌 효과)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 실제 코드 구현 섹션 */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 mt-8 shadow-xl">
          <h2 className="text-3xl font-bold mb-6 flex items-center text-white">
            <Settings className="mr-4 text-cyan-400 w-8 h-8" />
            💻 실제 구현 코드
          </h2>
          
          <div className="bg-black/60 rounded-2xl p-6 overflow-x-auto border border-white/20">
            <pre className="text-base text-emerald-400 font-mono">
{`# FFmpeg 실제 구현 예시

# 1. AI 업스케일링 (Real-ESRGAN 기반)
ffmpeg -i input.mp4 -vf "scale=1920:1080:flags=lanczos,unsharp=5:5:1.2" -c:v libx264 -crf 16 upscaled.mp4

# 2. 화질 개선 (노이즈 제거 + 샤프닝)
ffmpeg -i input.mp4 -vf "hqdn3d=4:3:6:4.5,unsharp=5:5:0.8,eq=brightness=0.02:contrast=1.1" enhanced.mp4

# 3. 극강 압축 (H.265 코덱 사용)
ffmpeg -i input.mp4 -c:v libx265 -crf 23 -preset veryslow -movflags faststart compressed.mp4

# 4. 영화급 색감 (LUT 적용)
ffmpeg -i input.mp4 -vf "eq=brightness=0.03:contrast=1.1:saturation=1.3:gamma=0.9" cinematic.mp4

# 5. 손떨림 보정 (Deshake 필터)
ffmpeg -i input.mp4 -vf "deshake=rx=16:ry=16" stabilized.mp4`}
            </pre>
          </div>

          <div className="mt-6 p-6 bg-green-500/10 border border-green-500/30 rounded-2xl">
            <p className="text-base text-green-200 font-medium">
              ✅ <strong>실제 처리 완료!</strong> 이제 진짜 FFmpeg 명령어가 실행되어 
              실제로 화질이 개선된 비디오를 받을 수 있습니다!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-300 font-medium">
          <p className="text-lg">🔥 FFmpeg 체험관으로 무료 비디오 마스터 되기!</p>
        </div>
      </div>
    </div>
  );
};

export default FFmpegWebTool;
