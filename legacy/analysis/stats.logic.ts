
export const STATS_ANALYSIS_LOGIC = `
4. [CRITICAL] STAT SCORING RULES - "Flaws make Character":
   - BASELINE: 50 = Average Soldier/Student. 80 = Elite/Expert. 95+ = Historic Legend. 30 or lower = Fatal Flaw.
   - LAW OF EQUIVALENT EXCHANGE: If the character has high stats (>80) in some areas, they MUST have low stats (<40) in others.
     * High Physical (Prowess) -> Consider Low Magic/Intellect.
     * High Magic (Magic Power) -> Consider Low Prowess/Strength.
     * High Status (Royal/Noble) -> Consider Low Resilience (Mental pressure) or Charm (Arrogance).
   - SITUATIONAL REALISM: 
     * If fugitive/exile/prisoner -> Status and Wealth MUST be near 0-20.
   - FAITH (Seiros) RULES:
     * Empire (Adrestia) -> Usually Low Faith (<30) due to Edelgard's influence.
     * Kingdom (Faerghus) -> Usually High Faith (>70).
   - OBJECTIVE: Avoid "Full Hexagon" (High everywhere). Create a JAGGED, SPIKY profile that highlights weaknesses.

5. STAT COMMENTS (Evaluation Notes):
   - For EACH stat, provide a one-line evaluation (under 25 characters).
   - Explain WHY the score is high or low.
   - Format: Short, punchy, instructor-style comment.
   - Example: "Born with Herculean strength" / "Openly despises the Church"
`;
