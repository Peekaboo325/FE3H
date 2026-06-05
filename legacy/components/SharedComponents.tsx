
import { StateCreator } from 'zustand';
import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { CharacterAnalysis } from '../types/index';

// --- 1. Basic UI Elements ---

/**
 * [PR #2] Intellectual Echo - Skeleton Engine
 * Provides a standardized base for loading states with a gothic-modern aesthetic.
 */
export const SkeletonBase: React.FC<{ 
    className?: string; 
    height?: string; 
    width?: string; 
    circle?: boolean;
}> = ({ className = "", height = "1rem", width = "100%", circle = false }) => (
    <span 
        className={`animate-fodlan-shimmer bg-gray-100 dark:bg-gray-800/60 ${circle ? 'rounded-full' : 'rounded-sm'} block ${className}`}
        style={{ height, width }}
        aria-hidden="true"
    />
);

export const ThumbnailPlaceholder: React.FC<{ size?: string }> = ({ size = 'text-xs' }) => (
  <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-600">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={size === 'text-4xl' ? 'w-12 h-12' : 'w-5 h-5'}>
      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
  </div>
);

/**
 * [Portrait Preservation] FodlanPortrait
 * Handles broken images with a fallback silhouette and enforces security policies.
 */
export const FodlanPortrait: React.FC<{ 
    src?: string; 
    alt?: string; 
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
}> = ({ src, alt = "", className = "", size = 'md' }) => {
    const [hasError, setHasError] = useState(false);
    
    const sizeClasses = {
        xs: 'w-6 h-6',
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-20 h-20',
        xl: 'w-32 h-32',
        full: 'w-full h-full'
    };

    if (!src || hasError) {
        return (
            <div className={`${sizeClasses[size]} rounded-full overflow-hidden border border-gray-200 dark:border-gray-800 ${className}`}>
                <ThumbnailPlaceholder size={size === 'xl' ? 'text-4xl' : 'text-xs'} />
            </div>
        );
    }

    return (
        <img 
            src={src} 
            alt={alt} 
            className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200 dark:border-gray-800 ${className}`}
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
        />
    );
};

/**
 * [Order of Seiros] FodlanEmptyState
 * 유니파이드 '데이터 없음' UI. 서사적인 톤앤매너와 시각적 피드백 결합.
 */
export const FodlanEmptyState: React.FC<{ 
    icon: string; 
    title: string; 
    description?: string;
    action?: React.ReactNode;
    className?: string;
}> = ({ icon, title, description, action, className = "" }) => (
    <div className={`flex flex-col items-center justify-center text-center p-8 md:p-12 animate-in fade-in duration-700 ${className}`}>
        <div className="relative mb-6">
            <div className="text-5xl grayscale opacity-40 select-none">{icon}</div>
            <div className="absolute -inset-4 animate-fodlan-shimmer rounded-full opacity-20 pointer-events-none" />
        </div>
        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.3em] mb-2">
            {title}
        </h4>
        {description && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed max-w-[240px] break-keep italic text-balance">
                {description}
            </p>
        )}
        {action && <div className="mt-6">{action}</div>}
    </div>
);

export const StepSlider: React.FC<{
  label: string;
  value: number;
  onChange: (val: number) => void;
  labels: string[];
}> = ({ label, value, onChange, labels }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-end">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-bold text-blue-500">{labels[value - 1]}</span>
    </div>
    <input
      type="range" min="1" max="5" step="1"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 outline-none"
    />
    <div className="flex justify-between px-1">
      {[1, 2, 3, 4, 5].map((step) => (
        <div key={step} className={`w-1 h-1 rounded-full ${step === value ? 'bg-blue-500 scale-150' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
      ))}
    </div>
  </div>
);

export const StatBar: React.FC<{ label: string; value: number; comment?: string; isLoading?: boolean }> = ({ label, value, comment, isLoading }) => (
  <div className="flex flex-col w-full mb-3 shrink-0" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <div className="grid grid-cols-[auto_1fr_auto] items-end gap-0.5 mb-1.5 w-full">
      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest leading-none shrink-0 text-left">
        {label}
      </span>
      <div className="min-w-0 text-right overflow-hidden pr-0.5">
        {isLoading ? (
            <div className="flex justify-end pt-1"><SkeletonBase width="40px" height="6px" /></div>
        ) : comment ? (
            <span className="block truncate text-[9px] text-gray-400 dark:text-gray-500 opacity-90 leading-none pt-0.5 font-medium tracking-tight">
                {comment.replace(/\.$/, '')}
            </span>
        ) : <div className="h-2" />}
      </div>
      <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-xs leading-none shrink-0 w-4 text-right">
        {isLoading ? "--" : value}
      </span>
    </div>
    <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden shrink-0 relative">
      {isLoading ? (
          <SkeletonBase height="100%" width="100%" />
      ) : (
          <div 
            className="h-full bg-blue-500 transition-all duration-500 ease-out relative z-10" 
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }} 
          />
      )}
    </div>
  </div>
);

export const MarkdownContent: React.FC<{ content: string; variant?: 'default' | 'compact' }> = ({ content, variant = 'default' }) => {
  const baseClass = "prose-custom break-words break-keep";
  const compactClass = variant === 'compact' ? " prose-compact" : "";
  const className = `${baseClass}${compactClass}`;
  return (
    <div className={className}>
        <ReactMarkdown 
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeRaw]}
        >
            {content || ''}
        </ReactMarkdown>
    </div>
  );
};

export const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ value, onChange, onSave, onCancel }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shadowRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (textareaRef.current && shadowRef.current) {
        shadowRef.current.style.width = `${textareaRef.current.getBoundingClientRect().width}px`;
        shadowRef.current.value = value || '';
        const targetHeight = shadowRef.current.scrollHeight;
        textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [value]);
  return (
    <div className="flex flex-col gap-3 w-full relative">
        <textarea 
            ref={shadowRef}
            className="absolute top-0 left-0 -z-50 opacity-0 pointer-events-none w-full bg-transparent border-none p-0 text-sm leading-relaxed overflow-hidden resize-none"
            tabIndex={-1}
            aria-hidden="true"
            rows={1}
            readOnly
        />
        <textarea 
            ref={textareaRef}
            value={value || ''} 
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent border-none focus:outline-none resize-none p-0 text-sm leading-relaxed overflow-hidden dark:text-gray-100"
            autoFocus
            rows={1}
            onKeyDown={(e) => { if(e.key === 'Escape') onCancel(); }}
        />
        <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">취소</button>
            <button onClick={onSave} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 font-bold transition-colors">저장</button>
        </div>
    </div>
  );
};

/**
 * [v4.6.5] Loading Messages Strategy
 */
const NORMAL_LOADING_MESSAGES = [
    "포드라의 정세를 살피는 중...",
    "서사의 실타래를 정교하게 엮어내고 있습니다.",
    "가르그 마크의 문헌 속에서 답을 찾는 중...",
    "여신의 가호 아래 역사의 순간을 집필합니다.",
    "운명의 궤적이 마침내 움직입니다."
];

const RECALL_LOADING_MESSAGES = [
    "붉은 문장의 고동이 잠든 기억을 일깨웁니다.",
    "과거의 인과와 현재의 순간이 공명합니다.",
    "잊혔던 기록의 파편들이 하나로 모이는 중...",
    "천각의 박동이 시간의 틈새를 비틀었습니다.",
    "오래된 인연의 목소리가 현재에 닿았습니다."
];

const ADVISOR_LOADING_MESSAGES = [
    "설정 디테일 확인 중입니다...",
    "원작 맥락과 함께 정리 중이에요.",
    "개연성 포인트 점검 중입니다.",
    "핵심 감정선을 정리하고 있어요.",
    "캐릭터의 동기를 생각하고 있습니다...",
    "지금 장면, 계속 곱씹고 있어요.",
    "방금 전개, 너무 좋습니다...",
    "정리하면서 설레는 중입니다.",
    "좋은 포인트라 조금만 더 보고 있어요."
];

export const LoadingIndicator: React.FC<{ 
    text?: string; 
    isRecallActive?: boolean;
    variant?: 'default' | 'advisor' 
}> = ({ text, isRecallActive, variant = 'default' }) => {
    const [msgIndex, setMsgIndex] = useState(0);
    
    // Select message pool
    const messages = variant === 'advisor' 
        ? ADVISOR_LOADING_MESSAGES 
        : (isRecallActive ? RECALL_LOADING_MESSAGES : NORMAL_LOADING_MESSAGES);

    // Dynamic Interval: 3s for advisor, 6s for others
    const intervalTime = variant === 'advisor' ? 3000 : 6000;

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % messages.length);
        }, intervalTime);
        return () => clearInterval(interval);
    }, [messages, intervalTime]);

    const currentMessage = messages[msgIndex];

    // Color Logic: Yellow(Amber) for Advisor, Red for Recall, Blue for Normal
    const dotColor = variant === 'advisor' ? 'bg-amber-400' : (isRecallActive ? 'bg-red-500' : 'bg-blue-400');
    const textColorClass = variant === 'advisor' ? 'text-amber-500' : (isRecallActive ? 'text-red-500' : 'text-blue-500');
    
    // [UX Polish] Enhanced Pulse & Glow for special modes
    const pulseClass = isRecallActive 
        ? 'animate-[pulse_2s_infinite] shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
        : variant === 'advisor' 
            ? 'animate-[pulse_3s_infinite]' 
            : '';

    return (
        <div className={`flex flex-col items-center justify-center py-4 px-6 min-w-[300px] transition-all duration-1000 rounded-lg ${pulseClass}`} role="status" aria-live="polite">
            {isRecallActive && (
                <div className="absolute inset-0 bg-red-500/5 animate-pulse rounded-lg pointer-events-none" />
            )}
            <div className="flex space-x-2 mb-4 relative z-10">
                 <div className={`w-2 h-2 ${dotColor} rounded-full animate-[bounce_1s_infinite_0ms]`}></div>
                 <div className={`w-2 h-2 ${dotColor} rounded-full animate-[bounce_1s_infinite_200ms]`}></div>
                 <div className={`w-2 h-2 ${dotColor} rounded-full animate-[bounce_1s_infinite_400ms]`}></div>
            </div>
            <span className={`text-[10px] font-bold ${textColorClass} uppercase tracking-[0.2em] text-center animate-in fade-in duration-500 leading-relaxed break-keep text-balance relative z-10`}>
                {currentMessage}
            </span>
        </div>
    );
};

// --- 2. Visualizations ---

export const RadarChart: React.FC<{ stats: CharacterAnalysis['stats']; isDark: boolean; isLoading?: boolean }> = ({ stats, isDark, isLoading }) => {
  const size = 200;
  const center = size / 2;
  const radius = (size / 2) - 30;
  const SIDES = 9;
  const keys = ['prowess', 'magic', 'faith', 'intellect', 'influence', 'status', 'wealth', 'charm', 'resilience'];
  const labels = ['무력', '마력', '신앙', '지성', '권세', '위상', '재력', '매력', '정신'];
  const getPoint = (value: number, index: number, maxRadius: number) => {
    const angle = (Math.PI * 2 * index) / SIDES - Math.PI / 2;
    const r = (value / 100) * maxRadius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };
  const gridPolygons = [1, 2, 3, 4].map((level) => {
    const levelRadius = (radius / 4) * level;
    return keys.map((_, idx) => {
      const { x, y } = getPoint(100, idx, levelRadius);
      return `${x},${y}`;
    }).join(' ');
  });
  const dataPoints = keys.map((key, idx) => {
    const val = stats[key as keyof typeof stats] || 0;
    const { x, y } = getPoint(val, idx, radius);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div className="relative w-full h-full" aria-hidden="true">
      <svg viewBox={`0 0 ${size} ${size}`} className={`w-full h-full overflow-visible transition-opacity duration-700 ${isLoading ? 'opacity-20' : 'opacity-100'}`}>
        {gridPolygons.map((points, i) => (
          <polygon key={i} points={points} fill="none" className="stroke-gray-300 dark:stroke-gray-700" strokeWidth="1" />
        ))}
        {keys.map((_, idx) => {
          const { x, y } = getPoint(100, idx, radius);
          return <line key={idx} x1={center} y1={center} x2={x} y2={y} className="stroke-gray-300 dark:stroke-gray-700" strokeWidth="1" />;
        })}
        {!isLoading && <polygon points={dataPoints} className="fill-blue-500/20 stroke-blue-500 animate-in zoom-in duration-700" strokeWidth="2" />}
        {labels.map((label, idx) => {
          const { x, y } = getPoint(115, idx, radius);
          return <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[9px] font-bold uppercase fill-gray-500 dark:fill-gray-400">{label}</text>;
        })}
      </svg>
      {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-800 animate-spin duration-[10s] ease-linear" />
          </div>
      )}
    </div>
  );
};
