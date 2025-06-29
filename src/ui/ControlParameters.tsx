import { Checkbox, Switch } from 'antd';
import { Pointer } from 'lucide-react';


export default function ControlParameters({ simParams, setSimParams }) {
	return (
		<div>
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
	);
}
