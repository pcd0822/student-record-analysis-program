# 생기부 분석 프로그램

생활기록부 HTML 업로드 → 영역/학년별 파싱·테이블 조회·Firebase 저장·워드 클라우드·연결관계 그래프·역량 진단까지 수행하는 웹앱입니다.

## 1단계 구현 내용

- **구글 로그인**: Firebase Auth(리다이렉트 방식). 사용 가능 계정은 Firestore **allowedUsers(UID)** 또는 **allowedEmails(이메일)** 로 승인.
- **생기부 업로드**: HTML 파일 업로드 → 파싱 → 영역/학년별·전체 테이블로 표시. **학번만 입력** (이름 미저장).
- **나이스+ 형식**: 나이스+(neisplus.kr)에서 저장한 HTML은 전용 파서로 자동 인식해, 창의적 체험활동(자율/동아리/봉사/진로)·교과 세특·학적사항 등 영역/학년/과목별로 추출합니다.
- **저장**: Firestore `records` 컬렉션에 학번을 문서 ID로 저장.
- **조회**: 학번 목록 클릭 시 해당 생기부 로우 데이터(JSON) 조회.
- **분석 대시보드**: 학번별 요약(영역별 테이블) 및 3단계 섹션(워드 클라우드, 연결 그래프, 역량 진단).

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

### Firestore 승인 사용자 (둘 중 하나만 있어도 사용 가능)

- **UID 방식**: 컬렉션 `allowedUsers` → 문서 ID = 사용자 UID (Authentication → Users에서 확인)
- **이메일 방식**: 컬렉션 `allowedEmails` → 문서 ID = 허용할 이메일 주소 (소문자 권장, 예: `user@gmail.com`)
- 문서 내용은 비어 있어도 됨. Firebase 콘솔에서 해당 컬렉션에 문서만 추가하면 됨.

### Firestore 인덱스

- `records` 컬렉션에 `uploadedAt` 필드 기준 정렬을 사용합니다. 단일 필드 정렬은 기본 인덱스로 동작합니다.

## 배포 (넷리파이)

- 빌드: `npm run build`
- API 키 등 비공개 값은 넷리파이 환경 변수로 설정 (예: `VITE_FIREBASE_*`).

## 2단계 구현 내용

- **개인정보 수정**: 업로드 후 "개인정보 수정 모드"를 켜면 내용 셀을 직접 편집할 수 있음. 수정한 뒤 분석하기를 누르면 해당 내용으로 AI 초안 생성.
- **분석하기**: Netlify Function `/.netlify/functions/analyze`에서 OpenAI(gpt-4o-mini)로 청킹·초안 작성. API 키는 **넷리파이 환경 변수** `OPENAI_API_KEY`에 설정.
- **초안 보기/수정**: 분석 후 "초안 보기"로 항목별 AI 초안 표시. 개인정보 수정 모드에서 초안 문장도 편집 가능.
- **활동 추가**: "활동 추가" 버튼으로 새 항목을 추가한 뒤 내용·초안을 채우고 저장 가능.
- **저장**: 항목별 `content`와 `draftContent`를 함께 Firestore에 저장. 조회·대시보드에서 초안 열 표시.

### 로컬에서 분석 API 테스트

분석하기는 Netlify Functions에서 동작하므로, 로컬에서 전체 플로우를 쓰려면 **Netlify CLI**로 실행하세요.

```bash
npm install -g netlify-cli
netlify dev
```

`netlify dev`가 Vite 앱과 Functions를 함께 띄우며, `/.netlify/functions/analyze`가 동작합니다.  
`.env`에 `OPENAI_API_KEY`를 넣어 두면 로컬에서도 사용됩니다. (또는 `netlify env:import .env`)

### 넷리파이 배포 시

- 사이트 설정 → Environment variables에 `OPENAI_API_KEY` 추가. (워드 클라우드 폴백·연결 그래프·역량 분석에 사용)
- 바른AI 형태소 분석을 쓰려면 `BAREUN_API_KEY` 추가 (https://api.bareun.ai 사용). 미설정 시 워드 클라우드는 OpenAI로 키워드 추출.
- 빌드 명령: `npm run build`, 배포 디렉터리: `dist`, Functions 디렉터리: `netlify/functions`.

## 3단계 구현 내용

- **섹션1 · 워드 클라우드**: 생기부 텍스트를 형태소 분석해 실질형태소만 추출해 키워드 빈도로 표시. **바른AI** API(`BAREUN_API_KEY`) 사용, 미설정 시 OpenAI로 키워드 추출.
- **섹션2 · 연결관계 그래프**: 항목 간 연관을 OpenAI로 분석해 **옵시디언 스타일** 2D 포스 그래프로 시각화. 노드 클릭 시 해당 기록·연결된 기록·연결 이유 조회. 연결 기준은 프롬프트로 입력 가능.
- **섹션3 · 역량 진단**: 생기부 기반 역량 분석(진단/점수/보완 방향). 분석 모드 선택 및 역량 분석 프롬프트 입력 가능.
- **섹션4 · 역량별 점수·보완**: 역량별 점수 수치화, 부족 역량에 대한 영역별 활동 제안(동일 competency API, mode=score / supplement).
- **자세히 보기**: 대시보드 하단에 영역별 기록 요약 테이블로 해당 생기부 기록을 함께 확인 가능.

## 다음 단계 예정

- 교과 성적 리딩·상대 등수 분석(전년도 입결 기준).
- 역량 정의·핵심 요소 자료 기반 프롬프트 매핑 강화.
