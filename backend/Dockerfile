FROM node:18-alpine

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 애플리케이션 코드 복사
COPY . .

# 필요한 디렉토리 생성
RUN mkdir -p uploads processed temp

# 포트 노출
EXPOSE 5000

# 애플리케이션 실행
CMD ["npm", "start"]
