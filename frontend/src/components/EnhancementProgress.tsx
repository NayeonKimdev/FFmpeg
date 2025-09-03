import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Button,
  Alert,
  Chip,
  Divider
} from '@mui/material';
import { 
  PlayArrow, 
  Stop, 
  CheckCircle, 
  Error,
  Schedule,
  Info
} from '@mui/icons-material';
import { enhanceVideo, getEnhancementStatus, getMetadata } from '../services/api';

interface EnhancementOptions {
  resolution: string;
  quality: string;
  codec: string;
}

interface EnhancementProgressProps {
  fileId: string;
  onEnhancementComplete: (result: any) => void;
  onCancel: () => void;
}

const EnhancementProgress: React.FC<EnhancementProgressProps> = ({
  fileId,
  onEnhancementComplete,
  onCancel
}) => {
  const [status, setStatus] = useState<'processing' | 'completed' | 'error' | 'failed'>('processing');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('화질 개선을 시작합니다...');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [enhancementOptions, setEnhancementOptions] = useState<EnhancementOptions>({
    resolution: '1080p',
    quality: 'high',
    codec: 'h264'
  });
  const [originalMetadata, setOriginalMetadata] = useState<any>(null);
  const [estimatedTime, setEstimatedTime] = useState<string>('5-15분');
  const [lastModified, setLastModified] = useState<Date | null>(null);

  useEffect(() => {
    startEnhancement();
  }, [fileId]);

  useEffect(() => {
    loadOriginalMetadata();
  }, [fileId]);

  useEffect(() => {
    if (status === 'processing' && jobId) {
      const interval = setInterval(checkStatus, 3000); // 3초마다 확인
      return () => clearInterval(interval);
    }
  }, [status, jobId]);

  const startEnhancement = async () => {
    try {
      setMessage('화질 개선 요청을 보내는 중...');
      setProgress(5);
      
      const result = await enhanceVideo(fileId, enhancementOptions);
      setJobId(result.jobId);
      setEstimatedTime(result.estimatedTime || '5-15분');
      setMessage('화질 개선이 시작되었습니다. 처리 중...');
      setProgress(15);
      
      console.log('화질 개선 시작:', result);
      
    } catch (err: any) {
      console.error('화질 개선 시작 실패:', err);
      setError(err?.error || err?.message || '화질 개선 시작 실패');
      setStatus('error');
    }
  };

  const loadOriginalMetadata = async () => {
    try {
      const metadataResult = await getMetadata(fileId, 'original');
      setOriginalMetadata(metadataResult.metadata);
      console.log('원본 메타데이터 로드 완료:', metadataResult.metadata);
    } catch (err: any) {
      console.error('원본 메타데이터 로드 실패:', err);
      // 실패해도 계속 진행
    }
  };

  const checkStatus = async () => {
    if (!jobId) return;

    try {
      const statusResult = await getEnhancementStatus(jobId);
      
      console.log('상태 확인 결과:', statusResult);
      
      if (statusResult.status === 'completed') {
        setStatus('completed');
        setProgress(100);
        setMessage('화질 개선이 완료되었습니다!');
        
        // 완료된 파일 정보 로그
        if (statusResult.file) {
          console.log('완료된 파일:', statusResult.file);
        }
        
        // 메타데이터 정보 로그
        if (statusResult.metadata) {
          console.log('출력 메타데이터:', statusResult.metadata);
        }
        
        // 2초 후 메타데이터 비교 화면으로 이동
        setTimeout(() => {
          onEnhancementComplete(statusResult.file);
        }, 2000);
        
      } else if (statusResult.status === 'failed') {
        setStatus('failed');
        setProgress(0);
        setMessage(statusResult.message || '비디오 처리에 실패했습니다.');
        setError(statusResult.error || '알 수 없는 오류가 발생했습니다.');
        
      } else {
        // 서버에서 받은 실제 진행률 사용
        if (statusResult.progress) {
          setProgress(statusResult.progress);
        } else {
          // 서버에서 진행률을 제공하지 않으면 점진적으로 증가
          setProgress(prev => {
            if (prev >= 90) {
              return 90; // 90%에서 대기
            }
            return Math.min(prev + 1, 90); // 1%씩 증가
          });
        }
        
        setMessage(statusResult.message || '비디오를 처리하고 있습니다...');
        
        // 마지막 수정 시간 업데이트
        if (statusResult.lastModified) {
          setLastModified(new Date(statusResult.lastModified));
        }
      }
    } catch (err: any) {
      console.error('상태 확인 실패:', err);
      setError(err?.error || err?.message || '상태 확인 실패');
      setStatus('error');
    }
  };

  const handleCancel = async () => {
    try {
      if (jobId) {
        // 서버에 취소 요청 보내기
        // await cancelEnhancement(jobId);
        console.log('작업 취소 요청:', jobId);
      }
      setMessage('작업이 취소되었습니다.');
      onCancel();
    } catch (err: any) {
      console.error('작업 취소 실패:', err);
      setError('작업 취소에 실패했습니다.');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'primary';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'error':
      case 'failed':
        return <Error />;
      default:
        return <Schedule />;
    }
  };

  const formatDuration = (duration: string) => {
    const seconds = parseFloat(duration);
    if (isNaN(seconds)) return '알 수 없음';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}분 ${remainingSeconds}초`;
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getStatusIcon()}
          <Typography variant="h6" sx={{ ml: 1 }}>
            화질 개선 진행 상황
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>현재 단계:</strong> 화질 개선 중입니다. 이 과정은 {estimatedTime} 정도 소요될 수 있습니다.
          </Typography>
        </Alert>

        {/* 원본 파일 정보 */}
        {originalMetadata && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              원본 파일 정보
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  해상도: {originalMetadata.video?.resolution || '알 수 없음'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  FPS: {originalMetadata.video?.fps || '알 수 없음'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  코덱: {originalMetadata.video?.codec || '알 수 없음'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  오디오: {originalMetadata.audio ? `${originalMetadata.audio.codec} (${originalMetadata.audio.channels}ch)` : '없음'}
                </Typography>
              </Box>
              {originalMetadata.format?.duration && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="body2" color="text.secondary">
                    길이: {formatDuration(originalMetadata.format.duration)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        <Typography variant="body1" gutterBottom>
          {message}
        </Typography>

        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ mb: 2 }}
          color={getStatusColor()}
        />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {progress}% 완료
        </Typography>

        {lastModified && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            마지막 업데이트: {lastModified.toLocaleTimeString()}
          </Typography>
        )}

        {status === 'processing' && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<Stop />}
            onClick={handleCancel}
            sx={{ mr: 1 }}
          >
            취소
          </Button>
        )}

        {status === 'completed' && (
          <Chip 
            label="완료" 
            color="success" 
            icon={<CheckCircle />}
          />
        )}

        {status === 'failed' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>처리 실패:</strong> {error}
            </Typography>
          </Alert>
        )}

        {error && status !== 'failed' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default EnhancementProgress;
