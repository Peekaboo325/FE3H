
import React from 'react';

/**
 * [Chronicle Specialized Utilities]
 * 연대기 시스템에 특화된 포맷팅 및 메타데이터 파싱 로직입니다.
 * 범용 검색 엔진은 services/system/searchEngine.ts로 이전되었습니다.
 */

export const STATE_COLORS = [
    'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30',
    'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30',
    'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30',
    'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30',
    'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30',
];

export const getStateColor = (index: number) => STATE_COLORS[index % STATE_COLORS.length];

export const getEpRangeText = (eps: number[] | undefined) => {
    if (!eps || eps.length === 0) return "";
    const min = Math.min(...eps);
    const max = Math.max(...eps);
    return min === max ? `Ep.${min}` : `Ep.${min} - Ep.${max}`;
};

/**
 * Parses the chronicle range string to extract title and log count.
 * e.g. "제1장 (로그 5건)" -> { title: "제1장", count: "5" }
 */
export const parseMeta = (range: string) => {
    const match = range.match(/^(.*?)\s*\(로그\s*(\d+)건\)$/);
    if (match) return { title: match[1], count: match[2] };
    return { title: range, count: null };
};
