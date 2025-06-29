import { useState } from 'react';
import SimulationViewport from './SimulationViewport';
import { theme, ConfigProvider, Collapse } from 'antd';
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

	return (
		<div className='App' style={appCSS}>
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

