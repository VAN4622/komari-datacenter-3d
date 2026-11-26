import {
  WORLD_COUNTRY_DOTS,
  WORLD_DOT_STEP,
  WORLD_DOT_X0,
  WORLD_DOT_Y0,
} from '@/data/worldMapDots';
import type { DataLinkArc, RegionCluster } from '@/lib/geoRegions';

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface GlobeLandGroup {
  iso: string;
  /** Packed [x0, y0, z0, x1, y1, z1, ...] unit-sphere coordinates */
  coords: Float32Array;
  count: number;
}

export interface GlobeArcGeometry {
  arc: DataLinkArc;
  /** Packed [x0, y0, z0, ...] elevated 3D points (radius >= 1) */
  coords: Float32Array;
  segments: number;
  phaseOffset: number;
}

export interface GlobePlacardAnchor {
  code: string;
  pos: Vec3;
  /** Unit tangent direction vector on the sphere pointing away from nearby clusters */
  tangentDir: Vec3;
  /** Preferred stem length in CSS pixels at reference radius */
  stemLen: number;
  /** Deterministic animation phase delay in seconds */
  pulseOffsetSec: number;
}

/**
 * Converts geographic (lat, lon) in degrees to a unit vector on the Earth sphere.
 * Coordinate convention:
 *   +Y = North Pole
 *   +Z = (0°N, 0°E) Prime Meridian facing viewer at viewLon=0, viewLat=0
 *   +X = (0°N, 90°E) East
 */
export function latLonToVec3(latDeg: number, lonDeg: number): Vec3 {
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);
  return {
    x: cosLat * Math.sin(lonRad),
    y: Math.sin(latRad),
    z: cosLat * Math.cos(lonRad),
  };
}

/**
 * Exact analytical inverse of projectLatLon() in src/lib/geoRegions.ts
 * so every land dot in WORLD_COUNTRY_DOTS maps back to its exact sphere position.
 */
function unprojectMapXYToLatLon(mapX: number, mapY: number): { lat: number; lon: number } {
  const yNorm = (mapY - 20) / 440;
  const lat = 78 - yNorm * 134;
  const latFrac = lat / 90;
  const xScale = 1 - 0.16 * latFrac * latFrac - 0.12 * Math.pow(latFrac, 4);
  const deltaLon = ((mapX - 500) / (480 * xScale)) * 180;
  let lon = deltaLon + 10;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

function buildLandGroups(): GlobeLandGroup[] {
  const groups: GlobeLandGroup[] = [];
  for (const [iso, packedList] of Object.entries(WORLD_COUNTRY_DOTS)) {
    const count = packedList.length;
    const coords = new Float32Array(count * 3);
    for (let idx = 0; idx < count; idx++) {
      const packed = packedList[idx];
      const col = packed >> 7;
      const row = packed & 127;
      const mapX = WORLD_DOT_X0 + col * WORLD_DOT_STEP;
      const mapY = WORLD_DOT_Y0 + row * WORLD_DOT_STEP;
      const { lat, lon } = unprojectMapXYToLatLon(mapX, mapY);
      const vec = latLonToVec3(lat, lon);
      const offset = idx * 3;
      coords[offset] = vec.x;
      coords[offset + 1] = vec.y;
      coords[offset + 2] = vec.z;
    }
    groups.push({ iso, coords, count });
  }
  return groups;
}

export const GLOBE_LAND_GROUPS: readonly GlobeLandGroup[] = buildLandGroups();

/**
 * Rotates a 3D point so that geographic (viewLat, viewLon) faces +Z.
 */
export function rotateForView(
  px: number,
  py: number,
  pz: number,
  cosLon: number,
  sinLon: number,
  cosLat: number,
  sinLat: number,
): Vec3 {
  const x1 = px * cosLon - pz * sinLon;
  const z1 = px * sinLon + pz * cosLon;
  const y2 = py * cosLat - z1 * sinLat;
  const z2 = py * sinLat + z1 * cosLat;
  return { x: x1, y: y2, z: z2 };
}

export function wrapLonDeg(lonDeg: number): number {
  let wrapped = ((lonDeg + 180) % 360 + 360) % 360 - 180;
  if (wrapped === -180) wrapped = 180;
  return wrapped;
}

export function shortestLonDeltaDeg(fromLon: number, toLon: number): number {
  let diff = ((toLon - fromLon + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

function stableHashUnit(text: string): number {
  let hash = 17;
  for (let idx = 0; idx < text.length; idx++) {
    hash = (hash * 31 + text.charCodeAt(idx)) % 997;
  }
  return hash / 997;
}

/**
 * Pre-computes elevated 3D great-circle splines between connected regions.
 */
export function buildGlobeArcGeometries(arcs: DataLinkArc[]): GlobeArcGeometry[] {
  const segments = 48;
  return arcs.map((arc) => {
    const start = latLonToVec3(arc.from.hub.lat, arc.from.hub.lon);
    const end = latLonToVec3(arc.to.hub.lat, arc.to.hub.lon);
    const dotVal = Math.max(-1, Math.min(1, start.x * end.x + start.y * end.y + start.z * end.z));
    const omega = Math.acos(dotVal);
    const sinOmega = Math.sin(omega);
    // Graceful orbital elevation proportional to angular span (subtle, never exaggerated)
    const peakAltitude = 0.045 + Math.min(0.24, omega * 0.135);
    const coords = new Float32Array((segments + 1) * 3);

    for (let step = 0; step <= segments; step++) {
      const ratio = step / segments;
      let ux: number;
      let uy: number;
      let uz: number;
      if (sinOmega < 1e-4) {
        ux = start.x + (end.x - start.x) * ratio;
        uy = start.y + (end.y - start.y) * ratio;
        uz = start.z + (end.z - start.z) * ratio;
        const len = Math.hypot(ux, uy, uz) || 1;
        ux /= len;
        uy /= len;
        uz /= len;
      } else {
        const w0 = Math.sin((1 - ratio) * omega) / sinOmega;
        const w1 = Math.sin(ratio * omega) / sinOmega;
        ux = start.x * w0 + end.x * w1;
        uy = start.y * w0 + end.y * w1;
        uz = start.z * w0 + end.z * w1;
      }

      const radiusScale = 1 + peakAltitude * Math.sin(Math.PI * ratio);
      const offset = step * 3;
      coords[offset] = ux * radiusScale;
      coords[offset + 1] = uy * radiusScale;
      coords[offset + 2] = uz * radiusScale;
    }

    return {
      arc,
      coords,
      segments,
      phaseOffset: stableHashUnit(arc.id),
    };
  });
}

function localTangentBasis(latDeg: number, lonDeg: number): { east: Vec3; north: Vec3 } {
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLon = Math.cos(lonRad);
  const sinLon = Math.sin(lonRad);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);

  return {
    east: { x: cosLon, y: 0, z: -sinLon },
    north: { x: -sinLat * sinLon, y: cosLat, z: -sinLat * cosLon },
  };
}

/**
 * Computes deterministic, static 3D tangent-plane fan-out vectors for every region placard
 * based strictly on cluster geography. Because these directions live on the sphere itself,
 * placards rotate smoothly with the globe and NEVER jump during animations or data ticks.
 */
export function computeGlobePlacardAnchors(
  clusters: RegionCluster[],
): Map<string, GlobePlacardAnchor> {
  const positions = clusters.map((cluster) => ({
    cluster,
    pos: latLonToVec3(cluster.hub.lat, cluster.hub.lon),
    basis: localTangentBasis(cluster.hub.lat, cluster.hub.lon),
  }));

  const neighborThresholdRad = 0.42; // ~24° great-circle radius
  const anchorMap = new Map<string, GlobePlacardAnchor>();

  // First pass: compute raw tangent angles & neighbor counts
  const rawAngles: { east: number; north: number; closeCount: number }[] = [];

  for (let idx = 0; idx < positions.length; idx++) {
    const cur = positions[idx];
    let repEast = 0;
    let repNorth = 0;
    let closeCount = 0;
    let closestAngle = Infinity;

    for (let otherIdx = 0; otherIdx < positions.length; otherIdx++) {
      if (idx === otherIdx) continue;
      const other = positions[otherIdx];
      const dotVal = Math.max(
        -1,
        Math.min(
          1,
          cur.pos.x * other.pos.x + cur.pos.y * other.pos.y + cur.pos.z * other.pos.z,
        ),
      );
      const angle = Math.acos(dotVal);
      if (angle > neighborThresholdRad) continue;

      closeCount += 1;
      if (angle < closestAngle) closestAngle = angle;

      // Vector pointing from neighbor toward current cluster projected onto local tangent plane
      const diffX = cur.pos.x - other.pos.x;
      const diffY = cur.pos.y - other.pos.y;
      const diffZ = cur.pos.z - other.pos.z;
      const projEast = diffX * cur.basis.east.x + diffY * cur.basis.east.y + diffZ * cur.basis.east.z;
      const projNorth =
        diffX * cur.basis.north.x + diffY * cur.basis.north.y + diffZ * cur.basis.north.z;
      const projLen = Math.hypot(projEast, projNorth) || 1;
      const weight = 1 / Math.pow(Math.max(0.055, angle), 1.65);
      repEast += (projEast / projLen) * weight;
      repNorth += (projNorth / projLen) * weight;
    }

    if (closeCount === 0) {
      rawAngles.push({ east: 0, north: 1, closeCount: 0 });
      continue;
    }

    const mag = Math.hypot(repEast, repNorth);
    if (mag < 0.35) {
      // Interior node sandwiched nearly symmetrically between two neighbors: fan cleanly northward
      rawAngles.push({ east: 0.08, north: 0.996, closeCount });
    } else {
      const normEast = repEast / mag;
      const normNorth = repNorth / mag;
      rawAngles.push({
        east: normEast,
        north: normNorth,
        closeCount,
      });
    }
  }

  // Second pass: push apart any two very close neighbors whose fan-out angles point too similarly
  const angles = rawAngles.map((item) => Math.atan2(item.north, item.east));
  for (let pass = 0; pass < 4; pass++) {
    for (let idx = 0; idx < positions.length; idx++) {
      for (let otherIdx = idx + 1; otherIdx < positions.length; otherIdx++) {
        const a = positions[idx];
        const b = positions[otherIdx];
        const dotVal = Math.max(
          -1,
          Math.min(1, a.pos.x * b.pos.x + a.pos.y * b.pos.y + a.pos.z * b.pos.z),
        );
        const distAngle = Math.acos(dotVal);
        if (distAngle > 0.24) continue;

        let diff = angles[idx] - angles[otherIdx];
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const minSpread = 1.05; // ~60° minimum separation in fan-out direction
        if (Math.abs(diff) < minSpread) {
          const push = (minSpread - Math.abs(diff)) * 0.42;
          const sign = diff >= 0 ? 1 : -1;
          angles[idx] += sign * push;
          angles[otherIdx] -= sign * push;
        }
      }
    }
  }

  for (let idx = 0; idx < positions.length; idx++) {
    const cur = positions[idx];
    const closeCount = rawAngles[idx].closeCount;
    const dirEast = Math.cos(angles[idx]);
    const dirNorth = Math.sin(angles[idx]);

    const tx = cur.basis.east.x * dirEast + cur.basis.north.x * dirNorth;
    const ty = cur.basis.east.y * dirEast + cur.basis.north.y * dirNorth;
    const tz = cur.basis.east.z * dirEast + cur.basis.north.z * dirNorth;
    const tLen = Math.hypot(tx, ty, tz) || 1;

    const stemLen =
      closeCount === 0 ? 10 : closeCount === 1 ? 14 : Math.min(22, 14 + closeCount * 3);

    anchorMap.set(cur.cluster.hub.code, {
      code: cur.cluster.hub.code,
      pos: cur.pos,
      tangentDir: { x: tx / tLen, y: ty / tLen, z: tz / tLen },
      stemLen,
      pulseOffsetSec: stableHashUnit(cur.cluster.hub.code) * 3.4,
    });
  }

  return anchorMap;
}

/**
 * Picks an elegant initial camera orientation facing the fleet's weighted geographic center.
 */
export function computeInitialGlobeView(
  clusters: RegionCluster[],
  focusedCode?: string | null,
): { lat: number; lon: number } {
  if (focusedCode) {
    const hit = clusters.find((c) => c.hub.code === focusedCode);
    if (hit) {
      return {
        lat: Math.max(-52, Math.min(58, hit.hub.lat * 0.85)),
        lon: hit.hub.lon,
      };
    }
  }

  if (clusters.length === 0) {
    return { lat: 24, lon: 105 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (const cluster of clusters) {
    const weight = Math.max(1, cluster.nodes.length);
    const vec = latLonToVec3(cluster.hub.lat, cluster.hub.lon);
    sumX += vec.x * weight;
    sumY += vec.y * weight;
    sumZ += vec.z * weight;
  }

  const totalLen = Math.hypot(sumX, sumY, sumZ);
  if (totalLen < 1e-4) {
    return { lat: 24, lon: 105 };
  }

  const meanLat = Math.asin(Math.max(-1, Math.min(1, sumY / totalLen))) * RAD_TO_DEG;
  const meanLon = Math.atan2(sumX, sumZ) * RAD_TO_DEG;

  return {
    lat: Math.max(-24, Math.min(26, meanLat * 0.56)),
    lon: wrapLonDeg(meanLon),
  };
}
