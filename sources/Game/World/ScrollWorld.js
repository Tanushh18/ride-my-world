import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * Additional landmarks for the scroll tour. This environment is procedural,
 * keeping the repo lightweight and avoiding dependency on external model URLs.
 */
export class ScrollWorld
{
    constructor(game)
    {
        this.game = game
        this.group = new THREE.Group()
        this.group.name = 'ScrollTourWorld'
        game.scene.add(this.group)

        this.roadPoints = [
            [-130, 55], [-118, 42], [-106, 24], [-100, 4],
            [-84, -12], [-66, -3], [-48, 8], [-28, 12],
            [-10, -3], [2, -20], [15, -34], [30, -45],
            [43, -56], [60, -67], [76, -79], [91, -90],
            [108, -98], [126, -108]
        ]
        this.waterfallStreams = []

        this.addRoad()
        this.addRiverAndWaterfall()
        this.addBridge()
        this.addCity()
        this.addLearningHub()
        this.addAirport()

        // One listener on the existing renderer-owned ticker keeps water
        // movement synchronized without starting another animation loop.
        this.game.ticker.events.on('tick', () => { this.animateWater() }, 30)
    }

    material(color, options = {})
    {
        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.84,
            metalness: 0.02,
            ...options
        })
    }

    addRoad()
    {
        const points = this.roadPoints.map(([x, z]) => new THREE.Vector3(x, 0.12, z))
        this.roadCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.18)
        const samples = this.roadCurve.getPoints(260)
        const positions = []
        const indices = []

        for(let i = 0; i < samples.length; i++)
        {
            const point = samples[i]
            const tangent = this.roadCurve.getTangent(i / (samples.length - 1)).setY(0).normalize()
            const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
            const halfWidth = 4.4

            positions.push(
                point.x + side.x * halfWidth, point.y, point.z + side.z * halfWidth,
                point.x - side.x * halfWidth, point.y, point.z - side.z * halfWidth
            )

            if(i < samples.length - 1)
            {
                const a = i * 2
                indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
            }
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geometry.setIndex(indices)
        geometry.computeVertexNormals()

        const road = new THREE.Mesh(geometry, this.material('#35464a', { roughness: 1, side: THREE.DoubleSide }))
        road.receiveShadow = true
        this.group.add(road)

        const edgeMaterial = new THREE.LineBasicMaterial({ color: '#e8c88f', transparent: true, opacity: 0.72 })
        const centerMaterial = new THREE.LineBasicMaterial({ color: '#f6e7bf', transparent: true, opacity: 0.82 })

        for(const sideSign of [-1, 1])
        {
            const edgePoints = []
            for(let i = 0; i < samples.length; i += 2)
            {
                const tangent = this.roadCurve.getTangent(i / (samples.length - 1)).setY(0).normalize()
                const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
                edgePoints.push(samples[i].clone().addScaledVector(side, sideSign * 4.15).setY(0.16))
            }
            this.group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(edgePoints),
                edgeMaterial
            ))
        }

        const dashPoints = []
        for(let i = 0; i < samples.length - 1; i += 12)
        {
            dashPoints.push(samples[i].clone().setY(0.17))
            dashPoints.push(samples[Math.min(i + 5, samples.length - 1)].clone().setY(0.17))
        }
        this.group.add(new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(dashPoints),
            centerMaterial
        ))

        const curbMaterial = this.material('#c5bd9d')
        for(const sideSign of [-1, 1])
        {
            const curbPoints = []
            for(let i = 0; i < samples.length; i += 3)
            {
                const tangent = this.roadCurve.getTangent(i / (samples.length - 1)).setY(0).normalize()
                const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
                curbPoints.push(samples[i].clone().addScaledVector(side, sideSign * 4.55))
            }
            const curbCurve = new THREE.CatmullRomCurve3(curbPoints)
            this.group.add(new THREE.Mesh(
                new THREE.TubeGeometry(curbCurve, 160, 0.07, 5, false),
                curbMaterial
            ))
        }
    }

    addRiverAndWaterfall()
    {
        this.riverMaterial = this.material('#328f99', {
            roughness: 0.26,
            metalness: 0.2,
            transparent: true,
            opacity: 0.87
        })
        const river = new THREE.Mesh(new THREE.PlaneGeometry(42, 15), this.riverMaterial)
        river.rotation.x = -Math.PI / 2
        river.rotation.y = -0.42
        river.position.set(8, 0.2, -32)
        river.receiveShadow = true
        this.group.add(river)

        const bankMaterial = this.material('#6d916e')
        for(const side of [-1, 1])
        {
            const bank = new THREE.Mesh(new THREE.BoxGeometry(45, 0.55, 2.3), bankMaterial)
            bank.position.set(8 + side * 1.2, 0.05, -32 + side * 8.5)
            bank.rotation.y = -0.42
            this.group.add(bank)
        }

        const cliff = new THREE.Mesh(
            new THREE.BoxGeometry(3.2, 9, 12),
            this.material('#647b6c')
        )
        cliff.position.set(30, 4.25, -42)
        this.group.add(cliff)

        for(let i = 0; i < 5; i++)
        {
            const stream = new THREE.Mesh(
                new THREE.PlaneGeometry(0.7 + (i % 2) * 0.28, 6.8 + (i % 3) * 0.6),
                new THREE.MeshBasicMaterial({
                    color: i % 2 ? '#8ee6e0' : '#d1fff0',
                    transparent: true,
                    opacity: 0.46,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            )
            stream.position.set(28.34, 3.6, -46.4 + i * 1.9)
            stream.rotation.y = Math.PI / 2
            this.group.add(stream)
            this.waterfallStreams.push(stream)
        }

        const mistMaterial = new THREE.MeshBasicMaterial({
            color: '#d8fff1',
            transparent: true,
            opacity: 0.14,
            depthWrite: false
        })
        for(let i = 0; i < 8; i++)
        {
            const mist = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (i % 3) * 0.35, 8, 6), mistMaterial)
            mist.position.set(27.7 + (i % 3) * 0.35, 0.6 + (i % 4) * 0.14, -42 + i * 1.15)
            mist.scale.y = 0.45
            this.group.add(mist)
        }
    }

    addBridge()
    {
        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(18, 0.45, 8.8),
            this.material('#9a9c8f')
        )
        deck.position.set(8, 0.3, -27)
        deck.rotation.y = 0.78
        deck.receiveShadow = true
        this.group.add(deck)

        const railMaterial = this.material('#e3c48e', { metalness: 0.12 })
        for(const side of [-1, 1])
        {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 0.7, 0.16), railMaterial)
            rail.position.set(8, 0.78, -27 + side * 4.25)
            rail.rotation.y = 0.78
            this.group.add(rail)
        }
    }

    addCity()
    {
        const facade = [
            this.material('#50696b'),
            this.material('#40575f'),
            this.material('#657d7b'),
            this.material('#364b55')
        ]
        const glass = this.material('#a4d9d1', {
            roughness: 0.32,
            metalness: 0.12,
            emissive: '#244c4c',
            emissiveIntensity: 0.18
        })

        // Keep the existing project plaza around (62, -62) unobstructed.
        // The denser skyline begins beyond it, toward the airport approach.
        const blocks = [
            [99, -52, 8, 17, 8], [113, -60, 10, 25, 8], [139, -54, 9, 20, 10],
            [99, -72, 12, 31, 10], [114, -82, 9, 23, 8], [141, -76, 11, 38, 11],
            [99, -93, 8, 29, 9], [145, -91, 10, 26, 10], [99, -111, 8, 16, 9],
            [146, -112, 9, 22, 8], [96, -126, 9, 19, 8], [143, -130, 10, 24, 9]
        ]

        const windowGeometry = new THREE.BoxGeometry(0.38, 0.52, 0.08)
        const litWindows = new THREE.InstancedMesh(windowGeometry, glass, 520)
        const dummy = new THREE.Object3D()
        let index = 0

        for(let buildingIndex = 0; buildingIndex < blocks.length; buildingIndex++)
        {
            const [x, z, width, height, depth] = blocks[buildingIndex]
            const building = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, depth),
                facade[buildingIndex % facade.length]
            )
            building.position.set(x, height / 2, z)
            building.castShadow = true
            building.receiveShadow = true
            this.group.add(building)

            const floors = Math.floor(height / 3.3)
            for(let floor = 1; floor < floors; floor++)
            {
                for(let windowIndex = 0; windowIndex < Math.max(2, Math.floor(width / 1.6)); windowIndex++)
                {
                    if(index >= 520)
                        break

                    const wx = x - width / 2 + 0.8 + windowIndex * 1.5
                    const wy = floor * 3.05
                    dummy.position.set(wx, wy, z + depth / 2 + 0.045)
                    dummy.scale.set(1, 1, 1)
                    dummy.updateMatrix()
                    litWindows.setMatrixAt(index++, dummy.matrix)
                }
            }
        }

        litWindows.count = index
        litWindows.instanceMatrix.needsUpdate = true
        litWindows.computeBoundingSphere()
        this.group.add(litWindows)

        const lampMaterial = new THREE.MeshBasicMaterial({ color: '#ffd48e' })
        for(const [x, z] of [[36, -58], [53, -71], [70, -83], [88, -94], [108, -101]])
        {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.5, 6), this.material('#d4c6a2'))
            pole.position.set(x, 1.75, z)
            this.group.add(pole)

            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), lampMaterial)
            lamp.position.set(x, 3.55, z)
            this.group.add(lamp)
        }
    }



    addLearningHub()
    {
        // A quiet library/campus landmark connects the city tour with the
        // education and learning chapter without pretending to be a real school.
        const stone = this.material('#b9bba6', { roughness: 0.7 })
        const roofMaterial = this.material('#385b58', { roughness: 0.55 })
        const glass = this.material('#94d6cb', {
            roughness: 0.28,
            metalness: 0.12,
            emissive: '#285653',
            emissiveIntensity: 0.2
        })

        const mainBuilding = new THREE.Mesh(new THREE.BoxGeometry(16, 5.4, 9), stone)
        mainBuilding.position.set(84, 2.7, -107)
        mainBuilding.castShadow = true
        mainBuilding.receiveShadow = true
        this.group.add(mainBuilding)

        const roof = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.55, 10.5), roofMaterial)
        roof.position.set(84, 5.65, -107)
        this.group.add(roof)

        const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(13.5, 2.6, 0.14), glass)
        frontGlass.position.set(84, 2.8, -102.42)
        this.group.add(frontGlass)

        const steps = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 2.1), stone)
        steps.position.set(84, 0.15, -100.7)
        this.group.add(steps)

        const pillarGeometry = new THREE.CylinderGeometry(0.22, 0.28, 4.2, 8)
        for(const x of [78.5, 82.2, 85.8, 89.5])
        {
            const pillar = new THREE.Mesh(pillarGeometry, stone)
            pillar.position.set(x, 2.6, -102.15)
            pillar.castShadow = true
            this.group.add(pillar)
        }

        const marker = new THREE.Mesh(
            new THREE.BoxGeometry(2.8, 0.5, 0.16),
            this.material('#f2b879', { emissive: '#604629', emissiveIntensity: 0.18 })
        )
        marker.position.set(84, 4.75, -102.28)
        this.group.add(marker)
    }

    animateWater()
    {
        const time = this.game.ticker.elapsed

        // Tiny material and stream changes suggest moving water without a
        // costly full fluid simulation or a second render loop.
        if(this.riverMaterial)
            this.riverMaterial.opacity = 0.84 + Math.sin(time * 0.9) * 0.025

        this.waterfallStreams.forEach((stream, index) =>
        {
            stream.position.y = 3.6 + Math.sin(time * 2.1 + index * 0.7) * 0.13
            stream.material.opacity = 0.42 + Math.sin(time * 1.7 + index) * 0.045
        })
    }

    addAirport()
    {
        const terminal = new THREE.Mesh(
            new THREE.BoxGeometry(28, 7, 12),
            this.material('#b7c3b3', { roughness: 0.42, metalness: 0.08 })
        )
        terminal.position.set(126, 3.5, -112)
        terminal.castShadow = true
        this.group.add(terminal)

        const glass = this.material('#8bd5d0', {
            roughness: 0.22,
            metalness: 0.16,
            emissive: '#244d50',
            emissiveIntensity: 0.25
        })
        const windowBand = new THREE.Mesh(new THREE.BoxGeometry(28.1, 2.5, 0.16), glass)
        windowBand.position.set(126, 3.7, -105.9)
        this.group.add(windowBand)

        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(31, 0.55, 14.5),
            this.material('#52666a')
        )
        roof.position.set(126, 7.2, -112)
        this.group.add(roof)

        const tower = new THREE.Mesh(
            new THREE.BoxGeometry(5, 18, 5),
            this.material('#6e8784')
        )
        tower.position.set(141, 9, -105)
        this.group.add(tower)

        const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 10, 8),
            new THREE.MeshBasicMaterial({ color: '#ffd48e' })
        )
        beacon.position.set(141, 18.5, -105)
        this.group.add(beacon)

        const runway = new THREE.Mesh(
            new THREE.PlaneGeometry(48, 9),
            this.material('#3e5052', { roughness: 1, side: THREE.DoubleSide })
        )
        runway.rotation.x = -Math.PI / 2
        runway.rotation.z = -0.5
        runway.position.set(139, 0.08, -126)
        this.group.add(runway)

        const stripeMaterial = new THREE.MeshBasicMaterial({ color: '#e4d8b8' })
        for(let i = 0; i < 6; i++)
        {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.035, 0.22), stripeMaterial)
            stripe.position.set(122 + i * 5.5, 0.12, -126 - i * 2.9)
            stripe.rotation.y = -0.5
            this.group.add(stripe)
        }
    }
}
