import React, { useState, KeyboardEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, PerspectiveCamera, OrbitControls, Grid, Line as DreiLine, } from "@react-three/drei";
import { Layers, MousePointer2, Square, Circle, Minus, Terminal, CheckSquare, Box as BoxIcon } from "lucide-react";
import * as THREE from 'three';

type Layer = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
};

type Shape = {
  id: string;
  layerId: string;
  type: 'line' | 'rect' | 'circle' | 'mesh';
  points?: [number, number, number][]; // 3D coordinates
  color: string;
  extrudedHeight?: number; // For mesh from rect
};

export default function CadEditor() {
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'layer-0', name: '0', color: '#ffffff', visible: true },
    { id: 'layer-1', name: 'Walls', color: '#00ff00', visible: true },
    { id: 'layer-2', name: 'Doors', color: '#ff0000', visible: true },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-0');
  const [shapes, setShapes] = useState<Shape[]>([]);

  const [activeTool, setActiveTool] = useState<'select' | 'line' | 'rect' | 'circle' | 'extrude'>('select');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  // Command line
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(['Chidakasha CAD Engine v2.0', 'Dual Engine: 2D Drafting & 3D B-Rep']);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<[number, number, number][]>([]);
  const [cursorPos, setCursorPos] = useState<[number, number, number]>([0, 0, 0]);

  const handleCommandSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = commandInput.trim().toLowerCase();
      let response = `Command: ${cmd}`;

      if (cmd === 'line' || cmd === 'l') { setActiveTool('line'); response += ' (Line tool activated)'; }
      else if (cmd === 'rect' || cmd === 'rec') { setActiveTool('rect'); response += ' (Rectangle tool activated)'; }
      else if (cmd === 'circle' || cmd === 'c') { setActiveTool('circle'); response += ' (Circle tool activated)'; }
      else if (cmd === 'select' || cmd === 'sel') { setActiveTool('select'); response += ' (Select tool activated)'; }
      else if (cmd === 'extrude' || cmd === 'ext') {
        setActiveTool('extrude');
        response += ' (Extrude tool activated. Click a rectangle to extrude)';
      }
      else { response = `Unknown command: ${cmd}`; }

      setCommandHistory(prev => [...prev, response]);
      setCommandInput('');
    }
  };

  const handlePointerDown = (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
    // Only handle drawing on Top view for now (where z=0 plane is active)
    if (activeTool === 'select' || activeTool === 'extrude') return;

    const pt = e.point;
    const pos: [number, number, number] = [pt.x, pt.y, 0];

    if (!isDrawing) {
      setIsDrawing(true);
      setCurrentPoints([pos]);
    } else {
      if (activeTool === 'line') {
        const newShape: Shape = {
          id: Date.now().toString(),
          layerId: activeLayerId,
          type: 'line',
          points: [currentPoints[0], pos],
          color: layers.find(l => l.id === activeLayerId)?.color || '#fff'
        };
        setShapes([...shapes, newShape]);
        setIsDrawing(false);
        setCurrentPoints([]);
        setCommandHistory(prev => [...prev, 'Line created.']);
      } else if (activeTool === 'rect') {
        const start = currentPoints[0];
        const newShape: Shape = {
          id: Date.now().toString(),
          layerId: activeLayerId,
          type: 'rect',
          points: [
            start,
            [pos[0], start[1], 0],
            pos,
            [start[0], pos[1], 0],
            start // close the loop
          ],
          color: layers.find(l => l.id === activeLayerId)?.color || '#fff'
        };
        setShapes([...shapes, newShape]);
        setIsDrawing(false);
        setCurrentPoints([]);
        setCommandHistory(prev => [...prev, 'Rectangle created.']);
      }
    }
  };

  const handlePointerMove = (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
    if (activeTool === 'select' || activeTool === 'extrude') return;
    const pt = e.point;
    setCursorPos([pt.x, pt.y, 0]);
  };

  const handleShapeClick = (e: import("@react-three/fiber").ThreeEvent<MouseEvent>, shapeId: string) => {
    e.stopPropagation();
    if (activeTool === 'select') {
      setSelectedShapeId(shapeId);
    } else if (activeTool === 'extrude') {
      // Extrude operation
      const shape = shapes.find(s => s.id === shapeId);
      if (shape && shape.type === 'rect') {
        setShapes(shapes.map(s => s.id === shapeId ? { ...s, type: 'mesh', extrudedHeight: 10 } : s));
        setCommandHistory(prev => [...prev, `Extruded object ${shapeId} by 10 units.`]);
        setActiveTool('select');
        setSelectedShapeId(shapeId);
      } else {
        setCommandHistory(prev => [...prev, `Cannot extrude this object type.`]);
      }
    }
  };

  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  // Common scene content shared across views
  const SceneContent = ({ isTopView = false }) => (
    <>
      <ambientLight intensity={1} />
      <pointLight position={[100, 100, 100]} intensity={0.8} />
      <pointLight position={[-100, -100, -100]} intensity={0.3} />

      {isTopView && (
        <mesh position={[0,0,0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}>
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}

      {shapes.map(shape => {
        const layer = layers.find(l => l.id === shape.layerId);
        if (!layer || !layer.visible) return null;
        const isSel = selectedShapeId === shape.id;
        const color = isSel ? '#ff00ff' : shape.color;

        if (shape.type === 'line' || shape.type === 'rect') {
          return (
            <DreiLine
              key={shape.id}
              points={shape.points as [number, number, number][]}
              color={color}
              lineWidth={isSel ? 3 : 1.5}
              onClick={(e) => handleShapeClick(e, shape.id)}
            />
          )
        } else if (shape.type === 'mesh' && shape.points) {
          // Calculate center and size from rect points
          const pts = shape.points;
          const minX = Math.min(pts[0][0], pts[2][0]);
          const maxX = Math.max(pts[0][0], pts[2][0]);
          const minY = Math.min(pts[0][1], pts[2][1]);
          const maxY = Math.max(pts[0][1], pts[2][1]);
          const w = maxX - minX;
          const h = maxY - minY;
          const depth = shape.extrudedHeight || 10;
          const cx = minX + w/2;
          const cy = minY + h/2;
          const cz = depth / 2;

          return (
            <group key={shape.id} position={[cx, cy, cz]} onClick={(e) => handleShapeClick(e, shape.id)}>
              <mesh>
                <boxGeometry args={[w, h, depth]} />
                <meshStandardMaterial color={shape.color} transparent opacity={isSel ? 0.8 : 1} metalness={0.2} roughness={0.5} />
              </mesh>
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(w, h, depth)]} />
                <lineBasicMaterial color={isSel ? '#ff00ff' : '#000'} linewidth={2} />
              </lineSegments>
            </group>
          )
        }
        return null;
      })}

      {isTopView && isDrawing && currentPoints.length > 0 && activeTool === 'line' && (
        <DreiLine points={[currentPoints[0], cursorPos]} color="#00ffff" lineWidth={1} dashed />
      )}

      {isTopView && isDrawing && currentPoints.length > 0 && activeTool === 'rect' && (
        <DreiLine
          points={[
            currentPoints[0],
            [cursorPos[0], currentPoints[0][1], 0],
            cursorPos,
            [currentPoints[0][0], cursorPos[1], 0],
            currentPoints[0]
          ]}
          color="#00ffff"
          lineWidth={1}
          dashed
        />
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full bg-[#111] text-[#eee] font-mono text-sm overflow-hidden select-none">

      {/* Top Ribbon */}
      <div className="h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4 gap-6 shrink-0">
        <div className="text-[#00ffff] font-bold text-lg mr-4 tracking-widest flex items-center gap-2">
          <BoxIcon size={20}/> RHINOCAD_3D
        </div>

        {/* Draw Tools */}
        <div className="flex gap-1 items-center bg-[#222] p-1 rounded border border-[#333]">
          <ToolButton icon={<MousePointer2 size={16}/>} label="Select" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
          <div className="w-px h-6 bg-[#333] mx-1"></div>
          <ToolButton icon={<Minus size={16}/>} label="Line (L)" active={activeTool === 'line'} onClick={() => setActiveTool('line')} />
          <ToolButton icon={<Square size={16}/>} label="Rect (REC)" active={activeTool === 'rect'} onClick={() => setActiveTool('rect')} />
          <ToolButton icon={<Circle size={16}/>} label="Circle (C)" active={activeTool === 'circle'} onClick={() => setActiveTool('circle')} />
          <div className="w-px h-6 bg-[#333] mx-1"></div>
          <ToolButton icon={<BoxIcon size={16}/>} label="Extrude (EXT)" active={activeTool === 'extrude'} onClick={() => setActiveTool('extrude')} />
        </div>
      </div>

      {/* Main Workspace - 4 Views */}
      <div className="flex flex-1 overflow-hidden">

        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-1 bg-[#222] p-1">

          {/* Top View */}
          <div className="relative bg-[#0a0a0a] border border-[#333] flex flex-col">
            <div className="absolute top-2 left-2 text-[#888] text-xs z-10 font-bold bg-[#111] px-2 py-0.5 rounded opacity-80">Top</div>
            <Canvas className="flex-1">
              <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={15} />
              <Grid position={[0, 0, -1]} infiniteGrid cellSize={1} cellThickness={0.5} cellColor="#222" sectionSize={10} sectionThickness={1} sectionColor="#444" fadeDistance={200} />
              {SceneContent({ isTopView: true })}
            </Canvas>
          </div>

          {/* Perspective View */}
          <div className="relative bg-[#0a0a0a] border border-[#333] flex flex-col">
            <div className="absolute top-2 left-2 text-[#888] text-xs z-10 font-bold bg-[#111] px-2 py-0.5 rounded opacity-80">Perspective</div>
            <Canvas className="flex-1">
              <PerspectiveCamera makeDefault position={[50, -50, 50]} fov={50} up={[0, 0, 1]} />
              <OrbitControls makeDefault />
              <Grid position={[0, 0, -1]} infiniteGrid cellSize={1} cellThickness={0.5} cellColor="#222" sectionSize={10} sectionThickness={1} sectionColor="#444" fadeDistance={200} />
              {SceneContent({ isTopView: false })}
            </Canvas>
          </div>

          {/* Front View */}
          <div className="relative bg-[#0a0a0a] border border-[#333] flex flex-col">
            <div className="absolute top-2 left-2 text-[#888] text-xs z-10 font-bold bg-[#111] px-2 py-0.5 rounded opacity-80">Front</div>
            <Canvas className="flex-1">
              <OrthographicCamera makeDefault position={[0, -100, 0]} zoom={15} up={[0, 0, 1]} />
              <Grid position={[0, 0, -1]} rotation={[Math.PI/2, 0, 0]} infiniteGrid cellSize={1} cellThickness={0.5} cellColor="#222" sectionSize={10} sectionThickness={1} sectionColor="#444" fadeDistance={200} />
              {SceneContent({ isTopView: false })}
            </Canvas>
          </div>

          {/* Right View */}
          <div className="relative bg-[#0a0a0a] border border-[#333] flex flex-col">
            <div className="absolute top-2 left-2 text-[#888] text-xs z-10 font-bold bg-[#111] px-2 py-0.5 rounded opacity-80">Right</div>
            <Canvas className="flex-1">
              <OrthographicCamera makeDefault position={[100, 0, 0]} zoom={15} up={[0, 0, 1]} />
              <Grid position={[0, 0, -1]} rotation={[0, -Math.PI/2, 0]} infiniteGrid cellSize={1} cellThickness={0.5} cellColor="#222" sectionSize={10} sectionThickness={1} sectionColor="#444" fadeDistance={200} />
              {SceneContent({ isTopView: false })}
            </Canvas>
          </div>

        </div>

        {/* Right Panel: Layers & Properties */}
        <div className="w-64 bg-[#1a1a1a] border-l border-[#333] flex flex-col shrink-0">
          <div className="p-2 bg-[#222] border-b border-[#333] font-bold text-xs uppercase tracking-widest text-[#aaa] flex items-center gap-2">
            <Layers size={14} /> Layers
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {layers.map(layer => (
              <div
                key={layer.id}
                onClick={() => setActiveLayerId(layer.id)}
                className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${activeLayerId === layer.id ? 'bg-[#333]' : 'hover:bg-[#2a2a2a]'}`}
              >
                <div
                  className="w-3 h-3 rounded-sm border border-[#444]"
                  style={{ backgroundColor: layer.color }}
                ></div>
                <span className="flex-1 text-xs truncate">{layer.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLayers(layers.map(l => l.id === layer.id ? {...l, visible: !l.visible} : l))
                  }}
                  className={`text-[#888] hover:text-[#fff] ${!layer.visible && 'opacity-30'}`}
                >
                  <CheckSquare size={14} />
                </button>
              </div>
            ))}
            <button className="text-xs text-[#00ffff] mt-2 w-full text-left p-1 hover:bg-[#2a2a2a] rounded">+ New Layer</button>
          </div>

          <div className="p-2 bg-[#222] border-y border-[#333] font-bold text-xs uppercase tracking-widest text-[#aaa]">Properties</div>
          <div className="h-48 p-3 text-xs text-[#888] overflow-y-auto">
            {!selectedShape ? (
               <div className="text-center mt-10">Select an object to view properties.</div>
            ) : (
               <div className="space-y-2">
                 <div><span className="text-[#555]">Type:</span> <span className="text-[#fff] uppercase">{selectedShape.type}</span></div>
                 <div><span className="text-[#555]">ID:</span> <span className="text-[#fff] truncate block">{selectedShape.id}</span></div>
                 <div><span className="text-[#555]">Layer:</span> <span className="text-[#fff]">{layers.find(l=>l.id===selectedShape.layerId)?.name}</span></div>

                 {selectedShape.type === 'mesh' && (
                    <div className="mt-2 pt-2 border-t border-[#333]">
                      <div className="flex justify-between items-center mb-1">
                         <span className="text-[#555]">Extrude Height</span>
                         <input
                           type="number"
                           value={selectedShape.extrudedHeight}
                           onChange={e => setShapes(shapes.map(s => s.id === selectedShape.id ? {...s, extrudedHeight: parseFloat(e.target.value)} : s))}
                           className="bg-[#111] border border-[#333] text-white w-16 px-1 rounded"
                         />
                      </div>
                    </div>
                 )}
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Command Line */}
      <div className="h-32 bg-[#141414] border-t border-[#333] flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto p-2 text-xs text-[#bbb] font-mono whitespace-pre-wrap flex flex-col justify-end">
          {commandHistory.slice(-10).map((cmd, i) => (
            <div key={i}>{cmd}</div>
          ))}
        </div>
        <div className="flex items-center bg-[#1a1a1a] border-t border-[#222]">
          <div className="px-2 text-[#00ffff]"><Terminal size={14} /></div>
          <input
            type="text"
            value={commandInput}
            onChange={e => setCommandInput(e.target.value)}
            onKeyDown={handleCommandSubmit}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-[#fff] text-sm p-2 outline-none font-mono"
            autoFocus
          />
        </div>
      </div>

    </div>
  );
}

function ToolButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-[#00ffff] text-[#000]' : 'text-[#aaa] hover:bg-[#333] hover:text-[#fff]'}`}
    >
      {icon}
    </button>
  );
}
