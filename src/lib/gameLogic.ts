export interface LevelInfo {
    level: number;
    baseXP: number;
    targetXP: number;
    remainingXP: number;
    progressPercentage: number;
}

/**
 * Calculates level information based on total XP.
 * Level 1: 0-100 (range 100)
 * Level 2: 100-250 (range 150)
 * Level 3: 250-450 (range 200)
 * etc...
 */
export function calculateLevelInfo(totalXP: number): LevelInfo {
    let currentLevel = 1;
    let baseXP = 0;
    let increment = 100;
    let targetXP = baseXP + increment;

    let remainingXP = totalXP;

    while (remainingXP >= increment) {
        remainingXP -= increment;
        baseXP += increment;
        currentLevel++;
        increment += 50;
        targetXP = baseXP + increment;
    }

    const levelRange = increment;
    const progressPercentage = Math.min(100, Math.max(0, (remainingXP / levelRange) * 100));

    return {
        level: currentLevel,
        baseXP,
        targetXP,
        remainingXP,
        progressPercentage
    };
}
