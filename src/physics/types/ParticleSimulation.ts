import { vec2 } from "./util";
import StaticObject from "../StaticObject";
import DynamicObject from "../DynamicObject";

export abstract class Particle extends DynamicObject {}

export type ParticleSimulationState = {
	particles: Particle[];
	staticObjects: StaticObject[];
	externalForces: vec2[];
};

export type ParticleSimulationEngine = {
	doTick(state: ParticleSimulationState, dt: number): void;
	addParticle(state: ParticleSimulationState, particle: Particle): void;
	addStaticObject(state: ParticleSimulationState, object: StaticObject): void;

	[key: string]: any;
};
