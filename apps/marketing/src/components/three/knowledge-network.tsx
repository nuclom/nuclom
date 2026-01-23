'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars, Trail } from '@react-three/drei';
import * as THREE from 'three';

interface NodeData {
  position: THREE.Vector3;
  connections: number[];
  velocity: THREE.Vector3;
  phase: number;
}

function KnowledgeNode({
  position,
  index,
  totalNodes,
  mousePosition,
}: {
  position: THREE.Vector3;
  index: number;
  totalNodes: number;
  mousePosition: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const basePosition = useRef(position.clone());
  const time = useRef(Math.random() * 100);

  const hue = useMemo(() => (index / totalNodes) * 0.3 + 0.6, [index, totalNodes]);
  const color = useMemo(() => new THREE.Color().setHSL(hue, 0.8, 0.6), [hue]);
  const glowColor = useMemo(() => new THREE.Color().setHSL(hue, 1, 0.7), [hue]);

  useFrame((state, delta) => {
    if (!meshRef.current || !glowRef.current) return;

    time.current += delta;

    // Organic floating motion
    const floatX = Math.sin(time.current * 0.5 + index) * 0.3;
    const floatY = Math.cos(time.current * 0.3 + index * 0.5) * 0.2;
    const floatZ = Math.sin(time.current * 0.4 + index * 0.7) * 0.15;

    // Mouse influence
    const mouseInfluence = 0.5;
    const targetX = basePosition.current.x + floatX + mousePosition.current.x * mouseInfluence;
    const targetY = basePosition.current.y + floatY + mousePosition.current.y * mouseInfluence;
    const targetZ = basePosition.current.z + floatZ;

    // Smooth interpolation
    meshRef.current.position.x += (targetX - meshRef.current.position.x) * 0.02;
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.02;
    meshRef.current.position.z += (targetZ - meshRef.current.position.z) * 0.02;

    glowRef.current.position.copy(meshRef.current.position);

    // Pulsing scale
    const pulse = 1 + Math.sin(time.current * 2 + index) * 0.15;
    meshRef.current.scale.setScalar(pulse);
    glowRef.current.scale.setScalar(pulse * 2.5);
  });

  return (
    <>
      <mesh ref={meshRef} position={position}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh ref={glowRef} position={position}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.15} />
      </mesh>
    </>
  );
}

function ConnectionLines({
  nodes,
  mousePosition,
}: {
  nodes: NodeData[];
  mousePosition: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const positions = useRef<Float32Array>(new Float32Array(nodes.length * nodes.length * 6));
  const colors = useRef<Float32Array>(new Float32Array(nodes.length * nodes.length * 6));

  useFrame((state) => {
    if (!linesRef.current) return;

    const geometry = linesRef.current.geometry;
    const posArray = positions.current;
    const colArray = colors.current;

    let lineIndex = 0;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const distance = nodeA.position.distanceTo(nodeB.position);
        const maxDistance = 2.5;

        if (distance < maxDistance) {
          const opacity = 1 - distance / maxDistance;

          posArray[lineIndex * 6 + 0] = nodeA.position.x;
          posArray[lineIndex * 6 + 1] = nodeA.position.y;
          posArray[lineIndex * 6 + 2] = nodeA.position.z;
          posArray[lineIndex * 6 + 3] = nodeB.position.x;
          posArray[lineIndex * 6 + 4] = nodeB.position.y;
          posArray[lineIndex * 6 + 5] = nodeB.position.z;

          // Gradient colors
          const hueA = (i / nodes.length) * 0.3 + 0.6;
          const hueB = (j / nodes.length) * 0.3 + 0.6;
          const colorA = new THREE.Color().setHSL(hueA, 0.7, 0.5);
          const colorB = new THREE.Color().setHSL(hueB, 0.7, 0.5);

          colArray[lineIndex * 6 + 0] = colorA.r * opacity;
          colArray[lineIndex * 6 + 1] = colorA.g * opacity;
          colArray[lineIndex * 6 + 2] = colorA.b * opacity;
          colArray[lineIndex * 6 + 3] = colorB.r * opacity;
          colArray[lineIndex * 6 + 4] = colorB.g * opacity;
          colArray[lineIndex * 6 + 5] = colorB.b * opacity;

          lineIndex++;
        }
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray.slice(0, lineIndex * 6), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colArray.slice(0, lineIndex * 6), 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  });

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry />
      <lineBasicMaterial vertexColors transparent opacity={0.4} linewidth={1} />
    </lineSegments>
  );
}

function DataStream({ start, end, color }: { start: THREE.Vector3; end: THREE.Vector3; color: string }) {
  const particleRef = useRef<THREE.Mesh>(null);
  const progress = useRef(Math.random());

  useFrame((state, delta) => {
    if (!particleRef.current) return;

    progress.current += delta * 0.5;
    if (progress.current > 1) progress.current = 0;

    const t = progress.current;
    particleRef.current.position.lerpVectors(start, end, t);

    // Pulse effect
    const scale = 0.03 + Math.sin(t * Math.PI) * 0.02;
    particleRef.current.scale.setScalar(scale);
  });

  return (
    <Trail width={0.5} length={8} color={color} attenuation={(t) => t * t}>
      <mesh ref={particleRef}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </Trail>
  );
}

function Scene({ mousePosition }: { mousePosition: React.MutableRefObject<{ x: number; y: number }> }) {
  const { viewport } = useThree();

  // Generate nodes in a spherical distribution
  const nodes = useMemo<NodeData[]>(() => {
    const nodeCount = 40;
    const result: NodeData[] = [];

    for (let i = 0; i < nodeCount; i++) {
      // Fibonacci sphere distribution for even spacing
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const radius = 2.5 + Math.random() * 1.5;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi) - 2;

      result.push({
        position: new THREE.Vector3(x, y, z),
        connections: [],
        velocity: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
      });
    }

    return result;
  }, []);

  // Generate data streams between random nodes
  const streams = useMemo(() => {
    const streamCount = 8;
    const result = [];

    for (let i = 0; i < streamCount; i++) {
      const startNode = nodes[Math.floor(Math.random() * nodes.length)];
      const endNode = nodes[Math.floor(Math.random() * nodes.length)];
      const hue = Math.random() * 0.3 + 0.6;
      const color = new THREE.Color().setHSL(hue, 1, 0.6);

      result.push({
        start: startNode.position,
        end: endNode.position,
        color: `#${color.getHexString()}`,
      });
    }

    return result;
  }, [nodes]);

  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#8b5cf6" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#06b6d4" />

      {/* Background stars */}
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />

      {/* Knowledge nodes */}
      {nodes.map((node, i) => (
        <KnowledgeNode
          key={i}
          position={node.position}
          index={i}
          totalNodes={nodes.length}
          mousePosition={mousePosition}
        />
      ))}

      {/* Connection lines */}
      <ConnectionLines nodes={nodes} mousePosition={mousePosition} />

      {/* Data streams */}
      {streams.map((stream, i) => (
        <DataStream key={i} start={stream.start} end={stream.end} color={stream.color} />
      ))}

      {/* Central glow */}
      <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh position={[0, 0, -2]}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.1} />
        </mesh>
      </Float>
    </>
  );
}

export function KnowledgeNetwork() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    mousePosition.current = { x, y };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full" onMouseMove={handleMouseMove}>
      <Canvas camera={{ position: [0, 0, 6], fov: 60 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
        <Scene mousePosition={mousePosition} />
      </Canvas>
    </div>
  );
}
