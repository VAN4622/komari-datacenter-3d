import { useEffect, useMemo } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
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

// Exact material palette matched to original hall.css cabinet themes
const THEME_PALETTES: Record<
  CabinetTheme,
  {
    shell: string;
    pillar: string;
    roof: string;
    sideBase: string;
    sideSlot: string;
    metalness: number;
    roughness: number;
    isLight: boolean;
  }
> = {
  obsidian: {
    shell: '#1d2129',
    pillar: '#262b35',
    roof: '#222730',
    sideBase: '#181c24',
    sideSlot: '#0a0d12',
    metalness: 0.48,
    roughness: 0.44,
    isLight: false,
  },
  titanium: {
    shell: '#555c68',
    pillar: '#6b7280',
    roof: '#5d6472',
    sideBase: '#4c535f',
    sideSlot: '#1e232c',
    metalness: 0.52,
    roughness: 0.38,
    isLight: false,
  },
  silver: {
    shell: '#cfd5df',
    pillar: '#dde2ea',
    roof: '#d5dbe5',
    sideBase: '#c6cdd8',
    sideSlot: '#647080',
    metalness: 0.44,
    roughness: 0.34,
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
    atmosphere === 'obsidian-noc' ? '#f97316' : atmosphere === 'cleanroom' ? '#0284c7' : '#38bdf8';

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

  const activeSockets = Math.min(6, mountedNodes.filter((n) => n.online).length);
  const hasOffline = mountedNodes.some((n) => !n.online);
  const hasHot = mountedNodes.some((n) => n.online && n.cpu >= 80);

  const beaconColor = hasHot
    ? '#f97316'
    : hasOffline
      ? '#eab308'
      : active
        ? sceneAccent
        : '#22c55e';

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
  const roofH = 0.09;
  const pillarW = 0.064;
  const innerW = rackWidth - pillarW * 2;
  const bayHeight = RACK_H - plinthH - roofH - headerH;
  const bayTopY = RACK_H - roofH - headerH - 0.02;
  const frontZ = RACK_D / 2;

  // Unit front face sits cleanly at frontZ - 0.012 (recessed 12mm behind front bezel face,
  // strictly in front of the cavity backplane at -frontZ + 0.08 so units are 100% visible at rest).
  const unitFrontZ = frontZ - 0.012;
  const unitChassisDepth = RACK_D - 0.16;

  // Compute stacked unit vertical centers from top of bay downward
  const unitLayouts = useMemo(() => {
    let cursorY = bayTopY;
    return rack.items.map((item) => {
      const uCount = getUnitHeightU(item, nodesMap, nodeStyles);
      const h = uCount * UNIT_H;
      const yCenter = cursorY - h / 2;
      cursorY -= h + 0.005;
      return { item, h, yCenter };
    });
  }, [rack.items, nodesMap, nodeStyles, bayTopY]);

  const handleRackClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectRack(rack.id);
  };

  return (
    <group position={[positionX, 0, 0]} onClick={handleRackClick}>
      {/* Grounded Steel Plinth Base (flush on y = 0) */}
      <mesh position={[0, plinthH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[rackWidth + 0.016, plinthH, RACK_D + 0.016]} />
        <meshStandardMaterial color="#12161e" metalness={0.45} roughness={0.62} />
      </mesh>

      {/* Subtle Active Indicator Hairline on Plinth Front */}
      {active && (
        <mesh position={[0, plinthH - 0.014, frontZ + 0.01]}>
          <boxGeometry args={[rackWidth - 0.12, 0.01, 0.008]} />
          <meshStandardMaterial
            color={sceneAccent}
            emissive={sceneAccent}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Quiet Architectural Bay Floor Label directly in front of cabinet */}
      <mesh position={[0, 0.004, frontZ + 0.24]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rackWidth * 0.88, 0.13]} />
        <meshBasicMaterial map={bayFloorTex} transparent opacity={0.92} depthWrite={false} />
      </mesh>

      {/* Left & Right Front Structural Pillars */}
      <mesh position={[-rackWidth / 2 + pillarW / 2, plinthH + (RACK_H - plinthH - roofH) / 2, frontZ - 0.036]} castShadow receiveShadow>
        <boxGeometry args={[pillarW, RACK_H - plinthH - roofH, 0.072]} />
        <meshStandardMaterial color={palette.pillar} metalness={palette.metalness} roughness={palette.roughness} />
      </mesh>
      <mesh position={[rackWidth / 2 - pillarW / 2, plinthH + (RACK_H - plinthH - roofH) / 2, frontZ - 0.036]} castShadow receiveShadow>
        <boxGeometry args={[pillarW, RACK_H - plinthH - roofH, 0.072]} />
        <meshStandardMaterial color={palette.pillar} metalness={palette.metalness} roughness={palette.roughness} />
      </mesh>

      {/* Left & Right Perforated Side Panels */}
      <mesh position={[-rackWidth / 2 + 0.018, plinthH + (RACK_H - plinthH - roofH) / 2, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.036, RACK_H - plinthH - roofH, RACK_D - 0.04]} />
        <meshStandardMaterial
          map={sideTex}
          metalness={palette.metalness * 0.85}
          roughness={palette.roughness + 0.08}
        />
      </mesh>
      <mesh position={[rackWidth / 2 - 0.018, plinthH + (RACK_H - plinthH - roofH) / 2, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.036, RACK_H - plinthH - roofH, RACK_D - 0.04]} />
        <meshStandardMaterial
          map={sideTex}
          metalness={palette.metalness * 0.85}
          roughness={palette.roughness + 0.08}
        />
      </mesh>

      {/* Solid Rear Cabinet Enclosure Wall */}
      <mesh position={[0, plinthH + (RACK_H - plinthH - roofH) / 2, -frontZ + 0.024]} castShadow receiveShadow>
        <boxGeometry args={[rackWidth - 0.02, RACK_H - plinthH - roofH, 0.048]} />
        <meshStandardMaterial color={palette.shell} metalness={0.48} roughness={0.54} />
      </mesh>

      {/* Deep Dark Recessed Cavity Backplane (Placed at rear of bay, NEVER occluding units!) */}
      <mesh position={[0, plinthH + bayHeight / 2, -frontZ + 0.07]}>
        <boxGeometry args={[innerW - 0.008, bayHeight, 0.04]} />
        <meshStandardMaterial color="#090c12" metalness={0.2} roughness={0.88} />
      </mesh>

      {/* Inner Vertical EIA-310D Mounting Rails (Flush to inner edges of front pillars) */}
      <mesh position={[-innerW / 2 + 0.007, plinthH + bayHeight / 2, frontZ - 0.032]}>
        <boxGeometry args={[0.014, bayHeight - 0.02, 0.018]} />
        <meshStandardMaterial color={palette.isLight ? '#8c96a6' : '#556070'} metalness={0.68} roughness={0.34} />
      </mesh>
      <mesh position={[innerW / 2 - 0.007, plinthH + bayHeight / 2, frontZ - 0.032]}>
        <boxGeometry args={[0.014, bayHeight - 0.02, 0.018]} />
        <meshStandardMaterial color={palette.isLight ? '#8c96a6' : '#556070'} metalness={0.68} roughness={0.34} />
      </mesh>

      {/* Top Cabinet Header Bar + Crisp Hardware Plaque (Matches original .cab3d-header) */}
      <mesh position={[0, RACK_H - roofH - headerH / 2, frontZ - 0.055]} castShadow receiveShadow>
        <boxGeometry args={[innerW + 0.008, headerH, 0.11]} />
        <meshStandardMaterial color={palette.pillar} metalness={palette.metalness} roughness={palette.roughness} />
      </mesh>
      <mesh position={[0, RACK_H - roofH - headerH / 2, frontZ + 0.002]}>
        <planeGeometry args={[innerW - 0.004, headerH - 0.006]} />
        <meshStandardMaterial map={headerTex} metalness={0.18} roughness={0.46} />
      </mesh>

      {/* Extruded Solid Roof Enclosure */}
      <mesh position={[0, RACK_H - roofH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[rackWidth + 0.014, roofH, RACK_D + 0.014]} />
        <meshStandardMaterial color={palette.roof} metalness={palette.metalness} roughness={palette.roughness} />
      </mesh>

      {/* Subtle Roof Front Status Trim */}
      <mesh position={[0, RACK_H - 0.022, frontZ + 0.009]}>
        <boxGeometry args={[rackWidth - 0.14, 0.014, 0.008]} />
        <meshStandardMaterial
          color={beaconColor}
          emissive={beaconColor}
          emissiveIntensity={active ? 1.5 : 0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Flush Roof Exhaust Fan Grilles (Cleanly seated on top lid, zero floating parts) */}
      {[-0.24, 0.24].map((fx, i) => (
        <group key={i} position={[fx, RACK_H + 0.003, 0.02]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.13, 0.175, 24]} />
            <meshStandardMaterial color={palette.isLight ? '#94a3b8' : '#334155'} metalness={0.65} roughness={0.34} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
            <circleGeometry args={[0.13, 24]} />
            <meshStandardMaterial color="#0b0f17" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Mounted Server Units, PDUs & Blanks */}
      {unitLayouts.map(({ item, h, yCenter }) => {
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
