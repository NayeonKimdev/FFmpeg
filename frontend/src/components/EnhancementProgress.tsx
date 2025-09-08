import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Button,
  Alert,
  Paper,
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
  const initializedRef = useRef(false); // 중복 초기화 방지

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
    if (currentProgress < 20) return 5000;  // 5초 - 초기 단계
    if (currentProgress < 50) return 3000;  // 3초 - 진행 중
    if (currentProgress < 90) return 2000; // 2초 - 거의 완료
    return 1000; // 1초 - 최종 단계 (95% 이상)
  }, []);

  // 즉시 상태 확인 함수 (디바운싱 없음)
  const checkStatusImmediately = useCallback(async (currentJobId: string) => {
    console.log('checkStatusImmediately 호출됨, jobId:', currentJobId);
    
    try {
      console.log('즉시 상태 조회 API 호출:', currentJobId);
      const statusResult = await getEnhancementStatus(currentJobId);
      
      console.log('즉시 상태 확인 결과:', statusResult);
      console.log('즉시 상태:', statusResult.status);
      console.log('즉시 진행률:', statusResult.progress);
      console.log('즉시 파일:', statusResult.file);
      
      // 파일 정보가 있으면 상세 로깅
      if (statusResult.file) {
        console.log('즉시 파일명:', statusResult.file.name);
        console.log('즉시 파일 크기:', statusResult.file.sizeFormatted);
        console.log('즉시 처리 중 여부:', statusResult.file.isProcessing);
      } else {
        console.log('즉시 파일 정보 없음');
      }
      
      if (statusResult.status === 'completed') {
        console.log('=== 즉시 완료 상태 감지됨 ===');
        console.log('즉시 완료된 파일:', statusResult.file);
        setStatus('completed');
        setProgress(100);
        setMessage('화질 개선이 완료되었습니다!');
        setIsPolling(false);
        
        // 폴링 중단
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        console.log('즉시 완료 콜백 호출...');
        onEnhancementComplete(statusResult.file);
        return true; // 완료됨
      }
      return false; // 아직 완료되지 않음
    } catch (err) {
      console.error('즉시 상태 확인 실패:', err);
      return false;
    }
  }, [onEnhancementComplete]);

  // 상태 확인 함수 (디바운싱 적용)
  const checkStatusDebounced = useCallback(async (currentJobId?: string) => {
    const idToUse = currentJobId || jobId;
    console.log('checkStatusDebounced 호출됨, jobId:', idToUse);
    
    if (!idToUse) {
      console.log('jobId가 없어서 상태 확인 건너뜀');
      return;
    }

    try {
      console.log('상태 조회 API 호출:', idToUse);
      const statusResult = await getEnhancementStatus(idToUse);
      
      console.log('상태 확인 결과:', statusResult);
      console.log('상태:', statusResult.status);
      console.log('진행률:', statusResult.progress);
      console.log('파일:', statusResult.file);
      
      // 완료 상태 감지 (더 엄격하게)
      if (statusResult.status === 'completed' && statusResult.file) {
        console.log('=== 완료 상태 감지됨 ===');
        console.log('완료된 파일:', statusResult.file);
        console.log('파일 크기:', statusResult.file.size);
        console.log('파일 경로:', statusResult.file.path);
        
        setStatus('completed');
        setProgress(100);
        setMessage('화질 개선이 완료되었습니다!');
        setIsPolling(false);
        
        // 폴링 중단
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        console.log('완료 콜백 호출...');
        console.log('콜백 함수:', onEnhancementComplete);
        onEnhancementComplete(statusResult.file);
        
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
        
        // 파일 정보가 있으면 표시
        if (statusResult.file) {
          console.log('진행 중 파일 정보:', statusResult.file);
          console.log('파일명:', statusResult.file.name);
          console.log('파일 크기:', statusResult.file.sizeFormatted);
          console.log('처리 중 여부:', statusResult.file.isProcessing);
        }
        
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
    console.log('폴링 시작 조건 확인:', { status, jobId, isPolling });
    if ((status === 'processing' || status === 'idle') && jobId && !isPolling) {
      console.log('폴링 시작!');
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
    if (initializedRef.current) return; // 중복 초기화 방지
    initializedRef.current = true;
    
    const initializeEnhancement = async () => {
      try {
        console.log('=== 화질 개선 초기화 시작 ===');
        console.log('fileId:', fileId);
        setMessage('화질 개선 요청을 보내는 중...');
        setProgress(5);
        
        console.log('enhanceVideo API 호출 시작...');
        const result = await enhanceVideo(fileId, {
          resolution: '1080p',
          quality: 'high'
        });
        
        console.log('enhanceVideo API 응답:', result);
        
        console.log('mountedRef.current:', mountedRef.current);
        // mountedRef 체크를 제거하고 강제로 실행
        console.log('mountedRef 체크 무시하고 강제 실행');
        
        console.log('상태 업데이트 시작...');
        
        // 즉시 상태 업데이트
        setJobId(result.jobId);
        setEstimatedTime(result.estimatedTime || '5-15분');
        setMessage('화질 개선이 시작되었습니다. 처리 중...');
        setProgress(15);
        setStatus('processing');
        
        console.log('화질 개선 시작:', result);
        console.log('jobId 설정됨:', result.jobId);
        console.log('status를 processing으로 변경');
        
        // 강제로 상태 확인 (jobId를 직접 전달) - 더 자주 확인
        setTimeout(() => {
          console.log('강제 상태 확인 시작, jobId:', result.jobId);
          checkStatusImmediately(result.jobId);
        }, 1000);
        
        setTimeout(() => {
          console.log('2초 후 강제 상태 확인');
          checkStatusImmediately(result.jobId);
        }, 2000);
        
        setTimeout(() => {
          console.log('5초 후 강제 상태 확인');
          checkStatusImmediately(result.jobId);
        }, 5000);
        
        setTimeout(() => {
          console.log('8초 후 강제 상태 확인');
          checkStatusImmediately(result.jobId);
        }, 8000);
        
        setTimeout(() => {
          console.log('12초 후 강제 상태 확인');
          checkStatusImmediately(result.jobId);
        }, 12000);
        
        // 즉시 첫 상태 확인 (백엔드가 이미 완료되었을 수 있음)
        setTimeout(() => {
          console.log('즉시 첫 상태 확인 시작');
          checkStatusDebounced(result.jobId);
        }, 1000); // 3초에서 1초로 단축
        
        // 추가로 3초 후에도 한 번 더 확인
        setTimeout(() => {
          console.log('3초 후 추가 상태 확인');
          checkStatusDebounced(result.jobId);
        }, 3000);
        
      } catch (err: any) {
        console.error('화질 개선 시작 실패:', err);
        console.error('오류 상세:', err.response?.data || err.message);
        if (mountedRef.current) {
          setError(err?.error || err?.message || '화질 개선 시작 실패');
          setStatus('error');
        }
      }
    };
    
    initializeEnhancement();
  }, [fileId]); // checkStatusDebounced 제거하여 무한 루프 방지

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
