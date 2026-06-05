
import React, { useState, useEffect } from 'react';
import { 
    MOON_MAP, 
    getFodlanMonthDays, 
    getFodlanDayOfWeek, 
    parseFodlanDate, 
    formatFodlanDate,
    FodlanDate
} from '../utils/dateUtils';

interface FodlanDatepickerProps {
    value: string | undefined;
    onChange: (value: string) => void;
}

const ACADEMIC_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const FodlanDatepicker: React.FC<FodlanDatepickerProps> = ({ value, onChange }) => {
    const [viewYear, setViewYear] = useState(1180);
    const [viewMonth, setViewMonth] = useState(4); // Start with Great Tree Moon
    const [selectedDate, setSelectedDate] = useState<FodlanDate | null>(null);

    // Parse initial value
    useEffect(() => {
        if (value) {
            const parsed = parseFodlanDate(value);
            if (parsed) {
                setSelectedDate(parsed);
                setViewYear(parsed.year);
                setViewMonth(parsed.month);
            }
        }
    }, []); 

    const handlePrevMonth = () => {
        const currentIdx = ACADEMIC_MONTH_ORDER.indexOf(viewMonth);
        if (currentIdx === 0) {
            // 4월 이전 -> 전년도 3월
            setViewMonth(3);
            setViewYear(y => y - 1);
        } else {
            setViewMonth(ACADEMIC_MONTH_ORDER[currentIdx - 1]);
        }
    };

    const handleNextMonth = () => {
        const currentIdx = ACADEMIC_MONTH_ORDER.indexOf(viewMonth);
        if (currentIdx === 11) {
            // 3월 다음 -> 내년도 4월
            setViewMonth(4);
            setViewYear(y => y + 1);
        } else {
            setViewMonth(ACADEMIC_MONTH_ORDER[currentIdx + 1]);
        }
    };

    const handlePrevYear = () => setViewYear(y => y - 1);
    const handleNextYear = () => setViewYear(y => y + 1);

    const handleDateClick = (day: number) => {
        const newDate = { year: viewYear, month: viewMonth, day };
        setSelectedDate(newDate);
        onChange(formatFodlanDate(newDate));
    };

    const totalDays = getFodlanMonthDays(viewYear, viewMonth);
    const startDayOfWeek = getFodlanDayOfWeek(viewYear, viewMonth, 1);
    
    // Fill empty cells for start of month
    const emptyCells = Array(startDayOfWeek).fill(null);
    const dayCells = Array.from({ length: totalDays }, (_, i) => i + 1);

    const isSelected = (d: number) => 
        selectedDate?.year === viewYear && 
        selectedDate?.month === viewMonth && 
        selectedDate?.day === d;

    return (
        <div className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 select-none shadow-sm">
            {/* Header: Year Control */}
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100 dark:border-gray-700/50">
                <button 
                    onClick={handlePrevYear}
                    className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="이전 해"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    제국력 {viewYear}년
                </div>
                <button 
                    onClick={handleNextYear}
                    className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="다음 해"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
            </div>

            {/* Header: Month Control */}
            <div className="flex justify-between items-center mb-4">
                <button 
                    onClick={handlePrevMonth}
                    className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="이전 달"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>

                <div className="text-sm text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest">
                    {MOON_MAP[viewMonth]}
                </div>

                <button 
                    onClick={handleNextMonth}
                    className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="다음 달"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((day, i) => (
                    <div key={day} className={`text-center text-[10px] font-bold ${i === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {emptyCells.map((_, i) => <div key={`empty-${i}`} />)}
                {dayCells.map(d => (
                    <button
                        key={d}
                        onClick={() => handleDateClick(d)}
                        className={`
                            h-8 text-xs rounded-md flex items-center justify-center transition-all
                            ${isSelected(d) 
                                ? 'bg-blue-600 text-white font-bold shadow-md' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600'
                            }
                        `}
                    >
                        {d}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FodlanDatepicker;
