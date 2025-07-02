// Simple Smoothed Particle Hydrodynamics (SPH) simulation engine
// Based on https://github.com/mjwatkins2/WebGL-SPH

import { dist2, randomPos } from './util';
import { Positionable, vec2 } from "./types/util";
import DynamicObject from './DynamicObject';
import StaticObject, { StaticCircle, StaticPlane } from './StaticObject';
import ParticleSource, { SpawnSide } from './ParticleSource';
import ParticleSink, { SinkSide } from './ParticleSink';
import Grid, { Cell } from './ParticleGrid';
import { Box2 } from 'three';


export interface FluidParams {
	ParticleMass: number;	// Mass of each particle
	GasConstant: number;	// Gas constant for the equation of state
	RestDensity: number;	// Rest density of the fluid
	Viscosity: number;		// Viscosity of the fluid
};

const SIM_MAX_PARTICLES = 6000;
const CELL_MAX_PARTICLES = 50;
const EPS = 1e-4;

// Smoothing Kernels
const H  = 1;
const H2 = H * H;
const H5 = Math.pow(H, 5);
const H6 = Math.pow(H, 6);
const H9 = Math.pow(H, 9);

const Wpoly6_coeff      = 315.0 / (64 * Math.PI * H9);
function Wpoly6(r2: number): number {
	const t = H2 - r2;
	return Wpoly6_coeff * t * t * t;
}
const Wspiky_grad_coeff = 45.0 / (Math.PI * H6);
function Wspiky_grad2(r: number): number {
	const t = H - r;
	return Wspiky_grad_coeff * t * t / r;
}
const Wvisc_lapl_coeff  = 45.0  / (Math.PI * H5);
function Wvisc_lapl(r: number): number {
	return Wvisc_lapl_coeff * (1 - r / H);
}




// Simulation state
let particles: SPHParticle[] = [];
let staticObjects: StaticObject[] = [];
let externalForces: ((pos: vec2) => vec2)[] = [];

let sources: ParticleSource[] = [];
let sinks: ParticleSink[] = [];
let grid!: Grid<SPHParticle>;

let M    = 1.0; // Particle mass
let K    = 150; // Gas constant
let RHO0 = 0.5; // Rest density
let MU   = 3.0; // Viscosity

// Domain boundaries
let [xmin, ymin] = [0, 0];
let [xmax, ymax] = [0, 0];

let scale = 30;
let gridCellSize = H;

let forceVelocityOn = false;
let [forceVx, forceVy] = [0, 0];
let forceVelocityCell: Cell<SPHParticle> | undefined | null = null;



// Particle definition
class SPHParticle extends DynamicObject {
	M:   number; // Mass
	P:   number; // Pressure
	rho: number; // Local Density

	constructor({
		mass = M,
		force = new vec2(),
		velocity = new vec2(),
		pos = new vec2(),
	} = {}) {
		super(pos, velocity, force);

		this.P = 0;
		this.M = mass;
		this.velocity = (velocity) ? velocity : new vec2(
			Math.random() - 0.5, Math.random() - 0.5
		);

		this.reset();
	}

	update(dt: number): void {
		// Calculate acceleration from forces
		const acceleration = this.force.divideScalar(this.rho);

		this.velocity // Update velocity
			.addScaledVector(acceleration, dt)
			.clampLength(0, 10) // Limit max speed
		;

		this.position // Update position
			.addScaledVector(this.velocity, dt)
		;

		this.reset();
	}

	reset(): void {
		[this.Fx, this.Fy] = [0, 0];
		this.rho = this.M * Wpoly6(0);
	}
}

function HandleObstacleCollisions(p1: SPHParticle): void {
	for (const collider of staticObjects) {
		const distance = collider.distanceTo(new vec2(p1.x, p1.y));
		
		if (distance < 0) {
			// Calculate surface normal using finite differences
			const dx = (collider.distanceTo(new vec2(p1.x + EPS, p1.y)) - distance) / EPS;
			const dy = (collider.distanceTo(new vec2(p1.x, p1.y + EPS)) - distance) / EPS;
			
			// Normalize the gradient (surface normal pointing away from obstacle)
			const gradMag = Math.sqrt(dx * dx + dy * dy) + EPS;
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
			const friction = 0; // Friction coefficient (0 = no friction, 1 = full friction)
			if (normalVel < 0) { // Moving towards surface
				p1.Vx = tangentVx * friction;
				p1.Vy = tangentVy * friction;
			}
		}
	}
}

function HandleBoundaryCollisions(p1: SPHParticle): void {


	const repulsion = (d: number) => {
		return Math.abs((M * p1.P / p1.rho) * Wspiky_grad2(d) * d);
	};

	const l = p1.x - xmin;
	const b = p1.y - ymin;
	const t = ymax - p1.y;
	const r = xmax - p1.x;
	if (l < H) {p1.Fx += repulsion(l)}
	else if (l <= 0) {p1.Vx = -p1.Vx}
	if (b < H) {p1.Fy += repulsion(b)}
	else if (b <= 0) {p1.Vy = -p1.Vy}
	if (t < H) {p1.Fy -= repulsion(t)}
	else if (t <= 0) {p1.Vy = -p1.Vy}
	if (r < H) {p1.Fx -= repulsion(r)}
	else if (r <= 0) {p1.Vx = -p1.Vx}
	

	// if (p1.x - xmin < H) {p1.Fx += repulsion(p1.x - xmin); /* p1.Vx = -p1.Vx */} //l
	// if (p1.y - ymin < H) {p1.Fy += repulsion(p1.y - ymin); /* p1.Vy = -p1.Vy */} //b
	// if (ymax - p1.y < H) {p1.Fy -= repulsion(ymax - p1.y); /* p1.Vy = -p1.Vy */} //t
	// if (xmax - p1.x < H) {p1.Fx -= repulsion(xmax - p1.x); /* p1.Vx = -p1.Vx */} //r



	// if (p1.x < xmin + H) { const d = p1.x - xmin;
	// 	p1.Fx += repulsion(d);
	// } else if (p1.x > xmax - H) { const d = xmax - p1.x;
	// 	p1.Fx -= repulsion(d);
	// }

	// if (p1.y < ymin + H) { const d = p1.y - ymin;
	// 	p1.Fy += repulsion(d);
	// } else if (p1.y > ymax - H) { const d = ymax - p1.y;
	// 	p1.Fy -= repulsion(d);
	// }
}


function repulseFromSurface(p1: SPHParticle): void {
	const surfaceNormal = new vec2();

	if (p1.x < xmin + H) {
		surfaceNormal.set(-1, 0);
	} else if (p1.x > xmax - H) {
		surfaceNormal.set(1, 0);
	}

	if (p1.y < ymin + H) {
		surfaceNormal.set(0, -1);
	} else if (p1.y > ymax - H) {
		surfaceNormal.set(0, 1);
	}

	if (surfaceNormal.length() > 0) {
		surfaceNormal.normalize();
		const d = surfaceNormal.length();
		const force = (M * p1.P / p1.rho) * Wspiky_grad2(d) * d;
		p1.Fx -= force * surfaceNormal.x;
		p1.Fy -= force * surfaceNormal.y;
	}
}

// Particle-particle interaction forces
function addForces(p1: SPHParticle, p2: SPHParticle): void {
	const r2 = dist2(p1, p2);
	if (r2 < H2) {
		const r = Math.sqrt(r2) + 1e-6;

		// Pressure
		const fPress = M * (p1.P + p2.P) / (2 * p2.rho) * Wspiky_grad2(r);
		const [dx, dy] = [p1.x - p2.x, p1.y - p2.y];
		let [Fx, Fy] = [dx * fPress, dy * fPress];

		// Viscosity
		const fVisc = MU * M * Wvisc_lapl(r) / p2.rho;
		Fx += fVisc * (p2.Vx - p1.Vx);
		Fy += fVisc * (p2.Vy - p1.Vy);

		p1.Fx += Fx; p1.Fy += Fy;
		p2.Fx -= Fx; p2.Fy -= Fy;
	}
}

function addDensity(p1: SPHParticle, p2: SPHParticle): void {
	const r2 = dist2(p1, p2);
	if (r2 < H2) {
		const val = M * Wpoly6(r2);
		p1.rho += val; p2.rho += val;
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

function HandleParticleSources(currentTime: number): void {
	for (const source of sources) {
		const timeSinceLastSpawn = currentTime - source.lastSpawnTime;
		const spawnInterval = 1000 / source.rate; // Convert rate to milliseconds between spawns
		
		if (timeSinceLastSpawn >= spawnInterval && particles.length < SIM_MAX_PARTICLES) {
			let spawnX: number, spawnY: number;
			let velocityX: number, velocityY: number;

			if (source.direction && source.spawnLength > 0) {
				// Rectangle/line source - spawn along a line with directional velocity
				const lineOffset = (Math.random() - 0.5) * source.spawnLength;
				
				// Calculate perpendicular vector to spawn direction for line positioning
				const perpX = -source.direction.y;
				const perpY = source.direction.x;
				
				spawnX = source.pos.x + perpX * lineOffset;
				spawnY = source.pos.y + perpY * lineOffset;
				
				// Add some randomness to spawn position along the direction
				const directionOffset = (Math.random() - 0.5) * 0.1;
				spawnX += source.direction.x * directionOffset;
				spawnY += source.direction.y * directionOffset;
				
				// Set initial velocity in the spawn direction with some randomness
				const velocityMagnitude = source.velocity || 1.0;
				const velocityRandomness = 0.3;
				velocityX = source.direction.x * velocityMagnitude * (1 + (Math.random() - 0.5) * velocityRandomness);
				velocityY = source.direction.y * velocityMagnitude * (1 + (Math.random() - 0.5) * velocityRandomness);
			} else {
				// Point source - spawn in a circle
				const angle = Math.random() * 2 * Math.PI;
				const radius = Math.random() * source.spawnRadius;
				
				spawnX = source.pos.x + Math.cos(angle) * radius;
				spawnY = source.pos.y + Math.sin(angle) * radius;
				
				// Give particles a small initial velocity away from the source
				const velocityMagnitude = 0.5;
				velocityX = Math.cos(angle) * velocityMagnitude;
				velocityY = Math.sin(angle) * velocityMagnitude;
			}
			
			// Check if spawn position is within bounds
			if (spawnX >= xmin && spawnX <= xmax && spawnY >= ymin && spawnY <= ymax) {
				const particle = new SPHParticle();
				particle.x = spawnX;
				particle.y = spawnY;
				particle.Vx = velocityX;
				particle.Vy = velocityY;

				particles.push(particle);
			}
			
			// Update spawn time regardless of whether particle was created
			source.lastSpawnTime = currentTime;
		}
	}
}

function HandleParticleSinks(currentTime: number): void {
	for (const sink of sinks) {
		const timeSinceLastRemoval = currentTime - sink.lastVanishTime;
		const removalInterval = 1000 / sink.rate; // Convert rate to milliseconds between removals
		
		if (timeSinceLastRemoval >= removalInterval) {
			// Find particles to remove
			for (let i = particles.length - 1; i >= 0; i--) {
				const particle = particles[i];
				const particlePos = new vec2(particle.x, particle.y);
				
				if (sink.shouldRemoveParticle(particlePos)) {
					// Remove the particle
					particles.splice(i, 1);
					sink.lastVanishTime = currentTime;
					break; // Only remove one particle per sink per interval
				}
			}
		}
	}
}


const Simulation = {
	init(width: number, height: number, left: number, right: number, bottom: number, top: number): void {
		const xlimit = width  / scale;
		const ylimit = height / scale;
		this.resize(left, right, bottom, top);

		const nx = Math.floor(xlimit / gridCellSize);
		const ny = Math.floor(ylimit / gridCellSize);

		// Initialize grid if it doesn't exist or has wrong dimensions
		if (!grid || grid.nx !== nx || grid.ny !== ny) {
			grid = new Grid<SPHParticle>(nx, ny, xlimit, ylimit, CELL_MAX_PARTICLES);
		}

		// Default simulation setup

		// Static colliders preset
		const presetColliders = [
		  new StaticPlane(new vec2(0.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(0.00, 15.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(15.00, 1.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(3.67, 11.87), new vec2(21.23, 1.90)),
			new StaticCircle(new vec2(14, 18), 2.5),
		  new StaticPlane(new vec2(3.70, 22.43), new vec2(10.23, 2.67)),
		  new StaticPlane(new vec2(2.20, 12.77), new vec2(2.50, 12.10)),
		  new StaticPlane(new vec2(12.53, 23.20), new vec2(3.43, 6.13)),
		  new StaticPlane(new vec2(15.70, 28.10), new vec2(1.83, 3.23)),
		  new StaticPlane(new vec2(17.47, 29.83), new vec2(8.57, 1.70)),
		  new StaticPlane(new vec2(23.67, 26.03), new vec2(2.37, 4.03)),
		  new StaticPlane(new vec2(22.30, 23.77), new vec2(3.67, 2.37)),
		  new StaticPlane(new vec2(22.60, 19.47), new vec2(3.33, 4.30)),
			
			new StaticCircle(new vec2(24.5, 20.7), 5),
			new StaticPlane(new vec2(24, 15.8), new vec2(24, 4.23)),

			new StaticPlane(new vec2(26.43, 12.40), new vec2(16.07, 1.50)),
		  new StaticPlane(new vec2(24.27, 3.40), new vec2(13.07, 1.33)),
		  new StaticPlane(new vec2(26.47, 4.47), new vec2(2.50, 1.80)),
		  new StaticPlane(new vec2(31.80, 6.70), new vec2(5.17, 4.40)),
		  new StaticPlane(new vec2(40.50, 3.53), new vec2(1.97, 9.33)),
		  new StaticPlane(new vec2(46.30, 11.80), new vec2(1.70, 6.10)),
		  new StaticPlane(new vec2(47.63, 12.57), new vec2(7.53, 1.83)),
		  new StaticPlane(new vec2(42.20, 3.40), new vec2(12.33, 1.23)),
		  new StaticPlane(new vec2(48.73, 6.67), new vec2(6.50, 4.33)),
		  new StaticPlane(new vec2(15.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(15.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(0.00, 0.03), new vec2(24.70, 13.67)),
			
		  new StaticPlane(new vec2(0.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(0.00, 15.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(15.00, 1.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(15.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(0.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(0.00, 15.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(15.00, 1.00), new vec2(0.20, 3.00)),

			new StaticPlane(new vec2(25.53, 19.50), new vec2(32.47, 16.50)),
		  new StaticPlane(new vec2(46.67, 12.70), new vec2(11.30, 7.40)),
		  new StaticPlane(new vec2(36.87, 0.00), new vec2(3.93, 12.93)),
		  new StaticPlane(new vec2(0.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(0.00, 15.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(15.00, 1.00), new vec2(0.20, 3.00)),
			new StaticPlane(new vec2(24.13, 0.00), new vec2(33.40, 3.67)),
		  new StaticPlane(new vec2(54.40, 0.00), new vec2(3.60, 35.97)),
		  new StaticPlane(new vec2(0.00, 30.87), new vec2(26.30, 5.13)),
		  new StaticPlane(new vec2(0.00, 23.33), new vec2(15.67, 7.87)),
		  new StaticPlane(new vec2(0.00, 12.47), new vec2(2.63, 11.20)),
		  new StaticPlane(new vec2(0.00, 22.87), new vec2(0.60, 8.93)),
		  new StaticPlane(new vec2(0.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(0.00, 15.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(15.00, 1.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(15.00, 10.00), new vec2(0.20, 3.00)),
		  new StaticPlane(new vec2(0.00, 0.00), new vec2(59.00, 1.47)),
		  new StaticPlane(new vec2(56.97, 0.03), new vec2(6.87, 35.97))
		].forEach(obj => {
			// this.addStaticObject(obj)
		});

		
		[ // Particle sources
			{ obj: new StaticPlane(new vec2(3, 14), new vec2(1.8, 8)), side: 'right', rate: 80, vel: 2.0 },
			{ obj: new StaticPlane(new vec2(18, 29.8), new vec2(5, 1)), side: 'bottom', rate: 80, vel: 2.0 },
		].forEach((def) => {
			// this.addStaticObject(def.obj);
			// this.addParticleSourceFromPlane(def.obj, def.side, def.rate, def.vel);
		});

		[ // Particle sinks
			{ obj: new StaticPlane(new vec2(23, 26), new vec2(1, 5)), side: 'left', rate: 80, range: 0.3 },
			{ obj: new StaticPlane(new vec2(24, 4), new vec2(3, 1)), side: 'left', rate: 8, range: 0.3 },
			{ obj: new StaticPlane(new vec2(36, 4), new vec2(1, 9)), side: 'left', rate: 80, range: 0.3 },
			{ obj: new StaticPlane(new vec2(54, 4), new vec2(1, 9)), side: 'left', rate: 80, range: 0.3 },
		].forEach((def) => {
			// this.addStaticObject(def.obj);
			// this.addParticleSinkFromPlane(def.obj, def.side, def.rate, def.range);
		});



		// TESTING: half-fill simulation with particles
		const area: Box2 = new Box2( new vec2(xmin, ymin), new vec2(xmax, ymax) );
		for (let i = 0; i < SIM_MAX_PARTICLES/2; i++) {
			particles.push(new SPHParticle({ pos: randomPos(area) }));
		}
	},


	cleanup(): void {
		particles = [];
		sources = [];
		sinks = [];
		forceVelocityOn = false;
		if (grid) grid.reset();
	},

	clearParticlesOnly(): void {
		particles = [];
		forceVelocityOn = false;
		if (grid) grid.reset();
	},

	resize(left: number, right: number, bottom: number, top: number): void {
		const margin = 5;

		xmin = (left + margin)   / scale;
		ymin = (bottom + margin) / scale;
		xmax = (right - margin)  / scale;
		ymax = (top - margin)    / scale;

		// xmin = Math.max(left/scale, 0) + margin;
		// ymin = Math.max(bottom/scale, 0) + margin;
		// xmax = Math.min(right/scale, xmax) - margin;
		// ymax = Math.min(top/scale, ymax) - margin;
	},

	doPhysics(): void {		
		if (!grid) return
		const dt = 15; // milliseconds
		const currentTime = Date.now();

		// Reset grid before physics calculations
		grid.reset();

		HandleParticleSources(currentTime);
		HandleParticleSinks(currentTime);



		if (particles.length === 0) return;

		// Add all particles to grid first (including newly spawned ones)
		particles.forEach(p => { grid.addParticle(p) });

		// CalcDensity();
		// CalcForces();

		grid.pairwise(addDensity);
		particles.forEach(p => { p.P = Math.max(K * (p.rho - RHO0), 0); });
		grid.pairwise(addForces);

		CalcForcedVelocity();
		
		// Reset grid again before updating positions
		grid.reset();

		let avgRho = 0;
		let avgSpeed = 0;
		for (const p of particles) {
			
			HandleObstacleCollisions(p);
			HandleBoundaryCollisions(p);
			
			p.update(dt * 0.001);
			
			grid.addParticle(p);

			avgRho += p.rho;
			avgSpeed += p.velocity.length();

			p.reset();
		}

		avgRho /= particles.length;
		avgSpeed /= particles.length;
		console.log(`Avg Density: ${avgRho.toFixed(2)}, Avg Speed: ${avgSpeed.toFixed(2)}`);
	},

	getParticlePosition(i: number, out: Positionable): void {
		if (i >= particles.length) return;
		const p = particles[i];
		out.x = p.x * scale;
		out.y = p.y * scale;
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
		staticObjects.push(obj);
	},

	removeStaticObject(obj: StaticObject): boolean {
		const index = staticObjects.indexOf(obj);
		if (index > -1) {
			staticObjects.splice(index, 1);
			// Also remove any sources and sinks that were associated with this object
			if (obj instanceof StaticPlane) {
				sources = sources.filter(source => source.staticPlane !== obj);
				sinks = sinks.filter(sink => sink.staticPlane !== obj);
			}
			return true;
		}
		return false;
	},

	getStaticColliders(): StaticObject[] {
		return [...staticObjects];
	},

	clearStaticObjects(): void {
		staticObjects = [];
		// Also clear any sources and sinks that were associated with planes
		sources = sources.filter(source => source.staticPlane === null);
		sinks = sinks.filter(sink => sink.staticPlane === null);
	},

	addParticleSourceFromPlane(plane: StaticPlane, spawnSide: SpawnSide, rate: number, velocity: number = 1.0): number {
		const source = new ParticleSource(
			new vec2(0, 0), // Position will be calculated from plane
			rate,
			velocity,
			plane,
			spawnSide
		);
		sources.push(source);
		return sources.length - 1; // Return the index of the added source
	},


	addParticleSource(pos: vec2, direction: vec2, spawnLength: number, rate: number, velocity: number = 1.0): number {
		const source = new ParticleSource(
			new vec2(pos.x / scale, pos.y / scale), // Convert to simulation coordinates
			rate,
			velocity,
			null, // No associated plane
			'none',
			direction.clone().normalize(), // Ensure direction is normalized
			spawnLength / scale // Convert to simulation coordinates
		);
		sources.push(source);
		return sources.length - 1; // Return the index of the added source
	},

	getParticleSources(): ParticleSource[] {
		return sources.map(source => {
			// Create a copy with display coordinates for position
			const sourceCopy = new ParticleSource(
				new vec2(source.pos.x * scale, source.pos.y * scale), // Convert back to display coordinates
				source.rate,
				source.velocity,
				source.staticPlane,
				source.spawnSide,
				source.direction,
				source.spawnLength * scale // Convert back to display coordinates
			);
			sourceCopy.lastSpawnTime = source.lastSpawnTime;
			return sourceCopy;
		});
	},

	addParticleSinkFromPlane(plane: StaticPlane, sinkSide: SinkSide, rate: number, sinkRange: number = 0.5): number {
		const sink = new ParticleSink(
			new vec2(0, 0), // Position will be calculated from plane
			rate,
			sinkRange,
			plane,
			sinkSide
		);
		sinks.push(sink);
		return sinks.length - 1; // Return the index of the added sink
	},

	addParticleSink(pos: vec2, rate: number, sinkRange: number = 0.5): number {
		const sink = new ParticleSink(
			new vec2(pos.x / scale, pos.y / scale), // Convert to simulation coordinates
			rate,
			sinkRange,
			null, // No associated plane
			'none'
		);
		sinks.push(sink);
		return sinks.length - 1; // Return the index of the added sink
	},

	getParticleSinks(): ParticleSink[] {
		return sinks.map(sink => {
			// Create a copy with display coordinates for position
			const sinkCopy = new ParticleSink(
				new vec2(sink.pos.x * scale, sink.pos.y * scale), // Convert back to display coordinates
				sink.rate,
				sink.sinkRange * scale, // Convert back to display coordinates
				sink.staticPlane,
				sink.sinkSide,
				sink.sinkLength * scale // Convert back to display coordinates
			);
			sinkCopy.lastVanishTime = sink.lastVanishTime;
			return sinkCopy;
		});
	},

	getParticleCount(): number {
		return particles.length;
	},
};

// HMR handling - Reload page when this module is updated
if ((import.meta as any).hot) {
	(import.meta as any).hot.accept(() => { window.location.reload() });
}

export default Simulation;
export { StaticCircle, StaticPlane };
export type { SpawnSide } from './ParticleSource';
export type { SinkSide } from './ParticleSink';
