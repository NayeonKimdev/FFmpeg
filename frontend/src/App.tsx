import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Paper,
  AppBar,
  Toolbar,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Alert
} from '@mui/material';
import { VideoLibrary, Settings, Download } from '@mui/icons-material';
import VideoUploader from './components/VideoUploader';
import EnhancementProgress from './components/EnhancementProgress';
import MetadataComparison from './components/MetadataComparison';
import DownloadManager from './components/DownloadManager';
import { UploadedFile } from './services/api';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const steps = [
  { label: '비디오 업로드', icon: <VideoLibrary /> },
  { label: '화질 개선', icon: <Settings /> },
  { label: '메타데이터 비교', icon: <VideoLibrary /> },
  { label: '다운로드', icon: <Download /> },
];

function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [enhancedFile, setEnhancedFile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [enhancementCompleted, setEnhancementCompleted] = useState(false);

  const handleUploadComplete = (file: UploadedFile) => {
    try {
      setUploadedFile(file);
      setActiveStep(1); // 화질 개선 단계로 이동
      setError(null);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : '업로드 완료 처리 중 오류가 발생했습니다.');
    }
  };

  const handleEnhancementComplete = (result: any) => {
    try {
      setEnhancedFile(result);
      setEnhancementCompleted(true);
      setActiveStep(2); // 메타데이터 비교 단계로 이동
      setError(null);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : '화질 개선 완료 처리 중 오류가 발생했습니다.');
    }
  };

  const handleEnhancementCancel = () => {
    try {
      setActiveStep(0); // 업로드 단계로 돌아가기
      setEnhancedFile(null); // 개선된 파일 정보 초기화
      setEnhancementCompleted(false); // 완료 상태 초기화
      setError(null);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : '화질 개선 취소 처리 중 오류가 발생했습니다.');
    }
  };

  const handleFileDeleted = (fileId: string) => {
    try {
      if (uploadedFile?.id === fileId) {
        setUploadedFile(null);
      }
      if (enhancedFile?.id === fileId) {
        setEnhancedFile(null);
      }
      setError(null);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : '파일 삭제 처리 중 오류가 발생했습니다.');
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <VideoUploader
            onUploadComplete={handleUploadComplete}
          />
        );
      case 1:
        return uploadedFile ? (
          <EnhancementProgress
            fileId={uploadedFile.id}
            onEnhancementComplete={handleEnhancementComplete}
            onCancel={handleEnhancementCancel}
          />
        ) : (
          <Typography>업로드된 파일이 없습니다.</Typography>
        );
      case 2:
        return uploadedFile && enhancedFile && enhancementCompleted ? (
          <MetadataComparison fileId={uploadedFile.id} />
        ) : (
          <Typography>화질 개선을 먼저 완료해주세요.</Typography>
        );
      case 3:
        return (
          <DownloadManager onFileDeleted={handleFileDeleted} />
        );
      default:
        return <Typography>알 수 없는 단계입니다.</Typography>;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <VideoLibrary sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              비디오 화질 개선 애플리케이션
            </Typography>
          </Toolbar>
        </AppBar>
      </Box>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((step, index) => (
              <Step key={step.label} disabled={index > activeStep}>
                <StepLabel icon={step.icon}>
                  {step.label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        <Box sx={{ mt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {getStepContent(activeStep)}
        </Box>

        {activeStep < steps.length - 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              단계 {activeStep + 1} / {steps.length}
            </Typography>
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
