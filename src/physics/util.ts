import { Box2 } from "three";
import { Positionable, vec2 } from "./types/util";

// == Functions ====================================

/** Squared distance between two point-like objects */
export function dist2(p1: Positionable, p2: Positionable): number {
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;
	return dx * dx + dy * dy;
}

/** Return a random position within the given area */
export function randomPos(area: Box2): vec2 {
	const x = Math.random() * (area.max.x - area.min.x) + area.min.x;
	const y = Math.random() * (area.max.y - area.min.y) + area.min.y;
	return new vec2(x, y);
}