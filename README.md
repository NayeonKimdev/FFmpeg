# 비디오 화질 개선 애플리케이션

FFmpeg을 사용하여 비디오 화질을 개선하는 웹 애플리케이션입니다. 오디오 처리 개선, 안정적인 비트레이트 최적화, 강화된 오류 처리를 포함합니다.

## 주요 기능

- 🎥 **비디오 업로드**: 드래그 앤 드롭으로 비디오 파일 업로드
- 🔧 **스마트 화질 개선**: FFmpeg을 사용한 고품질 비디오 처리
- 🔊 **오디오 처리 개선**: AAC 코덱 호환성 보장 및 안전한 재인코딩
- ⚡ **비트레이트 최적화**: CRF + Maxrate 조합으로 품질과 파일 크기 동시 제어
- 📊 **상세 메타데이터 분석**: 원본과 개선된 비디오의 상세 비교
- 🛡️ **강화된 오류 처리**: 타임아웃, 파일 검증, 상세한 로깅
- 📥 **다운로드 관리**: 개선된 비디오 다운로드 및 관리
- 🗂️ **자동 정리**: 24시간 후 자동 파일 삭제

## 개선된 기능

### 🔧 오디오 처리 개선
- **AAC 코덱 호환성**: MP4와 완벽 호환되는 AAC 코덱 사용
- **스마트 재인코딩**: AAC는 복사, 다른 코덱은 AAC로 안전하게 재인코딩
- **고정된 오디오 설정**: 128kbps, 44.1kHz, 스테레오로 표준화

### ⚡ 비트레이트 및 품질 최적화
- **안전한 비트레이트**: 원본의 1.2배로 안정성 확보
- **CRF + Maxrate 조합**: 품질과 파일 크기를 동시에 제어
- **GOP 크기 최적화**: 최대 2초, 60프레임 제한으로 안정성 확보

### 🛡️ 오류 처리 강화
- **상세한 메타데이터 분석**: 입력 파일의 코덱, 길이 등 사전 분석
- **출력 파일 검증**: 생성된 파일의 유효성 확인
- **타임아웃 설정**: 30분 초과 시 자동 종료
- **더 나은 로깅**: 진행 상황과 오류를 자세히 기록

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
cd video-demo
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
DEFAULT_QUALITY=high
DEFAULT_CODEC=h264
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 사용법

1. **비디오 업로드**: 브라우저에서 `http://localhost:3000` 접속
2. **파일 선택**: 드래그 앤 드롭 또는 클릭하여 비디오 파일 업로드
3. **화질 개선**: 업로드 완료 후 자동으로 화질 개선 시작
4. **진행 상황 모니터링**: 실시간 진행률 및 상세 정보 확인
5. **결과 확인**: 메타데이터 비교를 통해 개선 효과 확인
6. **다운로드**: 개선된 비디오 다운로드

## 지원 파일 형식

### 입력 형식
- MP4, AVI, MOV, MKV, WMV, WebM, FLV

### 출력 형식
- MP4 (H.264 코덱, AAC 오디오)

## API 엔드포인트

### 업로드
- `POST /api/upload` - 비디오 파일 업로드
- `GET /api/upload` - 업로드된 파일 목록
- `GET /api/upload/:fileId` - 특정 파일 정보

### 화질 개선
- `POST /api/enhance` - 화질 개선 요청
- `GET /api/enhance/status/:jobId` - 작업 상태 확인
- `GET /api/enhance/list` - 개선된 파일 목록
- `DELETE /api/enhance/cancel/:jobId` - 작업 취소

### 메타데이터
- `GET /api/metadata/:fileId` - 파일 메타데이터 및 상세 분석
- `GET /api/metadata/compare/:fileId` - 원본/개선 비교
- `POST /api/metadata/batch` - 일괄 메타데이터 추출

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
video-demo/
├── backend/
│   ├── routes/           # API 라우트
│   │   ├── enhance.js    # 화질 개선 API
│   │   ├── metadata.js   # 메타데이터 API
│   │   ├── upload.js     # 업로드 API
│   │   └── download.js   # 다운로드 API
│   ├── services/         # 비즈니스 로직
│   │   └── videoProcessor.js  # 비디오 처리 로직
│   ├── middleware/       # 미들웨어
│   ├── utils/            # 유틸리티 함수
│   ├── uploads/          # 업로드된 파일
│   ├── processed/        # 처리된 파일
│   └── temp/             # 임시 파일
├── frontend/
│   ├── src/
│   │   ├── components/   # React 컴포넌트
│   │   │   ├── VideoUploader.tsx
│   │   │   ├── EnhancementProgress.tsx
│   │   │   ├── MetadataComparison.tsx
│   │   │   └── DownloadManager.tsx
│   │   ├── services/     # API 서비스
│   │   │   └── api.ts
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
5. **오디오 문제**: AAC 코덱 호환성 문제 해결됨

### 로그 확인
```bash
# Backend 로그
docker-compose logs backend

# Frontend 로그
docker-compose logs frontend
```

### 성능 최적화

1. **비트레이트 설정**: 원본의 1.2배로 안전하게 설정
2. **GOP 크기**: 최대 2초, 60프레임으로 제한
3. **오디오 품질**: 128kbps AAC로 표준화
4. **타임아웃**: 30분으로 설정하여 무한 대기 방지

## 업데이트 내역

- **v2.0.0**: 오디오 처리 개선 및 안정성 강화
  - AAC 코덱 호환성 보장
  - 비트레이트 최적화 (1.2배)
  - 강화된 오류 처리 및 로깅
  - 상세한 메타데이터 분석
  - 작업 취소 기능
  - 일괄 메타데이터 처리

- **v1.0.0**: 초기 릴리스
  - 기본 비디오 업로드 및 화질 개선 기능
  - 메타데이터 비교 기능
  - 다운로드 관리 기능
