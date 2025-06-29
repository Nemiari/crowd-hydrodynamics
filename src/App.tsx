import { useState } from 'react';
import SimulationViewport from './SimulationViewport';
import { theme, ConfigProvider } from 'antd';
import { Pointer } from 'lucide-react';

import ControlPanel from './ui/ControlPanel';
import { FluidParams } from './physics/sph';

const defaultFluidParams: FluidParams = {
	NumParticles: 4000,
	ParticleMass: 1.0,
	GasConstant: 5.0,
	RestDensity: 0.5,
	Viscosity: 1.0,
};

const defaultViewportConfig = {
	Interactable: true,
};

const uiTheme = {
	algorithm: theme.darkAlgorithm,
	token: {
		colorBgContainer: 'rgba(20, 20, 20, 0.8)'
	},
};	


export default function App() {
	const [fluidParams, setFluidParams] = useState(defaultFluidParams);
	const [viewportConfig, setViewportConfig] = useState(defaultViewportConfig);

	return (
		<div className='App' style={{ width: '100%', height: '100vh', position: 'relative' }}>
			<ConfigProvider theme={uiTheme} >
				<ControlPanel
					fluidParams={fluidParams} setFluidParams={setFluidParams}
					viewportConfig={viewportConfig} setViewportConfig={setViewportConfig}
				/>

				<SimulationViewport fluidParams={fluidParams} {...viewportConfig}
				/>
			</ConfigProvider>
		</div>
	);
}

