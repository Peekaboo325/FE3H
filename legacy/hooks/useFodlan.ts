import { useRef } from 'react';
import { useAppInitializer } from './useAppInitializer';
import { useSystemIO } from './useSystemIO';
import { AppRefs, IOActions } from '../store/types';

/**
 * [Phase 2-H] useFodlan (Refactored Facade)
 * 시스템의 각 핵심 기능을 전문 훅에서 빌려와 통합 인터페이스를 제공합니다.
 */
export const useFodlan = (): { refs: AppRefs; actions: IOActions } => {
    // 1. Specialized Hooks
    useAppInitializer();
    const systemIO = useSystemIO();

    // 2. Local UI References
    const mainInputRef = useRef<HTMLTextAreaElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const promptImageInputRef = useRef<HTMLInputElement>(null);

    return {
        refs: { 
            mainInputRef, 
            scrollContainerRef, 
            promptImageInputRef 
        },
        actions: { 
            ...systemIO 
        }
    };
};
