'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { DragControls } from 'framer-motion';
import { FirstPersonControls, GizmoHelper, OrbitControls, useHelper } from '@react-three/drei';
import { useRef } from 'react';
import { Mesh, SpotLight, SpotLightHelper } from 'three';
import { useControls } from 'leva';

function LightHelper() {
  const light = useRef<any>(null)
  const {angle, intensity, penumbra} = useControls({
    angle: Math.PI / 8,
    intensity: 80,
    penumbra: {
      value: 0
    }
  })
  useHelper(light, SpotLightHelper, 'orange')
  return (
    <spotLight ref={light} angle={angle} penumbra={penumbra} intensity={intensity} color={0xffea00} position={[2, 2, 5]}></spotLight>
  )
}

function AnimateBox() {
  const boxRef = useRef<Mesh>(null);
  const { speed, color } = useControls({
    color: '#0x00bfff',
    speed: {
      value: 0.005,
      min: 0.0,
      max: 0.08,
      speed: 0.001
    }
  })
  useFrame(() => {
    boxRef.current!.rotation.z += speed;
    boxRef.current!.rotation.y += speed;
    boxRef.current!.rotation.x += speed;
  })

  return (
    <mesh ref={boxRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export default function Scene() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas>
        <gridHelper args={[20, 20]} />
        <axesHelper args={[10]} />
        <AnimateBox />
        <OrbitControls />
        <LightHelper />
      </Canvas>
    </div>
  );
}