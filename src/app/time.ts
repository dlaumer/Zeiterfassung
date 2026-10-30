/** Round each entered duration to the nearest 15 minutes; ties round up. */
export const roundQuarterHour = (hours: number) => Math.round((hours + Number.EPSILON) * 4) / 4;
