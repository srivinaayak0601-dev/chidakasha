import React, { useState, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Box, Sphere, Cylinder, RoundedBox } from "@react-three/drei";
import { Trash2, Box as BoxIcon, Circle, Cylinder as CylinderIcon, Combine, Scissors, Blend, Upload, MousePointer2, Star, PenTool, CheckCircle2, Hand } from "lucide-react";
import * as THREE from "three";
import { CSG } from "three-csg-ts";
import { v4 as uuidv4 } from "uuid";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

type ShapeType = "box" | "sphere" | "cylinder" | "extrusion" | "imported" | "csg";

interface ShapeData {
  id: string;
  type: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  dimensions: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    radiusTop?: number;
    radiusBottom?: number;
    filletRadius?: number;
    extrudeDepth?: number;
    edgeType?: 'sharp' | 'fillet' | 'chamfer';
  };
  geometry?: THREE.BufferGeometry; // For imported or CSG shapes
}

const colors = ["#8b3dff", "#00c4cc", "#ff0099", "#f59e0b", "#10b981", "#3b82f6", "#e2e8f0"];

export default function CadEditor() {
  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sketching state
  const [sketchMode, setSketchMode] = useState(false);
  const [sketchPoints, setSketchPoints] = useState<THREE.Vector3[]>([]);
  const [sculptMode, setSculptMode] = useState(false);

  // Selection toggle
  const handleSelect = (id: string, multi: boolean) => {
    if (multi) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  // Add primitive
  const finishSketch = () => {
    if (sketchPoints.length > 2) {
      // Create extrusion shape from drawn points
      const newShape: ShapeData = {
        id: uuidv4(),
        type: 'extrusion',
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: colors[Math.floor(Math.random() * colors.length)],
        dimensions: {
          extrudeDepth: 1
        },
        // Store 2D points in geometry variable temporarily for custom rendering later if needed,
        // but let's just create a raw geometry here
        geometry: createSketchGeometry(sketchPoints, 1)
      };
      setShapes([...shapes, newShape]);
      setSelectedIds([newShape.id]);
    }
    setSketchMode(false);
    setSketchPoints([]);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCanvasClick = (e: any) => {
    if (sketchMode && e.point) {
      e.stopPropagation();
      setSketchPoints(prev => [...prev, e.point]);
    }
  };

  const addShape = (type: ShapeType) => {
    const newShape: ShapeData = {
      id: uuidv4(),
      type,
      position: [0, type === 'sphere' ? 1 : 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: colors[Math.floor(Math.random() * colors.length)],
      dimensions: {
        width: 1, height: 1, depth: 1,
        radius: 0.5, radiusTop: 0.5, radiusBottom: 0.5,
        filletRadius: 0, extrudeDepth: 1,
        edgeType: 'sharp'
      },
    };
    setShapes([...shapes, newShape]);
    setSelectedIds([newShape.id]);
  };

  // Delete
  const removeSelectedShapes = () => {
    setShapes(shapes.filter((s) => !selectedIds.includes(s.id)));
    setSelectedIds([]);
  };

  const selectedShape = shapes.find(s => s.id === selectedIds[0]);

  // Update specific property
  // Boolean Operation
  const performBoolean = (operation: 'union' | 'subtract' | 'intersect') => {
    if (selectedIds.length < 2) return;

    // Simplistic implementation for the first two selected items for demonstration
    const idA = selectedIds[0];
    const idB = selectedIds[1];
    const shapeA = shapes.find(s => s.id === idA);
    const shapeB = shapes.find(s => s.id === idB);

    if (!shapeA || !shapeB) return;

    // In a real app we'd construct the actual meshes with their current properties
    // Here we create standard Box/Sphere geometries for demonstration of CSG
    const geoA: THREE.BufferGeometry = shapeA.geometry || (shapeA.type === 'sphere' ? new THREE.SphereGeometry(shapeA.dimensions.radius || 0.5) : new THREE.BoxGeometry(shapeA.dimensions.width||1, shapeA.dimensions.height||1, shapeA.dimensions.depth||1));
    const geoB: THREE.BufferGeometry = shapeB.geometry || (shapeB.type === 'sphere' ? new THREE.SphereGeometry(shapeB.dimensions.radius || 0.5) : new THREE.BoxGeometry(shapeB.dimensions.width||1, shapeB.dimensions.height||1, shapeB.dimensions.depth||1));

    const meshA = new THREE.Mesh(geoA);
    meshA.position.set(...shapeA.position);
    meshA.rotation.set(...(shapeA.rotation.map(r => r * Math.PI / 180) as [number,number,number]));
    meshA.scale.set(...shapeA.scale);
    meshA.updateMatrixWorld();

    const meshB = new THREE.Mesh(geoB);
    meshB.position.set(...shapeB.position);
    meshB.rotation.set(...(shapeB.rotation.map(r => r * Math.PI / 180) as [number,number,number]));
    meshB.scale.set(...shapeB.scale);
    meshB.updateMatrixWorld();

    let resultMesh;
    if (operation === 'union') {
      resultMesh = CSG.union(meshA, meshB);
    } else if (operation === 'subtract') {
      resultMesh = CSG.subtract(meshA, meshB);
    } else {
      resultMesh = CSG.intersect(meshA, meshB);
    }

    const resultGeo = resultMesh.geometry;

    const newShape: ShapeData = {
      id: uuidv4(),
      type: 'csg',
      position: [0, 0, 0], // The CSG matrix bakes the world transforms, so we reset local transform
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: shapeA.color,
      dimensions: {},
      geometry: resultGeo
    };

    setShapes(prev => [...prev.filter(s => s.id !== idA && s.id !== idB), newShape]);
    setSelectedIds([newShape.id]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const contents = event.target?.result as string | ArrayBuffer;
      let geometry: THREE.BufferGeometry | null = null;

      if (file.name.toLowerCase().endsWith('.stl')) {
        const loader = new STLLoader();
        geometry = loader.parse(contents);
      } else if (file.name.toLowerCase().endsWith('.obj')) {
        const loader = new OBJLoader();
        const group = loader.parse(contents as string);
        // Extract first child geometry
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && !geometry) {
            geometry = child.geometry;
          }
        });
      }

      if (geometry) {
        // Center the geometry
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox?.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        const newShape: ShapeData = {
          id: uuidv4(),
          type: 'imported',
          position: [0, 0.5, 0],
          rotation: [0, 0, 0],
          scale: [0.05, 0.05, 0.05], // Imported models often vary drastically in scale
          color: colors[Math.floor(Math.random() * colors.length)],
          dimensions: {},
          geometry: geometry
        };

        setShapes(prev => [...prev, newShape]);
        setSelectedIds([newShape.id]);
      }
    };

    if (file.name.toLowerCase().endsWith('.stl')) {
       reader.readAsArrayBuffer(file);
    } else {
       reader.readAsText(file);
    }

    // Reset input so the same file can be uploaded again if deleted
    e.target.value = '';
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateShape = (id: string, key: string, value: any, isDim = false) => {
    setShapes(prev => prev.map(s => {
      if (s.id !== id) return s;
      if (isDim) {
        return { ...s, dimensions: { ...s.dimensions, [key]: parseFloat(value) || 0 } };
      }
      // handle arrays like position/rotation
      if (key.startsWith('pos_')) {
        const idx = parseInt(key.split('_')[1]);
        const newArr = [...s.position] as [number,number,number];
        newArr[idx] = parseFloat(value) || 0;
        return { ...s, position: newArr };
      }
      if (key.startsWith('rot_')) {
        const idx = parseInt(key.split('_')[1]);
        const newArr = [...s.rotation] as [number,number,number];
        newArr[idx] = parseFloat(value) || 0;
        return { ...s, rotation: newArr };
      }
      return { ...s, [key]: value };
    }));
  };

  return (
    <div className="w-full h-full flex bg-[#09090A] rounded-2xl overflow-hidden border border-[#ffffff15] shadow-2xl">

      {/* ── LEFT TOOLBAR ── */}
      <div className="w-16 bg-[#121214] border-r border-[#ffffff15] flex flex-col items-center py-4 gap-4 z-10 shadow-lg">
        <button className="p-3 bg-[#8b3dff]/20 text-[#8b3dff] rounded-xl hover:bg-[#8b3dff]/30 transition" title="Select">
          <MousePointer2 className="w-5 h-5" />
        </button>
        <div className="w-8 h-[1px] bg-white/10" />
        <button onClick={() => addShape("box")} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition" title="Box">
          <BoxIcon className="w-5 h-5" />
        </button>
        <button onClick={() => addShape("sphere")} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition" title="Sphere">
          <Circle className="w-5 h-5" />
        </button>
        <button onClick={() => addShape("cylinder")} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition" title="Cylinder">
          <CylinderIcon className="w-5 h-5" />
        </button>
        <button onClick={() => addShape("extrusion")} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition" title="Sketch Extrusion (Star)">
          <Star className="w-5 h-5" />
        </button>
        <button
          onClick={() => setSketchMode(!sketchMode)}
          className={`p-3 rounded-xl transition ${sketchMode ? 'bg-[#8b3dff] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          title="Draw Custom Sketch"
        >
          <PenTool className="w-5 h-5" />
        </button>
        <button
          onClick={() => setSculptMode(!sculptMode)}
          className={`p-3 rounded-xl transition ${sculptMode ? 'bg-[#8b3dff] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          title="Sculpt Mode (Push/Pull)"
        >
          <Hand className="w-5 h-5" />
        </button>
        <div className="w-8 h-[1px] bg-white/10" />
        <label className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer" title="Import STL/OBJ">
          <Upload className="w-5 h-5" />
          <input type="file" className="hidden" accept=".stl,.obj" onChange={handleFileUpload} />
        </label>
      </div>

      {/* ── 3D CANVAS VIEWPORT ── */}
      <div className="flex-1 relative">
        {/* Top bar inside viewport */}
        <div className="absolute top-4 left-4 right-4 flex justify-between z-10 pointer-events-none">
           <div className="bg-[#121214]/80 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 text-white/80 font-medium text-sm pointer-events-auto">
             Parametric Geometry Engine
           </div>

           {/* CSG Controls */}
           <div className="flex gap-2 bg-[#121214]/80 backdrop-blur-md p-1 rounded-xl border border-white/10 pointer-events-auto">
              <button onClick={() => performBoolean('union')} disabled={selectedIds.length < 2} className="p-2 text-white/60 hover:text-white disabled:opacity-30 transition rounded-lg hover:bg-white/10" title="Boolean Union">
                <Combine className="w-4 h-4" />
              </button>
              <button onClick={() => performBoolean('subtract')} disabled={selectedIds.length < 2} className="p-2 text-white/60 hover:text-white disabled:opacity-30 transition rounded-lg hover:bg-white/10" title="Boolean Subtract">
                <Scissors className="w-4 h-4" />
              </button>
              <button onClick={() => performBoolean('intersect')} disabled={selectedIds.length < 2} className="p-2 text-white/60 hover:text-white disabled:opacity-30 transition rounded-lg hover:bg-white/10" title="Boolean Intersect">
                <Blend className="w-4 h-4" />
              </button>
           </div>
        </div>

        {sketchMode && (
          <div className="absolute top-16 left-4 right-4 flex justify-center z-10 pointer-events-none">
            <div className="bg-[#8b3dff]/20 backdrop-blur-md px-4 py-2 rounded-full border border-[#8b3dff]/50 text-white font-medium text-sm pointer-events-auto flex items-center gap-3 shadow-[0_0_15px_rgba(139,61,255,0.3)]">
              <span className="animate-pulse w-2 h-2 rounded-full bg-[#8b3dff]"></span>
              Click on the grid to draw a shape
              <button
                onClick={finishSketch}
                className="ml-2 flex items-center gap-1 bg-[#8b3dff] text-white px-3 py-1 rounded-full text-xs hover:bg-[#9d5cff] transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Finish Sketch
              </button>
            </div>
          </div>
        )}

        {sculptMode && (
          <div className="absolute top-16 left-4 right-4 flex justify-center z-10 pointer-events-none">
            <div className="bg-[#8b3dff]/20 backdrop-blur-md px-4 py-2 rounded-full border border-[#8b3dff]/50 text-white font-medium text-sm pointer-events-auto flex items-center gap-3 shadow-[0_0_15px_rgba(139,61,255,0.3)]">
              <span className="animate-pulse w-2 h-2 rounded-full bg-[#8b3dff]"></span>
              Click and drag on a mesh to sculpt
            </div>
          </div>
        )}

        <Canvas camera={{ position: [6, 5, 8], fov: 45 }} className={`w-full h-full ${sketchMode || sculptMode ? 'cursor-crosshair' : ''}`} onPointerDown={handleCanvasClick}>
          <ambientLight intensity={0.6} />

          {/* Invisible plane for catching raycasts when sketching */}
          {sketchMode && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerDown={handleCanvasClick}>
              <planeGeometry args={[100, 100]} />
              <meshBasicMaterial visible={false} />
            </mesh>
          )}
          <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />

          {shapes.map((shape) => (
            <RenderShape
              key={shape.id}
              shape={shape}
              isSelected={selectedIds.includes(shape.id)}
              sculptMode={sculptMode}
              onClick={(e) => {
                if (sketchMode || sculptMode) return;
                e.stopPropagation();
                handleSelect(shape.id, e.shiftKey);
              }}
            />
          ))}

          {/* Active Sketch Points */}
          {sketchMode && sketchPoints.length > 0 && (
             <group>
               {sketchPoints.map((p, i) => (
                 <Sphere key={i} args={[0.05]} position={p}>
                   <meshBasicMaterial color="#8b3dff" />
                 </Sphere>
               ))}
               {sketchPoints.length > 1 && (
                 <SketchLine points={sketchPoints} color="#8b3dff" />
               )}
               {sketchPoints.length > 2 && (
                 <SketchLine points={[sketchPoints[sketchPoints.length-1], sketchPoints[0]]} color="#8b3dff" dashed />
               )}
             </group>
          )}

          <gridHelper args={[20, 20, '#555', '#333']} />
          <OrbitControls makeDefault enabled={!sculptMode} />
        </Canvas>
      </div>

      {/* ── RIGHT PROPERTY PANEL ── */}
      <div className="w-72 bg-[#121214] border-l border-[#ffffff15] flex flex-col z-10 overflow-y-auto">
        <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#121214]/90 backdrop-blur-sm">
          <span className="font-semibold text-white/90">Properties</span>
          {selectedIds.length > 0 && (
            <button onClick={removeSelectedShapes} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-md transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 flex flex-col gap-6">
          {!selectedShape ? (
            <div className="text-center text-white/40 text-sm mt-10">
              Select an object to edit parameters.
            </div>
          ) : (
            <>
              {/* Transforms */}
              <div className="space-y-3">
                <h3 className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">Transform</h3>

                <div className="grid grid-cols-[50px_1fr_1fr_1fr] items-center gap-2 text-xs">
                  <span className="text-white/60">Pos</span>
                  <input type="number" value={selectedShape.position[0]} onChange={e=>updateShape(selectedShape.id, 'pos_0', e.target.value)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-full" />
                  <input type="number" value={selectedShape.position[1]} onChange={e=>updateShape(selectedShape.id, 'pos_1', e.target.value)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-full" />
                  <input type="number" value={selectedShape.position[2]} onChange={e=>updateShape(selectedShape.id, 'pos_2', e.target.value)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-full" />
                </div>

                <div className="grid grid-cols-[50px_1fr_1fr_1fr] items-center gap-2 text-xs">
                  <span className="text-white/60">Rot</span>
                  <input type="number" value={selectedShape.rotation[0]} onChange={e=>updateShape(selectedShape.id, 'rot_0', e.target.value)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-full" />
                  <input type="number" value={selectedShape.rotation[1]} onChange={e=>updateShape(selectedShape.id, 'rot_1', e.target.value)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-full" />
                  <input type="number" value={selectedShape.rotation[2]} onChange={e=>updateShape(selectedShape.id, 'rot_2', e.target.value)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-full" />
                </div>
              </div>

              {/* Parametric Dimensions */}
              <div className="space-y-3">
                <h3 className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">Parameters</h3>

                {selectedShape.type === 'box' && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Width</span>
                      <input type="number" step="0.1" value={selectedShape.dimensions.width} onChange={e=>updateShape(selectedShape.id, 'width', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Height</span>
                      <input type="number" step="0.1" value={selectedShape.dimensions.height} onChange={e=>updateShape(selectedShape.id, 'height', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Depth</span>
                      <input type="number" step="0.1" value={selectedShape.dimensions.depth} onChange={e=>updateShape(selectedShape.id, 'depth', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Edge Type</span>
                      <select
                        value={selectedShape.dimensions.edgeType || 'sharp'}
                        onChange={e=>updateShape(selectedShape.id, 'edgeType', e.target.value)}
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20 outline-none"
                      >
                        <option value="sharp">Sharp</option>
                        <option value="fillet">Fillet</option>
                        <option value="chamfer">Chamfer</option>
                      </select>
                    </div>
                    {selectedShape.dimensions.edgeType !== 'sharp' && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">Radius/Bevel</span>
                        <input type="number" step="0.05" min="0" value={selectedShape.dimensions.filletRadius} onChange={e=>updateShape(selectedShape.id, 'filletRadius', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                      </div>
                    )}
                  </>
                )}

                {selectedShape.type === 'sphere' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Radius</span>
                    <input type="number" step="0.1" value={selectedShape.dimensions.radius} onChange={e=>updateShape(selectedShape.id, 'radius', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                  </div>
                )}

                {selectedShape.type === 'cylinder' && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Top Radius</span>
                      <input type="number" step="0.1" value={selectedShape.dimensions.radiusTop} onChange={e=>updateShape(selectedShape.id, 'radiusTop', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Bot Radius</span>
                      <input type="number" step="0.1" value={selectedShape.dimensions.radiusBottom} onChange={e=>updateShape(selectedShape.id, 'radiusBottom', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Height</span>
                      <input type="number" step="0.1" value={selectedShape.dimensions.height} onChange={e=>updateShape(selectedShape.id, 'height', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                    </div>
                  </>
                )}

                {selectedShape.type === 'extrusion' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Extrude Depth</span>
                    <input type="number" step="0.1" value={selectedShape.dimensions.extrudeDepth} onChange={e=>updateShape(selectedShape.id, 'extrudeDepth', e.target.value, true)} className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20" />
                  </div>
                )}
              </div>

              {/* Appearance */}
              <div className="space-y-3">
                <h3 className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">Appearance</h3>
                <div className="flex gap-2 flex-wrap">
                  {colors.map(c => (
                    <button key={c} onClick={() => updateShape(selectedShape.id, 'color', c)} className={`w-6 h-6 rounded-full border-2 ${selectedShape.color === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

            </>
          )}
        </div>
      </div>

    </div>
  );
}

// Separate component to render shapes cleanly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RenderShape({ shape, isSelected, sculptMode, onClick }: { shape: ShapeData, isSelected: boolean, sculptMode?: boolean, onClick: (e: any) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const rotRad = shape.rotation.map(r => r * (Math.PI / 180)) as [number,number,number]; // convert deg to rad

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: shape.color,
      roughness: 0.3,
      metalness: 0.1,
      emissive: isSelected ? shape.color : "black",
      emissiveIntensity: isSelected ? 0.3 : 0,
      wireframe: sculptMode
    });
  }, [shape.color, isSelected, sculptMode]);

  // Sculpting Logic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePointerDown = (e: any) => {
    if (!sculptMode || !meshRef.current) return;
    e.stopPropagation();
    const mesh = meshRef.current;
    if (!mesh.geometry.attributes.position) return;

    // Simplistic Sculpting: Pull vertices near intersection
    if (!e.point) return;
    const point = mesh.worldToLocal(e.point.clone());
    const positions = mesh.geometry.attributes.position;
    const radius = 0.5;
    const force = 0.2;

    for (let i = 0; i < positions.count; i++) {
       const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
       const dist = vertex.distanceTo(point);
       if (dist < radius) {
          // Push vertex out along normal roughly
          const dir = vertex.clone().sub(point).normalize();
          vertex.add(dir.multiplyScalar(force * (radius - dist)));
          positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
       }
    }
    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  };

  return (
    <group position={shape.position} rotation={rotRad} scale={shape.scale} onClick={onClick} onPointerDown={handlePointerDown}>
      {shape.type === 'box' && (
        <BoxShape shape={shape} material={material} isSelected={isSelected} />
      )}

      {shape.type === 'sphere' && (
        <Sphere args={[shape.dimensions.radius || 0.5, 32, 32]}>
          <primitive object={material} attach="material" />
          {isSelected && <SelectionOutline color="white" />}
        </Sphere>
      )}

      {shape.type === 'cylinder' && (
        <Cylinder args={[shape.dimensions.radiusTop || 0.5, shape.dimensions.radiusBottom || 0.5, shape.dimensions.height || 1, 32]}>
          <primitive object={material} attach="material" />
          {isSelected && <SelectionOutline color="white" />}
        </Cylinder>
      )}

      {shape.type === 'extrusion' && (
        <ExtrusionShape shape={shape} material={material} isSelected={isSelected} />
      )}

      {(shape.type === 'csg' || shape.type === 'imported') && shape.geometry && (
        <mesh geometry={shape.geometry}>
           <primitive object={material} attach="material" />
           {isSelected && shape.geometry && <SelectionOutline color="white" />}
        </mesh>
      )}
    </group>
  );
}

function BoxShape({ shape, material, isSelected }: { shape: ShapeData, material: THREE.Material, isSelected: boolean }) {
  const { width: rawW = 1, height: rawH = 1, depth: rawD = 1, filletRadius: rawFillet = 0, edgeType = 'sharp' } = shape.dimensions;

  // Clamp dimensions to safe positive values to avoid RangeError
  const width = Math.max(0.01, rawW);
  const height = Math.max(0.01, rawH);
  const depth = Math.max(0.01, rawD);
  // Fillet/chamfer radius must not exceed half the smallest dimension
  const maxFillet = Math.min(width, height, depth) / 2;
  const filletRadius = Math.max(0, Math.min(rawFillet, maxFillet));

  const geometry = useMemo(() => {
    if (edgeType === 'fillet' && filletRadius > 0) {
      // Return null to render RoundedBox instead, which is handled in the return statement
      return null;
    }

    if (edgeType === 'chamfer' && filletRadius > 0) {
      const shape2d = new THREE.Shape();
      const hw = width / 2;
      const hd = depth / 2;
      shape2d.moveTo(-hw, -hd);
      shape2d.lineTo(hw, -hd);
      shape2d.lineTo(hw, hd);
      shape2d.lineTo(-hw, hd);
      shape2d.lineTo(-hw, -hd);

      const safeBevel = Math.min(filletRadius, hw * 0.9, hd * 0.9, (height / 2) * 0.9);

      const extrudeSettings = {
        depth: Math.max(0.01, height - safeBevel * 2),
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: safeBevel,
        bevelThickness: safeBevel
      };

      const geo = new THREE.ExtrudeGeometry(shape2d, extrudeSettings);
      geo.translate(0, 0, -height/2);
      geo.rotateX(Math.PI / 2);
      return geo;
    }

    return new THREE.BoxGeometry(width, height, depth);
  }, [width, height, depth, filletRadius, edgeType]);

  if (!geometry) {
    return (
        <RoundedBox args={[width, height, depth]} radius={filletRadius} smoothness={4}>
          <primitive object={material} attach="material" />
          {isSelected && <SelectionOutline color="white" />}
        </RoundedBox>
    );
  }

  return (
    <mesh geometry={geometry}>
      <primitive object={material} attach="material" />
      {isSelected && <SelectionOutline color="white" />}
    </mesh>
  );
}

function createSketchGeometry(points3d: THREE.Vector3[], depth: number) {
  // Guard against degenerate shapes
  if (points3d.length < 3) {
    return new THREE.BoxGeometry(0.5, 0.5, 0.5); // Fallback
  }
  // Convert 3D points to 2D shape (assuming drawn on XZ plane approx, mapped to XY for Shape)
  const validPoints = points3d.filter(p => p && typeof p.x === 'number' && typeof p.z === 'number');
  if (validPoints.length < 3) return new THREE.BoxGeometry(0.5, 0.5, 0.5);

  const pts = validPoints.map(p => new THREE.Vector2(p.x, -p.z));
  const shape2d = new THREE.Shape(pts);
  const safeDepth = Math.max(0.01, depth || 1);
  const extrudeSettings = { depth: safeDepth, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.05, bevelThickness: 0.05 };
  try {
    const geo = new THREE.ExtrudeGeometry(shape2d, extrudeSettings);
    geo.rotateX(Math.PI / 2);
    return geo;
  } catch {
    return new THREE.BoxGeometry(0.5, 0.5, 0.5); // Fallback on error
  }
}

function ExtrusionShape({ shape, material, isSelected }: { shape: ShapeData, material: THREE.Material, isSelected: boolean }) {
  const geometry = useMemo(() => {
    if (shape.geometry) return shape.geometry; // Use custom sketch geo if available

    // Fallback: Basic Star Sketch
    const pts = [];
    const numPts = 5;
    for (let i = 0; i < numPts * 2; i++) {
        const l = i % 2 == 1 ? 0.4 : 1;
        const a = i / numPts * Math.PI;
        pts.push(new THREE.Vector2(Math.cos(a) * l, Math.sin(a) * l));
    }
    const shape2d = new THREE.Shape(pts);
    const extrudeSettings = { depth: shape.dimensions.extrudeDepth || 1, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.05, bevelThickness: 0.05 };
    return new THREE.ExtrudeGeometry(shape2d, extrudeSettings);
  }, [shape.dimensions.extrudeDepth, shape.geometry]);

  return (
    <mesh geometry={geometry}>
      <primitive object={material} attach="material" />
      {isSelected && <SelectionOutline color="white" />}
    </mesh>
  );
}

// Native Three.js line for sketch drawing (replaces drei Line which crashes)
function SketchLine({ points, color, dashed }: { points: THREE.Vector3[], color: string, dashed?: boolean }) {
  const geometry = useMemo(() => {
    if (!Array.isArray(points)) {
      console.warn("SketchLine: points is not an array", points);
      return null;
    }
    const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number');

    if (validPoints.length < 2) {
      if (points.length > 0) console.log("SketchLine: Not enough valid points", points);
      return null;
    }

    try {
      const geo = new THREE.BufferGeometry().setFromPoints(validPoints);
      return geo;
    } catch (err) {
      console.error("SketchLine: setFromPoints failed", err, validPoints);
      return null;
    }
  }, [points]);

  const material = useMemo(() => {
    if (dashed) {
      const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.2, gapSize: 0.1 });
      return mat;
    }
    return new THREE.LineBasicMaterial({ color });
  }, [color, dashed]);

  if (!geometry) return null;

  return (
    <primitive object={new THREE.Line(geometry, material)} />
  );
}

// Simple selection outline using wireframe overlay (replaces drei Edges which uses LineGeometry)
function SelectionOutline({ color }: { color: string }) {
  return (
    <meshBasicMaterial
      color={color}
      wireframe
      transparent
      opacity={0.15}
      depthTest={false}
      attach="material-1"
    />
  );
}
