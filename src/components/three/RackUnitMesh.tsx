import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {
  configureCrispTexture,
  paintBlankFaceplate,
  paintNodeStatusStrip,
  paintPduFaceplate,
  paintServerFaceplate,
} from '@/lib/chassisTexture';
import { formatNetSpeed } from '@/lib/formatters';
import { ACCENTS, FINISHES } from '@/data/fleet';
import type { EffectiveNodeStyle, NodeInfo, RackItem } from '@/types/rack';

export interface HoveredUnitInfo {
  label: string;
  sub: string;
  rackName: string;
}

// Shared unit-radius curved blade geometry for B3 4U front dual turbines (zero per-instance allocation)
let sharedTurbineBladeGeo: THREE.ShapeGeometry | null = null;
function getTurbineBladeGeometry(): THREE.ShapeGeometry {
  if (sharedTurbineBladeGeo) return sharedTurbineBladeGeo;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0, 0.64, 0.5, 0.78, 0.66, 0.42);
  s.bezierCurveTo(0.38, 0.18, 0.18, 0.1, 0, 0);
  s.closePath();
  sharedTurbineBladeGeo = new THREE.ShapeGeometry(s, 10);
  return sharedTurbineBladeGeo;
}

function B3FrontTurbine({
  position,
  scaleX,
  scaleY,
  accentHex,
  targetSpeed,
  phaseOffset,
}: {
  position: [number, number, number];
  scaleX: number;
  scaleY: number;
  accentHex: string;
  targetSpeed: number;
  phaseOffset: number;
}) {
  const rotorRef = useRef<THREE.Group>(null);
  const velRef = useRef(targetSpeed);
  const bladeGeo = useMemo(() => getTurbineBladeGeometry(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    velRef.current = THREE.MathUtils.lerp(velRef.current, targetSpeed, Math.min(1, dt * 4.5));
    if (rotorRef.current && velRef.current > 0.005) {
      rotorRef.current.rotation.z -= velRef.current * dt;
    }
  });

  return (
    <group position={position} scale={[scaleX, scaleY, 1]}>
      {/* Live Spinning 4-Blade Impeller Rotor */}
      <group ref={rotorRef} rotation={[0, 0, phaseOffset]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            geometry={bladeGeo}
            rotation={[0, 0, (i * Math.PI) / 2]}
          >
            <meshStandardMaterial color="#738399" metalness={0.28} roughness={0.44} />
          </mesh>
        ))}
        {/* Colored Hub Cap */}
        <mesh position={[0, 0, 0.0005]}>
          <circleGeometry args={[0.24, 24]} />
          <meshStandardMaterial color={accentHex} metalness={0.22} roughness={0.46} />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.09, 16]} />
          <meshStandardMaterial color="#101318" roughness={0.8} />
        </mesh>
      </group>

      {/* Static Concentric Protective Wire Rings in front of blades */}
      <mesh position={[0, 0, 0.0016]}>
        <ringGeometry args={[0.68, 0.72, 28]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.26} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.0016]}>
        <ringGeometry args={[0.41, 0.45, 24]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ServerStatusStripMesh({
  node,
  style,
  selected,
  innerWidth,
  stripHeight,
  yOffset,
  frontZ,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  node: NodeInfo;
  style: EffectiveNodeStyle;
  selected: boolean;
  innerWidth: number;
  stripHeight: number;
  yOffset: number;
  frontZ: number;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { stripCanvas, stripEmCanvas, stripTex, stripEmTex } = useMemo(() => {
    const c1 = document.createElement('canvas');
    const c2 = document.createElement('canvas');
    c1.width = 540 * 3;
    c1.height = 70 * 3;
    c2.width = 540 * 3;
    c2.height = 70 * 3;
    const t1 = configureCrispTexture(new THREE.CanvasTexture(c1));
    const t2 = configureCrispTexture(new THREE.CanvasTexture(c2));
    return { stripCanvas: c1, stripEmCanvas: c2, stripTex: t1, stripEmTex: t2 };
  }, []);

  useEffect(() => {
    return () => {
      stripTex.dispose();
      stripEmTex.dispose();
    };
  }, [stripTex, stripEmTex]);

  useEffect(() => {
    paintNodeStatusStrip(stripCanvas, stripEmCanvas, node, style, selected);
    stripTex.needsUpdate = true;
    stripEmTex.needsUpdate = true;
  }, [
    node.name,
    node.region,
    node.online,
    node.cpu,
    node.ram,
    node.disk,
    node.netDown,
    node.netUp,
    node.ping,
    node.uptime,
    node.load1,
    node.tcp,
    node.cpu_cores,
    node.mem_total,
    node.os,
    style.model,
    style.accent,
    style.tag,
    selected,
    stripCanvas,
    stripEmCanvas,
    stripTex,
    stripEmTex,
  ]);

  const boxH = Math.max(0.05, stripHeight - 0.004);
  const faceW = innerWidth - 0.004;
  const faceH = Math.max(0.044, boxH - 0.005);
  const moduleDepth = 0.054;

  return (
    <group position={[0, yOffset, 0]}>
      {/* Slim Chamfered Under-Chassis Telemetry Module Housing */}
      <RoundedBox
        args={[innerWidth, boxH, moduleDepth]}
        radius={0.006}
        smoothness={3}
        position={[0, 0, frontZ - moduleDepth / 2]}
        receiveShadow
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <meshStandardMaterial color="#161c27" metalness={0.22} roughness={0.56} />
      </RoundedBox>

      {/* High-DPI Crisp OLED/IPS Status Bar Display Face */}
      <mesh
        position={[0, 0, frontZ + 0.0042]}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <planeGeometry args={[faceW, faceH]} />
        <meshStandardMaterial
          map={stripTex}
          emissive="#ffffff"
          emissiveMap={stripEmTex}
          emissiveIntensity={0.94}
          metalness={0.06}
          roughness={0.44}
        />
      </mesh>
    </group>
  );
}

interface RackUnitMeshProps {
  item: RackItem;
  node?: NodeInfo;
  style?: EffectiveNodeStyle;
  rackName: string;
  rackWatts: number;
  activeSockets: number;
  unitHeight: number;
  stripHeight: number;
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
  stripHeight,
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
      paintServerFaceplate(colorCanvas, emCanvas, node, style, uidBlinking, selected);
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
    rackWatts,
    activeSockets,
    colorCanvas,
    emCanvas,
    colorTex,
    emTex,
  ]);

  // Smooth 60fps tactile rail pull-out animation on hover / selection
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetSlide = selected ? 0.068 : hovered ? 0.036 : 0;
    const cur = groupRef.current.position.z;
    if (Math.abs(cur - targetSlide) > 0.0005) {
      groupRef.current.position.z = THREE.MathUtils.lerp(cur, targetSlide, Math.min(1, delta * 12));
    } else if (cur !== targetSlide) {
      groupRef.current.position.z = targetSlide;
    }
  });

  const bodyHex = useMemo(() => {
    if (item.type === 'node' && style) {
      return FINISHES[style.finish]?.mid ?? '#2e343d';
    }
    if (item.type === 'pdu') return '#222730';
    return '#313945';
  }, [item.type, style]);

  const accentHex = useMemo(() => {
    if (item.type === 'node' && style) {
      return (ACCENTS.find((a) => a.id === style.accent) ?? ACCENTS[0]).hex;
    }
    return '#60a5fa';
  }, [item.type, style]);

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
    if (item.type === 'node' && node && style) {
      onHoverChange({
        label: `${node.region} ${node.name}`,
        sub: node.online
          ? `${style.model} · CPU ${Math.round(node.cpu)}% · RAM ${Math.round(node.ram)}% · ↓${formatNetSpeed(node.netDown, true)} ↑${formatNetSpeed(node.netUp, true)}${node.ping > 0 ? ` · ${node.ping}ms` : ''}`
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

  const h = unitHeight - 0.007;
  const faceW = innerWidth - 0.004;
  const faceH = h - 0.004;
  const bodyCenterZ = frontZ - chassisDepth / 2;

  const isB3 = item.type === 'node' && Boolean(node) && style?.model === 'B3';
  const turbineSpeed = isB3 && node?.online ? 3.2 + (Math.max(0, Math.min(100, node.cpu)) / 100) * 11.5 : 0;
  const t1X = (404 / 540 - 0.5) * faceW;
  const t2X = (466 / 540 - 0.5) * faceW;
  const tY = (0.5 - 129 / 216) * faceH;
  const tScaleX = (26.2 / 540) * faceW;
  const tScaleY = (26.2 / 216) * faceH;
  const earW = 0.022;
  const earH = Math.max(0.056, h - 0.014);
  const handleH = Math.min(earH * 0.56, 0.095);

  return (
    <group ref={groupRef} position={[0, yCenter, 0]}>
      {/* Soft-Chamfered Volumetric 3D Chassis Enclosure */}
      <RoundedBox
        args={[innerWidth, h, chassisDepth]}
        radius={0.008}
        smoothness={3}
        position={[0, 0, bodyCenterZ]}
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <meshStandardMaterial color={bodyHex} metalness={0.28} roughness={0.5} />
      </RoundedBox>

      {/* Tactile Satin Hardware Faceplate (Flush in front of chassis, zero occlusion) */}
      <mesh
        position={[0, 0, frontZ + 0.004]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <planeGeometry args={[faceW, faceH]} />
        <meshStandardMaterial
          map={colorTex}
          emissive="#ffffff"
          emissiveMap={emTex}
          emissiveIntensity={item.type === 'blank' ? 0 : 0.92}
          metalness={0.14}
          roughness={0.56}
        />
      </mesh>

      {/* Physical 3D Machined Rack-Mount Ears, M6 Captive Screws & Accent Handle Pulls */}
      {item.type === 'node' && node && style && (
        <group>
          {([-1, 1] as const).map((side) => {
            const earX = side * (faceW / 2 - earW / 2 - 0.004);
            const pullX = side * (faceW / 2 - earW - 0.012);
            return (
              <group key={side}>
                {/* Raised Satin Aluminum Rack Ear Flange */}
                <RoundedBox
                  args={[earW, earH, 0.009]}
                  radius={0.0025}
                  smoothness={2}
                  position={[earX, 0, frontZ + 0.0075]}
                  castShadow
                >
                  <meshStandardMaterial color={bodyHex} metalness={0.46} roughness={0.36} />
                </RoundedBox>
                {/* Physical Anodized Handle Pull Bar */}
                <RoundedBox
                  args={[0.007, handleH, 0.015]}
                  radius={0.0025}
                  smoothness={2}
                  position={[pullX, 0, frontZ + 0.012]}
                  castShadow
                >
                  <meshStandardMaterial color={accentHex} metalness={0.38} roughness={0.38} />
                </RoundedBox>
                {/* Top & Bottom Machined Stainless M6 Thumbscrews */}
                <mesh position={[earX, earH * 0.34, frontZ + 0.0135]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.0042, 0.0042, 0.004, 10]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.72} roughness={0.28} />
                </mesh>
                <mesh position={[earX, -earH * 0.34, frontZ + 0.0135]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.0042, 0.0042, 0.004, 10]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.72} roughness={0.28} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* Live Load-Driven Dual Front Turbines for B3 4U Blade Enclosures */}
      {isB3 && (
        <>
          <B3FrontTurbine
            position={[t1X, tY, frontZ + 0.0062]}
            scaleX={tScaleX}
            scaleY={tScaleY}
            accentHex={accentHex}
            targetSpeed={turbineSpeed}
            phaseOffset={0.35}
          />
          <B3FrontTurbine
            position={[t2X, tY, frontZ + 0.0062]}
            scaleX={tScaleX}
            scaleY={tScaleY}
            accentHex={accentHex}
            targetSpeed={turbineSpeed * 0.94}
            phaseOffset={1.15}
          />
        </>
      )}

      {/* Dedicated Under-Server 3D Telemetry Status Bar (mounts directly beneath chassis) */}
      {showStrip && stripHeight > 0 && item.type === 'node' && node && style && (
        <ServerStatusStripMesh
          node={node}
          style={style}
          selected={selected}
          innerWidth={innerWidth}
          stripHeight={stripHeight}
          yOffset={-(unitHeight / 2) - 0.002 - stripHeight / 2}
          frontZ={frontZ}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />
      )}

      {/* Soft Edge Rim Glow when Selected */}
      {selected && (
        <RoundedBox args={[innerWidth + 0.012, h + 0.008, 0.003]} radius={0.004} smoothness={2} position={[0, 0, frontZ + 0.0095]}>
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.14} depthWrite={false} />
        </RoundedBox>
      )}
    </group>
  );
}
