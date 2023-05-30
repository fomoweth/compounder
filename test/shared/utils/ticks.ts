const MIN_TICK = -887272;
const MAX_TICK = -MIN_TICK;

export const getNearestUsableTick = (
    tick: number,
    tickSpacing: number
): number => {
    if (tickSpacing <= 0) {
        throw new Error("Tick spacing must be greater than 0");
    }

    if (tick < MIN_TICK || tick > MAX_TICK) {
        throw new Error("Tick out of bound");
    }

    const rounded = Math.round(tick / tickSpacing) * tickSpacing;

    if (rounded < MIN_TICK) {
        return rounded + tickSpacing;
    } else if (rounded > MAX_TICK) {
        return rounded - tickSpacing;
    } else {
        return rounded;
    }
};

export const tickBands = (
    tick: number,
    percentage: number,
    tickSpacing: number
): { tickLower: number; tickUpper: number } => {
    const [tickLower, tickUpper] = [
        tick * ((100 - percentage) / 100),
        tick * ((100 + percentage) / 100),
    ].sort((a, b) => a - b);

    return {
        tickLower: getNearestUsableTick(tickLower, tickSpacing),
        tickUpper: getNearestUsableTick(tickUpper, tickSpacing),
    };
};
