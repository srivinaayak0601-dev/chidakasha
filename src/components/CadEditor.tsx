import React, { useState, useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Sphere, Cylinder, RoundedBox, Edges, Html } from "@react-three/drei";
import { Trash2, Box as BoxIcon, Circle, Cylinder as CylinderIcon, Combine, Scissors, Blend, Upload, MousePointer2, Star, PenTool, CheckCircle2, Hand, Layers, Eye, EyeOff, Plus, Activity, Ruler } from "lucide-react";
import * as THREE from "three";
import { CSG } from "three-csg-ts";
import { v4 as uuidv4 } from "uuid";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

type ShapeType = "box" | "sphere" | "cylinder" | "extrusion" | "imported" | "csg" | "polyline" | "dimension" | "group" | "wall" | "gear" | "pipe";
type Workspace = "general" | "architecture" | "mechanical";

interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  color: string;
}

interface ShapeData {
  id: string;
  type: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  layerId: string;
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
    points?: [number, number, number][]; // For polyline
    startPoint?: [number, number, number]; // For dimension
    endPoint?: [number, number, number]; // For dimension
    wallThickness?: number; // For wall
    teeth?: number; // For gear
    innerRadius?: number; // For gear
    pipeRadius?: number; // For pipe
  };
  geometry?: THREE.BufferGeometry; // For imported or CSG shapes
  childrenIds?: string[]; // For group
  metadata?: string; // For group attributes
}

const colors = ["#8b3dff", "#00c4cc", "#ff0099", "#f59e0b", "#10b981", "#3b82f6", "#e2e8f0"];

function SafeLine({ points, color, lineWidth, dashed, dashSize, gapSize }: { points: THREE.Vector3[], color: string, lineWidth?: number, dashed?: boolean, dashSize?: number, gapSize?: number }) {
  const lineObj = useMemo(() => {
    const validPts = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number');
    if (validPts.length < 2) return null;
    const geo = new THREE.BufferGeometry().setFromPoints(validPts);
    let mat: THREE.Material;
    if (dashed) {
      const dMat = new THREE.LineDashedMaterial({ color, linewidth: lineWidth || 1, dashSize: dashSize || 0.2, gapSize: gapSize || 0.1 });
      mat = dMat;
    } else {
      mat = new THREE.LineBasicMaterial({ color, linewidth: lineWidth || 1 });
    }
    const line = new THREE.Line(geo, mat);
    if (dashed) line.computeLineDistances();
    return line;
  }, [points, color, lineWidth, dashed, dashSize, gapSize]);

  if (!lineObj) return null;
  return <primitive object={lineObj} />;
}

export default function CadEditor() {
  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sketching state
  const [sketchMode, setSketchMode] = useState(false);
  const [sketchPoints, setSketchPoints] = useState<THREE.Vector3[]>([]);
  const [sculptMode, setSculptMode] = useState(false);
  
  // Polyline state
  const [polylineMode, setPolylineMode] = useState(false);
  
  // Dimension state
  const [dimensionMode, setDimensionMode] = useState(false);
  const [dimensionPoint, setDimensionPoint] = useState<THREE.Vector3 | null>(null);
  
  // OSNAP state
  const [snapPoint, setSnapPoint] = useState<THREE.Vector3 | null>(null);

  // CLI state
  const [cliCommand, setCliCommand] = useState('');

  // Workspace
  const [workspace, setWorkspace] = useState<Workspace>('general');

  // Keyboard shortcut: Backspace / Delete to remove selected shapes
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // Don't fire when typing in an input, textarea, or CLI
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setShapes(prev => prev.filter(s => !selectedIds.includes(s.id)));
        setSelectedIds([]);
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setSketchMode(false);
        setPolylineMode(false);
        setDimensionMode(false);
        setSketchPoints([]);
        setDimensionPoint(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds]);

  // Layer state
  const [layers, setLayers] = useState<LayerData[]>([{ id: 'default', name: 'Layer 0', visible: true, color: '#ffffff' }]);
  const [activeLayer, setActiveLayer] = useState<string>('default');

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
        layerId: activeLayer,
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
  const handlePointerMove = (e: any) => {
    if (!sketchMode && !polylineMode && !dimensionMode) {
      if (snapPoint) setSnapPoint(null);
      return;
    }
    
    if (e.intersections && e.intersections.length > 0) {
      const hit = e.intersections.find((i: any) => i.object.geometry);
      if (hit) {
        const mesh = hit.object;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        if (bbox) {
          const corners = [
            new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
            new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
            new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
            new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
            new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
            new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
            new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
            new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
          ].map(c => c.applyMatrix4(mesh.matrixWorld));

          let closestDist = Infinity;
          let closestPoint = null;
          for (const c of corners) {
            const dist = c.distanceTo(hit.point);
            if (dist < 0.5) { // OSNAP radius
              if (dist < closestDist) {
                closestDist = dist;
                closestPoint = c;
              }
            }
          }
          if (closestPoint) {
            setSnapPoint(closestPoint);
            return;
          }
        }
      }
    }
    setSnapPoint(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCanvasClick = (e: any) => {
    const point = snapPoint || e.point;
    if (sketchMode || polylineMode) {
      e.stopPropagation();
      setSketchPoints(prev => [...prev, point]);
    } else if (dimensionMode) {
      e.stopPropagation();
      if (!dimensionPoint) {
        setDimensionPoint(point);
      } else {
        const newShape: ShapeData = {
          id: uuidv4(),
          type: 'dimension',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: '#ffffff', // dimensions default to white usually
          layerId: activeLayer,
          dimensions: {
            startPoint: [dimensionPoint.x, dimensionPoint.y, dimensionPoint.z],
            endPoint: [point.x, point.y, point.z]
          }
        };
        setShapes([...shapes, newShape]);
        setDimensionPoint(null);
        setDimensionMode(false);
      }
    }
  };

  const finishPolyline = () => {
    if (sketchPoints.length > 1) {
      const newShape: ShapeData = {
        id: uuidv4(),
        type: 'polyline',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: colors[Math.floor(Math.random() * colors.length)],
        layerId: activeLayer,
        dimensions: {
          points: sketchPoints.map(p => [p.x, p.y, p.z] as [number, number, number])
        }
      };
      setShapes([...shapes, newShape]);
      setSelectedIds([newShape.id]);
    }
    setPolylineMode(false);
    setSketchPoints([]);
  };

  const addShape = (type: ShapeType) => {
    const newShape: ShapeData = {
      id: uuidv4(),
      type,
      position: [0, type === 'sphere' ? 1 : 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: colors[Math.floor(Math.random() * colors.length)],
      layerId: activeLayer,
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

  const addSpecialShape = (type: 'wall' | 'gear' | 'pipe') => {
    const defaults: Record<string, ShapeData['dimensions']> = {
      wall:  { width: 4, height: 3, depth: 0.2, wallThickness: 0.2 },
      gear:  { radius: 1, height: 0.3, teeth: 12, innerRadius: 0.4 },
      pipe:  { points: [[0,0.5,0],[2,0.5,0],[2,0.5,2]], pipeRadius: 0.15 },
    };
    const newShape: ShapeData = {
      id: uuidv4(),
      type,
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: type === 'wall' ? '#e2e8f0' : type === 'gear' ? '#f59e0b' : '#3b82f6',
      layerId: activeLayer,
      dimensions: defaults[type],
    };
    setShapes(prev => [...prev, newShape]);
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

    const getGeometryForShape = (shape: ShapeData): THREE.BufferGeometry => {
      if (shape.geometry) return shape.geometry.clone();
      switch (shape.type) {
        case 'sphere':
          return new THREE.SphereGeometry(shape.dimensions.radius || 0.5, 32, 32);
        case 'cylinder':
          return new THREE.CylinderGeometry(shape.dimensions.radiusTop || 0.5, shape.dimensions.radiusBottom || 0.5, shape.dimensions.height || 1, 32);
        case 'box':
        default:
          const { width = 1, height = 1, depth = 1, filletRadius = 0, edgeType = 'sharp' } = shape.dimensions;
          if (edgeType === 'chamfer' && filletRadius > 0) {
            const safeFillet = Math.min(filletRadius, (width / 2) * 0.99, (depth / 2) * 0.99);
            const shape2d = new THREE.Shape();
            const hw = width / 2;
            const hd = depth / 2;
            shape2d.moveTo(-hw, -hd);
            shape2d.lineTo(hw, -hd);
            shape2d.lineTo(hw, hd);
            shape2d.lineTo(-hw, hd);
            shape2d.lineTo(-hw, -hd);
            const extrudeSettings = { depth: height, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: safeFillet, bevelThickness: safeFillet };
            const geo = new THREE.ExtrudeGeometry(shape2d, extrudeSettings);
            geo.translate(0, 0, -height / 2);
            geo.rotateX(Math.PI / 2);
            return geo;
          }
          return new THREE.BoxGeometry(width, height, depth);
      }
    };

    const geoA = getGeometryForShape(shapeA);
    const geoB = getGeometryForShape(shapeB);

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
      layerId: shapeA.layerId || activeLayer,
      dimensions: {},
      geometry: resultGeo
    };

    setShapes(prev => [...prev.filter(s => s.id !== idA && s.id !== idB), newShape]);
    setSelectedIds([newShape.id]);
    setSelectedIds([newShape.id]);
  };

  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    const newShape: ShapeData = {
      id: uuidv4(),
      type: 'group',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ffffff',
      layerId: activeLayer,
      dimensions: {},
      childrenIds: selectedIds,
      metadata: 'New Group'
    };
    setShapes([...shapes, newShape]);
    setSelectedIds([newShape.id]);
  };

  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliCommand.trim().toLowerCase();
    setCliCommand('');
    
    if (cmd === 'box' || cmd === 'sphere' || cmd === 'cylinder') {
      addShape(cmd as ShapeType);
    } else if (cmd === 'pline' || cmd === 'pl') {
      setPolylineMode(true);
      setSketchMode(false);
      setDimensionMode(false);
    } else if (cmd === 'dim') {
      setDimensionMode(true);
      setSketchMode(false);
      setPolylineMode(false);
    } else if (cmd === 'wall') {
      setWorkspace('architecture');
      addSpecialShape('wall');
    } else if (cmd === 'gear') {
      setWorkspace('mechanical');
      addSpecialShape('gear');
    } else if (cmd === 'pipe' || cmd === 'pi') {
      setWorkspace('mechanical');
      addSpecialShape('pipe');
    } else if (cmd === 'layer') {
      setLayers([...layers, { id: uuidv4(), name: `Layer ${layers.length}`, visible: true, color: '#ffffff' }]);
    }
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
          layerId: activeLayer,
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
      <div className="w-16 bg-[#121214] border-r border-[#ffffff15] flex flex-col items-center py-4 gap-1 z-10 shadow-lg overflow-y-auto">
        {/* Workspace Toggle */}
        <div className="flex flex-col gap-1 mb-2 w-full items-center">
          <button onClick={() => setWorkspace('general')} className={`p-2 w-10 h-10 rounded-lg text-[10px] font-bold transition ${workspace === 'general' ? 'bg-[#8b3dff] text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="General">GEN</button>
          <button onClick={() => setWorkspace('architecture')} className={`p-2 w-10 h-10 rounded-lg text-[10px] font-bold transition ${workspace === 'architecture' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Architecture">ARC</button>
          <button onClick={() => setWorkspace('mechanical')} className={`p-2 w-10 h-10 rounded-lg text-[10px] font-bold transition ${workspace === 'mechanical' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`} title="Mechanical">MEC</button>
        </div>
        <div className="w-8 h-[1px] bg-white/10 mb-2" />

        {/* General Tools (always visible) */}
        <button className="p-3 bg-[#8b3dff]/20 text-[#8b3dff] rounded-xl hover:bg-[#8b3dff]/30 transition" title="Select">
          <MousePointer2 className="w-5 h-5" />
        </button>
        <button onClick={() => addShape("box")} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition" title="Box">
          <BoxIcon className="w-5 h-5" />
        </button>
        <button onClick={() => addShape("sphere")} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition" title="Sphere">
          <Circle className="w-5 h-5" />
        </button>
        <button onClick={() => addShape("cylinder")} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition" title="Cylinder">
          <CylinderIcon className="w-5 h-5" />
        </button>

        {/* Architecture Tools */}
        {workspace === 'architecture' && (
          <>
            <div className="w-8 h-[1px] bg-blue-600/40 my-1" />
            <button onClick={() => addSpecialShape('wall')} className="p-3 text-blue-400 hover:text-white hover:bg-blue-600/20 rounded-xl transition" title="Place Wall">
              <span className="text-[11px] font-bold leading-none">WALL</span>
            </button>
          </>
        )}

        {/* Mechanical Tools */}
        {workspace === 'mechanical' && (
          <>
            <div className="w-8 h-[1px] bg-amber-600/40 my-1" />
            <button onClick={() => addSpecialShape('gear')} className="p-3 text-amber-400 hover:text-white hover:bg-amber-600/20 rounded-xl transition" title="Add Gear">
              <span className="text-[11px] font-bold leading-none">GEAR</span>
            </button>
            <button onClick={() => addSpecialShape('pipe')} className="p-3 text-amber-400 hover:text-white hover:bg-amber-600/20 rounded-xl transition" title="Add Pipe">
              <span className="text-[11px] font-bold leading-none">PIPE</span>
            </button>
          </>
        )}

        {/* Drafting Tools */}
        <div className="w-8 h-[1px] bg-white/10 my-1" />
        <button
          onClick={() => { setSketchMode(!sketchMode); setPolylineMode(false); setDimensionMode(false); }}
          className={`p-3 rounded-xl transition ${sketchMode ? 'bg-[#8b3dff] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          title="Draw Custom Sketch"
        >
          <PenTool className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setPolylineMode(!polylineMode); setSketchMode(false); setDimensionMode(false); }}
          className={`p-3 rounded-xl transition ${polylineMode ? 'bg-[#8b3dff] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          title="Draw 2D Polyline"
        >
          <Activity className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setDimensionMode(!dimensionMode); setSketchMode(false); setPolylineMode(false); }}
          className={`p-3 rounded-xl transition ${dimensionMode ? 'bg-[#8b3dff] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          title="Smart Dimension"
        >
          <Ruler className="w-5 h-5" />
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
              <div className="w-[1px] bg-white/10 mx-1" />
              <button onClick={handleGroup} disabled={selectedIds.length < 2} className="p-2 text-white/60 hover:text-white disabled:opacity-30 transition rounded-lg hover:bg-white/10" title="Group Objects">
                <Layers className="w-4 h-4" />
              </button>
           </div>
        </div>

        {sketchMode && (
          <div className="absolute top-16 left-4 right-4 flex justify-center z-10 pointer-events-none">
            <div className="bg-[#8b3dff]/20 backdrop-blur-md px-4 py-2 rounded-full border border-[#8b3dff]/50 text-white font-medium text-sm pointer-events-auto flex items-center gap-3">
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

        {polylineMode && (
          <div className="absolute top-16 left-4 right-4 flex justify-center z-10 pointer-events-none">
            <div className="bg-[#8b3dff]/20 backdrop-blur-md px-4 py-2 rounded-full border border-[#8b3dff]/50 text-white font-medium text-sm pointer-events-auto flex items-center gap-3">
              <span className="animate-pulse w-2 h-2 rounded-full bg-[#8b3dff]"></span>
              Click to draw 2D polyline points
              <button
                onClick={finishPolyline}
                className="ml-2 flex items-center gap-1 bg-[#8b3dff] text-white px-3 py-1 rounded-full text-xs hover:bg-[#9d5cff] transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Finish Polyline
              </button>
            </div>
          </div>
        )}

        {dimensionMode && (
          <div className="absolute top-16 left-4 right-4 flex justify-center z-10 pointer-events-none">
            <div className="bg-[#8b3dff]/20 backdrop-blur-md px-4 py-2 rounded-full border border-[#8b3dff]/50 text-white font-medium text-sm pointer-events-auto flex items-center gap-3">
              <span className="animate-pulse w-2 h-2 rounded-full bg-[#8b3dff]"></span>
              {dimensionPoint ? "Click second point to finish dimension" : "Click first point to start dimension"}
            </div>
          </div>
        )}

        {sculptMode && (
          <div className="absolute top-16 left-4 right-4 flex justify-center z-10 pointer-events-none">
            <div className="bg-[#8b3dff]/20 backdrop-blur-md px-4 py-2 rounded-full border border-[#8b3dff]/50 text-white font-medium text-sm pointer-events-auto flex items-center gap-3">
              <span className="animate-pulse w-2 h-2 rounded-full bg-[#8b3dff]"></span>
              Click and drag on a mesh to sculpt
            </div>
          </div>
        )}

        {/* CLI Input */}
        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none flex justify-center">
          <form onSubmit={handleCliSubmit} className="bg-[#121214]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3 pointer-events-auto shadow-2xl min-w-[300px]">
            <span className="text-white/40 font-mono text-sm">CMD:</span>
            <input
              type="text"
              value={cliCommand}
              onChange={(e) => setCliCommand(e.target.value)}
              placeholder="Type command (box, pline, dim...)"
              className="bg-transparent border-none outline-none text-white font-mono text-sm w-full placeholder:text-white/20"
              autoComplete="off"
            />
          </form>
        </div>

        <Canvas camera={{ position: [6, 5, 8], fov: 45 }} className={`w-full h-full ${sketchMode || polylineMode || dimensionMode || sculptMode ? 'cursor-crosshair' : ''}`} onPointerDown={handleCanvasClick} onPointerMove={handlePointerMove}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />

          {shapes
            .filter(s => layers.find(l => l.id === s.layerId)?.visible !== false)
            .filter(s => !shapes.some(g => g.type === 'group' && g.childrenIds?.includes(s.id)))
            .map((shape) => (
            <RenderShape
              key={shape.id}
              shape={shape}
              isSelected={selectedIds.includes(shape.id)}
              sculptMode={sculptMode}
              onClick={(e) => {
                if (sketchMode || polylineMode || dimensionMode || sculptMode) return;
                e.stopPropagation();
                handleSelect(shape.id, e.shiftKey);
              }}
              allShapes={shapes}
            />
          ))}

          {/* OSNAP Visual */}
          {snapPoint && (
             <mesh position={snapPoint}>
               <boxGeometry args={[0.1, 0.1, 0.1]} />
               <meshBasicMaterial color="#00ff00" wireframe />
             </mesh>
          )}

          {/* Active Dimension Point */}
          {dimensionMode && dimensionPoint && (
             <Sphere args={[0.05]} position={dimensionPoint}>
               <meshBasicMaterial color="#8b3dff" />
             </Sphere>
          )}

          {/* Active Sketch Lines */}
          {(sketchMode || polylineMode) && sketchPoints.length > 0 && (
             <group>
               {sketchPoints.map((p, i) => (
                 <Sphere key={i} args={[0.05]} position={p}>
                   <meshBasicMaterial color="#8b3dff" />
                 </Sphere>
               ))}
               {sketchPoints.length > 1 && (
                 <SafeLine
                   points={sketchPoints}
                   color="#8b3dff"
                   lineWidth={2}
                 />
               )}
                {sketchPoints.length > 2 && sketchMode && (
                  <SafeLine
                    points={[sketchPoints[sketchPoints.length-1], sketchPoints[0]]}
                    color="#8b3dff"
                    lineWidth={2}
                    dashed
                    dashSize={0.2}
                    gapSize={0.1}
                  />
                )}
             </group>
          )}

          <Grid
            args={[20, 20]} cellSize={1} cellThickness={1} cellColor="#333" sectionSize={5} sectionThickness={1.5} sectionColor="#555" fadeDistance={40} fadeStrength={1.5}
            onPointerDown={handleCanvasClick}
          />
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

                {selectedShape.type === 'group' && (
                  <div className="flex flex-col gap-2 text-xs">
                    <span className="text-white/60">Block Metadata</span>
                    <textarea value={selectedShape.metadata || ''} onChange={e=>updateShape(selectedShape.id, 'metadata', e.target.value)} className="bg-black/50 border border-white/10 rounded px-2 py-2 text-white w-full h-20 outline-none resize-none" placeholder="Enter metadata (e.g., Part No: 1045)" />
                  </div>
                )}
              </div>

              {/* Appearance & Layer */}
              <div className="space-y-3">
                <h3 className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">Appearance & Layer</h3>
                
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-white/60">Layer</span>
                  <select
                    value={selectedShape.layerId || 'default'}
                    onChange={e => updateShape(selectedShape.id, 'layerId', e.target.value)}
                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-24 outline-none"
                  >
                    {layers.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {colors.map(c => (
                    <button key={c} onClick={() => updateShape(selectedShape.id, 'color', c)} className={`w-6 h-6 rounded-full border-2 ${selectedShape.color === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

            </>
          )}
        </div>

        {/* Layer Manager */}
        <div className="mt-auto border-t border-white/10 p-4 bg-[#121214]/50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs uppercase tracking-wider text-white/40 font-semibold flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Layers
            </h3>
            <button
              onClick={() => setLayers([...layers, { id: uuidv4(), name: `Layer ${layers.length}`, visible: true, color: '#ffffff' }])}
              className="text-[#8b3dff] hover:bg-[#8b3dff]/20 p-1 rounded transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {layers.map(layer => (
              <div
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border ${activeLayer === layer.id ? 'bg-[#8b3dff]/10 border-[#8b3dff]/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
              >
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <div className={`w-2 h-2 rounded-full ${activeLayer === layer.id ? 'bg-[#8b3dff]' : 'bg-transparent'}`} />
                  {layer.name}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLayers(layers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l));
                  }}
                  className="text-white/40 hover:text-white transition p-1"
                >
                  {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

// Separate component to render shapes cleanly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RenderShape({ shape, isSelected, sculptMode, onClick, allShapes }: { shape: ShapeData, isSelected: boolean, sculptMode?: boolean, onClick: (e: any) => void, allShapes?: ShapeData[] }) {
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
    if (!sculptMode) return;
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    if (!mesh || !mesh.geometry || !mesh.geometry.attributes.position) return;

    // Simplistic Sculpting: Pull vertices near intersection
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
          {isSelected && <Edges scale={1.001} color="white" />}
        </Sphere>
      )}

      {shape.type === 'cylinder' && (
        <Cylinder args={[shape.dimensions.radiusTop || 0.5, shape.dimensions.radiusBottom || 0.5, shape.dimensions.height || 1, 32]}>
          <primitive object={material} attach="material" />
          {isSelected && <Edges scale={1.001} color="white" />}
        </Cylinder>
      )}

      {shape.type === 'extrusion' && (
        <ExtrusionShape shape={shape} material={material} isSelected={isSelected} />
      )}

      {(shape.type === 'csg' || shape.type === 'imported') && shape.geometry && (
        <mesh geometry={shape.geometry}>
           <primitive object={material} attach="material" />
           {isSelected && <Edges geometry={shape.geometry} scale={1.001} color="white" />}
        </mesh>
      )}

      {shape.type === 'polyline' && shape.dimensions.points && shape.dimensions.points.length > 1 && (
         <SafeLine
           points={shape.dimensions.points.map(p => new THREE.Vector3(...p))}
           color={shape.color}
           lineWidth={isSelected ? 4 : 2}
         />
      )}

      {shape.type === 'dimension' && shape.dimensions.startPoint && shape.dimensions.endPoint && (
        <group>
          <SafeLine
            points={[new THREE.Vector3(...shape.dimensions.startPoint), new THREE.Vector3(...shape.dimensions.endPoint)]}
            color={isSelected ? '#ffffff' : shape.color}
            lineWidth={isSelected ? 4 : 2}
          />
          <Html
            position={new THREE.Vector3()
              .addVectors(new THREE.Vector3(...shape.dimensions.startPoint), new THREE.Vector3(...shape.dimensions.endPoint))
              .multiplyScalar(0.5)}
            center
            distanceFactor={10}
            zIndexRange={[100, 0]}
          >
            <div className={`px-2 py-1 rounded bg-[#121214]/90 backdrop-blur-sm border ${isSelected ? 'border-white' : 'border-white/20'} text-xs font-mono text-white shadow-lg pointer-events-none whitespace-nowrap`}>
              {new THREE.Vector3(...shape.dimensions.startPoint).distanceTo(new THREE.Vector3(...shape.dimensions.endPoint)).toFixed(2)} u
            </div>
          </Html>
        </group>
      )}

      {shape.type === 'group' && shape.childrenIds && allShapes && (
        <group>
          {allShapes.filter(s => shape.childrenIds!.includes(s.id)).map(child => (
             <RenderShape key={child.id} shape={child} isSelected={false} onClick={()=>{}} allShapes={allShapes} />
          ))}
          {isSelected && (
             <mesh>
                <boxGeometry args={[1.1, 1.1, 1.1]} />
                <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.3} />
             </mesh>
          )}
        </group>
      )}

      {/* Architecture: Wall */}
      {shape.type === 'wall' && (
        <mesh>
          <boxGeometry args={[shape.dimensions.width || 4, shape.dimensions.height || 3, shape.dimensions.wallThickness || 0.2]} />
          <primitive object={material} attach="material" />
          {isSelected && <Edges scale={1.001} color="white" />}
        </mesh>
      )}

      {/* Mechanical: Gear */}
      {shape.type === 'gear' && (
        <GearShape shape={shape} material={material} isSelected={isSelected} />
      )}

      {/* Mechanical: Pipe */}
      {shape.type === 'pipe' && shape.dimensions.points && shape.dimensions.points.length > 1 && (
        <group>
          {shape.dimensions.points.slice(0, -1).map((pt, i) => {
            const from = new THREE.Vector3(...pt);
            const to = new THREE.Vector3(...shape.dimensions.points![i+1]);
            const dir = new THREE.Vector3().subVectors(to, from);
            const len = dir.length();
            const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
            const quat = new THREE.Quaternion();
            quat.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
            return (
              <mesh key={i} position={mid} quaternion={quat}>
                <cylinderGeometry args={[shape.dimensions.pipeRadius || 0.15, shape.dimensions.pipeRadius || 0.15, len, 16]} />
                <primitive object={material} attach="material" />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

function BoxShape({ shape, material, isSelected }: { shape: ShapeData, material: THREE.Material, isSelected: boolean }) {
  const { width = 1, height = 1, depth = 1, filletRadius = 0, edgeType = 'sharp' } = shape.dimensions;

  const geometry = useMemo(() => {
    if (edgeType === 'fillet' && filletRadius > 0) {
      // Return null to render RoundedBox instead, which is handled in the return statement
      return null;
    }

    if (edgeType === 'chamfer' && filletRadius > 0) {
      const safeFillet = Math.min(filletRadius, (width / 2) * 0.99, (depth / 2) * 0.99);
      const shape2d = new THREE.Shape();
      const hw = width / 2;
      const hd = depth / 2;
      shape2d.moveTo(-hw, -hd);
      shape2d.lineTo(hw, -hd);
      shape2d.lineTo(hw, hd);
      shape2d.lineTo(-hw, hd);
      shape2d.lineTo(-hw, -hd);

      const extrudeSettings = {
        depth: height,
        bevelEnabled: true,
        bevelSegments: 1, // 1 segment creates a straight chamfer
        steps: 1,
        bevelSize: safeFillet,
        bevelThickness: safeFillet
      };

      const geo = new THREE.ExtrudeGeometry(shape2d, extrudeSettings);
      geo.translate(0, 0, -height/2); // Extrude geo grows in Z, map it to match BoxGeometry
      geo.rotateX(Math.PI / 2); // Rotate to stand up
      return geo;
    }

    return new THREE.BoxGeometry(width, height, depth);
  }, [width, height, depth, filletRadius, edgeType]);

  if (!geometry) {
    return (
        <RoundedBox args={[width, height, depth]} radius={filletRadius} smoothness={4}>
          <primitive object={material} attach="material" />
          {isSelected && <Edges scale={1.001} color="white" />}
        </RoundedBox>
    );
  }

  // NOTE: In a real architecture, we would attach meshRef via forwardRef or context to let RenderShape access it for sculpting.
  // For the sake of this patch without massive refactoring, we'll let it be. Sculpting might not perfectly register on wrapped meshes.
  return (
    <mesh geometry={geometry}>
      <primitive object={material} attach="material" />
      {isSelected && <Edges geometry={geometry} scale={1.001} color="white" />}
    </mesh>
  );
}

function createSketchGeometry(points3d: THREE.Vector3[], depth: number) {
  // Convert 3D points to 2D shape (assuming drawn on XZ plane approx, mapped to XY for Shape)
  const pts = points3d.map(p => new THREE.Vector2(p.x, -p.z));
  const shape2d = new THREE.Shape(pts);
  const extrudeSettings = { depth: depth || 1, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.05, bevelThickness: 0.05 };
  const geo = new THREE.ExtrudeGeometry(shape2d, extrudeSettings);
  // Rotate to stand up or lay flat based on drawing plane
  geo.rotateX(Math.PI / 2);
  return geo;
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
      {isSelected && <Edges geometry={geometry} scale={1.001} color="white" />}
    </mesh>
  );
}

function GearShape({ shape, material, isSelected }: { shape: ShapeData, material: THREE.Material, isSelected: boolean }) {
  const { teeth = 12, radius = 1, innerRadius = 0.4, height = 0.3 } = shape.dimensions;

  const geometry = useMemo(() => {
    const toothDepth = (radius - innerRadius) * 0.6;
    const outerR = radius;
    const innerR = radius - toothDepth;
    const n = Math.max(3, Math.round(teeth));
    const pts: THREE.Vector2[] = [];

    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 0.3) / n) * Math.PI * 2;
      const a2 = ((i + 0.5) / n) * Math.PI * 2;
      const a3 = ((i + 0.7) / n) * Math.PI * 2;
      pts.push(new THREE.Vector2(Math.cos(a0) * innerR, Math.sin(a0) * innerR));
      pts.push(new THREE.Vector2(Math.cos(a1) * outerR, Math.sin(a1) * outerR));
      pts.push(new THREE.Vector2(Math.cos(a2) * outerR, Math.sin(a2) * outerR));
      pts.push(new THREE.Vector2(Math.cos(a3) * innerR, Math.sin(a3) * innerR));
    }

    const outerShape = new THREE.Shape(pts);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    outerShape.holes.push(hole);

    return new THREE.ExtrudeGeometry(outerShape, {
      depth: height,
      bevelEnabled: false,
    });
  }, [teeth, radius, innerRadius, height]);

  return (
    <mesh geometry={geometry} position={[0, -height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={material} attach="material" />
      {isSelected && <Edges geometry={geometry} scale={1.001} color="white" />}
    </mesh>
  );
}
