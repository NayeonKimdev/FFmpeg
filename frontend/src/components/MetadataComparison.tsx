import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { compareMetadata, downloadFile, analyzeVideo, ComparisonData } from '../services/api';
import VideoPlayer from './VideoPlayer';

interface MetadataComparisonProps {
  fileId: string;
}

const MetadataComparison: React.FC<MetadataComparisonProps> = ({ fileId }) => {
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoErrors, setVideoErrors] = useState<{[key: string]: any}>({});
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  // 중복 API 호출 방지
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 메타데이터 비교 로드 (한 번만 실행)
  useEffect(() => {
    let hasLoaded = false;
    
    const loadComparison = async () => {
      if (hasLoaded || isLoadingComparison) return;
      hasLoaded = true;
      setIsLoadingComparison(true);
      
      try {
        setLoading(true);
        console.log('메타데이터 비교 요청:', fileId);
        
        const data = await compareMetadata(fileId);
        
        console.log('메타데이터 비교 결과 수신:', data);
        setComparison(data);
        setError(null);
      } catch (err: any) {
        console.error('메타데이터 비교 오류:', err);
        
        // 429 에러인 경우 특별 처리
        if (err.response?.status === 429) {
          setError('서버 부하로 인해 메타데이터 로드가 지연되고 있습니다. 잠시만 기다려주세요.');
          
          // 10초 후 재시도
          setTimeout(() => {
            hasLoaded = false;
            setIsLoadingComparison(false);
            loadComparison();
          }, 10000);
          return;
        }
        
        setError(typeof err === 'string' ? err : '메타데이터 비교 실패');
      } finally {
        setLoading(false);
        setIsLoadingComparison(false);
      }
    };

    loadComparison();
  }, [fileId]); // fileId가 변경될 때만 실행

  // 비디오 에러 핸들러 (메모이제이션)
  const handleVideoError = useCallback((error: any) => {
    setVideoErrors(prev => ({
      ...prev,
      [error.type]: error
    }));
  }, []);

  // 비디오 분석 (디바운싱 적용)
  const handleAnalyzeVideo = useCallback(async (type: 'original' | 'enhanced') => {
    if (analyzing) return; // 이미 분석 중이면 중단
    
    try {
      setAnalyzing(true);
      console.log(`${type} 비디오 상세 분석 시작`);
      
      const analysisResult = await analyzeVideo(fileId, type);
      
      if (mountedRef.current) {
        setAnalysis(analysisResult);
        console.log(`${type} 비디오 분석 결과:`, analysisResult);
      }
    } catch (err: any) {
      console.error('비디오 분석 오류:', err);
      if (mountedRef.current) {
        if (err.response?.status === 429) {
          setError('분석 요청이 많아 잠시 후 다시 시도해주세요.');
        } else {
          setError(`비디오 분석 실패: ${err.message}`);
        }
      }
    } finally {
      if (mountedRef.current) {
        setAnalyzing(false);
      }
    }
  }, [fileId, analyzing]);

  // 다운로드 함수들 (메모이제이션)
  const handleDownloadOriginal = useCallback(async () => {
    try {
      await downloadFile(fileId, 'original');
    } catch (err: any) {
      console.error('원본 파일 다운로드 오류:', err);
      setError('원본 파일 다운로드에 실패했습니다.');
    }
  }, [fileId]);

  const handleDownloadEnhanced = useCallback(async () => {
    try {
      await downloadFile(fileId, 'enhanced');
    } catch (err: any) {
      console.error('개선된 파일 다운로드 오류:', err);
      setError('개선된 파일 다운로드에 실패했습니다.');
    }
  }, [fileId]);

  // 로딩 상태 개선
  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2 }}>메타데이터를 불러오는 중...</Typography>
        <Typography variant="caption" color="text.secondary">
          처음 로드 시 시간이 걸릴 수 있습니다.
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity={error.includes('서버 부하') ? 'warning' : 'error'} 
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => window.location.reload()}>
            새로고침
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!comparison) {
    return (
      <Alert severity="info">
        메타데이터를 불러올 수 없습니다.
      </Alert>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (duration: string) => {
    const seconds = parseFloat(duration);
    if (isNaN(seconds)) return '알 수 없음';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom>
        비디오 미리보기 및 메타데이터 비교
      </Typography>

      {/* 비디오 미리보기 */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4 }}>
        <Paper elevation={2} sx={{ p: 2, flex: 1 }}>
          <Typography variant="h6" gutterBottom>
            원본 비디오
          </Typography>
          <VideoPlayer
            src={`http://localhost:5000/uploads/${comparison?.comparison?.original?.fileInfo?.name || fileId}`}
            type="original"
            onError={handleVideoError}
          />
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleDownloadOriginal}
            sx={{ mt: 2 }}
            fullWidth
          >
            원본 다운로드
          </Button>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, flex: 1 }}>
          <Typography variant="h6" gutterBottom>
            개선된 비디오
          </Typography>
          <VideoPlayer
            src={`http://localhost:5000/processed/${comparison?.comparison?.enhanced?.fileInfo?.name || fileId.replace('.MP4', '_enhanced.mp4')}`}
            type="enhanced"
            onError={handleVideoError}
          />
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleDownloadEnhanced}
            sx={{ mt: 2 }}
            fullWidth
          >
            개선된 비디오 다운로드
          </Button>
        </Paper>
      </Box>

      {/* 메타데이터 비교 테이블 */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          메타데이터 비교
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              파일 크기
            </Typography>
            <Typography variant="body1">
              {comparison?.comparison?.original?.fileInfo?.sizeFormatted && comparison?.comparison?.enhanced?.fileInfo?.sizeFormatted ? 
                `${comparison.comparison.original.fileInfo.sizeFormatted} → ${comparison.comparison.enhanced.fileInfo.sizeFormatted}` : 
                '데이터 없음'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              해상도
            </Typography>
            <Typography variant="body1">
              {comparison?.comparison?.original?.metadata?.video?.resolution && comparison?.comparison?.enhanced?.metadata?.video?.resolution ? 
                `${comparison.comparison.original.metadata.video.resolution} → ${comparison.comparison.enhanced.metadata.video.resolution}` : 
                '데이터 없음'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              비트레이트
            </Typography>
            <Typography variant="body1">
              {comparison?.comparison?.original?.metadata?.video?.bitrate && comparison?.comparison?.enhanced?.metadata?.video?.bitrate ? 
                `${Math.round(comparison.comparison.original.metadata.video.bitrate / 1000)}k → ${Math.round(comparison.comparison.enhanced.metadata.video.bitrate / 1000)}k` : 
                '데이터 없음'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              FPS
            </Typography>
            <Typography variant="body1">
              {comparison?.comparison?.original?.metadata?.video?.fps && comparison?.comparison?.enhanced?.metadata?.video?.fps ? 
                `${comparison.comparison.original.metadata.video.fps} → ${comparison.comparison.enhanced.metadata.video.fps}` : 
                '데이터 없음'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              코덱
            </Typography>
            <Typography variant="body1">
              {comparison?.comparison?.original?.metadata?.audio?.codec && comparison?.comparison?.enhanced?.metadata?.audio?.codec ? 
                `${comparison.comparison.original.metadata.audio.codec} (${comparison.comparison.original.metadata.audio.channels}ch) → ${comparison.comparison.enhanced.metadata.audio.codec} (${comparison.comparison.enhanced.metadata.audio.channels}ch)` : 
                '데이터 없음'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              재생 시간
            </Typography>
            <Typography variant="body1">
              {comparison?.comparison?.original?.metadata?.format?.duration && comparison?.comparison?.enhanced?.metadata?.format?.duration ? 
                `${formatDuration(comparison.comparison.original.metadata.format.duration)} → ${formatDuration(comparison.comparison.enhanced.metadata.format.duration)}` : 
                '데이터 없음'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* 상세 분석 */}
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          상세 분석 (프레임레이트/오디오 동기화 진단)
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            onClick={() => handleAnalyzeVideo('original')}
            disabled={analyzing}
            sx={{ mr: 1 }}
          >
            원본 분석
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleAnalyzeVideo('enhanced')}
            disabled={analyzing}
          >
            개선된 비디오 분석
          </Button>
        </Box>

        {analyzing && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography>분석 중...</Typography>
          </Box>
        )}

        {comparison && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              동기화 분석 결과
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                원본 비디오 동기화 상태
              </Typography>
              <Typography variant="body1">
                {comparison?.comparison?.original?.analysis?.syncIssues?.hasSyncProblem ? 
                  '❌ 동기화 문제 있음' : 
                  '✅ 동기화 정상'}
              </Typography>
              {comparison?.comparison?.original?.analysis?.syncIssues?.durationDiff && (
                <Typography variant="body2" color="text.secondary">
                  오디오-비디오 시간 차이: {comparison.comparison.original.analysis.syncIssues.durationDiff}초
                </Typography>
              )}
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                개선된 비디오 동기화 상태
              </Typography>
              <Typography variant="body1">
                {comparison?.comparison?.enhanced?.analysis?.syncIssues?.hasSyncProblem ? 
                  '❌ 동기화 문제 있음' : 
                  '✅ 동기화 정상'}
              </Typography>
              {comparison?.comparison?.enhanced?.analysis?.syncIssues?.durationDiff && (
                <Typography variant="body2" color="text.secondary">
                  오디오-비디오 시간 차이: {comparison.comparison.enhanced.analysis.syncIssues.durationDiff}초
                </Typography>
              )}
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                프레임레이트 분석
              </Typography>
              <Typography variant="body1">
                원본: {comparison?.comparison?.original?.metadata?.video?.fps} FPS
              </Typography>
              <Typography variant="body1">
                개선: {comparison?.comparison?.enhanced?.metadata?.video?.fps} FPS
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default MetadataComparison;
