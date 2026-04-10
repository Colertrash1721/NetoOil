'use client'
import React, { useRef } from 'react'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'

// --- Shader material (igual que el tuyo) ---
const WavesMaterial = shaderMaterial(
  {
    uTime: 0,
    uLineCount: 35,
    uAmp: 0.12,
    uFreqX: 6.0,
    uFreqY: 2.5,
    uSpeed: 0.6,
    uWidth: 0.06,
    uBG: new THREE.Color('#1FB6FF'),
    uColA: new THREE.Color('#999999'),
    uColB: new THREE.Color('#999999'),
    uGlow: 1.2
  },
  /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,
  /* glsl */`
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uLineCount;
  uniform float uAmp;
  uniform float uFreqX;
  uniform float uFreqY;
  uniform float uSpeed;
  uniform float uWidth;
  uniform vec3  uBG;
  uniform vec3  uColA;
  uniform vec3  uColB;
  uniform float uGlow;

  float sstep(float a, float b, float x) {
    return smoothstep(a, b, x);
  }

  void main(){
    vec2 uv = vUv;
    float x = (uv.x - 0.5);
    float y = (uv.y - 0.5);

    float t = uTime * uSpeed;
    float wave =
        sin( (x * uFreqX + t) + 0.6 * sin((y * (uFreqY*0.8)) - t * 0.7) ) * uAmp
      + 0.5 * sin( (x * (uFreqX*0.5) - t*1.3) + (y * (uFreqY*1.7)) ) * (uAmp*0.6);

    float bands = fract((y + wave) * uLineCount + 0.5);

    float distToCenter = abs(bands - 0.5);
    float line = sstep(0.5, 0.5 - uWidth, 0.5 - distToCenter);

    float vign = sstep(0.0, 0.5, 1.0 - length(vec2(x*1.2, y*1.2)));

    float dx = dFdx(wave);
    float curvature = clamp(1.0 - abs(dx) * 8.0, 0.0, 1.0);

    vec3 lineColor = mix(uColA, uColB, curvature * uGlow);
    vec3 col = mix(uBG, lineColor, line * vign);

    gl_FragColor = vec4(col, 1.0);
  }`
)

extend({ WavesMaterial })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      wavesMaterial: any
    }
  }
}

interface WavesMaterialImpl {
  uTime: number
}

function WavesPlane() {
  const matRef = useRef<WavesMaterialImpl & THREE.ShaderMaterial>(null!)

  useFrame((_, dt) => {
    if (matRef.current) {
      matRef.current.uTime += dt
      // si usas shaderMaterial, uniforms.uTime ya existe:
      // @ts-ignore
      matRef.current.uniforms.uTime.value = matRef.current.uTime
    }
  })

  return (
    <mesh scale={[2, 1.5, 0.5]}>
      <planeGeometry args={[2, 3.56, 1, 1]} />
      <wavesMaterial ref={matRef} />
    </mesh>
  )
}

export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-black">
      <Canvas
        className="w-full h-full"
        camera={{ position: [0, 0, 2.5], fov: 40 }}
        gl={{ antialias: false }}
      >
        <color attach="background" args={['#fff']} />
        <WavesPlane />

        <EffectComposer>
          <Bloom
            mipmapBlur
            intensity={1.8}
            luminanceThreshold={0.12}
            luminanceSmoothing={0.25}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}