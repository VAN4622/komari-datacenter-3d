import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {
  estimateRackWatts,
  getEffectiveStyle,
  getUnitHeightU,
} from '@/data/fleet';
import {
  createBayFloorTagTexture,
  createCabinetHeaderTexture,
  createPerforatedSideTexture,
} from '@/lib/sceneTextures';
import { RackUnitMesh, type HoveredUnitInfo } from '@/components/three/RackUnitMesh';
import type {
  CabinetTheme,
  NodeInfo,
  NodeStyleOverride,
  RackCabinetData,
  RoomAtmosphere,
} from '@/types/rack';

export const RACK_H = 2.68;
export const RACK_D = 1.08;
export const UNIT_H = 0.122;

// Shared swept fan blade geometry for cabinet roof exhaust impellers
let sharedRoofBladeGeo: THREE.ShapeGeometry | null = null;
function getRoofBladeGeometry(): THREE.ShapeGeometry {
  if (sharedRoofBladeGeo) return sharedRoofBladeGeo;
  const s = new THREE.Shape();
  s.moveTo(0.018, 0);
  s.bezierCurveTo(0.035, 0.06, 0.095, 0.098, 0.118, 0.056);
  s.bezierCurveTo(0.114, 0.018, 0.068, -0.004, 0.018, 0);
  s.closePath();
  sharedRoofBladeGeo = new THREE.ShapeGeometry(s, 10);
  return sharedRoofBladeGeo;
}

function RoofExhaustFan({
  position,
  targetSpeed,
  isLight,
  accentColor,
  phaseOffset,
}: {
  position: [number, number, number];
  targetSpeed: number;
  isLight: boolean;
  accentColor: string;
  phaseOffset: number;
}) {
  const rotorRef = useRef<THREE.Group>(null);
  const velRef = useRef(targetSpeed);
  const bladeGeo = useMemo(() => getRoofBladeGeometry(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    velRef.current = THREE.MathUtils.lerp(velRef.current, targetSpeed, Math.min(1, dt * 3.5));
    if (rotorRef.current && velRef.current > 0.005) {
      rotorRef.current.rotation.y -= velRef.current * dt;
    }
  });

  const frameColor = isLight ? '#9eaab9' : '#3a4454';
  const bladeColor = isLight ? '#64748b' : '#536075';
  const hubColor = isLight ? '#475569' : '#2c3545';
  const grilleColor = isLight ? '#b8c3d1' : '#58657a';

  return (
    <group position={position}>
      {/* Recessed Dark Fan Well */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.132, 32]} />
        <meshStandardMaterial color="#10151e" roughness={0.9} metalness={0.08} />
      </mesh>

      {/* Outer Satin Bezel Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0035, 0]}>
        <ringGeometry args={[0.128, 0.168, 32]} />
        <meshStandardMaterial color={frameColor} metalness={0.28} roughness={0.5} />
      </mesh>

      {/* Spinning 7-Blade Impeller Hub (strictly between well at 0.002 and grille at 0.0145) */}
      <group ref={rotorRef} position={[0, 0.0055, 0]} rotation={[0, phaseOffset, 0]}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 7, 0]}>
            <mesh geometry={bladeGeo} rotation={[-Math.PI / 2 + 0.04, 0, 0]}>
              <meshStandardMaterial
                color={bladeColor}
                metalness={0.32}
                roughness={0.42}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}

        {/* Motor Hub Cap */}
        <mesh position={[0, 0.003, 0]}>
          <cylinderGeometry args={[0.036, 0.039, 0.006, 24]} />
          <meshStandardMaterial color={hubColor} metalness={0.35} roughness={0.44} />
        </mesh>
        {/* Subtle Center Accent Cap Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0065, 0]}>
          <ringGeometry args={[0.014, 0.022, 24]} />
          <meshStandardMaterial
            color={targetSpeed > 0.1 ? accentColor : '#64748b'}
            emissive={targetSpeed > 0.1 ? accentColor : '#000000'}
            emissiveIntensity={targetSpeed > 0.1 ? 0.45 : 0}
            roughness={0.4}
          />
        </mesh>
      </group>

      {/* Static Protective Concentric Wire Grille & Cross Struts */}
      <group position={[0, 0.0145, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.064, 0.069, 32]} />
          <meshStandardMaterial color={grilleColor} metalness={0.35} roughness={0.48} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.101, 0.106, 32]} />
          <meshStandardMaterial color={grilleColor} metalness={0.35} roughness={0.48} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.256, 0.003, 0.005]} />
          <meshStandardMaterial color={grilleColor} metalness={0.35} roughness={0.48} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.005, 0.003, 0.256]} />
          <meshStandardMaterial color={grilleColor} metalness={0.35} roughness={0.48} />
        </mesh>
      </group>
    </group>
  );
}

// Tactile bead-blasted & anodized satin palettes calibrated for fixed 2.5D studio lighting
const THEME_PALETTES: Record<
  CabinetTheme,
  {
    shell: string;
    pillar: string;
    roof: string;
    plinth: string;
    sideBase: string;
    sideSlot: string;
    trimEdge: string;
    metalness: number;
    roughness: number;
    isLight: boolean;
  }
> = {
  obsidian: {
    shell: '#202530',
    pillar: '#2d3443',
    roof: '#262c38',
    plinth: '#161a22',
    sideBase: '#1d222c',
    sideSlot: '#10141c',
    trimEdge: '#475266',
    metalness: 0.34,
    roughness: 0.48,
    isLight: false,
  },
  titanium: {
    shell: '#5d6675',
    pillar: '#768091',
    roof: '#697384',
    plinth: '#383f4d',
    sideBase: '#545d6b',
    sideSlot: '#313844',
    trimEdge: '#97a3b6',
    metalness: 0.42,
    roughness: 0.42,
    isLight: false,
  },
  silver: {
    shell: '#d6dde8',
    pillar: '#e6ebf3',
    roof: '#dde3ed',
    plinth: '#96a1b2',
    sideBase: '#cdd4e0',
    sideSlot: '#8f9bad',
    trimEdge: '#f8fafc',
    metalness: 0.36,
    roughness: 0.38,
    isLight: true,
  },
};

interface RackCabinetMeshProps {
  rack: RackCabinetData;
  rackIndex: number;
  positionX: number;
  rackWidth: number;
  atmosphere: RoomAtmosphere;
  active: boolean;
  nodesMap: Map<string, NodeInfo>;
  nodeStyles: Record<string, NodeStyleOverride>;
  selectedNodeId: string | null;
  uidBlinkingIds: Set<string>;
  showStrip: boolean;
  onSelectRack: (rackId: string) => void;
  onSelectNode: (nodeId: string, rackId: string) => void;
  onHoverUnit: (info: HoveredUnitInfo | null) => void;
}

export function RackCabinetMesh({
  rack,
  rackIndex,
  positionX,
  rackWidth,
  atmosphere,
  active,
  nodesMap,
  nodeStyles,
  selectedNodeId,
  uidBlinkingIds,
  showStrip,
  onSelectRack,
  onSelectNode,
  onHoverUnit,
}: RackCabinetMeshProps) {
  const palette = THEME_PALETTES[rack.theme] ?? THEME_PALETTES.obsidian;
  const bayCode = `BAY 0${rackIndex + 1}`;
  const isLightScene = atmosphere === 'cleanroom';
  const sceneAccent =
    atmosphere === 'obsidian-noc' ? '#fb923c' : atmosphere === 'cleanroom' ? '#0ea5e9' : '#60a5fa';

  const usedU = useMemo(
    () => rack.items.reduce((sum, item) => sum + getUnitHeightU(item, nodesMap, nodeStyles), 0),
    [rack.items, nodesMap, nodeStyles],
  );
  const rackWatts = useMemo(
    () => estimateRackWatts(rack, nodesMap, nodeStyles),
    [rack, nodesMap, nodeStyles],
  );

  const mountedNodes = useMemo(
    () =>
      rack.items
        .filter((it): it is Extract<typeof it, { type: 'node' }> => it.type === 'node')
        .map((it) => nodesMap.get(it.nodeId))
        .filter((n): n is NodeInfo => Boolean(n)),
    [rack.items, nodesMap],
  );

  const onlineNodes = useMemo(() => mountedNodes.filter((n) => n.online), [mountedNodes]);
  const activeSockets = Math.min(6, onlineNodes.length);
  const hasOffline = mountedNodes.some((n) => !n.online);
  const hasHot = onlineNodes.some((n) => n.cpu >= 80);

  // Compute PWM exhaust fan angular velocity (rad/s) from real rack load (CPU + Watts)
  const roofFanSpeed = useMemo(() => {
    if (onlineNodes.length === 0 && rackWatts <= 0) return 0;
    const avgCpu =
      onlineNodes.length > 0
        ? onlineNodes.reduce((sum, n) => sum + Math.max(0, Math.min(100, n.cpu)), 0) / onlineNodes.length
        : 0;
    const loadRatio = Math.min(1, (avgCpu / 100) * 0.72 + Math.min(1, rackWatts / 1200) * 0.28);
    return 2.4 + loadRatio * 11.2;
  }, [onlineNodes, rackWatts]);

  const beaconColor = hasHot
    ? '#fb923c'
    : hasOffline
      ? '#facc15'
      : active
        ? sceneAccent
        : '#34d399';

  const sideTex = useMemo(
    () => createPerforatedSideTexture(palette.sideBase, palette.sideSlot),
    [palette.sideBase, palette.sideSlot],
  );

  const headerTex = useMemo(
    () => createCabinetHeaderTexture(rack.name, usedU, rackWatts, beaconColor, active, rack.theme),
    [rack.name, usedU, rackWatts, beaconColor, active, rack.theme],
  );

  const bayFloorTex = useMemo(
    () => createBayFloorTagTexture(bayCode, rackWatts, isLightScene, active, sceneAccent),
    [bayCode, rackWatts, isLightScene, active, sceneAccent],
  );

  useEffect(() => {
    return () => {
      sideTex.dispose();
    };
  }, [sideTex]);

  useEffect(() => {
    return () => {
      headerTex.dispose();
    };
  }, [headerTex]);

  useEffect(() => {
    return () => {
      bayFloorTex.dispose();
    };
  }, [bayFloorTex]);

  const plinthH = 0.11;
  const headerH = 0.19;
  const roofH = 0.095;
  const pillarW = 0.068;
  const pillarD = 0.082;
  const rearD = 0.056;
  const bodyH = RACK_H - plinthH - roofH;
  const bodyCenterY = plinthH + bodyH / 2;
  const innerW = rackWidth - pillarW * 2;
  const bayHeight = bodyH - headerH;
  const bayTopY = RACK_H - roofH - headerH - 0.02;
  const frontZ = RACK_D / 2;

  // Recessed side panel dimensions: inset 8mm inward from outer pillars/rear wall,
  // spanning cleanly between front pillars and rear wall so ZERO faces are ever coplanar!
  const sideInset = 0.008;
  const sideT = 0.032;
  const sideD = RACK_D - pillarD - rearD + 0.008;
  const sideCenterZ = (-frontZ + rearD + (frontZ - pillarD)) / 2;

  // Unit front face sits cleanly at frontZ - 0.012 (recessed 12mm behind front bezel face,
  // strictly in front of the cavity backplane at -frontZ + 0.07 so units are 100% visible at rest).
  const unitFrontZ = frontZ - 0.012;
  const unitChassisDepth = RACK_D - 0.16;

  // Compute stacked unit vertical centers from top of bay downward (with dedicated under-server status bar space)
  const unitLayouts = useMemo(() => {
    const DESIRED_STRIP_H = 0.136;
    const STRIP_GAP = 0.002;
    const ITEM_GAP = 0.007;

    let rawChassisSum = 0;
    let stripCount = 0;
    const specs = rack.items.map((item) => {
      const uCount = getUnitHeightU(item, nodesMap, nodeStyles);
      const h = uCount * UNIT_H;
      const hasStrip = showStrip && item.type === 'node' && Boolean(nodesMap.get(item.nodeId));
      rawChassisSum += h;
      if (hasStrip) stripCount += 1;
      return { item, h, hasStrip };
    });

    const usableBayH = bayHeight - 0.035;
    const totalGaps = Math.max(0, specs.length - 1) * ITEM_GAP + stripCount * STRIP_GAP;
    let effectiveStripH = DESIRED_STRIP_H;
    if (stripCount > 0 && rawChassisSum + stripCount * DESIRED_STRIP_H + totalGaps > usableBayH) {
      const availForStrips = usableBayH - rawChassisSum - totalGaps;
      effectiveStripH = Math.max(0.068, Math.min(DESIRED_STRIP_H, availForStrips / stripCount));
    }

    let cursorY = bayTopY;
    return specs.map(({ item, h, hasStrip }) => {
      const stripH = hasStrip ? effectiveStripH : 0;
      const yCenter = cursorY - h / 2;
      cursorY -= h + (stripH > 0 ? stripH + STRIP_GAP : 0) + ITEM_GAP;
      return { item, h, stripH, yCenter };
    });
  }, [rack.items, nodesMap, nodeStyles, bayTopY, bayHeight, showStrip]);

  const handleRackClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectRack(rack.id);
  };

  return (
    <group position={[positionX, 0, 0]} onClick={handleRackClick}>
      {/* Machined Stainless Leveling Feet Pads (grounded flush on y = 0) */}
      {[
        [-rackWidth / 2 + 0.09, frontZ - 0.09],
        [rackWidth / 2 - 0.09, frontZ - 0.09],
        [-rackWidth / 2 + 0.09, -frontZ + 0.09],
        [rackWidth / 2 - 0.09, -frontZ + 0.09],
      ].map(([fx, fz], idx) => (
        <mesh key={idx} position={[fx, 0.01, fz]} castShadow receiveShadow>
          <cylinderGeometry args={[0.034, 0.038, 0.02, 16]} />
          <meshStandardMaterial color="#12161e" metalness={0.55} roughness={0.38} />
        </mesh>
      ))}

      {/* Soft-Chamfered Grounded Plinth Base (resting cleanly on leveling feet) */}
      <RoundedBox
        args={[rackWidth + 0.022, plinthH - 0.014, RACK_D + 0.022]}
        radius={0.016}
        smoothness={4}
        position={[0, 0.014 + (plinthH - 0.014) / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.plinth} metalness={0.32} roughness={0.54} />
      </RoundedBox>

      {/* Plinth Front Kick-Plate Intake Vent Recess */}
      <RoundedBox
        args={[rackWidth * 0.72, 0.034, 0.012]}
        radius={0.005}
        smoothness={2}
        position={[0, 0.048, frontZ + 0.009]}
      >
        <meshStandardMaterial color="#0d1118" metalness={0.2} roughness={0.78} />
      </RoundedBox>

      {/* Subtle Soft Active Indicator Pill on Plinth Front */}
      {active && (
        <RoundedBox
          args={[rackWidth * 0.56, 0.012, 0.01]}
          radius={0.004}
          smoothness={2}
          position={[0, plinthH - 0.016, frontZ + 0.013]}
        >
          <meshStandardMaterial
            color={sceneAccent}
            emissive={sceneAccent}
            emissiveIntensity={0.92}
            roughness={0.32}
          />
        </RoundedBox>
      )}

      {/* Quiet Architectural Bay Floor Label directly in front of cabinet */}
      <mesh position={[0, 0.005, frontZ + 0.24]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rackWidth * 0.86, 0.13]} />
        <meshBasicMaterial map={bayFloorTex} transparent opacity={0.86} depthWrite={false} />
      </mesh>

      {/* Left & Right Soft-Chamfered Front Structural Pillars */}
      <RoundedBox
        args={[pillarW, bodyH, pillarD]}
        radius={0.014}
        smoothness={4}
        position={[-rackWidth / 2 + pillarW / 2, bodyCenterY, frontZ - pillarD / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.pillar} metalness={palette.metalness} roughness={palette.roughness} />
      </RoundedBox>
      <RoundedBox
        args={[pillarW, bodyH, pillarD]}
        radius={0.014}
        smoothness={4}
        position={[rackWidth / 2 - pillarW / 2, bodyCenterY, frontZ - pillarD / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.pillar} metalness={palette.metalness} roughness={palette.roughness} />
      </RoundedBox>

      {/* Brushed Anodized Front-Corner Chamfer Accent Strips (catch 2.5D specular rim light) */}
      <mesh position={[-rackWidth / 2 + 0.012, bodyCenterY, frontZ + 0.001]}>
        <boxGeometry args={[0.006, bodyH - 0.06, 0.004]} />
        <meshStandardMaterial color={palette.trimEdge} metalness={0.62} roughness={0.28} />
      </mesh>
      <mesh position={[rackWidth / 2 - 0.012, bodyCenterY, frontZ + 0.001]}>
        <boxGeometry args={[0.006, bodyH - 0.06, 0.004]} />
        <meshStandardMaterial color={palette.trimEdge} metalness={0.62} roughness={0.28} />
      </mesh>

      {/* Left & Right Recessed Satin Matte Side Panels (clean boxGeometry UVs, zero coplanar z-fighting) */}
      <mesh
        position={[-rackWidth / 2 + sideInset + sideT / 2, bodyCenterY, sideCenterZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sideT, bodyH - 0.006, sideD]} />
        <meshStandardMaterial
          map={sideTex}
          metalness={palette.metalness * 0.72}
          roughness={palette.roughness + 0.1}
        />
      </mesh>
      <mesh
        position={[rackWidth / 2 - sideInset - sideT / 2, bodyCenterY, sideCenterZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sideT, bodyH - 0.006, sideD]} />
        <meshStandardMaterial
          map={sideTex}
          metalness={palette.metalness * 0.72}
          roughness={palette.roughness + 0.1}
        />
      </mesh>

      {/* Solid Rear Cabinet Enclosure Wall */}
      <RoundedBox
        args={[rackWidth, bodyH, rearD]}
        radius={0.014}
        smoothness={4}
        position={[0, bodyCenterY, -frontZ + rearD / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.shell} metalness={palette.metalness} roughness={palette.roughness + 0.06} />
      </RoundedBox>

      {/* Deep Dark Recessed Cavity Backplane (Placed at rear of bay, NEVER occluding units!) */}
      <mesh position={[0, plinthH + bayHeight / 2, -frontZ + rearD + 0.025]}>
        <boxGeometry args={[innerW - 0.008, bayHeight, 0.036]} />
        <meshStandardMaterial color="#10141c" metalness={0.12} roughness={0.9} />
      </mesh>

      {/* Inner Vertical EIA-310D Mounting Rails */}
      <mesh position={[-innerW / 2 + 0.007, plinthH + bayHeight / 2, frontZ - 0.034]}>
        <boxGeometry args={[0.014, bayHeight - 0.02, 0.018]} />
        <meshStandardMaterial color={palette.isLight ? '#98a3b4' : '#586475'} metalness={0.34} roughness={0.48} />
      </mesh>
      <mesh position={[innerW / 2 - 0.007, plinthH + bayHeight / 2, frontZ - 0.034]}>
        <boxGeometry args={[0.014, bayHeight - 0.02, 0.018]} />
        <meshStandardMaterial color={palette.isLight ? '#98a3b4' : '#586475'} metalness={0.34} roughness={0.48} />
      </mesh>

      {/* Top Cabinet Header Bar + Crisp Hardware Plaque (recessed cleanly behind front pillars) */}
      <RoundedBox
        args={[innerW - 0.004, headerH, 0.095]}
        radius={0.01}
        smoothness={3}
        position={[0, RACK_H - roofH - headerH / 2, frontZ - 0.052]}
        receiveShadow
      >
        <meshStandardMaterial color={palette.pillar} metalness={palette.metalness} roughness={palette.roughness} />
      </RoundedBox>
      <mesh position={[0, RACK_H - roofH - headerH / 2, frontZ - 0.002]}>
        <planeGeometry args={[innerW - 0.012, headerH - 0.012]} />
        <meshStandardMaterial map={headerTex} metalness={0.1} roughness={0.62} />
      </mesh>

      {/* Soft-Chamfered Extruded Solid Roof Lid */}
      <RoundedBox
        args={[rackWidth + 0.022, roofH, RACK_D + 0.022]}
        radius={0.022}
        smoothness={4}
        position={[0, RACK_H - roofH / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.roof} metalness={palette.metalness} roughness={palette.roughness} />
      </RoundedBox>

      {/* Subtle Soft Diffused Roof Front Status Trim */}
      <RoundedBox
        args={[rackWidth * 0.62, 0.014, 0.01]}
        radius={0.005}
        smoothness={2}
        position={[0, RACK_H - 0.032, frontZ + 0.012]}
      >
        <meshStandardMaterial
          color={beaconColor}
          emissive={beaconColor}
          emissiveIntensity={active ? 0.92 : 0.45}
          roughness={0.38}
        />
      </RoundedBox>

      {/* Dual Load-Driven Spinning Roof Exhaust Fans */}
      <RoofExhaustFan
        position={[-0.23, RACK_H, 0.02]}
        targetSpeed={roofFanSpeed}
        isLight={palette.isLight}
        accentColor={beaconColor}
        phaseOffset={0.2}
      />
      <RoofExhaustFan
        position={[0.23, RACK_H, 0.02]}
        targetSpeed={roofFanSpeed * 0.95}
        isLight={palette.isLight}
        accentColor={beaconColor}
        phaseOffset={1.05}
      />

      {/* Mounted Server Units, PDUs & Blanks */}
      {unitLayouts.map(({ item, h, stripH, yCenter }) => {
        const node = item.type === 'node' ? nodesMap.get(item.nodeId) : undefined;
        const style = node ? getEffectiveStyle(node, nodeStyles) : undefined;
        const isSelected = Boolean(node && selectedNodeId === node.uuid);
        const isUid = Boolean(node && uidBlinkingIds.has(node.uuid));

        return (
          <RackUnitMesh
            key={item.uid}
            item={item}
            node={node}
            style={style}
            rackName={rack.name}
            rackWatts={rackWatts}
            activeSockets={activeSockets}
            unitHeight={h}
            stripHeight={stripH}
            innerWidth={innerW - 0.028}
            chassisDepth={unitChassisDepth}
            yCenter={yCenter}
            frontZ={unitFrontZ}
            selected={isSelected}
            uidBlinking={isUid}
            showStrip={showStrip}
            onSelect={() => {
              if (node) {
                onSelectNode(node.uuid, rack.id);
              } else {
                onSelectRack(rack.id);
              }
            }}
            onHoverChange={onHoverUnit}
          />
        );
      })}
    </group>
  );
}
