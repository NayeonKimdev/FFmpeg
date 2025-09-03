const express = require('express');
const router = express.Router();
const { extractMetadata } = require('../services/videoProcessor');
const { getFileInfo, formatFileSize } = require('../utils/fileManager');
const fs = require('fs');
const path = require('path');

// 비디오 메타데이터 추출 (실제 분석)
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = 'original' } = req.query; // 'original' 또는 'enhanced'
    
    let filePath;
    if (type === 'enhanced') {
      // 개선된 파일의 경우 _enhanced.mp4 접미사 추가
      const inputFileName = path.basename(fileId, path.extname(fileId));
      const enhancedFileName = `${inputFileName}_enhanced.mp4`;
      filePath = path.join(__dirname, '../processed', enhancedFileName);
      
      // _enhanced.mp4 파일이 없으면 원본 파일명으로 시도
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '../processed', fileId);
      }
    } else {
      filePath = path.join(__dirname, '../uploads', fileId);
    }
    
         if (!fs.existsSync(filePath)) {
       return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
     }

     // 실제 메타데이터 추출
     let metadata;
     try {
       metadata = await extractMetadata(filePath);
     } catch (metadataError) {
       console.error('메타데이터 추출 실패:', metadataError);
       // 메타데이터 추출 실패 시 기본 정보만 사용
       metadata = {
         format: { formatName: 'unknown', duration: '0', size: '0', bitrate: '0' },
         video: { codec: 'unknown', resolution: 'unknown', fps: 0, bitrate: '0', duration: '0' },
         audio: { codec: 'unknown', sampleRate: '0', channels: 0, bitrate: '0' }
       };
     }
    
    // 기본 파일 정보
    const stats = fs.statSync(filePath);
    const fileInfo = {
      name: path.basename(filePath),
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      path: filePath
    };
    
    res.json({
      metadata,
      fileInfo,
      type
    });
  } catch (error) {
    console.error('Metadata extraction error:', error);
    res.status(500).json({ error: '메타데이터 추출 중 오류가 발생했습니다.' });
  }
});

// 원본과 개선된 비디오 메타데이터 비교 (기본 정보만)
router.get('/compare/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    console.log(`메타데이터 비교 요청: ${fileId}`);
    
    const originalPath = path.join(__dirname, '../uploads', fileId);
    const enhancedPath = path.join(__dirname, '../processed', fileId);
    
    // 개선된 파일명 생성 (원본 파일명에서 확장자 제거 후 _enhanced.mp4 추가)
    const inputFileName = path.basename(fileId, path.extname(fileId));
    const enhancedFileName = `${inputFileName}_enhanced.mp4`;
    const enhancedPathWithSuffix = path.join(__dirname, '../processed', enhancedFileName);
    
    console.log(`원본 파일 경로: ${originalPath}`);
    console.log(`개선된 파일 경로 (원본): ${enhancedPath}`);
    console.log(`개선된 파일 경로 (수정): ${enhancedPathWithSuffix}`);
    
    const originalExists = fs.existsSync(originalPath);
    const enhancedExists = fs.existsSync(enhancedPath);
    const enhancedExistsWithSuffix = fs.existsSync(enhancedPathWithSuffix);
    
    console.log(`원본 파일 존재: ${originalExists}`);
    console.log(`개선된 파일 존재 (원본): ${enhancedExists}`);
    console.log(`개선된 파일 존재 (수정): ${enhancedExistsWithSuffix}`);
    
    // 실제 존재하는 개선된 파일 경로 사용
    const finalEnhancedPath = enhancedExistsWithSuffix ? enhancedPathWithSuffix : enhancedPath;
    const finalEnhancedExists = enhancedExistsWithSuffix || enhancedExists;
    
    if (!originalExists) {
      return res.status(404).json({ error: '원본 파일을 찾을 수 없습니다.' });
    }
    
    const comparison = {
      original: null,
      enhanced: null
    };
    
    // 원본 메타데이터 (실제 분석)
    if (originalExists) {
      const stats = fs.statSync(originalPath);
      const originalFileInfo = {
        name: path.basename(originalPath),
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        created: stats.birthtime,
        modified: stats.mtime,
        path: originalPath
      };
      
      console.log('원본 파일 정보:', originalFileInfo);
      
      try {
        // 실제 메타데이터 추출
        console.log('원본 메타데이터 추출 시작...');
        const originalMetadata = await extractMetadata(originalPath);
        console.log('원본 메타데이터 추출 성공:', originalMetadata);
        
        comparison.original = {
          metadata: originalMetadata,
          fileInfo: originalFileInfo
        };
      } catch (metadataError) {
        console.error('원본 메타데이터 추출 실패:', metadataError);
        // 메타데이터 추출 실패 시 null로 설정
        comparison.original = {
          metadata: null,
          fileInfo: originalFileInfo
        };
      }
    }
     
     // 개선된 메타데이터 (실제 분석)
     if (finalEnhancedExists) {
       const stats = fs.statSync(finalEnhancedPath);
       const enhancedFileInfo = {
         name: path.basename(finalEnhancedPath),
         size: stats.size,
         sizeFormatted: formatFileSize(stats.size),
         created: stats.birthtime,
         modified: stats.mtime,
         path: finalEnhancedPath
       };
       
       console.log('개선된 파일 정보:', enhancedFileInfo);
       console.log('개선된 파일 경로:', finalEnhancedPath);
       console.log('개선된 파일 존재 여부:', fs.existsSync(finalEnhancedPath));
       
       try {
         // 실제 메타데이터 추출
         console.log('개선된 메타데이터 추출 시작...');
         const enhancedMetadata = await extractMetadata(finalEnhancedPath);
         console.log('개선된 메타데이터 추출 성공:', enhancedMetadata);
         
         comparison.enhanced = {
           metadata: enhancedMetadata,
           fileInfo: enhancedFileInfo
         };
       } catch (metadataError) {
         console.error('개선된 메타데이터 추출 실패:', metadataError);
         // 메타데이터 추출 실패 시 null로 설정
         comparison.enhanced = {
           metadata: null,
           fileInfo: enhancedFileInfo
         };
       }
     }
    
         // 개선 효과 분석
     let improvements = null;
     if (comparison.original && comparison.enhanced && comparison.original.metadata && comparison.enhanced.metadata) {
       try {
         console.log('개선 효과 분석 시작...');
         improvements = {
           fileSizeChange: {
             original: comparison.original.fileInfo.size,
             enhanced: comparison.enhanced.fileInfo.size,
             change: comparison.enhanced.fileInfo.size - comparison.original.fileInfo.size,
             percentage: ((comparison.enhanced.fileInfo.size - comparison.original.fileInfo.size) / comparison.original.fileInfo.size * 100).toFixed(2)
           },
           resolutionChange: {
             original: comparison.original.metadata.video?.resolution || 'unknown',
             enhanced: comparison.enhanced.metadata.video?.resolution || 'unknown'
           },
           bitrateChange: {
             original: comparison.original.metadata.video?.bitrate ? `${Math.round(Number(comparison.original.metadata.video.bitrate) / 1000)}k` : 'unknown',
             enhanced: comparison.enhanced.metadata.video?.bitrate ? `${Math.round(Number(comparison.enhanced.metadata.video.bitrate) / 1000)}k` : 'unknown'
           }
         };
         console.log('개선 효과 분석 완료:', improvements);
       } catch (improvementError) {
         console.error('개선 효과 분석 실패:', improvementError);
         improvements = null;
       }
     } else {
       console.log('개선 효과 분석 불가:', {
         hasOriginal: !!comparison.original,
         hasEnhanced: !!comparison.enhanced,
         hasOriginalMetadata: !!comparison.original?.metadata,
         hasEnhancedMetadata: !!comparison.enhanced?.metadata
       });
     }
    
    res.json({
      comparison,
      improvements,
      hasEnhanced: finalEnhancedExists
    });
    
    console.log('메타데이터 비교 응답:', {
      hasOriginal: !!comparison.original,
      hasEnhanced: !!comparison.enhanced,
      hasImprovements: !!improvements,
      hasEnhanced: finalEnhancedExists
    });
  } catch (error) {
    console.error('Metadata comparison error:', error);
    res.status(500).json({ error: '메타데이터 비교 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
