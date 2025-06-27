// Simple Smoothed Particle Hydrodynamics (SPH) simulation engine
// Based on https://github.com/mjwatkins2/WebGL-SPH

import { Position, dist2, vec2 } from './util';
import { FluidParams } from './Fluid';
import DynamicObject from './DynamicObject';

// Smoothing Kernels
const h  = 1;
const h2 = h * h;
const h5 = Math.pow(h, 5);
const h6 = Math.pow(h, 6);
const h9 = Math.pow(h, 9);
const Wpoly6_coeff      = 315.0 / (64 * Math.PI * h9);
const Wspiky_grad_coeff = -45.0 / (Math.PI * h6);
const Wvisc_lapl_coeff  = 45.0  / (Math.PI * h5);

function Wpoly6(r2: number): number {
	const t = h2 - r2;
	return Wpoly6_coeff * t * t * t;
}
function Wspiky_grad2(r: number): number {
	const t = h - r;
	return Wspiky_grad_coeff * t * t / r;
}
function Wvisc_lapl(r: number): number {
	return Wvisc_lapl_coeff * (1 - r / h);
}





// Simulation state
let particles: Particle[] = [];
let grid!: Grid;

const INIT_MAX_PARTICLES_IN_CELL = 50;

let M    = 1.0; // Particle mass
let K    = 150;  // Gas constant
let RHO0 = 0.5;   // Rest density
let MU   = 3;   // Viscosity

// let gx = 0;
// let gy = 0;

// Domain boundaries
let xmin = 0;
let xmax = 0;
let ymin = 0;
let ymax = 0;

let scale = 30;
let gridCellSize = h;

let forceVelocityCell: Cell | undefined | null = null;
let forceVelocityOn = false;
let forceVx = 0;
let forceVy = 0;



// Particle definition
class Particle extends DynamicObject {
	P:   number; // Pressure
	rho: number; // Local Density

	constructor() {
		super({
			x: Math.random() * (xmax - xmin) + xmin,
			y: Math.random() * (ymax - ymin) + ymin
		});
		this.Vx = Math.random() - 0.5;
		this.Vy = Math.random() - 0.5;

		this.P  = 0;
		this.rho = M * Wpoly6(0);

		this.reset();
	}

	update(dt: number): void {
		// const Ax = this.Fx / this.rho /* + gx */;
		// const Ay = this.Fy / this.rho /* + gy */;
		const a = new vec2(this.Fx / this.rho, this.Fy / this.rho);

		// this.Vx += Ax * dt;
		// this.Vy += Ay * dt;
		this.velocity.addScaledVector(a, dt);
		
		this.velocity.addScaledVector(new vec2(0.2, -0.2), dt);

		this.velocity.clampLength(0, 10); // Limit max speed

		// this.x  += (this.Vx + 0.5 * Ax * dt) * dt;
		// this.y  += (this.Vy + 0.5 * Ay * dt) * dt;
		this.position.addScaledVector(this.velocity, dt);
		// this.position.addScaledVector(this.velocity.addScaledVector(a, dt/2), dt);


		// boundary collisions
		if (this.x < xmin) {
			this.x  = xmin + 1e-6;
			this.Vx *= -0.5;
		} else if (this.x > xmax) {
			this.x  = xmax - 1e-6;
			this.Vx *= -0.5;
		}
		if (this.y < ymin) {
			this.y  = ymin + 1e-6;
			this.Vy *= -0.5;
		} else if (this.y > ymax) {
			this.y  = ymax - 1e-6;
			this.Vy *= -0.5;
		}

		grid.addParticleToCell(this);
		this.reset();
	}

	reset(): void {
		this.Fx  = 0;
		this.Fy  = 0;
		this.rho = M * Wpoly6(0);
	}
}

// Grid cell
class Cell {
	particles: Particle[];
	halfNeighbors: Cell[];
	numParticles: number;

	constructor() {
		this.particles     = new Array<Particle>(INIT_MAX_PARTICLES_IN_CELL);
		this.halfNeighbors = [];
		this.numParticles  = 0;
	}
}

// Spatial grid
class Grid {
	cells: Cell[] = [];
	nx = 0;
	ny = 0;
	w  = 0;
	h  = 0;

	init(nx: number, ny: number, w: number, h: number): void {
		this.nx = nx; this.ny = ny;
		this.w  = w;  this.h  = h;

		const n = nx * ny;
		this.cells = new Array<Cell>(n);
		for (let i = 0; i < n; i++) {
			this.cells[i] = new Cell();
		}

		// precompute neighbor links
		for (let j = 0; j < ny; j++) {
			for (let i = 0; i < nx; i++) {
				this.computeNeighbors(i, j, this.cells[i + j * nx]);
			}
		}
	}

	private computeNeighbors(i: number, j: number, c: Cell): void {
		const idx = i + j * this.nx;
		// right
		if (i < this.nx - 1) {
			c.halfNeighbors.push(this.cells[idx + 1]);
		}
		// above row
		if (j < this.ny - 1) {
			for (let ii = Math.max(0, i - 1); ii <= Math.min(this.nx - 1, i + 1); ii++) {
				c.halfNeighbors.push(this.cells[idx + this.nx + (ii - i)]);
			}
		}
	}

	reset(): void {
		for (const c of this.cells) {
			c.numParticles = 0;
		}
	}

	hardReset(): void {
		for (const c of this.cells) {
			c.numParticles = 0;
			c.particles = new Array<Particle>(INIT_MAX_PARTICLES_IN_CELL);
		}
	}

	getCellFromLocation(x: number, y: number): Cell | undefined {
		const i = Math.floor(this.nx * x / this.w);
		const j = Math.floor(this.ny * y / this.h);
		return this.cells[i + j * this.nx];
	}

	addParticleToCell(p: Particle): void {
		const c = this.getCellFromLocation(p.x, p.y);
		if (c) {
			c.particles[c.numParticles++] = p;
		}
	}
}

// Density accumulation
function AddDensity(p1: Particle, p2: Particle): void {
	const r2 = dist2(p1, p2);
	if (r2 < h2) {
		const val = M * Wpoly6(r2);
		p1.rho += val;
		p2.rho += val;
	}
}

function CalcDensity(): void {
	for (const cell of grid.cells) {
		for (let i = 0; i < cell.numParticles; i++) {
			const p1 = cell.particles[i];
			// intra-cell
			for (let j = i + 1; j < cell.numParticles; j++) {
				AddDensity(p1, cell.particles[j]);
			}
			// neighbors
			for (const nb of cell.halfNeighbors) {
				for (let j = 0; j < nb.numParticles; j++) {
					AddDensity(p1, nb.particles[j]);
				}
			}
			p1.P = Math.max(K * (p1.rho - RHO0), 0);
		}
	}
}

// Pairwise forces
function AddForces(p1: Particle, p2: Particle): void {
	const r2 = dist2(p1, p2);
	if (r2 < h2) {
		const r = Math.sqrt(r2) + 1e-6;
		// pressure
		const fPress = M * (p1.P + p2.P) / (2 * p2.rho) * Wspiky_grad2(r);
		const dx = p2.x - p1.x;
		const dy = p2.y - p1.y;
		let Fx = fPress * dx;
		let Fy = fPress * dy;
		// viscosity
		const fVisc = MU * M * Wvisc_lapl(r) / p2.rho;
		Fx += fVisc * (p2.Vx - p1.Vx);
		Fy += fVisc * (p2.Vy - p1.Vy);

		p1.Fx += Fx; p1.Fy += Fy;
		p2.Fx -= Fx; p2.Fy -= Fy;
	}
}

// Wall collisions
function AddWallForces(p1: Particle): void {
	if (p1.x < xmin + h) {
		const r = p1.x - xmin;
		p1.Fx -= (M * p1.P / p1.rho) * Wspiky_grad2(r) * r;
	} else if (p1.x > xmax - h) {
		const r = xmax - p1.x;
		p1.Fx += (M * p1.P / p1.rho) * Wspiky_grad2(r) * r;
	}

	if (p1.y < ymin + h) {
		const r = p1.y - ymin;
		p1.Fy -= (M * p1.P / p1.rho) * Wspiky_grad2(r) * r;
	} else if (p1.y > ymax - h) {
		const r = ymax - p1.y;
		p1.Fy += (M * p1.P / p1.rho) * Wspiky_grad2(r) * r;
	}
}

// Accumulate all forces
function CalcForces(): void {
	for (const cell of grid.cells) {
		for (let i = 0; i < cell.numParticles; i++) {
			const p1 = cell.particles[i];
			// pairwise
			for (let j = i + 1; j < cell.numParticles; j++) {
				AddForces(p1, cell.particles[j]);
			}
			for (const nb of cell.halfNeighbors) {
				for (let j = 0; j < nb.numParticles; j++) {
					AddForces(p1, nb.particles[j]);
				}
			}
			AddWallForces(p1);
		}
	}
}

function CalcForcedVelocity(): void {
	if (!forceVelocityOn || forceVelocityCell == null) return;
	for (let i = 0; i < forceVelocityCell.numParticles; i++) {
		let p = forceVelocityCell.particles[i];
		p.Vx = forceVx;
		p.Vy = forceVy;
		p.Fx = 0;
		p.Fy = 0;
	}
	forceVelocityOn = false;
}




const Engine = {
	init(width: number, height: number, left: number, right: number, bottom: number, top: number): void {
		const xlimit = width  / scale;
		xmin = left   / scale;
		xmax = right  / scale;
		const ylimit = height / scale;
		ymin = bottom / scale;
		ymax = top    / scale;

		const nx = Math.floor(xlimit / gridCellSize);
		const ny = Math.floor(ylimit / gridCellSize);
		grid = new Grid();
		grid.init(nx, ny, xlimit, ylimit);
		particles = [];
	},

	resize(left: number, right: number, bottom: number, top: number): void {
		xmin = Math.max(left   / scale, 0);
		xmax = Math.min(right  / scale, xmax);
		ymin = Math.max(bottom / scale, 0);
		ymax = Math.min(top    / scale, ymax);
	},

	setNumParticles(n: number): void {
		particles = [];
		for (let i = 0; i < n; i++) {
			particles.push(new Particle());
		}
	},

	doPhysics(): void {
		const dt = 15; // milliseconds

		CalcDensity();
		CalcForces();
		CalcForcedVelocity();
		grid.reset();

		// Finally, update positions
		particles.forEach(p => p.update(dt * 0.001));
	},

	getParticlePosition(i: number, out: Position): void {
		const p = particles[i];
		out.x = p.x * scale;
		out.y = p.y * scale - ymin;
	},

	getParticlePressure(i: number): number {
		const p = particles[i];
		return p.P / p.rho;
	},

	forceVelocity(x: number, y: number, Vx: number, Vy: number): void {
		forceVelocityOn = true;
		forceVelocityCell = grid.getCellFromLocation(x / scale, ymax - y / scale);
		forceVx = Vx;
		forceVy = -Vy;
	},

	// setGravity(gravityX: number, gravityY: number): void {
	// 	gx = gravityX;
	// 	gy = gravityY;
	// },

	setFluidProperties(params: FluidParams): void {
		M    = params.ParticleMass;
		K    = params.GasConstant;
		RHO0 = params.RestDensity;
		MU   = params.Viscosity;
	}
};

export default Engine;