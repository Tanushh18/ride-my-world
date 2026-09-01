/**
 * Where the areas sit and how big they are.
 *
 * Separate from the content files on purpose: a project describes itself, the
 * world describes where projects are put. Adding a project therefore never
 * involves choosing coordinates — the ring re-spaces itself.
 */
export default {
    projectsArea: {
        // 87.7 units from spawn. Fog is near 55 / far 190, so the buildings read
        // as a silhouette on the horizon from the spawn point, which is the only
        // thing telling a visitor there is somewhere to go. Moving this closer or
        // further needs a look at Game/Fog.js.
        center: { x: 62, z: -62 },

        ringRadius: 26,

        // atan2(-z, -x) of the centre: the bearing back towards spawn. The ring
        // leaves its gap here, so the visitor arrives through the entrance.
        entranceFacing: Math.PI * 0.75,

        // Buildings occupy the far 198 degrees, leaving a wide way in
        spread: Math.PI * 1.1,

        zoneRadius: 11,
        zoneHysteresis: 1.25,

        // Scenery keeps trees out of this circle
        clearingRadius: 40
    }
}
