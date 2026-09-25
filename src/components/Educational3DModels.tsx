"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Float, Environment } from "@react-three/drei";
import { useRef } from "react";

// Simple 3D shapes representing educational devices
function Laptop({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh position={position} rotation={rotation}>
        {/* Laptop base */}
        <boxGeometry args={[2, 0.1, 1.5]} />
        <meshStandardMaterial color="#4a5568" metalness={0.8} roughness={0.2} />
        
        {/* Laptop screen */}
        <mesh position={[0, 0.5, -0.6]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[1.8, 1.2, 0.05]} />
          <meshStandardMaterial color="#1a202c" metalness={0.9} roughness={0.1} />
          
          {/* Screen glow */}
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[1.6, 1]} />
            <meshBasicMaterial color="#10b981" transparent opacity={0.3} />
          </mesh>
        </mesh>
        
        {/* Keyboard */}
        <mesh position={[0, 0.06, 0.3]}>
          <boxGeometry args={[1.6, 0.02, 0.8]} />
          <meshStandardMaterial color="#2d3748" metalness={0.6} roughness={0.4} />
        </mesh>
      </mesh>
    </Float>
  );
}

function Tablet({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.3}>
      <mesh position={position} rotation={rotation}>
        {/* Tablet body */}
        <boxGeometry args={[1.2, 0.08, 1.6]} />
        <meshStandardMaterial color="#4a5568" metalness={0.7} roughness={0.3} />
        
        {/* Screen */}
        <mesh position={[0, 0.05, 0]}>
          <planeGeometry args={[1, 1.4]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.4} />
        </mesh>
      </mesh>
    </Float>
  );
}

function Smartphone({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <Float speed={1.8} rotationIntensity={0.4} floatIntensity={0.4}>
      <mesh position={position} rotation={rotation}>
        {/* Phone body */}
        <boxGeometry args={[0.4, 0.7, 0.05]} />
        <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
        
        {/* Screen */}
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[0.35, 0.6]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.4} />
        </mesh>
      </mesh>
    </Float>
  );
}

function Book({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.2}>
      <mesh position={position} rotation={rotation}>
        {/* Book cover */}
        <boxGeometry args={[0.8, 1.2, 0.15]} />
        <meshStandardMaterial color="#8b5cf6" metalness={0.3} roughness={0.7} />
        
        {/* Pages */}
        <mesh position={[0, 0, 0.08]}>
          <boxGeometry args={[0.75, 1.15, 0.1]} />
          <meshStandardMaterial color="#f5f5f4" metalness={0.1} roughness={0.9} />
        </mesh>
      </mesh>
    </Float>
  );
}

function Calculator({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <Float speed={1.6} rotationIntensity={0.3} floatIntensity={0.3}>
      <mesh position={position} rotation={rotation}>
        {/* Calculator body */}
        <boxGeometry args={[0.6, 0.9, 0.15]} />
        <meshStandardMaterial color="#10b981" metalness={0.5} roughness={0.5} />
        
        {/* Screen */}
        <mesh position={[0, 0.3, 0.08]}>
          <planeGeometry args={[0.5, 0.2]} />
          <meshBasicMaterial color="#000" transparent opacity={0.8} />
        </mesh>
      </mesh>
    </Float>
  );
}

export default function Educational3DModels() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <Environment preset="city" />
        
        {/* Educational devices floating in 3D space */}
        <Laptop position={[-3, 2, 0]} rotation={[0.2, 0.3, 0]} />
        <Tablet position={[3, -1, -1]} rotation={[-0.1, -0.2, 0.1]} />
        <Smartphone position={[-2, -2, 1]} rotation={[0.3, 0.1, -0.2]} />
        <Book position={[2, 2, -2]} rotation={[-0.2, 0.4, 0.1]} />
        <Calculator position={[0, -3, 0]} rotation={[0.1, -0.3, 0.2]} />
        
        <Laptop position={[4, 1, 2]} rotation={[-0.3, 0.1, 0.2]} />
        <Tablet position={[-4, 0, -2]} rotation={[0.2, -0.1, -0.3]} />
        <Smartphone position={[1, 3, -1]} rotation={[-0.1, 0.3, 0.1]} />
        
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}