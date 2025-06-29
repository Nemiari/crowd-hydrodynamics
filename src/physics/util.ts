import { Vector2 } from "three";

export class vec2 extends Vector2 {
	constructor(x?: number, y?: number) {
		super(x, y);
	}
}


export type Position = {
	x: number;
	y: number;
};

export type Velocity = {
	Vx: number;
	Vy: number;
};

// Squared distance
export function dist2(p1: Position, p2: Position): number {
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;
	return dx * dx + dy * dy;
}