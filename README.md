# 비디오 화질 개선 애플리케이션

FFmpeg을 사용하여 비디오 화질을 개선하는 웹 애플리케이션입니다.

## 주요 기능

- 🎥 **비디오 업로드**: 드래그 앤 드롭으로 비디오 파일 업로드
- 🔧 **화질 개선**: FFmpeg을 사용한 고품질 비디오 처리
- 📊 **메타데이터 비교**: 원본과 개선된 비디오의 상세 비교
- 📥 **다운로드 관리**: 개선된 비디오 다운로드 및 관리
- 🗂️ **자동 정리**: 24시간 후 자동 파일 삭제

## 기술 스택

### Backend
- **Node.js** + **Express**
- **FFmpeg** (fluent-ffmpeg)
- **Multer** (파일 업로드)
- **CORS**, **Helmet** (보안)
- **Express Rate Limit** (요청 제한)

### Frontend
- **React** + **TypeScript**
- **Material-UI** (UI 컴포넌트)
- **React Dropzone** (파일 업로드)
- **Axios** (API 통신)

## 설치 및 실행

### 1. 저장소 클론
```bash
git clone <repository-url>
cd video-enhancement-app
```

### 2. Backend 설정
```bash
cd backend
npm install
cp env.example .env
# .env 파일에서 환경 변수 설정
npm run dev
```

### 3. Frontend 설정
```bash
cd frontend
npm install
npm start
```

### 4. Docker로 실행 (권장)
```bash
# 전체 애플리케이션 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

## 환경 변수 설정

### Backend (.env)
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=524288000
FILE_EXPIRY_HOURS=24
DEFAULT_RESOLUTION=1080p
DEFAULT_BITRATE=5000k
DEFAULT_FPS=30
DEFAULT_QUALITY=high
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 사용법

1. **비디오 업로드**: 브라우저에서 `http://localhost:3000` 접속
2. **파일 선택**: 드래그 앤 드롭 또는 클릭하여 비디오 파일 업로드
3. **화질 개선**: 업로드 완료 후 자동으로 화질 개선 시작
4. **결과 확인**: 메타데이터 비교를 통해 개선 효과 확인
5. **다운로드**: 개선된 비디오 다운로드

## 지원 파일 형식

### 입력 형식
- MP4, AVI, MOV, MKV, WMV, WebM, FLV

### 출력 형식
- MP4 (H.264 코덱)

## API 엔드포인트

### 업로드
- `POST /api/upload` - 비디오 파일 업로드
- `GET /api/upload` - 업로드된 파일 목록
- `GET /api/upload/:fileId` - 특정 파일 정보

### 화질 개선
- `POST /api/enhance` - 화질 개선 요청
- `GET /api/enhance/status/:jobId` - 작업 상태 확인
- `GET /api/enhance/list` - 개선된 파일 목록

### 메타데이터
- `GET /api/metadata/:fileId` - 파일 메타데이터
- `GET /api/metadata/compare/:fileId` - 원본/개선 비교

### 다운로드
- `GET /api/download/:fileId` - 파일 다운로드
- `DELETE /api/download/:fileId` - 파일 삭제
- `GET /api/download/list/available` - 다운로드 가능 파일 목록

## 개발 가이드

### Backend 개발
```bash
cd backend
npm run dev  # 개발 모드 (nodemon)
npm start    # 프로덕션 모드
```

### Frontend 개발
```bash
cd frontend
npm start    # 개발 서버
npm run build # 프로덕션 빌드
```

### 테스트
```bash
# Backend 테스트
cd backend
npm test

# Frontend 테스트
cd frontend
npm test
```

## 파일 구조

```
video-enhancement-app/
├── backend/
│   ├── routes/           # API 라우트
│   ├── services/         # 비즈니스 로직
│   ├── middleware/       # 미들웨어
│   ├── utils/            # 유틸리티 함수
│   ├── uploads/          # 업로드된 파일
│   ├── processed/        # 처리된 파일
│   └── temp/             # 임시 파일
├── frontend/
│   ├── src/
│   │   ├── components/   # React 컴포넌트
│   │   ├── services/     # API 서비스
│   │   └── types/        # TypeScript 타입
│   └── public/           # 정적 파일
├── shared/               # 공유 코드
└── docker-compose.yml    # Docker 설정
```

## 라이선스

MIT License

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 문제 해결

### 일반적인 문제

1. **FFmpeg 오류**: FFmpeg이 시스템에 설치되어 있는지 확인
2. **파일 업로드 실패**: 파일 크기 제한 (500MB) 확인
3. **CORS 오류**: Backend CORS 설정 확인
4. **메모리 부족**: 대용량 파일 처리 시 시스템 메모리 확인

### 로그 확인
```bash
# Backend 로그
docker-compose logs backend

# Frontend 로그
docker-compose logs frontend
```

## 업데이트 내역

- **v1.0.0**: 초기 릴리스
  - 기본 비디오 업로드 및 화질 개선 기능
  - 메타데이터 비교 기능
  - 다운로드 관리 기능
