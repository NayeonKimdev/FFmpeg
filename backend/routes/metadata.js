const express = require('express');
const router = express.Router();
const { extractMetadata, analyzeVideoDetails } = require('../services/videoProcessor');
const { getFileInfo, formatFileSize } = require('../utils/fileManager');
const fs = require('fs');
const path = require('path');

// 비디오 메타데이터 추출 (실제 분석, 강화)
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = 'original' } = req.query; // 'original' 또는 'enhanced'
    
    console.log(`=== 메타데이터 추출 요청 ===`);
    console.log(`파일 ID: ${fileId}`);
    console.log(`타입: ${type}`);
    
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
      return res.status(404).json({ 
        error: '파일을 찾을 수 없습니다.',
        code: 'FILE_NOT_FOUND',
        fileId: fileId,
        type: type
      });
    }

    // 파일 존재 여부 확인
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return res.status(400).json({ 
        error: '파일이 비어있습니다.',
        code: 'EMPTY_FILE',
        fileId: fileId
      });
    }

    // 실제 메타데이터 추출 (강화된 오류 처리)
    let metadata;
    let analysis;
    
    try {
      console.log('메타데이터 추출 시작...');
      metadata = await extractMetadata(filePath);
      console.log('메타데이터 추출 성공');
      
      // 상세 분석도 수행
      console.log('상세 분석 시작...');
      analysis = await analyzeVideoDetails(filePath);
      console.log('상세 분석 성공');
      
    } catch (metadataError) {
      console.error('메타데이터 추출 실패:', metadataError.message);
      
      // 메타데이터 추출 실패 시 기본 정보만 사용
      metadata = {
        format: { 
          formatName: 'unknown', 
          duration: '0', 
          size: '0', 
          bitrate: '0' 
        },
        video: { 
          codec: 'unknown', 
          resolution: 'unknown', 
          fps: 0, 
          bitrate: '0', 
          duration: '0' 
        },
        audio: { 
          codec: 'unknown', 
          sampleRate: '0', 
          channels: 0, 
          bitrate: '0' 
        }
      };
      
      analysis = {
        syncIssues: {
          durationDiff: 0,
          hasSyncProblem: false,
          details: ['메타데이터 추출 실패']
        }
      };
    }
    
    // 기본 파일 정보
    const fileInfo = {
      name: path.basename(filePath),
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      path: filePath
    };
    
    console.log('=== 메타데이터 추출 완료 ===');
    console.log('파일명:', fileInfo.name);
    console.log('크기:', fileInfo.sizeFormatted);
    console.log('해상도:', metadata.video?.resolution);
    console.log('FPS:', metadata.video?.fps);
    console.log('오디오:', metadata.audio ? `${metadata.audio.codec} (${metadata.audio.channels}ch)` : '없음');
    
    res.json({
      metadata,
      analysis,
      fileInfo,
      type,
      extractedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('=== 메타데이터 추출 오류 ===');
    console.error('오류:', error.message);
    console.error('스택:', error.stack);
    
    res.status(500).json({ 
      error: '메타데이터 추출 중 오류가 발생했습니다.',
      code: 'METADATA_EXTRACTION_ERROR',
      details: error.message
    });
  }
});

// 원본과 개선된 비디오 메타데이터 비교 (강화)
router.get('/compare/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    console.log(`=== 메타데이터 비교 요청 ===`);
    console.log(`파일 ID: ${fileId}`);
    
    const originalPath = path.join(__dirname, '../uploads', fileId);
    
    // 개선된 파일명 생성
    const inputFileName = path.basename(fileId, path.extname(fileId));
    const enhancedFileName = `${inputFileName}_enhanced.mp4`;
    const enhancedPath = path.join(__dirname, '../processed', enhancedFileName);
    
    console.log(`원본 파일 경로: ${originalPath}`);
    console.log(`개선된 파일 경로: ${enhancedPath}`);
    
    const originalExists = fs.existsSync(originalPath);
    const enhancedExists = fs.existsSync(enhancedPath);
    
    console.log(`원본 파일 존재: ${originalExists}`);
    console.log(`개선된 파일 존재: ${enhancedExists}`);
    
    if (!originalExists) {
      return res.status(404).json({ 
        error: '원본 파일을 찾을 수 없습니다.',
        code: 'ORIGINAL_FILE_NOT_FOUND',
        fileId: fileId
      });
    }
    
    const comparison = {
      original: null,
      enhanced: null
    };
    
    // 원본 메타데이터 추출
    if (originalExists) {
      try {
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
        
        const originalMetadata = await extractMetadata(originalPath);
        const originalAnalysis = await analyzeVideoDetails(originalPath);
        
        comparison.original = {
          metadata: originalMetadata,
          analysis: originalAnalysis,
          fileInfo: originalFileInfo
        };
        
        console.log('원본 메타데이터 추출 성공');
      } catch (error) {
        console.error('원본 메타데이터 추출 실패:', error.message);
        comparison.original = {
          metadata: null,
          analysis: null,
          fileInfo: {
            name: path.basename(originalPath),
            size: fs.existsSync(originalPath) ? fs.statSync(originalPath).size : 0,
            path: originalPath
          }
        };
      }
    }
     
    // 개선된 메타데이터 추출
    if (enhancedExists) {
      try {
        const stats = fs.statSync(enhancedPath);
        const enhancedFileInfo = {
          name: path.basename(enhancedPath),
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          created: stats.birthtime,
          modified: stats.mtime,
          path: enhancedPath
        };
        
        console.log('개선된 파일 정보:', enhancedFileInfo);
        
        const enhancedMetadata = await extractMetadata(enhancedPath);
        const enhancedAnalysis = await analyzeVideoDetails(enhancedPath);
        
        comparison.enhanced = {
          metadata: enhancedMetadata,
          analysis: enhancedAnalysis,
          fileInfo: enhancedFileInfo
        };
        
        console.log('개선된 메타데이터 추출 성공');
      } catch (error) {
        console.error('개선된 메타데이터 추출 실패:', error.message);
        comparison.enhanced = {
          metadata: null,
          analysis: null,
          fileInfo: {
            name: path.basename(enhancedPath),
            size: fs.existsSync(enhancedPath) ? fs.statSync(enhancedPath).size : 0,
            path: enhancedPath
          }
        };
      }
    }
    
    // 개선 효과 분석 (강화)
    let improvements = null;
    if (comparison.original?.metadata && comparison.enhanced?.metadata) {
      try {
        console.log('개선 효과 분석 시작...');
        
        const original = comparison.original.metadata;
        const enhanced = comparison.enhanced.metadata;
        
        improvements = {
          fileSize: {
            original: comparison.original.fileInfo.size,
            enhanced: comparison.enhanced.fileInfo.size,
            change: comparison.enhanced.fileInfo.size - comparison.original.fileInfo.size,
            percentage: ((comparison.enhanced.fileInfo.size - comparison.original.fileInfo.size) / comparison.original.fileInfo.size * 100).toFixed(2)
          },
          resolution: {
            original: original.video?.resolution || 'unknown',
            enhanced: enhanced.video?.resolution || 'unknown',
            improved: enhanced.video?.resolution !== original.video?.resolution
          },
          fps: {
            original: original.video?.fps || 0,
            enhanced: enhanced.video?.fps || 0,
            improved: enhanced.video?.fps > original.video?.fps
          },
          bitrate: {
            original: original.video?.bitrate ? `${Math.round(Number(original.video.bitrate) / 1000)}k` : 'unknown',
            enhanced: enhanced.video?.bitrate ? `${Math.round(Number(enhanced.video.bitrate) / 1000)}k` : 'unknown'
          },
          audio: {
            original: original.audio ? `${original.audio.codec} (${original.audio.channels}ch)` : '없음',
            enhanced: enhanced.audio ? `${enhanced.audio.codec} (${enhanced.audio.channels}ch)` : '없음',
            improved: enhanced.audio?.codec === 'aac' // AAC는 더 나은 호환성
          },
          syncIssues: {
            original: comparison.original.analysis?.syncIssues || { hasSyncProblem: false },
            enhanced: comparison.enhanced.analysis?.syncIssues || { hasSyncProblem: false },
            improved: !comparison.enhanced.analysis?.syncIssues?.hasSyncProblem
          }
        };
        
        console.log('개선 효과 분석 완료:', improvements);
      } catch (improvementError) {
        console.error('개선 효과 분석 실패:', improvementError.message);
        improvements = {
          error: '개선 효과 분석 중 오류가 발생했습니다.',
          details: improvementError.message
        };
      }
    } else {
      console.log('개선 효과 분석 불가:', {
        hasOriginal: !!comparison.original?.metadata,
        hasEnhanced: !!comparison.enhanced?.metadata
      });
    }
    
    console.log('=== 메타데이터 비교 완료 ===');
    
    res.json({
      comparison,
      improvements,
      hasEnhanced: enhancedExists,
      comparedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('=== 메타데이터 비교 오류 ===');
    console.error('오류:', error.message);
    console.error('스택:', error.stack);
    
    res.status(500).json({ 
      error: '메타데이터 비교 중 오류가 발생했습니다.',
      code: 'METADATA_COMPARISON_ERROR',
      details: error.message
    });
  }
});

// 파일 목록의 메타데이터 일괄 추출
router.post('/batch', async (req, res) => {
  try {
    const { fileIds = [], type = 'original' } = req.body;
    
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ 
        error: '파일 ID 목록이 필요합니다.',
        code: 'MISSING_FILE_IDS'
      });
    }
    
    console.log(`=== 일괄 메타데이터 추출 ===`);
    console.log(`파일 수: ${fileIds.length}`);
    console.log(`타입: ${type}`);
    
    const results = [];
    
    for (const fileId of fileIds) {
      try {
        let filePath;
        if (type === 'enhanced') {
          const inputFileName = path.basename(fileId, path.extname(fileId));
          const enhancedFileName = `${inputFileName}_enhanced.mp4`;
          filePath = path.join(__dirname, '../processed', enhancedFileName);
          
          if (!fs.existsSync(filePath)) {
            filePath = path.join(__dirname, '../processed', fileId);
          }
        } else {
          filePath = path.join(__dirname, '../uploads', fileId);
        }
        
        if (fs.existsSync(filePath)) {
          const metadata = await extractMetadata(filePath);
          const analysis = await analyzeVideoDetails(filePath);
          const stats = fs.statSync(filePath);
          
          results.push({
            fileId,
            success: true,
            metadata,
            analysis,
            fileInfo: {
              size: stats.size,
              sizeFormatted: formatFileSize(stats.size),
              modified: stats.mtime
            }
          });
        } else {
          results.push({
            fileId,
            success: false,
            error: '파일을 찾을 수 없습니다.'
          });
        }
      } catch (error) {
        results.push({
          fileId,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`일괄 추출 완료: ${results.filter(r => r.success).length}/${fileIds.length} 성공`);
    
    res.json({
      results,
      summary: {
        total: fileIds.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    console.error('=== 일괄 메타데이터 추출 오류 ===');
    console.error('오류:', error.message);
    
    res.status(500).json({ 
      error: '일괄 메타데이터 추출 중 오류가 발생했습니다.',
      code: 'BATCH_EXTRACTION_ERROR',
      details: error.message
    });
  }
});

module.exports = router;
