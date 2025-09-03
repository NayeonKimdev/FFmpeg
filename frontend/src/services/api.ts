import axios, { AxiosResponse } from 'axios';

// API 기본 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5분 (대용량 파일 업로드용)
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    console.log('API 요청:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API 오류:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// 타입 정의
export interface UploadedFile {
  id: string;
  originalName: string;
  size: number;
  path: string;
  metadata?: any;
}

export interface EnhancementOptions {
  resolution?: string;
  bitrate?: string;
  fps?: number;
  codec?: string;
  quality?: string;
}

export interface EnhancementResult {
  jobId: string;
  message: string;
  options: EnhancementOptions;
}

export interface EnhancementStatus {
  status: 'processing' | 'completed';
  progress?: number;
  file?: any;
  message?: string;
}

export interface Metadata {
  format: {
    formatName: string;
    duration: string;
    size: string;
    bitrate: string;
  };
  video: {
    codec: string;
    resolution: string;
    fps: number;
    bitrate: string;
    duration: string;
  };
  audio: {
    codec: string;
    sampleRate: string;
    channels: number;
    bitrate: string;
  };
}

export interface ComparisonData {
  original: {
    metadata: Metadata;
    fileInfo: any;
  } | null;
  enhanced: {
    metadata: Metadata;
    fileInfo: any;
  } | null;
  improvements: {
    fileSizeChange: {
      original: number;
      enhanced: number;
      change: number;
      percentage: string;
    };
    resolutionChange: {
      original: string;
      enhanced: string;
    };
    bitrateChange: {
      original: string;
      enhanced: string;
    };
  } | null;
  hasEnhanced: boolean;
}

export interface VideoAnalysis {
  filePath: string;
  fileName: string;
  format: {
    formatName: string;
    duration: number;
    size: number;
    bitrate: number;
  };
  video: {
    codec: string;
    resolution: string;
    fps: {
      r_frame_rate: string;
      avg_frame_rate: string;
      calculated: number;
    };
    bitrate: number;
    duration: number;
    time_base: string;
    start_time: number;
  } | null;
  audio: {
    codec: string;
    sampleRate: number;
    channels: number;
    bitrate: number;
    duration: number;
    time_base: string;
    start_time: number;
  } | null;
  syncIssues: {
    durationDiff: number;
    hasSyncProblem: boolean;
    details: string[];
  };
}

export interface DownloadableFile {
  id: string;
  name: string;
  type: 'original' | 'enhanced';
  size: number;
  availableAt: string;
  path: string;
}

// 파일 업로드
export const uploadVideo = async (
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<{ file: UploadedFile }> => {
  const response: AxiosResponse<{ file: UploadedFile }> = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
  return response.data;
};

// 업로드된 파일 목록 조회
export const getUploadedFiles = async (): Promise<{ files: UploadedFile[] }> => {
  const response: AxiosResponse<{ files: UploadedFile[] }> = await api.get('/upload');
  return response.data;
};

// 특정 파일 정보 조회
export const getFileInfo = async (fileId: string): Promise<{ file: UploadedFile }> => {
  const response: AxiosResponse<{ file: UploadedFile }> = await api.get(`/upload/${fileId}`);
  return response.data;
};

// 비디오 화질 개선 요청
export const enhanceVideo = async (
  fileId: string,
  options: EnhancementOptions = {}
): Promise<EnhancementResult> => {
  const response: AxiosResponse<EnhancementResult> = await api.post('/enhance', {
    fileId,
    enhancementOptions: options,
  });
  return response.data;
};

// 개선 작업 상태 조회
export const getEnhancementStatus = async (jobId: string): Promise<EnhancementStatus> => {
  const response: AxiosResponse<EnhancementStatus> = await api.get(`/enhance/status/${jobId}`);
  return response.data;
};

// 개선된 파일 목록 조회
export const getEnhancedFiles = async (): Promise<{ files: any[] }> => {
  const response: AxiosResponse<{ files: any[] }> = await api.get('/enhance/list');
  return response.data;
};

// 메타데이터 조회
export const getMetadata = async (
  fileId: string,
  type: 'original' | 'enhanced' = 'original'
): Promise<{ metadata: Metadata; fileInfo: any; type: string }> => {
  const response: AxiosResponse<{ metadata: Metadata; fileInfo: any; type: string }> = await api.get(
    `/metadata/${fileId}?type=${type}`
  );
  return response.data;
};

// 메타데이터 비교
export const compareMetadata = async (fileId: string): Promise<ComparisonData> => {
  const response: AxiosResponse<ComparisonData> = await api.get(`/metadata/compare/${fileId}`);
  return response.data;
};

// 다운로드 가능한 파일 목록
export const getAvailableFiles = async (): Promise<{ files: DownloadableFile[] }> => {
  const response: AxiosResponse<{ files: DownloadableFile[] }> = await api.get('/download/list/available');
  return response.data;
};

// 비디오 스트리밍 URL 생성 (미리보기용)
export const getVideoStreamUrl = (fileId: string, type: 'original' | 'enhanced' = 'enhanced'): string => {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  if (type === 'original') {
    return `${baseUrl}/uploads/${fileId}`;
  } else {
    // 개선된 파일의 경우 _enhanced.mp4 접미사 추가
    const inputFileName = fileId.replace(/\.[^/.]+$/, ''); // 확장자 제거
    const enhancedFileName = `${inputFileName}_enhanced.mp4`;
    return `${baseUrl}/processed/${enhancedFileName}`;
  }
};

// 파일 다운로드
export const downloadFile = async (fileId: string, type: 'original' | 'enhanced' = 'enhanced'): Promise<void> => {
  const response = await api.get(`/download/${fileId}?type=${type}`, {
    responseType: 'blob',
  });

  // 다운로드 링크 생성
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileId);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// 파일 삭제
export const deleteFile = async (fileId: string, type: 'original' | 'enhanced' = 'enhanced'): Promise<void> => {
  await api.delete(`/download/${fileId}?type=${type}`);
};

// 서버 상태 확인
export const checkServerHealth = async (): Promise<{ status: string; timestamp: string; uptime: number }> => {
  const response: AxiosResponse<{ status: string; timestamp: string; uptime: number }> = await api.get('/health');
  return response.data;
};

// 비디오 분석 API
export const analyzeVideo = async (fileId: string, type: 'original' | 'enhanced' = 'original'): Promise<VideoAnalysis> => {
  try {
    const response: AxiosResponse<{ success: boolean; analysis: VideoAnalysis; type: string }> = await api.get(`/analyze/analyze/${fileId}?type=${type}`);
    return response.data.analysis;
  } catch (error) {
    console.error('비디오 분석 오류:', error);
    throw new Error('비디오 분석에 실패했습니다.');
  }
};

export default api;
