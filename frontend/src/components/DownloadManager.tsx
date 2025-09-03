import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Grid
} from '@mui/material';
import {
  Download,
  Delete,
  VideoFile,
  CheckCircle,
  Error
} from '@mui/icons-material';
import { getAvailableFiles, downloadFile, deleteFile } from '../services/api';

interface DownloadableFile {
  id: string;
  name: string;
  type: 'original' | 'enhanced';
  size: number;
  availableAt: string;
  path: string;
}

interface DownloadManagerProps {
  onFileDeleted?: (fileId: string) => void;
}

const DownloadManager: React.FC<DownloadManagerProps> = ({ onFileDeleted }) => {
  const [files, setFiles] = useState<DownloadableFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const result = await getAvailableFiles();
      setFiles(result.files);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : '파일 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: DownloadableFile) => {
    try {
      setDownloading(file.id);
      setError(null);

      await downloadFile(file.id, file.type);
      
      // 다운로드 완료 후 서버에서 파일 삭제 요청
      try {
        await deleteFile(file.id, file.type);
        setFiles(prev => prev.filter(f => f.id !== file.id));
        onFileDeleted?.(file.id);
      } catch (deleteErr) {
        console.warn('파일 삭제 실패:', deleteErr);
      }

    } catch (err: any) {
      setError(typeof err === 'string' ? err : '다운로드 실패');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (file: DownloadableFile) => {
    try {
      setDeleting(file.id);
      setError(null);

      await deleteFile(file.id, file.type);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      onFileDeleted?.(file.id);

    } catch (err: any) {
      setError(typeof err === 'string' ? err : '삭제 실패');
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>파일 목록을 불러오는 중...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Download sx={{ mr: 1 }} />
        다운로드 관리
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {files.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            다운로드 가능한 파일이 없습니다.
          </Typography>
        </Paper>
      ) : (
        <List>
          {files.map((file) => (
            <ListItem
              key={file.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                bgcolor: 'background.paper'
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <VideoFile sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="body1" sx={{ flexGrow: 1 }}>
                      {file.name}
                    </Typography>
                    <Chip
                      label={file.type === 'enhanced' ? '개선됨' : '원본'}
                      color={file.type === 'enhanced' ? 'primary' : 'default'}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      크기: {formatFileSize(file.size)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      생성일: {formatDate(file.availableAt)}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Download />}
                    onClick={() => handleDownload(file)}
                    disabled={downloading === file.id || deleting === file.id}
                    size="small"
                  >
                    {downloading === file.id ? '다운로드 중...' : '다운로드'}
                  </Button>
                  <IconButton
                    color="error"
                    onClick={() => handleDelete(file)}
                    disabled={downloading === file.id || deleting === file.id}
                    size="small"
                  >
                    <Delete />
                  </IconButton>
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {(downloading || deleting) && (
        <LinearProgress sx={{ mt: 2 }} />
      )}
    </Box>
  );
};

export default DownloadManager;
