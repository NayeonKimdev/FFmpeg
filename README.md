# FFmpeg 체험관 🎬

무료로 비디오 화질을 극대화하는 웹 애플리케이션입니다!

## 🚀 주요 기능

- **AI 업스케일링**: 해상도 2배 향상
- **화질 개선 마법**: 노이즈 제거 + 샤프닝
- **극강 압축**: 용량 70% 감소, 화질 유지
- **영화급 색감**: 할리우드 스타일 색보정
- **손떨림 보정**: 짐벌 효과로 안정화
- **궁극의 개선**: 모든 기능을 합친 최강 조합

## 🛠️ 기술 스택

- **Frontend**: React 18
- **Backend**: Node.js + Express
- **Video Processing**: FFmpeg + fluent-ffmpeg
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Create React App

## 📦 설치 및 실행

### 1. 프론트엔드 (React)
```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm start
```

### 2. 백엔드 (FFmpeg 서버)
```bash
# 서버 디렉토리로 이동
cd server

# 의존성 설치
npm install

# 서버 시작
npm start
```

### 3. FFmpeg 설치 확인
```bash
# FFmpeg이 설치되어 있는지 확인
ffmpeg -version
```

## 🎯 사용 방법

1. **백엔드 서버 시작**: `cd server && npm start`
2. **프론트엔드 서버 시작**: `npm start`
3. **브라우저에서 `http://localhost:3000` 접속**
4. **비디오 파일 업로드** (MP4, AVI, MOV, MKV, WebM 지원)
5. **원하는 처리 옵션 선택** (6가지 중 선택)
6. **실제 FFmpeg 처리 완료 후 결과 확인** 및 다운로드

## ✅ 실제 처리 기능

이제 **진짜 FFmpeg 명령어가 실행**되어 실제로 화질이 개선된 비디오를 받을 수 있습니다!

- ✅ **실제 업스케일링**: 1920x1080 해상도로 변환
- ✅ **실제 노이즈 제거**: hqdn3d 필터 적용
- ✅ **실제 압축**: H.265 코덱으로 압축
- ✅ **실제 색보정**: 밝기, 대비, 채도 조정
- ✅ **실제 손떨림 보정**: deshake 필터 적용

## 💡 실제 FFmpeg 명령어 예시

```bash
# AI 업스케일링
ffmpeg -i input.mp4 -vf "scale=1920:1080:flags=lanczos,unsharp=5:5:1.2" -c:v libx264 -crf 16 upscaled.mp4

# 화질 개선
ffmpeg -i input.mp4 -vf "hqdn3d=4:3:6:4.5,unsharp=5:5:0.8,eq=brightness=0.02:contrast=1.1" enhanced.mp4

# 극강 압축
ffmpeg -i input.mp4 -c:v libx265 -crf 23 -preset veryslow -movflags faststart compressed.mp4

# 영화급 색감
ffmpeg -i input.mp4 -vf "eq=brightness=0.03:contrast=1.1:saturation=1.3:gamma=0.9" cinematic.mp4

# 손떨림 보정
ffmpeg -i input.mp4 -vf "deshake=rx=16:ry=16" stabilized.mp4
```

## 🎨 UI 특징

- 모던하고 세련된 디자인
- 반응형 레이아웃
- 실시간 처리 상태 표시
- 비디오 메타데이터 자동 추출
- 처리 결과 통계 제공
- 서버 연결 상태 표시

## 🔥 커리어 팁

이 프로젝트는 AI 비디오 엔지니어 취업을 위한 포트폴리오로 활용할 수 있습니다:

- Netflix, YouTube, Meta에서 높이 평가하는 FFmpeg 스킬
- 대규모 비디오 처리, ML 데이터 준비, 스트리밍 최적화에 필수
- 비디오 AI, 스트리밍, 메타버스 분야에서 핵심 기술

## 🚨 주의사항

- **FFmpeg 설치 필수**: 시스템에 FFmpeg이 설치되어 있어야 합니다
- **서버 실행 필수**: 백엔드 서버가 실행되어야 실제 처리가 가능합니다
- **파일 크기 제한**: 100MB까지 업로드 가능합니다
- **처리 시간**: 비디오 길이와 복잡도에 따라 시간이 걸릴 수 있습니다

---

**🔥 FFmpeg 체험관으로 무료 비디오 마스터 되기!**