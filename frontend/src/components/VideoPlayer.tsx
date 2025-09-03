import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import { PlayArrow, Pause, VolumeUp, VolumeOff } from '@mui/icons-material';

interface VideoPlayerProps {
  src: string;
  type: 'original' | 'enhanced';
  onError: (error: any) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, type, onError }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const maxRetries = 1; // 최대 재시도 횟수 제한

  // 로딩 타임아웃 설정 (5초)
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn(`${type} 비디오 로딩 타임아웃 (5초)`);
        setError('로딩 타임아웃: 비디오를 로드하는데 시간이 너무 오래 걸립니다.');
        setIsLoading(false);
      }, 5000);
      
      loadingTimeoutRef.current = timeout;
      
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    }
  }, [isLoading, type]);

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    // 타임아웃 클리어
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    const video = e.currentTarget;
    const videoError = video.error;
    
    let errorMessage = '';
    let errorCode = 0;
    
    if (videoError) {
      errorCode = videoError.code;
      switch (videoError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'ABORTED: 비디오 로드가 중단되었습니다.';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'NETWORK: 네트워크 오류로 비디오를 로드할 수 없습니다.';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'DECODE_ERROR: 비디오 디코딩 실패 (파일 형식 문제)';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'FORMAT_ERROR: 지원하지 않는 비디오 형식입니다.';
          break;
        default:
          errorMessage = `UNKNOWN_ERROR: 알 수 없는 오류 (${videoError.message})`;
      }
    } else {
      errorMessage = 'UNKNOWN_ERROR: 비디오 로드 실패';
    }
    
    setError(errorMessage);
    setIsLoading(false);
    
    console.error(`${type} 비디오 오류:`, {
      code: errorCode,
      message: errorMessage,
      src: src,
      retryCount: retryCount
    });
    
    // 부모 컴포넌트에 오류 전달
    onError({ code: errorCode, message: errorMessage, type, src });
    
    // 자동 재시도 비활성화 (무한 재시도 방지)
    console.log(`${type} 비디오 자동 재시도 비활성화 (무한 재시도 방지)`);
  };

  const handleRetry = () => {
    if (retryCount >= maxRetries) {
      console.log(`${type} 비디오 최대 재시도 횟수 초과`);
      return;
    }
    
    setRetryCount(prev => prev + 1);
    setError(null);
    setIsLoading(true);
    
    // 비디오 요소 리셋
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLoadedData = () => {
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  if (error) {
    return (
      <Box sx={{ 
        width: '100%', 
        height: 200, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: 'grey.100',
        borderRadius: 1
      }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        {retryCount < maxRetries && (
          <Button 
            variant="outlined" 
            onClick={handleRetry}
            size="small"
          >
            재시도
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {isLoading && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(0,0,0,0.5)',
          zIndex: 1
        }}>
          <CircularProgress size={40} />
          <Typography sx={{ mt: 1, color: 'white' }}>
            {retryCount > 0 ? '재시도 중...' : '로딩 중...'}
          </Typography>
        </Box>
      )}
      
      <video
        ref={videoRef}
        src={src}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '300px',
          borderRadius: '4px'
        }}
        controls
        muted={isMuted}
        playsInline
        onLoadedData={handleLoadedData}
        onError={handleVideoError}
        onPlay={handlePlay}
        onPause={handlePause}
      />
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        mt: 1,
        gap: 1 
      }}>
        <Button
          size="small"
          variant="outlined"
          onClick={handlePlayPause}
          startIcon={isPlaying ? <Pause /> : <PlayArrow />}
        >
          {isPlaying ? '일시정지' : '재생'}
        </Button>
        
        <Button
          size="small"
          variant="outlined"
          onClick={handleMuteToggle}
          startIcon={isMuted ? <VolumeOff /> : <VolumeUp />}
        >
          {isMuted ? '음소거 해제' : '음소거'}
        </Button>
      </Box>
    </Box>
  );
};

export default VideoPlayer;
