import { OrbitControls, Sphere, Cylinder, RoundedBox } from "@react-three/drei";
import React, { useState, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";


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
    <div className="w-full h-full flex flex-col bg-[#222222] text-[#cccccc] font-sans text-[11px] overflow-hidden select-none">

      {/* Top Menu Bar */}
      <div className="flex items-center gap-4 px-2 py-1 bg-[#1a1a1a] border-b border-[#333333]">
        {['Alpha', 'Brush', 'Color', 'Document', 'Draw', 'Dynamics', 'Edit', 'File', 'Layer', 'Light', 'Macro', 'Marker', 'Material', 'Movie', 'Picker', 'Preferences', 'Render', 'Stencil', 'Stroke', 'Texture', 'Tool', 'Transform', 'Zplugin', 'Zscript', 'Help'].map(m => (
          <span key={m} className="hover:text-white cursor-pointer">{m}</span>
        ))}
        <div className="ml-auto flex items-center gap-2">
           <span className="text-white/50">AC</span>
           <button className="bg-[#333333] hover:bg-[#444444] px-2 py-0.5 rounded">QuickSave</button>
           <span className="text-white/50 ml-2">Menus</span>
        </div>
      </div>

      {/* Top Toolbars */}
      <div className="flex flex-col border-b border-[#111111] bg-[#2a2a2a] p-1 gap-1 shadow-sm relative z-10">

        {/* Row 1 */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 border-r border-[#444] pr-2">
             <button className="flex flex-col items-center justify-center w-10 h-10 bg-[#333] rounded hover:bg-[#444] border border-[#111]">
               <div className="w-5 h-5 bg-white rounded-full shadow-inner mb-0.5"></div>
               <span className="text-[9px]">Standard</span>
             </button>
             <button className="flex flex-col items-center justify-center w-10 h-10 bg-[#333] rounded hover:bg-[#444] border border-[#111]">
               <div className="w-5 h-5 bg-gray-400 rounded-full shadow-inner mb-0.5"></div>
               <span className="text-[9px]">ClayBuild</span>
             </button>
          </div>

          <div className="flex gap-1 border-r border-[#444] pr-2">
             <button className="px-2 py-1 bg-[#333] hover:bg-[#444] rounded text-[10px]">FillObject</button>
             <div className="flex flex-col gap-0.5 text-[9px]">
               <label className="flex items-center gap-1"><input type="checkbox" className="accent-[#a3ff00]" /> Double</label>
               <label className="flex items-center gap-1"><input type="checkbox" className="accent-[#a3ff00]" /> Auto Groups</label>
             </div>
          </div>

          <div className="flex items-center gap-2 border-r border-[#444] pr-2">
             <span className="text-[10px]">ZIntensity</span>
             <input type="range" min="1" max="100" defaultValue="13" className="w-24 accent-[#a3ff00]" />
             <span className="bg-[#111] px-1 rounded text-[#a3ff00]">13</span>
          </div>

           <div className="flex items-center gap-2 border-r border-[#444] pr-2">
             <span className="text-[10px]">Draw Size</span>
             <input type="range" min="1" max="100" defaultValue="64" className="w-24 accent-[#a3ff00]" />
             <span className="bg-[#111] px-1 rounded text-[#a3ff00]">64</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button className="bg-[#333] hover:bg-[#444] px-2 py-1 rounded text-[#a3ff00] border border-[#a3ff00] uppercase text-[9px] font-bold">Dynamic</button>
            <button className="bg-[#333] hover:bg-[#444] px-2 py-1 rounded uppercase text-[9px] font-bold">Solo</button>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex items-center gap-1 mt-1">
          <button className="px-2 py-1 bg-[#333] hover:bg-[#444] rounded">LightBox</button>
          <button className="px-2 py-1 bg-[#333] hover:bg-[#444] rounded text-orange-400 border border-orange-400">Live Boolean</button>

          <div className="w-px h-4 bg-[#444] mx-1"></div>

          <div className="flex gap-px bg-[#111] p-px rounded">
             <button className={`px-3 py-1 ${sketchMode ? 'bg-[#a3ff00] text-black font-bold' : 'bg-[#333] hover:bg-[#444]'}`} onClick={() => setSketchMode(!sketchMode)}>Draw</button>
             <button className={`px-3 py-1 ${sculptMode ? 'bg-[#a3ff00] text-black font-bold' : 'bg-[#333] hover:bg-[#444]'}`} onClick={() => setSculptMode(!sculptMode)}>Move</button>
             <button className="px-3 py-1 bg-[#333] hover:bg-[#444]">Scale</button>
             <button className="px-3 py-1 bg-[#333] hover:bg-[#444]">Rotate</button>
          </div>

          <div className="w-px h-4 bg-[#444] mx-1"></div>

          <div className="flex gap-px bg-[#111] p-px rounded">
            <button className="px-2 py-1 bg-[#a3ff00] text-black font-bold">Zadd</button>
            <button className="px-2 py-1 bg-[#333] hover:bg-[#444]">Zsub</button>
          </div>

          <div className="flex gap-px bg-[#111] p-px rounded ml-1">
            <button className="px-2 py-1 bg-[#a3ff00] text-black font-bold">Rgb</button>
            <button className="px-2 py-1 bg-[#333] hover:bg-[#444]">M</button>
            <button className="px-2 py-1 bg-[#333] hover:bg-[#444]">Mrgb</button>
          </div>

          {/* Boolean actions */}
          <div className="ml-auto flex items-center gap-1">
             <button onClick={() => performBoolean('union')} className="px-2 py-1 bg-[#333] hover:bg-[#444] rounded" title="Union" disabled={selectedIds.length < 2}>Make Union Mesh</button>
             <button onClick={() => performBoolean('subtract')} className="px-2 py-1 bg-[#333] hover:bg-[#444] rounded" title="Subtract" disabled={selectedIds.length < 2}>Sub</button>
             <button onClick={() => performBoolean('intersect')} className="px-2 py-1 bg-[#333] hover:bg-[#444] rounded" title="Intersect" disabled={selectedIds.length < 2}>Int</button>
          </div>
        </div>

      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left Toolbar (Brush/Alpha/Color) */}
        <div className="w-14 bg-[#2a2a2a] border-r border-[#111] flex flex-col items-center py-2 gap-2 shrink-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)] overflow-y-auto hidden-scrollbar">

           <div className="flex flex-col items-center group cursor-pointer">
             <div className="w-10 h-10 bg-[#444] rounded border border-[#111] flex items-center justify-center overflow-hidden mb-1">
               <div className="w-6 h-6 bg-white rounded-full"></div>
             </div>
             <span className="text-[8px] text-[#888] group-hover:text-white">Brush</span>
           </div>

           <div className="flex flex-col items-center group cursor-pointer">
             <div className="w-10 h-10 bg-[#444] rounded border border-[#111] flex items-center justify-center overflow-hidden mb-1">
               <div className="w-4 h-4 border-2 border-white rounded-full border-dashed"></div>
             </div>
             <span className="text-[8px] text-[#888] group-hover:text-white">Stroke</span>
           </div>

           <div className="w-8 h-px bg-[#444] my-1"></div>

           <div className="flex flex-col items-center group cursor-pointer">
             <div className="w-10 h-10 bg-[#444] rounded border border-[#111] flex items-center justify-center overflow-hidden mb-1 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white to-black rounded"></div>
             </div>
             <span className="text-[8px] text-[#888] group-hover:text-white">Material</span>
           </div>

           <div className="w-8 h-px bg-[#444] my-1"></div>

           {/* Color Picker */}
           <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 via-pink-500 to-yellow-400 rounded border border-[#111] cursor-crosshair"></div>
           <div className="flex gap-1 mt-1">
             <div className="w-4 h-4 bg-white rounded-sm border border-[#111]"></div>
             <div className="w-4 h-4 bg-black rounded-sm border border-[#111]"></div>
           </div>

           <span className="text-[8px] text-[#888] mt-1">Color</span>

        </div>

        {/* 3D Viewport */}
        <div className="flex-1 relative bg-gradient-to-b from-[#3a3a3a] to-[#222222]">

          {/* Inner Viewport Nav / Overlay */}
          <div className="absolute right-4 bottom-4 flex flex-col gap-1 z-10">
            <button className="w-10 h-10 bg-[#333]/80 hover:bg-[#444] rounded flex flex-col items-center justify-center border border-[#111]">
              <span className="text-[9px]">BPR</span>
            </button>
            <button className="w-10 h-10 bg-[#333]/80 hover:bg-[#444] rounded flex flex-col items-center justify-center border border-[#111]">
              <span className="text-[9px]">Scroll</span>
            </button>
            <button className="w-10 h-10 bg-[#333]/80 hover:bg-[#444] rounded flex flex-col items-center justify-center border border-[#111]">
              <span className="text-[9px]">Zoom</span>
            </button>
            <button className="w-10 h-10 bg-[#333]/80 hover:bg-[#444] rounded flex flex-col items-center justify-center border border-[#111]">
              <span className="text-[9px]">Rotate</span>
            </button>
            <div className="h-2"></div>
            <button className="w-10 h-10 bg-[#a3ff00]/20 border border-[#a3ff00] text-[#a3ff00] hover:bg-[#a3ff00]/40 rounded flex flex-col items-center justify-center">
              <span className="text-[9px] font-bold">Persp</span>
            </button>
            <button className="w-10 h-10 bg-[#333]/80 hover:bg-[#444] rounded flex flex-col items-center justify-center border border-[#111]">
              <span className="text-[9px]">Floor</span>
            </button>
            <button className="w-10 h-10 bg-[#a3ff00]/20 border border-[#a3ff00] text-[#a3ff00] hover:bg-[#a3ff00]/40 rounded flex flex-col items-center justify-center">
              <span className="text-[9px] font-bold">Local</span>
            </button>
          </div>

          <Canvas
             camera={{ position: [5, 5, 5], fov: 45 }}
             onPointerDown={handleCanvasClick}
             className="cursor-crosshair"
          >
            <color attach="background" args={["#2b2b2b"]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <directionalLight position={[-10, 5, -5]} intensity={0.3} />

            <gridHelper args={[20, 20, "#444444", "#333333"]} position={[0, -0.01, 0]} />

            {sketchMode && (
              <mesh visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <planeGeometry args={[100, 100]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            )}

            {shapes.map(shape => (
              <RenderShape
                 key={shape.id}
                 shape={shape}
                 isSelected={selectedIds.includes(shape.id)}
                 sculptMode={sculptMode}
                 onClick={(e) => {
                   if (!sketchMode && !sculptMode) {
                     e.stopPropagation();
                     handleSelect(shape.id, e.shiftKey);
                   }
                 }}
              />
            ))}

            {sketchPoints.length > 0 && (
              <SketchLine points={sketchPoints} color="#a3ff00" />
            )}

            <OrbitControls
               makeDefault
               enabled={!sketchMode && !sculptMode}
               dampingFactor={0.1}
            />
          </Canvas>

          {/* Context Menus over Canvas */}
          {sketchMode && (
             <div className="absolute top-4 left-4 bg-[#222]/90 p-2 rounded border border-[#a3ff00] flex gap-2">
                <span className="text-[#a3ff00] font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#a3ff00] animate-pulse"></span>
                  Drawing Mode
                </span>
                <button onClick={finishSketch} className="ml-4 bg-[#a3ff00] text-black px-2 py-0.5 rounded text-[10px] font-bold hover:bg-[#88cc00]">
                  Confirm Extrusion
                </button>
                <button onClick={() => { setSketchMode(false); setSketchPoints([]); }} className="bg-[#444] text-white px-2 py-0.5 rounded text-[10px] hover:bg-[#555]">
                  Cancel
                </button>
             </div>
          )}

          {sculptMode && (
             <div className="absolute top-4 left-4 bg-[#222]/90 p-2 rounded border border-orange-400 flex gap-2">
                <span className="text-orange-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                  Sculpt Mode
                </span>
             </div>
          )}

        </div>

        {/* Right Sidebar (Tool, Subtool, Geometry) */}
        <div className="w-[280px] bg-[#2a2a2a] border-l border-[#111] flex flex-col shrink-0 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.2)] overflow-y-auto hidden-scrollbar">

          {/* Tool Section */}
          <div className="p-2 border-b border-[#111]">
             <div className="flex items-center justify-between mb-2">
                <h2 className="text-[13px] font-bold text-[#eee]">Tool</h2>
                <div className="flex gap-1">
                   <button className="w-5 h-5 bg-[#333] hover:bg-[#444] rounded flex items-center justify-center border border-[#111]"><span className="block w-2 h-2 bg-white rounded-full"></span></button>
                   <button className="w-5 h-5 bg-[#333] hover:bg-[#444] rounded flex items-center justify-center border border-[#111]"><span className="block w-2 h-2 border border-white"></span></button>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-1 mb-2">
               <button className="bg-[#333] hover:bg-[#444] py-1 px-2 rounded text-left truncate">Load Tool</button>
               <button className="bg-[#333] hover:bg-[#444] py-1 px-2 rounded text-left truncate">Save As</button>
               <label className="bg-[#333] hover:bg-[#444] py-1 px-2 rounded text-left truncate relative cursor-pointer">
                 Import
                 <input type="file" accept=".stl,.obj" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
               </label>
               <button className="bg-[#333] hover:bg-[#444] py-1 px-2 rounded text-left truncate">Export</button>
               <button className="bg-[#333] hover:bg-[#444] py-1 px-2 rounded text-left truncate">Clone</button>
               <button className="bg-[#333] hover:bg-[#444] py-1 px-2 rounded text-left truncate text-[10px]">Make PolyMesh3D</button>
             </div>

             {/* Thumbnail Area */}
             <div className="flex gap-2 mb-2">
                <div className="w-16 h-16 bg-[#1a1a1a] rounded border border-[#111] flex items-center justify-center relative shadow-inner">
                  <div className="w-10 h-10 border border-white/20 rotate-45"></div>
                  <span className="absolute bottom-1 right-1 text-[8px] bg-black/50 px-1 rounded">48</span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-1 content-start">
                   {['Cylinder3D', 'PolyMesh3D', 'SimpleBrush', 'Sphere3D', 'Box3D'].map((t, i) => (
                     <div key={i} onClick={() => {
                        if (t === 'Box3D') addShape('box');
                        if (t === 'Sphere3D') addShape('sphere');
                        if (t === 'Cylinder3D') addShape('cylinder');
                     }} className="bg-[#333] border border-[#111] rounded h-8 flex items-center justify-center hover:bg-[#444] cursor-pointer" title={t}>
                       {t.includes('Box') && <div className="w-3 h-3 bg-gray-400"></div>}
                       {t.includes('Sphere') && <div className="w-3 h-3 bg-gray-400 rounded-full"></div>}
                       {t.includes('Cylinder') && <div className="w-3 h-4 bg-gray-400 rounded-sm"></div>}
                       {!['Box3D','Sphere3D','Cylinder3D'].includes(t) && <span className="text-[8px] text-gray-500">Obj</span>}
                     </div>
                   ))}
                </div>
             </div>
          </div>

          {/* Subtool Section */}
          <div className="border-b border-[#111]">
            <div className="px-2 py-1 bg-[#3a3a3a] border-y border-[#444] flex items-center justify-between cursor-pointer hover:bg-[#444]">
              <span className="font-bold text-[#eee]">Subtool</span>
              <span className="text-[10px] text-gray-400">{shapes.length}</span>
            </div>
            <div className="p-2 space-y-1 bg-[#252525]">

               <div className="flex items-center justify-between gap-1 mb-1">
                 <button className="bg-[#333] hover:bg-[#444] px-2 py-0.5 rounded flex-1 text-[9px]">New Folder</button>
                 <button className="bg-[#333] hover:bg-[#444] px-2 py-0.5 rounded flex-1 text-[9px] text-[#a3ff00]">Autosave</button>
               </div>

               <div className="max-h-32 overflow-y-auto border border-[#111] bg-[#1a1a1a] rounded hidden-scrollbar">
                  {shapes.map((s, i) => (
                    <div key={s.id} onClick={() => handleSelect(s.id, false)} className={`flex items-center gap-2 p-1 border-b border-[#111] cursor-pointer hover:bg-[#333] ${selectedIds.includes(s.id) ? 'bg-[#444]' : ''}`}>
                       <div className="w-8 h-6 bg-[#222] border border-[#111] rounded flex items-center justify-center">
                         <div className="w-4 h-4" style={{ backgroundColor: s.color }}></div>
                       </div>
                       <span className="text-[10px] truncate flex-1">{s.type.charAt(0).toUpperCase() + s.type.slice(1)} {i+1}</span>
                       <div className="flex gap-0.5">
                         <button className="w-4 h-4 bg-[#222] border border-[#111] rounded flex items-center justify-center text-[8px] text-[#a3ff00]">👁</button>
                         <button className="w-4 h-4 bg-[#222] border border-[#111] rounded flex items-center justify-center text-[8px]" onClick={(e) => { e.stopPropagation(); removeSelectedShapes(); }}>✕</button>
                       </div>
                    </div>
                  ))}
                  {shapes.length === 0 && (
                    <div className="p-4 text-center text-[#666] text-[10px]">No SubTools</div>
                  )}
               </div>

               <div className="grid grid-cols-4 gap-1 mt-2">
                 <button className="bg-[#333] hover:bg-[#444] py-1 rounded text-[9px]">Rename</button>
                 <button className="bg-[#333] hover:bg-[#444] py-1 rounded text-[9px]">Copy</button>
                 <button className="bg-[#333] hover:bg-[#444] py-1 rounded text-[9px]">Paste</button>
                 <button className="bg-[#333] hover:bg-[#444] py-1 rounded text-[9px]">Append</button>
               </div>
            </div>
          </div>

          {/* Geometry Section */}
          <div className="border-b border-[#111]">
            <div className="px-2 py-1 bg-[#3a3a3a] border-y border-[#444] flex items-center justify-between cursor-pointer hover:bg-[#444]">
              <span className="font-bold text-[#eee]">Geometry</span>
            </div>

            {selectedShape ? (
              <div className="p-2 space-y-2 bg-[#252525]">

                 <div className="grid grid-cols-2 gap-1 mb-2">
                   <button className="bg-[#333] hover:bg-[#444] py-1 rounded text-[10px] text-gray-500">Lower Res</button>
                   <button className="bg-[#333] hover:bg-[#444] py-1 rounded text-[10px] text-gray-500">Higher Res</button>
                 </div>
                 <div className="flex items-center gap-2 mb-2">
                   <span className="text-[10px] text-gray-400 w-8">SDiv</span>
                   <input type="range" min="1" max="5" defaultValue="1" className="flex-1 accent-gray-500" disabled />
                   <span className="bg-[#111] px-1 rounded text-gray-500 w-4 text-center">1</span>
                 </div>

                 <div className="w-full h-px bg-[#111] my-1"></div>

                 <button className="w-full bg-[#333] hover:bg-[#444] py-1 rounded text-[10px] mb-1">Divide</button>

                 <div className="w-full h-px bg-[#111] my-1"></div>

                 {/* Parametric Properties mapped to ZBrush style */}
                 <div className="space-y-1">
                    <span className="text-[10px] text-[#a3ff00] font-bold">Dynamic Subdiv</span>

                    {/* Transform equivalent */}
                    <div className="grid grid-cols-[30px_1fr_1fr_1fr] items-center gap-1 mt-2">
                      <span className="text-[9px] text-[#888]">Pos</span>
                      <input type="number" step="0.1" value={selectedShape.position[0]} onChange={e=>updateShape(selectedShape.id, 'pos_0', e.target.value)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-full text-[9px]" />
                      <input type="number" step="0.1" value={selectedShape.position[1]} onChange={e=>updateShape(selectedShape.id, 'pos_1', e.target.value)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-full text-[9px]" />
                      <input type="number" step="0.1" value={selectedShape.position[2]} onChange={e=>updateShape(selectedShape.id, 'pos_2', e.target.value)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-full text-[9px]" />
                    </div>
                    <div className="grid grid-cols-[30px_1fr_1fr_1fr] items-center gap-1">
                      <span className="text-[9px] text-[#888]">Rot</span>
                      <input type="number" step="5" value={selectedShape.rotation[0]} onChange={e=>updateShape(selectedShape.id, 'rot_0', e.target.value)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-full text-[9px]" />
                      <input type="number" step="5" value={selectedShape.rotation[1]} onChange={e=>updateShape(selectedShape.id, 'rot_1', e.target.value)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-full text-[9px]" />
                      <input type="number" step="5" value={selectedShape.rotation[2]} onChange={e=>updateShape(selectedShape.id, 'rot_2', e.target.value)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-full text-[9px]" />
                    </div>

                    <div className="w-full h-px bg-[#111] my-2"></div>

                    {/* Dimensions */}
                    {selectedShape.type === 'box' && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center"><span className="text-[9px]">Width</span><input type="number" step="0.1" value={selectedShape.dimensions.width} onChange={e=>updateShape(selectedShape.id, 'width', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                        <div className="flex justify-between items-center"><span className="text-[9px]">Height</span><input type="number" step="0.1" value={selectedShape.dimensions.height} onChange={e=>updateShape(selectedShape.id, 'height', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                        <div className="flex justify-between items-center"><span className="text-[9px]">Depth</span><input type="number" step="0.1" value={selectedShape.dimensions.depth} onChange={e=>updateShape(selectedShape.id, 'depth', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px]">Edge</span>
                          <select value={selectedShape.dimensions.edgeType || 'sharp'} onChange={e=>updateShape(selectedShape.id, 'edgeType', e.target.value)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-16 text-[9px] outline-none">
                             <option value="sharp">Sharp</option><option value="fillet">Fillet</option><option value="chamfer">Chamfer</option>
                          </select>
                        </div>
                        {selectedShape.dimensions.edgeType !== 'sharp' && (
                           <div className="flex justify-between items-center"><span className="text-[9px]">Bevel</span><input type="number" step="0.05" value={selectedShape.dimensions.filletRadius} onChange={e=>updateShape(selectedShape.id, 'filletRadius', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                        )}
                      </div>
                    )}

                    {selectedShape.type === 'sphere' && (
                       <div className="flex justify-between items-center"><span className="text-[9px]">Radius</span><input type="number" step="0.1" value={selectedShape.dimensions.radius} onChange={e=>updateShape(selectedShape.id, 'radius', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                    )}

                    {selectedShape.type === 'cylinder' && (
                       <div className="space-y-1">
                         <div className="flex justify-between items-center"><span className="text-[9px]">Top Rad</span><input type="number" step="0.1" value={selectedShape.dimensions.radiusTop} onChange={e=>updateShape(selectedShape.id, 'radiusTop', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                         <div className="flex justify-between items-center"><span className="text-[9px]">Bot Rad</span><input type="number" step="0.1" value={selectedShape.dimensions.radiusBottom} onChange={e=>updateShape(selectedShape.id, 'radiusBottom', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                         <div className="flex justify-between items-center"><span className="text-[9px]">Height</span><input type="number" step="0.1" value={selectedShape.dimensions.height} onChange={e=>updateShape(selectedShape.id, 'height', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                       </div>
                    )}

                    {selectedShape.type === 'extrusion' && (
                       <div className="flex justify-between items-center"><span className="text-[9px]">Thickness</span><input type="number" step="0.1" value={selectedShape.dimensions.extrudeDepth} onChange={e=>updateShape(selectedShape.id, 'extrudeDepth', e.target.value, true)} className="bg-[#111] border border-[#333] rounded px-1 py-0.5 text-[#eee] w-12 text-[9px]" /></div>
                    )}

                 </div>

                 {/* Color Swatches */}
                 <div className="pt-2 border-t border-[#111] mt-2">
                   <span className="text-[10px] text-[#888] mb-1 block">Polypaint Color</span>
                   <div className="flex gap-1 flex-wrap">
                     {colors.map(c => (
                       <button key={c} onClick={() => updateShape(selectedShape.id, 'color', c)} className={`w-4 h-4 rounded-sm border ${selectedShape.color === c ? 'border-white' : 'border-[#111]'}`} style={{ backgroundColor: c }} />
                     ))}
                   </div>
                 </div>

              </div>
            ) : (
              <div className="p-4 text-center text-[#666] text-[10px] bg-[#252525]">
                Select a SubTool to edit Geometry
              </div>
            )}
          </div>

          {/* Fake collapsible menus */}
          {['EdgeLoop', 'Crease', 'ShadowBox', 'ClayPolish', 'DynaMesh', 'ZRemesher', 'Modify Topology', 'Position', 'Size', 'MeshIntegrity'].map(menu => (
             <div key={menu} className="px-2 py-1 bg-[#3a3a3a] border-y border-[#444] flex items-center justify-between cursor-pointer hover:bg-[#444]">
               <span className="font-semibold text-[#ccc]">{menu}</span>
             </div>
          ))}

        </div>

      </div>

      {/* Bottom Brush Toolbar */}
      <div className="h-16 bg-[#2a2a2a] border-t border-[#111] flex items-center px-2 gap-1 overflow-x-auto hidden-scrollbar shrink-0 z-10">

         {/* Brush Previews */}
         <div className="flex gap-1">
           {['Standard', 'ClayBuildup', 'ZModeler', 'SnakeHook', 'DamStandard', 'Move', 'Inflate', 'Pinch', 'Flatten', 'TrimDynamic', 'hPolish'].map(brush => (
             <div key={brush} className="flex flex-col items-center group cursor-pointer w-12">
               <div className="w-10 h-10 bg-[#333] rounded border border-[#111] hover:border-[#a3ff00] flex items-center justify-center overflow-hidden mb-0.5">
                  <div className="w-6 h-6 bg-gradient-to-br from-white/80 to-transparent rounded-full shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.5)]"></div>
               </div>
               <span className="text-[7px] text-[#888] group-hover:text-white truncate w-full text-center">{brush}</span>
             </div>
           ))}
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
