
import { AU_GUIDELINES, STRICT_TERMINOLOGY, FODLAN_PROPER_NOUNS } from '../../../core.constants';

export type ChronicleField = 'summary' | 'key_events' | 'major_dialogues' | 'tags' | 'meta' | 'state_changes' | 'seeds';

export const getChroniclePrompt = (context: string, range: string, field?: ChronicleField) => {
  const basePrompt = `
You are the **'World State Manager'** and **'Royal Historian'** of Fódlan.
Your task is to convert the following narrative segment into a structured **"Chronicle Database Entry"**.

[SCOPE]
${range}

[RAW RECORDS]
${context}

[GUIDELINES]
${AU_GUIDELINES}
${STRICT_TERMINOLOGY}
${FODLAN_PROPER_NOUNS}

[SAFETY PROTOCOLS & CONSTRAINTS v4.6.1]
1. **DEEP ANALYSIS**: Focus intensely on the requested field to ensure high-fidelity extraction.
2. **NO HALLUCINATION**: If data is not explicitly mentioned, leave it empty.
3. **KOREAN ONLY**: All output must be in natural Korean.
4. **FACTUAL & CONCISE**: Prefer dry, historical accuracy over flowery literary expressions.
5. **DATA-CENTRIC TONE**: The goal is to create a searchable database, not a novel. Avoid abstract metaphors.
6. **DATE SCRUBBING**: 
   - **DO NOT** include dates (e.g., '제국력 1180년...', '거목의 달...') in [SUMMARY] or [KEY EVENTS]. 
   - The header already contains date info. Redundant date text is considered "Garbage Data".
7. **DIALOGUE INTEGRITY**: 
   - **DO NOT** include a speaker if their dialogue line is empty or just whitespace. 
   - Every object in "major_dialogues" **MUST** have a valid, non-empty "line".
`;

  if (!field) {
    return basePrompt + `
[CORE INSTRUCTIONS - FULL ARCHIVE MODE]
Extract ALL fields with high precision. Do not skip details.
**NOTE**: Do NOT generate 'seeds' (Mysteries) in this mode. Leave it for manual pursuit.

1. **TITLE**: Concise factual summary. '[Subject]가 [Action]하다' format. Max 20 chars.
2. **SUMMARY**: Event-based summary. **NEVER start with dates.** Max 300 chars.
3. **MAJOR DIALOGUES**: Extract 3-5 iconic, impactful lines. **ABSOLUTE RULE**: Skip entries with empty lines.
4. **STATE CHANGES**: Track 2-4 major status updates. Category MUST be exactly 2 Korean chars.
5. **KEY EVENTS**: List 3-5 pivotal events. **STRICTLY PROHIBIT any date or time mentions.**
6. **TAGS**: Categorize persons, places, topics, items, and sentiments.

[OUTPUT JSON FORMAT]
{
  "title": "string",
  "summary": "string",
  "state_changes": [{"category": "string", "content": "string"}],
  "major_dialogues": [{"speaker": "string", "line": "string"}],
  "key_events": ["string"],
  "tags": {"person": [], "place": [], "topic": [], "item": [], "sentiment": []},
  "contained_episodes": [number],
  "date": "string"
}
`;
  }

  const fieldInstructions: Record<ChronicleField, string> = {
    meta: `Create a **STRICLY INFORMATIVE and FACTUAL** TITLE. 
           - **FORMAT**: '[Subject]가 [Action]하다'.
           - **NO POETRY**: Avoid metaphors.
           - **STATE CHANGES**: Track changes with exactly **2 Korean characters** for category (e.g., '인물', '관계', '정치', '심리', '신분').
           - **LENGTH**: Title limit of **20 Korean characters**.`,
    summary: `RE-SUMMARIZE the narrative into a **FACTUAL and CONCRETE** record.
           - **FOCUS**: Concrete plot progression, physical actions, and clear causality.
           - **NO DATES**: Do NOT start sentences with dates or episode numbers.
           - **NO FLOWERY PROSE**: Absolutely avoid poetic metaphors.
           - **STRUCTURE**: Use 'A가 B하다' format.
           - **LENGTH**: Under 300 characters.`,
    key_events: "LIST the 3-5 most important events. **ABSOLUTE RULE**: Do NOT include any date, time, or moon information in the descriptions.",
    major_dialogues: "EXTRACT 3-5 iconic dialogue lines. **STRICT RULE**: Only include entries where 'line' has actual text. No empty strings.",
    tags: "IDENTIFY key tags for: person (Active only), place, topic, item, and sentiment (atmosphere).",
    state_changes: `Track exactly 2-4 major state changes.
           - **CONSTRAINT**: Category name MUST be exactly **2 Korean characters**. (e.g. '인물', '관계', '정치', '신분', '심리', '정보', '장소')`,
    seeds: `**[SPECIAL TASK: MYSTERY PURSUIT]**
           Analyze the subtext and foreshadowing in the records.
           - Extract 2-4 unsolved mysteries or future plot seeds (떡밥).
           - Focus on what ISN'T said, but implied.
           - Be sharp and intriguing.`
  };

  const fieldSchemas: Record<ChronicleField, string> = {
    meta: '{"title": "string", "state_changes": [{"category": "string", "content": "string"}], "contained_episodes": [number]}',
    summary: '{"summary": "string"}',
    key_events: '{"key_events": ["string"]}',
    major_dialogues: '{"major_dialogues": [{"speaker": "string", "line": "string"}]}',
    tags: '{"tags": {"person": [], "place": [], "topic": [], "item": [], "sentiment": []}}',
    state_changes: '{"state_changes": [{"category": "string", "content": "string"}]}',
    seeds: '{"seeds": ["string"]}'
  };

  return basePrompt + `
[SPECIFIC TASK: SPECIALIZED EXTRACTION]
Your focus is ONLY the [${field}] section. 
Instruction: ${fieldInstructions[field]}

[OUTPUT JSON FORMAT]
Return ONLY a JSON object:
${fieldSchemas[field]}
`;
};
