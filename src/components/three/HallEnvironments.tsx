import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
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
   Enclosed Architectural Room Dimensions (shared with 2.5D camera rig bounds)
   ============================================================================ */
export const ROOM_W = 18.4;
export const ROOM_H = 5.85;
export const ROOM_BACK_Z = -2.15;
export const ROOM_FRONT_Z = 12.2;
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
   Softly beveled tactile anodized housing, elevated cleanly above RACK_H
   so server cabinets never occlude it. Exact 3.2:1 aspect ratio.
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

  const screenW = isShowroom ? 5.92 : 6.24;
  const screenH = isShowroom ? 1.85 : 1.95;
  const screenY = 4.04;
  const bezelDepth = 0.11;
  const bezelZ = ROOM_BACK_Z + bezelDepth / 2 - 0.01;

  const frameColor = isLight
    ? '#d2dae6'
    : isBunker
      ? '#1b1f29'
      : isShowroom
        ? '#1c2330'
        : '#1b2434';
  const innerMatColor = isLight ? '#b8c4d4' : '#0f141d';
  const accentColor = isLight
    ? '#38bdf8'
    : isBunker
      ? '#fb923c'
      : isShowroom
        ? '#93c5fd'
        : '#60a5fa';

  return (
    <group position={[0, screenY, 0]}>
      {/* Soft-Chamfered Outer Anodized Frame (solidly recessed into back wall) */}
      <RoundedBox
        args={[screenW + 0.24, screenH + 0.22, bezelDepth]}
        radius={0.036}
        smoothness={4}
        position={[0, 0, bezelZ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={frameColor} metalness={0.22} roughness={0.56} />
      </RoundedBox>

      {/* Recessed Inner Mat Border */}
      <RoundedBox
        args={[screenW + 0.08, screenH + 0.07, 0.024]}
        radius={0.014}
        smoothness={3}
        position={[0, 0, ROOM_BACK_Z + bezelDepth - 0.012]}
      >
        <meshStandardMaterial color={innerMatColor} metalness={0.14} roughness={0.72} />
      </RoundedBox>

      {/* Subtle Soft Accent Hairline under Screen */}
      <RoundedBox
        args={[screenW * 0.42, 0.014, 0.01]}
        radius={0.005}
        smoothness={2}
        position={[0, -(screenH / 2 + 0.072), ROOM_BACK_Z + bezelDepth + 0.002]}
      >
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={isLight ? 0.35 : 0.72}
          roughness={0.4}
        />
      </RoundedBox>

      {/* Anti-Glare Satin Matte Video Wall Display Plane */}
      <mesh position={[0, 0, ROOM_BACK_Z + bezelDepth + 0.004]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshStandardMaterial
          map={texture}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={isLight ? 0.28 : 0.68}
          roughness={0.42}
          metalness={0.04}
        />
      </mesh>
    </group>
  );
}

/* ============================================================================
   Foreground Accent Prop: Soft-Chamfered Tactile KVM Console Cart
   Placed well away from the rack edges in the left foreground (cold-aisle).
   ============================================================================ */
function TactileKvmConsole({
  position,
  rotationY = 0.48,
  nodes,
  accent = '#60a5fa',
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
      {/* 4 Soft Rubberized Caster Wheels seated on y = 0 */}
      {[
        [-0.26, 0.036, -0.2],
        [0.26, 0.036, -0.2],
        [-0.26, 0.036, 0.2],
        [0.26, 0.036, 0.2],
      ].map(([cx, cy, cz], idx) => (
        <mesh key={idx} position={[cx, cy, cz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.036, 0.036, 0.034, 16]} />
          <meshStandardMaterial color="#1e2430" roughness={0.78} metalness={0.12} />
        </mesh>
      ))}

      {/* Soft-Rounded Base Tray */}
      <RoundedBox args={[0.66, 0.056, 0.52]} radius={0.02} smoothness={4} position={[0, 0.095, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#273040" metalness={0.22} roughness={0.58} />
      </RoundedBox>

      {/* Rounded Lower Equipment Cube */}
      <RoundedBox args={[0.42, 0.24, 0.34]} radius={0.024} smoothness={4} position={[0, 0.24, -0.02]} castShadow>
        <meshStandardMaterial color="#1d2431" metalness={0.18} roughness={0.62} />
      </RoundedBox>

      {/* Satin Anodized Twin Support Columns */}
      {[-0.25, 0.25].map((px, i) => (
        <mesh key={i} position={[px, 0.54, -0.18]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.86, 16]} />
          <meshStandardMaterial color="#7e8ea4" metalness={0.32} roughness={0.44} />
        </mesh>
      ))}

      {/* Soft-Chamfered Worktop Desk Surface */}
      <RoundedBox args={[0.74, 0.048, 0.56]} radius={0.02} smoothness={4} position={[0, 0.98, 0.01]} castShadow receiveShadow>
        <meshStandardMaterial color="#364154" metalness={0.2} roughness={0.54} />
      </RoundedBox>

      {/* Tactile Compact Mechanical Keyboard */}
      <RoundedBox args={[0.42, 0.022, 0.16]} radius={0.008} smoothness={3} position={[0, 1.015, 0.1]}>
        <meshStandardMaterial color="#1a202c" roughness={0.65} metalness={0.1} />
      </RoundedBox>

      {/* Satin Monitor Neck */}
      <mesh position={[0, 1.18, -0.17]}>
        <cylinderGeometry args={[0.022, 0.026, 0.38, 16]} />
        <meshStandardMaterial color="#6d7c92" metalness={0.32} roughness={0.46} />
      </mesh>

      {/* Beveled Display Housing & Soft Matte Terminal */}
      <group position={[0, 1.37, -0.13]} rotation={[-0.1, 0, 0]}>
        <RoundedBox args={[0.64, 0.41, 0.044]} radius={0.018} smoothness={4} castShadow>
          <meshStandardMaterial color="#1c222e" metalness={0.22} roughness={0.54} />
        </RoundedBox>
        <mesh position={[0, 0, 0.024]}>
          <planeGeometry args={[0.56, 0.33]} />
          <meshStandardMaterial
            map={screenTex}
            emissive="#ffffff"
            emissiveMap={screenTex}
            emissiveIntensity={0.64}
            roughness={0.38}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================================
   Foreground Accent Prop: Cleanroom Tactile Lab Desk
   Minimal Dieter-Rams-inspired rounded matte bench in right foreground.
   ============================================================================ */
function CleanroomLabDesk({
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
    <group position={position} rotation={[0, -0.46, 0]}>
      {/* 4 Cylindrical Satin Aluminum Legs seated on y = 0 */}
      {[
        [-0.58, 0.43, -0.3],
        [0.58, 0.43, -0.3],
        [-0.58, 0.43, 0.3],
        [0.58, 0.43, 0.3],
      ].map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, ly, lz]} castShadow>
          <cylinderGeometry args={[0.024, 0.024, 0.86, 16]} />
          <meshStandardMaterial color="#a6b2c2" metalness={0.28} roughness={0.44} />
        </mesh>
      ))}

      {/* Soft-Chamfered Warm-White Laminate Top */}
      <RoundedBox args={[1.34, 0.056, 0.74]} radius={0.022} smoothness={4} position={[0, 0.88, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f1f4f8" metalness={0.06} roughness={0.52} />
      </RoundedBox>

      {/* Rounded Monitor Base & Display */}
      <RoundedBox args={[0.24, 0.026, 0.18]} radius={0.01} smoothness={3} position={[-0.18, 0.92, -0.15]}>
        <meshStandardMaterial color="#94a3b8" metalness={0.28} roughness={0.46} />
      </RoundedBox>
      <mesh position={[-0.18, 1.07, -0.19]}>
        <cylinderGeometry args={[0.02, 0.022, 0.28, 14]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.28} roughness={0.46} />
      </mesh>
      <group position={[-0.18, 1.24, -0.16]}>
        <RoundedBox args={[0.64, 0.39, 0.038]} radius={0.016} smoothness={4} castShadow>
          <meshStandardMaterial color="#cbd5e1" metalness={0.2} roughness={0.48} />
        </RoundedBox>
        <mesh position={[0, 0, 0.021]}>
          <planeGeometry args={[0.57, 0.32]} />
          <meshStandardMaterial
            map={screenTex}
            emissive="#ffffff"
            emissiveMap={screenTex}
            emissiveIntensity={0.48}
            roughness={0.38}
          />
        </mesh>
      </group>

      {/* Braun-Style Rounded Benchtop Diagnostic Unit */}
      <RoundedBox args={[0.32, 0.17, 0.25]} radius={0.022} smoothness={4} position={[0.38, 0.99, -0.06]} castShadow>
        <meshStandardMaterial color="#dce3ec" metalness={0.14} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0.38, 1.0, 0.067]}>
        <planeGeometry args={[0.2, 0.085]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.55} roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ============================================================================
   Foreground Accent Prop: Obsidian NOC Tactical Ops Console
   Clean chamfered standalone console desk (NO bulky flanking UPS towers!).
   ============================================================================ */
function ObsidianOpsConsole({
  position,
  nodes,
}: {
  position: [number, number, number];
  nodes: NodeInfo[];
}) {
  const screenTex = useMemo(() => createTerminalMonitorTexture(nodes, '#fb923c'), [nodes]);
  useEffect(() => {
    return () => {
      screenTex.dispose();
    };
  }, [screenTex]);

  return (
    <group position={position} rotation={[0, 0.46, 0]}>
      {/* Soft-Chamfered Side Pedestals touching y = 0 */}
      {[-0.54, 0.54].map((px, i) => (
        <RoundedBox
          key={i}
          args={[0.08, 0.84, 0.6]}
          radius={0.022}
          smoothness={4}
          position={[px, 0.42, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#1d212b" metalness={0.22} roughness={0.58} />
        </RoundedBox>
      ))}

      {/* Soft-Chamfered Console Top */}
      <RoundedBox args={[1.26, 0.056, 0.68]} radius={0.022} smoothness={4} position={[0, 0.86, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#252a36" metalness={0.2} roughness={0.52} />
      </RoundedBox>

      {/* Subtle Warm Amber Edge Indicator */}
      <RoundedBox args={[0.54, 0.012, 0.01]} radius={0.004} smoothness={2} position={[0, 0.86, 0.342]}>
        <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={0.78} roughness={0.4} />
      </RoundedBox>

      {/* Dual Monitor Stand & Beveled Matte Displays */}
      <RoundedBox args={[0.08, 0.24, 0.06]} radius={0.018} smoothness={3} position={[0, 0.99, -0.18]}>
        <meshStandardMaterial color="#2e3442" metalness={0.28} roughness={0.48} />
      </RoundedBox>
      {[-0.31, 0.31].map((mx, i) => (
        <group key={i} position={[mx, 1.2, -0.14]} rotation={[0, i === 0 ? 0.12 : -0.12, 0]}>
          <RoundedBox args={[0.57, 0.35, 0.038]} radius={0.016} smoothness={4} castShadow>
            <meshStandardMaterial color="#181c24" metalness={0.22} roughness={0.54} />
          </RoundedBox>
          <mesh position={[0, 0, 0.021]}>
            <planeGeometry args={[0.5, 0.28]} />
            <meshStandardMaterial
              map={screenTex}
              emissive="#ffffff"
              emissiveMap={screenTex}
              emissiveIntensity={0.66}
              roughness={0.38}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ============================================================================
   Ghost Expansion Bay (+ Add Rack soft frosted architectural floor slot)
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
    atmosphere === 'obsidian-noc' ? '#fb923c' : atmosphere === 'cleanroom' ? '#0ea5e9' : '#60a5fa';

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const mat = pulseRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = hovered ? 0.24 : 0.08 + Math.sin(clock.getElapsedTime() * 1.9) * 0.03;
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
      {/* Soft Grounded Floor Slot Pad */}
      <mesh
        ref={pulseRef}
        position={[0, 0.006, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <planeGeometry args={[rackWidth, RACK_D]} />
        <meshBasicMaterial color={accent} transparent opacity={0.1} depthWrite={false} />
      </mesh>

      {/* Soft Slender Cylindrical Corner Guides seated on y = 0 */}
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
          <cylinderGeometry args={[0.008, 0.008, RACK_H, 10]} />
          <meshBasicMaterial color={accent} transparent opacity={hovered ? 0.56 : 0.18} />
        </mesh>
      ))}

      {/* Soft Rounded + Pill Badge in Center */}
      <group
        position={[0, RACK_H * 0.48, RACK_D * 0.18]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <RoundedBox args={[0.28, 0.044, 0.018]} radius={0.012} smoothness={3}>
          <meshBasicMaterial color={accent} transparent opacity={hovered ? 0.85 : 0.36} />
        </RoundedBox>
        <RoundedBox args={[0.044, 0.28, 0.018]} radius={0.012} smoothness={3}>
          <meshBasicMaterial color={accent} transparent opacity={hovered ? 0.85 : 0.36} />
        </RoundedBox>
      </group>
    </group>
  );
}

/* ============================================================================
   Main Architectural Hall Enclosure & Scene Environments
   Tactile Light-Realism: soft satin walls/floor, chamfered pilasters & ceiling
   panels, zero clunky flanking boxes around the server cabinets!
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

  const wallTrimColor = isLight ? '#d3dbe7' : isBunker ? '#1d212b' : isShowroom ? '#1f2634' : '#222d3f';
  const ceilingColor = isLight ? '#eef2f7' : isBunker ? '#11141c' : isShowroom ? '#141925' : '#161f2e';
  const beamColor = isLight ? '#dee5ef' : isBunker ? '#191d27' : isShowroom ? '#1c2331' : '#1e2839';
  const ceilingLightColor = isLight ? '#ffffff' : isBunker ? '#f8fafc' : isShowroom ? '#f1f5f9' : '#ebf5ff';
  const ceilingLightEmissive = isLight ? '#ffffff' : isBunker ? '#fde6d2' : isShowroom ? '#e2e8f0' : '#dbeafe';
  const aisleAccent = isLight ? '#38bdf8' : isBunker ? '#fb923c' : isShowroom ? '#93c5fd' : '#60a5fa';

  const rowHalf = rowSpan / 2;
  const rightClearEdge = canAddRack ? Math.max(rowHalf, ghostBayX + rackWidth / 2) : rowHalf;

  // Position single subtle foreground accent piece well clear of the rack row
  const leftDeskX = Math.max(-5.8, -(rowHalf + 2.35));
  const rightDeskX = Math.min(5.8, rightClearEdge + 2.15);

  return (
    <group>
      {/* =====================================================================
          1. FULLY ENCLOSED SOFT-MATTE ARCHITECTURAL ROOM SHELL
         ===================================================================== */}

      {/* Smooth Matte-Satin Modular Floor (y = 0) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM_CENTER_Z]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial
          map={floorTex}
          metalness={isShowroom ? 0.14 : 0.08}
          roughness={isShowroom ? 0.48 : isLight ? 0.64 : 0.68}
        />
      </mesh>

      {/* Back Wall (inner surface at z = ROOM_BACK_Z) */}
      <mesh position={[0, ROOM_H / 2, ROOM_BACK_Z]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial map={wallTex} metalness={0.06} roughness={0.78} />
      </mesh>

      {/* Front Wall behind camera (inner surface at z = ROOM_FRONT_Z) */}
      <mesh position={[0, ROOM_H / 2, ROOM_FRONT_Z]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial map={wallTex} metalness={0.06} roughness={0.8} />
      </mesh>

      {/* Left Wall (inner surface at x = -ROOM_W / 2) */}
      <mesh position={[-ROOM_W / 2, ROOM_H / 2, ROOM_CENTER_Z]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial map={wallTex} metalness={0.06} roughness={0.78} />
      </mesh>

      {/* Right Wall (inner surface at x = +ROOM_W / 2) */}
      <mesh position={[ROOM_W / 2, ROOM_H / 2, ROOM_CENTER_Z]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial map={wallTex} metalness={0.06} roughness={0.78} />
      </mesh>

      {/* Solid Matte Acoustic Ceiling Slab (inner surface at y = ROOM_H) */}
      <mesh position={[0, ROOM_H, ROOM_CENTER_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={ceilingColor} metalness={0.05} roughness={0.88} />
      </mesh>

      {/* =====================================================================
          2. SOFT-CHAMFERED ARCHITECTURAL TRIM, PILASTERS & DIFFUSED CEILING COVES
         ===================================================================== */}

      {/* Floor Baseboards along Back, Left & Right Walls */}
      <RoundedBox args={[ROOM_W, 0.16, 0.06]} radius={0.015} smoothness={3} position={[0, 0.08, ROOM_BACK_Z + 0.025]}>
        <meshStandardMaterial color={wallTrimColor} metalness={0.14} roughness={0.65} />
      </RoundedBox>
      <RoundedBox args={[0.06, 0.16, ROOM_D]} radius={0.015} smoothness={3} position={[-ROOM_W / 2 + 0.025, 0.08, ROOM_CENTER_Z]}>
        <meshStandardMaterial color={wallTrimColor} metalness={0.14} roughness={0.65} />
      </RoundedBox>
      <RoundedBox args={[0.06, 0.16, ROOM_D]} radius={0.015} smoothness={3} position={[ROOM_W / 2 - 0.025, 0.08, ROOM_CENTER_Z]}>
        <meshStandardMaterial color={wallTrimColor} metalness={0.14} roughness={0.65} />
      </RoundedBox>

      {/* Soft-Chamfered Full-Height Structural Pilasters on Back Wall */}
      {[-6.8, -3.75, 3.75, 6.8].map((px, i) => (
        <RoundedBox
          key={i}
          args={[0.28, ROOM_H, 0.2]}
          radius={0.032}
          smoothness={4}
          position={[px, ROOM_H / 2, ROOM_BACK_Z + 0.09]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={wallTrimColor} metalness={0.14} roughness={0.64} />
        </RoundedBox>
      ))}

      {/* Soft-Chamfered Structural Columns on Left & Right Walls */}
      {[-0.4, 2.8, 6.0].map((cz, i) => (
        <group key={i}>
          <RoundedBox
            args={[0.2, ROOM_H, 0.26]}
            radius={0.032}
            smoothness={4}
            position={[-ROOM_W / 2 + 0.09, ROOM_H / 2, cz]}
            receiveShadow
          >
            <meshStandardMaterial color={wallTrimColor} metalness={0.14} roughness={0.64} />
          </RoundedBox>
          <RoundedBox
            args={[0.2, ROOM_H, 0.26]}
            radius={0.032}
            smoothness={4}
            position={[ROOM_W / 2 - 0.09, ROOM_H / 2, cz]}
            receiveShadow
          >
            <meshStandardMaterial color={wallTrimColor} metalness={0.14} roughness={0.64} />
          </RoundedBox>
        </group>
      ))}

      {/* Subtle Soft Wall Reveal Accent on Side Walls */}
      <mesh position={[-ROOM_W / 2 + 0.015, 2.75, ROOM_CENTER_Z]}>
        <boxGeometry args={[0.024, 0.022, ROOM_D]} />
        <meshStandardMaterial
          color={aisleAccent}
          emissive={aisleAccent}
          emissiveIntensity={isLight ? 0.16 : 0.42}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[ROOM_W / 2 - 0.015, 2.75, ROOM_CENTER_Z]}>
        <boxGeometry args={[0.024, 0.022, ROOM_D]} />
        <meshStandardMaterial
          color={aisleAccent}
          emissive={aisleAccent}
          emissiveIntensity={isLight ? 0.16 : 0.42}
          roughness={0.5}
        />
      </mesh>

      {/* Wall-to-Wall Soft-Chamfered Ceiling Structural Beams */}
      {[-0.6, 2.2, 5.2, 8.2].map((bz, i) => (
        <RoundedBox key={i} args={[ROOM_W, 0.16, 0.24]} radius={0.024} smoothness={3} position={[0, ROOM_H - 0.07, bz]}>
          <meshStandardMaterial color={beamColor} metalness={0.18} roughness={0.64} />
        </RoundedBox>
      ))}

      {/* Back-Wall Architectural Datum Channel & Indirect Upper Wall Cove Strip */}
      <group position={[0, 2.86, ROOM_BACK_Z + 0.032]}>
        <RoundedBox args={[ROOM_W - 0.4, 0.055, 0.052]} radius={0.01} smoothness={3}>
          <meshStandardMaterial color={wallTrimColor} metalness={0.28} roughness={0.48} />
        </RoundedBox>
        <mesh position={[0, 0.032, 0.008]}>
          <boxGeometry args={[Math.max(rowSpan + 4.4, 8.8), 0.012, 0.014]} />
          <meshStandardMaterial
            color={aisleAccent}
            emissive={aisleAccent}
            emissiveIntensity={isLight ? 0.2 : 0.65}
            roughness={0.35}
          />
        </mesh>
      </group>

      {/* Ceiling-Suspended Aluminum Overhead Cable Ladder Runway (Above NOC screen, zero occlusion) */}
      <group position={[0, ROOM_H - 0.34, -0.35]}>
        {/* Front & Rear Continuous Aluminum Side Stringers (wall-to-wall) */}
        <RoundedBox args={[ROOM_W - 0.2, 0.042, 0.028]} radius={0.006} smoothness={2} position={[0, 0, 0.24]}>
          <meshStandardMaterial color={wallTrimColor} metalness={0.42} roughness={0.42} />
        </RoundedBox>
        <RoundedBox args={[ROOM_W - 0.2, 0.042, 0.028]} radius={0.006} smoothness={2} position={[0, 0, -0.24]}>
          <meshStandardMaterial color={wallTrimColor} metalness={0.42} roughness={0.42} />
        </RoundedBox>
        {/* Cross Rungs + Vertical Suspension Rods Anchored Flush to Ceiling */}
        {[-6.4, -4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8, 6.4].map((rx, i) => (
          <group key={i} position={[rx, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.026, 0.018, 0.48]} />
              <meshStandardMaterial color={wallTrimColor} metalness={0.38} roughness={0.46} />
            </mesh>
            {i % 2 === 0 && (
              <>
                <mesh position={[0, 0.17, 0.24]}>
                  <cylinderGeometry args={[0.009, 0.009, 0.34, 8]} />
                  <meshStandardMaterial color={wallTrimColor} metalness={0.45} roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.17, -0.24]}>
                  <cylinderGeometry args={[0.009, 0.009, 0.34, 8]} />
                  <meshStandardMaterial color={wallTrimColor} metalness={0.45} roughness={0.4} />
                </mesh>
              </>
            )}
          </group>
        ))}
      </group>

      {/* Flush-Recessed Frosted Architectural Ceiling Softbox Panels */}
      {[0.8, 3.7, 6.7].map((lz, rowIdx) =>
        [-4.4, 0, 4.4].map((lx, colIdx) => (
          <group key={`${rowIdx}-${colIdx}`} position={[lx, ROOM_H - 0.016, lz]}>
            <RoundedBox args={[2.32, 0.036, 0.4]} radius={0.014} smoothness={3}>
              <meshStandardMaterial color={wallTrimColor} metalness={0.28} roughness={0.48} />
            </RoundedBox>
            <RoundedBox args={[2.16, 0.012, 0.28]} radius={0.005} smoothness={2} position={[0, -0.016, 0]}>
              <meshStandardMaterial
                color={ceilingLightColor}
                emissive={ceilingLightEmissive}
                emissiveIntensity={isLight ? 0.78 : isShowroom ? 0.92 : 1.05}
                roughness={0.32}
              />
            </RoundedBox>
          </group>
        )),
      )}

      {/* =====================================================================
          3. FLOOR ACCENT CHANNEL, COLD-AISLE DIFFUSERS OR SHOWROOM PLINTH
         ===================================================================== */}
      {!isShowroom ? (
        <group>
          <RoundedBox
            args={[Math.max(rowSpan + 2.6, 7.6), 0.008, 0.036]}
            radius={0.003}
            smoothness={2}
            position={[0, 0.003, 1.46]}
          >
            <meshStandardMaterial
              color={aisleAccent}
              emissive={aisleAccent}
              emissiveIntensity={isLight ? 0.3 : 0.78}
              roughness={0.35}
            />
          </RoundedBox>
          {/* Flush Raised-Floor Cold-Aisle Perforated Airflow Diffuser Tiles */}
          {[-2.1, -0.7, 0.7, 2.1].map((gx, idx) => (
            <group key={idx} position={[gx, 0.002, 1.08]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[1.08, 0.44]} />
                <meshStandardMaterial
                  color={isLight ? '#c4cedb' : '#141c28'}
                  metalness={0.32}
                  roughness={0.55}
                />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
                <planeGeometry args={[0.98, 0.34]} />
                <meshStandardMaterial
                  color={isLight ? '#98a6b9' : '#0b1018'}
                  metalness={0.22}
                  roughness={0.78}
                />
              </mesh>
            </group>
          ))}
        </group>
      ) : (
        /* Showroom: Soft-Chamfered Monolithic Gallery Plinth Flush on Floor */
        <>
          <RoundedBox
            args={[Math.max(rowSpan + 2.2, 6.4), 0.08, 2.08]}
            radius={0.024}
            smoothness={4}
            position={[0, 0.04, 0]}
            receiveShadow
          >
            <meshStandardMaterial color="#1a202d" metalness={0.18} roughness={0.5} />
          </RoundedBox>
          <RoundedBox
            args={[Math.max(rowSpan + 2.0, 6.2), 0.01, 0.014]}
            radius={0.004}
            smoothness={2}
            position={[0, 0.078, 1.032]}
          >
            <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.75} roughness={0.35} />
          </RoundedBox>
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
          5. CLEAN FOREGROUND ACCENT FURNITURE (Zero clunky flanking rack boxes!)
         ===================================================================== */}
      {isColdAisle && (
        <TactileKvmConsole
          position={[leftDeskX, 0, 2.45]}
          rotationY={0.5}
          nodes={nodes}
          accent="#60a5fa"
        />
      )}

      {isLight && (
        <CleanroomLabDesk
          position={[rightDeskX, 0, 2.35]}
          nodes={nodes}
        />
      )}

      {isBunker && (
        <ObsidianOpsConsole
          position={[leftDeskX, 0, 2.45]}
          nodes={nodes}
        />
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
