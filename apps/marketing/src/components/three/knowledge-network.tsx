'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const GRID_SIZE = 30;
const SPACING = 0.35;
const DOT_SIZE = 0.025;

// Team "hub" positions - represents distributed team locations
// These create subtle bright clusters suggesting different team nodes
const TEAM_HUBS = [
  { x: -2.5, y: 1.5 }, // "San Francisco"
  { x: 2.2, y: 1.8 }, // "London"
  { x: 0, y: -1.5 }, // "Singapore"
  { x: -1.5, y: -0.5 }, // "New York"
  { x: 2.5, y: -1 }, // "Berlin"
];

function DotGrid() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  // Create positions for the dot grid
  const { positions, count, hubDistances } = useMemo(() => {
    const pos: [number, number, number][] = [];
    const distances: number[][] = [];
    const halfSize = (GRID_SIZE * SPACING) / 2;

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        const px = x * SPACING - halfSize;
        const py = y * SPACING - halfSize;
        pos.push([px, py, 0]);

        // Calculate distance to each hub for connection effects
        const hubDist = TEAM_HUBS.map((hub) => Math.sqrt((px - hub.x) ** 2 + (py - hub.y) ** 2));
        distances.push(hubDist);
      }
    }

    return { positions: pos, count: pos.length, hubDistances: distances };
  }, []);

  // Initialize instance matrices
  useMemo(() => {
    if (!meshRef.current) return;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    positions.forEach((pos, i) => {
      matrix.setPosition(pos[0], pos[1], pos[2]);
      meshRef.current?.setMatrixAt(i, matrix);

      // Base color - subtle violet
      color.setHSL(0.73, 0.5, 0.35);
      meshRef.current?.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [positions]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    timeRef.current += delta * 0.4; // Slow, calm wave speed
    const time = timeRef.current;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const scale = new THREE.Vector3();

    positions.forEach((pos, i) => {
      const [baseX, baseY] = pos;
      const hubDist = hubDistances[i];

      // Find closest hub for this dot
      const minHubDist = Math.min(...hubDist);
      const closestHubIndex = hubDist.indexOf(minHubDist);

      // Distance from center for main radial wave
      const distFromCenter = Math.sqrt(baseX * baseX + baseY * baseY);

      // Main wave animation
      const mainWave = Math.sin(distFromCenter * 0.6 - time * 1.0) * 0.12;

      // Secondary "connection pulse" waves emanating from hubs
      // Creates subtle suggestion of information flowing between teams
      let hubPulse = 0;
      TEAM_HUBS.forEach((_hub, hubIndex) => {
        const dist = hubDist[hubIndex];
        if (dist < 3) {
          // Staggered pulse timing for each hub - suggests async communication
          const pulsePhase = time * 0.8 + hubIndex * 1.2;
          const pulse = Math.sin(dist * 2 - pulsePhase) * Math.max(0, 1 - dist / 3) * 0.08;
          hubPulse += pulse;
        }
      });

      const waveOffset = mainWave + hubPulse;

      // Scale - dots near hubs are slightly larger (team presence)
      let scaleFactor = 1 + Math.sin(distFromCenter * 0.6 - time * 1.0) * 0.25;
      if (minHubDist < 1.2) {
        scaleFactor *= 1 + (1 - minHubDist / 1.2) * 0.5; // Larger dots near hubs
      }

      // Update position with wave
      matrix.identity();
      matrix.setPosition(baseX, baseY, waveOffset);
      scale.setScalar(scaleFactor);
      matrix.scale(scale);
      meshRef.current?.setMatrixAt(i, matrix);

      // Color - brighter near hubs, with hub-specific tint
      let brightness = 0.3 + Math.sin(distFromCenter * 0.6 - time * 1.0) * 0.1;
      let saturation = 0.5;
      let hue = 0.73; // Base violet

      // Dots near hubs glow brighter - suggests active team members
      if (minHubDist < 1.5) {
        const hubInfluence = 1 - minHubDist / 1.5;
        brightness += hubInfluence * 0.25;
        saturation += hubInfluence * 0.2;

        // Subtle color variation per hub - like different team identities
        const hueShifts = [0, 0.05, 0.1, -0.02, 0.08];
        hue += hueShifts[closestHubIndex] * hubInfluence;
      }

      // Subtle gradient from center outward
      hue += (distFromCenter / 8) * 0.08;

      color.setHSL(hue, saturation, brightness);
      meshRef.current?.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <circleGeometry args={[DOT_SIZE, 8]} />
      <meshBasicMaterial transparent opacity={0.85} toneMapped={false} />
    </instancedMesh>
  );
}

// Subtle connection lines between hubs - suggests team communication
function HubConnections() {
  const linesRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const connections = useMemo(() => {
    // Create connections between nearby hubs
    const conns: { from: (typeof TEAM_HUBS)[0]; to: (typeof TEAM_HUBS)[0]; opacity: number }[] = [];

    for (let i = 0; i < TEAM_HUBS.length; i++) {
      for (let j = i + 1; j < TEAM_HUBS.length; j++) {
        const dist = Math.sqrt((TEAM_HUBS[i].x - TEAM_HUBS[j].x) ** 2 + (TEAM_HUBS[i].y - TEAM_HUBS[j].y) ** 2);
        if (dist < 4) {
          conns.push({
            from: TEAM_HUBS[i],
            to: TEAM_HUBS[j],
            opacity: Math.max(0.05, 0.15 - dist * 0.03),
          });
        }
      }
    }
    return conns;
  }, []);

  useFrame((_, delta) => {
    if (!linesRef.current) return;
    timeRef.current += delta;

    // Subtle pulse on connection lines
    linesRef.current.children.forEach((child, i) => {
      if (child instanceof THREE.Line) {
        const material = child.material as THREE.LineBasicMaterial;
        const baseOpacity = connections[i]?.opacity || 0.1;
        material.opacity = baseOpacity + Math.sin(timeRef.current * 0.5 + i) * 0.03;
      }
    });
  });

  return (
    <group ref={linesRef}>
      {connections.map((conn, i) => {
        const points = [new THREE.Vector3(conn.from.x, conn.from.y, 0), new THREE.Vector3(conn.to.x, conn.to.y, 0)];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        return (
          <primitive
            key={i}
            object={
              new THREE.Line(
                geometry,
                new THREE.LineBasicMaterial({
                  color: new THREE.Color().setHSL(0.73, 0.6, 0.5),
                  transparent: true,
                  opacity: conn.opacity,
                }),
              )
            }
          />
        );
      })}
    </group>
  );
}

function Scene() {
  return (
    <>
      {/* Subtle ambient light */}
      <ambientLight intensity={0.5} />

      {/* Dot grid with wave animation */}
      <group position={[0, 0, -2]} rotation={[0.25, 0, 0]}>
        <DotGrid />
        <HubConnections />
      </group>
    </>
  );
}

export function KnowledgeNetwork() {
  return (
    <div className="absolute inset-0 w-full h-full opacity-50">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <Scene />
      </Canvas>
    </div>
  );
}
