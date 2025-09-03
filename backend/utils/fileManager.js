const fs = require('fs').promises;
const path = require('path');
const { extractMetadata } = require('../services/videoProcessor');

// 파일 만료 시간 (24시간)
const FILE_EXPIRY_HOURS = 24;

// 세션별 파일 추적을 위한 Map
const sessionFiles = new Map();

/**
 * 세션별 파일 등록
 * @param {string} sessionId - 세션 ID
 * @param {string} filePath - 파일 경로
 * @param {string} type - 파일 타입 ('original' 또는 'enhanced')
 */
const registerSessionFile = (sessionId, filePath, type = 'original') => {
  if (!sessionFiles.has(sessionId)) {
    sessionFiles.set(sessionId, []);
  }
  
  sessionFiles.get(sessionId).push({
    path: filePath,
    type: type,
    registeredAt: Date.now()
  });
  
  console.log(`세션 파일 등록: ${sessionId} - ${path.basename(filePath)}`);
};

/**
 * 세션별 파일 삭제
 * @param {string} sessionId - 세션 ID
 * @returns {Promise<void>}
 */
const cleanupSessionFiles = async (sessionId) => {
  try {
    if (!sessionFiles.has(sessionId)) {
      return;
    }
    
    const files = sessionFiles.get(sessionId);
    console.log(`세션 파일 삭제 시작: ${sessionId} (${files.length}개 파일)`);
    
    for (const fileInfo of files) {
      try {
        await deleteFile(fileInfo.path);
        console.log(`세션 파일 삭제 완료: ${path.basename(fileInfo.path)}`);
      } catch (error) {
        console.error(`세션 파일 삭제 실패: ${path.basename(fileInfo.path)}`, error);
      }
    }
    
    sessionFiles.delete(sessionId);
    console.log(`세션 파일 정리 완료: ${sessionId}`);
  } catch (error) {
    console.error('세션 파일 정리 실패:', error);
  }
};

/**
 * 모든 세션 파일 삭제 (서버 재시작 시)
 * @returns {Promise<void>}
 */
const cleanupAllSessionFiles = async () => {
  try {
    console.log('모든 세션 파일 삭제 시작...');
    
    for (const [sessionId, files] of sessionFiles.entries()) {
      await cleanupSessionFiles(sessionId);
    }
    
    console.log('모든 세션 파일 삭제 완료');
  } catch (error) {
    console.error('모든 세션 파일 삭제 실패:', error);
  }
};

/**
 * 파일 정보 가져오기
 * @param {string} filePath - 파일 경로
 * @returns {Promise<object>} 파일 정보
 */
const getFileInfo = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const metadata = await extractMetadata(filePath);
    
    return {
      name: path.basename(filePath),
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      path: filePath,
      metadata: metadata
    };
  } catch (error) {
    console.error('파일 정보 조회 실패:', error);
    throw error;
  }
};

/**
 * 파일 저장
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} filename - 파일명
 * @param {string} directory - 저장 디렉토리
 * @returns {Promise<string>} 저장된 파일 경로
 */
const saveFile = async (buffer, filename, directory) => {
  try {
    const dirPath = path.resolve(directory);
    
    // 디렉토리가 없으면 생성
    await fs.mkdir(dirPath, { recursive: true });
    
    const filePath = path.join(dirPath, filename);
    await fs.writeFile(filePath, buffer);
    
    return filePath;
  } catch (error) {
    console.error('파일 저장 실패:', error);
    throw error;
  }
};

/**
 * 파일 이동
 * @param {string} sourcePath - 원본 경로
 * @param {string} destPath - 대상 경로
 * @returns {Promise<void>}
 */
const moveFile = async (sourcePath, destPath) => {
  try {
    const destDir = path.dirname(destPath);
    
    // 대상 디렉토리가 없으면 생성
    await fs.mkdir(destDir, { recursive: true });
    
    await fs.rename(sourcePath, destPath);
  } catch (error) {
    console.error('파일 이동 실패:', error);
    throw error;
  }
};

/**
 * 파일 삭제
 * @param {string} filePath - 파일 경로
 * @returns {Promise<void>}
 */
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`파일 삭제 완료: ${path.basename(filePath)}`);
  } catch (error) {
    console.error('파일 삭제 실패:', error);
    throw error;
  }
};

/**
 * 디렉토리 정리
 * @param {string} dirPath - 디렉토리 경로
 * @returns {Promise<void>}
 */
const cleanupDirectory = async (dirPath) => {
  try {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        await deleteFile(filePath);
      } else if (stats.isDirectory()) {
        await cleanupDirectory(filePath);
        await fs.rmdir(filePath);
      }
    }
  } catch (error) {
    console.error('디렉토리 정리 실패:', error);
    throw error;
  }
};

/**
 * 만료된 파일 정리
 * @returns {Promise<void>}
 */
const cleanupExpiredFiles = async () => {
  try {
    const uploadsDir = path.join(__dirname, '../uploads');
    const processedDir = path.join(__dirname, '../processed');
    const tempDir = path.join(__dirname, '../temp');
    
    const dirs = [uploadsDir, processedDir, tempDir];
    const expiryTime = Date.now() - (FILE_EXPIRY_HOURS * 60 * 60 * 1000);
    
    for (const dir of dirs) {
      if (!(await fs.stat(dir).catch(() => false))) continue;
      
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        
        // 파일이 만료 시간보다 오래되었으면 삭제
        if (stats.mtime.getTime() < expiryTime) {
          await deleteFile(filePath);
        }
      }
    }
    
    console.log('만료된 파일 정리 완료');
  } catch (error) {
    console.error('만료된 파일 정리 실패:', error);
  }
};

/**
 * 파일 크기 포맷팅
 * @param {number} bytes - 바이트 수
 * @returns {string} 포맷된 크기
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 디스크 사용량 확인
 * @param {string} dirPath - 디렉토리 경로
 * @returns {Promise<object>} 디스크 사용량 정보
 */
const getDiskUsage = async (dirPath) => {
  try {
    const files = await fs.readdir(dirPath);
    let totalSize = 0;
    let fileCount = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        totalSize += stats.size;
        fileCount++;
      }
    }
    
    return {
      totalSize,
      totalSizeFormatted: formatFileSize(totalSize),
      fileCount
    };
  } catch (error) {
    console.error('디스크 사용량 확인 실패:', error);
    return { totalSize: 0, totalSizeFormatted: '0 Bytes', fileCount: 0 };
  }
};

module.exports = {
  getFileInfo,
  saveFile,
  moveFile,
  deleteFile,
  cleanupDirectory,
  cleanupExpiredFiles,
  formatFileSize,
  getDiskUsage,
  registerSessionFile,
  cleanupSessionFiles,
  cleanupAllSessionFiles
};
