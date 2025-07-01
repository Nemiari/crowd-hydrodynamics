import { Box2, CircleBufferGeometry, PlaneBufferGeometry } from "three";
import { vec2 } from "./util";

export default abstract class StaticObject {
	position: vec2; // Top-left corner
	color: string; // Color for rendering
	material?: THREE.Material;

	get x(): number { return this.position.x };
	get y(): number { return this.position.y };
	set x(value: number) { this.position.x = value };
	set y(value: number) { this.position.y = value };

	/** Signed distance to the closest point inside the object */
	abstract distanceTo(pos: vec2): number;

	constructor(pos: vec2, color: string="#000000") {
		this.position = new vec2(pos.x, pos.y);
		this.color = color;
	}
}

export class StaticPlane extends StaticObject {
	geometry: PlaneBufferGeometry;

	get width(): number { return this.geometry.parameters.width; }
	get height(): number { return this.geometry.parameters.height; }

	constructor(pos: vec2, dimensions: vec2, color: string = "#000000", material?: THREE.Material) {
		super(pos, color);
		this.geometry = new PlaneBufferGeometry(dimensions.x, dimensions.y);
		this.material = material;
	}

	distanceTo(pos: vec2): number {
		// For rectangles, calculate distance to closest edge
		// Negative if inside, positive if outside
		const top = this.y + this.height;
		const left = this.x;
		const bottom = this.y;
		const right = this.x + this.width;

		// Check if point is inside rectangle
		if (pos.x >= left && pos.x <= right && pos.y >= bottom && pos.y <= top) {
			// Point is inside - return negative distance to closest edge
			const distToLeft = pos.x - left;
			const distToRight = right - pos.x;
			const distToBottom = pos.y - bottom;
			const distToTop = top - pos.y;
			
			return -Math.min(distToLeft, distToRight, distToBottom, distToTop);
		} else {
			// Point is outside - return positive distance to closest point on rectangle
			const dx = Math.max(left - pos.x, 0, pos.x - right);
			const dy = Math.max(bottom - pos.y, 0, pos.y - top);
			return Math.sqrt(dx * dx + dy * dy);
		}
	}
}

export class StaticCircle extends StaticObject {
	geometry: CircleBufferGeometry;

	get radius(): number { return this.geometry.parameters.radius || 0; }

	constructor(pos: vec2, radius: number, color: string = "#000000") {
		super(pos, color);
		this.geometry = new CircleBufferGeometry(radius, 32);
	}

	distanceTo(pos: vec2): number {
		const dx = pos.x - this.x;
		const dy = pos.y - this.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		return distance - this.radius;
	}
}