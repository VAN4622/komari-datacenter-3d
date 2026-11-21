import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { CAMERA_PRESETS } from '@/data/fleet';
import { RackCabinetMesh } from '@/components/three/RackCabinetMesh';
import {
  HallEnvironments,
  ROOM_FRONT_Z,
  ROOM_H,
  ROOM_W,
} from '@/components/three/HallEnvironments';
import type { HoveredUnitInfo } from '@/components/three/RackUnitMesh';
import type {
  CameraPreset,
  NodeInfo,
  NodeStyleOverride,
  RackCabinetData,
  RoomAtmosphere,
  ScaleMode,
} from '@/types/rack';

export interface CameraControlSignal {
  preset: CameraPreset;
  nonce: number;
  zoomStep?: { delta: number; nonce: number };
}

interface DataCenterScene3DProps {
  siteName: string;
  atmosphere: RoomAtmosphere;
  scale: ScaleMode;
  racks: RackCabinetData[];
  activeRackId: string;
  nodes: NodeInfo[];
  nodesMap: Map<string, NodeInfo>;
  nodeStyles: Record<string, NodeStyleOverride>;
  selectedNodeId: string | null;
  uidBlinkingIds: Set<string>;
  showStrip: boolean;
  drawerOpen: boolean;
  totalWatts: number;
  totalU: number;
  isLive: boolean;
  apiStatus: string;
  cameraSignal: CameraControlSignal;
  onUserOrbit: () => void;
  onZoomPercentChange: (pct: number) => void;
  onSelectRack: (rackId: string) => void;
  onSelectNode: (nodeId: string, rackId: string) => void;
  onAddRack: () => void;
}

// Faithful lighting matched directly to original hall.css atmospheres
// Neutral key/fill lighting ensures B1-B4 chassis finishes preserve exact original colors
const SCENE_LIGHTING: Record<
  RoomAtmosphere,
  {
    bg: string;
    hemiSky: string;
    hemiGround: string;
    hemiInt: number;
    keyColor: string;
    keyInt: number;
    keyPos: [number, number, number];
    fillColor: string;
    fillInt: number;
    fillPos: [number, number, number];
    frontColor: string;
    frontInt: number;
  }
> = {
  'cold-aisle': {
    bg: '#0c121d',
    hemiSky: '#dbeafe',
    hemiGround: '#111824',
    hemiInt: 0.94,
    keyColor: '#f5f9ff',
    keyInt: 1.52,
    keyPos: [4.2, 5.1, 6.2],
    fillColor: '#7dd3fc',
    fillInt: 0.44,
    fillPos: [-5.5, 3.8, 4.2],
    frontColor: '#e2e8f0',
    frontInt: 0.72,
  },
  cleanroom: {
    bg: '#dde2ea',
    hemiSky: '#ffffff',
    hemiGround: '#cbd5e1',
    hemiInt: 1.24,
    keyColor: '#ffffff',
    keyInt: 1.38,
    keyPos: [4.0, 5.1, 6.4],
    fillColor: '#e0f2fe',
    fillInt: 0.48,
    fillPos: [-5.2, 4.2, 4.4],
    frontColor: '#ffffff',
    frontInt: 0.52,
  },
  'obsidian-noc': {
    bg: '#07080b',
    hemiSky: '#cbd5e1',
    hemiGround: '#0c0e13',
    hemiInt: 0.78,
    keyColor: '#f1f5f9',
    keyInt: 1.48,
    keyPos: [4.2, 5.1, 6.2],
    fillColor: '#94a3b8',
    fillInt: 0.4,
    fillPos: [-5.5, 3.8, 4.2],
    frontColor: '#f8fafc',
    frontInt: 0.64,
  },
  showroom: {
    bg: '#0d1119',
    hemiSky: '#e2e8f0',
    hemiGround: '#0e121b',
    hemiInt: 0.86,
    keyColor: '#ffffff',
    keyInt: 1.62,
    keyPos: [3.6, 5.1, 6.2],
    fillColor: '#cbd5e1',
    fillInt: 0.46,
    fillPos: [-5.0, 4.0, 4.6],
    frontColor: '#f1f5f9',
    frontInt: 0.68,
  },
};

const CAM_MAX_X = ROOM_W / 2 - 0.75;
const CAM_MAX_Y = ROOM_H - 0.42;
const CAM_MAX_Z = ROOM_FRONT_Z - 0.75;

function CameraRig({
  cameraSignal,
  drawerOpen,
  rackCount,
  onUserOrbit,
  onZoomPercentChange,
}: {
  cameraSignal: CameraControlSignal;
  drawerOpen: boolean;
  rackCount: number;
  onUserOrbit: () => void;
  onZoomPercentChange: (pct: number) => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  const desiredPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.iso34.position));
  const desiredTarget = useRef(new THREE.Vector3(...CAMERA_PRESETS.iso34.target));
  const isAnimating = useRef(false);
  const lastZoomNonce = useRef<number>(0);

  const baseDist = useMemo(() => {
    const p = CAMERA_PRESETS[cameraSignal.preset] ?? CAMERA_PRESETS.iso34;
    const vPos = new THREE.Vector3(...p.position);
    const vTgt = new THREE.Vector3(...p.target);
    return vPos.distanceTo(vTgt);
  }, [cameraSignal.preset]);

  // Apply preset or drawer offset transition (clamped inside enclosed room)
  useEffect(() => {
    const spec = CAMERA_PRESETS[cameraSignal.preset] ?? CAMERA_PRESETS.iso34;
    const rackScaleBoost = Math.max(0, rackCount - 3) * 0.55;
    const drawerShiftX = drawerOpen ? 0.58 : 0;

    desiredPos.current.set(
      THREE.MathUtils.clamp(spec.position[0] + drawerShiftX, -CAM_MAX_X, CAM_MAX_X),
      THREE.MathUtils.clamp(spec.position[1] + rackScaleBoost * 0.16, 0.85, CAM_MAX_Y),
      THREE.MathUtils.clamp(spec.position[2] + rackScaleBoost, 2.2, CAM_MAX_Z),
    );
    desiredTarget.current.set(
      THREE.MathUtils.clamp(spec.target[0] + drawerShiftX, -3.0, 3.0),
      spec.target[1],
      spec.target[2],
    );
    isAnimating.current = true;
    onZoomPercentChange(100);
  }, [cameraSignal.preset, cameraSignal.nonce, drawerOpen, rackCount, onZoomPercentChange]);

  // Apply discrete zoom +/- steps from HUD buttons
  useEffect(() => {
    const step = cameraSignal.zoomStep;
    if (!step || step.nonce === lastZoomNonce.current) return;
    lastZoomNonce.current = step.nonce;

    const controls = controlsRef.current;
    if (!controls) return;

    const tgt = controls.target.clone();
    const offset = camera.position.clone().sub(tgt);
    const curDist = offset.length();
    const factor = step.delta > 0 ? 0.86 : 1.16;
    const nextDist = THREE.MathUtils.clamp(curDist * factor, 2.9, 8.8);
    offset.setLength(nextDist);
    desiredPos.current.copy(tgt).add(offset);
    desiredPos.current.x = THREE.MathUtils.clamp(desiredPos.current.x, -CAM_MAX_X, CAM_MAX_X);
    desiredPos.current.y = THREE.MathUtils.clamp(desiredPos.current.y, 0.75, CAM_MAX_Y);
    desiredPos.current.z = THREE.MathUtils.clamp(desiredPos.current.z, 1.4, CAM_MAX_Z);
    desiredTarget.current.copy(tgt);
    isAnimating.current = true;

    const pct = Math.round(THREE.MathUtils.clamp((baseDist / nextDist) * 100, 60, 180));
    onZoomPercentChange(pct);
  }, [cameraSignal.zoomStep, camera, baseDist, onZoomPercentChange]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isAnimating.current) {
      const alpha = Math.min(1, delta * 7.2);
      camera.position.lerp(desiredPos.current, alpha);
      controls.target.lerp(desiredTarget.current, alpha);
      if (
        camera.position.distanceTo(desiredPos.current) < 0.015 &&
        controls.target.distanceTo(desiredTarget.current) < 0.015
      ) {
        camera.position.copy(desiredPos.current);
        controls.target.copy(desiredTarget.current);
        isAnimating.current = false;
      }
    }

    // Keep camera and pan target strictly inside the enclosed room shell
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -CAM_MAX_X, CAM_MAX_X);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.7, CAM_MAX_Y);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, 1.3, CAM_MAX_Z);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -3.4, 3.4);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.9, 3.25);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -1.4, 0.9);

    controls.update();
  });

  const handleStart = useCallback(() => {
    isAnimating.current = false;
    onUserOrbit();
  }, [onUserOrbit]);

  const handleEnd = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const dist = camera.position.distanceTo(controls.target);
    const pct = Math.round(THREE.MathUtils.clamp((baseDist / Math.max(1, dist)) * 100, 60, 180));
    onZoomPercentChange(pct);
  }, [camera, baseDist, onZoomPercentChange]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.68}
      zoomSpeed={0.82}
      panSpeed={0.7}
      minDistance={2.9}
      maxDistance={8.8}
      minPolarAngle={0.44}
      maxPolarAngle={Math.PI / 2 - 0.055}
      minAzimuthAngle={-Math.PI * 0.38}
      maxAzimuthAngle={Math.PI * 0.38}
      onStart={handleStart}
      onEnd={handleEnd}
    />
  );
}

export function DataCenterScene3D({
  siteName,
  atmosphere,
  scale,
  racks,
  activeRackId,
  nodes,
  nodesMap,
  nodeStyles,
  selectedNodeId,
  uidBlinkingIds,
  showStrip,
  drawerOpen,
  totalWatts,
  totalU,
  isLive,
  apiStatus,
  cameraSignal,
  onUserOrbit,
  onZoomPercentChange,
  onSelectRack,
  onSelectNode,
  onAddRack,
}: DataCenterScene3DProps) {
  const [hoveredUnit, setHoveredUnit] = useState<HoveredUnitInfo | null>(null);
  const lighting = SCENE_LIGHTING[atmosphere] ?? SCENE_LIGHTING['cold-aisle'];

  const rackWidth = scale === 'compact' ? 1.04 : 1.18;
  const rackGap = scale === 'compact' ? 0.18 : 0.24;
  const canAddRack = racks.length < 5;

  const { rackPositions, rowSpan, ghostBayX } = useMemo(() => {
    const count = racks.length;
    const step = rackWidth + rackGap;
    const span = count * rackWidth + Math.max(0, count - 1) * rackGap;
    const startX = -((count - 1) * step) / 2;
    const positions = racks.map((_, i) => startX + i * step);
    const ghostX = startX + count * step;
    return { rackPositions: positions, rowSpan: span, ghostBayX: ghostX };
  }, [racks, rackWidth, rackGap]);

  return (
    <main className="hall-viewport r3f-viewport" aria-label="三维封闭式数据中心机房舞台">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: CAMERA_PRESETS.iso34.position,
          fov: CAMERA_PRESETS.iso34.fov,
          near: 0.1,
          far: 45,
        }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: atmosphere === 'cleanroom' ? 1.0 : 1.08,
        }}
      >
        <color attach="background" args={[lighting.bg]} />

        {/* Architectural Interior Lighting Rig (1 shadow caster for locked 60 FPS) */}
        <hemisphereLight args={[lighting.hemiSky, lighting.hemiGround, lighting.hemiInt]} />
        <directionalLight
          position={lighting.keyPos}
          intensity={lighting.keyInt}
          color={lighting.keyColor}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={1}
          shadow-camera-far={20}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={6}
          shadow-camera-bottom={-3}
          shadow-bias={-0.0004}
        />
        <directionalLight position={lighting.fillPos} intensity={lighting.fillInt} color={lighting.fillColor} />
        <pointLight
          position={[0, 2.7, 3.6]}
          intensity={lighting.frontInt}
          distance={14}
          decay={1.4}
          color={lighting.frontColor}
        />

        {/* Smooth Clamped OrbitControls + Preset Interpolation */}
        <CameraRig
          cameraSignal={cameraSignal}
          drawerOpen={drawerOpen}
          rackCount={racks.length}
          onUserOrbit={onUserOrbit}
          onZoomPercentChange={onZoomPercentChange}
        />

        {/* 4 Enclosed Architectural Rooms, Grounded Props & Elevated Unobstructed NOC Screen */}
        <HallEnvironments
          atmosphere={atmosphere}
          siteName={siteName}
          nodes={nodes}
          racks={racks}
          rowSpan={rowSpan}
          totalWatts={totalWatts}
          totalU={totalU}
          isLive={isLive}
          apiStatus={apiStatus}
          canAddRack={canAddRack}
          ghostBayX={ghostBayX}
          rackWidth={rackWidth}
          onAddRack={onAddRack}
        />

        {/* Row of Volumetric 3D Server Cabinets */}
        <group position={[0, atmosphere === 'showroom' ? 0.07 : 0, 0]}>
          {racks.map((rack, idx) => (
            <RackCabinetMesh
              key={rack.id}
              rack={rack}
              rackIndex={idx}
              positionX={rackPositions[idx]}
              rackWidth={rackWidth}
              atmosphere={atmosphere}
              active={rack.id === activeRackId}
              nodesMap={nodesMap}
              nodeStyles={nodeStyles}
              selectedNodeId={selectedNodeId}
              uidBlinkingIds={uidBlinkingIds}
              showStrip={showStrip}
              onSelectRack={onSelectRack}
              onSelectNode={onSelectNode}
              onHoverUnit={setHoveredUnit}
            />
          ))}
        </group>
      </Canvas>

      {/* Lightweight Zero-Lag Hover Inspection Pill (Outside WebGL) */}
      {hoveredUnit && (
        <div className="hud-hover-pill" aria-live="polite">
          <span className="hud-hover-rack">{hoveredUnit.rackName}</span>
          <strong className="hud-hover-title">{hoveredUnit.label}</strong>
          <span className="hud-hover-sub">{hoveredUnit.sub}</span>
        </div>
      )}
    </main>
  );
}
