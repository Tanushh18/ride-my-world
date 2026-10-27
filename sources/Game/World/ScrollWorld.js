import * as THREE from 'three/webgpu'
import { color as tslColor, mix as tslMix, uniform as tslUniform } from 'three/tsl'
import portfolio from '../../data/portfolio.js'

const smoothstep = (edge0, edge1, value) =>
{
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

/**
 * One connected, original low-poly world for the scooter journey.
 * The route curve is shared by the road, camera, rider, boulevard trees,
 * city-block placement, and airport approach.
 */
export class ScrollWorld
{
    constructor(game)
    {
        this.game = game
        this.group = new THREE.Group()
        this.group.name = 'CinematicScrollWorld'
        game.scene.add(this.group)
        this.waterfallStreams = []
        this.riverMaterial = null
        this.energyInstances = null
        this.moteGeometry = null
        this.moteBaseY = new Float32Array(0)
        this.motePhase = new Float32Array(0)
        this.storyBoards = []
        this.storyBoardData = []
        this.riftGates = []
        this.facadeLabels = []
        this.aircraft = null
        this.airportPamphlet = null
        this.paperNote = null

        this.roadPoints = [
            [-130, 55], [-118, 42], [-106, 24], [-100, 4],
            [-84, -12], [-66, -3], [-48, 8], [-28, 12],
            [-10, -3], [2, -20], [15, -34], [30, -45],
            [43, -56], [60, -67], [76, -79], [91, -90],
            [108, -98], [126, -108]
        ]

        const points = this.roadPoints.map(([x, z]) => new THREE.Vector3(x, 0.12, z))
        this.roadCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.18)
        this.roadLength = this.roadCurve.getLength()

        this.addLighting()
        this.addMountains()
        this.addRoad()
        this.addRoadsideTrees()
        this.addRiverAndWaterfall()
        this.addBridge()
        this.addSidewalks()
        this.addCity()
        this.addTramTracks()
        this.addCrosswalks()
        this.addStreetLife()
        this.addRiftGates()
        this.addLearningHub()
        this.addAirport()
        this.addSunDisk()
        this.addLightTrails()
        this.addAmbientParticles()
        this.addStoryBoards()

        // Reuse the renderer-owned ticker for water, particles and light motion.
        this.game.ticker.events.on('tick', () =>
        {
            this.animateWater()
            this.animateEffects()
            this.animateStorytelling()
        }, 30)
    }

    material(hexColor, options = {})
    {
        // The world intentionally shares the portfolio's custom sunset fog.
        // A node material applies that fog to the procedural architecture too,
        // so distant buildings melt into the horizon rather than ending abruptly.
        const fog = this.game.fog
        const baseColor = tslUniform(tslColor(hexColor))
        const material = new THREE.MeshStandardNodeMaterial({
            color: hexColor,
            roughness: options.roughness ?? 0.82,
            metalness: options.metalness ?? 0.02,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            side: options.side ?? THREE.FrontSide,
            depthWrite: options.depthWrite ?? true,
            emissive: options.emissive ?? '#000000',
            emissiveIntensity: options.emissiveIntensity ?? 0
        })

        material.colorNode = tslMix(baseColor, fog.colorUniform, fog.strengthNode)
        return material
    }

    routeFrame(t)
    {
        const position = this.roadCurve.getPointAt(THREE.MathUtils.clamp(t, 0, 1))
        const tangent = this.roadCurve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1)).setY(0).normalize()
        const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
        const yaw = Math.atan2(-tangent.z, tangent.x)
        return { position, tangent, side, yaw }
    }


    addLighting()
    {
        // Cool sky fill and a warm, non-shadow-casting rim light give the
        // pastel façades depth without flattening the sun shadows.
        const skyFill = new THREE.HemisphereLight('#ffd8d2', '#4c425e', 0.88)
        this.group.add(skyFill)

        const warmRim = new THREE.DirectionalLight('#f4b7a5', 0.48)
        warmRim.position.set(-95, 72, 108)
        warmRim.castShadow = false
        this.group.add(warmRim)
    }

    addMountains()
    {
        // Faceted mountain silhouettes create distance layers behind the
        // jungle/city horizon, fading naturally through the shared scene fog.
        const materials = [
            this.material('#524b67', { roughness: 1 }),
            this.material('#716078', { roughness: 1 }),
            this.material('#957186', { roughness: 1 })
        ]
        const peaks = [
            [-192, 62, 22, 37, 30], [-175, 12, 28, 52, 35],
            [-168, -48, 28, 33, 31], [-125, -112, 40, 29, 30],
            [-32, 92, 35, 36, 28], [18, 106, 48, 30, 37],
            [82, 86, 37, 39, 29], [156, 42, 34, 47, 34],
            [182, -12, 42, 38, 30], [185, -82, 39, 49, 31],
            [174, -164, 49, 32, 31], [75, -180, 48, 26, 34]
        ]

        peaks.forEach(([x, z, width, height, depth], index) =>
        {
            const mountain = new THREE.Mesh(
                new THREE.IcosahedronGeometry(1, 1),
                materials[index % materials.length]
            )
            mountain.position.set(x, height * 0.34, z)
            mountain.scale.set(width, height, depth)
            mountain.rotation.y = index * 0.41
            mountain.castShadow = true
            mountain.receiveShadow = true
            this.group.add(mountain)
        })
    }

    addSidewalks()
    {
        // Raised curb lines and continuous stone strips make the city feel like
        // a built boulevard rather than a road placed over an empty plane.
        const material = this.material('#c3a6a3', {
            roughness: 0.97,
            side: THREE.DoubleSide
        })

        for(const sideSign of [-1, 1])
        {
            const positions = []
            const indices = []
            const steps = 280

            for(let i = 0; i <= steps; i++)
            {
                const t = 0.68 + (i / steps) * 0.32
                const frame = this.routeFrame(t)
                const inner = frame.position.clone().addScaledVector(frame.side, sideSign * 4.82).setY(0.14)
                const outer = frame.position.clone().addScaledVector(frame.side, sideSign * 9.6).setY(0.14)

                positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z)
                if(i < steps)
                {
                    const a = i * 2
                    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
                }
            }

            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
            geometry.setIndex(indices)
            geometry.computeVertexNormals()

            const sidewalk = new THREE.Mesh(geometry, material)
            sidewalk.receiveShadow = true
            this.group.add(sidewalk)
        }
    }

    addCrosswalks()
    {
        const paint = new THREE.MeshBasicMaterial({
            color: '#f5dec9',
            transparent: true,
            opacity: 0.82
        })
        const stripeGeometry = new THREE.BoxGeometry(0.46, 0.026, 8.05)

        for(const t of [0.755, 0.835, 0.915, 0.975])
        {
            const frame = this.routeFrame(t)
            for(let i = -4; i <= 4; i++)
            {
                const stripe = new THREE.Mesh(stripeGeometry, paint)
                stripe.position.copy(frame.position)
                    .addScaledVector(frame.tangent, i * 0.78)
                stripe.position.y = 0.19
                stripe.rotation.y = frame.yaw
                this.group.add(stripe)
            }
        }
    }

    addSunDisk()
    {
        const sun = new THREE.Mesh(
            new THREE.SphereGeometry(6.5, 24, 16),
            new THREE.MeshBasicMaterial({ color: '#ffe1c4' })
        )
        sun.position.set(149, 43, -186)
        this.group.add(sun)

        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(10, 20, 12),
            new THREE.MeshBasicMaterial({
                color: '#efa4ac',
                transparent: true,
                opacity: 0.12,
                depthWrite: false
            })
        )
        halo.position.copy(sun.position)
        this.group.add(halo)
    }

    addRoad()
    {
        const asphalt = this.material('#574750', { roughness: 0.96, side: THREE.DoubleSide })
        const samples = this.roadCurve.getPoints(420)
        const positions = []
        const indices = []
        const halfWidth = 4.5

        for(let i = 0; i < samples.length; i++)
        {
            const point = samples[i]
            const tangent = this.roadCurve.getTangent(i / (samples.length - 1)).setY(0).normalize()
            const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()

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

        const road = new THREE.Mesh(geometry, asphalt)
        road.receiveShadow = true
        road.renderOrder = 1
        this.group.add(road)

        const edgeMaterial = new THREE.LineBasicMaterial({ color: '#f1c9a6', transparent: true, opacity: 0.9 })
        const laneMaterial = new THREE.LineBasicMaterial({ color: '#f7e5c9', transparent: true, opacity: 0.95 })
        for(const sideSign of [-1, 1])
        {
            const edgePoints = []
            for(let i = 0; i < samples.length; i += 2)
            {
                const tangent = this.roadCurve.getTangent(i / (samples.length - 1)).setY(0).normalize()
                const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
                edgePoints.push(samples[i].clone().addScaledVector(side, sideSign * 4.16).setY(0.16))
            }
            this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePoints), edgeMaterial))
        }

        const laneSegments = []
        for(let i = 0; i < samples.length - 6; i += 13)
        {
            laneSegments.push(samples[i].clone().setY(0.17))
            laneSegments.push(samples[i + 5].clone().setY(0.17))
        }
        this.group.add(new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(laneSegments),
            laneMaterial
        ))

        const curbMaterial = this.material('#d8b9a6', { roughness: 0.68 })
        for(const sideSign of [-1, 1])
        {
            const curbPoints = []
            for(let i = 0; i < samples.length; i += 4)
            {
                const tangent = this.roadCurve.getTangent(i / (samples.length - 1)).setY(0).normalize()
                const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
                curbPoints.push(samples[i].clone().addScaledVector(side, sideSign * 4.62).setY(0.12))
            }

            const curb = new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curbPoints), 220, 0.075, 5, false),
                curbMaterial
            )
            curb.castShadow = true
            this.group.add(curb)
        }
    }

    addRoadsideTrees()
    {
        // Tree rows create a composed boulevard through the forest rather than
        // relying only on random trees scattered across a large plane.
        const placements = []
        let row = 0
        for(let t = 0.035; t <= 0.62; t += 0.052)
        {
            const frame = this.routeFrame(t)
            for(const sideSign of [-1, 1])
            {
                const offset = 10.2 + (row % 3) * 1.2
                const position = frame.position.clone().addScaledVector(frame.side, sideSign * offset)
                const scale = 0.78 + ((row * 7) % 5) * 0.095
                placements.push({ position, scale, row, yaw: frame.yaw })
                row++
            }
        }

        const trunkGeometry = new THREE.CylinderGeometry(0.21, 0.29, 1, 7)
        const foliageGeometry = new THREE.IcosahedronGeometry(1, 0)
        const trunkMaterial = this.material('#705044', { roughness: 1 })
        const canopyMaterial = this.material('#54866a', { roughness: 1 })
        const canopyTopMaterial = this.material('#7e9e70', { roughness: 1 })

        const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, placements.length)
        const canopyA = new THREE.InstancedMesh(foliageGeometry, canopyMaterial, placements.length)
        const canopyB = new THREE.InstancedMesh(foliageGeometry, canopyTopMaterial, placements.length)
        const dummy = new THREE.Object3D()

        placements.forEach((tree, index) =>
        {
            const { x, z } = tree.position
            const height = 3.5 * tree.scale

            dummy.position.set(x, height * 0.5, z)
            dummy.rotation.set(0, tree.yaw, 0)
            dummy.scale.set(tree.scale * 0.25, height, tree.scale * 0.25)
            dummy.updateMatrix()
            trunks.setMatrixAt(index, dummy.matrix)

            dummy.position.set(x, height * 0.91, z)
            dummy.rotation.set(0, tree.yaw, 0)
            dummy.scale.set(1.42 * tree.scale, 1.58 * tree.scale, 1.34 * tree.scale)
            dummy.updateMatrix()
            canopyA.setMatrixAt(index, dummy.matrix)

            dummy.position.set(x + Math.sin(tree.yaw) * 0.25, height * 1.23, z + Math.cos(tree.yaw) * 0.25)
            dummy.scale.set(1.04 * tree.scale, 1.05 * tree.scale, 1.04 * tree.scale)
            dummy.updateMatrix()
            canopyB.setMatrixAt(index, dummy.matrix)
        })

        trunks.castShadow = true
        trunks.receiveShadow = true
        trunks.instanceMatrix.needsUpdate = true
        trunks.computeBoundingSphere()
        this.group.add(trunks)

        for(const mesh of [canopyA, canopyB])
        {
            mesh.castShadow = true
            mesh.receiveShadow = true
            mesh.instanceMatrix.needsUpdate = true
            mesh.computeBoundingSphere()
            this.group.add(mesh)
        }
    }

    addRiverAndWaterfall()
    {
        this.riverMaterial = this.material('#368f9a', {
            roughness: 0.22,
            metalness: 0.16,
            transparent: true,
            opacity: 0.84,
            side: THREE.DoubleSide,
            depthWrite: false
        })

        const river = new THREE.Mesh(new THREE.PlaneGeometry(48, 16), this.riverMaterial)
        river.rotation.x = -Math.PI / 2
        river.rotation.y = -0.86
        river.position.set(15, 0.018, -34)
        river.renderOrder = 0
        this.group.add(river)

        const bankMaterial = this.material('#789477', { roughness: 1 })
        for(const sideSign of [-1, 1])
        {
            const bank = new THREE.Mesh(new THREE.BoxGeometry(47, 0.55, 1.5), bankMaterial)
            bank.position.set(15 + sideSign * 2, 0.03, -34 + sideSign * 8.9)
            bank.rotation.y = -0.86
            bank.receiveShadow = true
            this.group.add(bank)
        }

        // Compose the waterfall relative to the road frame. Previously the
        // cliff was hard-coded in world coordinates and could overlap the rider's
        // lane. This places it on the riverbank and aligns the falls to the route.
        const roadFrame = this.routeFrame(0.60)
        const waterfall = new THREE.Group()
        waterfall.position.copy(roadFrame.position).addScaledVector(roadFrame.side, 12.2)
        waterfall.rotation.y = roadFrame.yaw

        const cliff = new THREE.Mesh(
            new THREE.BoxGeometry(12, 9.2, 2.8),
            this.material('#8f7772', { roughness: 1 })
        )
        cliff.position.set(0, 4.35, 0)
        cliff.castShadow = true
        cliff.receiveShadow = true
        waterfall.add(cliff)

        const waterfallFace = new THREE.Mesh(
            new THREE.PlaneGeometry(10.8, 7.8),
            new THREE.MeshBasicMaterial({
                color: '#78d5d2',
                transparent: true,
                opacity: 0.14,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        )
        waterfallFace.position.set(0, 4.2, -1.43)
        waterfall.add(waterfallFace)

        for(let i = 0; i < 9; i++)
        {
            const stream = new THREE.Mesh(
                new THREE.PlaneGeometry(0.55 + (i % 3) * 0.18, 6.5 + (i % 4) * 0.36),
                new THREE.MeshBasicMaterial({
                    color: i % 2 ? '#9fe8e1' : '#dcfff1',
                    transparent: true,
                    opacity: 0.44,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            )
            stream.position.set(-5.1 + i * 1.28, 3.5 + (i % 3) * 0.1, -1.48)
            waterfall.add(stream)
            this.waterfallStreams.push(stream)
        }

        const mistMaterial = new THREE.MeshBasicMaterial({
            color: '#d5fff1',
            transparent: true,
            opacity: 0.12,
            depthWrite: false
        })
        for(let i = 0; i < 12; i++)
        {
            const mist = new THREE.Mesh(new THREE.SphereGeometry(0.8 + (i % 4) * 0.2, 8, 6), mistMaterial)
            mist.position.set(-5.2 + (i % 4) * 3.4, 0.45 + (i % 3) * 0.12, -0.4 + Math.floor(i / 4) * 0.65)
            mist.scale.y = 0.48
            waterfall.add(mist)
        }

        this.group.add(waterfall)
    }

    addBridge()
    {
        const frame = this.routeFrame(0.60)
        const bridge = new THREE.Group()
        bridge.position.set(frame.position.x, 0.08, frame.position.z)
        bridge.rotation.y = frame.yaw

        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(18, 0.18, 8.8),
            this.material('#b98c82', { roughness: 0.76 })
        )
        deck.position.y = 0
        deck.receiveShadow = true
        bridge.add(deck)

        const railMaterial = this.material('#f1c6a6', { roughness: 0.65 })
        const railTop = this.material('#8e5957', { roughness: 0.7 })
        for(const sideSign of [-1, 1])
        {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 0.54, 0.14), railMaterial)
            rail.position.set(0, 0.46, sideSign * 4.25)
            rail.castShadow = true
            bridge.add(rail)

            const top = new THREE.Mesh(new THREE.BoxGeometry(18, 0.11, 0.24), railTop)
            top.position.set(0, 0.78, sideSign * 4.25)
            bridge.add(top)

            for(let i = 0; i < 7; i++)
            {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.12), railMaterial)
                post.position.set(-8.1 + i * 2.7, 0.42, sideSign * 4.25)
                bridge.add(post)
            }
        }
        bridge.traverse(node =>
        {
            if(node.isMesh)
            {
                node.castShadow = true
                node.receiveShadow = true
            }
        })
        this.group.add(bridge)
    }

    addCity()
    {
        const facades = [
            this.material('#c9837e', { roughness: 0.87 }),
            this.material('#df9f8e', { roughness: 0.87 }),
            this.material('#b8787b', { roughness: 0.87 }),
            this.material('#ad8b9b', { roughness: 0.87 }),
            this.material('#e2ad98', { roughness: 0.87 }),
            this.material('#b98784', { roughness: 0.87 })
        ]
        const roofMaterials = [
            this.material('#8f626a', { roughness: 0.8 }),
            this.material('#c47d75', { roughness: 0.8 }),
            this.material('#826d83', { roughness: 0.8 })
        ]
        const baseMaterials = [
            this.material('#835d65', { roughness: 0.92 }),
            this.material('#a16c6c', { roughness: 0.92 }),
            this.material('#896c7c', { roughness: 0.92 })
        ]
        const windowMaterial = this.material('#ffe0b6', {
            roughness: 0.32,
            metalness: 0.1,
            emissive: '#9b6045',
            emissiveIntensity: 0.32
        })

        // Paired buildings sit outside the driving corridor. Their orientation
        // follows the road tangent, creating a boulevard instead of box clutter.
        const stations = [
            { t: 0.80, offset: 30, side: -1, width: 9, depth: 10, height: 18 },
            { t: 0.80, offset: 30, side: 1, width: 10, depth: 9, height: 24 },
            { t: 0.84, offset: 25, side: -1, width: 11, depth: 10, height: 27 },
            { t: 0.84, offset: 25, side: 1, width: 9, depth: 10, height: 20 },
            { t: 0.88, offset: 21, side: -1, width: 10, depth: 11, height: 32 },
            { t: 0.88, offset: 21, side: 1, width: 12, depth: 9, height: 22 },
            { t: 0.92, offset: 19, side: -1, width: 9, depth: 10, height: 25 },
            { t: 0.92, offset: 19, side: 1, width: 11, depth: 11, height: 36 },
            { t: 0.96, offset: 21, side: -1, width: 11, depth: 9, height: 28 },
            { t: 0.96, offset: 21, side: 1, width: 10, depth: 12, height: 33 },
            { t: 0.99, offset: 24, side: -1, width: 12, depth: 10, height: 24 },
            { t: 0.99, offset: 24, side: 1, width: 10, depth: 10, height: 29 }
        ]

        const windowGeometry = new THREE.BoxGeometry(0.48, 0.62, 0.075)
        const windows = []
        stations.forEach((building, buildingIndex) =>
        {
            const frame = this.routeFrame(building.t)
            const centre = frame.position.clone().addScaledVector(frame.side, building.side * building.offset)
            const assembly = new THREE.Group()
            assembly.position.set(centre.x, 0, centre.z)
            assembly.rotation.y = frame.yaw

            const facade = new THREE.Mesh(
                new THREE.BoxGeometry(building.width, building.height, building.depth),
                facades[buildingIndex % facades.length]
            )
            facade.position.y = building.height / 2
            facade.castShadow = true
            facade.receiveShadow = true
            assembly.add(facade)

            const base = new THREE.Mesh(
                new THREE.BoxGeometry(building.width + 0.12, 3.2, building.depth + 0.12),
                baseMaterials[buildingIndex % baseMaterials.length]
            )
            base.position.y = 1.6
            base.castShadow = true
            assembly.add(base)

            // Storefront glass, recessed door and a warm awning make the city
            // feel like a lived-in boulevard instead of an isolated box skyline.
            const frontZ = -building.side * (building.depth / 2 + 0.085)
            const storefront = new THREE.Mesh(
                new THREE.BoxGeometry(building.width * 0.72, 1.52, 0.09),
                windowMaterial
            )
            storefront.position.set(0, 1.28, frontZ)
            assembly.add(storefront)

            const shopDoor = new THREE.Mesh(
                new THREE.BoxGeometry(0.62, 1.92, 0.12),
                roofMaterials[(buildingIndex + 1) % roofMaterials.length]
            )
            shopDoor.position.set(building.width * 0.26, 0.99, frontZ - building.side * 0.07)
            assembly.add(shopDoor)

            const awning = new THREE.Mesh(
                new THREE.BoxGeometry(building.width * 0.86, 0.18, 0.78),
                roofMaterials[buildingIndex % roofMaterials.length]
            )
            awning.position.set(0, 2.3, frontZ - building.side * 0.36)
            awning.castShadow = true
            assembly.add(awning)

            if(buildingIndex < portfolio.projects.length)
                this.addFacadeProjectSign(assembly, building, frontZ, portfolio.projects[buildingIndex], buildingIndex)

            const roof = new THREE.Mesh(
                new THREE.BoxGeometry(building.width + 0.7, 0.36, building.depth + 0.7),
                roofMaterials[buildingIndex % roofMaterials.length]
            )
            roof.position.y = building.height + 0.18
            roof.castShadow = true
            assembly.add(roof)

            for(let floor = 1; floor < Math.floor(building.height / 3.35); floor++)
            {
                const ledge = new THREE.Mesh(
                    new THREE.BoxGeometry(building.width + 0.22, 0.095, building.depth + 0.22),
                    roofMaterials[buildingIndex % roofMaterials.length]
                )
                ledge.position.y = floor * 3.35
                assembly.add(ledge)

                for(let wx = -building.width / 2 + 1.15, column = 0; wx < building.width / 2 - 0.3; wx += 1.55, column++)
                {
                    if((floor + column + buildingIndex) % 5 === 0)
                        continue

                    // On whichever facade faces the road, preserving actual
                    // world-space transforms in one instanced window draw call.
                    const zFace = -building.side * (building.depth / 2 + 0.055)
                    const local = new THREE.Vector3(wx, floor * 3.35 + 0.25, zFace)
                        .applyAxisAngle(new THREE.Vector3(0, 1, 0), frame.yaw)
                    windows.push({
                        position: new THREE.Vector3(centre.x + local.x, local.y, centre.z + local.z),
                        yaw: frame.yaw
                    })
                }
            }

            this.group.add(assembly)
        })

        const windowInstances = new THREE.InstancedMesh(windowGeometry, windowMaterial, windows.length)
        const dummy = new THREE.Object3D()
        windows.forEach((window, index) =>
        {
            dummy.position.copy(window.position)
            dummy.rotation.set(0, window.yaw, 0)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            windowInstances.setMatrixAt(index, dummy.matrix)
        })
        windowInstances.instanceMatrix.needsUpdate = true
        windowInstances.computeBoundingSphere()
        this.group.add(windowInstances)

        this.addStreetLights()
    }

    createFacadeTexture(project, index)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 1200
        canvas.height = 360
        const ctx = canvas.getContext('2d')
        if(!ctx)
            return null

        const gradient = ctx.createLinearGradient(0, 0, 1200, 320)
        gradient.addColorStop(0, '#fff7e8')
        gradient.addColorStop(1, '#ead6bd')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = project.accent === 'mint' ? '#3a9a8a' : project.accent === 'amber' ? '#c8845f' : '#6f7aa8'
        ctx.fillRect(0, 0, 12, canvas.height)
        ctx.fillStyle = '#42676a'
        ctx.font = '700 19px Arial, sans-serif'
        ctx.fillText('T.  /  PROJECT ' + String(index + 1).padStart(2, '0'), 42, 35)

        let fontSize = 69
        ctx.font = '700 ' + fontSize + 'px Arial, sans-serif'
        while(ctx.measureText(project.title.toUpperCase()).width > 1110 && fontSize > 40)
        {
            fontSize -= 2
            ctx.font = '700 ' + fontSize + 'px Arial, sans-serif'
        }
        ctx.fillStyle = '#18383d'
        ctx.fillText(project.title.toUpperCase(), 42, 117)

        ctx.fillStyle = '#536b68'
        ctx.font = '600 25px Arial, sans-serif'
        ctx.fillText(project.subtitle.toUpperCase(), 42, 166, 1108)
        ctx.fillStyle = '#4f6260'
        ctx.font = '500 21px Arial, sans-serif'
        ctx.fillText((project.details?.[0] ?? project.description).toUpperCase(), 42, 218, 1108)
        ctx.font = '600 17px Arial, sans-serif'
        ctx.fillStyle = '#6f7d72'
        ctx.fillText(project.tags.slice(0, 4).join('  ·  ').toUpperCase(), 42, 260, 1108)
        ctx.fillStyle = '#b46d54'
        ctx.fillRect(42, 287, 104, 6)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#846c5e'
        ctx.font = '600 16px Arial, sans-serif'
        ctx.fillText('BUILT BY TANUSH CHAWLA', 1155, 338)

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = Math.min(8, this.game.rendering.renderer.capabilities?.getMaxAnisotropy?.() ?? 1)
        return texture
    }

    addFacadeProjectSign(assembly, building, frontZ, project, index)
    {
        // The first six boulevard façades carry actual project marquees, so
        // names belong to the buildings rather than floating UI cards.
        const texture = this.createFacadeTexture(project, index)
        if(!texture)
            return

        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(building.width * 0.78, 7.6), 1.28),
            new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                toneMapped: false
            })
        )
        const signWidth = Math.min(building.width * 0.78, 7.6)
        sign.geometry.dispose()
        sign.geometry = new THREE.PlaneGeometry(signWidth, signWidth / (1200 / 360))
        sign.position.set(0, 4.62, frontZ + (frontZ > 0 ? 0.12 : -0.12))
        sign.rotation.y = frontZ < 0 ? Math.PI : 0
        sign.renderOrder = 4
        sign.frustumCulled = false
        assembly.add(sign)
        this.facadeLabels.push(sign)
    }

    addStreetLights()
    {
        const poleMaterial = this.material('#5c4b57', { roughness: 0.75, metalness: 0.18 })
        const lampMaterial = new THREE.MeshBasicMaterial({ color: '#ffd7a0' })
        const haloMaterial = new THREE.MeshBasicMaterial({
            color: '#ffca8a',
            transparent: true,
            opacity: 0.12,
            depthWrite: false
        })

        for(const t of [0.79, 0.835, 0.88, 0.925, 0.97, 0.99])
        {
            const frame = this.routeFrame(t)
            for(const sideSign of [-1, 1])
            {
                const position = frame.position.clone().addScaledVector(frame.side, sideSign * 6.6)
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 3.35, 7), poleMaterial)
                pole.position.set(position.x, 1.68, position.z)
                pole.castShadow = true
                this.group.add(pole)

                const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.075, 0.075), poleMaterial)
                arm.position.set(position.x - frame.side.x * sideSign * 0.42, 3.25, position.z - frame.side.z * sideSign * 0.42)
                arm.rotation.y = frame.yaw
                this.group.add(arm)

                const lightX = position.x - frame.side.x * sideSign * 0.72
                const lightZ = position.z - frame.side.z * sideSign * 0.72
                const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampMaterial)
                bulb.position.set(lightX, 3.18, lightZ)
                this.group.add(bulb)

                const halo = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 6), haloMaterial)
                halo.position.copy(bulb.position)
                this.group.add(halo)
            }
        }
    }


    addStreetLife()
    {
        // Roadside props add lived-in scale without a costly traffic simulation.
        const steel = this.material('#53666a', { roughness: 0.62, metalness: 0.28 })
        const darkRubber = this.material('#293439', { roughness: 0.98 })
        const benchWood = this.material('#b78562', { roughness: 0.92 })
        const planterClay = this.material('#ad7d70', { roughness: 0.92 })
        const foliage = this.material('#5d9874', { roughness: 1 })
        const glass = this.material('#a7d5d3', {
            roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.52,
            side: THREE.DoubleSide, depthWrite: false
        })
        const windowGlass = this.material('#c7e0dc', { roughness: 0.2, metalness: 0.05 })
        const wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.2, 10)
        const carPaints = [
            this.material('#e8d9c3', { roughness: 0.44, metalness: 0.12 }),
            this.material('#b6c4bf', { roughness: 0.42, metalness: 0.14 }),
            this.material('#b56f61', { roughness: 0.48, metalness: 0.1 }),
            this.material('#5f7979', { roughness: 0.44, metalness: 0.14 }),
            this.material('#d4b16f', { roughness: 0.48, metalness: 0.08 })
        ]
        const headlamp = new THREE.MeshBasicMaterial({ color: '#ffe5b1' })
        const tailLamp = new THREE.MeshBasicMaterial({ color: '#d95f59' })
        const addBox = (parent, geometry, material, x, y, z) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            mesh.castShadow = true
            mesh.receiveShadow = true
            parent.add(mesh)
            return mesh
        }

        const addParkedCar = (t, sideSign, paintIndex) =>
        {
            const frame = this.routeFrame(t)
            const car = new THREE.Group()
            car.name = 'ParkedBoulevardCar'
            car.position.copy(frame.position).addScaledVector(frame.side, sideSign * 11.15)
            car.position.y = 0.12
            car.rotation.y = frame.yaw
            const paint = carPaints[paintIndex % carPaints.length]
            addBox(car, new THREE.BoxGeometry(3.9, 0.7, 1.68), paint, 0, 0.72, 0)
            addBox(car, new THREE.BoxGeometry(1.9, 0.56, 1.28), windowGlass, -0.03, 1.3, 0)
            addBox(car, new THREE.BoxGeometry(1.12, 0.45, 1.32), paint, 0.95, 1.27, 0)
            addBox(car, new THREE.BoxGeometry(0.13, 0.13, 0.48), headlamp, 1.98, 0.75, -0.48)
            addBox(car, new THREE.BoxGeometry(0.13, 0.13, 0.48), headlamp, 1.98, 0.75, 0.48)
            addBox(car, new THREE.BoxGeometry(0.11, 0.12, 0.38), tailLamp, -1.98, 0.75, -0.52)
            addBox(car, new THREE.BoxGeometry(0.11, 0.12, 0.38), tailLamp, -1.98, 0.75, 0.52)
            for(const x of [-1.18, 1.18])
            {
                for(const z of [-0.86, 0.86])
                {
                    const wheel = new THREE.Mesh(wheelGeometry, darkRubber)
                    wheel.rotation.x = Math.PI / 2
                    wheel.position.set(x, 0.39, z)
                    wheel.castShadow = true
                    car.add(wheel)
                    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.215, 8), steel)
                    hub.rotation.x = Math.PI / 2
                    hub.position.set(x, 0.39, z * 1.01)
                    car.add(hub)
                }
            }
            this.group.add(car)
        }
        ;[
            [0.765, -1, 0], [0.805, -1, 1], [0.845, 1, 2],
            [0.885, -1, 3], [0.925, 1, 4], [0.97, -1, 0]
        ].forEach(([t, side, paint]) => addParkedCar(t, side, paint))

        const addBench = (t, sideSign) =>
        {
            const frame = this.routeFrame(t)
            const bench = new THREE.Group()
            bench.position.copy(frame.position).addScaledVector(frame.side, sideSign * 8.55)
            bench.position.y = 0.12
            bench.rotation.y = frame.yaw
            for(const z of [-0.34, 0.34])
                addBox(bench, new THREE.BoxGeometry(2.05, 0.11, 0.12), benchWood, 0, 0.58, z)
            addBox(bench, new THREE.BoxGeometry(2.05, 0.48, 0.11), benchWood, 0, 0.86, 0.36)
            for(const x of [-0.78, 0.78])
            {
                addBox(bench, new THREE.BoxGeometry(0.1, 0.55, 0.72), steel, x, 0.31, 0)
                addBox(bench, new THREE.BoxGeometry(0.14, 0.11, 0.85), steel, x, 0.53, 0)
            }
            this.group.add(bench)
        }
        addBench(0.775, 1)
        addBench(0.905, -1)

        const addPlanter = (t, sideSign, radius = 0.47) =>
        {
            const frame = this.routeFrame(t)
            const planter = new THREE.Group()
            planter.position.copy(frame.position).addScaledVector(frame.side, sideSign * 9.0)
            planter.position.y = 0.12
            planter.rotation.y = frame.yaw
            addBox(planter, new THREE.BoxGeometry(0.95, 0.5, 0.95), planterClay, 0, 0.25, 0)
            const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), foliage)
            shrub.position.set(0, 0.72, 0)
            shrub.scale.set(1.05, 0.85, 1.05)
            shrub.castShadow = true
            planter.add(shrub)
            this.group.add(planter)
        }
        ;[
            [0.745, -1], [0.79, 1], [0.86, -1],
            [0.905, 1], [0.945, -1], [0.98, 1]
        ].forEach(([t, side]) => addPlanter(t, side))

        const binMaterial = this.material('#687b77', { roughness: 0.82, metalness: 0.12 })
        for(const [t, sideSign] of [[0.75, 1], [0.875, -1], [0.945, 1]])
        {
            const frame = this.routeFrame(t)
            const bin = new THREE.Group()
            bin.position.copy(frame.position).addScaledVector(frame.side, sideSign * 8.6)
            bin.position.y = 0.12
            bin.rotation.y = frame.yaw
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.78, 10), binMaterial)
            body.position.y = 0.43
            bin.add(body)
            const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.09, 10), steel)
            lid.position.y = 0.85
            bin.add(lid)
            this.group.add(bin)
        }

        // Pedestrians provide human scale along the city footpaths.
        const skin = this.material('#d7a27d', { roughness: 0.9 })
        const trousers = this.material('#455864', { roughness: 0.95 })
        const jackets = [
            this.material('#d98d70', { roughness: 0.9 }),
            this.material('#6b9c8d', { roughness: 0.9 }),
            this.material('#d4b56f', { roughness: 0.9 }),
            this.material('#7a7898', { roughness: 0.9 })
        ]
        const addPedestrian = (t, sideSign, outfitIndex, step = 0.18) =>
        {
            const frame = this.routeFrame(t)
            const person = new THREE.Group()
            person.name = 'BoulevardPedestrian'
            person.position.copy(frame.position).addScaledVector(frame.side, sideSign * 8.35)
            person.position.y = 0.12
            person.rotation.y = frame.yaw + (sideSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5)
            const legGeo = new THREE.BoxGeometry(0.17, 0.56, 0.18)
            for(const [i, x] of [-0.12, 0.12].entries())
            {
                const leg = new THREE.Mesh(legGeo, trousers)
                leg.position.set(x, 0.42, i === 0 ? step : -step)
                person.add(leg)
            }
            const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.28, 0.72, 7), jackets[outfitIndex % jackets.length])
            torso.position.y = 1.0
            torso.castShadow = true
            person.add(torso)
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin)
            head.position.set(0, 1.54, 0)
            head.castShadow = true
            person.add(head)
            const hair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 8, 6), darkRubber)
            hair.position.set(0, 1.64, -0.025)
            hair.scale.set(1, 0.62, 1)
            person.add(hair)
            for(const x of [-0.27, 0.27])
            {
                const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.54, 7), jackets[outfitIndex % jackets.length])
                arm.position.set(x, 1.02, 0)
                arm.rotation.z = x > 0 ? -0.16 : 0.16
                person.add(arm)
            }
            this.group.add(person)
        }
        ;[
            [0.755, 1, 0, 0.15], [0.795, 1, 1, -0.12],
            [0.865, -1, 2, 0.2], [0.9, 1, 3, -0.16],
            [0.94, -1, 1, 0.1], [0.978, 1, 0, -0.12]
        ].forEach(([t, side, outfit, step]) => addPedestrian(t, side, outfit, step))

        // A glass-sided local bus shelter with a readable destination panel.
        const shelterFrame = this.routeFrame(0.86)
        const shelter = new THREE.Group()
        shelter.name = 'CityBusStop'
        shelter.position.copy(shelterFrame.position).addScaledVector(shelterFrame.side, 11.25)
        shelter.position.y = 0.12
        shelter.rotation.y = shelterFrame.yaw
        for(const x of [-2.25, 2.25])
        {
            addBox(shelter, new THREE.BoxGeometry(0.12, 2.35, 0.12), steel, x, 1.18, 0)
            addBox(shelter, new THREE.BoxGeometry(0.1, 1.75, 0.09), steel, x, 1.04, -0.7)
        }
        addBox(shelter, new THREE.BoxGeometry(4.7, 0.16, 1.55), this.material('#b78a72', { roughness: 0.75 }), 0, 2.38, 0)
        addBox(shelter, new THREE.BoxGeometry(3.85, 0.12, 0.42), benchWood, 0, 0.62, 0.25)
        const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(4.35, 1.75, 0.045), glass)
        sidePanel.position.set(0, 1.23, 0.68)
        shelter.add(sidePanel)
        if(typeof document !== 'undefined')
        {
            const canvas = document.createElement('canvas')
            canvas.width = 512
            canvas.height = 180
            const ctx = canvas.getContext('2d')
            if(ctx)
            {
                ctx.fillStyle = '#24484b'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.fillStyle = '#f7efd9'
                ctx.font = '700 34px Arial, sans-serif'
                ctx.fillText('GURUGRAM CITY BUS', 22, 58)
                ctx.font = '600 27px Arial, sans-serif'
                ctx.fillText('STOP 122  ·  CITY CENTRE', 22, 105)
                ctx.fillStyle = '#f0bb83'
                ctx.fillRect(22, 132, 165, 6)
                const texture = new THREE.CanvasTexture(canvas)
                texture.colorSpace = THREE.SRGBColorSpace
                const board = new THREE.Mesh(
                    new THREE.PlaneGeometry(2.45, 0.86),
                    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
                )
                board.position.set(0, 2.03, -0.81)
                shelter.add(board)
            }
        }
        this.group.add(shelter)

        // Pedestrian signals mark two crossings through the downtown section.
        const signalHousing = this.material('#34464a', { roughness: 0.7, metalness: 0.2 })
        const red = new THREE.MeshBasicMaterial({ color: '#e35f57' })
        const amber = new THREE.MeshBasicMaterial({ color: '#e9b15f' })
        const green = new THREE.MeshBasicMaterial({ color: '#79c59a' })
        for(const [t, sideSign] of [[0.824, -1], [0.824, 1], [0.904, -1], [0.904, 1]])
        {
            const frame = this.routeFrame(t)
            const signal = new THREE.Group()
            signal.position.copy(frame.position).addScaledVector(frame.side, sideSign * 5.3)
            signal.position.y = 0.12
            signal.rotation.y = frame.yaw
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 2.65, 8), steel)
            pole.position.y = 1.32
            signal.add(pole)
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.05, 0.36), signalHousing)
            box.position.set(0, 2.36, -sideSign * 0.13)
            signal.add(box)
            for(const [lightIndex, material] of [red, amber, green].entries())
            {
                const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), material)
                light.position.set(0, 2.68 - lightIndex * 0.31, -sideSign * 0.34)
                signal.add(light)
            }
            this.group.add(signal)
        }

        // Direction signage gives the city edge a believable road layout.
        const directionFrame = this.routeFrame(0.735)
        const direction = new THREE.Group()
        direction.position.copy(directionFrame.position).addScaledVector(directionFrame.side, -10.8)
        direction.position.y = 2.8
        direction.rotation.y = directionFrame.yaw
        direction.add(new THREE.Mesh(new THREE.BoxGeometry(3.15, 1.18, 0.14), this.material('#24484b', { roughness: 0.72 })))
        if(typeof document !== 'undefined')
        {
            const canvas = document.createElement('canvas')
            canvas.width = 640
            canvas.height = 240
            const ctx = canvas.getContext('2d')
            if(ctx)
            {
                ctx.fillStyle = '#24484b'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.fillStyle = '#f6f0df'
                ctx.font = '700 35px Arial, sans-serif'
                ctx.fillText('CITY CENTRE  →', 24, 82)
                ctx.fillText('AIRPORT       →', 24, 158)
                const texture = new THREE.CanvasTexture(canvas)
                texture.colorSpace = THREE.SRGBColorSpace
                const face = new THREE.Mesh(
                    new THREE.PlaneGeometry(3.02, 1.05),
                    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
                )
                face.position.z = 0.081
                direction.add(face)
            }
        }
        const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.1, 8), steel)
        signPole.position.set(-1.1, -1.3, 0)
        direction.add(signPole)
        this.group.add(direction)
    }

    addTramTracks()
    {
        // Tram rails are a clear visual cue for the pastel city boulevard.
        // They sit flush with the road surface and follow its full curvature.
        const rails = []
        for(let sample = 0; sample <= 180; sample++)
        {
            const t = 0.69 + sample / 180 * 0.31
            const frame = this.routeFrame(t)
            for(const [railIndex, sideSign] of [-1, 1].entries())
            {
                if(!rails[railIndex])
                    rails[railIndex] = []

                rails[railIndex].push(
                    frame.position.clone().addScaledVector(frame.side, sideSign * 0.84).setY(0.19)
                )
            }
        }

        const railMaterial = this.material('#a8a5a3', { roughness: 0.32, metalness: 0.52 })
        for(const points of rails)
        {
            const curve = new THREE.CatmullRomCurve3(points)
            const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.047, 6, false), railMaterial)
            rail.castShadow = true
            this.group.add(rail)
        }

        const sleeperGeometry = new THREE.BoxGeometry(1.15, 0.07, 2.65)
        const sleeperMaterial = this.material('#967b72', { roughness: 0.96 })
        for(let t = 0.705; t < 0.995; t += 0.017)
        {
            const frame = this.routeFrame(t)
            const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial)
            sleeper.position.copy(frame.position)
            sleeper.position.y = 0.115
            sleeper.rotation.y = frame.yaw
            sleeper.receiveShadow = true
            this.group.add(sleeper)
        }
    }

    addRiftGates()
    {
        // Scroll-world energy gates: emissive rings, a holographic curtain and
        // orbiting motes. Geometry is low-poly and animated in the existing loop.
        const portalTexture = (() =>
        {
            if(typeof document === 'undefined')
                return null
            const canvas = document.createElement('canvas')
            canvas.width = 256
            canvas.height = 512
            const ctx = canvas.getContext('2d')
            if(!ctx)
                return null
            const gradient = ctx.createLinearGradient(0, 0, 0, 512)
            gradient.addColorStop(0, 'rgba(100,255,227,0.01)')
            gradient.addColorStop(0.22, 'rgba(100,255,227,0.17)')
            gradient.addColorStop(0.5, 'rgba(182,130,255,0.38)')
            gradient.addColorStop(0.78, 'rgba(100,255,227,0.17)')
            gradient.addColorStop(1, 'rgba(100,255,227,0.01)')
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            for(let y = 18; y < 512; y += 26)
            {
                ctx.fillStyle = 'rgba(225,255,245,0.1)'
                ctx.fillRect(0, y, 256, 2)
            }
            const texture = new THREE.CanvasTexture(canvas)
            texture.colorSpace = THREE.SRGBColorSpace
            return texture
        })()

        const ringGeometry = new THREE.TorusGeometry(2.12, 0.065, 8, 64)
        const innerGeometry = new THREE.TorusGeometry(1.74, 0.032, 6, 56)
        const arcGeometry = new THREE.TorusGeometry(2.5, 0.027, 5, 64, Math.PI * 1.34)
        const moteGeometry = new THREE.SphereGeometry(0.075, 8, 6)
        const floorRingGeometry = new THREE.TorusGeometry(1.68, 0.035, 5, 48)
        const curtainGeometry = new THREE.PlaneGeometry(2.9, 3.8)
        const configurations = [
            { t: 0.595, side: 1, color: '#82f7dc', second: '#c7a1ff' },
            { t: 0.775, side: 1, color: '#ffc889', second: '#83f3dc' },
            { t: 0.99, side: -1, color: '#9fc6ff', second: '#f1a5db' }
        ]

        configurations.forEach((config, index) =>
        {
            const frame = this.routeFrame(config.t)
            const gate = new THREE.Group()
            gate.name = 'ScrollWorldEnergyGate_' + (index + 1)
            gate.position.copy(frame.position).addScaledVector(frame.side, config.side * 10.7)
            gate.position.y = 3.12
            gate.rotation.y = frame.yaw

            const curtainMaterial = new THREE.MeshBasicMaterial({
                map: portalTexture ?? null,
                color: config.color,
                transparent: true,
                opacity: portalTexture ? 0.43 : 0.13,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false
            })
            const curtain = new THREE.Mesh(curtainGeometry, curtainMaterial)
            curtain.position.z = -0.045
            curtain.renderOrder = 3
            gate.add(curtain)

            const outerMaterial = new THREE.MeshBasicMaterial({
                color: config.color, transparent: true, opacity: 0.64,
                blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
            })
            const outer = new THREE.Mesh(ringGeometry, outerMaterial)
            outer.renderOrder = 4
            gate.add(outer)

            const innerMaterial = new THREE.MeshBasicMaterial({
                color: config.second, transparent: true, opacity: 0.74,
                blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
            })
            const inner = new THREE.Mesh(innerGeometry, innerMaterial)
            inner.position.z = 0.035
            inner.renderOrder = 4
            gate.add(inner)

            const arcMaterial = new THREE.MeshBasicMaterial({
                color: '#fff4d7', transparent: true, opacity: 0.8,
                blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
            })
            const arc = new THREE.Mesh(arcGeometry, arcMaterial)
            arc.rotation.z = Math.PI * 0.2
            arc.position.z = 0.07
            arc.renderOrder = 5
            gate.add(arc)

            const floorMaterial = new THREE.MeshBasicMaterial({
                color: config.color, transparent: true, opacity: 0.48,
                blending: THREE.AdditiveBlending, depthWrite: false,
                side: THREE.DoubleSide, toneMapped: false
            })
            const floorRing = new THREE.Mesh(floorRingGeometry, floorMaterial)
            floorRing.rotation.x = Math.PI / 2
            floorRing.position.set(0, -2.77, 0)
            gate.add(floorRing)

            const orbit = new THREE.Group()
            orbit.position.z = 0.1
            const sparkMaterial = new THREE.MeshBasicMaterial({
                color: '#ffffff', transparent: true, opacity: 0.75,
                blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
            })
            const sparks = new THREE.InstancedMesh(moteGeometry, sparkMaterial, 8)
            const sparkTransform = new THREE.Object3D()
            for(let mote = 0; mote < 8; mote++)
            {
                const angle = mote / 8 * Math.PI * 2
                sparkTransform.position.set(Math.cos(angle) * 2.26, Math.sin(angle) * 2.26, 0)
                sparkTransform.scale.setScalar(mote % 3 === 0 ? 1.4 : 1)
                sparkTransform.updateMatrix()
                sparks.setMatrixAt(mote, sparkTransform.matrix)
                sparks.setColorAt(mote, new THREE.Color(mote % 2 ? config.second : '#fff8e8'))
            }
            sparks.instanceMatrix.needsUpdate = true
            sparks.renderOrder = 5
            orbit.add(sparks)
            gate.add(orbit)

            this.group.add(gate)
            this.riftGates.push({
                group: gate, outer, inner, arc, floorRing, curtainMaterial,
                orbit, pulseOffset: index * 1.7
            })
        })
    }

    addLearningHub()
    {
        // A campus/library-like landmark near the education chapter, not a
        // claimed real institution or a logo rendered into the world.
        const frame = this.routeFrame(0.845)
        const position = frame.position.clone().addScaledVector(frame.side, -31)
        const campus = new THREE.Group()
        campus.position.set(position.x, 0, position.z)
        campus.rotation.y = frame.yaw

        const stone = this.material('#e3c4ae', { roughness: 0.78 })
        const roofMaterial = this.material('#7c5c70', { roughness: 0.74 })
        const glass = this.material('#9dd6d0', {
            roughness: 0.28,
            metalness: 0.12,
            emissive: '#285653',
            emissiveIntensity: 0.22
        })

        const main = new THREE.Mesh(new THREE.BoxGeometry(16, 5.6, 10), stone)
        main.position.y = 2.8
        main.castShadow = true
        main.receiveShadow = true
        campus.add(main)

        const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 4.2, 8.4), this.material('#bd8c8a'))
        wing.position.set(-11.2, 2.1, 0.4)
        wing.castShadow = true
        campus.add(wing)

        const roof = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.5, 11.2), roofMaterial)
        roof.position.y = 5.85
        campus.add(roof)

        const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(13.5, 2.7, 0.13), glass)
        frontGlass.position.set(0, 2.9, -5.08)
        campus.add(frontGlass)

        const stepsMaterial = this.material('#c9a08e', { roughness: 0.82 })
        for(let i = 0; i < 3; i++)
        {
            const steps = new THREE.Mesh(new THREE.BoxGeometry(9.5 - i * 1.1, 0.17, 1.1), stepsMaterial)
            steps.position.set(0, 0.08 + i * 0.17, -6.1 - i * 0.85)
            campus.add(steps)
        }

        const pillarGeometry = new THREE.CylinderGeometry(0.2, 0.25, 4.2, 8)
        for(const x of [-5.2, -1.75, 1.75, 5.2])
        {
            const pillar = new THREE.Mesh(pillarGeometry, stone)
            pillar.position.set(x, 2.5, -5.5)
            pillar.castShadow = true
            campus.add(pillar)
        }

        const sign = new THREE.Mesh(
            new THREE.BoxGeometry(3.4, 0.42, 0.15),
            this.material('#edb47e', { emissive: '#5b3525', emissiveIntensity: 0.2 })
        )
        sign.position.set(0, 4.75, -5.18)
        campus.add(sign)

        campus.traverse(node =>
        {
            if(node.isMesh)
            {
                node.castShadow = true
                node.receiveShadow = true
            }
        })
        this.group.add(campus)
    }

    addAirport()
    {
        const end = this.routeFrame(1)
        const runwayCentre = end.position.clone().addScaledVector(end.tangent, 34)
        runwayCentre.y = 0.035

        const runway = new THREE.Group()
        runway.position.copy(runwayCentre)
        runway.rotation.y = end.yaw

        const asphalt = new THREE.Mesh(
            new THREE.PlaneGeometry(58, 12),
            this.material('#514d5a', { roughness: 0.95, side: THREE.DoubleSide })
        )
        asphalt.rotation.x = -Math.PI / 2
        asphalt.position.y = 0
        runway.add(asphalt)

        const marking = new THREE.MeshBasicMaterial({ color: '#f5e5ca' })
        const edgeMarkings = [
            { z: -5.35, x: 0 }, { z: 5.35, x: 0 }
        ]
        edgeMarkings.forEach(mark =>
        {
            const line = new THREE.Mesh(new THREE.BoxGeometry(56, 0.025, 0.12), marking)
            line.position.set(0, 0.035, mark.z)
            runway.add(line)
        })

        for(let i = 0; i < 9; i++)
        {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.22), marking)
            stripe.position.set(-24 + i * 6, 0.04, 0)
            runway.add(stripe)
        }
        this.group.add(runway)

        const terminalCentre = end.position.clone()
            .addScaledVector(end.side, 25)
            .addScaledVector(end.tangent, 5)
        const terminal = new THREE.Group()
        terminal.position.set(terminalCentre.x, 0, terminalCentre.z)
        terminal.rotation.y = end.yaw

        const shell = this.material('#e6c7b3', { roughness: 0.55, metalness: 0.04 })
        const roofMaterial = this.material('#805f71', { roughness: 0.62, metalness: 0.08 })
        const glass = this.material('#8fd5d0', {
            roughness: 0.22,
            metalness: 0.2,
            emissive: '#1f4e54',
            emissiveIntensity: 0.24
        })

        const main = new THREE.Mesh(new THREE.BoxGeometry(25, 7.1, 11), shell)
        main.position.y = 3.55
        main.castShadow = true
        terminal.add(main)

        const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.5, 12.5), roofMaterial)
        roof.position.y = 7.35
        terminal.add(roof)

        const facade = new THREE.Mesh(new THREE.BoxGeometry(22, 2.5, 0.14), glass)
        facade.position.set(0, 3.6, -5.57)
        terminal.add(facade)

        const canopy = new THREE.Mesh(new THREE.BoxGeometry(26, 0.28, 2.1), roofMaterial)
        canopy.position.set(0, 5.35, -6.2)
        terminal.add(canopy)

        const tower = new THREE.Mesh(new THREE.BoxGeometry(4.3, 17, 4.3), this.material('#bd9290', { roughness: 0.68 }))
        tower.position.set(13.6, 8.5, 2.3)
        tower.castShadow = true
        terminal.add(tower)

        const towerGlass = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.65, 4.0), glass)
        towerGlass.position.set(13.6, 15.1, 2.3)
        terminal.add(towerGlass)

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd69a' }))
        beacon.position.set(13.6, 17.4, 2.3)
        terminal.add(beacon)

        terminal.traverse(node =>
        {
            if(node.isMesh)
            {
                node.castShadow = true
                node.receiveShadow = true
            }
        })
        this.group.add(terminal)
        this.addParkedAircraft(end)
    }

    addParkedAircraft(end)
    {
        // A compact, low-poly aircraft makes the terminal feel active and gives
        // the later paper moment a real in-world source.
        const aircraft = new THREE.Group()
        aircraft.name = 'ParkedPortfolioAircraft'
        aircraft.position.copy(end.position)
            .addScaledVector(end.tangent, 29)
            .addScaledVector(end.side, -0.5)
        aircraft.position.y = 1.48
        aircraft.rotation.y = end.yaw

        const fuselageMaterial = this.material('#f3e8d4', { roughness: 0.48, metalness: 0.12 })
        const wingMaterial = this.material('#9dcfc8', { roughness: 0.42, metalness: 0.14 })
        const underwingMaterial = this.material('#c4b5a6', { roughness: 0.6, metalness: 0.08 })
        const windowMaterial = new THREE.MeshBasicMaterial({ color: '#31565a' })
        const wheelMaterial = this.material('#4a5156', { roughness: 0.78, metalness: 0.18 })

        const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 12.2, 14), fuselageMaterial)
        fuselage.rotation.z = -Math.PI / 2
        fuselage.position.y = 0.03
        fuselage.castShadow = true
        aircraft.add(fuselage)

        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.41, 12, 8), fuselageMaterial)
        nose.position.set(6.0, 0.06, 0)
        nose.scale.set(1.1, 0.86, 0.86)
        aircraft.add(nose)

        const wings = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.15, 11.2), wingMaterial)
        wings.position.set(-0.35, -0.12, 0)
        wings.castShadow = true
        wings.receiveShadow = true
        aircraft.add(wings)

        const tailWing = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.11, 4.0), wingMaterial)
        tailWing.position.set(-4.95, 0.27, 0)
        aircraft.add(tailWing)

        const tailFin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.55, 0.15), wingMaterial)
        tailFin.position.set(-4.95, 0.82, 0)
        tailFin.rotation.z = -0.12
        tailFin.castShadow = true
        aircraft.add(tailFin)

        for(const sideSign of [-1, 1])
        {
            const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 2.0, 10), underwingMaterial)
            engine.rotation.z = -Math.PI / 2
            engine.position.set(0.25, -0.37, sideSign * 2.25)
            engine.castShadow = true
            aircraft.add(engine)

            const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.85, 7), wheelMaterial)
            strut.position.set(-1.55, -0.82, sideSign * 2.0)
            aircraft.add(strut)

            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 10), wheelMaterial)
            wheel.rotation.x = Math.PI / 2
            wheel.position.set(-1.55, -1.22, sideSign * 2.0)
            aircraft.add(wheel)
        }

        for(let index = 0; index < 9; index++)
        {
            const window = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.035), windowMaterial)
            window.position.set(-3.4 + index * 0.82, 0.12, 0.455)
            aircraft.add(window)
        }

        aircraft.traverse(node =>
        {
            if(node.isMesh)
            {
                node.castShadow = true
                node.receiveShadow = true
            }
        })
        this.group.add(aircraft)
        this.aircraft = aircraft
        this.aircraftSource = aircraft.position.clone()
            .addScaledVector(end.tangent, 4.2)
            .addScaledVector(end.side, 0.7)
        this.aircraftSource.y += 2.55
        this.aircraftYaw = end.yaw
    }

    addAirportPamphlet()
    {
        // The airport leaflet is deliberately typographic and short enough to
        // read as it drifts from the aircraft toward the end of the route.
        const canvas = document.createElement('canvas')
        canvas.width = 1000
        canvas.height = 700
        const ctx = canvas.getContext('2d')
        if(!ctx)
            return

        ctx.fillStyle = '#fff5e4'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = 'rgba(49, 86, 90, 0.28)'
        ctx.lineWidth = 3
        ctx.strokeRect(20, 20, 960, 660)
        ctx.fillStyle = '#31565a'
        ctx.font = '700 25px Arial, sans-serif'
        ctx.fillText('AIRMAIL  /  THE NEXT DESTINATION', 62, 78)
        ctx.fillStyle = '#c57b59'
        ctx.fillRect(62, 108, 124, 8)
        ctx.fillStyle = '#18383d'
        ctx.font = '700 59px Arial, sans-serif'
        ctx.fillText('Let’s build', 62, 220)
        ctx.fillText('something useful.', 62, 292)
        ctx.fillStyle = '#3e5555'
        ctx.font = '500 31px Arial, sans-serif'
        ctx.fillText('AI / ML  ·  Data  ·  Backend', 62, 382)
        ctx.fillText('Projects, ideas and a little curiosity.', 62, 430)
        ctx.strokeStyle = 'rgba(49, 86, 90, 0.22)'
        ctx.beginPath()
        ctx.moveTo(62, 495)
        ctx.lineTo(935, 495)
        ctx.stroke()
        ctx.fillStyle = '#42676a'
        ctx.font = '700 24px Arial, sans-serif'
        ctx.fillText('TANUSH CHAWLA', 62, 550)
        ctx.font = '600 23px Arial, sans-serif'
        ctx.fillText('tanushchawla16@gmail.com', 62, 604)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#b46d54'
        ctx.font = '700 18px Arial, sans-serif'
        ctx.fillText('GURUGRAM  /  INDIA', 935, 647)

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = Math.min(8, this.game.rendering.renderer.capabilities?.getMaxAnisotropy?.() ?? 1)

        const group = new THREE.Group()
        group.name = 'AirportWindblownPamphlet'
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            toneMapped: false,
            depthWrite: false
        })
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 2.0), material)
        sheet.renderOrder = 8
        sheet.frustumCulled = false
        group.add(sheet)

        const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(3.0, 2.12),
            new THREE.MeshBasicMaterial({
                color: '#cfad86', transparent: true, opacity: 0,
                side: THREE.DoubleSide, depthWrite: false
            })
        )
        shadow.position.z = -0.04
        shadow.renderOrder = 7
        group.add(shadow)
        group.visible = false
        this.group.add(group)
        this.airportPamphlet = {
            group, material, shadowMaterial: shadow.material,
            texture, origin: this.aircraftSource?.clone() ?? new THREE.Vector3()
        }
    }


    addLightTrails()
    {
        // Thin additive rails along the road edge catch the eye as the rider
        // travels through the route. They remain subtle in daylight sections.
        for(const [index, sideSign] of [-1, 1].entries())
        {
            const points = []
            for(let step = 0; step <= 300; step++)
            {
                const t = 0.015 + step / 300 * 0.97
                const frame = this.routeFrame(t)
                points.push(frame.position.clone().addScaledVector(frame.side, sideSign * 4.02).setY(0.225))
            }

            const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 300, 0.026, 5, false)
            const material = new THREE.MeshBasicMaterial({
                color: index === 0 ? '#82dfce' : '#ffd1a0',
                transparent: true,
                opacity: 0.23,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
            const ribbon = new THREE.Mesh(geometry, material)
            ribbon.renderOrder = 3
            this.group.add(ribbon)
        }

        // Moving light nodes use a single instanced draw call. Their positions
        // track the scroll-controlled rider, so the scenery has a real sense
        // of motion without needing expensive full-screen post-processing.
        const count = 32
        const geometry = new THREE.SphereGeometry(0.115, 8, 6)
        const material = new THREE.MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
        this.energyInstances = new THREE.InstancedMesh(geometry, material, count)
        this.energyInstances.frustumCulled = false
        this.energyCount = count
        this.energyDummy = new THREE.Object3D()
        this.energyColors = new Float32Array(count)

        for(let index = 0; index < count; index++)
        {
            const teal = index % 3 === 0
            this.energyColors[index] = teal ? 1 : 0
            this.energyInstances.setColorAt(index, new THREE.Color(teal ? '#7debd8' : '#ffc889'))
        }

        this.energyInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        this.energyInstances.renderOrder = 4
        this.group.add(this.energyInstances)
    }

    addAmbientParticles()
    {
        // Tiny firefly-like particles form a shallow volumetric atmosphere.
        // World positions stay anchored to the road while each mote floats.
        const count = 300
        const positions = new Float32Array(count * 3)
        const colors = new Float32Array(count * 3)
        this.moteBaseY = new Float32Array(count)
        this.motePhase = new Float32Array(count)

        const fract = value => value - Math.floor(value)
        const seeded = index => fract(Math.sin(index * 127.1 + 311.7) * 43758.5453)

        for(let index = 0; index < count; index++)
        {
            const t = 0.01 + seeded(index + 11) * 0.98
            const frame = this.routeFrame(t)
            const sideOffset = (seeded(index + 97) * 2 - 1) * (7 + seeded(index + 251) * 16)
            const height = 0.6 + seeded(index + 401) * 10.5
            const position = frame.position.clone().addScaledVector(frame.side, sideOffset)
            const offset = index * 3

            positions[offset] = position.x
            positions[offset + 1] = height
            positions[offset + 2] = position.z
            this.moteBaseY[index] = height
            this.motePhase[index] = seeded(index + 997) * Math.PI * 2

            const tint = index % 4 === 0 ? new THREE.Color('#8de8d5') : new THREE.Color('#ffe0ae')
            colors[offset] = tint.r
            colors[offset + 1] = tint.g
            colors[offset + 2] = tint.b
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.attributes.position.setUsage(THREE.DynamicDrawUsage)

        const material = new THREE.PointsMaterial({
            size: 0.105,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.62,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })

        this.moteGeometry = geometry
        this.motes = new THREE.Points(geometry, material)
        this.motes.frustumCulled = false
        this.motes.renderOrder = 4
        this.group.add(this.motes)
    }

    animateEffects()
    {
        const time = this.game.ticker.elapsed
        const tour = this.game.view?.scrollTour
        const progress = tour?.progress ?? 0
        const count = this.energyCount ?? 0

        if(this.energyInstances && count)
        {
            for(let index = 0; index < count; index++)
            {
                const lane = index % 2 === 0 ? -1 : 1
                const slot = index / count
                const t = THREE.MathUtils.clamp(progress + (slot - 0.5) * 0.46, 0.006, 0.994)
                const frame = this.routeFrame(t)
                const pulse = 0.82 + 0.18 * Math.sin(time * 2.5 + index * 0.8)

                this.energyDummy.position.copy(frame.position)
                    .addScaledVector(frame.side, lane * 4.15)
                this.energyDummy.position.y = 0.24 + (index % 3) * 0.035
                this.energyDummy.scale.setScalar(pulse)
                this.energyDummy.updateMatrix()
                this.energyInstances.setMatrixAt(index, this.energyDummy.matrix)
            }
            this.energyInstances.instanceMatrix.needsUpdate = true
        }

        if(this.moteGeometry)
        {
            const positions = this.moteGeometry.attributes.position
            for(let index = 0; index < this.moteBaseY.length; index++)
                positions.array[index * 3 + 1] = this.moteBaseY[index] + Math.sin(time * 0.8 + this.motePhase[index]) * 0.24
            positions.needsUpdate = true
        }

        for(const gate of this.riftGates)
        {
            const pulse = 0.5 + 0.5 * Math.sin(time * 1.8 + gate.pulseOffset)
            gate.outer.rotation.z = time * 0.42 + gate.pulseOffset
            gate.inner.rotation.z = -time * 0.68 - gate.pulseOffset
            gate.arc.rotation.z = time * 0.88 + gate.pulseOffset
            gate.orbit.rotation.z = -time * 0.36
            gate.outer.material.opacity = 0.46 + pulse * 0.36
            gate.inner.material.opacity = 0.52 + (1 - pulse) * 0.36
            gate.arc.material.opacity = 0.48 + pulse * 0.48
            gate.floorRing.material.opacity = 0.28 + pulse * 0.35
            gate.curtainMaterial.opacity = 0.2 + pulse * 0.32
            gate.group.scale.setScalar(0.985 + pulse * 0.025)
            gate.group.position.y = 3.12 + Math.sin(time * 1.1 + gate.pulseOffset) * 0.06
        }
    }

    createStoryTexture(item, index, count)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 1400
        canvas.height = 800
        const ctx = canvas.getContext('2d')
        if(!ctx)
            return null

        const wash = ctx.createLinearGradient(0, 0, 1400, 800)
        wash.addColorStop(0, '#fff9ec')
        wash.addColorStop(1, '#e9d7bd')
        ctx.fillStyle = wash
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.fillStyle = 'rgba(49, 79, 79, 0.035)'
        for(let x = 24; x < canvas.width; x += 34)
            for(let y = 20; y < canvas.height; y += 34)
                ctx.fillRect(x, y, 1.5, 1.5)

        ctx.fillStyle = '#31565a'
        ctx.fillRect(0, 0, 12, canvas.height)
        ctx.font = '700 24px Arial, sans-serif'
        ctx.fillStyle = '#42676a'
        ctx.fillText('T.  /  TANUSH CHAWLA', 58, 66)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#846c5e'
        ctx.font = '600 18px Arial, sans-serif'
        ctx.fillText(item.kicker.toUpperCase(), 1335, 66)
        ctx.textAlign = 'left'

        ctx.strokeStyle = 'rgba(49, 86, 90, 0.24)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(58, 100)
        ctx.lineTo(1340, 100)
        ctx.stroke()

        let titleSize = 76
        ctx.font = '700 ' + titleSize + 'px Arial, sans-serif'
        while(ctx.measureText(item.title).width > 1280 && titleSize > 46)
        {
            titleSize -= 2
            ctx.font = '700 ' + titleSize + 'px Arial, sans-serif'
        }
        ctx.fillStyle = '#18383d'
        ctx.fillText(item.title, 58, 218)

        ctx.fillStyle = item.accent ?? '#c27b5b'
        ctx.fillRect(58, 258, 86, 8)

        ctx.fillStyle = '#3e5555'
        const bodyLines = item.lines.slice(0, 4)
        ctx.font = bodyLines.length > 3 ? '500 27px Arial, sans-serif' : bodyLines.length > 2 ? '500 30px Arial, sans-serif' : '500 34px Arial, sans-serif'
        let bodyY = bodyLines.length > 2 ? 300 : 340
        const lineStep = bodyLines.length > 3 ? 51 : 58
        for(const line of bodyLines)
        {
            ctx.fillText(line, 58, bodyY, 1260)
            bodyY += lineStep
        }

        ctx.fillStyle = '#42676a'
        ctx.font = '700 21px Arial, sans-serif'
        ctx.fillText(item.footer.toUpperCase(), 58, 710)

        ctx.textAlign = 'right'
        ctx.fillStyle = '#b46d54'
        ctx.font = '700 24px Arial, sans-serif'
        ctx.fillText(String(index + 1).padStart(2, '0') + ' / ' + String(count).padStart(2, '0'), 1338, 710)

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = Math.min(8, this.game.rendering.renderer.capabilities?.getMaxAnisotropy?.() ?? 1)
        texture.needsUpdate = true
        return texture
    }

    addStoryBoards()
    {
        // Physical roadside signs bring compact chapter summaries into view.
        const boards = [
            {
                t: 0.025, side: 1, kicker: '01 / THE BEGINNING',
                title: portfolio.name.toUpperCase(),
                lines: [portfolio.roleLine.replaceAll(' · ', '  /  '), 'AI / ML  ·  DATA ANALYTICS  ·  BACKEND SYSTEMS', portfolio.location + '  ·  Scroll to ride through my work'],
                footer: 'BUILD  /  ANALYSE  /  SHIP', accent: '#cc805e'
            },
            {
                t: 0.13, side: -1, kicker: '02 / THE PERSON BEHIND THE BUILD',
                title: 'AI. DATA. SYSTEMS.',
                lines: ['Machine learning, data analytics and backend engineering.', 'Python · SQL · ML pipelines · REST APIs', 'Azure AI and cloud fundamentals certifications', 'Building useful software from real data'],
                footer: 'CURIOSITY → USEFUL SOFTWARE', accent: '#3a9a8a'
            },
            {
                t: 0.275, side: 1, kicker: '03 / TOOLS OF THE TRADE',
                title: 'THE TOOLKIT',
                lines: ['Python · SQL · C++ · JavaScript · React · Node.js', 'Machine learning · RAG · Analytics · Power BI', 'Azure · Docker · PostgreSQL · MongoDB', 'EDA · feature engineering · REST API design'],
                footer: 'PRACTICAL TOOLS, REAL SYSTEMS', accent: '#3a9a8a'
            },
            {
                t: 0.48, side: -1, kicker: '04 / FROM LEARNING TO SHIPPING',
                title: 'WORK IN MOTION',
                lines: ['Backend Developer  ·  July 2026 — Present', 'Konverge Technologies  ·  IT/data analytics internship', 'Bluestock Fintech  ·  Backend development', 'APIs · databases · data preparation · model workflows'],
                footer: 'APIS  /  DATA  /  PRACTICAL ML', accent: '#cc805e'
            },
            {
                t: 0.70, side: 1, kicker: '05 / SELECTED BUILDS',
                title: 'BUILT & SHIPPED',
                lines: ['GGN Home · Live real estate platform + AI recommendations', 'NIDS · Network intrusion detection with machine learning', 'RAG Research Agent · Document retrieval and grounded answers', 'Stashr · WeCode · DealRadar · Developer and data tools'],
                footer: 'IDEAS THAT LEAVE THE NOTEBOOK', accent: '#3a9a8a'
            },
            {
                t: 0.82, side: 1, kicker: '06 / THE LEARNING ROUTE',
                title: 'THE FOUNDATION',
                lines: ['B.Tech · Computer Science Engineering', 'Artificial Intelligence & Machine Learning', 'VIT Bhopal University · CGPA 8.59 / 10', 'CBSE Class X and XII · 90% in both'],
                footer: '90% IN CBSE CLASS X AND XII', accent: '#cc805e'
            },
            {
                t: 0.89, side: -1, kicker: '07 / CERTIFIED LEARNING',
                title: 'CLOUD. AI. PRACTICE.',
                lines: ['Microsoft Azure AI-102 · AI-900 · AZ-900', 'Google IT Support Professional Certificate', 'Cloud fundamentals · AI services · App development', 'Professional credentials alongside product builds'],
                footer: 'LEARN IT  /  BUILD WITH IT', accent: '#3a9a8a'
            },
            {
                t: 0.955, side: 1, kicker: '08 / PROGRESS YOU CAN POINT TO',
                title: 'CONSISTENCY COMPOUNDS.',
                lines: ['500+ DSA problems solved · 4 industry certifications', '8.59 CGPA · 90% in CBSE Class X and XII', 'GGN Home live · Built and shipped a real product', 'Three Microsoft Azure credentials across cloud and AI'],
                footer: 'SMALL WINS, SHIPPED OFTEN', accent: '#cc805e'
            },
            {
                t: 0.99, side: 1, kicker: '09 / THE NEXT DESTINATION',
                title: 'LET’S BUILD WHAT’S NEXT.',
                lines: [portfolio.contact.email, portfolio.contact.phone, portfolio.contact.location + ' · India', 'LinkedIn: Tanush Chawla · GitHub: ' + portfolio.handle],
                footer: 'SAY HELLO  /  BUILD SOMETHING USEFUL', accent: '#3a9a8a'
            }
        ]

        const compact = window.innerWidth < 760
        const boardWidth = compact ? 6.25 : 8.2
        const boardHeight = compact ? 3.58 : 4.7
        this.storyBoardOffset = compact ? 6.35 : 8.25
        const backingMaterial = this.material('#24484b', { roughness: 0.62, metalness: 0.24 })
        const legMaterial = this.material('#4b5b59', { roughness: 0.55, metalness: 0.36 })
        const panelGeometry = new THREE.BoxGeometry(boardWidth, boardHeight, 0.2)
        const panelPlane = new THREE.PlaneGeometry(boardWidth - 0.17, boardHeight - 0.17)
        const postGeometry = new THREE.CylinderGeometry(0.065, 0.09, 1.7, 8)

        boards.forEach((item, index) =>
        {
            const frame = this.routeFrame(item.t)
            const sign = new THREE.Group()
            sign.name = 'StoryBoard_' + String(index + 1).padStart(2, '0')
            sign.position.copy(frame.position).addScaledVector(frame.side, item.side * this.storyBoardOffset)
            sign.position.y = compact ? 2.68 : 3.28
            sign.rotation.y = frame.yaw + (item.side > 0 ? Math.PI : 0)

            const backing = new THREE.Mesh(panelGeometry, backingMaterial)
            backing.castShadow = true
            backing.receiveShadow = true
            sign.add(backing)

            const texture = this.createStoryTexture(item, index, boards.length)
            if(texture)
            {
                const face = new THREE.Mesh(panelPlane, new THREE.MeshBasicMaterial({
                    map: texture,
                    color: '#ffffff',
                    side: THREE.DoubleSide,
                    toneMapped: false
                }))
                face.position.z = 0.112
                face.renderOrder = 5
                sign.add(face)
            }

            const edge = new THREE.LineSegments(
                new THREE.EdgesGeometry(new THREE.BoxGeometry(boardWidth + 0.07, boardHeight + 0.07, 0.24)),
                new THREE.LineBasicMaterial({
                    color: item.accent ?? '#d8b28b',
                    transparent: true,
                    opacity: 0.74
                })
            )
            edge.position.z = 0.13
            sign.add(edge)

            const postX = boardWidth * 0.36
            for(const x of [-postX, postX])
            {
                const post = new THREE.Mesh(postGeometry, legMaterial)
                post.position.set(x, -(boardHeight / 2 + 0.1), 0)
                post.castShadow = true
                sign.add(post)
            }

            const capX = boardWidth * 0.44
            for(const x of [-capX, capX])
            {
                const cap = new THREE.Mesh(
                    new THREE.SphereGeometry(0.09, 8, 6),
                    new THREE.MeshBasicMaterial({ color: item.accent ?? '#f2b879' })
                )
                cap.position.set(x, boardHeight / 2 - 0.08, 0.02)
                sign.add(cap)
            }

            this.storyBoards.push({ group: sign, edge, texture, basePulse: index * 0.64, item })
            this.storyBoardData.push(item)
            this.group.add(sign)
        })
    }

    addFlyingNote()
    {
        // A single paper note catches the wind beside the rider, rather than
        // appearing as another fixed UI card.
        const canvas = document.createElement('canvas')
        canvas.width = 1100
        canvas.height = 780
        const ctx = canvas.getContext('2d')
        if(!ctx)
            return

        ctx.fillStyle = '#f8f0dc'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = 'rgba(49, 86, 90, 0.26)'
        ctx.lineWidth = 3
        ctx.strokeRect(22, 22, 1056, 736)
        ctx.fillStyle = '#31565a'
        ctx.font = '700 25px Arial, sans-serif'
        ctx.fillText('A FIELD NOTE FROM THE RIDE', 66, 82)
        ctx.fillStyle = '#c57b59'
        ctx.fillRect(66, 110, 120, 8)
        ctx.fillStyle = '#18383d'
        ctx.font = '700 59px Arial, sans-serif'
        ctx.fillText('Ideas should', 66, 226)
        ctx.fillText('leave the notebook.', 66, 300)
        ctx.fillStyle = '#3e5555'
        ctx.font = '500 32px Arial, sans-serif'
        ctx.fillText('Models, APIs and data matter most', 66, 390)
        ctx.fillText('when they solve a real problem.', 66, 438)
        ctx.strokeStyle = 'rgba(49, 86, 90, 0.22)'
        ctx.beginPath()
        ctx.moveTo(66, 500)
        ctx.lineTo(1035, 500)
        ctx.stroke()
        ctx.fillStyle = '#42676a'
        ctx.font = '700 25px Arial, sans-serif'
        ctx.fillText('— TANUSH CHAWLA', 66, 565)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#b46d54'
        ctx.font = '700 22px Arial, sans-serif'
        ctx.fillText('AI / DATA / BACKEND', 1035, 700)

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = Math.min(8, this.game.rendering.renderer.capabilities?.getMaxAnisotropy?.() ?? 1)

        const group = new THREE.Group()
        group.name = 'WindBlownPortfolioNote'
        const noteMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            toneMapped: false,
            depthWrite: false
        })
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3.35, 2.38), noteMaterial)
        sheet.renderOrder = 7
        sheet.frustumCulled = false
        group.add(sheet)

        const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(3.52, 2.5),
            new THREE.MeshBasicMaterial({
                color: '#d8b58e',
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        )
        shadow.position.z = -0.035
        shadow.renderOrder = 6
        group.add(shadow)

        this.group.add(group)
        this.paperNote = { group, material: noteMaterial, shadowMaterial: shadow.material, texture }
    }

    animateStorytelling()
    {
        const tour = this.game.view?.scrollTour
        const progress = tour?.progress ?? 0
        const time = this.game.ticker.elapsed
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        for(const board of this.storyBoards)
        {
            board.edge.material.opacity = 0.58 + 0.18 * (0.5 + 0.5 * Math.sin((reducedMotion ? 0 : time) * 1.3 + board.basePulse))
        }

        if(!this.paperNote || !tour)
            return

        const fadeIn = smoothstep(0.32, 0.37, progress)
        const fadeOut = 1 - smoothstep(0.51, 0.57, progress)
        const visible = fadeIn * fadeOut
        this.paperNote.material.opacity = visible * 0.96
        this.paperNote.shadowMaterial.opacity = visible * 0.13
        this.paperNote.group.visible = visible > 0.005

        const t = THREE.MathUtils.clamp(progress + 0.015, 0.01, 0.99)
        const frame = this.routeFrame(t)
        const wind = reducedMotion ? 0 : time
        this.paperNote.group.position.copy(frame.position)
            .addScaledVector(frame.tangent, 1.0 + Math.sin(wind * 1.05) * 0.65)
            .addScaledVector(frame.side, Math.sin(wind * 0.82) * 1.9 - 2.7)
        this.paperNote.group.position.y = frame.position.y + 2.12 + (reducedMotion ? 0 : Math.sin(time * 1.7) * 0.2)
        this.paperNote.group.rotation.set(
            reducedMotion ? 0 : Math.sin(time * 0.7) * 0.08,
            frame.yaw - Math.PI / 2,
            reducedMotion ? 0 : Math.sin(time * 1.15) * 0.14
        )
        const scale = 0.94 + (reducedMotion ? 0 : Math.sin(time * 1.6) * 0.035)
        this.paperNote.group.scale.setScalar(scale)

        if(this.airportPamphlet && this.aircraftSource)
        {
            const airportFadeIn = smoothstep(0.885, 0.92, progress)
            const airportFadeOut = 1 - smoothstep(0.972, 0.997, progress)
            const airportVisible = airportFadeIn * airportFadeOut
            const flight = smoothstep(0.90, 0.975, progress)
            const targetT = THREE.MathUtils.clamp(progress + 0.014, 0.01, 0.99)
            const targetFrame = this.routeFrame(targetT)
            const target = targetFrame.position.clone()
                .addScaledVector(targetFrame.tangent, 1.1)
                .addScaledVector(targetFrame.side, 1.9)
            target.y = targetFrame.position.y + 2.05 + (reducedMotion ? 0 : Math.sin(time * 1.9) * 0.18)

            this.airportPamphlet.material.opacity = airportVisible * 0.98
            this.airportPamphlet.shadowMaterial.opacity = airportVisible * 0.12
            this.airportPamphlet.group.visible = airportVisible > 0.005
            this.airportPamphlet.group.position.copy(this.airportPamphlet.origin).lerp(target, flight)
            this.airportPamphlet.group.rotation.set(
                reducedMotion ? 0 : Math.sin(time * 0.9) * 0.1,
                this.aircraftYaw - Math.PI / 2 + (targetFrame.yaw - this.aircraftYaw) * flight,
                reducedMotion ? 0 : Math.sin(time * 1.35) * 0.16
            )
            this.airportPamphlet.group.scale.setScalar(1.12 - flight * 0.14)
        }
    }

    animateWater()
    {
        const time = this.game.ticker.elapsed

        if(this.riverMaterial)
            this.riverMaterial.opacity = 0.82 + Math.sin(time * 0.8) * 0.025

        this.waterfallStreams.forEach((stream, index) =>
        {
            stream.position.y = 3.5 + (index % 3) * 0.1 + Math.sin(time * 2.0 + index * 0.62) * 0.13
            stream.material.opacity = 0.4 + Math.sin(time * 1.8 + index) * 0.055
        })
    }
}
