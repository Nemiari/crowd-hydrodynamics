import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import Sim, { FluidParams, StaticCircle, StaticPlane } from './physics/sph';
import { vec2 } from './physics/util';

export interface ViewportConfig {
	Interactable: boolean;
	Paused: boolean;
	AddingObjects: boolean;
	ObjectType: 'circle' | 'rectangle';
	ObjectColor: string;
}


interface SimulationViewportProps extends ViewportConfig {
	fluidParams: FluidParams;
}

export interface SimulationViewportRef {
	clearParticles: () => void;
}

export default forwardRef<SimulationViewportRef, SimulationViewportProps>(function SimulationViewport({ fluidParams, ...cfg }, ref) {
	const canvasRef = useRef<HTMLDivElement>(null);
	const sceneRef = useRef<THREE.Scene | null>(null);
	const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const materialRef = useRef<THREE.Material | null>(null);
	const circleRef = useRef<THREE.BufferGeometry>(new THREE.CircleBufferGeometry(5, 12));
	const arrowRef = useRef<THREE.BufferGeometry>(new THREE.CircleBufferGeometry(5, 3));
	const meshesRef = useRef<THREE.Mesh[]>([]);
	const staticObjectMeshesRef = useRef<THREE.Mesh[]>([]);
	const sourcesMeshesRef = useRef<THREE.Mesh[]>([]);
	const sinksMeshesRef = useRef<THREE.Mesh[]>([]);
	const selectedObjectRef = useRef<{ object: any; meshIndex: number } | null>(null);
	const isDraggingRef = useRef<boolean>(false);
	const dragStartRef = useRef<{ x: number; y: number } | null>(null);
	const isCreatingRectRef = useRef<boolean>(false);
	const tempRectRef = useRef<{ startX: number; startY: number; mesh: THREE.Mesh | null }>({ startX: 0, startY: 0, mesh: null });
	const animationIdRef = useRef<number | null>(null);
	const isMountedRef = useRef<boolean>(true);
	const backgroundMeshRef = useRef<THREE.Mesh | null>(null);
	const textureLoaderRef = useRef<THREE.TextureLoader>(new THREE.TextureLoader());
	
	const dimensionsRef = useRef({
		left: 0,
		right: 0,
		bottom: 0,
		top: 0,
		zoomX: 1,
		zoomY: 1,
		initialOrientation: 0,
		windowMovementInterval: -1,
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

	const updateSourcesAndSinksMeshes = useCallback((): void => {
		const scene = sceneRef.current;
		if (!scene) return;

		// Remove existing source meshes
		for (const mesh of sourcesMeshesRef.current) {
			scene.remove(mesh);
		}
		sourcesMeshesRef.current.length = 0;

		// Remove existing sink meshes
		for (const mesh of sinksMeshesRef.current) {
			scene.remove(mesh);
		}
		sinksMeshesRef.current.length = 0;
	}, []);


	const updateStaticObjectMeshes = useCallback((): void => {
		const scene = sceneRef.current;
		const staticMeshes = staticObjectMeshesRef.current;
		
		if (!scene) return;

		// Store current selection before clearing meshes
		const currentSelection = selectedObjectRef.current;

		// // Remove existing static object meshes
		// for (const mesh of staticMeshes) { scene.remove(mesh) }
		// staticMeshes.length = 0;

		// Add meshes for current static objects
		const staticObjects = Sim.getStaticColliders();
		for (const obj of staticObjects) {
			let geometry: THREE.BufferGeometry;
			const scale = 30; // Same scale used in the simulation
			
			if (obj instanceof StaticCircle) {
				geometry = new THREE.CircleBufferGeometry(obj.radius * scale, 32);
			} else if (obj instanceof StaticPlane) {
				geometry = new THREE.PlaneBufferGeometry(obj.width * scale, obj.height * scale);
			} else {
				continue; // Skip unknown object types
			}

			const material = obj.material || new THREE.MeshBasicMaterial({ 
				color: obj.color || "#000000", 
				transparent: true, 
				opacity: 1.0,
				side: THREE.DoubleSide
			});
			
			const mesh = new THREE.Mesh(geometry, material);
			
			// Position the mesh based on object position (scale to screen coordinates)
			if (obj instanceof StaticCircle) {
				mesh.position.set(obj.x * scale, obj.y * scale, 0);
			} else if (obj instanceof StaticPlane) {
				// For planes, position is top-left corner, but Three.js centers meshes
				mesh.position.set(
					(obj.x + obj.width / 2) * scale, 
					(obj.y + obj.height / 2) * scale, 
					0
				);
			}
			
			staticMeshes.push(mesh);
			scene.add(mesh);
		}

		// Restore selection if it still exists
		if (currentSelection && staticObjects.length > currentSelection.meshIndex) {
			const newObj = staticObjects[currentSelection.meshIndex];
			if (newObj === currentSelection.object) {
				// Same object, restore selection - will be handled later
				// selectObject(newObj, currentSelection.meshIndex);
			} else {
				// Object changed or was deleted, clear selection
				selectedObjectRef.current = null;
				// clearEditHandles(); - will be handled later
			}
		}

		// Also update sources and sinks meshes when static objects change
		updateSourcesAndSinksMeshes();
	}, [updateSourcesAndSinksMeshes]);

	const handleMouseMove = useCallback((e: MouseEvent): void => {
		// Handle rectangle creation dragging
		if (isCreatingRectRef.current && cfg.AddingObjects && cfg.ObjectType === 'rectangle') {
			const rect = canvasRef.current?.getBoundingClientRect();
			const dims = dimensionsRef.current;
			const scene = sceneRef.current;
			
			if (!rect || !scene) return;

			const currentX = (e.clientX - rect.left) / 30;
			const currentY = (dims.top - (e.clientY - rect.top)) / 30;
			
			const temp = tempRectRef.current;
			const width = Math.abs(currentX - temp.startX);
			const height = Math.abs(currentY - temp.startY);
			const x = Math.min(currentX, temp.startX);
			const y = Math.min(currentY, temp.startY);

			// Update or create temp rectangle mesh
			if (temp.mesh) {
				scene.remove(temp.mesh);
			}

			const geometry = new THREE.PlaneBufferGeometry(width * 30, height * 30);
			const material = new THREE.MeshBasicMaterial({ 
				color: 0xffff00, 
				transparent: true, 
				opacity: 0.5,
				side: THREE.DoubleSide
			});
			
			temp.mesh = new THREE.Mesh(geometry, material);
			temp.mesh.position.set(
				(x + width / 2) * 30,
				(y + height / 2) * 30,
				0.1
			);
			
			scene.add(temp.mesh);
			return;
		}

		// Handle normal fluid interaction
		if (!cfg.Interactable || cfg.AddingObjects) return;

		const dims = dimensionsRef.current;
		if (dims.windowMovementInterval !== -1) {
			clearInterval(dims.windowMovementInterval);
			dims.windowMovementInterval = -1;
		}
		Sim.forceVelocity(e.clientX + dims.left, e.clientY, e.movementX * 0.3, e.movementY * 0.3);
	}, [cfg.Interactable, cfg.AddingObjects, cfg.ObjectType]);

	const handleTouchMove = useCallback((e: TouchEvent): void => {
		if (!cfg.Interactable) return;
		e.preventDefault(); // Prevent scrolling

		const dims = dimensionsRef.current;
		if (dims.windowMovementInterval !== -1) {
			clearInterval(dims.windowMovementInterval);
			dims.windowMovementInterval = -1;
		}

		// Use the first touch point
		const touch = e.touches[0];
		if (touch) {
			// Calculate movement from the previous touch position
			const rect = canvasRef.current?.getBoundingClientRect();
			if (rect) {
				const touchX = touch.clientX - rect.left;
				const touchY = touch.clientY - rect.top;
				
				// Store previous touch position to calculate movement
				const prevTouch = (e.target as any)._prevTouch;
				let movementX = 0;
				let movementY = 0;
				
				if (prevTouch) {
					movementX = touchX - prevTouch.x;
					movementY = touchY - prevTouch.y;
				}
				
				// Store current position for next calculation
				(e.target as any)._prevTouch = { x: touchX, y: touchY };
				
				Sim.forceVelocity(touchX + dims.left, touchY, movementX, movementY);
			}
		}
	}, [cfg.Interactable]);

	const handleTouchStart = useCallback((e: TouchEvent): void => {
		if (!cfg.Interactable) return;
		e.preventDefault();

		// Initialize touch tracking
		const touch = e.touches[0];
		if (touch) {
			const rect = canvasRef.current?.getBoundingClientRect();
			if (rect) {
				const touchX = touch.clientX - rect.left;
				const touchY = touch.clientY - rect.top;
				(e.target as any)._prevTouch = { x: touchX, y: touchY };
			}
		}
	}, [cfg.Interactable]);

	const handleTouchEnd = useCallback((e: TouchEvent): void => {
		if (!cfg.Interactable) return;
		e.preventDefault();

		// Clear touch tracking
		(e.target as any)._prevTouch = null;
	}, [cfg.Interactable]);

	const handleVisibilityChange = useCallback((): void => {
		// Don't override user's manual pause state when document becomes visible/hidden
		// The pause functionality should only be controlled by the UI button
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
			Sim.resize(dims.left, dims.right, dims.bottom, dims.top);
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
		
		Sim.setNumParticles(n);
		for (let i = start; i < n; i++) {
			const mesh = new THREE.Mesh(circle, (material as THREE.MeshBasicMaterial).clone());
			meshes[i] = mesh;
			scene.add(mesh);
		}
	}, []);

	const doLoop = useCallback((): void => {
		// if (!isMountedRef.current) return;
		
		const scene = sceneRef.current;
		const camera = cameraRef.current;
		const renderer = rendererRef.current;
		const meshes = meshesRef.current;
		
		if (!scene || !camera || !renderer || !canvasRef.current) return;
		
		if (!cfg.Paused) {
			Sim.doPhysics();

			// Get current particle count (may be different from initial count due to sources)
			const currentParticleCount = Sim.getParticleCount();
			
			// Dynamically adjust mesh count if needed
			if (currentParticleCount > meshes.length) {
				// Need to create more meshes for spawned particles
				for (let i = meshes.length; i < currentParticleCount; i++) {
					if (circleRef.current && materialRef.current && scene) {
						const mesh = new THREE.Mesh(circleRef.current, (materialRef.current as THREE.MeshBasicMaterial).clone());
						meshes[i] = mesh;
						scene.add(mesh);
					}
				}
			} else if (currentParticleCount < meshes.length) {
				// Remove excess meshes if particle count decreased
				for (let i = currentParticleCount; i < meshes.length; i++) {
					if (scene && meshes[i]) {
						scene.remove(meshes[i]);
					}
				}
				meshes.length = currentParticleCount;
			}

			// Update all existing particles
			for (let i = 0; i < currentParticleCount; i++) {
				if (meshes[i]) {
					Sim.getParticlePosition(i, meshes[i].position);
					const pressure = Sim.getParticlePressure(i);
					(meshes[i].material as THREE.MeshBasicMaterial)
						.color.setHSL((355 - pressure) / (255), 0.5, 0.5);

					// Change mesh based on movement
					const velocity = Sim.getParticleVelocity(i);
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
			}

			// Update sources and sinks meshes (they may change position or be added/removed)
			updateSourcesAndSinksMeshes();
		}
		
		// Always render the scene, even when paused
		renderer.render(scene, camera);
		
		if (isMountedRef.current) {
			animationIdRef.current = requestAnimationFrame(doLoop);
		}
	}, [cfg.Paused, updateSourcesAndSinksMeshes]);

	// Add debugging effect to track pause state changes
	useEffect(() => {
		console.log('SimulationViewport: Pause state changed to:', cfg.Paused);
		
		// Restart the animation loop when pause state changes to ensure we use the updated callback
		if (animationIdRef.current) {
			cancelAnimationFrame(animationIdRef.current);
			animationIdRef.current = null;
		}
		
		if (isMountedRef.current) {
			animationIdRef.current = requestAnimationFrame(doLoop);
		}
	}, [cfg.Paused, doLoop]);

	const createScene = useCallback((): void => {
		const dims = dimensionsRef.current;
		dims.initialOrientation = (screen.orientation ?? defaultOrientation()).angle;
		computeWindowArea();
		
		const width = dims.right - dims.left;
		const height = dims.top - dims.bottom;
		
		Sim.init(width, height, dims.left, dims.right, dims.bottom, dims.top);

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0xFFFFFF);
		sceneRef.current = scene;
		
		const camera = new THREE.OrthographicCamera(dims.left, dims.right, dims.top, dims.bottom);
		camera.position.z = 0.5;
		cameraRef.current = camera;
		
		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(width * dims.zoomX, height * dims.zoomY);
		
		// Ensure the canvas element itself has a white background
		renderer.domElement.style.backgroundColor = 'white';
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
		Sim.setFluidProperties(fluidParams);
		updateStaticObjectMeshes();
		updateSourcesAndSinksMeshes();
		doLoop();
	}, [createScene, attachToDocument, setNumParticles, doLoop, fluidParams, updateStaticObjectMeshes, updateSourcesAndSinksMeshes]);

	const reinit = useCallback((): void => {
		const dims = dimensionsRef.current;
		dims.initialOrientation = (screen.orientation ?? defaultOrientation()).angle;
		computeWindowArea();
		
		const width = dims.right - dims.left;
		const height = dims.top - dims.bottom;
		
		Sim.init(width, height, dims.left, dims.right, dims.bottom, dims.top);
		Sim.setFluidProperties(fluidParams);
		setNumParticles(fluidParams.NumParticles);
		updateStaticObjectMeshes();
		updateSourcesAndSinksMeshes();
		doLoop();
	}, [computeWindowArea, defaultOrientation, setNumParticles, doLoop, fluidParams, updateStaticObjectMeshes, updateSourcesAndSinksMeshes]);

	// Expose methods to parent component
	useImperativeHandle(ref, () => ({
		clearParticles: () => {
			Sim.clearParticlesOnly();
			// Also reset particle count to current fluid params
			Sim.setNumParticles(fluidParams.NumParticles);
		}
	}), [fluidParams.NumParticles]);

	useEffect(() => {
		isMountedRef.current = true;
		
		// Clean up any previous instance
		if (animationIdRef.current) {
			cancelAnimationFrame(animationIdRef.current);
			animationIdRef.current = null;
		}
		
		// Clean up the physics engine state
		Sim.cleanup();
		
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
				// Note: mouse and touch listener cleanup is handled in separate useEffect
				renderer.dispose();
			}
			
			// Clean up physics engine
			Sim.cleanup();
		};
	}, []);

	// Effect to update fluid parameters when they change
	useEffect(() => { Sim.setFluidProperties(fluidParams) },
		[fluidParams]
	);

	// // Separate effect to handle particle count changes
	// useEffect(() => { setNumParticles(fluidParams.NumParticles) },
	// 	[fluidParams.NumParticles, setNumParticles]
	// );

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

	const handleMouseClick = useCallback((e: MouseEvent): void => {
		// Handle circle creation (immediate)
		if (cfg.AddingObjects && cfg.ObjectType === 'circle') {
			const dims = dimensionsRef.current;
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			// Convert screen coordinates to simulation coordinates
			const x = (e.clientX - rect.left) / 30; // Divide by scale (30)
			const y = (dims.top - (e.clientY - rect.top)) / 30; // Flip Y and scale

			const radius = 1.5; // Reasonable radius in simulation units
			const circle = new StaticCircle(new vec2(x, y), radius, cfg.ObjectColor);
			Sim.addStaticObject(circle);
			updateStaticObjectMeshes();
		}
	}, [cfg.AddingObjects, cfg.ObjectType, updateStaticObjectMeshes]);

	const handleMouseDown = useCallback((e: MouseEvent): void => {
		// Start rectangle creation
		if (cfg.AddingObjects && cfg.ObjectType === 'rectangle') {
			const rect = canvasRef.current?.getBoundingClientRect();
			const dims = dimensionsRef.current;
			
			if (!rect) return;

			const x = (e.clientX - rect.left) / 30;
			const y = (dims.top - (e.clientY - rect.top)) / 30;
			
			isCreatingRectRef.current = true;
			tempRectRef.current.startX = x;
			tempRectRef.current.startY = y;
			tempRectRef.current.mesh = null;
		}
	}, [cfg.AddingObjects, cfg.ObjectType]);

	const handleMouseUp = useCallback((e: MouseEvent): void => {
		// Finish rectangle creation
		if (isCreatingRectRef.current && cfg.AddingObjects && cfg.ObjectType === 'rectangle') {
			const rect = canvasRef.current?.getBoundingClientRect();
			const dims = dimensionsRef.current;
			const scene = sceneRef.current;
			
			if (!rect || !scene) return;

			const currentX = (e.clientX - rect.left) / 30;
			const currentY = (dims.top - (e.clientY - rect.top)) / 30;
			
			const temp = tempRectRef.current;
			const width = Math.abs(currentX - temp.startX);
			const height = Math.abs(currentY - temp.startY);
			const x = Math.min(currentX, temp.startX);
			const y = Math.min(currentY, temp.startY);

			// Remove temp mesh
			if (temp.mesh) {
				scene.remove(temp.mesh);
				temp.mesh = null;
			}

			// Only create if rectangle has meaningful size
			if (width > 0.1 && height > 0.1) {
				const rectObject = new StaticPlane(new vec2(x, y), new vec2(width, height), cfg.ObjectColor);
				Sim.addStaticObject(rectObject);
				updateStaticObjectMeshes();
			}

			isCreatingRectRef.current = false;
		}
	}, [cfg.AddingObjects, cfg.ObjectType, updateStaticObjectMeshes]);

	// Separate effect to manage mouse and touch event listeners based on interaction state
	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer) return;

		// Remove existing listeners
		renderer.domElement.removeEventListener('mousemove', handleMouseMove);
		renderer.domElement.removeEventListener('mousedown', handleMouseDown);
		renderer.domElement.removeEventListener('mouseup', handleMouseUp);
		renderer.domElement.removeEventListener('click', handleMouseClick);
		renderer.domElement.removeEventListener('touchstart', handleTouchStart);
		renderer.domElement.removeEventListener('touchmove', handleTouchMove);
		renderer.domElement.removeEventListener('touchend', handleTouchEnd);
		
		// Add listeners only if interaction is enabled
		if (cfg.Interactable) {
			renderer.domElement.addEventListener('mousemove', handleMouseMove, false);
			renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
			renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
			renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
		}

		// Always add listeners for object creation
		renderer.domElement.addEventListener('click', handleMouseClick, false);
		renderer.domElement.addEventListener('mousedown', handleMouseDown, false);
		renderer.domElement.addEventListener('mouseup', handleMouseUp, false);

		// Cleanup function
		return () => {
			renderer.domElement.removeEventListener('mousemove', handleMouseMove);
			renderer.domElement.removeEventListener('mousedown', handleMouseDown);
			renderer.domElement.removeEventListener('mouseup', handleMouseUp);
			renderer.domElement.removeEventListener('click', handleMouseClick);
			renderer.domElement.removeEventListener('touchstart', handleTouchStart);
			renderer.domElement.removeEventListener('touchmove', handleTouchMove);
			renderer.domElement.removeEventListener('touchend', handleTouchEnd);
		};
	}, [cfg.Interactable, handleMouseMove, handleMouseDown, handleMouseUp, handleMouseClick, handleTouchStart, handleTouchMove, handleTouchEnd]);

	return (
		<div 
			ref={canvasRef}
			style={{ 
				width: '100%', 
				height: '100%',
				overflow: 'hidden',
				cursor: cfg.AddingObjects ? 'crosshair' : 'default'
			}}
		/>
	);
});
