
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as selectors from '../store/selectors';
import { assetManager } from '../services/system/assetManager';

export const useSystemEffects = () => {
    const isInitialized = useAppStore(selectors.selectIsInitialized);
    const systemStatus = useAppStore(selectors.selectSystemStatus);
    const messages = useAppStore(state => state.messages);
    const characters = useAppStore(state => state.characters);

    const [isHeartbeating, setIsHeartbeating] = useState(false);

    useEffect(() => {
        if (systemStatus?.includes("박동")) {
            setIsHeartbeating(true);
            const timer = setTimeout(() => setIsHeartbeating(false), 400);
            return () => clearTimeout(timer);
        }
    }, [systemStatus]);

    // Unified Asset Management
    useEffect(() => {
        if (!isInitialized) return;
        const cleanupAssets = () => {
            const activeUrls = new Set<string>();
            messages.forEach(m => { if (m.image && m.image.startsWith('blob:')) activeUrls.add(m.image); });
            characters.forEach(c => { if (c.thumbnail && c.thumbnail.startsWith('blob:')) activeUrls.add(c.thumbnail); });
            assetManager.cleanup(activeUrls);
        };
        const timer = setTimeout(cleanupAssets, 1000);
        return () => clearTimeout(timer);
    }, [messages, characters, isInitialized]);

    return { isHeartbeating };
};
