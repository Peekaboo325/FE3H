
/**
 * 단어의 마지막 글자 받침 유무에 따라 한국어 조사를 반환합니다.
 * @param word 대상 단어 (예: 이름)
 * @param type 조사 타입 ('i/ga': 이/가)
 * @returns '이' 또는 '가'
 */
export const getSubjectParticle = (word: string, type: 'i/ga') => {
  if (!word) return '';
  const lastChar = word.charCodeAt(word.length - 1);
  
  // 한글 유니코드 범위 (가-힣) 확인
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) {
    // 한글이 아닌 경우 기본값 '가' (또는 문맥에 따라 수정 가능)
    return type === 'i/ga' ? '가' : ''; 
  }

  // 종성(받침) 유무 확인: (유니코드 - 44032) % 28 !== 0 이면 받침 있음
  const hasBatchim = (lastChar - 44032) % 28 !== 0;
  
  if (type === 'i/ga') {
    return hasBatchim ? '이' : '가';
  }
  
  return '';
};

/**
 * [NEW] 텍스트 복사 시 시스템 코드(마크다운 헤더, 태그 등)를 정제합니다.
 * ###, <sub> 태그, ** 볼드체 마커 등을 제거하여 순수 텍스트만 남깁니다.
 */
export const cleanTextForCopy = (text: string) => {
  if (!text) return "";
  return text
    .replace(/^###\s*/gm, '')    // Remove Header Marker (### ) at start of line
    .replace(/<\/?sub>/g, '')    // Remove <sub> and </sub> tags
    .replace(/\*\*/g, '')        // Remove bold markers
    .trim();
};

/**
 * [NEW] 전체 이름에서 '퍼스트 네임(이름)'만 추출합니다.
 * 공백(띄어쓰기)을 기준으로 첫 번째 단어만 반환합니다.
 * 예) "벨레트 아이스너" -> "벨레트"
 * 예) "에델가르트 폰 흐레스벨그" -> "에델가르트"
 * 예) "세테스" -> "세테스"
 */
export const extractFirstName = (fullName: string): string => {
    if (!fullName) return "";
    return fullName.trim().split(/\s+/)[0];
};

/**
 * [NEW] 전체 이름에서 '패밀리 네임(성)'만 추출합니다.
 * 이름이 2단어 이상일 경우, 가장 마지막 단어(가문명)를 반환합니다.
 * 중간의 미들 네임이나 '폰(von)' 같은 관사는 제외됩니다.
 * 예) "페르디난트 폰 에기르" -> "에기르"
 * 예) "디미트리 알렉산드르 블레다드" -> "블레다드"
 * 예) "레아" -> ""
 */
export const extractFamilyName = (fullName: string): string => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    // 단어가 2개 미만(이름만 있는 경우)이면 빈 문자열 반환
    if (parts.length < 2) return "";
    // 가장 마지막 단어를 반환
    return parts[parts.length - 1];
};

/**
 * [NEW] 고유 ID 생성기 (Timestamp + Random)
 */
export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
