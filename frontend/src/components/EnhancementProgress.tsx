import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Button,
  Alert,
  Paper,
  Grid,
  Chip,
  CircularProgress
} from '@mui/material';
import { PlayArrow, Stop, CheckCircle, Error } from '@mui/icons-material';
import { enhanceVideo, getEnhancementStatus } from '../services/api';

interface EnhancementProgressProps {
  fileId: string;
  onEnhancementComplete: (file: any) => void;
  onCancel: () => void;
}

interface EnhancementStatus {
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
  file?: any;
  estimatedTime?: string;
  lastModified?: string;
}

const EnhancementProgress: React.FC<EnhancementProgressProps> = ({
  fileId,
  onEnhancementComplete,
  onCancel
}) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string>('5-15분');
  const [lastModified, setLastModified] = useState<Date | null>(null);
  const [pollingInterval, setPollingInterval] = useState(5000); // 초기 5초
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // 스마트 폴링 - 진행률에 따라 간격 조정
  const getPollingInterval = useCallback((currentProgress: number) => {
    if (currentProgress < 10) return 10000; // 10초 - 초기 단계
    if (currentProgress < 50) return 8000;  // 8초 - 진행 중
    if (currentProgress < 90) return 5000;  // 5초 - 거의 완료
    return 3000; // 3초 - 최종 단계
  }, []);

  // 상태 확인 함수 (디바운싱 적용)
  const checkStatusDebounced = useCallback(async () => {
    if (!jobId || !mountedRef.current) return;

    try {
      const statusResult = await getEnhancementStatus(jobId);
      
      if (!mountedRef.current) return; // 컴포넌트가 언마운트되면 중단
      
      console.log('상태 확인 결과:', statusResult);
      
      if (statusResult.status === 'completed') {
        setStatus('completed');
        setProgress(100);
        setMessage('화질 개선이 완료되었습니다!');
        setIsPolling(false);
        
        // 폴링 중단
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        setTimeout(() => {
          if (mountedRef.current) {
            onEnhancementComplete(statusResult.file);
          }
        }, 2000);
        
      } else if (statusResult.status === 'failed') {
        setStatus('failed');
        setProgress(0);
        setMessage(statusResult.message || '비디오 처리에 실패했습니다.');
        setError(statusResult.error || '알 수 없는 오류가 발생했습니다.');
        setIsPolling(false);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
      } else {
        // 진행 중
        const newProgress = statusResult.progress || progress;
        setProgress(newProgress);
        setMessage(statusResult.message || '비디오를 처리하고 있습니다...');
        
        // 폴링 간격 조정
        const newInterval = getPollingInterval(newProgress);
        if (newInterval !== pollingInterval) {
          setPollingInterval(newInterval);
          
          // 기존 인터벌 클리어하고 새로 설정
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          startPolling(newInterval);
        }
        
        if (statusResult.lastModified) {
          setLastModified(new Date(statusResult.lastModified));
        }
      }
    } catch (err: any) {
      console.error('상태 확인 실패:', err);
      
      // 429 에러인 경우 폴링 간격 증가
      if (err.response?.status === 429) {
        console.log('Rate limit 도달, 폴링 간격 증가');
        setPollingInterval(prev => Math.min(prev * 2, 30000)); // 최대 30초
        setMessage('서버 부하로 인해 확인 간격을 늘렸습니다...');
        return; // 에러 상태로 변경하지 않음
      }
      
      // 네트워크 오류 등은 3회까지 재시도
      const retryCount = (err as any).retryCount || 0;
      if (retryCount < 3) {
        setTimeout(() => {
          const newErr = { ...err, retryCount: retryCount + 1 };
          checkStatusDebounced();
        }, 5000);
        return;
      }
      
      setError(err?.error || err?.message || '상태 확인 실패');
      setStatus('error');
      setIsPolling(false);
    }
  }, [jobId, progress, pollingInterval, getPollingInterval, onEnhancementComplete]);

  // 폴링 시작 함수
  const startPolling = useCallback((interval: number = pollingInterval) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    setIsPolling(true);
    intervalRef.current = setInterval(() => {
      checkStatusDebounced();
    }, interval);
  }, [checkStatusDebounced, pollingInterval]);

  // 폴링 시작 (상태가 processing일 때만)
  useEffect(() => {
    if (status === 'processing' && jobId && !isPolling) {
      startPolling();
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, jobId, isPolling, startPolling]);

  // 초기 enhancement 시작 (한 번만)
  useEffect(() => {
    let isInitialized = false;
    
    const initializeEnhancement = async () => {
      if (isInitialized) return;
      isInitialized = true;
      
      try {
        setMessage('화질 개선 요청을 보내는 중...');
        setProgress(5);
        
        const result = await enhanceVideo(fileId, {
          resolution: '1080p',
          quality: 'high'
        });
        
        if (!mountedRef.current) return;
        
        setJobId(result.jobId);
        setEstimatedTime(result.estimatedTime || '5-15분');
        setMessage('화질 개선이 시작되었습니다. 처리 중...');
        setProgress(15);
        setStatus('processing');
        
        console.log('화질 개선 시작:', result);
        
        // 3초 후 첫 상태 확인
        setTimeout(() => {
          if (mountedRef.current) {
            checkStatusDebounced();
          }
        }, 3000);
        
      } catch (err: any) {
        console.error('화질 개선 시작 실패:', err);
        if (mountedRef.current) {
          setError(err?.error || err?.message || '화질 개선 시작 실패');
          setStatus('error');
        }
      }
    };
    
    initializeEnhancement();
  }, [fileId]); // fileId만 의존성으로

  const handleCancel = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    onCancel();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'error': return 'error';
      default: return 'primary';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'failed': 
      case 'error': return <Error />;
      case 'processing': return <CircularProgress size={20} />;
      default: return <PlayArrow />;
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {getStatusIcon()}
        <Typography variant="h6" sx={{ ml: 1 }}>
          화질 개선 진행 상황
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          color={getStatusColor()}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <Typography variant="body2" color="text.secondary">
            예상 소요 시간
          </Typography>
          <Typography variant="body1">
            {estimatedTime}
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="body2" color="text.secondary">
            마지막 업데이트
          </Typography>
          <Typography variant="body1">
            {lastModified ? lastModified.toLocaleTimeString() : '대기 중...'}
          </Typography>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip 
          label={`폴링 간격: ${pollingInterval/1000}초`} 
          size="small" 
          variant="outlined"
        />
        <Chip 
          label={`상태: ${status}`} 
          size="small" 
          color={getStatusColor()}
        />
      </Box>

      {status === 'processing' && (
        <Button
          variant="outlined"
          color="error"
          startIcon={<Stop />}
          onClick={handleCancel}
          sx={{ mt: 2 }}
        >
          취소
        </Button>
      )}
    </Paper>
  );
};

export default EnhancementProgress;
