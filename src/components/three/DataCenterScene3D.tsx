import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
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
  CameraControlMode,
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
  canEdit: boolean;
  cameraControlMode: CameraControlMode;
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

// Calibrated 2.5D architectural photography lighting rig (key + rim + softbox IBL + atmospheric depth)
const SCENE_LIGHTING: Record<
  RoomAtmosphere,
  {
    bg: string;
    fogColor: string;
    ambientInt: number;
    hemiSky: string;
    hemiGround: string;
    hemiInt: number;
    keyColor: string;
    keyInt: number;
    keyPos: [number, number, number];
    fillColor: string;
    fillInt: number;
    fillPos: [number, number, number];
    rimColor: string;
    rimInt: number;
    rimPos: [number, number, number];
    envInt: number;
    envTopColor: string;
    envLeftColor: string;
    envRightColor: string;
    shadowOpacity: number;
    shadowColor: string;
  }
> = {
  'cold-aisle': {
    bg: '#111927',
    fogColor: '#101825',
    ambientInt: 0.28,
    hemiSky: '#e4f0ff',
    hemiGround: '#162030',
    hemiInt: 0.96,
    keyColor: '#f8fcff',
    keyInt: 1.24,
    keyPos: [4.6, 5.4, 6.2],
    fillColor: '#93c5fd',
    fillInt: 0.44,
    fillPos: [-5.6, 3.8, 4.8],
    rimColor: '#bae6fd',
    rimInt: 0.36,
    rimPos: [-3.8, 4.8, -1.6],
    envInt: 0.68,
    envTopColor: '#eef6ff',
    envLeftColor: '#bfdbfe',
    envRightColor: '#dbeafe',
    shadowOpacity: 0.5,
    shadowColor: '#050911',
  },
  cleanroom: {
    bg: '#e1e7f0',
    fogColor: '#dfe5ee',
    ambientInt: 0.36,
    hemiSky: '#ffffff',
    hemiGround: '#c9d4e2',
    hemiInt: 1.18,
    keyColor: '#fffdf9',
    keyInt: 1.16,
    keyPos: [4.4, 5.5, 6.2],
    fillColor: '#e0f2fe',
    fillInt: 0.48,
    fillPos: [-5.4, 4.1, 4.8],
    rimColor: '#ffffff',
    rimInt: 0.32,
    rimPos: [-3.6, 4.9, -1.4],
    envInt: 0.72,
    envTopColor: '#ffffff',
    envLeftColor: '#f1f5f9',
    envRightColor: '#e0f2fe',
    shadowOpacity: 0.38,
    shadowColor: '#334155',
  },
  'obsidian-noc': {
    bg: '#0e1118',
    fogColor: '#0d1017',
    ambientInt: 0.24,
    hemiSky: '#dde4ef',
    hemiGround: '#11141c',
    hemiInt: 0.84,
    keyColor: '#f8fafc',
    keyInt: 1.28,
    keyPos: [4.5, 5.4, 6.1],
    fillColor: '#cbd5e1',
    fillInt: 0.38,
    fillPos: [-5.8, 3.6, 4.6],
    rimColor: '#fdba74',
    rimInt: 0.38,
    rimPos: [-4.2, 4.6, -1.5],
    envInt: 0.62,
    envTopColor: '#f1f5f9',
    envLeftColor: '#fed7aa',
    envRightColor: '#cbd5e1',
    shadowOpacity: 0.56,
    shadowColor: '#040508',
  },
  showroom: {
    bg: '#131824',
    fogColor: '#121723',
    ambientInt: 0.26,
    hemiSky: '#eef2f8',
    hemiGround: '#151b26',
    hemiInt: 0.92,
    keyColor: '#ffffff',
    keyInt: 1.32,
    keyPos: [3.9, 5.4, 6.3],
    fillColor: '#dbeafe',
    fillInt: 0.44,
    fillPos: [-5.2, 3.9, 4.8],
    rimColor: '#93c5fd',
    rimInt: 0.42,
    rimPos: [-3.4, 4.9, -1.5],
    envInt: 0.78,
    envTopColor: '#ffffff',
    envLeftColor: '#e2e8f0',
    envRightColor: '#dbeafe',
    shadowOpacity: 0.52,
    shadowColor: '#05080f',
  },
};

const CAM_MAX_X = ROOM_W / 2 - 0.85;
const CAM_MAX_Y = ROOM_H - 0.42;
const CAM_MAX_Z = ROOM_FRONT_Z - 0.85;
const MIN_CAM_DIST = 5.2;
const MAX_CAM_DIST = 12.6;

function CameraRig({
  cameraSignal,
  cameraControlMode,
  drawerOpen,
  rackCount,
  onUserOrbit,
  onZoomPercentChange,
}: {
  cameraSignal: CameraControlSignal;
  cameraControlMode: CameraControlMode;
  drawerOpen: boolean;
  rackCount: number;
  onUserOrbit: () => void;
  onZoomPercentChange: (pct: number) => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  const desiredPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.iso34.position));
  const desiredTarget = useRef(new THREE.Vector3(...CAMERA_PRESETS.iso34.target));
  const desiredFov = useRef<number>(CAMERA_PRESETS.iso34.fov);
  const isAnimating = useRef(false);
  const lastZoomNonce = useRef<number>(0);

  const presetGeometry = useMemo(() => {
    const spec = CAMERA_PRESETS[cameraSignal.preset] ?? CAMERA_PRESETS.iso34;
    const vPos = new THREE.Vector3(...spec.position);
    const vTgt = new THREE.Vector3(...spec.target);
    const offset = vPos.clone().sub(vTgt);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    return {
      spec,
      baseDist: offset.length(),
      azimuth: spherical.theta,
      polar: spherical.phi,
    };
  }, [cameraSignal.preset]);

  const { baseDist, azimuth: presetAzimuth, polar: presetPolar } = presetGeometry;

  // Apply preset, drawer offset, or camera lock transition (strictly clamped inside enclosed room)
  useEffect(() => {
    const spec = CAMERA_PRESETS[cameraSignal.preset] ?? CAMERA_PRESETS.iso34;
    const rackScaleBoost = Math.max(0, rackCount - 3) * 0.72;
    const drawerShiftX = drawerOpen ? 0.65 : 0;

    // Preserve exact 2.5D viewing direction while scaling distance gracefully for 4-5 racks
    const baseOffset = new THREE.Vector3(...spec.position).sub(new THREE.Vector3(...spec.target));
    const targetDist = THREE.MathUtils.clamp(baseOffset.length() + rackScaleBoost, MIN_CAM_DIST, MAX_CAM_DIST);
    baseOffset.setLength(targetDist);

    const tgtX = THREE.MathUtils.clamp(spec.target[0] + drawerShiftX, -3.2, 3.2);
    const tgtY = spec.target[1];
    const tgtZ = spec.target[2];

    desiredTarget.current.set(tgtX, tgtY, tgtZ);
    desiredPos.current.set(
      THREE.MathUtils.clamp(tgtX + baseOffset.x, -CAM_MAX_X, CAM_MAX_X),
      THREE.MathUtils.clamp(tgtY + baseOffset.y, 1.0, CAM_MAX_Y),
      THREE.MathUtils.clamp(tgtZ + baseOffset.z, 3.2, CAM_MAX_Z),
    );
    desiredFov.current = spec.fov;
    isAnimating.current = true;
    onZoomPercentChange(100);
  }, [cameraSignal.preset, cameraSignal.nonce, cameraControlMode, drawerOpen, rackCount, onZoomPercentChange]);

  // Apply discrete zoom +/- steps from HUD buttons along locked viewing ray
  useEffect(() => {
    const step = cameraSignal.zoomStep;
    if (!step || step.nonce === lastZoomNonce.current) return;
    lastZoomNonce.current = step.nonce;

    const controls = controlsRef.current;
    if (!controls) return;

    const tgt = controls.target.clone();
    const offset = camera.position.clone().sub(tgt);
    const curDist = offset.length();
    const factor = step.delta > 0 ? 0.87 : 1.15;
    const nextDist = THREE.MathUtils.clamp(curDist * factor, MIN_CAM_DIST, MAX_CAM_DIST);
    offset.setLength(nextDist);
    desiredPos.current.copy(tgt).add(offset);
    desiredPos.current.x = THREE.MathUtils.clamp(desiredPos.current.x, -CAM_MAX_X, CAM_MAX_X);
    desiredPos.current.y = THREE.MathUtils.clamp(desiredPos.current.y, 1.0, CAM_MAX_Y);
    desiredPos.current.z = THREE.MathUtils.clamp(desiredPos.current.z, 2.8, CAM_MAX_Z);
    desiredTarget.current.copy(tgt);
    isAnimating.current = true;

    const pct = Math.round(THREE.MathUtils.clamp((baseDist / nextDist) * 100, 65, 175));
    onZoomPercentChange(pct);
  }, [cameraSignal.zoomStep, camera, baseDist, onZoomPercentChange]);

  const maxPanX = Math.max(2.2, rackCount * 0.92);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Smooth telephoto FOV transition
    if (camera instanceof THREE.PerspectiveCamera) {
      const fovDiff = desiredFov.current - camera.fov;
      if (Math.abs(fovDiff) > 0.03) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFov.current, Math.min(1, delta * 7.5));
        camera.updateProjectionMatrix();
      }
    }

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

    // Strictly enforce enclosed 2.5D aisle bounds so walls/backfaces never clip into view
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -maxPanX, maxPanX);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 1.35, 2.85);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -0.85, 0.35);

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -CAM_MAX_X, CAM_MAX_X);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.95, CAM_MAX_Y);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, 2.8, CAM_MAX_Z);

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
    const pct = Math.round(THREE.MathUtils.clamp((baseDist / Math.max(1, dist)) * 100, 65, 175));
    onZoomPercentChange(pct);
  }, [camera, baseDist, onZoomPercentChange]);

  const isLocked25D = cameraControlMode === 'locked25d';

  // Tight angular envelope: locked to exact preset in locked25d, or subtle ±14° azimuth / ±9° polar micro-tilt
  const minAzimuth = isLocked25D
    ? presetAzimuth
    : THREE.MathUtils.clamp(presetAzimuth - 0.24, -0.78, 0.78);
  const maxAzimuth = isLocked25D
    ? presetAzimuth
    : THREE.MathUtils.clamp(presetAzimuth + 0.24, -0.78, 0.78);
  const minPolar = isLocked25D
    ? presetPolar
    : THREE.MathUtils.clamp(presetPolar - 0.16, 0.58, Math.PI / 2 - 0.08);
  const maxPolar = isLocked25D
    ? presetPolar
    : THREE.MathUtils.clamp(presetPolar + 0.16, 0.58, Math.PI / 2 - 0.08);

  const mouseButtons = useMemo(
    () =>
      isLocked25D
        ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
        : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
    [isLocked25D],
  );

  const touches = useMemo(
    () =>
      isLocked25D
        ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
        : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN },
    [isLocked25D],
  );

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.085}
      enableRotate={!isLocked25D}
      enablePan
      enableZoom
      screenSpacePanning
      rotateSpeed={0.42}
      zoomSpeed={0.76}
      panSpeed={0.68}
      minDistance={MIN_CAM_DIST}
      maxDistance={MAX_CAM_DIST}
      minPolarAngle={minPolar}
      maxPolarAngle={maxPolar}
      minAzimuthAngle={minAzimuth}
      maxAzimuthAngle={maxAzimuth}
      mouseButtons={mouseButtons}
      touches={touches}
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
  canEdit,
  cameraControlMode,
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
  const canAddRack = canEdit && racks.length < 5;

  const { rackPositions, rowSpan, ghostBayX } = useMemo(() => {
    const count = racks.length;
    const step = rackWidth + rackGap;
    const span = count * rackWidth + Math.max(0, count - 1) * rackGap;
    const startX = -((count - 1) * step) / 2;
    const positions = racks.map((_, i) => startX + i * step);
    const ghostX = startX + count * step;
    return { rackPositions: positions, rowSpan: span, ghostBayX: ghostX };
  }, [racks, rackWidth, rackGap]);

  const rackFloorY = atmosphere === 'showroom' ? 0.08 : 0;

  return (
    <main className="hall-viewport r3f-viewport" aria-label="2.5D 轻写实拟物机房舞台">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{
          position: CAMERA_PRESETS.iso34.position,
          fov: CAMERA_PRESETS.iso34.fov,
          near: 0.2,
          far: 45,
        }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.AgXToneMapping,
          toneMappingExposure: atmosphere === 'cleanroom' ? 1.02 : 1.06,
        }}
      >
        <color attach="background" args={[lighting.bg]} />
        <fog attach="fog" args={[lighting.fogColor, 15.5, 29.5]} />

        {/* Baked Procedural Studio Softbox IBL tuned specifically for fixed 2.5D anodized reflections */}
        <Environment key={atmosphere} resolution={256} frames={1} environmentIntensity={lighting.envInt}>
          {/* Broad Overhead Diffused Softbox */}
          <Lightformer
            form="rect"
            intensity={2.35}
            color={lighting.envTopColor}
            position={[0, 7.2, 1.8]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[13, 8, 1]}
          />
          {/* Narrow Horizontal Specular Strip (creates crisp metallic bevel sheen along 2.5D rack fronts) */}
          <Lightformer
            form="rect"
            intensity={2.6}
            color="#ffffff"
            position={[0.8, 3.8, 8.6]}
            rotation={[0.22, Math.PI, 0]}
            scale={[11, 0.85, 1]}
          />
          {/* Left Warm/Cool Rim Fill Panel */}
          <Lightformer
            form="rect"
            intensity={1.25}
            color={lighting.envLeftColor}
            position={[-9.5, 3.2, 2.5]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[10, 5.2, 1]}
          />
          {/* Right Soft Fill Panel */}
          <Lightformer
            form="rect"
            intensity={1.15}
            color={lighting.envRightColor}
            position={[9.5, 3.2, 2.5]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[10, 5.2, 1]}
          />
          {/* Front Soft Bounce Card so Server Bevels & 3D Rack Ears Catch Gentle Highlights */}
          <Lightformer
            form="rect"
            intensity={0.95}
            color="#f8fafc"
            position={[0, 2.2, 11]}
            rotation={[0, Math.PI, 0]}
            scale={[13, 4.5, 1]}
          />
        </Environment>

        {/* Three-Point Architectural Studio Lighting Rig (Tight 2048px Shadow Frustum) */}
        <ambientLight intensity={lighting.ambientInt} color="#f8fafc" />
        <hemisphereLight args={[lighting.hemiSky, lighting.hemiGround, lighting.hemiInt]} />
        <directionalLight
          position={lighting.keyPos}
          intensity={lighting.keyInt}
          color={lighting.keyColor}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-radius={3.2}
          shadow-camera-near={2.2}
          shadow-camera-far={18}
          shadow-camera-left={-5.8}
          shadow-camera-right={5.8}
          shadow-camera-top={4.6}
          shadow-camera-bottom={-0.8}
          shadow-bias={-0.00012}
          shadow-normalBias={0.028}
        />
        <directionalLight position={lighting.fillPos} intensity={lighting.fillInt} color={lighting.fillColor} />
        <directionalLight position={lighting.rimPos} intensity={lighting.rimInt} color={lighting.rimColor} />

        {/* High-Res Baked Ambient-Occlusion Contact Shadows anchoring Cabinets & Floor Furniture */}
        <ContactShadows
          key={`${atmosphere}-${racks.length}-${scale}`}
          position={[0, rackFloorY + 0.0025, atmosphere === 'showroom' ? 0 : 0.35]}
          opacity={lighting.shadowOpacity}
          scale={atmosphere === 'showroom' ? Math.max(rowSpan + 2.0, 6.4) : 14.5}
          blur={1.85}
          far={2.6}
          resolution={1024}
          frames={1}
          color={lighting.shadowColor}
        />

        {/* Fixed / Constrained 2.5D Architectural Camera Rig */}
        <CameraRig
          cameraSignal={cameraSignal}
          cameraControlMode={cameraControlMode}
          drawerOpen={drawerOpen}
          rackCount={racks.length}
          onUserOrbit={onUserOrbit}
          onZoomPercentChange={onZoomPercentChange}
        />

        {/* 4 Enclosed Architectural Rooms, Clean Accent Console & Elevated NOC Screen */}
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

        {/* Row of Tactile Chamfered 3D Server Cabinets */}
        <group position={[0, rackFloorY, 0]}>
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
