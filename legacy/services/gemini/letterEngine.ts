
import { Letter } from '../../types/index';
import { generateLetters as generateLettersAI } from './analyzers/letterGenerator';

/**
 * [Phase 2] Letter Engine Facade
 * 서신 생성의 흐름을 관장합니다.
 */

export const letterEngine = {
    /**
     * 캐릭터 간의 신규 서신을 생성합니다.
     * @param slotCount 생성할 서신의 개수 (1~4)
     */
    generateNewLetters: async (
        sender: any,
        receiver: any,
        recentMessages: any[],
        bonds: any,
        compendium: any[],
        previousLetters: any[],
        slotCount: number,
        onRetry?: (msg: string) => void,
        storyParams?: any,
        replyToId?: string,
        allCharacterNames?: string[],
        forcedType?: string,
        recentTypes?: string[],
        customPrompt?: string
    ): Promise<Letter[]> => {
        // AI에게 상황 분석 및 생성을 맡깁니다.
        return await generateLettersAI(
            sender,
            receiver,
            recentMessages,
            bonds,
            compendium,
            previousLetters,
            slotCount,
            onRetry,
            storyParams,
            replyToId,
            allCharacterNames,
            forcedType,
            recentTypes,
            customPrompt
        );
    },

    /**
     * 유닛 사망 시 유서를 생성합니다.
     */
    generateWill: async (
        deceased: any,
        recipient: any,
        recentMessages: any[],
        bonds: any,
        compendium: any[],
        onRetry?: (msg: string) => void,
        storyParams?: any
    ): Promise<Letter | null> => {
        const letters = await generateLettersAI(
            deceased,
            recipient,
            recentMessages,
            bonds,
            compendium,
            [],
            1,
            onRetry,
            storyParams
        );
        
        if (letters.length > 0) {
            const will = letters[0];
            will.type = 'will';
            will.status = 'sent';
            return will;
        }
        return null;
    }
};
