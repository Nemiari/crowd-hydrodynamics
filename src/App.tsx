import { useState } from 'react';
import SimulationViewport from './SimulationViewport';

interface SimulationParams {
	Interactable: boolean;
	NumParticles: number;
	ParticleMass: number;
	GasConstant: number;
	RestDensity: number;
	Viscosity: number;
}

export default function App() {
	const [simParams, setSimParams] = useState<SimulationParams>({
		Interactable: true,
		NumParticles: 1000,
		ParticleMass: 1.0,
		GasConstant: 5.0,
		RestDensity: 0.5,
		Viscosity: 1.0,
	});

	return (
		<div className='App' style={{ width: '100%', height: '100vh', position: 'relative' }}>
			{/* Control Panel */}
			<div style={{
				position: 'absolute',
				top: '10px',
				left: '10px',
				zIndex: 1000,
				background: 'rgba(0, 0, 0, 0.8)',
				padding: '15px',
				borderRadius: '8px',
				color: 'white',
				fontFamily: 'Arial, sans-serif',
				fontSize: '12px',
				minWidth: '280px',
				maxHeight: '80vh',
				overflowY: 'auto'
			}}>
				<label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
					<input type="checkbox" checked={simParams.Interactable}
						onChange={(e) => setSimParams({ ...simParams, Interactable: e.target.checked })}
						style={{ marginRight: '8px' }}
					/> Interactable
				</label>
				<br />
				<label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
					<span style={{ width: '120px', display: 'inline-block' }}>Gas Constant:</span>
					<input type="range" value={simParams.GasConstant} min={0} max={20} step={0.1}
						onChange={(e) => setSimParams({ ...simParams, GasConstant: parseFloat(e.target.value) })}
						style={{ marginRight: '8px', flex: 1 }}
					/> {simParams.GasConstant.toFixed(1)}
				</label>
				<label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
					<span style={{ width: '120px', display: 'inline-block' }}>Rest Density:</span>
					<input type="range" value={simParams.RestDensity} min={0.1} max={2.0} step={0.1}
						onChange={(e) => setSimParams({ ...simParams, RestDensity: parseFloat(e.target.value) })}
						style={{ marginRight: '8px', flex: 1 }}
					/> {simParams.RestDensity.toFixed(1)}
				</label>
				<label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
					<span style={{ width: '120px', display: 'inline-block' }}>Viscosity:</span>
					<input type="range" value={simParams.Viscosity} min={0.1} max={10.0} step={0.1}
						onChange={(e) => setSimParams({ ...simParams, Viscosity: parseFloat(e.target.value) })}
						style={{ marginRight: '8px', flex: 1 }}
					/> {simParams.Viscosity.toFixed(1)}
				</label>
				<label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
					<span style={{ width: '120px', display: 'inline-block' }}>Particle Mass:</span>
					<input type="range" value={simParams.ParticleMass} min={1} max={10} step={0.5}
						onChange={(e) => setSimParams({ ...simParams, ParticleMass: parseFloat(e.target.value) })}
						style={{ marginRight: '8px', flex: 1 }}
					/> {simParams.ParticleMass.toFixed(1)}
				</label>
				<label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
					<span style={{ width: '120px', display: 'inline-block' }}>Particles:</span>
					<input type="range" value={simParams.NumParticles} min={100} max={5000} step={100}
						onChange={(e) => setSimParams({ ...simParams, NumParticles: parseInt(e.target.value) })}
						style={{ marginRight: '8px', flex: 1 }}
					/> {simParams.NumParticles}
				</label>
			</div>
			
			{/* Simulation Canvas */}
			<SimulationViewport 
				mouseInteractionEnabled={simParams.Interactable}
				fluidParams={simParams}
			/>
		</div>
	);
}

