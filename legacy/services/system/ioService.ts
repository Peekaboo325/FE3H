import { Message, CharacterProfile, Period, StoryParams, CompendiumEntry, Letter } from '../../types/index';
import { blobToDataUrl, dataUrlToBlob } from '../../utils/imageUtils';
import { assetManager } from './assetManager';

/**
 * [Phase 2-H/J] IO Service: Pure Logic for Data Transformation
 */

/**
 * [Purification Protocol]
 * 유령 필드 소각 유틸리티
 */
const sanitizeImportedChar = (char: any): CharacterProfile => {
    const clean = { ...char };
    ['relathionship', 'relation', 'connect_info', 'diary_entries'].forEach(f => delete clean[f]);
    if (!clean.bonds) clean.bonds = [];
    return clean as CharacterProfile;
};

/**
 * 앱 데이터를 내보내기용 JSON 구조로 직렬화합니다.
 */
export const serializeAppData = async (
    messages: Message[],
    characters: CharacterProfile[],
    chronicles: any[],
    compendium: CompendiumEntry[],
    letters: Letter[],
    period: Period | null,
    storyParams: StoryParams,
    customPrompt: string,
    isDarkMode: boolean
) => {
    const exportMessages = await Promise.all(messages.map(async (msg) => {
        if (msg.image && msg.image.startsWith('blob:')) {
            const base64 = await blobToDataUrl(msg.image);
            return { ...msg, image: base64 };
        }
        return msg;
    }));

    const exportCharacters = await Promise.all(characters.map(async (char) => {
        let updatedChar = { ...char };
        if (char.thumbnail && char.thumbnail.startsWith('blob:')) {
            updatedChar.thumbnail = await blobToDataUrl(char.thumbnail);
        }
        return updatedChar;
    }));

    return {
        version: 7, // Letter 지원을 위해 버전 상향 (6 -> 7)
        timestamp: Date.now(),
        messages: exportMessages,
        characters: exportCharacters,
        chronicles,
        compendium,
        letters,
        period,
        storyParams,
        customPrompt,
        isDarkMode
    };
};

/**
 * 가져온 데이터를 앱 상태로 역직렬화합니다.
 */
export const deserializeAppData = async (json: any) => {
    let messages = [];
    if (json.messages) {
        messages = await Promise.all(json.messages.map(async (msg: Message) => {
            if (msg.image && msg.image.startsWith('data:')) {
                const blob = await dataUrlToBlob(msg.image);
                // [Phase 2-J] Managed URL creation
                return { ...msg, image: assetManager.createManagedUrl(blob) };
            }
            return msg;
        }));
    }

    let characters = [];
    if (json.characters) {
        characters = await Promise.all(json.characters.map(async (char: any) => {
            const sanitized = sanitizeImportedChar(char);
            if (sanitized.thumbnail && sanitized.thumbnail.startsWith('data:')) {
                const blob = await dataUrlToBlob(sanitized.thumbnail);
                // [Phase 2-J] Managed URL creation
                return { ...sanitized, thumbnail: assetManager.createManagedUrl(blob) };
            }
            return sanitized;
        }));
    }

    return { 
        ...json, 
        messages, 
        characters,
        letters: json.letters || [] // [Phase 1] Fallback for older versions (v5/v6)
    };
};

/**
 * 서사 기록을 클린 텍스트 사본으로 변환합니다.
 */
export const formatNarrativeToText = (messages: Message[]): string => {
    let text = "";
    messages.forEach(m => {
        if (m.role !== 'model' || m.isHidden) return;
        const titleMatch = m.content.match(/^###\s*(.*)$/m);
        const title = titleMatch ? titleMatch[1].trim() : "";
        const dateMatch = m.content.match(/<sub[^>]*>(.*?)<\/sub>/i);
        const date = dateMatch ? dateMatch[1].trim() : "";
        
        const parts = m.content.split(/\n\s*---\s*\n/);
        let bodyRaw = parts.length > 1 ? parts.slice(1).join('\n') : m.content;
        if (parts.length === 1) {
            bodyRaw = bodyRaw.replace(/^###.*$/gm, '').replace(/<sub.*<\/sub>/gi, '');
        }
        const cleanBody = bodyRaw.replace(/\*\*/g, '').replace(/^\s*---\s*$/gm, '').trim();
        
        if (title) text += `${title}\n`;
        if (date) text += `${date}\n`;
        text += `\n${cleanBody}\n\n\n`;
    });
    return text.trim();
};