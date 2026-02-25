/** 생기부 한 항목 (영역/학년/과목 등에 해당하는 기록 단위) */
export interface RecordItem {
  /** 영역 예: 창의적 체험활동, 교과성적 */
  area: string;
  /** 세부 구분 예: 학년, 과목명, 활동명 */
  subCategory?: string;
  /** 학년 (1,2,3 또는 없음) */
  grade?: number;
  /** 원본 라벨/제목 (테이블 헤더 등) */
  label?: string;
  /** 기록 내용 */
  content: string;
  /** 원본 HTML에서의 순서/위치 식별용 */
  order?: number;
}

/** 업로드 후 파싱된 생기부 데이터 (학번과 함께 저장) */
export interface ParsedRecord {
  studentId: string;
  items: RecordItem[];
  uploadedAt: string; // ISO
  /** 개인정보 삭제/수정 후 분석용 복사본 (나중에 사용) */
  sanitizedItems?: RecordItem[];
}

/** Firestore 저장용: 학번별 메타 + 파싱 데이터 */
export interface StudentRecordDoc {
  studentId: string;
  uploadedAt: string;
  items: RecordItem[];
  createdAt: string;
  updatedAt: string;
  createdBy: string; // uid
}
