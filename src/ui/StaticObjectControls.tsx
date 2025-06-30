import React from 'react';
import { Button, Space, Radio, Switch } from 'antd';
import { Circle, Square, Trash2 } from 'lucide-react';
import Engine from '../physics/sph';

interface StaticObjectControlsProps {
	viewportConfig: {
		AddingObjects: boolean;
		ObjectType: 'circle' | 'rectangle';
	};
	setViewportConfig: (config: any) => void;
}

export default function StaticObjectControls({ viewportConfig, setViewportConfig }: StaticObjectControlsProps) {
	const handleAddingToggle = (checked: boolean) => {
		setViewportConfig({ ...viewportConfig, AddingObjects: checked });
	};

	const handleObjectTypeChange = (e: any) => {
		setViewportConfig({ ...viewportConfig, ObjectType: e.target.value });
	};

	const handleClearObjects = () => {
		Engine.clearStaticObjects();
	};

	return (
		<Space direction="vertical" size="small" style={{ width: '100%' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
				<span style={{ minWidth: '80px' }}>Add Objects:</span>
				<Switch 
					checked={viewportConfig.AddingObjects}
					onChange={handleAddingToggle}
					size="small"
				/>
			</div>
			
			{viewportConfig.AddingObjects && (
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<span style={{ minWidth: '80px' }}>Type:</span>
					<Radio.Group 
						value={viewportConfig.ObjectType} 
						onChange={handleObjectTypeChange}
						size="small"
					>
						<Radio.Button value="circle">
							<Circle size={16} style={{ marginRight: '4px' }} />
							Circle
						</Radio.Button>
						<Radio.Button value="rectangle">
							<Square size={16} style={{ marginRight: '4px' }} />
							Rectangle
						</Radio.Button>
					</Radio.Group>
				</div>
			)}
			
			<Button 
				onClick={handleClearObjects}
				type="default"
				icon={<Trash2 size={16} />}
				size="small"
				style={{ width: '100%' }}
			>
				Clear All Objects
			</Button>
			
			{viewportConfig.AddingObjects && (
				<div style={{ 
					fontSize: '12px', 
					color: '#888', 
					marginTop: '8px',
					padding: '8px',
					backgroundColor: 'rgba(255, 255, 255, 0.1)',
					borderRadius: '4px'
				}}>
					💡 Click on the simulation area to add objects
				</div>
			)}
		</Space>
	);
}
