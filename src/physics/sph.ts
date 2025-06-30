// Simple Smoothed Particle Hydrodynamics (SPH) simulation engine
// Based on https://github.com/mjwatkins2/WebGL-SPH

import { Position, dist2, vec2 } from './util';
import DynamicObject from './DynamicObject';
import StaticObject, { StaticCircle, StaticPlane } from './StaticObject';

export interface FluidParams {
	NumParticles: number;	// Number of particles in the simulation
	ParticleMass: number;	// Mass of each particle
	GasConstant: number;	// Gas constant for the equation of state
	RestDensity: number;	// Rest density of the fluid
	Viscosity: number;		// Viscosity of the fluid
};

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
let grid!: Grid;
let particles: Particle[] = [];
let colliders: StaticObject[] = [];
let sources: ParticleSource[] = [];

const INIT_MAX_PARTICLES_IN_CELL = 50;

let M    = 1.0; // Particle mass
let K    = 150;  // Gas constant
let RHO0 = 0.5;   // Rest density
let MU   = 3;   // Viscosity

// Domain boundaries
let [xmin, ymin] = [0, 0];
let [xmax, ymax] = [0, 0];

let scale = 30;
let gridCellSize = h;

let forceVelocityOn = false;
let [forceVx, forceVy] = [0, 0];
let forceVelocityCell: Cell | undefined | null = null;



// Particle definition
class Particle extends DynamicObject {
	P:   number; // Pressure
	rho: number; // Local Density

	constructor() {
		// Use safe defaults if bounds not set yet
		const safeXmin = xmin || 0;
		const safeXmax = xmax || 10;
		const safeYmin = ymin || 0;
		const safeYmax = ymax || 10;
		
		super({
			x: Math.random() * (safeXmax - safeXmin) + safeXmin,
			y: Math.random() * (safeYmax - safeYmin) + safeYmin
		});
		this.Vx = Math.random() - 0.5;
		this.Vy = Math.random() - 0.5;

		this.P  = 0;
		this.rho = M * Wpoly6(0);

		this.reset();
	}

	update(dt: number): void {
		const a = new vec2(this.Fx / this.rho, this.Fy / this.rho);

		this.velocity.addScaledVector(a, dt);
		this.velocity.clampLength(0, 10); // Limit max speed
		this.position.addScaledVector(this.velocity, dt);

		// this.x  += (this.Vx + 0.5 * Ax * dt) * dt;
		// this.y  += (this.Vy + 0.5 * Ay * dt) * dt;
		// this.position.addScaledVector(this.velocity.addScaledVector(a, dt/2), dt);

		HandleObstacleCollisions(this);
		HandleBoundaryCollisions(this);

		grid.addParticleToCell(this);
		this.reset();
	}

	reset(): void {
		this.Fx  = 0;
		this.Fy  = 0;
		this.rho = M * Wpoly6(0);
	}
}

interface ParticleSource {
	pos: vec2; // Position of the source
	rate: number; // Rate of particle generation
	lastSpawnTime: number; // Last time a particle was spawned
	spawnRadius: number; // Radius around the source position to spawn particles
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

function HandleObstacleCollisions(p1: Particle): void {
	for (const collider of colliders) {
		const distance = collider.distanceTo(new vec2(p1.x, p1.y));
		
		// If particle is inside obstacle, push it out immediately
		if (distance < 0) {
			// Calculate surface normal using finite differences
			const eps = 1e-4;
			const dx = (collider.distanceTo(new vec2(p1.x + eps, p1.y)) - distance) / eps;
			const dy = (collider.distanceTo(new vec2(p1.x, p1.y + eps)) - distance) / eps;
			
			// Normalize the gradient (surface normal pointing away from obstacle)
			const gradMag = Math.sqrt(dx * dx + dy * dy) + eps;
			const nx = dx / gradMag;
			const ny = dy / gradMag;
			
			// Push particle out to surface + small margin to avoid sticking
			const correctionDistance = -distance + 0.01;
			
			p1.x += nx * correctionDistance;
			p1.y += ny * correctionDistance;
			
			// Calculate velocity components
			const normalVel = p1.Vx * nx + p1.Vy * ny;
			const tangentVx = p1.Vx - normalVel * nx;
			const tangentVy = p1.Vy - normalVel * ny;
			
			// Remove normal velocity component and apply friction to tangent
			const friction = 0.8; // Friction coefficient (0 = no friction, 1 = full friction)
			if (normalVel < 0) { // Moving towards surface
				p1.Vx = tangentVx * friction;
				p1.Vy = tangentVy * friction;
			}
		}
	}
}

function HandleBoundaryCollisions(p1: Particle): void {
	const boundaryMargin = 0.1; // Small margin from boundaries
	
	if (p1.x < xmin + boundaryMargin) {
		p1.x = xmin + boundaryMargin;
		if (p1.Vx < 0) p1.Vx = -p1.Vx * 0.3; // Small bounce away from wall
	} else if (p1.x > xmax - boundaryMargin) {
		p1.x = xmax - boundaryMargin;
		if (p1.Vx > 0) p1.Vx = -p1.Vx * 0.3; // Small bounce away from wall
	}
	
	if (p1.y < ymin + boundaryMargin) {
		p1.y = ymin + boundaryMargin;
		if (p1.Vy < 0) p1.Vy = -p1.Vy * 0.3; // Small bounce away from wall
	} else if (p1.y > ymax - boundaryMargin) {
		p1.y = ymax - boundaryMargin;
		if (p1.Vy > 0) p1.Vy = -p1.Vy * 0.3; // Small bounce away from wall
	}
}

// Accumulate all forces
function CalcForces(): void {
	for (const cell of grid.cells) {
		for (let i = 0; i < cell.numParticles; i++) {
			const p1 = cell.particles[i];

			// Pairwise particle interactions
			for (let j = i + 1; j < cell.numParticles; j++) {
				AddForces(p1, cell.particles[j]);
			}
			for (const nb of cell.halfNeighbors) {
				for (let j = 0; j < nb.numParticles; j++) {
					AddForces(p1, nb.particles[j]);
				}
			}
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

function SpawnParticlesFromSources(currentTime: number): void {
	for (const source of sources) {
		const timeSinceLastSpawn = currentTime - source.lastSpawnTime;
		const spawnInterval = 1000 / source.rate; // Convert rate to milliseconds between spawns
		
		if (timeSinceLastSpawn >= spawnInterval) {
			// Spawn a new particle near the source
			const angle = Math.random() * 2 * Math.PI;
			const radius = Math.random() * source.spawnRadius;
			
			const spawnX = source.pos.x + Math.cos(angle) * radius;
			const spawnY = source.pos.y + Math.sin(angle) * radius;
			
			// Check if spawn position is within bounds
			if (spawnX >= xmin && spawnX <= xmax && spawnY >= ymin && spawnY <= ymax) {
				const particle = new Particle();
				particle.x = spawnX;
				particle.y = spawnY;
				
				// Give particles a small initial velocity away from the source
				const velocityMagnitude = 0.5;
				particle.Vx = Math.cos(angle) * velocityMagnitude;
				particle.Vy = Math.sin(angle) * velocityMagnitude;
				
				particles.push(particle);
			}
			
			// Update spawn time regardless of whether particle was created
			source.lastSpawnTime = currentTime;
		}
	}
}

function RemoveOldParticles(maxParticles: number): void {
	// Remove oldest particles if we exceed the maximum
	if (particles.length > maxParticles) {
		const particlesToRemove = particles.length - maxParticles;
		particles.splice(0, particlesToRemove);
	}
}




const Engine = {
	cleanup(): void {
		particles = [];
		sources = [];
		forceVelocityOn = false;
		if (grid) grid.reset();
	},

	init(width: number, height: number, left: number, right: number, bottom: number, top: number): void {
		const xlimit = width  / scale;
		xmin = left   / scale;
		xmax = right  / scale;
		const ylimit = height / scale;
		ymin = bottom / scale;
		ymax = top    / scale;

		const nx = Math.floor(xlimit / gridCellSize);
		const ny = Math.floor(ylimit / gridCellSize);
		
		// Initialize grid if it doesn't exist or has wrong dimensions
		if (!grid || grid.nx !== nx || grid.ny !== ny) {
			grid = new Grid();
			grid.init(nx, ny, xlimit, ylimit);
		}
		
		// If we don't have particles (e.g., after HMR), they will be created by setNumParticles
		if (particles.length === 0) { particles = []; }

		// Initialize test source if no sources exist
		if (sources.length === 0) {
			this.initTestSource();
		}

		// // Add some default objects for demonstration
		// if (colliders.length === 0) {
		// 	// Add a circle obstacle in the middle
		// 	const centerX = xlimit / 2;
		// 	const centerY = ylimit / 2;
		// 	const circle = new StaticCircle(new vec2(centerX, centerY), 1.5); // Radius in simulation units
		// 	colliders.push(circle);

		// 	// Add a rectangular obstacle
		// 	const rectX = xlimit * 0.7;
		// 	const rectY = ylimit * 0.3;
		// 	const rect = new StaticPlane(new vec2(rectX - 1.5, rectY - 0.75), new vec2(3.0, 1.5)); // Size in simulation units
		// 	colliders.push(rect);
		// }
	},

	resize(left: number, right: number, bottom: number, top: number): void {
		xmin = Math.max(left   / scale, 0);
		xmax = Math.min(right  / scale, xmax);
		ymin = Math.max(bottom / scale, 0);
		ymax = Math.min(top    / scale, ymax);
	},

	setNumParticles(n: number): void {
		// Only recreate particles if count changed or if we have no particles
		if (particles.length !== n) {
			particles = [];
			for (let i = 0; i < n; i++) {
				particles.push(new Particle());
			}
		}
	},

	doPhysics(): void {		
		if (!grid) return
		const dt = 15; // milliseconds
		const currentTime = Date.now();

		// Reset grid before physics calculations
		grid.reset();

		// Spawn particles from sources
		SpawnParticlesFromSources(currentTime);

		// Skip physics if no particles
		if (particles.length === 0) return;

		// Add all particles to grid first (including newly spawned ones)
		particles.forEach(p => {
			grid.addParticleToCell(p);
		});

		CalcDensity();
		CalcForces();
		CalcForcedVelocity();
		
		// Reset grid again before updating positions
		grid.reset();
		
		// Finally, update positions and add back to grid
		particles.forEach(p => p.update(dt * 0.001));
	},

	getParticlePosition(i: number, out: Position): void {
		if (i >= particles.length) return;
		const p = particles[i];
		out.x = p.x * scale;
		out.y = p.y * scale; // Fixed: removed incorrect ymin subtraction
	},

	getParticlePressure(i: number): number {
		if (i >= particles.length) return 0;
		const p = particles[i];
		return p.P / p.rho;
	},

	getParticleVelocity(i: number): vec2 {
		if (i >= particles.length) return new vec2(0, 0);
		return particles[i].velocity;
	},

	forceVelocity(x: number, y: number, Vx: number, Vy: number): void {
		forceVelocityOn = true;
		forceVelocityCell = grid.getCellFromLocation(x / scale, ymax - y / scale);
		forceVx = Vx;
		forceVy = -Vy;
	},

	setFluidProperties(params: FluidParams): void {
		M    = params.ParticleMass;
		K    = params.GasConstant;
		RHO0 = params.RestDensity;
		MU   = params.Viscosity;
	},

	// Static object management
	addStaticObject(obj: StaticObject): void {
		colliders.push(obj);
	},

	removeStaticObject(obj: StaticObject): void {
		const index = colliders.indexOf(obj);
		if (index !== -1) {
			colliders.splice(index, 1);
		}
	},

	clearStaticObjects(): void {
		colliders.length = 0;
	},

	getStaticObjects(): StaticObject[] {
		return [...colliders];
	},

	// Particle source management
	addParticleSource(pos: vec2, rate: number, spawnRadius: number = 0.1): void {
		sources.push({
			pos: new vec2(pos.x / scale, pos.y / scale), // Convert to simulation coordinates
			rate: rate,
			lastSpawnTime: Date.now(),
			spawnRadius: spawnRadius
		});
	},

	removeParticleSource(index: number): void {
		if (index >= 0 && index < sources.length) {
			sources.splice(index, 1);
		}
	},

	clearParticleSources(): void {
		sources.length = 0;
	},

	getParticleSources(): ParticleSource[] {
		return sources.map(source => ({
			...source,
			pos: new vec2(source.pos.x * scale, source.pos.y * scale) // Convert back to display coordinates
		}));
	},

	getParticleCount(): number {
		return particles.length;
	},

	// Initialize with a test particle source
	initTestSource(): void {
		// Clear existing sources first
		sources = [];
		
		// Add a test source in the middle-left of the simulation area
		const testX = xmin + (xmax - xmin) * 0.2; // 20% from left
		const testY = ymin + (ymax - ymin) * 0.5; // Middle height
		
		sources.push({
			pos: new vec2(testX, testY),
			rate: 10, // 10 particles per second
			lastSpawnTime: Date.now(),
			spawnRadius: 0.2 // Small spawn radius in simulation units
		});
	},
};

// HMR handling - Reload page when this module is updated
if ((import.meta as any).hot) {
	(import.meta as any).hot.accept(() => {
		window.location.reload();
	});
}

export default Engine;
export { StaticCircle, StaticPlane };
