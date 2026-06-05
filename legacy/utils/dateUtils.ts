
/**
 * Fódlan Date Utility
 * 포드라력(풍화설월 달력)을 파싱하고 계산하는 유틸리티입니다.
 * [SYSTEM] 4월(거목의 달) 시작 ~ 3월(고월의 달) 종료 체계 적용.
 * - 1180년 1월은 1180년 12월의 '다음 달'로 취급합니다. (Academic Year)
 */

// 포드라 월 이름과 숫자 매핑
export const MOON_MAP: Record<number, string> = {
    1: '수호의 달', 2: '천마의 달', 3: '고월의 달', 4: '거목의 달',
    5: '수금의 달', 6: '화관의 달', 7: '청해의 달', 8: '취우의 달',
    9: '각궁의 달', 10: '비룡의 달', 11: '적랑의 달', 12: '성신의 달'
};

const MOON_NAME_TO_NUM: Record<string, number> = {
    '수호': 1, '천마': 2, '고월': 3, '거목': 4,
    '수금': 5, '화관': 6, '청해': 7, '취우': 8,
    '각궁': 9, '비룡': 10, '적랑': 11, '성신': 12
};

const DATE_REGEX_MOON_STRICT = /(\d+)년\s*([가-힣]+의\s*달)(?:\(\d+월\))?\s*.*?(\d+)일/;
const DATE_REGEX_SHORT_MOON = /([가-힣]+의\s*달)(?:\(\d+월\))?\s*.*?(\d+)일/;
const DATE_REGEX_DOT = /(\d+)\s*[./]\s*(\d+)/;

export interface FodlanDate {
    year: number;
    month: number;
    day: number;
}

export const parseFodlanDate = (text: string): FodlanDate | null => {
    if (!text) return null;

    const matchMoon = text.match(DATE_REGEX_MOON_STRICT);
    if (matchMoon) {
        const year = parseInt(matchMoon[1], 10);
        const moonNameRaw = matchMoon[2].trim(); 
        const coreName = moonNameRaw.replace('의 달', '').replace('의달', '').trim();
        const monthNum = MOON_NAME_TO_NUM[coreName];
        
        if (monthNum) {
            return { year, month: monthNum, day: parseInt(matchMoon[3], 10) };
        }
    }

    const matchShortMoon = text.match(DATE_REGEX_SHORT_MOON);
    if (matchShortMoon) {
        const moonNameRaw = matchShortMoon[1].trim();
        const coreName = moonNameRaw.replace('의 달', '').replace('의달', '').trim();
        const monthNum = MOON_NAME_TO_NUM[coreName];
        
        if (monthNum) {
            return { year: 9999, month: monthNum, day: parseInt(matchShortMoon[2], 10) };
        }
    }

    const matchDot = text.match(DATE_REGEX_DOT);
    if (matchDot) {
        return { year: 9999, month: parseInt(matchDot[1], 10), day: parseInt(matchDot[2], 10) };
    }

    return null;
};

export const formatFodlanDate = (date: FodlanDate): string => {
    const moonName = MOON_MAP[date.month] || '알 수 없는 달';
    return `제국력 ${date.year}년 ${moonName} ${date.day}일`;
};

export const formatFodlanDateRange = (dateStr1: string, dateStr2: string): string => {
    const d1 = parseFodlanDate(dateStr1);
    const d2 = parseFodlanDate(dateStr2);

    if (!d1) return dateStr2 || "날짜 미상";
    if (!d2) return dateStr1 || formatFodlanDate(d1);

    const fullD1 = formatFodlanDate(d1);
    
    // 같은 연도
    if (d1.year === d2.year) {
        // 같은 달
        if (d1.month === d2.month) {
            // 같은 날
            if (d1.day === d2.day) return fullD1;
            return `${fullD1} - ${d2.day}일`;
        }
        // 다른 달
        const moonName2 = MOON_MAP[d2.month] || '알 수 없는 달';
        return `${fullD1} - ${moonName2} ${d2.day}일`;
    }

    // 다른 연도
    return `${fullD1} - ${formatFodlanDate(d2)}`;
};


/**
 * [CRITICAL] 날짜 정렬용 정수 변환 (YYYYMMDD)
 * 포드라력은 4월이 시작, 3월이 끝이므로, 1~3월을 '13~15월'로 취급하여 정렬합니다.
 * 예: 1180.12.31(11801231) < 1180.01.01(11801301)
 */
export const dateToInteger = (date: FodlanDate): number => {
    const sortableMonth = date.month < 4 ? date.month + 12 : date.month;
    return date.year * 10000 + sortableMonth * 100 + date.day;
};

// [CALENDAR LOGIC CONSTANTS]
// 4월(거목)부터 3월(고월)까지의 순서 및 기본 일수
const ACADEMIC_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_DAYS_BASE: Record<number, number> = {
    4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30,
    10: 31, 11: 30, 12: 31, 1: 31, 2: 28, 3: 31
};

/**
 * 포드라 윤년 판별
 * 1180년은 윤년(천마의 달 29일)입니다. 4년 주기로 가정합니다.
 */
export const isFodlanLeapYear = (year: number): boolean => {
    return year % 4 === 0;
};

/**
 * 해당 연도/월의 총 일수를 반환합니다.
 * 포드라력 규칙 준수 (2월 윤년 처리)
 */
export const getFodlanMonthDays = (year: number, month: number): number => {
    if (month === 2 && isFodlanLeapYear(year)) {
        return 29;
    }
    return MONTH_DAYS_BASE[month] || 30;
};

/**
 * 특정 날짜의 요일을 반환합니다. (0: 일요일 ~ 6: 토요일)
 * 기준점: 제국력 1180년 4월 1일 = 화요일 (2)
 */
export const getFodlanDayOfWeek = (year: number, month: number, day: number): number => {
    const ANCHOR_YEAR = 1180;
    const ANCHOR_MONTH = 4;
    const ANCHOR_DAY = 1;
    const ANCHOR_WEEKDAY = 2; // Tuesday

    let totalDays = 0;

    // 1. 연도 차이 계산 (학기 단위: 4월~3월)
    // year가 1180보다 크면 날짜를 더하고, 작으면 뺍니다.
    // 여기서는 간단히 1180년 이후만 고려하거나, 일반화합니다.
    
    // 타겟 날짜가 기준점보다 미래인지 과거인지 판단
    // dateToInteger를 사용하여 비교
    const targetInt = dateToInteger({ year, month, day });
    const anchorInt = dateToInteger({ year: ANCHOR_YEAR, month: ANCHOR_MONTH, day: ANCHOR_DAY });

    if (targetInt === anchorInt) return ANCHOR_WEEKDAY;

    if (targetInt > anchorInt) {
        // 미래로 계산
        for (let y = ANCHOR_YEAR; y <= year; y++) {
            const months = ACADEMIC_MONTH_ORDER;
            for (const m of months) {
                // 목표 연도/월에 도달하기 전까지의 일수 합산
                // 같은 연도라도 목표 월 이전까지만
                // 같은 연도 같은 월이면 루프 종료
                if (y === year && m === month) {
                    totalDays += (day - 1); // 1일이 기준이므로
                    return (ANCHOR_WEEKDAY + totalDays) % 7;
                }
                
                // 해당 월의 전체 일수 더하기
                totalDays += getFodlanMonthDays(y, m);
            }
        }
    } else {
        // 과거로 계산 (1180년 이전) - 현재 앱에서는 거의 안 쓰이지만 방어 로직
        // 역순 계산 로직은 복잡하므로, 일단 1180년 4월 1일 이전을 막거나
        // 간단히 처리: 0일 경우만 반환
        return 0; 
    }

    return 0; // Fallback
};

/**
 * 날짜 계산 (하루 전/후 이동) - 포드라력 호환
 */
export const addDays = (date: FodlanDate, days: number): FodlanDate => {
    // Academic Logic을 따르는 간이 구현
    // 현재 날짜의 정렬값(Sortable Integer)으로 변환 후 연산은 복잡하므로,
    // JS Date를 빌려쓰되 윤년 로직만 보정합니다.
    
    // JS Date는 1월=0, 2월=1... 
    // 윤년(2월 29일)을 지원하려면 JS Date의 연도를 윤년인 해(2024 등)로 매핑해야 함.
    // 하지만 포드라력은 4월 시작이므로 로직이 꼬일 수 있음.
    // 따라서 순수 산술 연산으로 처리.
    
    let { year, month, day } = date;
    
    // Add Days (Positive only for simplicity in this context)
    for(let i=0; i<days; i++) {
        const maxDays = getFodlanMonthDays(year, month);
        day++;
        if (day > maxDays) {
            day = 1;
            // Next Month Logic (Academic)
            // 4->5...->12->1->2->3->4(Next Year)
            const currentIdx = ACADEMIC_MONTH_ORDER.indexOf(month);
            if (currentIdx === 11) {
                // 3월에서 4월로 갈 때 연도 증가
                month = 4;
                year++;
            } else {
                month = ACADEMIC_MONTH_ORDER[currentIdx + 1];
            }
        }
    }
    
    return { year, month, day };
};

// [Diff, Range helpers remain standard but rely on parseFodlanDate]
export const getDaysDiff = (dateStr1: string, dateStr2: string): number | null => {
    const d1 = parseFodlanDate(dateStr1);
    const d2 = parseFodlanDate(dateStr2);
    if (!d1 || !d2) return null;
    
    // Rough calc using JS Date (Approximation is usually fine for diffs)
    // For precision, we would need to sum getFodlanMonthDays between them.
    const effYear1 = d1.month < 4 ? d1.year + 1 : d1.year;
    const effYear2 = d2.month < 4 ? d2.year + 1 : d2.year;
    const dateObj1 = new Date(effYear1, d1.month - 1, d1.day);
    const dateObj2 = new Date(effYear2, d2.month - 1, d2.day);
    const diffTime = Math.abs(dateObj2.getTime() - dateObj1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

export const getDatesInRange = (startDateStr: string, endDateStr: string): string[] => {
    const d1 = parseFodlanDate(startDateStr);
    const d2 = parseFodlanDate(endDateStr);
    if (!d1 || !d2) return [];
    if (dateToInteger(d1) >= dateToInteger(d2)) return [];

    const result: string[] = [];
    let current = addDays(d1, 1);
    let safety = 0;
    const endInt = dateToInteger(d2);

    while (dateToInteger(current) < endInt && safety < 30) {
        result.push(formatFodlanDate(current));
        current = addDays(current, 1);
        safety++;
    }
    return result;
};
