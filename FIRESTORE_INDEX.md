# Firestore 복합 인덱스 생성 방법

저장 후 **조회** 시 "The query requires an index" 오류가 나면, 아래 방법 중 하나로 인덱스를 생성하세요.

---

## 수동 입력 시 넣을 값 (컬렉션 ID · 필드 경로)

콘솔에서 **컬렉션 ID**와 **필드 경로**를 직접 입력하라는 화면이 나오면 아래 값을 그대로 넣으세요.

| 항목 | 입력 값 |
|------|---------|
| **컬렉션 ID** | `records` |
| **필드 1** | 필드 경로: `createdBy` / 정렬: **오름차순(Ascending)** |
| **필드 2** | 필드 경로: `uploadedAt` / 정렬: **내림차순(Descending)** |

- 컬렉션 ID는 **records** 한 단어만 입력합니다.
- 필드는 반드시 **두 개** 모두 추가하고, 순서와 정렬 방향을 위와 같이 맞춥니다.

---

## 방법 1: Firebase 콘솔 링크로 생성 (가장 간단)

1. 오류 메시지에 나온 **생성 링크**를 클릭합니다.  
   (예: `https://console.firebase.google.com/v1/r/project/student-record-analysis/firestore/indexes?create_composite=...`)
2. 브라우저에서 Firebase Console이 열리면, **인덱스 설정이 이미 채워진 상태**로 나옵니다.
3. **「인덱스 만들기」** 또는 **「Create index」** 버튼을 클릭합니다.
4. 인덱스가 **빌드 중**으로 바뀌었다가(보통 1~2분) **사용 설정**으로 바뀌면 완료입니다.
5. 앱에서 **조회** 화면을 새로고침한 뒤 다시 시도합니다.

---

## 방법 2: Firebase CLI로 배포

프로젝트 루트에 `firebase.json`과 `firestore.indexes.json`이 있으면, CLI로 한 번에 배포할 수 있습니다.

1. **Firebase CLI 설치** (미설치 시)
   ```bash
   npm install -g firebase-tools
   ```

2. **로그인 및 프로젝트 선택**
   ```bash
   firebase login
   firebase use student-record-analysis
   ```
   (프로젝트 ID가 다르면 본인 프로젝트 ID로 바꾸세요.)

3. **인덱스만 배포**  
   프로젝트의 `firestore.indexes.json`에 이미 **컬렉션 ID `records`**, **필드 `createdBy`(오름차순)·`uploadedAt`(내림차순)** 이 정의되어 있습니다.
   ```bash
   firebase deploy --only firestore:indexes
   ```

4. 터미널에 인덱스가 생성되었다는 메시지가 나오면, 1~2분 정도 기다린 뒤 앱에서 **조회**를 다시 시도합니다.

---

## 방법 3: Firebase 콘솔에서 수동으로 만들기

1. [Firebase Console](https://console.firebase.google.com) → 프로젝트 **student-record-analysis** 선택.
2. 왼쪽 메뉴 **Firestore Database** → 상단 **인덱스** 탭 클릭.
3. **복합 인덱스**에서 **인덱스 만들기** 클릭.
4. 아래처럼 입력 후 **만들기** 클릭.
   - **컬렉션 ID**: `records`
   - **필드 1**: 필드 경로 `createdBy`, 정렬 **오름차순**
   - **필드 2**: **필드 추가** 후 필드 경로 `uploadedAt`, 정렬 **내림차순**
5. 1~2분 후 인덱스가 사용 설정되면 앱 **조회**를 다시 시도합니다.

---

## 인덱스가 필요한 이유

조회 목록은 **`createdBy`(본인) + `uploadedAt`(최신순)** 조건으로 가져옵니다.  
Firestore는 이런 **복합 조건**을 쓰려면 **복합 인덱스**를 미리 만들어 두어야 하며, 한 번만 생성해 두면 계속 사용할 수 있습니다.
