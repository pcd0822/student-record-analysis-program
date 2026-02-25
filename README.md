# 생기부 분석 프로그램

생활기록부 HTML 업로드 → 영역/학년별 파싱·테이블 조회·Firebase 저장까지 수행하는 웹앱입니다.  
(워드 클라우드, 연결관계 그래프, 역량 진단 등은 단계적으로 추가 예정)

## 1단계 구현 내용

- **구글 로그인**: Firebase Auth. 사용 가능 계정은 Firestore `allowedUsers/{uid}` 문서로 승인.
- **생기부 업로드**: HTML 파일 업로드 → 파싱 → 영역/학년별·전체 테이블로 표시. **학번만 입력** (이름 미저장).
- **저장**: Firestore `records` 컬렉션에 학번을 문서 ID로 저장.
- **조회**: 학번 목록 클릭 시 해당 생기부 로우 데이터(JSON) 조회.
- **분석 대시보드**: 학번별 요약(영역별 테이블). 추후 섹션 확장 예정.

## 실행 방법

```bash
npm install
cp .env.example .env
# .env에 Firebase 설정 값 입력
npm run dev
```

## Firebase 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성.
2. Authentication에서 **Google** 로그인 사용 설정.
3. Firestore Database 생성.
4. 프로젝트 설정 → 일반 → 앱 추가(웹) → 설정 값 복사 후 `.env`에 넣기.

### Firestore 승인 사용자

- 컬렉션: `allowedUsers`
- 문서 ID: 사용자 UID (구글 로그인 후 Firebase Auth UID)
- 해당 UID로 문서가 있으면 로그인 후 앱 사용 가능. (필드 내용은 비어 있어도 됨)

### Firestore 인덱스

- `records` 컬렉션에 `uploadedAt` 필드 기준 정렬을 사용합니다. 단일 필드 정렬은 기본 인덱스로 동작합니다.

## 배포 (넷리파이)

- 빌드: `npm run build`
- API 키 등 비공개 값은 넷리파이 환경 변수로 설정 (예: `VITE_FIREBASE_*`).

## 다음 단계 예정

- 개인정보 삭제/수정 후 **분석 시작** 버튼 → OpenAI 청킹·초안 작성.
- 워드 클라우드(바른AI 형태소 분석).
- 활동 연결관계 그래프(옵시디언 스타일).
- 역량 진단·역량별 점수·보완 방향.
- 교과 성적 리딩·상대 등수 분석.
