import { vec2 } from "./util";

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

	constructor(pos: { x: number, y: number }) {
		this.position = new vec2(pos.x, pos.y);
		this.velocity = new vec2(0, 0);
		this.force = new vec2(0, 0);
	}

	abstract reset(): void;
	abstract update(dt: number): void;
}