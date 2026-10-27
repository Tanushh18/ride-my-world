/**
 * Shared route-space layout for the lived-in boulevard. Route coordinates are
 * `t` (progress) and `offset` (lateral metres, +side / -side of the centre line).
 */
export const LAYOUT = {
    // One-way lanes either side of the centre line (rider keeps the middle)
    laneA: { offset: -2.65, tMin: 0.78, tMax: 0.995 },   // forward traffic, towards the airport
    busLane: { offset: 2.7 },                              // stopped bus beside the shelter
    busStop: { t: 0.86, side: 1, offset: 11.25 },
    crossing: { t: 0.755 },                                // pedestrian crossing, outside traffic range
    sidewalkWalk: { offset: 7.4 },
    cyclist: { offset: -5.6, tMin: 0.72, tMax: 0.99 },
    cafe: { t: 0.718, side: -1, offset: 12.6 },
    vendor: { t: 0.895, side: 1, offset: 10.6 },
    junction: { t: 0.745, side: 1 },
    cityStart: 0.68
}
