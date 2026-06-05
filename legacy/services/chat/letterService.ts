import { CharacterProfile, Letter } from '../../types/index';
import { db } from '../../utils/db';
import { geminiService } from '../geminiService';

/**
 * [NEW DESIGN] 서사 중심 서신 엔진
 * 1. 서사 기반 (Narrative-Driven)
 * 2. 7가지 엄격한 유형
 * 3. 서사적 격리 (배경 인물은 자기들끼리 소통)
 * 4. 모브 NPC 익명성 (직함 사용)
 * 5. 원문/답장 1회 제한 및 분리
 */
export const letterService = {
  /**
   * [Consolidated] 서신 통합 관리 엔진
   * 원문 생성과 답장 생성을 하나의 흐름으로 관리하여 API 부하를 줄이고 무한 로딩을 방지합니다.
   */
  syncLetters: async (
    allCharacters: CharacterProfile[],
    recentMessages: any[],
    onRetry?: (msg: string) => void,
    targetUnitId?: string
  ): Promise<Letter[]> => {
    const profiles = allCharacters;
    const targetProfile = targetUnitId ? profiles.find(p => p.id === targetUnitId) : null;
    if (!targetProfile || !targetProfile.isActive) return [];

    // 1. 전역 쿨다운 및 최근 발신자 추적
    const allLetters = await db.getAllLetters();
    const sortedLetters = allLetters.sort((a, b) => b.timestamp - a.timestamp);
    const lastLetterTime = sortedLetters[0]?.timestamp || 0;
    
    // [Quota Guard] 마지막 생성 시도 후 최소 30초 대기 (쿼터 초과 방지 강화)
    if (Date.now() - lastLetterTime < 30000) {
        return [];
    }

    // 2. 답장 우선 순위 확인 (현재 타겟 유닛이 받은 편지에 대한 답장 우선)
    const repliedIds = new Set(allLetters.filter(l => l.replyToId).map(l => l.replyToId));
    const pendingReply = allLetters.find(l => 
        l.receiverId === targetProfile.id && // [Phase 2-M] Scope to target unit
        l.status === 'sent' && 
        !l.replyToId && 
        !repliedIds.has(l.id) && 
        l.type !== 'note' && 
        l.type !== 'will'
    );

    // [Option A] 확률적 우선순위 도입: 답장이 밀려있어도 40% 확률로 무시하고 신규 발신 진행
    const skipReplyChance = 0.4;
    const shouldSkipReply = Math.random() < skipReplyChance;

    if (pendingReply && !shouldSkipReply) {
        const recentLetterTypes = sortedLetters.slice(0, 5).map(l => l.type);
        const replies = await letterService.generateReply(pendingReply, allCharacters, recentMessages, onRetry, recentLetterTypes);
        
        // [Phase 2-M] If a reply was actually generated, return it. 
        // Otherwise, don't block and fall through to new letter generation.
        if (replies.length > 0) {
            return replies;
        }
        console.debug("[LETTER_GEN] Responder decided to remain silent. Falling back to new letter generation.");
    }

    // 2.5 [NEW] 유서 발견 로직 (Survivor-Centric Will Delivery)
    // 타겟 유닛(생존자)과 인연이 있었던 사망 유닛의 유서가 있는지 확인
    const deceasedBonds = targetProfile.bonds?.filter(b => {
        const char = profiles.find(p => p.id === b.id);
        return char && char.life_status === 'deceased';
    }) || [];

    if (deceasedBonds.length > 0) {
        for (const bond of deceasedBonds) {
            const hasWill = allLetters.some(l => l.senderId === bond.id && l.receiverId === targetProfile.id && l.type === 'will');
            if (!hasWill) {
                const deceasedSender = profiles.find(p => p.id === bond.id);
                if (deceasedSender) {
                    const [compendium, storyParams, customPrompt] = await Promise.all([
                        db.getCompendiumEntries(),
                        db.getSetting('storyParams'),
                        db.getSetting('customPrompt')
                    ]);
                    
                    try {
                        const wills = await geminiService.generateNewLetters(
                            deceasedSender,
                            targetProfile,
                            recentMessages.slice(-10),
                            bond,
                            compendium,
                            [], 
                            1,
                            onRetry,
                            storyParams,
                            undefined,
                            undefined,
                            'will', // 유서 유형 강제
                            undefined,
                            customPrompt as string
                        );

                        if (wills && wills.length > 0) {
                            await db.saveLetters(wills);
                            return wills;
                        }
                    } catch (error) {
                        console.error(`[WILL_GEN] Failed for ${deceasedSender.name}:`, error);
                    }
                }
            }
        }
    }

    // 3. 발신자 선정 (AI 주도형 후보지 vs 모브 NPC)
    const rand = Math.random();
    let sender: any = null;
    let isMob = false;

    // [Phase 2-N] Check if target has appeared in narrative
    const allMessages = await db.getMessages();
    const mentionedNamesInHistory = new Set<string>();
    allMessages.forEach(m => {
        const namesInText = m.content.match(/[가-힣]{2,5}/g) || [];
        namesInText.forEach((n: string) => mentionedNamesInHistory.add(n));
    });
    const targetFirstName = targetProfile.name.split(' ')[0];
    const hasTargetAppeared = mentionedNamesInHistory.has(targetProfile.name) || mentionedNamesInHistory.has(targetFirstName);

    // [Phase 2-N] Adjust probabilities for unappeared characters: 
    // Option B: Set Mob/Non-Mob ratio to 50:50 for unappeared units
    const mobChance = hasTargetAppeared ? 0.4 : 0.5;

    if (rand < mobChance) {
        // [Location-Aware Mob Engine] 모브 NPC 생성
        isMob = true;
        const location = targetProfile.current_location || '왕궁';
        let mobRole = '동료 메이드';
        
        if (location.includes('기사단') || location.includes('연습장')) {
            const roles = ['근위기사', '수습 병사', '무기 관리인'];
            mobRole = roles[Math.floor(Math.random() * roles.length)];
        } else if (location.includes('마을') || location.includes('시장')) {
            const roles = ['상인 조합원', '마을 주민', '경비병'];
            mobRole = roles[Math.floor(Math.random() * roles.length)];
        } else if (location.includes('왕궁') || location.includes('생활관')) {
            const roles = ['시종장', '메이드', '요리사'];
            mobRole = roles[Math.floor(Math.random() * roles.length)];
        }

        sender = {
            id: `mob-${Date.now()}`,
            name: mobRole,
            role: mobRole,
            description: `${location}에서 근무하는 ${mobRole}입니다.`,
            isMinor: true,
            current_location: location
        };
    } else {
        // 서사 기반 네임드 캐릭터 선정
        // [Phase 2-N] Candidates from registered profiles
        const registeredCandidates = profiles.filter(p => {
            if (p.id === targetProfile.id) return false;
            if ((p.life_status || 'alive') !== 'alive') return false;
            if (!p.isActive) return false; // [NEW] 비활성화 유닛 제외
            // [USER_REQUEST] 중복 방지 해제 (recentSenders 체크 제거)

            const isBond = targetProfile.bonds?.some(b => b.id === p.id);

            if (!hasTargetAppeared) {
                // 미등장 유닛: 오직 인연 기록 캐릭터만 허용
                return isBond;
            }

            // 등장 유닛: 이미 등장한 캐릭터 + 인연 기록 캐릭터 허용
            const firstName = p.name.split(' ')[0];
            const hasAppeared = mentionedNamesInHistory.has(p.name) || mentionedNamesInHistory.has(firstName);
            return hasAppeared || isBond;
        });

        // [Phase 2-N] Virtual candidates from Bonds (Unregistered characters)
        const virtualCandidates = (targetProfile.bonds || [])
            .filter(b => !profiles.some(p => p.id === b.id)) // Not registered
            // [USER_REQUEST] 중복 방지 해제 (recentSenders 체크 제거)
            .map(b => ({
                id: b.id,
                name: b.name,
                role: (b as any).role || '지인',
                description: (b as any).description || `${targetProfile.name}의 인연 기록에 기재된 인물입니다.`,
                isMinor: true,
                life_status: 'alive',
                bonds: [{ id: targetProfile.id, name: targetProfile.name }] // Back-link for context
            }));

        const allCandidates = [...registeredCandidates, ...virtualCandidates];

        if (allCandidates.length > 0) {
            sender = allCandidates[Math.floor(Math.random() * allCandidates.length)];
        } else {
            // 후보가 없으면 모브로 폴백
            isMob = true;
            sender = {
                id: `mob-fallback-${Date.now()}`,
                name: '익명의 발신자',
                role: '행인',
                description: '지나가는 행인입니다.',
                isMinor: true
            };
        }
    }

    if (!sender) return [];

    // 4. 최근 서신 유형 분석 (중복 방지용)
    const recentLetterTypes = sortedLetters.slice(0, 5).map(l => l.type);

    // [Option A] 역할 반전 (Role Reversal): 35% 확률로 타겟 유닛이 발신자가 됨
    const isRoleReversed = Math.random() < 0.35;
    let finalSender = isRoleReversed ? targetProfile : sender;
    let finalReceiver = isRoleReversed ? sender : targetProfile;

    // [Safety Guard] 발신자와 수신자가 동일한 경우 강제 교정 (자가 발신 방지)
    if (finalSender.id === finalReceiver.id) {
        finalSender = sender;
        finalReceiver = targetProfile;
    }

    // 5. AI에게 최종 판단 및 생성 요청
    const [compendium, storyParams, customPrompt] = await Promise.all([
        db.getCompendiumEntries(),
        db.getSetting('storyParams'),
        db.getSetting('customPrompt') // [Phase 2-P] Fetch user instructions
    ]);

    // [Option B] 신규 발신 가이드 강화: 정보가 없더라도 첫인사나 안부 유도
    const greetingInstruction = !hasTargetAppeared ? "\n\n[GREETING GUIDE] 현재 서사 정보가 부족하더라도, 상대방과의 인연(Bond) 설정이나 신분을 바탕으로 정중한 첫인사나 안부를 전하며 대화를 시작하십시오." : "";

    try {
        const bond = finalSender.bonds?.find((b: any) => b.id === finalReceiver.id) || {};
        const letters = await geminiService.generateNewLetters(
            finalSender,
            finalReceiver,
            hasTargetAppeared ? recentMessages.slice(-20) : [], // [Option B] 서사 맥락 확장 (10 -> 20)
            bond,
            compendium,
            [], 
            1,
            onRetry,
            storyParams,
            undefined,
            undefined,
            undefined, // forcedType 제거 (AI가 자율 선택)
            recentLetterTypes, // 최근 유형 전달
            (customPrompt as string || "") + greetingInstruction // [Phase 2-P] Pass custom prompt + greeting guide
        );

        if (letters && letters.length > 0) {
            await db.saveLetters(letters);
            return letters;
        }
    } catch (error) {
        console.error(`[SYNC_LETTERS] Failed:`, error);
    }

    return [];
  },

  /**
   * 답장 생성 내부 로직
   */
  generateReply: async (
    original: Letter,
    allCharacters: CharacterProfile[],
    recentMessages: any[],
    onRetry?: (msg: string) => void,
    recentLetterTypes?: string[]
  ): Promise<Letter[]> => {
    const responder = await letterService.getResponderInfo(original.receiverId, allCharacters, original);
    const originalSender = await letterService.getResponderInfo(original.senderId, allCharacters, original);

    if (!responder || !originalSender || responder.life_status !== 'alive') return [];
    
    // [NEW] 비활성화 유닛은 답장 생성에서도 제외
    if (!responder.isMinor && !responder.isActive) return [];
    if (!originalSender.isMinor && !originalSender.isActive) return [];

    // [Phase 2-O] Option C: Check if responder has appeared in narrative
    const allMessages = await db.getMessages();
    const mentionedNames = new Set<string>();
    allMessages.forEach(m => {
        const names = m.content.match(/[가-힣]{2,5}/g) || [];
        names.forEach((n: string) => mentionedNames.add(n));
    });
    const responderFirstName = (responder as any).name?.split(' ')[0] || '';
    const hasResponderAppeared = responder && (mentionedNames.has((responder as any).name) || mentionedNames.has(responderFirstName));

    // [Option B] 답장 가이드 강화: 정보가 없더라도 원문 내용을 바탕으로 답장 작성 유도
    const replyInstruction = !hasResponderAppeared ? "\n\n[REPLY GUIDE] 현재 서사 정보가 부족하더라도, 상대방이 보낸 원문 서신의 내용과 인연(Bond) 설정을 바탕으로 성의 있게 답장을 작성하십시오." : "";

    const [compendium, storyParams, customPrompt] = await Promise.all([
        db.getCompendiumEntries(),
        db.getSetting('storyParams'),
        db.getSetting('customPrompt') // [Phase 2-P] Fetch user instructions
    ]);

    try {
        const replies = await geminiService.generateNewLetters(
            responder,
            originalSender,
            hasResponderAppeared ? recentMessages.slice(-20) : [], // [Option B] 서사 맥락 확장 (10 -> 20)
            {}, 
            compendium,
            [original],
            1,
            onRetry,
            storyParams,
            original.id,
            undefined,
            undefined,
            recentLetterTypes,
            (customPrompt as string || "") + replyInstruction // [Phase 2-P] Pass custom prompt + reply guide
        );

        if (replies.length > 0) {
            await db.saveLetters(replies);
            return replies;
        }
    } catch (error) {
        console.error(`[REPLY_GEN] Failed:`, error);
    }
    return [];
  },

  /**
   * 발신자 정보 획득 (기반 기술)
   */
  getResponderInfo: async (id: string, profiles: any[], originalLetter?: Letter) => {
    const major = profiles.find(p => p.id === id);
    if (major) return { ...major, isMinor: false };

    // [Phase 2-N] Mob NPC Support: If ID starts with 'mob-', create a virtual profile
    if (id.startsWith('mob-')) {
        const mobName = originalLetter?.signature?.split(',')[0]?.trim() || '익명의 발신자';
        return {
            id: id,
            name: mobName,
            role: '모브 NPC',
            description: '서신을 통해 연결된 인물입니다.',
            isMinor: true,
            life_status: 'alive'
        };
    }

    for (const p of profiles) {
      const minor = p.bonds?.find((b: any) => b.id === id);
      if (minor) return { ...minor, isMinor: true, parentUnitId: p.id, life_status: minor.life_status || 'alive' };
    }
    return null;
  }
};
