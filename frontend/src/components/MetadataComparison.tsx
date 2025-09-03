import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Card,
  CardContent,
  Alert,
  Button,
  CircularProgress
} from '@mui/material';
import { CompareArrows, TrendingUp, TrendingDown, Download, PlayArrow, Analytics } from '@mui/icons-material';
import { getMetadata, compareMetadata, Metadata, ComparisonData, downloadFile, getVideoStreamUrl, analyzeVideo } from '../services/api';

// 향상된 비디오 에러 핸들링 컴포넌트
const VideoPlayer = ({ 
  src, 
  type, 
  onError 
}: { 
  src: string, 
  type: 'original' | 'enhanced',
  onError: (error: any) => void 
}) => {
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const error = video.error;
    
    let errorMessage = '';
    let errorCode = 0;
    
    if (error) {
      errorCode = error.code;
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'ABORTED: 비디오 로드가 중단되었습니다.';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'NETWORK: 네트워크 오류로 비디오를 로드할 수 없습니다.';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'DECODE_ERROR: 비디오 디코딩 실패 (완전한 리인코딩 처리됨)';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'FORMAT_ERROR: 지원하지 않는 비디오 형식입니다.';
          break;
        default:
          errorMessage = `UNKNOWN_ERROR: 알 수 없는 오류 (${error.message})`;
      }
    } else {
      errorMessage = 'UNKNOWN_ERROR: 비디오 로드 실패';
    }
    
    setVideoError(errorMessage);
    setIsLoading(false);
    onError({ code: errorCode, message: errorMessage, type });
    
    console.error(`${type} 비디오 오류:`, {
      code: errorCode,
      message: errorMessage,
      src: src
    });
  };

  const handleCanPlay = () => {
    setVideoError(null);
    setIsLoading(false);
    console.log(`${type} 비디오 재생 가능`);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setVideoError(null);
    console.log(`${type} 비디오 로드 시작`);
  };

  const handleRetry = () => {
    setVideoError(null);
    setIsLoading(true);
    const video = document.querySelector(`video[data-type="${type}"]`) as HTMLVideoElement;
    if (video) {
      video.load();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.1)',
          zIndex: 1
        }}>
          <CircularProgress size={40} />
        </div>
      )}
      
      <video
        data-type={type}
        controls
        preload="metadata"
        crossOrigin="anonymous"
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' 
        }}
        src={src}
        onError={handleVideoError}
        onCanPlay={handleCanPlay}
        onLoadStart={handleLoadStart}
        onLoadedMetadata={() => {
          console.log(`${type} 비디오 메타데이터 로드 완료`);
        }}
      >
        브라우저가 비디오를 지원하지 않습니다.
      </video>
      
      {videoError && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.95)',
          zIndex: 2,
          padding: '20px',
          textAlign: 'center'
        }}>
          <Typography variant="body2" color="error" gutterBottom>
            비디오 로드 실패
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ mb: 2 }}>
            {videoError}
          </Typography>
          <Typography variant="caption" color="info.main" sx={{ mb: 2 }}>
            {type === 'enhanced' ? '개선된 비디오는 완전한 리인코딩으로 안정성을 확보합니다.' : ''}
          </Typography>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleRetry}
            sx={{ mt: 1 }}
          >
            재시도
          </Button>
        </div>
      )}
    </div>
  );
};

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

  useEffect(() => {
    loadComparison();
  }, [fileId]);

  const loadComparison = async () => {
    try {
      setLoading(true);
      console.log('메타데이터 비교 요청:', fileId);
      const data = await compareMetadata(fileId);
      console.log('메타데이터 비교 결과:', JSON.stringify(data, null, 2));
      setComparison(data);
    } catch (err: any) {
      console.error('메타데이터 비교 오류:', err);
      setError(typeof err === 'string' ? err : '메타데이터 비교 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoError = (error: any) => {
    setVideoErrors(prev => ({
      ...prev,
      [error.type]: error
    }));
  };

  const handleAnalyzeVideo = async (type: 'original' | 'enhanced') => {
    try {
      setAnalyzing(true);
      console.log(`${type} 비디오 상세 분석 시작`);
      const analysisResult = await analyzeVideo(fileId, type);
      setAnalysis(analysisResult);
      console.log(`${type} 비디오 분석 결과:`, analysisResult);
    } catch (err: any) {
      console.error('비디오 분석 오류:', err);
      setError(`비디오 분석 실패: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: string): string => {
    const num = parseFloat(seconds);
    const hours = Math.floor(num / 3600);
    const minutes = Math.floor((num % 3600) / 60);
    const secs = Math.floor(num % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownloadOriginal = async () => {
    try {
      await downloadFile(fileId, 'original');
    } catch (err: any) {
      console.error('원본 파일 다운로드 오류:', err);
    }
  };

  const handleDownloadEnhanced = async () => {
    try {
      await downloadFile(fileId, 'enhanced');
    } catch (err: any) {
      console.error('개선된 파일 다운로드 오류:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>메타데이터를 불러오는 중...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
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

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <CompareArrows sx={{ mr: 1 }} />
        메타데이터 비교
      </Typography>

      {comparison.improvements && (
        <Card sx={{ mb: 3, bgcolor: 'success.50' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="success.main">
              개선 효과 요약
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  파일 크기 변화
                </Typography>
                <Typography variant="h6" color={comparison.improvements.fileSizeChange.change > 0 ? 'error' : 'success'}>
                  {comparison.improvements.fileSizeChange.percentage}%
                  {comparison.improvements.fileSizeChange.change > 0 ? <TrendingUp /> : <TrendingDown />}
                </Typography>
              </Box>
                                           <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  해상도
                </Typography>
                <Typography variant="h6">
                  {comparison.improvements.resolutionChange.original} → {comparison.improvements.resolutionChange.enhanced}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  비트레이트
                </Typography>
                <Typography variant="h6">
                  {comparison.improvements.bitrateChange.original} → {comparison.improvements.bitrateChange.enhanced}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>속성</TableCell>
              <TableCell align="center">
                <Chip label="원본" color="default" size="small" />
              </TableCell>
              <TableCell align="center">
                <Chip label="개선됨" color="primary" size="small" />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>파일 크기</strong>
              </TableCell>
              <TableCell align="center">
                {comparison.original ? formatFileSize(comparison.original.fileInfo.size) : '-'}
              </TableCell>
              <TableCell align="center">
                {comparison.enhanced ? formatFileSize(comparison.enhanced.fileInfo.size) : '-'}
              </TableCell>
            </TableRow>
                                     <TableRow>
              <TableCell component="th" scope="row">
                <strong>해상도</strong>
              </TableCell>
              <TableCell align="center">
                {comparison.original?.metadata?.video?.resolution || '분석 중...'}
              </TableCell>
              <TableCell align="center">
                {comparison.enhanced?.metadata?.video?.resolution || '분석 중...'}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>비트레이트</strong>
              </TableCell>
              <TableCell align="center">
                {comparison.original?.metadata?.video?.bitrate ? `${Math.round(Number(comparison.original.metadata.video.bitrate) / 1000)}k` : '분석 중...'}
              </TableCell>
              <TableCell align="center">
                {comparison.enhanced?.metadata?.video?.bitrate ? `${Math.round(Number(comparison.enhanced.metadata.video.bitrate) / 1000)}k` : '분석 중...'}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>FPS</strong>
              </TableCell>
              <TableCell align="center">
                {comparison.original?.metadata?.video?.fps || '분석 중...'}
              </TableCell>
              <TableCell align="center">
                {comparison.enhanced?.metadata?.video?.fps || '분석 중...'}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>코덱</strong>
              </TableCell>
              <TableCell align="center">
                {comparison.original?.metadata?.video?.codec || '분석 중...'}
              </TableCell>
              <TableCell align="center">
                {comparison.enhanced?.metadata?.video?.codec || '분석 중...'}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>재생 시간</strong>
              </TableCell>
              <TableCell align="center">
                {comparison.original?.metadata?.format?.duration ? formatDuration(comparison.original.metadata.format.duration) : '분석 중...'}
              </TableCell>
              <TableCell align="center">
                {comparison.enhanced?.metadata?.format?.duration ? formatDuration(comparison.enhanced.metadata.format.duration) : '분석 중...'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* 비디오 미리보기 섹션 */}
      {comparison.hasEnhanced && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <PlayArrow sx={{ mr: 1 }} />
              비디오 미리보기
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 300 }}>
                <Typography variant="subtitle1" gutterBottom>
                  원본 비디오
                </Typography>
                                 <Box sx={{ 
                   width: '100%', 
                   height: 200, 
                   bgcolor: 'grey.100', 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'center',
                   borderRadius: 1,
                   overflow: 'hidden'
                 }}>
                   <VideoPlayer
                     src={getVideoStreamUrl(fileId, 'original')}
                     type="original"
                     onError={handleVideoError}
                   />
                 </Box>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleDownloadOriginal}
                  sx={{ mt: 1 }}
                  fullWidth
                >
                  원본 다운로드
                </Button>
              </Box>
              <Box sx={{ flex: 1, minWidth: 300 }}>
                <Typography variant="subtitle1" gutterBottom>
                  개선된 비디오
                </Typography>
                <Typography variant="caption" color="info.main" sx={{ mb: 1, display: 'block' }}>
                  화질 향상 (완전한 리인코딩으로 안정성 확보)
                </Typography>
                                 <Box sx={{ 
                   width: '100%', 
                   height: 200, 
                   bgcolor: 'primary.50', 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'center',
                   borderRadius: 1,
                   overflow: 'hidden'
                 }}>
                   <VideoPlayer
                     src={getVideoStreamUrl(fileId, 'enhanced')}
                     type="enhanced"
                     onError={handleVideoError}
                   />
                 </Box>
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  onClick={handleDownloadEnhanced}
                  sx={{ mt: 1 }}
                  fullWidth
                >
                  개선된 비디오 다운로드
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {!comparison.hasEnhanced && (
        <Alert severity="info" sx={{ mt: 2 }}>
          아직 개선된 비디오가 없습니다. 화질 개선을 먼저 진행해주세요.
        </Alert>
      )}

      {/* 상세 분석 섹션 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Analytics sx={{ mr: 1 }} />
            상세 분석 (프레임레이트/오디오 동기화 진단)
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Analytics />}
              onClick={() => handleAnalyzeVideo('original')}
              disabled={analyzing}
            >
              원본 분석
            </Button>
            <Button
              variant="outlined"
              startIcon={<Analytics />}
              onClick={() => handleAnalyzeVideo('enhanced')}
              disabled={analyzing || !comparison.hasEnhanced}
            >
              개선된 비디오 분석
            </Button>
          </Box>

          {analyzing && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CircularProgress size={20} />
              <Typography>분석 중...</Typography>
            </Box>
          )}

          {analysis && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                분석 결과: {analysis.fileName}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 300 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    비디오 정보
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    코덱: {analysis.video?.codec || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    해상도: {analysis.video?.resolution || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    프레임레이트: {analysis.video?.fps?.calculated?.toFixed(2) || 'N/A'} fps
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    비트레이트: {Math.round((analysis.video?.bitrate || 0) / 1000)}k
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    길이: {analysis.video?.duration?.toFixed(3) || 'N/A'}초
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, minWidth: 300 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    오디오 정보
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    코덱: {analysis.audio?.codec || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    샘플레이트: {analysis.audio?.sampleRate || 'N/A'} Hz
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    채널: {analysis.audio?.channels || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    비트레이트: {Math.round((analysis.audio?.bitrate || 0) / 1000)}k
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    길이: {analysis.audio?.duration?.toFixed(3) || 'N/A'}초
                  </Typography>
                </Box>
              </Box>

              {analysis.syncIssues.hasSyncProblem && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    동기화 문제 발견!
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    길이 차이: {analysis.syncIssues.durationDiff.toFixed(3)}초
                  </Typography>
                  {analysis.syncIssues.details.map((detail: string, index: number) => (
                    <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                      • {detail}
                    </Typography>
                  ))}
                </Alert>
              )}

              {!analysis.syncIssues.hasSyncProblem && analysis.audio && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  오디오/비디오 동기화 정상
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default MetadataComparison;
