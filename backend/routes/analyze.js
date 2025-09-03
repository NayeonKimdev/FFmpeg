const express = require('express');
const router = express.Router();
const { analyzeVideoDetails } = require('../services/videoProcessor');
const path = require('path');

/**
 * 상세한 비디오 분석
 */
router.get('/analyze/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type = 'original' } = req.query;
    
    let filePath;
    if (type === 'enhanced') {
      // 파일명에서 확장자를 제거하고 _enhanced.mp4 추가
      const baseName = fileId.replace(/\.[^/.]+$/, ''); // 확장자 제거
      filePath = path.join(__dirname, '../processed', `${baseName}_enhanced.mp4`);
    } else {
      filePath = path.join(__dirname, '../uploads', fileId);
    }

    console.log(`상세 분석 요청: ${filePath}`);
    console.log(`파일 존재 여부: ${require('fs').existsSync(filePath)}`);
    
    const analysis = await analyzeVideoDetails(filePath);
    
    res.json({
      success: true,
      analysis: analysis,
      type: type
    });

  } catch (error) {
    console.error('상세 분석 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
