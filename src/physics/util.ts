import { Vector2 } from "three";

// == Types ========================================

export type Position = { x: number; y: number; };
// export type Velocity = { Vx: number; Vy: number; };

export type Side = 'top' | 'bottom' | 'left' | 'right';


// == Functions ====================================

/** Squared distance between two points */
export function dist2(p1: Position, p2: Position): number {
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;
	return dx * dx + dy * dy;
}


// == Classes ======================================

export class vec2 extends Vector2 {
	constructor(x?: number, y?: number) {
		super(x, y);
	}
}