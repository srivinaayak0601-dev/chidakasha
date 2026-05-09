import React, { useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Box, Sphere, Cylinder } from "@react-three/drei";
import { Trash2, Box as BoxIcon, Circle, Cylinder as CylinderIcon } from "lucide-react";

type ShapeType = "box" | "sphere" | "cylinder";

interface ShapeData {
  id: string;
  type: ShapeType;
  position: [number, number, number];
  color: string;
}

const colors = ["#8b3dff", "#00c4cc", "#ff0099", "#f59e0b", "#10b981", "#3b82f6"];

export default function CadEditor() {
  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addShape = (type: ShapeType) => {
    const newShape: ShapeData = {
      id: Math.random().toString(36).substring(7),
      type,
      position: [Math.random() * 4 - 2, 0.5, Math.random() * 4 - 2],
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    setShapes([...shapes, newShape]);
  };

  const removeSelectedShape = () => {
    if (selectedId) {
      setShapes(shapes.filter((s) => s.id !== selectedId));
      setSelectedId(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121214] rounded-2xl overflow-hidden border border-[#ffffff15] shadow-2xl">
      {/* CAD Toolbar */}
      <div className="h-14 bg-[#18191b] border-b border-[#ffffff15] flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium mr-4">3D CAD Editor</span>
          <div className="h-6 w-px bg-[#ffffff15] mr-2"></div>

          <button
            onClick={() => addShape("box")}
            className="p-2 hover:bg-[#ffffff10] rounded-lg transition-colors text-gray-300 hover:text-white flex items-center gap-2"
            title="Add Box"
          >
            <BoxIcon className="w-4 h-4" />
            <span className="text-xs">Box</span>
          </button>
          <button
            onClick={() => addShape("sphere")}
            className="p-2 hover:bg-[#ffffff10] rounded-lg transition-colors text-gray-300 hover:text-white flex items-center gap-2"
            title="Add Sphere"
          >
            <Circle className="w-4 h-4" />
            <span className="text-xs">Sphere</span>
          </button>
          <button
            onClick={() => addShape("cylinder")}
            className="p-2 hover:bg-[#ffffff10] rounded-lg transition-colors text-gray-300 hover:text-white flex items-center gap-2"
            title="Add Cylinder"
          >
            <CylinderIcon className="w-4 h-4" />
            <span className="text-xs">Cylinder</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedId && (
            <button
              onClick={removeSelectedShape}
              className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors flex items-center gap-2"
              title="Delete Selected"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs">Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* 3D Canvas Area */}
      <div className="flex-1 relative cursor-crosshair">
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          {shapes.map((shape) => (
            <group key={shape.id} position={shape.position} onClick={(e) => {
              e.stopPropagation();
              setSelectedId(shape.id);
            }}>
              {shape.type === "box" && (
                <Box args={[1, 1, 1]}>
                  <meshStandardMaterial
                    color={shape.color}
                    emissive={selectedId === shape.id ? shape.color : "black"}
                    emissiveIntensity={selectedId === shape.id ? 0.5 : 0}
                  />
                </Box>
              )}
              {shape.type === "sphere" && (
                <Sphere args={[0.6, 32, 32]}>
                  <meshStandardMaterial
                    color={shape.color}
                    emissive={selectedId === shape.id ? shape.color : "black"}
                    emissiveIntensity={selectedId === shape.id ? 0.5 : 0}
                  />
                </Sphere>
              )}
              {shape.type === "cylinder" && (
                <Cylinder args={[0.5, 0.5, 1, 32]}>
                  <meshStandardMaterial
                    color={shape.color}
                    emissive={selectedId === shape.id ? shape.color : "black"}
                    emissiveIntensity={selectedId === shape.id ? 0.5 : 0}
                  />
                </Cylinder>
              )}

              {/* Highlight selection */}
              {selectedId === shape.id && (
                <Box args={[1.05, 1.05, 1.05]}>
                  <meshBasicMaterial color="#ffffff" wireframe />
                </Box>
              )}
            </group>
          ))}

          <Grid
            args={[10.5, 10.5]}
            cellSize={1}
            cellThickness={1}
            cellColor="#444"
            sectionSize={3}
            sectionThickness={1.5}
            sectionColor="#666"
            fadeDistance={30}
            fadeStrength={1}
          />
          <OrbitControls makeDefault />
        </Canvas>

        {/* Helper overlay */}
        <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-3 py-2 rounded-lg pointer-events-none backdrop-blur-sm border border-white/10">
          Left-click & drag to rotate | Right-click & drag to pan | Scroll to zoom
        </div>
      </div>
    </div>
  );
}
