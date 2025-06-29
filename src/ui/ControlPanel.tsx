import { Card, Checkbox, Collapse } from 'antd';
import { Pointer } from 'lucide-react';

import ControlParameters from './ControlParameters';

import './ControlPanel.css';

export default function ControlPanel({
	fluidParams, setFluidParams, 
	viewportConfig, setViewportConfig
}) {
	return (
		<Card className='ControlPanel' style={{
			position: 'absolute', top: '10px', left: '10px',
			backdropFilter: 'blur(2px)',
			width: '400px', 
		}}>
			<Checkbox checked={viewportConfig.Interactable}
				onChange={(checked) => setViewportConfig({ ...viewportConfig, Interactable: checked.target.checked })}
			> <Pointer/> </Checkbox>
			<Collapse
				defaultActiveKey={['1']}
				expandIconPosition='right'
				style={{ backgroundColor: 'transparent' }}
			>
				<Collapse.Panel header="Fluid Parameters" key="1">
					<ControlParameters simParams={fluidParams} setSimParams={setFluidParams} />
				</Collapse.Panel>
			</Collapse>
		</Card>
	);
}
