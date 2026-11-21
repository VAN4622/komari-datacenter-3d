import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createFloorTileTexture,
  createTerminalMonitorTexture,
  createWallPanelTexture,
  paintBigScreenCanvas,
} from '@/lib/sceneTextures';
import { RACK_D, RACK_H } from '@/components/three/RackCabinetMesh';
import type { NodeInfo, RackCabinetData, RoomAtmosphere } from '@/types/rack';

/* ============================================================================
   Enclosed Architectural Room Dimensions (shared with camera rig bounds)
   ============================================================================ */
export const ROOM_W = 16.0;
export const ROOM_H = 5.45;
export const ROOM_BACK_Z = -2.15;
export const ROOM_FRONT_Z = 9.4;
const ROOM_D = ROOM_FRONT_Z - ROOM_BACK_Z;
const ROOM_CENTER_Z = (ROOM_FRONT_Z + ROOM_BACK_Z) / 2;

interface HallEnvironmentsProps {
  atmosphere: RoomAtmosphere;
  siteName: string;
  nodes: NodeInfo[];
  racks: RackCabinetData[];
  rowSpan: number;
  totalWatts: number;
  totalU: number;
  isLive: boolean;
  apiStatus: string;
  canAddRack: boolean;
  ghostBayX: number;
  rackWidth: number;
  onAddRack: () => void;
}

/* ============================================================================
   Flush Wall-Mounted Live NOC Telemetry Big Screen
   Positioned cleanly ABOVE RACK_H (bottom at y = 3.06) so racks never block it.
   Exact 3.2:1 aspect ratio matching 1440x450 canvas (zero stretching).
   ============================================================================ */
function LiveNocBigScreen({
  atmosphere,
  siteName,
  nodes,
  racks,
  totalWatts,
  totalU,
  isLive,
  apiStatus,
}: {
  atmosphere: RoomAtmosphere;
  siteName: string;
  nodes: NodeInfo[];
  racks: RackCabinetData[];
  totalWatts: number;
  totalU: number;
  isLive: boolean;
  apiStatus: string;
}) {
  const historyRef = useRef<number[]>([36, 41, 39, 46, 52, 49, 54, 48, 51, 47, 53, 50]);

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1440;
    c.height = 450;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return { canvas: c, texture: t };
  }, []);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useEffect(() => {
    const online = nodes.filter((n) => n.online);
    const avgCpu =
      online.length > 0 ? Math.round(online.reduce((s, n) => s + n.cpu, 0) / online.length) : 0;
    historyRef.current = [...historyRef.current.slice(-15), avgCpu];

    paintBigScreenCanvas(canvas, {
      siteName,
      atmosphere,
      nodes,
      racks,
      totalWatts,
      totalU,
      isLive,
      apiStatus,
      historySeed: historyRef.current,
    });
    texture.needsUpdate = true;
  }, [canvas, texture, siteName, atmosphere, nodes, racks, totalWatts, totalU, isLive, apiStatus]);

  const isLight = atmosphere === 'cleanroom';
  const isBunker = atmosphere === 'obsidian-noc';
  const isShowroom = atmosphere === 'showroom';

  // Exact 3.2:1 ratio (6.24 / 1.95 = 3.2) elevated cleanly above RACK_H (2.68m)
  const screenW = isShowroom ? 5.92 : 6.24;
  const screenH = isShowroom ? 1.85 : 1.95;
  const screenY = 4.04; // bottom at ~3.065m, top at ~5.015m (below 5.45m ceiling)
  const bezelDepth = 0.09;
  const bezelZ = ROOM_BACK_Z + bezelDepth / 2;

  const accentColor = isLight
    ? '#0284c7'
    : isBunker
      ? '#f97316'
      : isShowroom
        ? '#7dd3fc'
        : '#38bdf8';

  return (
    <group position={[0, screenY, 0]}>
      {/* Architectural Wall-Flush Mounting Frame (solidly bolted onto ROOM_BACK_Z) */}
      <mesh position={[0, 0, bezelZ]} castShadow receiveShadow>
        <boxGeometry args={[screenW + 0.18, screenH + 0.16, bezelDepth]} />
        <meshStandardMaterial
          color={isLight ? '#cbd5e1' : isBunker ? '#14171f' : '#111826'}
          metalness={0.55}
          roughness={0.38}
        />
      </mesh>

      {/* Subtle Top & Bottom Recessed Accent Trim on Frame */}
      <mesh position={[0, screenH / 2 + 0.082, ROOM_BACK_Z + bezelDepth + 0.002]}>
        <boxGeometry args={[screenW + 0.04, 0.014, 0.008]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={isLight ? 0.5 : 1.35}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -(screenH / 2 + 0.082), ROOM_BACK_Z + bezelDepth + 0.002]}>
        <boxGeometry args={[screenW + 0.04, 0.012, 0.008]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={isLight ? 0.35 : 0.9}
          toneMapped={false}
        />
      </mesh>

      {/* Crisp Self-Illuminated Video Wall Display Plane */}
      <mesh position={[0, 0, ROOM_BACK_Z + bezelDepth + 0.006]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshStandardMaterial
          map={texture}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={isLight ? 0.35 : 0.82}
          roughness={0.26}
          metalness={0.08}
        />
      </mesh>
    </group>
  );
}

/* ============================================================================
   Prop: Grounded Self-Contained CRAC Precision Cooling Unit
   Solidly seated on y = 0, clean flush top plenum (zero floating pipes).
   ============================================================================ */
function CracCoolingUnit({
  position,
  rotationY = 0,
  isLight = false,
  accent = '#38bdf8',
}: {
  position: [number, number, number];
  rotationY?: number;
  isLight?: boolean;
  accent?: string;
}) {
  const shell = isLight ? '#dfe5ee' : '#1b2230';
  const louver = isLight ? '#94a3b8' : '#0b1018';
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Grounded Plinth Base */}
      <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.04, 0.11, 0.94]} />
        <meshStandardMaterial color="#11161f" metalness={0.45} roughness={0.65} />
      </mesh>
      {/* Main Cabinet Body */}
      <mesh position={[0, 1.395, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.57, 0.9]} />
        <meshStandardMaterial color={shell} metalness={0.48} roughness={0.38} />
      </mesh>
      {/* Flush Top Exhaust Plenum Cap (cleanly closed, no dangling pipes) */}
      <mesh position={[0, 2.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.96, 0.12, 0.86]} />
        <meshStandardMaterial color={isLight ? '#cbd5e1' : '#141a24'} metalness={0.55} roughness={0.4} />
      </mesh>
      {/* Front Intake Louver Slats */}
      {Array.from({ length: 8 }).map((_, idx) => (
        <mesh key={idx} position={[0, 0.46 + idx * 0.15, 0.456]}>
          <boxGeometry args={[0.78, 0.052, 0.016]} />
          <meshStandardMaterial color={louver} metalness={0.35} roughness={0.62} />
        </mesh>
      ))}
      {/* Upper Control LCD Panel */}
      <mesh position={[0, 2.22, 0.456]}>
        <boxGeometry args={[0.74, 0.32, 0.02]} />
        <meshStandardMaterial color="#0b111b" metalness={0.3} roughness={0.42} />
      </mesh>
      <mesh position={[-0.14, 2.22, 0.468]}>
        <planeGeometry args={[0.36, 0.16]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.95} toneMapped={false} />
      </mesh>
      <mesh position={[0.22, 2.22, 0.468]}>
        <circleGeometry args={[0.022, 16]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ============================================================================
   Prop: Mobile KVM Diagnostic Crash Cart (All wheels grounded on y = 0)
   ============================================================================ */
function KvmCrashCart({
  position,
  rotationY = 0.42,
  nodes,
  accent = '#38bdf8',
}: {
  position: [number, number, number];
  rotationY?: number;
  nodes: NodeInfo[];
  accent?: string;
}) {
  const screenTex = useMemo(() => createTerminalMonitorTexture(nodes, accent), [nodes, accent]);
  useEffect(() => {
    return () => {
      screenTex.dispose();
    };
  }, [screenTex]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 4 Caster Wheels cleanly touching y = 0 */}
      {[
        [-0.28, 0.04, -0.22],
        [0.28, 0.04, -0.22],
        [-0.28, 0.04, 0.22],
        [0.28, 0.04, 0.22],
      ].map(([cx, cy, cz], idx) => (
        <mesh key={idx} position={[cx, cy, cz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.032, 12]} />
          <meshStandardMaterial color="#11161f" roughness={0.8} />
        </mesh>
      ))}
      {/* Base Platform resting on casters */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.68, 0.045, 0.54]} />
        <meshStandardMaterial color="#202736" metalness={0.55} roughness={0.44} />
      </mesh>
      {/* Lower Battery / Tool Box */}
      <mesh position={[0, 0.24, -0.02]} castShadow>
        <boxGeometry args={[0.42, 0.24, 0.34]} />
        <meshStandardMaterial color="#141922" metalness={0.48} roughness={0.5} />
      </mesh>
      {/* Vertical Cart Frame Posts connecting base to worktop */}
      {[-0.28, 0.28].map((px, i) => (
        <mesh key={i} position={[px, 0.54, -0.21]} castShadow>
          <boxGeometry args={[0.04, 0.88, 0.04]} />
          <meshStandardMaterial color="#64748b" metalness={0.72} roughness={0.3} />
        </mesh>
      ))}
      {/* Worktop Surface */}
      <mesh position={[0, 0.98, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.04, 0.56]} />
        <meshStandardMaterial color="#2e3847" metalness={0.48} roughness={0.42} />
      </mesh>
      {/* Keyboard */}
      <mesh position={[0, 1.01, 0.1]}>
        <boxGeometry args={[0.44, 0.02, 0.16]} />
        <meshStandardMaterial color="#111620" roughness={0.55} />
      </mesh>
      {/* Monitor Column seated firmly in worktop */}
      <mesh position={[0, 1.19, -0.18]}>
        <cylinderGeometry args={[0.024, 0.028, 0.4, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.74} roughness={0.32} />
      </mesh>
      {/* Monitor Housing & Live Terminal Screen */}
      <group position={[0, 1.38, -0.14]} rotation={[-0.12, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.62, 0.4, 0.036]} />
          <meshStandardMaterial color="#0f151f" metalness={0.48} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[0.56, 0.34]} />
          <meshStandardMaterial
            map={screenTex}
            emissive="#ffffff"
            emissiveMap={screenTex}
            emissiveIntensity={0.78}
            roughness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================================
   Prop: Wall-Anchored FM-200 Clean-Agent Fire Suppression Cylinders
   Seated on floor y = 0 AND bolted flush into ROOM_BACK_Z!
   ============================================================================ */
function FireSuppressionTanks({ x }: { x: number }) {
  const z = ROOM_BACK_Z + 0.22;
  return (
    <group position={[x, 0, z]}>
      {[-0.2, 0.2].map((ox, i) => (
        <group key={i} position={[ox, 0, 0]}>
          {/* Floor-seated base ring */}
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.145, 0.15, 0.06, 16]} />
            <meshStandardMaterial color="#1e2430" metalness={0.5} roughness={0.55} />
          </mesh>
          {/* Main cylinder body */}
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.135, 0.135, 1.32, 16]} />
            <meshStandardMaterial color="#a61b1b" metalness={0.42} roughness={0.36} />
          </mesh>
          {/* Dome cap */}
          <mesh position={[0, 1.38, 0]}>
            <sphereGeometry args={[0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#a61b1b" metalness={0.42} roughness={0.36} />
          </mesh>
          {/* Brass valve assembly */}
          <mesh position={[0, 1.56, 0]}>
            <cylinderGeometry args={[0.036, 0.046, 0.14, 12]} />
            <meshStandardMaterial color="#c8a232" metalness={0.78} roughness={0.28} />
          </mesh>
        </group>
      ))}
      {/* Solid Mounting Bracket spanning from cylinders directly INTO the back wall */}
      <mesh position={[0, 0.92, -0.14]}>
        <boxGeometry args={[0.74, 0.075, 0.16]} />
        <meshStandardMaterial color="#2b3444" metalness={0.65} roughness={0.42} />
      </mesh>
    </group>
  );
}

/* ============================================================================
   Prop: Cleanroom Modular Lab Workbench (Grounded on 4 legs)
   ============================================================================ */
function CleanroomWorkbench({
  position,
  nodes,
}: {
  position: [number, number, number];
  nodes: NodeInfo[];
}) {
  const screenTex = useMemo(() => createTerminalMonitorTexture(nodes, '#0284c7'), [nodes]);
  useEffect(() => {
    return () => {
      screenTex.dispose();
    };
  }, [screenTex]);

  return (
    <group position={position} rotation={[0, -0.42, 0]}>
      {/* 4 Brushed Aluminum Legs touching y = 0 */}
      {[
        [-0.62, 0.43, -0.32],
        [0.62, 0.43, -0.32],
        [-0.62, 0.43, 0.32],
        [0.62, 0.43, 0.32],
      ].map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, ly, lz]} castShadow>
          <boxGeometry args={[0.05, 0.86, 0.05]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.65} roughness={0.32} />
        </mesh>
      ))}
      {/* Clean Laminate Bench Top */}
      <mesh position={[0, 0.88, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.38, 0.05, 0.76]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.1} roughness={0.38} />
      </mesh>
      {/* Monitor Stand + Display cleanly seated on desk */}
      <mesh position={[-0.2, 0.92, -0.16]}>
        <boxGeometry args={[0.24, 0.025, 0.18]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[-0.2, 1.07, -0.2]}>
        <boxGeometry args={[0.05, 0.28, 0.03]} />
        <meshStandardMaterial color="#64748b" metalness={0.65} roughness={0.32} />
      </mesh>
      <group position={[-0.2, 1.24, -0.17]}>
        <mesh castShadow>
          <boxGeometry args={[0.64, 0.38, 0.03]} />
          <meshStandardMaterial color="#1e293b" metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.58, 0.32]} />
          <meshStandardMaterial
            map={screenTex}
            emissive="#ffffff"
            emissiveMap={screenTex}
            emissiveIntensity={0.6}
            roughness={0.28}
          />
        </mesh>
      </group>
      {/* Benchtop Calibration Meter */}
      <mesh position={[0.38, 0.99, -0.08]} castShadow>
        <boxGeometry args={[0.32, 0.17, 0.26]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.38} roughness={0.4} />
      </mesh>
      <mesh position={[0.38, 1.0, 0.054]}>
        <planeGeometry args={[0.22, 0.09]} />
        <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ============================================================================
   Prop: Obsidian NOC Grounded UPS Battery Towers & Tactical Ops Console
   ============================================================================ */
function BunkerOpsSuite({
  leftX,
  rightX,
  nodes,
}: {
  leftX: number;
  rightX: number;
  nodes: NodeInfo[];
}) {
  const screenTex = useMemo(() => createTerminalMonitorTexture(nodes, '#f97316'), [nodes]);
  useEffect(() => {
    return () => {
      screenTex.dispose();
    };
  }, [screenTex]);

  return (
    <>
      {/* Twin Grounded High-Density UPS Battery Towers flanking rack row */}
      {[leftX, rightX].map((ux, idx) => (
        <group key={idx} position={[ux, 0, -0.12]}>
          <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.92, 0.11, 0.98]} />
            <meshStandardMaterial color="#0b0d12" metalness={0.5} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.24, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.88, 2.26, 0.94]} />
            <meshStandardMaterial color="#161922" metalness={0.55} roughness={0.42} />
          </mesh>
          {/* Subtle Orange Load Telemetry Bar */}
          <mesh position={[0, 1.98, 0.474]}>
            <boxGeometry args={[0.56, 0.022, 0.01]} />
            <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
          {/* Battery Module Slats */}
          {[0.48, 0.78, 1.08, 1.38, 1.68].map((by, j) => (
            <mesh key={j} position={[0, by, 0.474]}>
              <boxGeometry args={[0.68, 0.16, 0.012]} />
              <meshStandardMaterial color="#0f1218" metalness={0.4} roughness={0.55} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Grounded Tactical Ops Desk in Left Foreground */}
      <group position={[Math.max(-5.8, leftX + 0.4), 0, 2.15]} rotation={[0, 0.42, 0]}>
        {/* Solid Side Pedestals touching y = 0 */}
        {[-0.56, 0.56].map((px, i) => (
          <mesh key={i} position={[px, 0.42, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.08, 0.84, 0.62]} />
            <meshStandardMaterial color="#151821" metalness={0.55} roughness={0.44} />
          </mesh>
        ))}
        {/* Desk Top */}
        <mesh position={[0, 0.86, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.28, 0.05, 0.68]} />
          <meshStandardMaterial color="#1b1f2a" metalness={0.48} roughness={0.38} />
        </mesh>
        {/* Subtle Orange Front Desk Edge Trim */}
        <mesh position={[0, 0.86, 0.343]}>
          <boxGeometry args={[1.22, 0.014, 0.008]} />
          <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={1.3} toneMapped={false} />
        </mesh>
        {/* Dual Monitor Stand & Screens seated on desk */}
        <mesh position={[0, 0.99, -0.18]}>
          <boxGeometry args={[0.08, 0.24, 0.06]} />
          <meshStandardMaterial color="#252a36" metalness={0.6} roughness={0.36} />
        </mesh>
        {[-0.3, 0.3].map((mx, i) => (
          <group key={i} position={[mx, 1.2, -0.14]} rotation={[0, i === 0 ? 0.12 : -0.12, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.56, 0.34, 0.032]} />
              <meshStandardMaterial color="#0e1117" metalness={0.5} roughness={0.42} />
            </mesh>
            <mesh position={[0, 0, 0.018]}>
              <planeGeometry args={[0.51, 0.29]} />
              <meshStandardMaterial
                map={screenTex}
                emissive="#ffffff"
                emissiveMap={screenTex}
                emissiveIntensity={0.82}
                roughness={0.25}
              />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

/* ============================================================================
   Ghost Expansion Bay (+ Add Rack interactive wireframe slot on floor)
   ============================================================================ */
function GhostExpansionBay({
  positionX,
  rackWidth,
  atmosphere,
  onAddRack,
}: {
  positionX: number;
  rackWidth: number;
  atmosphere: RoomAtmosphere;
  onAddRack: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pulseRef = useRef<THREE.Mesh>(null);
  const accent =
    atmosphere === 'obsidian-noc' ? '#f97316' : atmosphere === 'cleanroom' ? '#0284c7' : '#38bdf8';

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const mat = pulseRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = hovered ? 0.32 : 0.1 + Math.sin(clock.getElapsedTime() * 2.1) * 0.04;
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onAddRack();
  };

  return (
    <group position={[positionX, 0, 0]}>
      {/* Grounded Floor Slot Pad */}
      <mesh
        ref={pulseRef}
        position={[0, 0.006, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <planeGeometry args={[rackWidth, RACK_D]} />
        <meshBasicMaterial color={accent} transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {/* Subtle Wireframe Corner Posts seated on y = 0 */}
      {[
        [-rackWidth / 2, -RACK_D / 2],
        [rackWidth / 2, -RACK_D / 2],
        [-rackWidth / 2, RACK_D / 2],
        [rackWidth / 2, RACK_D / 2],
      ].map(([cx, cz], i) => (
        <mesh
          key={i}
          position={[cx, RACK_H / 2, cz]}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
        >
          <boxGeometry args={[0.018, RACK_H, 0.018]} />
          <meshBasicMaterial color={accent} transparent opacity={hovered ? 0.68 : 0.24} />
        </mesh>
      ))}
      {/* Interactive + Sign in Center */}
      <group
        position={[0, RACK_H * 0.48, RACK_D * 0.2]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <mesh>
          <boxGeometry args={[0.3, 0.045, 0.016]} />
          <meshBasicMaterial color={accent} transparent opacity={hovered ? 0.92 : 0.42} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.045, 0.3, 0.016]} />
          <meshBasicMaterial color={accent} transparent opacity={hovered ? 0.92 : 0.42} />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================================
   Main Architectural Hall Enclosure & Scene Environments
   ============================================================================ */
export function HallEnvironments({
  atmosphere,
  siteName,
  nodes,
  racks,
  rowSpan,
  totalWatts,
  totalU,
  isLive,
  apiStatus,
  canAddRack,
  ghostBayX,
  rackWidth,
  onAddRack,
}: HallEnvironmentsProps) {
  const floorTex = useMemo(() => createFloorTileTexture(atmosphere), [atmosphere]);
  const wallTex = useMemo(() => createWallPanelTexture(atmosphere), [atmosphere]);

  useEffect(() => {
    return () => {
      floorTex.dispose();
    };
  }, [floorTex]);

  useEffect(() => {
    return () => {
      wallTex.dispose();
    };
  }, [wallTex]);

  const isLight = atmosphere === 'cleanroom';
  const isBunker = atmosphere === 'obsidian-noc';
  const isShowroom = atmosphere === 'showroom';
  const isColdAisle = atmosphere === 'cold-aisle';

  const wallTrimColor = isLight ? '#c8d1de' : isBunker ? '#171a22' : isShowroom ? '#1a202d' : '#1b2638';
  const ceilingColor = isLight ? '#edf1f7' : isBunker ? '#0b0d12' : isShowroom ? '#0f131c' : '#101826';
  const beamColor = isLight ? '#d8e0eb' : isBunker ? '#151820' : isShowroom ? '#181e2a' : '#192334';
  const ceilingLightColor = isLight ? '#ffffff' : isBunker ? '#f8fafc' : isShowroom ? '#f1f5f9' : '#e0f2fe';
  const ceilingLightEmissive = isLight ? '#ffffff' : isBunker ? '#ffedd5' : isShowroom ? '#e2e8f0' : '#bae6fd';
  const aisleAccent = isLight ? '#0284c7' : isBunker ? '#f97316' : isShowroom ? '#7dd3fc' : '#38bdf8';

  const rowHalf = rowSpan / 2;
  const rightClearEdge = canAddRack ? Math.max(rowHalf, ghostBayX + rackWidth / 2) : rowHalf;
  const leftPropX = Math.max(-6.45, -(rowHalf + 1.45));
  const rightPropX = Math.min(6.45, rightClearEdge + 1.4);

  return (
    <group>
      {/* =====================================================================
          1. FULLY ENCLOSED ARCHITECTURAL ROOM SHELL (Floor, 4 Walls, Ceiling)
         ===================================================================== */}

      {/* Raised Modular Floor (y = 0) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM_CENTER_Z]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial
          map={floorTex}
          metalness={isShowroom ? 0.25 : 0.14}
          roughness={isShowroom ? 0.34 : isLight ? 0.52 : 0.56}
        />
      </mesh>

      {/* Back Wall (inner surface at z = ROOM_BACK_Z) */}
      <mesh position={[0, ROOM_H / 2, ROOM_BACK_Z]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial map={wallTex} metalness={0.14} roughness={0.68} />
      </mesh>

      {/* Front Wall behind camera (inner surface at z = ROOM_FRONT_Z) */}
      <mesh position={[0, ROOM_H / 2, ROOM_FRONT_Z]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial map={wallTex} metalness={0.12} roughness={0.72} />
      </mesh>

      {/* Left Wall (inner surface at x = -ROOM_W / 2) */}
      <mesh position={[-ROOM_W / 2, ROOM_H / 2, ROOM_CENTER_Z]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial map={wallTex} metalness={0.14} roughness={0.68} />
      </mesh>

      {/* Right Wall (inner surface at x = +ROOM_W / 2) */}
      <mesh position={[ROOM_W / 2, ROOM_H / 2, ROOM_CENTER_Z]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial map={wallTex} metalness={0.14} roughness={0.68} />
      </mesh>

      {/* Solid Ceiling Slab (inner surface at y = ROOM_H) */}
      <mesh position={[0, ROOM_H, ROOM_CENTER_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={ceilingColor} metalness={0.1} roughness={0.82} />
      </mesh>

      {/* =====================================================================
          2. FLUSH ARCHITECTURAL TRIM, PILASTERS & CEILING BEAMS (Zero Gaps!)
         ===================================================================== */}

      {/* Floor Baseboards along Back, Left & Right Walls */}
      <mesh position={[0, 0.08, ROOM_BACK_Z + 0.025]}>
        <boxGeometry args={[ROOM_W, 0.16, 0.05]} />
        <meshStandardMaterial color={wallTrimColor} metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[-ROOM_W / 2 + 0.025, 0.08, ROOM_CENTER_Z]}>
        <boxGeometry args={[0.05, 0.16, ROOM_D]} />
        <meshStandardMaterial color={wallTrimColor} metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[ROOM_W / 2 - 0.025, 0.08, ROOM_CENTER_Z]}>
        <boxGeometry args={[0.05, 0.16, ROOM_D]} />
        <meshStandardMaterial color={wallTrimColor} metalness={0.35} roughness={0.5} />
      </mesh>

      {/* Full-Height Structural Pilasters on Back Wall (Floor y=0 to Ceiling y=ROOM_H) */}
      {[-6.8, -3.75, 3.75, 6.8].map((px, i) => (
        <mesh key={i} position={[px, ROOM_H / 2, ROOM_BACK_Z + 0.09]} castShadow receiveShadow>
          <boxGeometry args={[0.26, ROOM_H, 0.18]} />
          <meshStandardMaterial color={wallTrimColor} metalness={0.38} roughness={0.46} />
        </mesh>
      ))}

      {/* Full-Height Structural Columns on Left & Right Walls (Floor to Ceiling) */}
      {[-0.4, 2.8, 6.0].map((cz, i) => (
        <group key={i}>
          <mesh position={[-ROOM_W / 2 + 0.09, ROOM_H / 2, cz]} receiveShadow>
            <boxGeometry args={[0.18, ROOM_H, 0.24]} />
            <meshStandardMaterial color={wallTrimColor} metalness={0.38} roughness={0.46} />
          </mesh>
          <mesh position={[ROOM_W / 2 - 0.09, ROOM_H / 2, cz]} receiveShadow>
            <boxGeometry args={[0.18, ROOM_H, 0.24]} />
            <meshStandardMaterial color={wallTrimColor} metalness={0.38} roughness={0.46} />
          </mesh>
        </group>
      ))}

      {/* Flush Horizontal Architectural Wall Reveal Lines on Side Walls */}
      <mesh position={[-ROOM_W / 2 + 0.015, 2.75, ROOM_CENTER_Z]}>
        <boxGeometry args={[0.03, 0.024, ROOM_D]} />
        <meshStandardMaterial
          color={aisleAccent}
          emissive={aisleAccent}
          emissiveIntensity={isLight ? 0.25 : 0.75}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[ROOM_W / 2 - 0.015, 2.75, ROOM_CENTER_Z]}>
        <boxGeometry args={[0.03, 0.024, ROOM_D]} />
        <meshStandardMaterial
          color={aisleAccent}
          emissive={aisleAccent}
          emissiveIntensity={isLight ? 0.25 : 0.75}
          toneMapped={false}
        />
      </mesh>

      {/* Wall-to-Wall Flush Ceiling Structural Beams (Seated directly against y = ROOM_H) */}
      {[-0.6, 2.1, 4.8].map((bz, i) => (
        <mesh key={i} position={[0, ROOM_H - 0.07, bz]}>
          <boxGeometry args={[ROOM_W, 0.14, 0.22]} />
          <meshStandardMaterial color={beamColor} metalness={0.32} roughness={0.55} />
        </mesh>
      ))}

      {/* Flush-Recessed Architectural Ceiling LED Light Panels (Embedded directly in ceiling slab!) */}
      {[0.75, 3.45].map((lz, rowIdx) =>
        [-4.2, 0, 4.2].map((lx, colIdx) => (
          <group key={`${rowIdx}-${colIdx}`} position={[lx, ROOM_H - 0.016, lz]}>
            {/* Recessed Aluminum Frame */}
            <mesh>
              <boxGeometry args={[2.2, 0.032, 0.34]} />
              <meshStandardMaterial color={wallTrimColor} metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Flush Opal Diffuser Panel */}
            <mesh position={[0, -0.018, 0]}>
              <boxGeometry args={[2.06, 0.008, 0.24]} />
              <meshStandardMaterial
                color={ceilingLightColor}
                emissive={ceilingLightEmissive}
                emissiveIntensity={isLight ? 0.95 : isShowroom ? 1.15 : 1.35}
                toneMapped={false}
              />
            </mesh>
          </group>
        )),
      )}

      {/* =====================================================================
          3. RECESSED COLD-AISLE FLOOR ACCENT CHANNEL
         ===================================================================== */}
      {!isShowroom ? (
        <mesh position={[0, 0.003, 1.24]}>
          <boxGeometry args={[Math.max(rowSpan + 2.8, 7.6), 0.006, 0.032]} />
          <meshStandardMaterial
            color={aisleAccent}
            emissive={aisleAccent}
            emissiveIntensity={isLight ? 0.6 : 1.45}
            toneMapped={false}
          />
        </mesh>
      ) : (
        /* Showroom: Grounded Monolithic Display Plinth Flush on Floor */
        <>
          <mesh position={[0, 0.035, 0]} receiveShadow>
            <boxGeometry args={[Math.max(rowSpan + 2.2, 6.4), 0.07, 2.05]} />
            <meshStandardMaterial color="#151a25" metalness={0.38} roughness={0.32} />
          </mesh>
          <mesh position={[0, 0.071, 1.022]}>
            <boxGeometry args={[Math.max(rowSpan + 2.16, 6.36), 0.01, 0.014]} />
            <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.3} toneMapped={false} />
          </mesh>
        </>
      )}

      {/* =====================================================================
          4. ELEVATED FLUSH WALL-MOUNTED LIVE NOC TELEMETRY BIG SCREEN
         ===================================================================== */}
      <LiveNocBigScreen
        atmosphere={atmosphere}
        siteName={siteName}
        nodes={nodes}
        racks={racks}
        totalWatts={totalWatts}
        totalU={totalU}
        isLive={isLive}
        apiStatus={apiStatus}
      />

      {/* =====================================================================
          5. SCENE-SPECIFIC GROUNDED ARCHITECTURAL PROPS (Zero Floating Items)
         ===================================================================== */}
      {isColdAisle && (
        <>
          <CracCoolingUnit position={[leftPropX, 0, -0.15]} rotationY={0.1} accent="#38bdf8" />
          <CracCoolingUnit position={[rightPropX, 0, -0.15]} rotationY={-0.1} accent="#38bdf8" />
          <KvmCrashCart
            position={[Math.max(-6.2, leftPropX + 0.45), 0, 1.95]}
            rotationY={0.46}
            nodes={nodes}
            accent="#38bdf8"
          />
          <FireSuppressionTanks x={5.4} />
        </>
      )}

      {isLight && (
        <>
          <CracCoolingUnit position={[leftPropX, 0, -0.12]} rotationY={0.08} isLight accent="#0284c7" />
          <CracCoolingUnit position={[rightPropX, 0, -0.12]} rotationY={-0.08} isLight accent="#0284c7" />
          <CleanroomWorkbench
            position={[Math.min(5.9, rightPropX - 0.15), 0, 1.9]}
            nodes={nodes}
          />
        </>
      )}

      {isBunker && (
        <>
          <BunkerOpsSuite leftX={leftPropX} rightX={rightPropX} nodes={nodes} />
          <FireSuppressionTanks x={5.4} />
        </>
      )}

      {/* =====================================================================
          6. GHOST EXPANSION BAY (Grounded on floor when < 5 racks)
         ===================================================================== */}
      {canAddRack && (
        <GhostExpansionBay
          positionX={ghostBayX}
          rackWidth={rackWidth}
          atmosphere={atmosphere}
          onAddRack={onAddRack}
        />
      )}
    </group>
  );
}
