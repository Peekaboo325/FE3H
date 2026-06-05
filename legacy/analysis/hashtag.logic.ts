

/**
 * [해시태그 생성 통합 로직 v2.0: MEME & META]
 * 캐릭터 분석 및 관계 분석에서 공통으로 사용되는 해시태그 생성 지침입니다.
 * 변경점: 엄격한 세계관 용어 제한을 해제하고, 직관적인 현대적 슬랭/밈 사용을 권장합니다.
 */

// 1. 공통 규칙 (스타일 및 포맷)
export const HASHTAG_COMMON_RULES = `
[HASHTAG FORMAT RULES - ABSOLUTE]
1. **NO SPACES**: Never use spaces. Combine words. (e.g. "Dangerous Love" -> "DangerousLove")
2. **NO SYMBOLS**: Do NOT include the '#' symbol in the output text.
3. **NO PARENTHESES**: Do NOT use brackets/parentheses. Merge the context.
4. **LENGTH**: Keep it short and punchy (under 15 characters).

[STYLE EXCEPTION: "THE INTERNET MEME" PROTOCOL]
- **ALLOW MODERN SLANG**: For hashtags ONLY, you are allowed to use **Modern Internet Slang, Memes, and MBTI terms** widely used in Korean communities (Namuwiki, Twitter, etc.).
- **GOAL**: Humor, Satire, and Instant Intuition.
`;

// 2. 캐릭터 분석용 해시태그 로직
export const CHARACTER_HASHTAG_LOGIC = `
[HASHTAG CONTENT RULES: CHARACTER]
- Provide exactly **5 hashtags**.
- **SCOPE**: Describe **${'{CHAR_NAME}'}'s Identity** using modern, witty, and meta-fictional keywords.
- **Mix Strategy**:
  * 2 Tags: Core Traits (Serious/Cool)
  * 3 Tags: **Witty/Meme Traits (Funny/Meta/Otaku)**
- **Objective**: Make the user laugh or nod immediately upon reading.
`;