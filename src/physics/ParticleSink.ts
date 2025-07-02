import { vec2 } from "./types/util";
import { StaticPlane } from "./StaticObject";

export type SinkSide = 'none' | 'top' | 'bottom' | 'left' | 'right';

export default class ParticleSink {
	staticPlane: StaticPlane | null; // Associated static plane for particle removal
	pos: vec2; // Position of the sink
	rate: number; // Rate of particle removal per second
	lastVanishTime: number; // Last time a particle was removed
	sinkRange: number; // Range/radius for particle removal
	sinkSide: SinkSide; // Which side of the plane to remove particles from
	sinkLength: number; // Length of sink line for rectangle sinks

	constructor(
		pos: vec2,
		rate: number = 5,
		sinkRange: number = 0.5,
		staticPlane: StaticPlane | null = null,
		sinkSide: SinkSide = 'none',
		sinkLength?: number
	) {
		this.staticPlane = staticPlane;
		this.pos = pos.clone();
		this.rate = rate;
		this.lastVanishTime = Date.now();
		this.sinkRange = sinkRange;
		this.sinkSide = sinkSide;

		if (staticPlane && sinkSide !== 'none') {
			// Calculate sink parameters from the static plane
			const sinkInfo = this.getSinkInfoFromPlane();
			if (sinkInfo) {
				this.pos = sinkInfo.position;
				this.sinkLength = this.getSinkLineLengthFromPlane();
			} else {
				this.sinkLength = sinkLength || 1.0;
			}
		} else {
			// Point sink or manual configuration
			this.sinkLength = sinkLength || 0;
		}
	}

	/** Get the position for particle removal from the associated plane */
	private getSinkInfoFromPlane(): { position: vec2 } | null {
		if (!this.staticPlane || this.sinkSide === 'none') return null;

		const plane = this.staticPlane;
		const centerX = plane.x + plane.width / 2;
		const centerY = plane.y + plane.height / 2;
		let position: vec2;

		switch (this.sinkSide) {
			case 'top':
				position = new vec2(centerX, plane.y + plane.height);
				break;
			case 'bottom':
				position = new vec2(centerX, plane.y);
				break;
			case 'left':
				position = new vec2(plane.x, centerY);
				break;
			case 'right':
				position = new vec2(plane.x + plane.width, centerY);
				break;
			default:
				return null;
		}

		return { position };
	}

	/** Get the sink line length for distributing particle removal along the side */
	private getSinkLineLengthFromPlane(): number {
		if (!this.staticPlane) return 0;

		switch (this.sinkSide) {
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

	/** Update sink parameters if the associated plane has changed */
	updateFromPlane(): void {
		if (this.staticPlane && this.sinkSide !== 'none') {
			const sinkInfo = this.getSinkInfoFromPlane();
			if (sinkInfo) {
				this.pos = sinkInfo.position;
				this.sinkLength = this.getSinkLineLengthFromPlane();
			}
		}
	}

	/** Check if a particle should be removed by this sink */
	shouldRemoveParticle(particlePos: vec2): boolean {
		if (this.staticPlane && this.sinkSide !== 'none' && this.sinkLength > 0) {
			// Rectangle/line sink - check if particle is within range of the sink line
			const toParticle = new vec2(particlePos.x - this.pos.x, particlePos.y - this.pos.y);
			
			// Calculate perpendicular distance to the sink line
			let perpDistance: number;
			let linePosition: number;
			
			switch (this.sinkSide) {
				case 'top':
				case 'bottom':
					perpDistance = Math.abs(toParticle.y);
					linePosition = Math.abs(toParticle.x);
					break;
				case 'left':
				case 'right':
					perpDistance = Math.abs(toParticle.x);
					linePosition = Math.abs(toParticle.y);
					break;
				default:
					return false;
			}
			
			return perpDistance <= this.sinkRange && linePosition <= this.sinkLength / 2;
		} else {
			// Point sink - check distance to center
			const distance = Math.sqrt(
				(particlePos.x - this.pos.x) ** 2 + 
				(particlePos.y - this.pos.y) ** 2
			);
			return distance <= this.sinkRange;
		}
	}
}