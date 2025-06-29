import { Button, Space, Collapse } from 'antd';
import { Pointer } from 'lucide-react';

import ControlParameters from './ControlParameters';

import './ControlPanel.css';

export default function ControlPanel({
	fluidParams, setFluidParams, 
	viewportConfig, setViewportConfig
}) {
	return (
		<div className='ControlPanel' style={{
			position: 'absolute', top: '10px', left: '10px',
			maxWidth: '100vh', maxHeight: '80vh',
			display: 'flex', flexDirection: 'column', gap: '10px'
		}}>
			<Space size='small'>
				<Button onClick={() => setViewportConfig({ ...viewportConfig, Interactable: !viewportConfig.Interactable })}
					type={viewportConfig.Interactable ? 'primary' : 'default'} 
					icon={<Pointer size={20}/>}
				/>

			</Space>
			<Collapse defaultActiveKey={['1']} expandIconPosition='right' >
				<Collapse.Panel header="Fluid Parameters" key="1">
					<ControlParameters simParams={fluidParams} setSimParams={setFluidParams} />
				</Collapse.Panel>
			</Collapse>
		</div>
	);
}
