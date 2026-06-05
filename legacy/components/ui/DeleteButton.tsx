
import React, { useState, useEffect } from 'react';
import { IconButton } from './IconButton';

interface DeleteButtonProps {
    onConfirm: () => void;
    disabled?: boolean;
    className?: string;
    title?: string;
    confirmTitle?: string;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({ 
    onConfirm, 
    disabled, 
    className, 
    title = "삭제",
    confirmTitle = "확인: 정말 삭제하시겠습니까?"
}) => {
    const [isConfirming, setIsConfirming] = useState(false);

    // Reset confirmation state when clicking outside
    useEffect(() => {
        if (!isConfirming) return;
        
        const handleGlobalClick = () => setIsConfirming(false);
        // Use click event capture or bubble on document to reset state
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [isConfirming]);

    const handleClick = (e: React.MouseEvent) => {
        // Stop propagation to prevent immediate triggering of the global click listener attached above
        e.stopPropagation();
        
        if (isConfirming) {
            onConfirm();
            setIsConfirming(false);
        } else {
            setIsConfirming(true);
        }
    };

    return (
        <IconButton
            onClick={handleClick}
            variant="danger"
            disabled={disabled}
            title={isConfirming ? confirmTitle : title}
            className={`${isConfirming ? "text-red-600 bg-red-50 dark:bg-red-900/20" : ""} ${className || ''}`}
        >
            {isConfirming ? (
                // Solid Red Icon (Warning / Confirm State)
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-600 dark:text-red-500 animate-in zoom-in duration-200">
                    <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                </svg>
            ) : (
                // Outline Icon (Default State)
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
            )}
        </IconButton>
    );
};
