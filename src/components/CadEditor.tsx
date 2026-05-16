import React, { useState, KeyboardEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, Grid, Line as DreiLine } from "@react-three/drei";
import { Layers, MousePointer2, Square, Circle, Minus, Terminal, CheckSquare } from "lucide-react";

type Layer = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
};

type Shape2D = {
  id: string;
  layerId: string;
  type: 'line' | 'rect' | 'circle';
  points: [number, number, number][]; // 3D coordinates but Z is usually 0
  color: string;
};

export default function CadEditor() {
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'layer-0', name: '0', color: '#ffffff', visible: true },
    { id: 'layer-1', name: 'Walls', color: '#00ff00', visible: true },
    { id: 'layer-2', name: 'Doors', color: '#ff0000', visible: true },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-0');
  const [shapes, setShapes] = useState<Shape2D[]>([]);

  const [activeTool, setActiveTool] = useState<'select' | 'line' | 'rect' | 'circle'>('select');

  // Command line
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(['Chidakasha CAD Engine v1.0', 'Type a command (line, rect, circle)']);

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
      else { response = `Unknown command: ${cmd}`; }

      setCommandHistory(prev => [...prev, response]);
      setCommandInput('');
    }
  };

  const handlePointerDown = (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
    if (activeTool === 'select') return;

    // Convert click to 2D plane coordinate
    const pt = e.point;
    const pos: [number, number, number] = [pt.x, pt.y, 0];

    if (!isDrawing) {
      setIsDrawing(true);
      setCurrentPoints([pos]);
    } else {
      // Finish shape
      if (activeTool === 'line') {
        const newShape: Shape2D = {
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
        const newShape: Shape2D = {
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
      // reset active tool if single-use, or let them keep drawing. For now keep drawing is fine, but we ended this shape.
    }
  };

  const handlePointerMove = (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
    if (activeTool === 'select') return;
    const pt = e.point;
    setCursorPos([pt.x, pt.y, 0]);
  };

  return (
    <div className="flex flex-col h-full bg-[#111] text-[#eee] font-mono text-sm overflow-hidden select-none">

      {/* Top Ribbon */}
      <div className="h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4 gap-6 shrink-0">
        <div className="text-[#00ffff] font-bold text-lg mr-4 tracking-widest">CAD_2D</div>

        {/* Draw Tools */}
        <div className="flex gap-1 items-center bg-[#222] p-1 rounded border border-[#333]">
          <ToolButton icon={<MousePointer2 size={16}/>} label="Select" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
          <div className="w-px h-6 bg-[#333] mx-1"></div>
          <ToolButton icon={<Minus size={16}/>} label="Line (L)" active={activeTool === 'line'} onClick={() => setActiveTool('line')} />
          <ToolButton icon={<Square size={16}/>} label="Rect (REC)" active={activeTool === 'rect'} onClick={() => setActiveTool('rect')} />
          <ToolButton icon={<Circle size={16}/>} label="Circle (C)" active={activeTool === 'circle'} onClick={() => setActiveTool('circle')} />
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas Area */}
        <div className="flex-1 relative bg-[#0a0a0a] cursor-crosshair">
          <Canvas>
            <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={20} />
            <ambientLight intensity={1} />

            <Grid
              position={[0, 0, -1]}
              infiniteGrid
              cellSize={1}
              cellThickness={0.5}
              cellColor="#222"
              sectionSize={5}
              sectionThickness={1}
              sectionColor="#333"
              fadeDistance={200}
            />

            {/* Invisible plane for raycasting */}
            <mesh position={[0,0,0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}>
              <planeGeometry args={[1000, 1000]} />
              <meshBasicMaterial visible={false} />
            </mesh>

            {/* Render Drawn Shapes */}
            {shapes.map(shape => {
              const layer = layers.find(l => l.id === shape.layerId);
              if (!layer || !layer.visible) return null;

              if (shape.type === 'line' || shape.type === 'rect') {
                return (
                  <DreiLine
                    key={shape.id}
                    points={shape.points as [number, number, number][]}
                    color={shape.color}
                    lineWidth={1.5}
                  />
                )
              }
              return null;
            })}

            {/* Render Current Drawing preview */}
            {isDrawing && currentPoints.length > 0 && activeTool === 'line' && (
              <DreiLine
                points={[currentPoints[0], cursorPos]}
                color="#00ffff"
                lineWidth={1}
                dashed
              />
            )}

            {isDrawing && currentPoints.length > 0 && activeTool === 'rect' && (
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

          </Canvas>

          {/* Coordinates Overlay */}
          <div className="absolute bottom-2 right-4 text-[#888] text-xs">
            X: {cursorPos[0].toFixed(2)}, Y: {cursorPos[1].toFixed(2)}
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
          <div className="h-48 p-3 text-xs text-[#888]">
            Select an object to view properties.
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
