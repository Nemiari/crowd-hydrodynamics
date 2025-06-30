import React from 'react';
import { Button, Space, Radio, Switch, Divider, message } from 'antd';
import { Circle, Square, Trash2, Edit, Plus, Copy, Undo } from 'lucide-react';
import Engine from '../physics/sph';
import { StaticCircle, StaticPlane } from '../physics/StaticObject';

interface StaticObjectControlsProps {
	viewportConfig: {
		AddingObjects: boolean;
		ObjectType: 'circle' | 'rectangle';
	};
	setViewportConfig: (config: any) => void;
}

export default function StaticObjectControls({ viewportConfig, setViewportConfig }: StaticObjectControlsProps) {
	const handleAddingToggle = (checked: boolean) => {
		setViewportConfig({ 
			...viewportConfig, 
			AddingObjects: checked
		});
	};

	// const handleObjectTypeChange = (e: any) => {
	// 	setViewportConfig({ ...viewportConfig, ObjectType: e.target.value });
	// };

	const handleClearObjects = () => {
		Engine.clearStaticObjects();
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

	const handleCopyColliders = async () => {
		const colliders = Engine.getStaticColliders();
		
		if (colliders.length === 0) {
			message.warning('No colliders to copy');
			return;
		}

		// Generate code string
		let codeString = '// Static colliders preset\nconst presetColliders = [\n';
		
		colliders.forEach((collider, index) => {
			if (collider instanceof StaticCircle) {
				codeString += `  new StaticCircle(new vec2(${collider.x.toFixed(2)}, ${collider.y.toFixed(2)}), ${collider.radius.toFixed(2)})`;
			} else if (collider instanceof StaticPlane) {
				codeString += `  new StaticPlane(new vec2(${collider.x.toFixed(2)}, ${collider.y.toFixed(2)}), new vec2(${collider.width.toFixed(2)}, ${collider.height.toFixed(2)}))`;
			}
			
			if (index < colliders.length - 1) {
				codeString += ',';
			}
			codeString += '\n';
		});
		
		codeString += '];\n\n// To use this preset, call:\n// presetColliders.forEach(collider => Engine.addStaticObject(collider));';

		try {
			await navigator.clipboard.writeText(codeString);
			message.success(`Copied ${colliders.length} collider(s) to clipboard`);
		} catch (err) {
			console.error('Failed to copy to clipboard:', err);
			message.error('Failed to copy to clipboard');
		}
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

			<Button 
				onClick={handleUndoLastObject}
				type="default"
				icon={<Undo size={16} />}
				size="small"
				style={{ width: '100%' }}
			>
				Undo Last Object
			</Button>

			<Button 
				onClick={handleCopyColliders}
				type="default"
				icon={<Copy size={16} />}
				size="small"
				style={{ width: '100%' }}
			>
				Copy Colliders Code
			</Button>
			
			{/* {viewportConfig.AddingObjects && (
				<>
					<Divider style={{ margin: '8px 0' }} />
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
				</>
			)} */}
			
			{/* <Divider style={{ margin: '8px 0' }} />
			
			<Button 
				onClick={handleClearObjects}
				type="default"
				icon={<Trash2 size={16} />}
				size="small"
				style={{ width: '100%' }}
			>
				Clear All Objects
			</Button> */}
			
			{/* {viewportConfig.AddingObjects && (
				<div style={{ 
					fontSize: '12px', 
					color: '#888', 
					marginTop: '8px',
					padding: '8px',
					backgroundColor: 'rgba(255, 255, 255, 0.1)',
					borderRadius: '4px'
				}}>
					💡 Click to add circles • Drag to create rectangles
				</div>
			)} */}
		</Space>
	);
}
