import axios, { AxiosResponse, AxiosError } from 'axios';

// API 기본 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// API 재시도 로직
const createApiWithRetry = () => {
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
    async (error: AxiosError) => {
      const config = error.config as any;
      
      // 재시도 횟수 설정
      if (!config.retry) config.retry = 0;
      const maxRetries = 3;
      
      // 429 에러 (Too Many Requests) 처리
      if (error.response?.status === 429 && config.retry < maxRetries) {
        config.retry += 1;
        
        // 지수 백오프 (2초, 4초, 8초)
        const delay = Math.pow(2, config.retry) * 1000;
        console.log(`Rate limit 도달. ${delay}ms 후 재시도 (${config.retry}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return api.request(config);
      }
      
      // 네트워크 오류 등 일시적 오류 재시도
      if (
        (error.code === 'NETWORK_ERROR' || 
         error.response?.status === 500 ||
         error.response?.status === 502 ||
         error.response?.status === 503) &&
        config.retry < maxRetries
      ) {
        config.retry += 1;
        
        const delay = 2000 + (config.retry * 1000); // 2초, 3초, 4초
        console.log(`네트워크 오류 재시도: ${delay}ms 후 (${config.retry}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return api.request(config);
      }
      
      console.error('API 오류 (재시도 불가):', error.response?.data || error.message);
      return Promise.reject(error);
    }
  );

  return api;
};

const api = createApiWithRetry();

// 요청 큐 관리 (동시 요청 제한)
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent = 3; // 최대 3개 동시 요청

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.running++;
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });
      
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    const nextRequest = this.queue.shift();
    if (nextRequest) {
      nextRequest();
    }
  }
}

const requestQueue = new RequestQueue();

// 캐싱 추가
class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number; expiry: number }>();

  set(key: string, data: any, expiryMs: number = 60000) { // 기본 1분 캐시
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: expiryMs
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clear() {
    this.cache.clear();
  }
}

const apiCache = new ApiCache();

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
  quality?: string;
  codec?: string;
}

export interface EnhancementResult {
  jobId: string;
  message: string;
  options: EnhancementOptions;
  estimatedTime?: string;
}

export interface EnhancementStatus {
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  file?: any;
  message?: string;
  error?: string;
  lastModified?: string;
  metadata?: any;
  analysis?: any;
  estimatedTime?: string;
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
  } | null;
  audio: {
    codec: string;
    sampleRate: string;
    channels: number;
    bitrate: string;
  } | null;
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

export interface ComparisonData {
  comparison: {
  original: {
      metadata: {
        format: {
          duration: string;
          size: number;
          bitrate: number;
        };
        video: {
          codec: string;
          resolution: string;
          fps: number;
          bitrate: number;
        };
        audio: {
          codec: string;
          sampleRate: number;
          channels: number;
          bitrate: number;
        };
      };
      analysis: {
        syncIssues: {
          durationDiff: number;
          hasSyncProblem: boolean;
          details: any[];
        };
      };
      fileInfo: {
        name: string;
        size: number;
        sizeFormatted: string;
      };
  };
  enhanced: {
      metadata: {
        format: {
          duration: string;
          size: number;
          bitrate: number;
        };
        video: {
          codec: string;
          resolution: string;
          fps: number;
          bitrate: number;
        };
        audio: {
          codec: string;
          sampleRate: number;
          channels: number;
          bitrate: number;
        };
      };
      analysis: {
        syncIssues: {
          durationDiff: number;
          hasSyncProblem: boolean;
          details: any[];
        };
      };
      fileInfo: {
        name: string;
        size: number;
        sizeFormatted: string;
      };
    };
  };
  improvements: {
    fileSize: {
      original: number;
      enhanced: number;
      change: number;
      percentage: string;
    };
    resolution: {
      original: string;
      enhanced: string;
      improved: boolean;
    };
    fps: {
      original: number;
      enhanced: number;
      improved: boolean;
    };
    bitrate: {
      original: string;
      enhanced: string;
    };
    audio: {
      original: string;
      enhanced: string;
      improved: boolean;
    };
    syncIssues: {
      original: {
        durationDiff: number;
        hasSyncProblem: boolean;
        details: any[];
      };
      enhanced: {
        durationDiff: number;
        hasSyncProblem: boolean;
        details: any[];
      };
    };
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

export interface BatchMetadataResult {
  fileId: string;
  success: boolean;
  metadata?: Metadata;
  analysis?: VideoAnalysis;
  fileInfo?: any;
  error?: string;
}

export interface BatchMetadataResponse {
  results: BatchMetadataResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// 파일 업로드
export const uploadVideo = async (
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<{ file: UploadedFile }> => {
  return requestQueue.add(async () => {
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
  });
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
  return requestQueue.add(async () => {
    const response: AxiosResponse<EnhancementResult> = await api.post('/enhance', {
      fileId,
      enhancementOptions: options,
    });
    return response.data;
  });
};

// 개선 작업 상태 조회
export const getEnhancementStatus = async (jobId: string): Promise<EnhancementStatus> => {
  return requestQueue.add(async () => {
    const response: AxiosResponse<EnhancementStatus> = await api.get(`/enhance/status/${jobId}`);
    return response.data;
  });
};

// 개선 작업 취소
export const cancelEnhancement = async (jobId: string): Promise<{ message: string }> => {
  const response: AxiosResponse<{ message: string }> = await api.delete(`/enhance/cancel/${jobId}`);
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
): Promise<{ metadata: Metadata; analysis: VideoAnalysis; fileInfo: any; type: string; extractedAt: string }> => {
  return requestQueue.add(async () => {
    const response: AxiosResponse<{ metadata: Metadata; analysis: VideoAnalysis; fileInfo: any; type: string; extractedAt: string }> = await api.get(
      `/metadata/${fileId}?type=${type}`
    );
    return response.data;
  });
};

// 메타데이터 비교
export const compareMetadata = async (fileId: string): Promise<ComparisonData> => {
  return requestQueue.add(async () => {
    const response: AxiosResponse<ComparisonData> = await api.get(`/metadata/compare/${fileId}`);
    return response.data;
  });
};

// 일괄 메타데이터 추출
export const batchExtractMetadata = async (
  fileIds: string[],
  type: 'original' | 'enhanced' = 'original'
): Promise<BatchMetadataResponse> => {
  const response: AxiosResponse<BatchMetadataResponse> = await api.post('/metadata/batch', {
    fileIds,
    type
  });
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
  return requestQueue.add(async () => {
    const response = await api.get(`/download/${fileId}?type=${type}`, {
      responseType: 'blob',
    });

    // 다운로드 링크 생성
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileId}_${type}.mp4`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
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
  return requestQueue.add(async () => {
    try {
      const response: AxiosResponse<{ success: boolean; analysis: VideoAnalysis; type: string }> = await api.get(`/analyze/analyze/${fileId}?type=${type}`);
      return response.data.analysis;
    } catch (error) {
      console.error('비디오 분석 오류:', error);
      throw new Error('비디오 분석에 실패했습니다.');
    }
  });
};

export default api;
