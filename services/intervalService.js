/**
 * Interval Mathematics & Watched Interval Utilities for E12
 * Handles merging overlapping intervals, computing unique coverage, and validating progression.
 */

/**
 * Merge an array of intervals [[start, end], ...] into non-overlapping disjoint intervals
 * e.g. [[0, 100], [50, 150], [200, 300]] => [[0, 150], [200, 300]]
 */
export function mergeIntervals(intervals = []) {
    if (!Array.isArray(intervals) || intervals.length === 0) return [];

    // Filter valid intervals where end >= start and values are non-negative finite numbers
    const valid = intervals
        .map(([start, end]) => [Math.max(0, Math.floor(Number(start))), Math.max(0, Math.floor(Number(end)))])
        .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end >= start);

    if (valid.length === 0) return [];

    // Sort by start asc, then end asc
    valid.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    const merged = [valid[0]];

    for (let i = 1; i < valid.length; i++) {
        const current = valid[i];
        const last = merged[merged.length - 1];

        // If current interval overlaps or is adjacent (touching) with last, merge them
        if (current[0] <= last[1]) {
            last[1] = Math.max(last[1], current[1]);
        } else {
            merged.push(current);
        }
    }

    return merged;
}

/**
 * Calculate total unique seconds from merged intervals
 */
export function calculateUniqueSeconds(mergedIntervals = []) {
    return mergedIntervals.reduce((acc, [start, end]) => acc + (end - start), 0);
}

/**
 * Check if unique watched intervals cover 100% of duration
 * Allows 1-2 second tolerance for video player container duration rounding at the boundary
 */
export function isFullCoverage(mergedIntervals = [], durationSeconds = 0) {
    if (!durationSeconds || durationSeconds <= 0) return false;
    const unique = calculateUniqueSeconds(mergedIntervals);

    // If unique seconds >= durationSeconds - 2s tolerance (or full coverage from [0, duration])
    if (unique >= durationSeconds - 2) {
        // Also check that it covers near the beginning (<= 5s) and near the end (>= duration - 5s)
        const coversStart = mergedIntervals.some(([s, _]) => s <= 5);
        const coversEnd = mergedIntervals.some(([_, e]) => e >= durationSeconds - 5);
        return coversStart && coversEnd;
    }

    return false;
}

