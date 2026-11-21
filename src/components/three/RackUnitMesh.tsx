import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  configureCrispTexture,
  paintBlankFaceplate,
  paintPduFaceplate,
  paintServerFaceplate,
} from '@/lib/chassisTexture';
import { FINISHES } from '@/data/fleet';
import type { EffectiveNodeStyle, NodeInfo, RackItem } from '@/types/rack';

export interface HoveredUnitInfo {
  label: string;
  sub: string;
  rackName: string;
}

interface RackUnitMeshProps {
  item: RackItem;
  node?: NodeInfo;
  style?: EffectiveNodeStyle;
  rackName: string;
  rackWatts: number;
  activeSockets: number;
  unitHeight: number;
  innerWidth: number;
  chassisDepth: number;
  yCenter: number;
  frontZ: number;
  selected: boolean;
  uidBlinking: boolean;
  showStrip: boolean;
  onSelect: () => void;
  onHoverChange: (info: HoveredUnitInfo | null) => void;
}

export function RackUnitMesh({
  item,
  node,
  style,
  rackName,
  rackWatts,
  activeSockets,
  unitHeight,
  innerWidth,
  chassisDepth,
  yCenter,
  frontZ,
  selected,
  uidBlinking,
  showStrip,
  onSelect,
  onHoverChange,
}: RackUnitMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Match exact logical pixel height for 1U / 2U / 4U so WebGL textures never mismatch dimensions
  const logicalH =
    item.type === 'node' && style
      ? style.model === 'B3'
        ? 216
        : style.model === 'B2'
          ? 116
          : 58
      : 58;

  const { colorCanvas, emCanvas, colorTex, emTex } = useMemo(() => {
    const c1 = document.createElement('canvas');
    const c2 = document.createElement('canvas');
    c1.width = 1080;
    c1.height = logicalH * 2;
    c2.width = 1080;
    c2.height = logicalH * 2;
    const t1 = configureCrispTexture(new THREE.CanvasTexture(c1));
    const t2 = configureCrispTexture(new THREE.CanvasTexture(c2));
    return { colorCanvas: c1, emCanvas: c2, colorTex: t1, emTex: t2 };
  }, [logicalH]);

  useEffect(() => {
    return () => {
      colorTex.dispose();
      emTex.dispose();
    };
  }, [colorTex, emTex]);

  // Repaint crisp CanvasTexture only when telemetry / paint style / selection changes
  useEffect(() => {
    if (item.type === 'node' && node && style) {
      paintServerFaceplate(colorCanvas, emCanvas, node, style, uidBlinking, selected, showStrip);
      colorTex.needsUpdate = true;
      emTex.needsUpdate = true;
    } else if (item.type === 'pdu') {
      paintPduFaceplate(colorCanvas, emCanvas, item.label, rackWatts, activeSockets);
      colorTex.needsUpdate = true;
      emTex.needsUpdate = true;
    } else {
      paintBlankFaceplate(colorCanvas, item.type === 'blank' ? item.label : undefined);
      const emCtx = emCanvas.getContext('2d');
      if (emCtx) {
        emCtx.fillStyle = '#000000';
        emCtx.fillRect(0, 0, emCanvas.width, emCanvas.height);
      }
      colorTex.needsUpdate = true;
      emTex.needsUpdate = true;
    }
  }, [
    item,
    node?.name,
    node?.online,
    node?.cpu,
    node?.ram,
    node?.disk,
    node?.netDown,
    node?.netUp,
    node?.ping,
    style?.model,
    style?.finish,
    style?.accent,
    style?.oled,
    style?.tag,
    uidBlinking,
    selected,
    showStrip,
    rackWatts,
    activeSockets,
    colorCanvas,
    emCanvas,
    colorTex,
    emTex,
  ]);

  // Smooth 60fps rail pull-out animation on hover / selection
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetSlide = selected ? 0.068 : hovered ? 0.036 : 0;
    const cur = groupRef.current.position.z;
    if (Math.abs(cur - targetSlide) > 0.0005) {
      groupRef.current.position.z = THREE.MathUtils.lerp(cur, targetSlide, Math.min(1, delta * 14));
    } else if (cur !== targetSlide) {
      groupRef.current.position.z = targetSlide;
    }
  });

  const bodyHex = useMemo(() => {
    if (item.type === 'node' && style) {
      return FINISHES[style.finish]?.mid ?? '#2e343d';
    }
    if (item.type === 'pdu') return '#1c2026';
    return '#2b323c';
  }, [item.type, style]);

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
    if (item.type === 'node' && node && style) {
      onHoverChange({
        label: `${node.region} ${node.name}`,
        sub: node.online
          ? `${style.model} · CPU ${Math.round(node.cpu)}% · RAM ${Math.round(node.ram)}% · ${node.ping}ms`
          : `${style.model} · OFFLINE`,
        rackName,
      });
    } else if (item.type === 'pdu') {
      onHoverChange({
        label: item.label || '1U 计量 PDU',
        sub: `${rackWatts}W · ${(rackWatts / 220).toFixed(1)}A`,
        rackName,
      });
    } else {
      onHoverChange({
        label: (item.type === 'blank' && item.label) || '1U 导风盲板',
        sub: '冷热通道气流隔离组件',
        rackName,
      });
    }
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
    onHoverChange(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect();
  };

  const h = unitHeight - 0.006;
  const bodyCenterZ = frontZ - chassisDepth / 2;

  return (
    <group ref={groupRef} position={[0, yCenter, 0]}>
      {/* Volumetric 3D Chassis Enclosure */}
      <mesh
        position={[0, 0, bodyCenterZ]}
        castShadow
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={[innerWidth, h, chassisDepth]} />
        <meshStandardMaterial color={bodyHex} metalness={0.34} roughness={0.48} />
      </mesh>

      {/* Crisp High-DPI Hardware Faceplate (Always flush in front of chassis, zero occlusion) */}
      <mesh
        position={[0, 0, frontZ + 0.004]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <planeGeometry args={[innerWidth, h]} />
        <meshStandardMaterial
          map={colorTex}
          emissive="#ffffff"
          emissiveMap={emTex}
          emissiveIntensity={item.type === 'blank' ? 0 : 1.05}
          metalness={0.14}
          roughness={0.58}
        />
      </mesh>

      {/* Subtle Edge Rim Accent when Selected */}
      {selected && (
        <mesh position={[0, 0, frontZ + 0.006]}>
          <boxGeometry args={[innerWidth + 0.01, h + 0.008, 0.002]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
