import { vec2 } from "./util";
import { StaticPlane } from "./StaticObject";

export type SpawnSide = 'none' | 'top' | 'bottom' | 'left' | 'right';

export default class ParticleSource {
	staticPlane: StaticPlane | null; // Associated static plane for spawning
	pos: vec2; // Position of the source
	rate: number; // Rate of particle generation
	lastSpawnTime: number; // Last time a particle was spawned
	spawnRadius: number; // Radius around the source position to spawn particles
	direction: vec2; // Spawn direction
	spawnLength: number; // Length of spawn line
	velocity: number; // Initial velocity magnitude
	spawnSide: SpawnSide; // Which side of the plane to spawn from

	constructor(
		pos: vec2,
		rate: number = 5,
		velocity: number = 1.0,
		staticPlane: StaticPlane | null = null,
		spawnSide: SpawnSide = 'none',
		direction?: vec2,
		spawnLength?: number
	) {
		this.staticPlane = staticPlane;
		this.pos = pos.clone();
		this.rate = rate;
		this.lastSpawnTime = Date.now();
		this.velocity = velocity;
		this.spawnSide = spawnSide;
		this.spawnRadius = 0.1; // Default for point sources

		if (staticPlane && spawnSide !== 'none') {
			// Calculate spawn parameters from the static plane
			const spawnInfo = this.getSpawnInfoFromPlane();
			if (spawnInfo) {
				this.pos = spawnInfo.position;
				this.direction = spawnInfo.direction;
				this.spawnLength = this.getSpawnLineLengthFromPlane();
			} else {
				this.direction = direction || new vec2(0, 1);
				this.spawnLength = spawnLength || 1.0;
			}
		} else {
			// Point source or manual configuration
			this.direction = direction || new vec2(0, 1);
			this.spawnLength = spawnLength || 0;
		}
	}

	/** Get the position and direction for particle spawning from the associated plane */
	private getSpawnInfoFromPlane(): { position: vec2; direction: vec2 } | null {
		if (!this.staticPlane || this.spawnSide === 'none') return null;

		const plane = this.staticPlane;
		const centerX = plane.x + plane.width / 2;
		const centerY = plane.y + plane.height / 2;
		let position: vec2;
		let direction: vec2;

		switch (this.spawnSide) {
			case 'top':
				position = new vec2(centerX, plane.y + plane.height);
				direction = new vec2(0, 1); // upward
				break;
			case 'bottom':
				position = new vec2(centerX, plane.y);
				direction = new vec2(0, -1); // downward
				break;
			case 'left':
				position = new vec2(plane.x, centerY);
				direction = new vec2(-1, 0); // leftward
				break;
			case 'right':
				position = new vec2(plane.x + plane.width, centerY);
				direction = new vec2(1, 0); // rightward
				break;
			default:
				return null;
		}

		return { position, direction };
	}

	/** Get the spawn line length for distributing particles along the side */
	private getSpawnLineLengthFromPlane(): number {
		if (!this.staticPlane) return 0;

		switch (this.spawnSide) {
			case 'top':
			case 'bottom':
				return this.staticPlane.width;
			case 'left':
			case 'right':
				return this.staticPlane.height;
			default:
				return 0;
		}
	}

	/** Update spawn parameters if the associated plane has changed */
	updateFromPlane(): void {
		if (this.staticPlane && this.spawnSide !== 'none') {
			const spawnInfo = this.getSpawnInfoFromPlane();
			if (spawnInfo) {
				this.pos = spawnInfo.position;
				this.direction = spawnInfo.direction;
				this.spawnLength = this.getSpawnLineLengthFromPlane();
			}
		}
	}
}


