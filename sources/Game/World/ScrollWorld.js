import * as THREE from 'three/webgpu'
import { color as tslColor, mix as tslMix, uniform as tslUniform } from 'three/tsl'

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

        this.addRoad()
        this.addRoadsideTrees()
        this.addRiverAndWaterfall()
        this.addBridge()
        this.addCity()
        this.addLearningHub()
        this.addAirport()

        // The existing renderer-owned ticker animates water. No second RAF loop.
        this.game.ticker.events.on('tick', () => { this.animateWater() }, 30)
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
        river.position.set(8, 0.018, -28)
        river.renderOrder = 0
        this.group.add(river)

        const bankMaterial = this.material('#789477', { roughness: 1 })
        for(const sideSign of [-1, 1])
        {
            const bank = new THREE.Mesh(new THREE.BoxGeometry(47, 0.55, 1.5), bankMaterial)
            bank.position.set(8 + sideSign * 2, 0.03, -28 + sideSign * 8.9)
            bank.rotation.y = -0.86
            bank.receiveShadow = true
            this.group.add(bank)
        }

        // The falls sit beside the road, not in it; the rider can continue
        // across the river while the camera briefly opens to the scenery.
        const cliff = new THREE.Mesh(
            new THREE.BoxGeometry(12, 9.2, 2.8),
            this.material('#8f7772', { roughness: 1 })
        )
        cliff.position.set(47, 4.35, -45)
        cliff.castShadow = true
        cliff.receiveShadow = true
        this.group.add(cliff)

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
        waterfallFace.position.set(47, 4.2, -46.45)
        this.group.add(waterfallFace)

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
            stream.position.set(42.1 + i * 1.22, 3.5 + (i % 3) * 0.1, -46.48)
            this.group.add(stream)
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
            mist.position.set(41.5 + (i % 4) * 2.7, 0.45 + (i % 3) * 0.12, -44.2 + Math.floor(i / 4) * 0.65)
            mist.scale.y = 0.48
            this.group.add(mist)
        }
    }

    addBridge()
    {
        const frame = this.routeFrame(0.49)
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
