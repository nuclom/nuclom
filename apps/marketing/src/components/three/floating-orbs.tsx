'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

const integrations = [
  { name: 'Slack', color: '#E01E5A', icon: 'S', position: [-3, 1.5, 0] },
  { name: 'Notion', color: '#000000', icon: 'N', position: [3, 1.5, 0] },
  { name: 'GitHub', color: '#6e5494', icon: 'G', position: [-2, -1, 1] },
  { name: 'Videos', color: '#FF0000', icon: 'V', position: [2, -1, 1] },
  { name: 'API', color: '#06B6D4', icon: 'A', position: [0, 2, -1] },
  { name: 'Webhooks', color: '#10B981', icon: 'W', position: [0, -2, 0] },
];

function IntegrationOrb({
  name,
  color,
  icon,
  position,
  index,
}: {
  name: string;
  color: string;
  icon: string;
  position: number[];
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const time = useRef(index * 1.5);

  useFrame((state, delta) => {
    if (!groupRef.current || !glowRef.current) return;

    time.current += delta;

    // Gentle rotation
    groupRef.current.rotation.y = Math.sin(time.current * 0.5) * 0.3;

    // Glow pulse
    const pulse = 0.8 + Math.sin(time.current * 2) * 0.2;
    glowRef.current.scale.setScalar(pulse);
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8} position={position as [number, number, number]}>
      <group ref={groupRef}>
        {/* Glow effect */}
        <mesh ref={glowRef} scale={1.8}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>

        {/* Main orb */}
        <RoundedBox args={[1, 1, 1]} radius={0.2} smoothness={4}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
            roughness={0.1}
            metalness={0.9}
          />
        </RoundedBox>

        {/* Icon text */}
        <Text
          position={[0, 0, 0.55]}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-bold.woff"
        >
          {icon}
        </Text>

        {/* Name label */}
        <Text
          position={[0, -0.9, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-medium.woff"
        >
          {name}
        </Text>
      </group>
    </Float>
  );
}

function CenterHub() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!meshRef.current || !ringsRef.current) return;

    meshRef.current.rotation.y += delta * 0.2;
    ringsRef.current.rotation.z += delta * 0.1;
    ringsRef.current.rotation.x += delta * 0.05;
  });

  return (
    <group>
      {/* Central sphere */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.8, 2]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={0.5}
          roughness={0.1}
          metalness={0.9}
          wireframe
        />
      </mesh>

      {/* Glow */}
      <mesh scale={1.5}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.1} />
      </mesh>

      {/* Orbiting rings */}
      <group ref={ringsRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.02, 16, 100]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
          <torusGeometry args={[1.8, 0.015, 16, 100]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.3} />
        </mesh>
        <mesh rotation={[Math.PI / 4, -Math.PI / 3, 0]}>
          <torusGeometry args={[2.1, 0.01, 16, 100]} />
          <meshBasicMaterial color="#ec4899" transparent opacity={0.2} />
        </mesh>
      </group>

      {/* "Nuclom" text */}
      <Text
        position={[0, 0, 0]}
        fontSize={0.25}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        NUCLOM
      </Text>
    </group>
  );
}

function ConnectionBeam({
  start,
  end,
  color,
  delay,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  delay: number;
}) {
  const particleRef = useRef<THREE.Mesh>(null);
  const progress = useRef(delay);

  useFrame((_, delta) => {
    if (!particleRef.current) return;

    progress.current += delta * 0.3;
    const t = (Math.sin(progress.current) + 1) / 2;

    // Animate particle along the line
    particleRef.current.position.set(
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
      start[2] + (end[2] - start[2]) * t,
    );

    const scale = 0.05 + Math.sin(t * Math.PI) * 0.03;
    particleRef.current.scale.setScalar(scale);
  });

  const lineGeometry = useMemo(() => {
    const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [start, end]);

  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 });
  }, [color]);

  return (
    <>
      <primitive object={new THREE.Line(lineGeometry, lineMaterial)} />
      <mesh ref={particleRef}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-10, -10, 5]} intensity={0.5} color="#8b5cf6" />

      {/* Center hub */}
      <CenterHub />

      {/* Integration orbs */}
      {integrations.map((integration, i) => (
        <IntegrationOrb key={integration.name} {...integration} index={i} />
      ))}

      {/* Connection beams */}
      {integrations.map((integration, i) => (
        <ConnectionBeam
          key={`beam-${integration.name}`}
          start={[0, 0, 0]}
          end={integration.position as [number, number, number]}
          color={integration.color}
          delay={i * 0.5}
        />
      ))}
    </>
  );
}

export function FloatingOrbs() {
  return (
    <div className="w-full h-[600px]">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
        <Scene />
      </Canvas>
    </div>
  );
}
