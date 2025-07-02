import DynamicObject from "./DynamicObject";

type Interaction<Particle extends DynamicObject> = (p1: Particle, p2: Particle) => void;

export class Cell<Particle extends DynamicObject> {
	numParticles: number;
	particles: Particle[];

	// Only top and right neighboring cells for efficiency
	neighborsTR: Cell<Particle>[];

	constructor(capacity: number) {
		this.particles = new Array<Particle>(capacity);
		this.neighborsTR = [];
		this.numParticles = 0;
	}
}

// Spatial grid
export default class ParticleGrid<Particle extends DynamicObject> {
	cellCapacity: number;
	cells: Cell<Particle>[] = [];
	nx = 0; ny = 0;
	w  = 0; h  = 0;

	reset(): void { for (const c of this.cells) { c.numParticles = 0 } }

	getCellFromLocation(x: number, y: number): Cell<Particle> | undefined {
		const i = Math.floor(this.nx * x / this.w);
		const j = Math.floor(this.ny * y / this.h);
		return this.cells[this.idxAt(i, j)];
	}

	addParticle(p1: Particle): void {
		const c = this.getCellFromLocation(p1.x, p1.y);
		if (c) c.particles[c.numParticles++] = p1;
		// else console.error("Tried to add particle out of bounds:", p1.x, p1.y);
	}

	/** Call an interaction function for each pair of particles that can interact */
	pairwise(interaction: Interaction<Particle>): void {
		for (const c of this.cells) {
			for (let i = 0; i < c.numParticles; i++) {
				const p1 = c.particles[i];

				// Same cell
				for (let j = i + 1; j < c.numParticles; j++) {
					interaction(p1, c.particles[j]);
				}

				// Neighboring cells
				for (const nb of c.neighborsTR) {
					for (let j = 0; j < nb.numParticles; j++) {
						interaction(p1, nb.particles[j]);
					}
				}
			}
		}
	}

	constructor(nx: number, ny: number, w: number, h: number, cellCapacity: number) {
		this.nx = nx; this.ny = ny;
		this.w  = w;  this.h  = h;
		this.cellCapacity = cellCapacity;

		const n = nx * ny;
		this.cells = new Array<Cell<Particle>>(nx * ny);
		for (let i = 0; i < nx*ny; i++) {
			this.cells[i] = new Cell<Particle>(this.cellCapacity)
		}

		for (let j = 0; j < ny; j++) {
			for (let i = 0; i < nx; i++) {
				const c = this.cells[this.idxAt(i, j)];

				if (i < this.nx - 1) { // Right neighbor
					c.neighborsTR.push(this.cells[this.idxAt(i + 1, j)]);
				}
				if (j < this.ny - 1) { // Bottom neighbors
					for (let ii = Math.max(0, i - 1); ii <= Math.min(this.nx - 1, i + 1); ii++)
						c.neighborsTR.push(this.cells[this.idxAt(ii, j + 1)]);
				}
			}
		}
	}

	/** Returns the index of the cell at the given grid slot */
	private idxAt(i: number, j: number): number { return i + j * this.nx; }
}
