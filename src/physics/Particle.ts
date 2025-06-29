import { Position } from "./util";

export default class Particle {
	x:   number;
	y:   number;
	Vx:  number;
	Vy:  number;
	rho: number;
	P:   number;
	Fx:  number;
	Fy:  number;

	constructor(posMin: Position, posMax: Position) {
		this.x   = Math.random() * (posMax.x - posMin.x) + posMin.x;
		this.y   = Math.random() * (posMax.y - posMin.y) + posMin.y;
		this.Vx  = Math.random() - 0.5;
		this.Vy  = Math.random() - 0.5;
		this.P   = 0;
		// this.rho = 0;
		// this.Fx  = 0;
		// this.Fy  = 0;
		this.reset();
	}

	reset(): void {
		this.Fx  = 0;
		this.Fy  = 0;
		this.rho = m * Wpoly6(0);
	}
}