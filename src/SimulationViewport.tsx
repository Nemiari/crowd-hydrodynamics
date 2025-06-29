import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import Engine, { FluidParams } from './physics/sph';

export interface ViewportConfig {
	Interactable: boolean;
}


interface SimulationViewportProps extends ViewportConfig {
	fluidParams: FluidParams;
}

export default function SimulationViewport({ fluidParams, ...cfg }: SimulationViewportProps) {
	const canvasRef = useRef<HTMLDivElement>(null);
	const sceneRef = useRef<THREE.Scene | null>(null);
	const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const materialRef = useRef<THREE.Material | null>(null);
	const circleRef = useRef<THREE.BufferGeometry>(new THREE.CircleBufferGeometry(5, 12));
	const arrowRef = useRef<THREE.BufferGeometry>(new THREE.CircleBufferGeometry(5, 3));
	const meshesRef = useRef<THREE.Mesh[]>([]);
	const animationIdRef = useRef<number | null>(null);
	const isMountedRef = useRef<boolean>(true);
	
	const dimensionsRef = useRef({
		left: 0,
		right: 0,
		bottom: 0,
		top: 0,
		zoomX: 1,
		zoomY: 1,
		initialOrientation: 0,
		windowMovementInterval: -1,
		paused: false
	});

	const defaultOrientation = useCallback((): { angle: number } => {
		return { angle: 0 };
	}, []);

	const computeWindowArea = useCallback((): void => {
		const dims = dimensionsRef.current;
		const canvasContainer = canvasRef.current;
		if (!canvasContainer) return;
		
		const rect = canvasContainer.getBoundingClientRect();
		dims.left = 0;
		dims.right = rect.width;
		dims.bottom = 0;
		dims.top = rect.height;
		dims.zoomX = 1;
		dims.zoomY = 1;
	}, []);

	const handleMouseMove = useCallback((e: MouseEvent): void => {
		if (!cfg.Interactable) return;

		const dims = dimensionsRef.current;
		if (dims.windowMovementInterval !== -1) {
			clearInterval(dims.windowMovementInterval);
			dims.windowMovementInterval = -1;
		}
		Engine.forceVelocity(e.clientX + dims.left, e.clientY, e.movementX, e.movementY);
	}, [cfg.Interactable]);

	const handleVisibilityChange = useCallback((): void => {
		const dims = dimensionsRef.current;
		if (dims.paused && !document.hidden) {
			(Engine as any).unpause?.();
		}
		dims.paused = document.hidden;
	}, []);

	const handleMouseOut = useCallback((e: MouseEvent): void => {
		const dims = dimensionsRef.current;
		if (dims.windowMovementInterval === -1 && !e.relatedTarget) {
			dims.windowMovementInterval = window.setInterval(() => {
				const prev = { 
					left: dims.left, 
					right: dims.right, 
					bottom: dims.bottom, 
					top: dims.top 
				};
				computeWindowArea();
				if (prev.left !== dims.left || prev.right !== dims.right || 
					prev.bottom !== dims.bottom || prev.top !== dims.top) {
					handleWindowResize();
				}
			}, 10);
		}
	}, [computeWindowArea]);

	const handleWindowResize = useCallback((): void => {
		const dims = dimensionsRef.current;
		const camera = cameraRef.current;
		const renderer = rendererRef.current;
		
		if (!camera || !renderer) return;
		
		computeWindowArea();
		const width = dims.right - dims.left;
		const height = dims.top - dims.bottom;

		const angleDiff = (screen.orientation ?? defaultOrientation()).angle - dims.initialOrientation;
		if (Math.abs(angleDiff) > 1) {
			reinit();
		} else {
			Engine.resize(dims.left, dims.right, dims.bottom, dims.top);
			renderer.setSize(width * dims.zoomX, height * dims.zoomY);
			camera.rotation.z = 0;
			camera.position.set(0, 0, camera.position.z);
		}

		renderer.setSize(width * dims.zoomX, height * dims.zoomY);
		camera.left = dims.left;
		camera.right = dims.right;
		camera.top = dims.top;
		camera.bottom = dims.bottom;
		camera.updateProjectionMatrix();
	}, [computeWindowArea, defaultOrientation]);

	const setNumParticles = useCallback((n: number): void => {
		const scene = sceneRef.current;
		const circle = circleRef.current;
		const arrow = arrowRef.current;
		const material = materialRef.current;
		const meshes = meshesRef.current;

		if (!scene || !circle || !arrow || !material) return;

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
			const mesh = new THREE.Mesh(circle, (material as THREE.MeshBasicMaterial).clone());
			meshes[i] = mesh;
			scene.add(mesh);
		}
	}, []);

	const doLoop = useCallback((): void => {
		if (!isMountedRef.current) return;
		
		const scene = sceneRef.current;
		const camera = cameraRef.current;
		const renderer = rendererRef.current;
		const meshes = meshesRef.current;
		
		if (!scene || !camera || !renderer || !canvasRef.current) return;
		
		Engine.doPhysics();
		for (let i = 0; i < meshes.length; i++) {
			Engine.getParticlePosition(i, meshes[i].position);
			const pressure = Engine.getParticlePressure(i);
			(meshes[i].material as THREE.MeshBasicMaterial)
				.color.setRGB(pressure / 20, 0.5, 0.5);
				
			// Change mesh based on movement
			const velocity = Engine.getParticleVelocity(i);
			if (velocity.lengthSq() < 0.5) { // Set to circle if not moving
				meshes[i].scale.setScalar(0.8);
				meshes[i].rotation.z = 0;
				meshes[i].geometry = circleRef.current;
			} else { // Set to arrow if moving
				meshes[i].rotation.z = Math.atan2(velocity.y, velocity.x);
				meshes[i].scale.set(1 + Math.abs(velocity.x) * 0.6, 1, 1);
				meshes[i].geometry = arrowRef.current;
			}


		}
		renderer.render(scene, camera);
		
		if (isMountedRef.current) {
			animationIdRef.current = requestAnimationFrame(doLoop);
		}
	}, []);

	const createScene = useCallback((): void => {
		const dims = dimensionsRef.current;
		dims.initialOrientation = (screen.orientation ?? defaultOrientation()).angle;
		computeWindowArea();
		
		const width = dims.right - dims.left;
		const height = dims.top - dims.bottom;
		
		Engine.init(width, height, dims.left, dims.right, dims.bottom, dims.top);

		const near = 0;
		const far = 1;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x001122);
		sceneRef.current = scene;

		const camera = new THREE.OrthographicCamera(dims.left, dims.right, dims.top, dims.bottom, near, far);
		camera.position.z = 0.5;
		cameraRef.current = camera;

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(width * dims.zoomX, height * dims.zoomY);
		rendererRef.current = renderer;

		const material = new THREE.MeshBasicMaterial({ color: 0x4499ff });
		materialRef.current = material;

		const circle = new THREE.CircleBufferGeometry(5, 12);
		const arrow = new THREE.CircleBufferGeometry(5, 3);
		circleRef.current = circle;
		arrowRef.current = arrow;
	}, [computeWindowArea, defaultOrientation]);

	const attachToDocument = useCallback((): void => {
		const renderer = rendererRef.current;
		const canvasContainer = canvasRef.current;
		
		if (!renderer || !canvasContainer) return;
		
		canvasContainer.appendChild(renderer.domElement);
		window.addEventListener('mouseout', handleMouseOut, false);
		window.addEventListener('visibilitychange', handleVisibilityChange, false);
		// Note: mousemove listener is managed separately in a useEffect
	}, [handleMouseOut, handleVisibilityChange]);

	const init = useCallback((): void => {
		createScene();
		attachToDocument();
		setNumParticles(fluidParams.NumParticles);
		Engine.setFluidProperties(fluidParams);
		doLoop();
	}, [createScene, attachToDocument, setNumParticles, doLoop, fluidParams]);

	const reinit = useCallback((): void => {
		const dims = dimensionsRef.current;
		dims.initialOrientation = (screen.orientation ?? defaultOrientation()).angle;
		computeWindowArea();
		
		const width = dims.right - dims.left;
		const height = dims.top - dims.bottom;
		
		Engine.init(width, height, dims.left, dims.right, dims.bottom, dims.top);
		Engine.setFluidProperties(fluidParams);
		setNumParticles(fluidParams.NumParticles);
		doLoop();
	}, [computeWindowArea, defaultOrientation, setNumParticles, doLoop, fluidParams]);

	useEffect(() => {
		isMountedRef.current = true;
		
		// Clean up any previous instance
		if (animationIdRef.current) {
			cancelAnimationFrame(animationIdRef.current);
			animationIdRef.current = null;
		}
		
		// Clean up the physics engine state
		Engine.cleanup();
		
		init();
		
		return () => {
			isMountedRef.current = false;
			if (animationIdRef.current) {
				cancelAnimationFrame(animationIdRef.current);
				animationIdRef.current = null;
			}
			
			const dims = dimensionsRef.current;
			if (dims.windowMovementInterval !== -1) {
				clearInterval(dims.windowMovementInterval);
				dims.windowMovementInterval = -1;
			}
			
			window.removeEventListener('mouseout', handleMouseOut);
			window.removeEventListener('visibilitychange', handleVisibilityChange);
			
			const renderer = rendererRef.current;
			if (renderer) {
				// Note: mousemove listener cleanup is handled in separate useEffect
				renderer.dispose();
			}
			
			// Clean up physics engine
			Engine.cleanup();
		};
	}, []);

	// Separate effect to manage mouse event listener based on interaction state
	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer) return;

		// Remove existing listener
		renderer.domElement.removeEventListener('mousemove', handleMouseMove);
		
		// Add listener only if interaction is enabled
		if (cfg.Interactable) {
			renderer.domElement.addEventListener('mousemove', handleMouseMove, false);
		}

		// Cleanup function
		return () => {
			renderer.domElement.removeEventListener('mousemove', handleMouseMove);
		};
	}, [cfg.Interactable, handleMouseMove]);

	// Effect to update fluid parameters when they change
	useEffect(() => {
		Engine.setFluidProperties(fluidParams);
	}, [fluidParams]);

	// Separate effect to handle particle count changes
	useEffect(() => {
		setNumParticles(fluidParams.NumParticles);
	}, [fluidParams.NumParticles, setNumParticles]);

	// Effect to handle window resize
	useEffect(() => {
		const handleResize = () => {
			handleWindowResize();
		};

		window.addEventListener('resize', handleResize);
		
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, [handleWindowResize]);

	return (
		<div 
			ref={canvasRef}
			style={{ 
				width: '100%', 
				height: '100%',
				overflow: 'hidden'
			}}
		/>
	);
}
