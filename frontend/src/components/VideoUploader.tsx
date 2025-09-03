import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Alert,
  Button,
  Chip
} from '@mui/material';
import { CloudUpload, CheckCircle, Error } from '@mui/icons-material';
import { uploadVideo } from '../services/api';

interface UploadedFile {
  id: string;
  originalName: string;
  size: number;
  path: string;
  metadata?: any;
}

interface VideoUploaderProps {
  onUploadComplete: (file: UploadedFile) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // 파일 크기 검증 (500MB)
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        throw '파일 크기가 500MB를 초과합니다.';
      }

      // 파일 형식 검증
      const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/wmv'];
      if (!allowedTypes.includes(file.type)) {
        throw '지원하지 않는 비디오 형식입니다.';
      }

      const formData = new FormData();
      formData.append('video', file);

      const result = await uploadVideo(formData, (progress) => {
        setUploadProgress(progress);
      });

      setUploadedFile(result.file);
      onUploadComplete(result.file);
      
    } catch (err: any) {
      setError(typeof err === 'string' ? err : '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.wmv']
    },
    multiple: false,
    disabled: uploading
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          backgroundColor: isDragActive ? 'primary.50' : 'background.paper',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'primary.50'
          },
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <input {...getInputProps()} />
        
        {!uploading && !uploadedFile && (
          <>
            <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? '파일을 여기에 놓으세요' : '비디오 파일을 드래그하거나 클릭하여 업로드'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              지원 형식: MP4, AVI, MOV, MKV, WMV (최대 500MB)
            </Typography>
            <Button variant="outlined" color="primary">
              파일 선택
            </Button>
          </>
        )}

        {uploading && (
          <>
            <Typography variant="h6" gutterBottom>
              업로드 중...
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={uploadProgress} 
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              {uploadProgress}% 완료
            </Typography>
          </>
        )}

        {uploadedFile && !uploading && (
          <>
            <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom color="success.main">
              업로드 완료!
            </Typography>
            <Box sx={{ textAlign: 'left', mt: 2 }}>
              <Typography variant="body1" gutterBottom>
                <strong>파일명:</strong> {uploadedFile.originalName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>크기:</strong> {formatFileSize(uploadedFile.size)}
              </Typography>
              <Chip 
                label="업로드 성공" 
                color="success" 
                size="small" 
                sx={{ mt: 1 }}
              />
            </Box>
          </>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Error sx={{ mr: 1 }} />
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default VideoUploader;
