// import { Slider } from "antd";

function Parameter({ label, value, min, max, step, onChange, integer=false }) {
	return (
		<label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
			<span style={{ width: '120px', display: 'inline-block' }}>{label}:</span>
			{/* <Slider value={value} min={min} max={max} step={step} onChange={onChange} /> */}
			<input type="range" value={value} min={min} max={max} step={step}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				style={{ marginRight: '8px', flex: 1 }}
			/> {value.toFixed((integer ? 0 : 1))}
		</label>
	);
};

export default function ControlParameters({ simParams, setSimParams }) {
	return (
		<div>
			<Parameter label="Gas Constant"
				value={simParams.GasConstant} min={0} max={20} step={0.1}
				onChange={(v) => setSimParams({ ...simParams, GasConstant: v })}
			/>
			<Parameter label="Rest Density"
				value={simParams.RestDensity} min={0.1} max={10} step={0.1}
				onChange={(v) => setSimParams({ ...simParams, RestDensity: v })}
			/>
			<Parameter label="Viscosity"
				value={simParams.Viscosity} min={0.1} max={10} step={0.1}
				onChange={(v) => setSimParams({ ...simParams, Viscosity: v })}
			/>
			<Parameter label="Particle Mass"
				value={simParams.ParticleMass} min={1} max={10} step={0.5}
				onChange={(v) => setSimParams({ ...simParams, ParticleMass: v })}
			/>
			<Parameter label="Particles" integer
				value={simParams.NumParticles} min={100} max={5000} step={100}
				onChange={(v) => setSimParams({ ...simParams, NumParticles: v })}
			/>
		</div>
	);
}
