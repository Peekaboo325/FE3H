
export const getItemsLogic = (targetCount: number, existingItems: string[] = []) => `
7. [NEW] BELONGINGS (INVENTORY) - **LOGIC v6.0: "THE FÓDLAN FLAVOR"**:
   - **QUANTITY RULE (ABSOLUTE)**: Generate EXACTLY ${targetCount} items.
   - Do NOT generate fewer or more than ${targetCount}.
   - **Target Count**: ${targetCount}

   ${existingItems.length > 0 ? `
   - **[RULE 0: DIVERSITY & ANTI-DUPLICATION]**:
     * **Existing Items**: ${existingItems.join(', ')}
     * **Instruction**: Do NOT generate items that are identical or too similar to the existing ones. 
     * **Variety**: Ensure a diverse range of items that expand the character's narrative.
   ` : ""}

   - **[RULE 1: ERA & LORE FIREWALL (SAFETY PROTOCOL)]**:
     * **NO HERO RELICS / SACRED WEAPONS**: Absolutely NO Creator Sword, Areadbhar, Luin, Failnaught, etc. These are plot devices, not pocket lint.
     * **NO UNIQUE GAME ITEMS**: NO March Ring, Experience Gem, Goddess Ring.

   - **[RULE 2: THE "30% PROVENANCE" RULE (FLAVOR TEXT)]**:
     * **Objective**: About 30% of items MUST imply a specific cultural origin using [WORLD TERMINOLOGY DATABASE].
     * **Guideline**: Do NOT mechanically attach a city name. Reflect the **culture, climate, or faction** of the origin.

   - **[RULE 3: EMOJI INTEGRITY]**: 
     * The 'emoji' field MUST contain exactly ONE standard Unicode emoji. 
     * **ABSOLUTELY NO HANJA**, NO Korean/English text, and NO numbers. 
     * If no perfect emoji exists, use a generic box 📦 as a fallback.

   - **[RULE 4: DESCRIPTION STYLE (Inference Only)]**:
     * **Name Length (Recommended)**: Max 15 characters (Korean).
     * **Description Length**: Max 25 characters (Korean).
     * **Single Sentence**: The description MUST be exactly ONE sentence. Do NOT use double dots (..).
     * **NO Definitive Facts**: Never say "Gift from Edelgard", "Bought in Enbarr".
     * **Allowed Formats**: 
       1. **Inference (~인 것 같다/~듯하다)**: "소중한 물건인 것 같다.", "오래된 듯하다."
       2. **Sensory (~향/느낌)**: "희미한 혈향이 난다.", "묵직함이 느껴진다."
       3. **State (~있다/상태)**: "손때가 묻어 있다.", "날이 무뎌진 상태."
`;