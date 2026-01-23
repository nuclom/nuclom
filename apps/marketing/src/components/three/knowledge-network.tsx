'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const GRID_SIZE = 25;
const SPACING = 0.4;
const DOT_SIZE = 0.03;

function DotGrid() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  // Create positions for the dot grid
  const { positions, count } = useMemo(() => {
    const pos: [number, number, number][] = [];
    const halfSize = (GRID_SIZE * SPACING) / 2;

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        pos.push([x * SPACING - halfSize, y * SPACING - halfSize, 0]);
      }
    }

    return { positions: pos, count: pos.length };
  }, []);

  // Initialize instance matrices
  useMemo(() => {
    if (!meshRef.current) return;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    positions.forEach((pos, i) => {
      matrix.setPosition(pos[0], pos[1], pos[2]);
      meshRef.current!.setMatrixAt(i, matrix);

      // Base color - subtle violet
      color.setHSL(0.73, 0.5, 0.4);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [positions]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    timeRef.current += delta * 0.5; // Slow wave speed
    const time = timeRef.current;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const scale = new THREE.Vector3();

    positions.forEach((pos, i) => {
      const [baseX, baseY] = pos;

      // Distance from center for radial wave
      const distFromCenter = Math.sqrt(baseX * baseX + baseY * baseY);

      // Gentle wave animation - moves dots up/down in z
      const waveOffset = Math.sin(distFromCenter * 0.8 - time * 1.2) * 0.15;

      // Subtle scale pulse based on wave position
      const scaleFactor = 1 + Math.sin(distFromCenter * 0.8 - time * 1.2) * 0.3;

      // Update position with wave
      matrix.identity();
      matrix.setPosition(baseX, baseY, waveOffset);
      scale.setScalar(scaleFactor);
      matrix.scale(scale);
      meshRef.current!.setMatrixAt(i, matrix);

      // Color based on wave position - brighter at peaks
      const brightness = 0.35 + Math.sin(distFromCenter * 0.8 - time * 1.2) * 0.15 + 0.1;
      const saturation = 0.6 + Math.sin(distFromCenter * 0.8 - time * 1.2) * 0.2;

      // Gradient from violet center to cyan edges
      const hue = 0.73 + (distFromCenter / 6) * 0.1;
      color.setHSL(hue, saturation, brightness);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <circleGeometry args={[DOT_SIZE, 8]} />
      <meshBasicMaterial transparent opacity={0.8} toneMapped={false} />
    </instancedMesh>
  );
}

function Scene() {
  return (
    <>
      {/* Subtle ambient light */}
      <ambientLight intensity={0.5} />

      {/* Dot grid with wave animation */}
      <group position={[0, 0, -2]} rotation={[0.3, 0, 0]}>
        <DotGrid />
      </group>
    </>
  );
}

export function KnowledgeNetwork() {
  return (
    <div className="absolute inset-0 w-full h-full opacity-60">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <Scene />
      </Canvas>
    </div>
  );
}
