
import { HASHTAG_COMMON_RULES, CHARACTER_HASHTAG_LOGIC } from './hashtag.logic';

// [MODULE 1] Hashtag Logic
export const HASHTAG_LOGIC_SECTION = `
1. 'hashtags': 
   ${HASHTAG_COMMON_RULES}
   ${CHARACTER_HASHTAG_LOGIC.replace('{CHAR_NAME}', 'the target character')}
`;

// [MODULE 2] Personality & Unconscious Logic
export const PERSONALITY_LOGIC_SECTION = `
2. 'personality_analysis' & 'unconscious_analysis':
   - [STRICT RULE: NATURAL WRITING]
   - **MUST use standard Korean spacing (띄어쓰기) and grammar.**
   - Do NOT remove spaces.
`;

// [MODULE 3] Signature Quote Logic (Auto-Generation)
export const SIGNATURE_QUOTE_LOGIC = `
3. 'generated_quote': **LOGIC v2.0: "THE CINEMATIC ONE-LINER"**
   - **Objective**: Generate a short, impactful line that represents the character's *current* philosophy or mental state based on the [CONTEXT LOG].
   - **Length**: Max 40 characters (Korean). Short & Punchy.
   - **Style Guide**:
     * **Prohibited**: Gag, Slang, Meta-jokes, "Breaking the 4th wall", or Too casual "Hi/Hello".
     * **Allowed**: Soliloquy (독백), Determination (결의), Cynicism (냉소), Insight (통찰).
     * **Tone**: Cinematic, Serious, Atmospheric. Suitable for a "Personal Dossier" or "Biography Header".
   - **Examples**:
     * (War Context): "검 끝에 망설임은 없다."
     * (Peace Context): "이 평온이 언제까지 이어질지..."
     * (Schemer): "모든 수는 이미 읽었어."
`;

// [MODULE 4] Reputation Logic
export const REPUTATION_LOGIC_SECTION = `
4. 'reputation': **LOGIC v15.1: PUBLIC SENTIMENT & SHUFFLED ORDER**
   - Provide exactly **6 items**.
   
   - **[LOGIC: PUBLIC SENTIMENT (ZEITGEIST)]**:
     * **Step 1 (Zeitgeist Check)**: First, determine the **Dominant Public Sentiment** based on recent context (e.g., War -> Fear/Slander, Ball -> Romance, Scandal -> Fact Bomb).
     * **Step 2 (Bias Permission)**: **Do NOT balance the categories.** It is natural for rumors to be biased towards the current event.
       - If a scandal occurred, it is acceptable for 5-6 items to be [Slander] or [Fact Bomb].
       - If nothing special happened, use random distribution.
       - **Randomness includes the possibility of extreme streaks.** Do not force diversity.

   - **[STRICT RULE 1: SOURCE SELECTION]**:
     * **Composition**: 5 items from Nameless Humans (NPCs), 1 items from Non-human personifications (Animals, Plants, Objects).
     * **NPC Rules**: Must be tailored to the character's Origin, Class, and current Status. Use specific roles (e.g., 'Imperial Heavy Knight', 'Monastery Kitchen Staff') instead of generic ones.
     * **Adjective Enforcement (MANDATORY)**: EVERY source must include an adjective revealing personality or state (e.g., '질투심 많은', '떠들기 좋아하는', '비꼬기 좋아하는', '피로에 찌든').
     * **Forbidden**: NO Alphabet names ('Soldier A'), NO Named Characters (Lords, known students).

   - **[STRICT RULE 2: COMMENT FORMAT]**:
     * Must be pure **Dialogue** or **Inner Monologue**.
     * **Forbidden**: NO tags like [Fact Bomb] inside the comment string.

   - **[STRICT RULE 3: RANDOMIZED ORDER (ANTI-BIAS)]**:
     * **Input Order Independence**: You MUST IGNORE the numeric order of the [CATEGORY DEFINITIONS] list below.
     * **Shuffle Mandatory**: The final list of 6 items MUST be shuffled in terms of category types.
     * **Anti-Clustering**: Even if the sentiment is biased (e.g., 5 Slanders), do NOT output them in a contiguous block if possible. Interleave them with the minority category.
     * **Failure Condition**: Generating items in the exact order of 1->2->3->4->5->6 is a CRITICAL FAILURE.

   - **[CATEGORY DEFINITIONS]**:
     1. **[Distortion] (황당한 착각)**: Misinterpreting traits absurdly (e.g., seeing kindness as a trap).
     2. **[Slander] (악의적 음해)**: Malicious lies and baseless rumors.
     3. **[Romantic Scandal] (핑크빛 망상)**: False dating rumors or shipping.
     4. **[Fanaticism] (맹목적 신격화)**: Praising flaws as virtues, cult-like worship.
     5. **[Fact Bomb] (팩트 폭력)**: Painful truths that hit the nail on the head.
     6. **[General Opinion] (대중 의견)**: Neutral or factual observations, not aggressive.

   - **[CONTEXT RULE]**: Reflection of recent events (War, Betrayal, Romance) is mandatory. The rumors must feel "fresh".
   - **[STYLE]**: Maintain world immersion.
`;
