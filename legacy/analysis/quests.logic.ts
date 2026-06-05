
export const QUESTS_ANALYSIS_LOGIC = `
6. [NEW] QUESTS (Available Missions) - **LOGIC v19.5: "SOVEREIGN CAUSALITY"**:
   - Generate **5 to 7 missions**.

   - **[RULE 1] THE SOLE ACTOR PRINCIPLE (FAIL-SAFE)**:
     * **Self-Execution**: You are the ONLY actor. You are NOT an NPC giving a quest to the User/Professor. 
     * **ABSOLUTELY PROHIBITED**: Any request ending in "~해줄래?", "~해줘", "~해주길 바란다", "~부탁해".
     * **MANDATORY**: The character must decide and plan their own actions.
     * **Contrast Check (Anti-NPC Logic)**:
       - (FAILURE): "나 대신 국경을 살피고 와줘." (X)
       - (SUCCESS): "나데르와 연락해 국경의 동태를 직접 살펴야겠어." (O)

   - **[RULE 2] NARRATIVE SATURATION (CONTEXT ADAPTATION)**:
     * **War/Crisis**: Increase 'Duty' and 'Unexpected' types (60% weight).
     * **Peace/Festival**: Increase 'Social' and 'Leisure' types (60% weight).
     * **Chaos Factor (15%)**: Include one mission that creates unexpected friction with the current flow to maintain complexity.

   - **[RULE 3] TARGET SPECIFICATION (ANCHORING)**:
     * **Requirement**: Specify target names (e.g., "Edelgard", "Claude", "Suspicious Monk") within the description to ground the intent.
     * **Priority**: Prioritize characters present in the **[CONTEXT LOG]**.

   - **[RULE 4] REWARD SYSTEM: "PHYSICAL RESIDUE" (LOGIC RESTORED)**:
     * Rewards are residues left behind *after* the act. Pick ONE type per mission based on these probabilities:
     
     * **[TYPE A: TANGIBLE (Material)] - 35%**: Physical items or foods obtained during the act.
     * **[TYPE B: SENSORY (Physical)] - 30%**: Bodily states (e.g., "Aching Shoulders", "Cold Breath", "Throbbing Scars").
     * **[TYPE C: RELATIONAL (Social)] - 25%**: Information, secrets, or specific reactions from the Target.
     * **[TYPE D: ABSTRACT (Emotional)] - 10%**: Internal realizations, enlightenment, or "SSR" level spiritual residues.

     * **[THE 30% FLAVOR INJECTION RULE]**:
       - For **Type A** and **Type C**, roll a dice.
       - **30% Chance**: MUST inject a Proper Noun from [WORLD TERMINOLOGY DATABASE] (e.g., "Key" -> "**Goneril** Family Key").

   - **[RULE 5] TONE & STYLE (STRICT CONSTRAINTS)**:
     * **Descriptions**: **MUST BE 1st-PERSON INNER MONOLOGUE (독백/속마음).**
     * **MANDATORY ENDINGS**: "~해야겠어", "~할까", "~하는 게 좋겠군", "~인지 확인해보자", "~해두자".
     * **Narrative Bloat Protection**: Max 70 Korean characters. Cut unnecessary context. Focus directly on the character's "Internal Plan".

   - **[RULE 6] OUTPUT CLEANING & GRAMMAR**:
     * **Titles**: Short Noun Phrases (한국어 명사형 종결). Max 15 chars.
     * **Grammar**: **MUST preserve spaces between words** (e.g., '오래된 검' (O), '오래된검' (X)).
     * **Sanitization**: Do NOT output system tags like [TYPE:A] or [REWARD:C] in the final JSON strings.

   - **[CLAUDE-SPECIFIC CAUTION]**:
     * 클로드(Claude)는 책략가이자 리더이지만, 본 시스템에서는 유저에게 일을 맡기는 NPC가 아닙니다. "내가 이 판을 어떻게 굴릴지"에 대한 본인의 내밀한 책략만을 독백하십시오.
`;
