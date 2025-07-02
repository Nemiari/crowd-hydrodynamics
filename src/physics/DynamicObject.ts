import { vec2 } from "./types/util";

type Vector = { x: number; y: number; } | vec2;

export default abstract class DynamicObject {
	position: vec2;
	velocity: vec2;
	force: vec2;

	get x(): number { return this.position.x };
	get y(): number { return this.position.y };
	set x(value: number) { this.position.x = value };
	set y(value: number) { this.position.y = value };

	get Vx(): number { return this.velocity.x };
	get Vy(): number { return this.velocity.y };
	set Vx(value: number) { this.velocity.x = value };
	set Vy(value: number) { this.velocity.y = value };

	get Fx(): number { return this.force.x };
	get Fy(): number { return this.force.y };
	set Fx(value: number) { this.force.x = value };
	set Fy(value: number) { this.force.y = value };

	constructor(pos: Vector, velocity?: Vector, force?: Vector) {
		this.position = pos instanceof vec2 ? pos : new vec2(
			pos.x, pos.y
		);
		this.velocity = velocity instanceof vec2 ? velocity : new vec2(
			velocity?.x || 0, velocity?.y || 0
		);
		this.force    = force instanceof vec2 ? force : new vec2(
			force?.x || 0, force?.y || 0
		);
	}

	abstract update(dt: number): void;
}