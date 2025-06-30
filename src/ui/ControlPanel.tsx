import { Button, Space, Collapse } from 'antd';
import { Pause, Play, Pointer, Trash2 } from 'lucide-react';

import ControlParameters from './ControlParameters';
import StaticObjectControls from './StaticObjectControls';

import './ControlPanel.css';

export default function ControlPanel({
	viewportConfig: cfg,
	fluidParams: fluid,
	setFluidParams, setViewportConfig, onClearParticles
}) {
	return (
		<div className='ControlPanel' style={{
			position: 'absolute', top: '10px', left: '10px',
			maxWidth: '100vh', maxHeight: '80vh',
			display: 'flex', flexDirection: 'column', gap: '10px'
		}}>
			<Space size='small'>
				<Button icon={cfg.Paused ? <Play size={20} /> : <Pause size={20} />} type='primary'
					onClick={() => { setViewportConfig({ ...cfg, Paused: !cfg.Paused }) }}
				/>

				<Button icon={<Pointer size={20}/>} type={cfg.Interactable ? 'primary' : 'default'} 
					onClick={() => setViewportConfig({ ...cfg, Interactable: !cfg.Interactable })}
				/>

				<Button 
					icon={<Trash2 size={20}/>} 
					type='default'
					danger
					onClick={onClearParticles}
					title="Clear all particles"
				/>

			</Space>
			<Collapse defaultActiveKey={['1']} >

				<Collapse.Panel header="Fluid Parameters" key="1">
					<ControlParameters simParams={fluid} setSimParams={setFluidParams} />
				</Collapse.Panel>

				<Collapse.Panel header="Static Objects" key="2">
					<StaticObjectControls viewportConfig={cfg} setViewportConfig={setViewportConfig} />
				</Collapse.Panel>
			</Collapse>
		</div>
	);
}
