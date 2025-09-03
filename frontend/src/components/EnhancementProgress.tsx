import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Button,
  Alert,
  Chip,
  Grid
} from '@mui/material';
import { 
  PlayArrow, 
  Stop, 
  CheckCircle, 
  Error,
  Schedule
} from '@mui/icons-material';
import { enhanceVideo, getEnhancementStatus, getMetadata } from '../services/api';

interface EnhancementOptions {
  resolution: string;
  bitrate: string;
  fps: number;
  codec: string;
  quality: string;
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
  const [status, setStatus] = useState<'processing' | 'completed' | 'error'>('processing');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('화질 개선을 시작합니다...');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [enhancementOptions, setEnhancementOptions] = useState<EnhancementOptions>({
    resolution: '1080p',
    bitrate: '5000k',
    fps: 30,
    codec: 'h264',
    quality: 'high'
  });
  const [originalMetadata, setOriginalMetadata] = useState<any>(null);

  useEffect(() => {
    startEnhancement();
  }, [fileId]);

  useEffect(() => {
    loadOriginalMetadata();
  }, [fileId]);

  useEffect(() => {
    if (status === 'processing' && jobId) {
      const interval = setInterval(checkStatus, 5000); // 3초에서 5초로 변경
      return () => clearInterval(interval);
    }
  }, [status, jobId]);

  const startEnhancement = async () => {
    try {
      setMessage('화질 개선 요청을 보내는 중...');
      setProgress(5); // 시작 시 5%로 설정
      
      const result = await enhanceVideo(fileId, enhancementOptions);
      setJobId(result.jobId);
      setMessage('화질 개선이 시작되었습니다. 처리 중...');
      setProgress(10); // 요청 완료 후 10%로 설정
      
    } catch (err: any) {
      setError(typeof err === 'string' ? err : '화질 개선 시작 실패');
      setStatus('error');
    }
  };

  const loadOriginalMetadata = async () => {
    try {
      const metadataResult = await getMetadata(fileId, 'original');
      setOriginalMetadata(metadataResult.metadata);
    } catch (err: any) {
      console.error('원본 메타데이터 로드 실패:', err);
      // 실패해도 계속 진행
    }
  };

  const checkStatus = async () => {
    if (!jobId) return;

    try {
      const statusResult = await getEnhancementStatus(jobId);
      
      if (statusResult.status === 'completed') {
        setStatus('completed');
        setProgress(100);
        setMessage('화질 개선이 완료되었습니다!');
        // 2초 후 메타데이터 비교 화면으로 이동
        setTimeout(() => {
          onEnhancementComplete(statusResult.file);
        }, 2000);
      } else {
        // 서버에서 받은 실제 진행률 사용
        if (statusResult.progress) {
          setProgress(statusResult.progress);
        } else {
          // 서버에서 진행률을 제공하지 않으면 점진적으로 증가
          setProgress(prev => {
            if (prev >= 85) {
              return 85; // 85%에서 대기
            }
            return Math.min(prev + 2, 85); // 2%씩 증가
          });
        }
        setMessage(statusResult.message || '비디오를 처리하고 있습니다...');
      }
    } catch (err: any) {
      setError(typeof err === 'string' ? err : '상태 확인 실패');
      setStatus('error');
    }
  };

  const handleCancel = () => {
    // 실제로는 서버에 취소 요청을 보내야 함
    setMessage('작업이 취소되었습니다.');
    onCancel();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
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
        return <Error />;
      default:
        return <Schedule />;
    }
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
            <strong>현재 단계:</strong> 화질 개선 중입니다. 이 과정은 몇 분 정도 소요될 수 있습니다.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            해상도: {originalMetadata?.video?.resolution || enhancementOptions.resolution}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            비트레이트: {originalMetadata?.video?.bitrate ? `${Math.round(Number(originalMetadata.video.bitrate) / 1000)}k` : enhancementOptions.bitrate}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            FPS: {originalMetadata?.video?.fps || enhancementOptions.fps}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            코덱: {originalMetadata?.video?.codec || enhancementOptions.codec}
          </Typography>
        </Box>

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

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default EnhancementProgress;
