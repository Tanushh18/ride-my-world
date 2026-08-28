import { Game } from '../Game.js'

/**
 * Rapier world and body factory.
 *
 * Everything physical in the project is created through `add()` so collision
 * groups, damping and contact events stay consistent in one place.
 */
export class Physics
{
    constructor()
    {
        this.game = Game.getInstance()
        const RAPIER = this.game.RAPIER

        this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
        this.eventQueue = new RAPIER.EventQueue(true)
        this.physicals = []

        // Bit groups: a wheel must not collide with the chassis bumper, and the
        // floor must collide with everything.
        this.groups = {
            all:    0b0000000000000001,
            object: 0b0000000000000010,
            bumper: 0b0000000000000100
        }
        this.categories = {
            floor:  (this.groups.all) << 16 | (this.groups.all),
            object: (this.groups.all | this.groups.object) << 16 | (this.groups.all | this.groups.bumper),
            bumper: (this.groups.bumper) << 16 | (this.groups.object)
        }

        this.game.ticker.events.on('tick', () => { this.update() }, 3)

        const debugPanel = this.game.debug.addFolder({ title: 'Physics' })
        if(debugPanel)
        {
            this.debugPanel = debugPanel
            debugPanel.addBinding(this.world.gravity, 'y', { min: -30, max: 10, step: 0.1 })
        }
    }

    add(description)
    {
        const RAPIER = this.game.RAPIER
        const physical = {}

        physical.linearDamping = description.linearDamping ?? 0.1
        physical.angularDamping = description.angularDamping ?? 0.1

        // Body
        const type = description.type ?? 'dynamic'
        let bodyDescription = RAPIER.RigidBodyDesc[type]()

        if(description.position)
            bodyDescription.setTranslation(description.position.x, description.position.y, description.position.z)

        if(description.rotation)
            bodyDescription.setRotation(description.rotation)

        bodyDescription
            .setLinearDamping(physical.linearDamping)
            .setAngularDamping(physical.angularDamping)
            .setCanSleep(description.canSleep ?? true)

        physical.type = type
        physical.body = this.world.createRigidBody(bodyDescription)

        // Colliders
        physical.colliders = []

        for(const colliderDescription of description.colliders)
        {
            // 'hull' is spelled differently in Rapier, and can fail to build
            const shape = colliderDescription.shape === 'hull' ? 'convexHull' : colliderDescription.shape
            let collider = RAPIER.ColliderDesc[shape](...colliderDescription.parameters)

            if(!collider)
                throw new Error(`Physics > could not build a ${colliderDescription.shape} collider`)

            if(colliderDescription.position)
                collider.setTranslation(
                    colliderDescription.position.x,
                    colliderDescription.position.y,
                    colliderDescription.position.z
                )

            if(colliderDescription.rotation)
                collider.setRotation(colliderDescription.rotation)

            if(typeof colliderDescription.mass !== 'undefined')
            {
                if(colliderDescription.centerOfMass)
                    collider.setMassProperties(
                        colliderDescription.mass,
                        colliderDescription.centerOfMass,
                        { x: 1, y: 1, z: 1 },
                        { x: 0, y: 0, z: 0, w: 1 }
                    )
                else
                    collider.setMass(colliderDescription.mass)
            }
            else
            {
                collider.setDensity(colliderDescription.density ?? 0.1)
            }

            collider.setFriction(colliderDescription.friction ?? description.friction ?? 0.2)
            collider.setRestitution(colliderDescription.restitution ?? description.restitution ?? 0.15)

            const category = colliderDescription.category ?? description.category ?? 'object'
            collider.setCollisionGroups(this.categories[category])

            if(typeof description.onCollision === 'function')
            {
                collider.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
                collider.setContactForceEventThreshold(description.contactThreshold ?? 15)
                physical.onCollision = description.onCollision
            }

            physical.colliders.push(this.world.createCollider(collider, physical.body))
        }

        physical.initialState = {
            position: { ...physical.body.translation() },
            rotation: { ...physical.body.rotation() }
        }

        this.physicals.push(physical)

        return physical
    }

    update()
    {
        this.world.timestep = this.game.ticker.delta
        this.world.step(this.eventQueue)

        this.eventQueue.drainContactForceEvents(event =>
        {
            const first = this.world.getCollider(event.collider1())?.parent()
            const second = this.world.getCollider(event.collider2())?.parent()

            const callbacks = [ first, second ]
                .map(body => body?.userData?.object?.physical?.onCollision)
                .filter(callback => typeof callback === 'function')

            if(callbacks.length === 0)
                return

            const mass = (first?.mass() ?? 0) + (second?.mass() ?? 0)
            const force = event.maxForceMagnitude() / Math.max(mass, 0.001)
            const position = first?.translation() ?? second?.translation()

            for(const callback of callbacks)
                callback(force, position)
        })
    }
}
