import * as THREE from 'three';
// import { GUI } from 'dat.gui';
import Engine from './physics/sph';

window.addEventListener('load', init, false);

let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let material: THREE.Material;
let circle: THREE.CircleBufferGeometry;
let meshes: THREE.Mesh[] = [];
let left = 0, right = 0, bottom = 0, top = 0;
let zoomX = 1, zoomY = 1;
let initialOrientation = 0;
let windowMovementInterval = -1;
let paused = false;
// const gui = new GUI();

interface FluidParams {
	NumParticles: number;
	ParticleMass: number;
	GasConstant: number;
	RestDensity: number;
	Viscosity: number;
}
const fluidParams: FluidParams = {
	NumParticles: 4000,
	ParticleMass: 1.0,
	GasConstant: 8.0,
	RestDensity: 0.5,
	Viscosity: 3.0,
};

function init(): void {
	createScene();
	attachToDocument();
	setNumParticles(fluidParams.NumParticles);
	Engine.setFluidProperties(fluidParams);
	// addGUI();
	doLoop();
}

function defaultOrientation(): { angle: number } {
	return { angle: 0 };
}

function reinit(): void {
	initialOrientation = (screen.orientation ?? defaultOrientation()).angle;
	computeWindowArea();
	Engine.init(screen.width, screen.height, left, right, bottom, top);
	Engine.setFluidProperties(fluidParams);
	setNumParticles(fluidParams.NumParticles);
	doLoop();
}

function createScene(): void {
	initialOrientation = (screen.orientation ?? defaultOrientation()).angle;
	computeWindowArea();
	Engine.init(screen.width, screen.height, left, right, bottom, top);

	const width  = right  - left;
	const height = top    - bottom;
	const near   = 0;
	const far    = 1;

	camera   = new THREE.OrthographicCamera(left, right, top, bottom, near, far);
	camera.position.z = 1;

	renderer = new THREE.WebGLRenderer();
	renderer.setSize(width * zoomX, height * zoomY);

	material = new THREE.MeshBasicMaterial({ color: 0xffffff });
	circle   = new THREE.CircleBufferGeometry(5, 6);

	scene = new THREE.Scene();
	renderer.render(scene, camera);
}

function attachToDocument(): void {
	document.body.appendChild(renderer.domElement);
	window.addEventListener('mouseout', handleMouseOut, false);
	window.addEventListener('visibilitychange', handleVisibilityChange, false);
	renderer.domElement.addEventListener('mousemove', handleMouseMove, false);
}

function handleVisibilityChange(): void {
	if (paused && !document.hidden) {
		(Engine as any).unpause?.();
	}
	paused = document.hidden;
}

function handleMouseOut(e: MouseEvent): void {
	if (windowMovementInterval === -1 /* && !e.toElement */ && !e.relatedTarget) {
		windowMovementInterval = window.setInterval(() => {
			const prev = { left, right, bottom, top };
			computeWindowArea();
			if (prev.left !== left || prev.right !== right || prev.bottom !== bottom || prev.top !== top) {
				handleWindowResize();
			}
		}, 10);
	}
}

function handleWindowResize(): void {
	computeWindowArea();
	const width  = right - left;
	const height = top   - bottom;
	const aspect = width / height;

	const angleDiff = (screen.orientation ?? defaultOrientation()).angle - initialOrientation;
	if (Math.abs(angleDiff) > 1) {
		reinit();
	} else {
		Engine.resize(left, right, bottom, top);
		renderer.setSize(width * zoomX, height * zoomY);
		camera.rotation.z = 0;
		camera.position.set(0, 0, camera.position.z);
	}

	renderer.setSize(width * zoomX, height * zoomY);
	camera.left   = left;
	camera.right  = right;
	camera.top    = top;
	camera.bottom = bottom;
	camera.updateProjectionMatrix();
}

function computeWindowArea(): void {
	const padW = Math.max(window.outerWidth - window.innerWidth, 0);
	left   = window.screenX + padW / 2;
	right  = window.screenX + window.outerWidth - padW / 2;

	const padH = Math.max(window.outerHeight - window.innerHeight, 0);
	bottom = screen.height - window.screenY - window.outerHeight;
	top    = screen.height - window.screenY - padH;

	zoomX = window.innerWidth > window.outerWidth  ? window.innerWidth  / window.outerWidth  : 1;
	zoomY = window.innerHeight > window.outerHeight ? window.innerHeight / window.outerHeight : 1;

	if (zoomX !== 1 || zoomY !== 1) {
		left   = 0;
		right  = screen.width;
		bottom = 0;
		top    = screen.height;
	}
}

function handleMouseMove(e: MouseEvent): void {
	if (windowMovementInterval !== -1) {
		clearInterval(windowMovementInterval);
		windowMovementInterval = -1;
	}
	Engine.forceVelocity(e.clientX + left, e.clientY, e.movementX, e.movementY);
}

function setNumParticles(n: number): void {
	let start = 0;
	if (meshes.length) {
		if (n < meshes.length) {
			for (let i = n; i < meshes.length; i++) {
				scene.remove(meshes[i]);
			}
			meshes.length = n;
		}
		start = meshes.length;
	}

	Engine.setNumParticles(n);
	for (let i = start; i < n; i++) {
		const m = new THREE.Mesh(circle, (material as THREE.MeshBasicMaterial).clone());
		meshes[i] = m;
		scene.add(m);
	}
}

// function addGUI(): void {
//   gui.add(fluidParams, 'NumParticles', 0, 5000).step(10).onFinishChange(setNumParticles);
//   gui.add(fluidParams, 'ParticleMass',   1, 1000).onChange(updateFluidProperties);
//   gui.add(fluidParams, 'GasConstant',     1, 1000).onChange(updateFluidProperties);
//   gui.add(fluidParams, 'RestDensity',     0, 10).onChange(updateFluidProperties);
//   gui.add(fluidParams, 'Viscosity',       0, 10).onChange(updateFluidProperties);
// }

// function updateFluidProperties(): void {
// 	Engine.setFluidProperties(
// 		fluidParams.ParticleMass,
// 		fluidParams.GasConstant,
// 		fluidParams.RestDensity,
// 		fluidParams.Viscosity
// 	);
// }

function doLoop(): void {
	Engine.doPhysics();
	for (let i = 0; i < meshes.length; i++) {
		Engine.getParticlePosition(i, meshes[i].position);
		const pressure = Engine.getParticlePressure(i);
		(meshes[i].material as THREE.MeshBasicMaterial)
			.color.setRGB(pressure / 20, 0.5, 0.5);
	}
	renderer.render(scene, camera);
	requestAnimationFrame(doLoop);
}

export {}; // keep module scope