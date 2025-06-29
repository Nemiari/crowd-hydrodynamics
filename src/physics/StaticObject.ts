import { BufferGeometry } from "three";
import { vec2 } from "./util";

export default abstract class StaticObject {
	position: vec2; // Top-left corner
	geometry: BufferGeometry;

	get x(): number { return this.position.x };
	get y(): number { return this.position.y };
	set x(value: number) { this.position.x = value };
	set y(value: number) { this.position.y = value };

	

	constructor(pos: { x: number, y: number }, geometry: BufferGeometry) {
		this.position = new vec2(pos.x, pos.y);
		this.geometry = geometry;
	}

}