import { useState, useRef, useEffect } from 'react';
import SimulationViewport, { SimulationViewportRef } from './SimulationViewport';
import { theme, ConfigProvider } from 'antd';
import { message } from 'antd';

import ControlPanel from './ui/ControlPanel';
import { FluidParams } from './physics/sph';
import Engine from './physics/sph';

const defaultFluidParams: FluidParams = {
	NumParticles: 0,
	ParticleMass: 1.0,
	GasConstant: 5.0,
	RestDensity: 0.5,
	Viscosity: 1.0,
};

const defaultViewportConfig = {
	Interactable: true,
	Paused: false,
	AddingObjects: false,
	ObjectType: 'rectangle' as const,
};

const appCSS = {
	width: '100%',
	height: '100vh',
	position: 'relative',
	"--primary-color": "rgb(45, 31, 66)",
	"--bg-container-color": "rgba(0, 0, 0, 0.8)",
} as React.CSSProperties;

const uiTheme = {
	algorithm: theme.darkAlgorithm,
	cssVar: true,
	token: {
		colorPrimary: appCSS["--primary-color"],
		colorBgContainer: appCSS["--bg-container-color"],
	},

	components: {
		Collapse: {
			"headerBg": "rgb(from var(--primary-color) r g b / 0.8)",
			"contentBg": "rgba(0, 0, 0, 0.7)",
		}
	},
};	




export default function App() {
	const [fluidParams, setFluidParams] = useState(defaultFluidParams);
	const [viewportConfig, setViewportConfig] = useState(defaultViewportConfig);
	const simulationRef = useRef<SimulationViewportRef>(null);

	const handleClearParticles = () => {
		simulationRef.current?.clearParticles();
	};

	const handleUndoLastObject = () => {
		const colliders = Engine.getStaticColliders();
		
		if (colliders.length === 0) {
			message.warning('No objects to undo');
			return;
		}

		// Get the last object and remove it
		const lastObject = colliders[colliders.length - 1];
		const success = Engine.removeStaticObject(lastObject);
		
		if (success) {
			message.success('Last object removed');
		} else {
			message.error('Failed to remove last object');
		}
	};

	// Add keyboard shortcut for undo (Ctrl+Z or Cmd+Z)
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Check for Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
			if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
				event.preventDefault();
				handleUndoLastObject();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

	return (
		<div className='App' style={appCSS}>
			<ConfigProvider theme={uiTheme} >
				<ControlPanel
					fluidParams={fluidParams} setFluidParams={setFluidParams}
					viewportConfig={viewportConfig} setViewportConfig={setViewportConfig}
					onClearParticles={handleClearParticles}
				/>

				<SimulationViewport 
					ref={simulationRef}
					fluidParams={fluidParams} 
					{...viewportConfig}
				/>
			</ConfigProvider>
		</div>
	);
}

