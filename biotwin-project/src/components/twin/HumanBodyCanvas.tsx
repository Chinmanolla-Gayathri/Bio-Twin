"use client";

import { useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrganId, SimulationState, Gender } from "@/lib/twin-types";
import { ORGAN_HEALTHY_COLOR, ORGAN_DAMAGED_COLOR } from "@/lib/twin-engine";

interface BodyProps {
  state: SimulationState;
  gender: Gender;
  mode: "external" | "internal";
  selectedOrgan: OrganId | null;
  onSelectOrgan: (id: OrganId | null) => void;
}

/* ====== Color helpers ====== */

function skinColor(skinDull: number, fatigue: number) {
  const healthy = new THREE.Color("#f1c5a8");
  const dull = new THREE.Color("#9a8b82");
  return healthy.clone().lerp(dull, Math.max(skinDull, fatigue * 0.6));
}

function organColor(id: OrganId, decay: number) {
  const healthy = new THREE.Color(ORGAN_HEALTHY_COLOR[id]);
  const damaged = new THREE.Color(ORGAN_DAMAGED_COLOR[id]);
  return healthy.clone().lerp(damaged, decay);
}

function organEmissive(id: OrganId, decay: number) {
  const c = organColor(id, decay);
  return c.clone().multiplyScalar(0.15 + decay * 0.5);
}

/* ====== Enhanced Human Body - realistic with gender differences, facial features, muscle structure ====== */

function HumanBody({
  state,
  gender,
  transparent,
}: {
  state: SimulationState;
  gender: Gender;
  transparent: boolean;
}) {
  const group = useRef<THREE.Group>(null!);
  const torsoRef = useRef<THREE.Group>(null!);

  const { fatLevel, fatigue, posture, breathing, skinDull } = state.body;
  const fat = Math.max(0, fatLevel);
  const thin = Math.max(0, -fatLevel);
  const muscleDef = Math.max(0, 1 - fat * 1.5);

  const color = useMemo(() => skinColor(skinDull, fatigue), [skinDull, fatigue]);

  const isFemale = gender === "female";
  const hipWide = isFemale ? 1.18 : 1.0;
  const chestWide = isFemale ? 0.90 : 1.06;
  const waistNarrow = isFemale ? 0.88 : 0.96;
  const shoulderWide = isFemale ? 0.92 : 1.12;
  const torsoScaleX = 1 + fat * 0.55 - thin * 0.18;
  const torsoScaleZ = 1 + fat * 0.45 - thin * 0.15;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.x = posture * 0.18;
      group.current.position.y = -posture * 0.05;
    }
    if (torsoRef.current) {
      const speed = 0.9 + breathing * 1.6;
      const amp = 0.015 + breathing * 0.045;
      torsoRef.current.scale.x = torsoScaleX * (1 + Math.sin(t * speed) * amp);
      torsoRef.current.scale.z = torsoScaleZ * (1 + Math.sin(t * speed) * amp);
    }
  });

  // Enhanced skin with subsurface scattering approximation
  const skinEmissiveColor = useMemo(() => {
    return color.clone().lerp(new THREE.Color("#ff9070"), 0.15).multiplyScalar(0.06);
  }, [color]);

  const skin = (
    <meshStandardMaterial
      color={color}
      roughness={0.45}
      metalness={0.04}
      emissive={skinEmissiveColor}
      emissiveIntensity={1}
      transparent={transparent}
      opacity={transparent ? 0.12 : 1}
      depthWrite={!transparent}
      side={transparent ? THREE.DoubleSide : THREE.FrontSide}
    />
  );

  // Slightly darker skin for muscle shadows - softer blending
  const muscleShadowColor = useMemo(() => {
    const base = skinColor(skinDull, fatigue);
    return base.clone().multiplyScalar(0.86);
  }, [skinDull, fatigue]);

  const muscleShadow = (
    <meshStandardMaterial
      color={muscleShadowColor}
      roughness={0.55}
      metalness={0.04}
      transparent={transparent}
      opacity={transparent ? 0.08 : 0.6}
      depthWrite={!transparent}
    />
  );

  // Lip color
  const lipColor = useMemo(() => {
    const base = skinColor(skinDull, fatigue);
    return isFemale
      ? base.clone().lerp(new THREE.Color("#c4677a"), 0.5)
      : base.clone().lerp(new THREE.Color("#b5836e"), 0.3);
  }, [skinDull, fatigue, isFemale]);

  const lipMat = (
    <meshStandardMaterial
      color={lipColor}
      roughness={0.35}
      metalness={0.02}
      transparent={transparent}
      opacity={transparent ? 0.1 : 1}
    />
  );

  // Eye white - slightly bloodshot when fatigued
  const eyeWhiteColor = useMemo(() => {
    const healthy = new THREE.Color("#f5f5f0");
    const bloodshot = new THREE.Color("#f0e0d8");
    return healthy.clone().lerp(bloodshot, Math.min(0.5, fatigue * 0.8));
  }, [fatigue]);
  const eyeWhiteMat = (
    <meshStandardMaterial
      color={eyeWhiteColor}
      roughness={0.15}
      metalness={0.05}
      transparent={transparent}
      opacity={transparent ? 0.1 : 1}
    />
  );

  // Iris color - dynamic based on fatigue (tired = redder iris), skin health
  const irisColor = useMemo(() => {
    const base = new THREE.Color("#5b8a5e"); // healthy green
    const tired = new THREE.Color("#6b7a5e"); // duller when fatigued
    const stressed = new THREE.Color("#5a6a4e"); // more yellow when stressed
    const blended = base.clone().lerp(tired, fatigue * 0.5).lerp(stressed, (state.body.darkCircles || 0) * 0.3);
    return blended;
  }, [fatigue, state.body.darkCircles]);
  const irisMat = (
    <meshStandardMaterial
      color={irisColor}
      roughness={0.1 + fatigue * 0.15}
      metalness={0.2}
      transparent={transparent}
      opacity={transparent ? 0.1 : 1}
    />
  );

  // Pupil
  const pupilMat = (
    <meshStandardMaterial
      color="#0a0a0a"
      roughness={0.05}
      metalness={0.3}
      transparent={transparent}
      opacity={transparent ? 0.1 : 1}
    />
  );

  // Subtle subsurface inner glow for cheeks/warm areas
  const warmSkinEmissive = useMemo(() => {
    return color.clone().lerp(new THREE.Color("#ff8866"), 0.2).multiplyScalar(0.04);
  }, [color]);

  const warmSkin = (
    <meshStandardMaterial
      color={color}
      roughness={0.42}
      metalness={0.04}
      emissive={warmSkinEmissive}
      emissiveIntensity={1}
      transparent={transparent}
      opacity={transparent ? 0.12 : 1}
      depthWrite={!transparent}
      side={transparent ? THREE.DoubleSide : THREE.FrontSide}
    />
  );

  return (
    <group ref={group} position={[0, -0.2, 0]}>
      {/* ===== HEAD ===== */}
      <group position={[0, 1.95, 0]}>
        {/* Cranium - slightly elongated vertically for realistic shape */}
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.23, 32, 32]} />
          {skin}
        </mesh>

        {/* Temples - slight bulges on sides */}
        {[-1, 1].map((s) => (
          <mesh key={`temple-${s}`} position={[s * 0.18, 0.02, -0.02]} scale={[0.65, 0.75, 0.7]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            {skin}
          </mesh>
        ))}

        {/* Forehead - smoother, more pleasant brow (reduced z-scale to not cover eyes) */}
        <mesh position={[0, 0.09, 0.08]} scale={[1.08, 0.58, 0.48]}>
          <sphereGeometry args={[0.22, 24, 18]} />
          {skin}
        </mesh>

        {/* Occipital bulge (back of head) */}
        <mesh position={[0, -0.02, -0.14]} scale={[0.85, 0.75, 0.55]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          {skin}
        </mesh>
      </group>

      {/* ===== FACE ===== */}
      <group position={[0, 1.95, 0]}>
        {/* Brow ridge - adjusted to sit above eyes, not covering them */}
        <mesh position={[0, 0.01, 0.16]} scale={[1.0, isFemale ? 0.22 : 0.28, 0.30]}>
          <sphereGeometry args={[0.22, 18, 14]} />
          {!isFemale ? muscleShadow : skin}
        </mesh>

        {/* Nose bridge - softer, better proportioned */}
        <mesh position={[0, -0.04, 0.23]} scale={[0.20, 0.48, 0.28]} rotation={[0.18, 0, 0]}>
          <capsuleGeometry args={[0.06, 0.08, 8, 12]} />
          {skin}
        </mesh>

        {/* Nose tip - slightly softer */}
        <mesh position={[0, -0.09, 0.265]}>
          <sphereGeometry args={[0.032, 14, 14]} />
          {skin}
        </mesh>

        {/* Nose wings (ala) - more defined */}
        {[-1, 1].map((s) => (
          <mesh key={`nose-wing-${s}`} position={[s * 0.028, -0.09, 0.255]} scale={[0.7, 0.55, 0.65]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            {skin}
          </mesh>
        ))}

        {/* Nose septum hint */}
        <mesh position={[0, -0.105, 0.25]} scale={[0.15, 0.3, 0.2]}>
          <capsuleGeometry args={[0.015, 0.01, 4, 6]} />
          {muscleShadow}
        </mesh>

        {/* Eyes - clearly visible in external view, pushed forward past forehead */}
        {[-1, 1].map((side) => (
          <group key={`eye-${side}`} position={[side * 0.085, 0.0, 0.24]}>
            {/* Eye socket shadow - indented into face */}
            <mesh position={[0, 0, -0.02]} scale={[1.3, 0.95, 0.5]}>
              <sphereGeometry args={[0.04, 14, 14]} />
              {muscleShadow}
            </mesh>
            {/* Eyeball - enlarged and pushed forward for external visibility */}
            <mesh position={[0, 0, 0.008]} scale={[1.4, 0.85, 1.1]}>
              <sphereGeometry args={[0.036, 18, 18]} />
              {eyeWhiteMat}
            </mesh>
            {/* Iris - slightly larger for visibility */}
            <mesh position={[side * 0.002, 0, 0.038]} scale={[0.65, 0.9, 0.45]}>
              <sphereGeometry args={[0.018, 14, 14]} />
              {irisMat}
            </mesh>
            {/* Pupil */}
            <mesh position={[side * 0.002, 0, 0.044]}>
              <sphereGeometry args={[0.009, 10, 10]} />
              {pupilMat}
            </mesh>
            {/* Upper eyelid - positioned to reveal eyeball below */}
            <mesh position={[0, 0.016, 0.02]} scale={[1.25, 0.30, 0.85]} rotation={[-0.1, 0, 0]}>
              <sphereGeometry args={[0.035, 14, 10]} />
              {skin}
            </mesh>
            {/* Eyelid crease line */}
            <mesh position={[0, 0.030, 0.008]} scale={[0.95, 0.08, 0.6]}>
              <sphereGeometry args={[0.035, 10, 6]} />
              {muscleShadow}
            </mesh>
            {/* Lower eyelid - softer */}
            <mesh position={[0, -0.012, 0.010]} scale={[1.1, 0.22, 0.85]}>
              <sphereGeometry args={[0.028, 12, 8]} />
              {skin}
            </mesh>
            {/* Subtle lower eyelid crease */}
            <mesh position={[0, -0.024, 0.004]} scale={[0.85, 0.06, 0.45]}>
              <sphereGeometry args={[0.028, 8, 6]} />
              {muscleShadow}
            </mesh>
          </group>
        ))}

        {/* Dark circles under eyes - dynamic: sleep deficit + fatigue + skin health + stress */}
        {(() => {
          const darkCircleIntensity = state.body.darkCircles || 0;
          const darkCircleOpacity = Math.min(0.8, darkCircleIntensity * 1.4);
          if (darkCircleOpacity < 0.05) return null;
          return (
            <>
              {[-1, 1].map((s) => (
                <mesh key={`dark-circle-${s}`} position={[s * 0.085, -0.038, 0.235]} scale={[1.05, 0.50, 0.55]}>
                  <sphereGeometry args={[0.032, 12, 10]} />
                  <meshStandardMaterial
                    color="#3d2a3a"
                    transparent
                    opacity={darkCircleOpacity}
                    roughness={0.7}
                    metalness={0.02}
                    depthWrite={false}
                  />
                </mesh>
              ))}
            </>
          );
        })()}

        {/* Eyebrows - pushed forward to match eye z-position */}
        {[-1, 1].map((side) => (
          <mesh
            key={`brow-${side}`}
            position={[side * 0.085, 0.048, 0.24]}
            rotation={[0, 0, side * (isFemale ? -0.08 : -0.12)]}
            scale={[isFemale ? 0.72 : 0.85, isFemale ? 0.12 : 0.2, 0.4]}
          >
            <capsuleGeometry args={[0.03, 0.04, 6, 8]} />
            <meshStandardMaterial
              color={isFemale ? "#5a3e2b" : "#2c1810"}
              roughness={0.9}
              metalness={0}
              transparent={transparent}
              opacity={transparent ? 0.05 : 0.85}
            />
          </mesh>
        ))}

        {/* Cheekbones - more defined but gentle */}
        {[-1, 1].map((s) => (
          <mesh key={`cheek-${s}`} position={[s * 0.14, -0.04, 0.14]} scale={[0.68, 0.58, 0.52]}>
            <sphereGeometry args={[0.08, 14, 14]} />
            {warmSkin}
          </mesh>
        ))}

        {/* Laugh lines (nasolabial folds) - subtle realism */}
        {[-1, 1].map((s) => (
          <mesh
            key={`nasolabial-${s}`}
            position={[s * 0.04, -0.08, 0.205]}
            scale={[0.06, 0.5, 0.08]}
            rotation={[0, 0, s * 0.08]}
          >
            <cylinderGeometry args={[0.006, 0.003, 1, 4]} />
            {muscleShadow}
          </mesh>
        ))}

        {/* Upper lip - pleasant shape with cupid's bow suggestion */}
        <mesh position={[0, -0.1, 0.20]} scale={[0.62, 0.22, 0.3]} rotation={[0.1, 0, 0]}>
          <sphereGeometry args={[0.06, 14, 10]} />
          {lipMat}
        </mesh>
        {/* Cupid's bow peaks */}
        {[-1, 1].map((s) => (
          <mesh key={`cupid-${s}`} position={[s * 0.015, -0.085, 0.21]} scale={[0.15, 0.12, 0.15]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            {lipMat}
          </mesh>
        ))}

        {/* Lower lip - slightly fuller for pleasant look */}
        <mesh position={[0, -0.13, 0.195]} scale={[0.57, 0.27, 0.32]} rotation={[0.05, 0, 0]}>
          <sphereGeometry args={[0.058, 14, 10]} />
          {lipMat}
        </mesh>

        {/* Slight smile suggestion at corners of mouth */}
        {[-1, 1].map((s) => (
          <mesh key={`smile-${s}`} position={[s * 0.03, -0.105, 0.19]} scale={[0.18, 0.08, 0.12]} rotation={[0, 0, s * -0.2]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            {skin}
          </mesh>
        ))}

        {/* Philtrum (groove above upper lip) */}
        <mesh position={[0, -0.075, 0.2]} scale={[0.08, 0.25, 0.15]}>
          <cylinderGeometry args={[0.004, 0.004, 1, 6]} />
          {muscleShadow}
        </mesh>

        {/* Chin - smoother */}
        <mesh position={[0, -0.17, 0.14]} scale={[0.65, 0.5, 0.55]}>
          <sphereGeometry args={[0.07, 14, 14]} />
          {skin}
        </mesh>
        {/* Chin dimple suggestion */}
        <mesh position={[0, -0.17, 0.155]} scale={[0.1, 0.08, 0.06]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          {muscleShadow}
        </mesh>

        {/* Jaw line - smoother transitions */}
        {[-1, 1].map((s) => (
          <mesh key={`jaw-${s}`} position={[s * 0.1, -0.13, 0.1]} scale={[0.5, 0.55, 0.5]} rotation={[0, 0, s * (isFemale ? 0.10 : 0.15)]}>
            <capsuleGeometry args={[0.06, 0.08, 10, 10]} />
            {!isFemale ? muscleShadow : skin}
          </mesh>
        ))}
      </group>

      {/* Ears - more realistic with defined helix and antihelix */}
      {[-1, 1].map((s) => (
        <group key={`ear-${s}`} position={[s * 0.23, 1.93, -0.02]} rotation={[0, s * -0.2, s * 0.1]}>
          {/* Outer ear (helix) */}
          <mesh scale={[0.25, 0.55, 0.22]}>
            <sphereGeometry args={[0.07, 14, 14]} />
            {skin}
          </mesh>
          {/* Helix rim - the outer fold */}
          <mesh position={[0, 0.01, s * 0.012]} scale={[0.22, 0.5, 0.1]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            {skin}
          </mesh>
          {/* Antihelix - inner fold */}
          <mesh position={[0, 0, s * 0.008]} scale={[0.14, 0.35, 0.08]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            {muscleShadow}
          </mesh>
          {/* Tragus suggestion */}
          <mesh position={[s * -0.01, -0.01, s * 0.014]} scale={[0.06, 0.12, 0.06]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            {skin}
          </mesh>
          {/* Earlobe */}
          <mesh position={[0, -0.035, s * 0.005]} scale={[0.12, 0.1, 0.08]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            {skin}
          </mesh>
        </group>
      ))}

      {/* Jaw / chin mass */}
      <mesh position={[0, 1.78, 0.06]} scale={[0.95, 0.7, 0.7]}>
        <sphereGeometry args={[0.16, 18, 18]} />
        {skin}
      </mesh>

      {/* ===== FEMALE HAIR ===== */}
      {isFemale && !transparent && (
        <group>
          {/* Main hair volume on top */}
          <mesh position={[0, 2.1, -0.04]}>
            <sphereGeometry args={[0.28, 24, 24]} />
            <meshStandardMaterial color="#2c1810" roughness={0.75} metalness={0.06} />
          </mesh>
          {/* Hair flowing down back */}
          <mesh position={[0, 1.68, -0.18]} rotation={[0.2, 0, 0]}>
            <capsuleGeometry args={[0.16, 0.55, 8, 16]} />
            <meshStandardMaterial color="#2c1810" roughness={0.75} metalness={0.06} />
          </mesh>
          {/* Side hair left */}
          <mesh position={[-0.18, 1.85, -0.06]}>
            <capsuleGeometry args={[0.07, 0.35, 6, 12]} />
            <meshStandardMaterial color="#2c1810" roughness={0.75} metalness={0.06} />
          </mesh>
          {/* Side hair right */}
          <mesh position={[0.18, 1.85, -0.06]}>
            <capsuleGeometry args={[0.07, 0.35, 6, 12]} />
            <meshStandardMaterial color="#2c1810" roughness={0.75} metalness={0.06} />
          </mesh>
          {/* Front bangs */}
          <mesh position={[0, 2.02, 0.14]} scale={[1.0, 0.4, 0.5]}>
            <sphereGeometry args={[0.2, 16, 12]} />
            <meshStandardMaterial color="#2c1810" roughness={0.75} metalness={0.06} />
          </mesh>
        </group>
      )}
      {/* MALE short hair */}
      {!isFemale && !transparent && (
        <group>
          <mesh position={[0, 2.04, -0.02]}>
            <sphereGeometry args={[0.25, 24, 24]} />
            <meshStandardMaterial color="#1a1008" roughness={0.82} metalness={0.04} />
          </mesh>
          {/* Fade on sides */}
          {[-1, 1].map((s) => (
            <mesh key={`hair-side-${s}`} position={[s * 0.19, 1.96, -0.02]} scale={[0.5, 0.85, 0.85]}>
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshStandardMaterial color="#1a1008" roughness={0.82} metalness={0.04} />
            </mesh>
          ))}
        </group>
      )}

      {/* ===== NECK ===== */}
      <mesh position={[0, 1.66, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.18, 18]} />
        {skin}
      </mesh>
      {/* Adam's apple (male) */}
      {!isFemale && (
        <mesh position={[0, 1.65, 0.08]} scale={[0.35, 0.6, 0.4]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          {skin}
        </mesh>
      )}
      {/* Sternocleidomastoid muscles (neck sides) */}
      {[-1, 1].map((s) => (
        <mesh key={`scm-${s}`} position={[s * 0.04, 1.65, 0.03]} scale={[0.35, 1.0, 0.5]} rotation={[0, 0, s * 0.2]}>
          <capsuleGeometry args={[0.025, 0.12, 6, 8]} />
          {muscleShadow}
        </mesh>
      ))}
      {/* Trapezius (neck to shoulder) - enhanced transition */}
      {[-1, 1].map((s) => (
        <mesh key={`trap-${s}`} position={[s * 0.16, 1.58, -0.04]} scale={[0.8, 0.45, 0.55]} rotation={[0.3, 0, s * 0.4]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          {muscleShadow}
        </mesh>
      ))}

      {/* ===== CLAVICLE (collarbone) ===== */}
      {[-1, 1].map((s) => (
        <mesh
          key={`clavicle-${s}`}
          position={[s * 0.12, 1.50, 0.14 * chestWide]}
          rotation={[0.3, s * 0.15, s * 0.35]}
          scale={[0.55, 0.04, 0.04]}
        >
          <capsuleGeometry args={[0.015, 0.18, 4, 8]} />
          {muscleShadow}
        </mesh>
      ))}

      {/* ===== TORSO ===== */}
      <group ref={torsoRef}>
        {/* Upper chest / ribcage */}
        <mesh position={[0, 1.28, 0]}>
          <capsuleGeometry args={[0.30 * chestWide * shoulderWide, 0.30, 14, 28]} />
          {skin}
        </mesh>

        {/* Natural deltoid cap - better shoulder joint transition */}
        {[-1, 1].map((s) => (
          <mesh key={`deltoid-cap-${s}`} position={[s * (0.33 * shoulderWide + fat * 0.06), 1.44, 0.02]} scale={[0.85, 0.6, 0.7]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            {skin}
          </mesh>
        ))}

        {/* Pectoral muscles (chest definition) */}
        {!isFemale && muscleDef > 0.3 && !transparent && (
          <group>
            {[-1, 1].map((s) => (
              <mesh
                key={`pec-${s}`}
                position={[s * 0.12, 1.30, 0.22 * chestWide]}
                scale={[0.85, 0.6, 0.4 * muscleDef]}
                rotation={[0.1, s * 0.15, 0]}
              >
                <sphereGeometry args={[0.13, 16, 16]} />
                {muscleShadow}
              </mesh>
            ))}
            {/* Pectoral separation line */}
            <mesh position={[0, 1.30, 0.24 * chestWide]} scale={[0.02, 0.5, 0.3]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color={muscleShadowColor}
                roughness={0.7}
                metalness={0.02}
                transparent
                opacity={0.4 * muscleDef}
              />
            </mesh>
          </group>
        )}

        {/* Serratus anterior (rib muscles) */}
        {!isFemale && muscleDef > 0.4 && !transparent && (
          <group>
            {[-1, 1].map((s) => (
              <mesh
                key={`serratus-${s}`}
                position={[s * 0.22, 1.22, 0.08 * chestWide]}
                scale={[0.5, 0.8, 0.3]}
                rotation={[0, 0, s * 0.3]}
              >
                <sphereGeometry args={[0.08, 12, 12]} />
                {muscleShadow}
              </mesh>
            ))}
          </group>
        )}

        {/* Waist */}
        <mesh position={[0, 1.00, 0]}>
          <capsuleGeometry args={[0.26 * waistNarrow, 0.18, 12, 22]} />
          {skin}
        </mesh>

        {/* Abdominal muscles (6-pack definition for low fat) */}
        {muscleDef > 0.4 && !transparent && (
          <group>
            {/* Rectus abdominis - two columns */}
            {[-1, 1].map((s) => (
              <group key={`abs-col-${s}`}>
                {/* Upper abs */}
                <mesh position={[s * 0.05, 1.15, 0.22 * (1 + fat * 0.2)]} scale={[0.45, 0.3, 0.2 * muscleDef]}>
                  <sphereGeometry args={[0.06, 10, 10]} />
                  {muscleShadow}
                </mesh>
                {/* Middle abs */}
                <mesh position={[s * 0.05, 1.07, 0.22 * (1 + fat * 0.2)]} scale={[0.45, 0.3, 0.2 * muscleDef]}>
                  <sphereGeometry args={[0.06, 10, 10]} />
                  {muscleShadow}
                </mesh>
                {/* Lower abs */}
                <mesh position={[s * 0.05, 0.99, 0.21 * (1 + fat * 0.2)]} scale={[0.4, 0.28, 0.18 * muscleDef]}>
                  <sphereGeometry args={[0.06, 10, 10]} />
                  {muscleShadow}
                </mesh>
              </group>
            ))}
            {/* Linea alba (center line) */}
            <mesh position={[0, 1.07, 0.23 * (1 + fat * 0.2)]} scale={[0.015, 1.2, 0.15]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color={muscleShadowColor}
                roughness={0.7}
                transparent
                opacity={0.3 * muscleDef}
              />
            </mesh>
            {/* Transverse line (horizontal separations) */}
            {[1.11, 1.03, 0.95].map((y, i) => (
              <mesh key={`t-line-${i}`} position={[0, y, 0.23 * (1 + fat * 0.2)]} scale={[0.7, 0.015, 0.15]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial
                  color={muscleShadowColor}
                  roughness={0.7}
                  transparent
                  opacity={0.3 * muscleDef}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* External obliques (side abs) */}
        {muscleDef > 0.3 && !transparent && (
          <group>
            {[-1, 1].map((s) => (
              <mesh
                key={`oblique-${s}`}
                position={[s * 0.2, 1.08, 0.1]}
                scale={[0.5, 0.9, 0.4]}
                rotation={[0, 0, s * 0.15]}
              >
                <sphereGeometry args={[0.1, 12, 12]} />
                {muscleShadow}
              </mesh>
            ))}
          </group>
        )}

        {/* Female breasts */}
        {isFemale && (
          <group>
            <mesh position={[-0.14, 1.28, 0.22 * chestWide]} scale={[1, 0.85, 0.9]}>
              <sphereGeometry args={[0.11 + fat * 0.03, 22, 22]} />
              {skin}
            </mesh>
            <mesh position={[0.14, 1.28, 0.22 * chestWide]} scale={[1, 0.85, 0.9]}>
              <sphereGeometry args={[0.11 + fat * 0.03, 22, 22]} />
              {skin}
            </mesh>
          </group>
        )}

        {/* Abdomen / belly */}
        <mesh position={[0, 0.82, 0.02 + fat * 0.08]}>
          <sphereGeometry args={[0.26 * (1 + fat * 0.45), 22, 22]} />
          {skin}
        </mesh>

        {/* Navel (belly button) - subtle indentation */}
        <mesh position={[0, 0.80, 0.22 * (1 + fat * 0.4)]} scale={[0.06, 0.06, 0.04]}>
          <sphereGeometry args={[0.02, 10, 10]} />
          {muscleShadow}
        </mesh>

        {/* Latissimus dorsi (back muscles) */}
        {!isFemale && muscleDef > 0.3 && !transparent && (
          <group>
            {[-1, 1].map((s) => (
              <mesh
                key={`lat-${s}`}
                position={[s * 0.18, 1.18, -0.16]}
                scale={[0.7, 1.0, 0.5]}
                rotation={[0, 0, s * 0.15]}
              >
                <sphereGeometry args={[0.12, 12, 12]} />
                {muscleShadow}
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* Belly bulge for obesity */}
      {fat > 0.1 && (
        <mesh position={[0, 0.75, 0.12 + fat * 0.1]}>
          <sphereGeometry args={[0.22 * (1 + fat * 1.2), 22, 22]} />
          {skin}
        </mesh>
      )}

      {/* ===== HIPS / PELVIS ===== */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.30 * hipWide * (1 + fat * 0.35), 26, 26]} />
        {skin}
      </mesh>
      {/* Glutes */}
      <mesh position={[0, 0.48, -0.12 * hipWide]}>
        <sphereGeometry args={[0.22 * hipWide * (1 + fat * 0.3), 18, 18]} />
        {skin}
      </mesh>
      {/* Glute separation/definition */}
      {muscleDef > 0.3 && !transparent && (
        <mesh position={[0, 0.48, -0.15 * hipWide]} scale={[0.015, 0.6, 0.3]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={muscleShadowColor} roughness={0.7} transparent opacity={0.3 * muscleDef} />
        </mesh>
      )}

      {/* ===== ARMS ===== */}
      {[-1, 1].map((s) => (
        <group key={`arm-${s}`}>
          {/* Shoulder - Deltoid muscle with better cap */}
          <mesh position={[s * (0.36 * shoulderWide + fat * 0.08), 1.42, 0]}>
            <sphereGeometry args={[0.10 + fat * 0.02, 14, 14]} />
            {skin}
          </mesh>
          {/* Deltoid definition */}
          {muscleDef > 0.3 && !transparent && (
            <group>
              {/* Anterior deltoid */}
              <mesh position={[s * (0.34 * shoulderWide + fat * 0.08), 1.43, 0.06]} scale={[0.5, 0.5, 0.4 * muscleDef]}>
                <sphereGeometry args={[0.08, 10, 10]} />
                {muscleShadow}
              </mesh>
              {/* Lateral deltoid */}
              <mesh position={[s * (0.40 * shoulderWide + fat * 0.10), 1.42, 0]} scale={[0.4, 0.5, 0.35 * muscleDef]}>
                <sphereGeometry args={[0.07, 10, 10]} />
                {muscleShadow}
              </mesh>
            </group>
          )}
          {/* Upper arm */}
          <mesh
            position={[s * (0.42 * shoulderWide + fat * 0.12), 1.18, 0]}
            rotation={[0, 0, s * (0.06 + fat * 0.06)]}
          >
            <capsuleGeometry args={[0.08 + fat * 0.03, 0.42, 10, 18]} />
            {skin}
          </mesh>
          {/* Bicep muscle */}
          {muscleDef > 0.3 && !transparent && (
            <mesh
              position={[s * (0.42 * shoulderWide + fat * 0.12), 1.2, 0.04]}
              rotation={[0, 0, s * (0.06 + fat * 0.06)]}
              scale={[0.7, 0.7, 0.4 * muscleDef]}
            >
              <capsuleGeometry args={[0.08, 0.25, 8, 8]} />
              {muscleShadow}
            </mesh>
          )}
          {/* Tricep (back of arm) */}
          {muscleDef > 0.4 && !transparent && (
            <mesh
              position={[s * (0.42 * shoulderWide + fat * 0.12), 1.18, -0.04]}
              rotation={[0, 0, s * (0.06 + fat * 0.06)]}
              scale={[0.65, 0.7, 0.35 * muscleDef]}
            >
              <capsuleGeometry args={[0.07, 0.28, 8, 8]} />
              {muscleShadow}
            </mesh>
          )}
          {/* Elbow */}
          <mesh position={[s * (0.46 * shoulderWide + fat * 0.14), 0.92, 0]}>
            <sphereGeometry args={[0.065 + fat * 0.02, 10, 10]} />
            {skin}
          </mesh>
          {/* Forearm */}
          <mesh position={[s * (0.48 * shoulderWide + fat * 0.14), 0.72, 0.02]}>
            <capsuleGeometry args={[0.065 + fat * 0.02, 0.40, 10, 18]} />
            {skin}
          </mesh>
          {/* Forearm muscle (brachioradialis) */}
          {muscleDef > 0.4 && !transparent && (
            <mesh
              position={[s * (0.48 * shoulderWide + fat * 0.14), 0.78, 0.04]}
              scale={[0.4, 0.5, 0.3 * muscleDef]}
            >
              <sphereGeometry args={[0.05, 10, 10]} />
              {muscleShadow}
            </mesh>
          )}
          {/* Wrist */}
          <mesh position={[s * (0.49 * shoulderWide + fat * 0.14), 0.52, 0.03]} scale={[0.7, 0.6, 0.7]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            {skin}
          </mesh>
          {/* Hand - palm */}
          <mesh position={[s * (0.50 * shoulderWide + fat * 0.14), 0.49, 0.04]} scale={[0.85, 0.7, 0.45]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            {skin}
          </mesh>
          {/* 5 finger suggestions */}
          {[-0.6, -0.3, 0, 0.3, 0.55].map((fx, fi) => (
            <mesh
              key={`finger-${s}-${fi}`}
              position={[
                s * (0.50 * shoulderWide + fat * 0.14) + fx * 0.012 * s,
                0.44 - Math.abs(fx) * 0.015,
                0.06 + Math.abs(fx) * 0.005
              ]}
              rotation={[0.3, 0, s * fx * 0.15]}
              scale={[0.5, 0.55, 0.45]}
            >
              <capsuleGeometry args={[0.008, 0.025, 4, 6]} />
              {skin}
            </mesh>
          ))}
          {/* Thumb */}
          <mesh
            key={`thumb-${s}`}
            position={[s * (0.48 * shoulderWide + fat * 0.14) + s * -0.015, 0.48, 0.065]}
            rotation={[0.5, 0, s * -0.4]}
            scale={[0.55, 0.6, 0.5]}
          >
            <capsuleGeometry args={[0.009, 0.02, 4, 6]} />
            {skin}
          </mesh>
        </group>
      ))}

      {/* ===== LEGS ===== */}
      {[-1, 1].map((s) => (
        <group key={`leg-${s}`}>
          {/* Upper thigh */}
          <mesh position={[s * 0.14 * hipWide, 0.18, 0]}>
            <capsuleGeometry args={[0.13 + fat * 0.05, 0.52, 10, 18]} />
            {skin}
          </mesh>
          {/* Quadriceps definition */}
          {muscleDef > 0.3 && !transparent && (
            <group>
              {/* Rectus femoris */}
              <mesh position={[s * 0.14 * hipWide, 0.18, 0.06]} scale={[0.6, 0.8, 0.3 * muscleDef]}>
                <capsuleGeometry args={[0.1, 0.3, 8, 8]} />
                {muscleShadow}
              </mesh>
              {/* Vastus lateralis */}
              <mesh position={[s * (0.14 * hipWide + 0.04), 0.18, 0.02]} scale={[0.4, 0.75, 0.25 * muscleDef]}>
                <capsuleGeometry args={[0.08, 0.25, 8, 8]} />
                {muscleShadow}
              </mesh>
            </group>
          )}
          {/* Hamstring (back of thigh) */}
          {muscleDef > 0.4 && !transparent && (
            <mesh position={[s * 0.14 * hipWide, 0.18, -0.05]} scale={[0.5, 0.7, 0.25 * muscleDef]}>
              <capsuleGeometry args={[0.09, 0.25, 8, 8]} />
              {muscleShadow}
            </mesh>
          )}
          {/* Knee */}
          <mesh position={[s * 0.14 * hipWide, -0.12, 0.01]}>
            <sphereGeometry args={[0.08 + fat * 0.02, 12, 12]} />
            {skin}
          </mesh>
          {/* Knee dimple when leg is straight */}
          <mesh position={[s * 0.14 * hipWide, -0.12, -0.03]} scale={[0.5, 0.4, 0.3]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            {muscleShadow}
          </mesh>
          {/* Patella (kneecap) */}
          {muscleDef > 0.3 && !transparent && (
            <mesh position={[s * 0.14 * hipWide, -0.12, 0.05]} scale={[0.5, 0.45, 0.3 * muscleDef]}>
              <sphereGeometry args={[0.04, 10, 10]} />
              {muscleShadow}
            </mesh>
          )}
          {/* Shin */}
          <mesh position={[s * 0.14 * hipWide, -0.42, 0]}>
            <capsuleGeometry args={[0.08 + fat * 0.02, 0.48, 10, 18]} />
            {skin}
          </mesh>
          {/* Tibialis anterior (shin muscle) */}
          {muscleDef > 0.4 && !transparent && (
            <mesh position={[s * 0.14 * hipWide, -0.35, 0.03]} scale={[0.35, 0.5, 0.2 * muscleDef]}>
              <capsuleGeometry args={[0.05, 0.15, 6, 6]} />
              {muscleShadow}
            </mesh>
          )}
          {/* Calf */}
          <mesh position={[s * 0.14 * hipWide, -0.50, -0.04]}>
            <sphereGeometry args={[0.075 + fat * 0.02, 10, 10]} />
            {skin}
          </mesh>
          {/* Calf muscle (gastrocnemius) */}
          {muscleDef > 0.3 && !transparent && (
            <mesh position={[s * 0.14 * hipWide, -0.48, -0.06]} scale={[0.5, 0.6, 0.3 * muscleDef]}>
              <capsuleGeometry args={[0.06, 0.12, 6, 6]} />
              {muscleShadow}
            </mesh>
          )}
          {/* Ankle - inner and outer ankle bones */}
          <mesh position={[s * 0.14 * hipWide, -0.66, 0.02]} scale={[0.6, 0.7, 0.65]}>
            <sphereGeometry args={[0.04, 10, 10]} />
            {skin}
          </mesh>
          {/* Inner ankle bone */}
          <mesh position={[s * (0.14 * hipWide - s * 0.01), -0.67, 0.02]} scale={[0.4, 0.5, 0.4]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            {muscleShadow}
          </mesh>
          {/* Achilles tendon suggestion */}
          <mesh position={[s * 0.14 * hipWide, -0.64, -0.04]} scale={[0.2, 0.45, 0.15]} rotation={[0.15, 0, 0]}>
            <capsuleGeometry args={[0.012, 0.04, 4, 6]} />
            {muscleShadow}
          </mesh>
          {/* Foot - better shape with ankle definition */}
          <mesh position={[s * 0.14 * hipWide, -0.72, 0.06]} scale={[1, 0.5, 1.1]}>
            <boxGeometry args={[0.09, 0.05, 0.18]} />
            {skin}
          </mesh>
          {/* Foot arch / heel */}
          <mesh position={[s * 0.14 * hipWide, -0.73, -0.01]} scale={[0.7, 0.4, 0.6]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            {skin}
          </mesh>
          {/* Toe suggestions - 5 toes */}
          {[-0.35, -0.17, 0, 0.17, 0.30].map((tx, ti) => (
            <mesh
              key={`toe-${s}-${ti}`}
              position={[
                s * 0.14 * hipWide + tx * 0.012 * s,
                -0.73,
                0.155 + (ti === 4 ? -0.005 : 0)
              ]}
              scale={[0.5, 0.4, 0.4]}
            >
              <sphereGeometry args={[0.012, 6, 6]} />
              {skin}
            </mesh>
          ))}
          {/* Big toe */}
          <mesh
            position={[s * 0.14 * hipWide + s * -0.04, -0.72, 0.15]}
            scale={[0.6, 0.45, 0.5]}
          >
            <sphereGeometry args={[0.015, 8, 8]} />
            {skin}
          </mesh>
        </group>
      ))}

      {/* ===== VASCULAR SYSTEM HINTS (for realism) ===== */}
      {muscleDef > 0.5 && !transparent && (
        <group>
          {/* Cephalic vein (arm) */}
          {[-1, 1].map((s) => (
            <mesh
              key={`vein-arm-${s}`}
              position={[s * (0.40 * shoulderWide + fat * 0.12), 1.05, 0.05]}
              rotation={[0, 0, s * 0.2]}
              scale={[0.02, 0.6, 0.02]}
            >
              <cylinderGeometry args={[0.5, 0.3, 1, 6]} />
              <meshStandardMaterial
                color="#7a9eb5"
                roughness={0.5}
                metalness={0.05}
                transparent
                opacity={0.2 * muscleDef}
              />
            </mesh>
          ))}
          {/* Jugular vein hint */}
          {[-1, 1].map((s) => (
            <mesh
              key={`vein-neck-${s}`}
              position={[s * 0.03, 1.62, 0.04]}
              scale={[0.015, 0.3, 0.015]}
            >
              <cylinderGeometry args={[1, 0.7, 1, 6]} />
              <meshStandardMaterial
                color="#7a9eb5"
                roughness={0.5}
                metalness={0.05}
                transparent
                opacity={0.15 * muscleDef}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/* ====== ORGANS - anatomically correct positions and shapes ====== */

interface OrganDef {
  id: OrganId;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  geom: "brain" | "heart" | "lung" | "liver" | "kidney" | "stomach" | "uterus" | "testes";
  label: string;
}

function organDefs(gender: Gender): OrganDef[] {
  if (gender === "female") {
    return [
      {
        id: "brain", position: [0, 1.93, 0.02], scale: [0.19, 0.15, 0.20], geom: "brain",
        label: "Brain",
      },
      {
        id: "heart", position: [-0.06, 1.22, 0.10], scale: [0.09, 0.10, 0.08], geom: "heart",
        rotation: [0, 0, 0.3],
        label: "Heart",
      },
      {
        id: "lungs", position: [0, 1.24, 0.04], scale: [0.12, 0.16, 0.10], geom: "lung",
        label: "Lungs",
      },
      {
        id: "liver", position: [0.10, 1.00, 0.08], scale: [0.16, 0.09, 0.10], geom: "liver",
        rotation: [0, 0.2, 0],
        label: "Liver",
      },
      {
        id: "kidneys", position: [0, 0.92, -0.08], scale: [0.055, 0.08, 0.04], geom: "kidney",
        label: "Kidneys",
      },
      {
        id: "stomach", position: [-0.06, 1.02, 0.10], scale: [0.10, 0.12, 0.08], geom: "stomach",
        rotation: [0, 0, -0.2],
        label: "Stomach",
      },
      {
        id: "reproductive", position: [0, 0.50, 0.04], scale: [0.08, 0.06, 0.06], geom: "uterus",
        label: "Reproductive",
      },
    ];
  }
  return [
    {
      id: "brain", position: [0, 1.93, 0.02], scale: [0.20, 0.16, 0.21], geom: "brain",
      label: "Brain",
    },
    {
      id: "heart", position: [-0.07, 1.22, 0.10], scale: [0.10, 0.11, 0.09], geom: "heart",
      rotation: [0, 0, 0.3],
      label: "Heart",
    },
    {
      id: "lungs", position: [0, 1.24, 0.04], scale: [0.13, 0.17, 0.10], geom: "lung",
      label: "Lungs",
    },
    {
      id: "liver", position: [0.11, 1.00, 0.08], scale: [0.17, 0.10, 0.11], geom: "liver",
      rotation: [0, 0.2, 0],
      label: "Liver",
    },
    {
      id: "kidneys", position: [0, 0.92, -0.08], scale: [0.06, 0.085, 0.04], geom: "kidney",
      label: "Kidneys",
    },
    {
      id: "stomach", position: [-0.07, 1.02, 0.10], scale: [0.11, 0.13, 0.09], geom: "stomach",
      rotation: [0, 0, -0.2],
      label: "Stomach",
    },
    {
      id: "reproductive", position: [0, 0.48, 0.04], scale: [0.06, 0.04, 0.04], geom: "testes",
      label: "Reproductive",
    },
  ];
}

/* ====== Brain mesh - two hemispheres + cerebellum + brain stem + wrinkle texture + temporal lobes ====== */

function BrainMesh({
  def,
  organState,
  selected,
  onClick,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const groupRef = useRef<THREE.Group>(null!);

  const { decay } = organState;
  const color = useMemo(() => organColor("brain", decay), [decay]);
  const emissive = useMemo(() => organEmissive("brain", decay), [decay]);
  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  const roughness = 0.25 + decay * 0.5;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (groupRef.current && (selected || hover)) {
      groupRef.current.rotation.y = Math.sin(t * 2) * 0.08;
    }
    if (groupRef.current && decay > 0.3) {
      const pulse = 1 + Math.sin(t * 2) * decay * 0.03;
      groupRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  const hemiOffsetX = 0.02;
  const hemiScale: [number, number, number] = [def.scale[0] * 0.52, def.scale[1] * 0.95, def.scale[2] * 0.9];

  // Wet organ material - glossy healthy, rougher damaged
  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.12}
      wireframe={hover && !selected}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
    />
  );

  // Wrinkle/fold bumps for brain texture
  const wrinkleMat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity * 0.6}
      roughness={roughness + 0.1}
      metalness={0.10}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 0.85}
    />
  );

  return (
    <group
      ref={groupRef}
      position={def.position}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    >
      {/* Left cerebral hemisphere */}
      <mesh position={[-hemiOffsetX, 0, 0]} scale={hemiScale} rotation={[0, 0, 0.05]}>
        <sphereGeometry args={[1, 32, 24]} />
        {mat}
      </mesh>
      {/* Right cerebral hemisphere */}
      <mesh position={[hemiOffsetX, 0, 0]} scale={hemiScale} rotation={[0, 0, -0.05]}>
        <sphereGeometry args={[1, 32, 24]} />
        {mat}
      </mesh>

      {/* Brain wrinkle/fold texture - displaced small spheres across hemispheres */}
      {[-1, 1].map((side) => (
        <group key={`wrinkle-${side}`}>
          {/* Frontal lobe wrinkle */}
          <mesh position={[side * hemiOffsetX * 0.5, 0.04, def.scale[2] * 0.3]} scale={[def.scale[0] * 0.35, def.scale[1] * 0.15, def.scale[2] * 0.12]}>
            <sphereGeometry args={[1, 10, 8]} />
            {wrinkleMat}
          </mesh>
          {/* Parietal lobe wrinkle */}
          <mesh position={[side * hemiOffsetX * 0.5, 0.06, 0]} scale={[def.scale[0] * 0.30, def.scale[1] * 0.12, def.scale[2] * 0.15]}>
            <sphereGeometry args={[1, 10, 8]} />
            {wrinkleMat}
          </mesh>
          {/* Central sulcus wrinkle */}
          <mesh position={[side * hemiOffsetX * 0.5, 0.02, def.scale[2] * 0.15]} scale={[def.scale[0] * 0.28, def.scale[1] * 0.18, def.scale[2] * 0.08]}>
            <sphereGeometry args={[1, 8, 6]} />
            {wrinkleMat}
          </mesh>
        </group>
      ))}

      {/* Temporal lobes - more defined */}
      {[-1, 1].map((side) => (
        <mesh
          key={`temporal-${side}`}
          position={[side * def.scale[0] * 0.45, -def.scale[1] * 0.15, def.scale[2] * 0.1]}
          scale={[def.scale[0] * 0.25, def.scale[1] * 0.4, def.scale[2] * 0.35]}
        >
          <sphereGeometry args={[1, 14, 12]} />
          {mat}
        </mesh>
      ))}

      {/* Cerebellum */}
      <mesh position={[0, -def.scale[1] * 0.55, -def.scale[2] * 0.35]} scale={[def.scale[0] * 0.6, def.scale[1] * 0.5, def.scale[2] * 0.5]}>
        <sphereGeometry args={[1, 22, 18]} />
        {mat}
      </mesh>
      {/* Cerebellum wrinkle texture */}
      {[-0.2, 0, 0.2].map((ox, i) => (
        <mesh key={`cerebellum-wrinkle-${i}`} position={[ox * def.scale[0], -def.scale[1] * 0.55, -def.scale[2] * 0.35]} scale={[def.scale[0] * 0.15, def.scale[1] * 0.35, def.scale[2] * 0.12]}>
          <sphereGeometry args={[1, 8, 6]} />
          {wrinkleMat}
        </mesh>
      ))}

      {/* Brain stem */}
      <mesh position={[0, -def.scale[1] * 0.85, -def.scale[2] * 0.1]} scale={[def.scale[0] * 0.18, def.scale[1] * 0.5, def.scale[2] * 0.18]}>
        <cylinderGeometry args={[0.6, 0.5, 1, 14]} />
        {mat}
      </mesh>

      {/* Central fissure line */}
      <mesh position={[0, 0.02, def.scale[2] * 0.05]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.004, def.scale[1] * 1.6, def.scale[2] * 1.2]} />
        <meshStandardMaterial color="#8b5e5e" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

/* ====== Single organ mesh with decay visualization ====== */

function OrganMesh({
  def,
  organState,
  selected,
  onClick,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const [hover, setHover] = useState(false);

  const { decay, healthScore } = organState;
  const color = useMemo(() => organColor(def.id, decay), [def.id, decay]);
  const emissive = useMemo(() => organEmissive(def.id, decay), [def.id, decay]);

  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  // Wet organ: lower roughness for healthy, higher for damaged
  const roughness = 0.2 + decay * 0.55;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (!ref.current) return;

    if (def.id === "heart") {
      const beatSpeed = 3.5 + decay * 2;
      const beatAmp = 0.05 + decay * 0.04;
      const beat = 1 + Math.sin(t * beatSpeed) * beatAmp;
      ref.current.scale.set(def.scale[0] * beat, def.scale[1] * beat, def.scale[2] * beat);
    } else if (def.id === "lungs") {
      const breathSpeed = 1.0 + decay * 0.5;
      const breathAmp = 0.04;
      const b = 1 + Math.sin(t * breathSpeed) * breathAmp;
      ref.current.scale.set(def.scale[0] * b, def.scale[1] * b, def.scale[2] * (1 + Math.sin(t * breathSpeed) * 0.02));
    } else {
      if (decay > 0.3) {
        const pulse = 1 + Math.sin(t * 2 + def.position[0]) * decay * 0.03;
        ref.current.scale.set(def.scale[0] * pulse, def.scale[1] * pulse, def.scale[2] * pulse);
      }
    }

    if (selected || hover) {
      ref.current.rotation.y = Math.sin(t * 2) * 0.08;
    }
  });

  const geometry = useMemo(() => {
    switch (def.geom) {
      case "brain":
        return <sphereGeometry args={[1, 32, 24]} />;
      case "heart":
        // Anatomical heart - conical shape using scaled sphere with twist
        return <sphereGeometry args={[1, 20, 16]} />;
      case "lung":
        return <sphereGeometry args={[1, 22, 18]} />;
      case "liver":
        // Wedge-shaped liver
        return <sphereGeometry args={[1, 20, 16]} />;
      case "kidney":
        return <capsuleGeometry args={[0.5, 0.8, 10, 14]} />;
      case "stomach":
        // J-shaped stomach
        return <sphereGeometry args={[1, 20, 16]} />;
      case "uterus":
        return <sphereGeometry args={[1, 18, 14]} />;
      case "testes":
        return <sphereGeometry args={[1, 14, 14]} />;
    }
  }, [def.geom]);

  return (
    <mesh
      ref={ref}
      position={def.position}
      scale={def.scale}
      rotation={def.rotation || [0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    >
      {geometry}
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={roughness}
        metalness={0.12}
        wireframe={hover && !selected}
        transparent={decay > 0.7}
        opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
      />
    </mesh>
  );
}

/* ====== Anatomical Heart mesh - conical with aorta suggestion ====== */

function HeartMesh({
  def,
  organState,
  selected,
  onClick,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const groupRef = useRef<THREE.Group>(null!);

  const { decay } = organState;
  const color = useMemo(() => organColor("heart", decay), [decay]);
  const emissive = useMemo(() => organEmissive("heart", decay), [decay]);
  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  const roughness = 0.2 + decay * 0.5;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (!groupRef.current) return;
    const beatSpeed = 3.5 + decay * 2;
    const beatAmp = 0.05 + decay * 0.04;
    const beat = 1 + Math.sin(t * beatSpeed) * beatAmp;
    groupRef.current.scale.set(beat, beat, beat);

    if (selected || hover) {
      groupRef.current.rotation.y = Math.sin(t * 2) * 0.08;
    }
  });

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.15}
      wireframe={hover && !selected}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
    />
  );

  return (
    <group
      ref={groupRef}
      position={def.position}
      rotation={def.rotation || [0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    >
      {/* Main heart body - conical/teardrop shape */}
      <mesh scale={def.scale} rotation={[0.1, 0, -0.15]}>
        <sphereGeometry args={[1, 22, 18]} />
        {mat}
      </mesh>
      {/* Aorta suggestion at top */}
      <mesh position={[0, def.scale[1] * 0.8, -def.scale[2] * 0.15]} scale={[def.scale[0] * 0.3, def.scale[1] * 0.5, def.scale[2] * 0.3]} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.35, 1, 12]} />
        {mat}
      </mesh>
      {/* Aortic arch */}
      <mesh position={[def.scale[0] * 0.2, def.scale[1] * 1.0, -def.scale[2] * 0.25]} scale={[def.scale[0] * 0.25, def.scale[1] * 0.2, def.scale[2] * 0.25]} rotation={[0, 0, 0.5]}>
        <torusGeometry args={[0.5, 0.2, 8, 12, Math.PI * 0.6]} />
        {mat}
      </mesh>
      {/* Superior vena cava */}
      <mesh position={[def.scale[0] * 0.3, def.scale[1] * 0.7, -def.scale[2] * 0.1]} scale={[def.scale[0] * 0.15, def.scale[1] * 0.4, def.scale[2] * 0.15]} rotation={[0.1, 0, 0.15]}>
        <cylinderGeometry args={[0.5, 0.4, 1, 10]} />
        {mat}
      </mesh>
      {/* Left ventricle bulge */}
      <mesh position={[-def.scale[0] * 0.15, -def.scale[1] * 0.25, def.scale[2] * 0.1]} scale={[def.scale[0] * 0.55, def.scale[1] * 0.45, def.scale[2] * 0.5]}>
        <sphereGeometry args={[1, 14, 12]} />
        {mat}
      </mesh>
      {/* Right ventricle suggestion */}
      <mesh position={[def.scale[0] * 0.2, -def.scale[1] * 0.15, def.scale[2] * 0.15]} scale={[def.scale[0] * 0.45, def.scale[1] * 0.4, def.scale[2] * 0.4]}>
        <sphereGeometry args={[1, 12, 10]} />
        {mat}
      </mesh>
    </group>
  );
}

/* ====== Paired lungs with lobe divisions and trachea ====== */

function LungsMesh({
  def,
  organState,
  selected,
  onClick,
  gender,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
  gender: Gender;
}) {
  const [hover, setHover] = useState(false);
  const leftRef = useRef<THREE.Group>(null!);
  const rightRef = useRef<THREE.Group>(null!);

  const { decay } = organState;
  const color = useMemo(() => organColor("lungs", decay), [decay]);
  const emissive = useMemo(() => organEmissive("lungs", decay), [decay]);
  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  const roughness = 0.2 + decay * 0.5;

  const lungSpread = gender === "female" ? 0.13 : 0.14;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const breathSpeed = 1.0 + decay * 0.5;
    const breathAmp = 0.05;
    const b = 1 + Math.sin(t * breathSpeed) * breathAmp;

    if (leftRef.current) {
      leftRef.current.scale.set(b, b, 1);
    }
    if (rightRef.current) {
      rightRef.current.scale.set(b * 1.05, b * 1.02, 1);
    }
  });

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.10}
      wireframe={hover && !selected}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
    />
  );

  // Fissure line material
  const fissureMat = (
    <meshStandardMaterial
      color={color.clone().multiplyScalar(0.7)}
      roughness={roughness + 0.15}
      metalness={0.08}
      transparent
      opacity={0.6}
    />
  );

  return (
    <group>
      {/* Trachea (windpipe) */}
      <mesh position={[def.position[0], def.position[1] + def.scale[1] * 0.9, def.position[2]]} scale={[0.02, def.scale[1] * 0.6, 0.02]}>
        <cylinderGeometry args={[0.4, 0.35, 1, 10]} />
        {mat}
      </mesh>
      {/* Tracheal rings suggestion */}
      {[0.2, 0.35, 0.5, 0.65].map((ry, i) => (
        <mesh key={`trachea-ring-${i}`} position={[def.position[0], def.position[1] + def.scale[1] * (0.9 - ry * 0.5), def.position[2]]} scale={[0.025, 0.01, 0.025]}>
          <torusGeometry args={[0.4, 0.08, 6, 10]} />
          {mat}
        </mesh>
      ))}
      {/* Bronchi - left and right splitting */}
      {[-1, 1].map((s) => (
        <mesh key={`bronchus-${s}`} position={[def.position[0] + s * 0.04, def.position[1] + def.scale[1] * 0.55, def.position[2]]} scale={[0.015, 0.08, 0.015]} rotation={[0, 0, s * 0.3]}>
          <cylinderGeometry args={[0.35, 0.3, 1, 8]} />
          {mat}
        </mesh>
      ))}

      {/* Left lung - 2 lobes */}
      <group
        ref={leftRef}
        position={[def.position[0] - lungSpread, def.position[1], def.position[2]]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
      >
        {/* Upper lobe */}
        <mesh position={[0, def.scale[1] * 0.25, 0]} scale={[def.scale[0], def.scale[1] * 0.5, def.scale[2]]}>
          <sphereGeometry args={[1, 20, 16]} />
          {mat}
        </mesh>
        {/* Lower lobe */}
        <mesh position={[0, -def.scale[1] * 0.2, 0]} scale={[def.scale[0] * 0.95, def.scale[1] * 0.55, def.scale[2]]}>
          <sphereGeometry args={[1, 20, 16]} />
          {mat}
        </mesh>
        {/* Oblique fissure line */}
        <mesh position={[0, 0, def.scale[2] * 0.15]} scale={[def.scale[0] * 0.85, 0.005, def.scale[2] * 0.3]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          {fissureMat}
        </mesh>
      </group>

      {/* Right lung - 3 lobes */}
      <group
        ref={rightRef}
        position={[def.position[0] + lungSpread, def.position[1], def.position[2]]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
      >
        {/* Upper lobe */}
        <mesh position={[0, def.scale[1] * 0.35, 0]} scale={[def.scale[0] * 1.1, def.scale[1] * 0.35, def.scale[2]]}>
          <sphereGeometry args={[1, 20, 16]} />
          {mat}
        </mesh>
        {/* Middle lobe */}
        <mesh position={[0, def.scale[1] * 0.05, def.scale[2] * 0.1]} scale={[def.scale[0] * 1.05, def.scale[1] * 0.3, def.scale[2] * 0.9]}>
          <sphereGeometry args={[1, 18, 14]} />
          {mat}
        </mesh>
        {/* Lower lobe */}
        <mesh position={[0, -def.scale[1] * 0.25, 0]} scale={[def.scale[0] * 1.1, def.scale[1] * 0.5, def.scale[2]]}>
          <sphereGeometry args={[1, 20, 16]} />
          {mat}
        </mesh>
        {/* Horizontal fissure */}
        <mesh position={[0, def.scale[1] * 0.2, def.scale[2] * 0.15]} scale={[def.scale[0] * 0.9, 0.005, def.scale[2] * 0.25]}>
          <boxGeometry args={[1, 1, 1]} />
          {fissureMat}
        </mesh>
        {/* Oblique fissure */}
        <mesh position={[0, -def.scale[1] * 0.08, def.scale[2] * 0.12]} scale={[def.scale[0] * 0.9, 0.005, def.scale[2] * 0.3]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          {fissureMat}
        </mesh>
      </group>
    </group>
  );
}

/* ====== Wedge-shaped Liver with portal vein ====== */

function LiverMesh({
  def,
  organState,
  selected,
  onClick,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const groupRef = useRef<THREE.Group>(null!);

  const { decay } = organState;
  const color = useMemo(() => organColor("liver", decay), [decay]);
  const emissive = useMemo(() => organEmissive("liver", decay), [decay]);
  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  const roughness = 0.2 + decay * 0.5;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (!groupRef.current) return;
    if (decay > 0.3) {
      const pulse = 1 + Math.sin(t * 2) * decay * 0.03;
      groupRef.current.scale.set(pulse, pulse, pulse);
    }
    if (selected || hover) {
      groupRef.current.rotation.y = Math.sin(t * 2) * 0.08;
    }
  });

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.10}
      wireframe={hover && !selected}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
    />
  );

  return (
    <group
      ref={groupRef}
      position={def.position}
      rotation={def.rotation || [0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    >
      {/* Main liver body - wider right, tapered left (wedge) */}
      <mesh scale={[def.scale[0], def.scale[1], def.scale[2]]}>
        <sphereGeometry args={[1, 22, 18]} />
        {mat}
      </mesh>
      {/* Right lobe (larger) */}
      <mesh position={[def.scale[0] * 0.25, -def.scale[1] * 0.1, 0]} scale={[def.scale[0] * 0.7, def.scale[1] * 0.85, def.scale[2] * 0.9]}>
        <sphereGeometry args={[1, 16, 14]} />
        {mat}
      </mesh>
      {/* Left lobe (smaller, tapered) */}
      <mesh position={[-def.scale[0] * 0.4, def.scale[1] * 0.1, 0]} scale={[def.scale[0] * 0.4, def.scale[1] * 0.5, def.scale[2] * 0.6]}>
        <sphereGeometry args={[1, 14, 12]} />
        {mat}
      </mesh>
      {/* Portal vein suggestion */}
      <mesh position={[-def.scale[0] * 0.05, def.scale[1] * 0.3, -def.scale[2] * 0.3]} scale={[def.scale[0] * 0.08, def.scale[1] * 0.5, def.scale[2] * 0.08]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.3, 1, 8]} />
        {mat}
      </mesh>
      {/* Hepatic artery suggestion */}
      <mesh position={[def.scale[0] * 0.05, def.scale[1] * 0.25, -def.scale[2] * 0.25]} scale={[def.scale[0] * 0.05, def.scale[1] * 0.35, def.scale[2] * 0.05]} rotation={[0.35, 0.1, 0]}>
        <cylinderGeometry args={[0.35, 0.25, 1, 8]} />
        {mat}
      </mesh>
      {/* Falciform ligament suggestion */}
      <mesh position={[-def.scale[0] * 0.05, 0, def.scale[2] * 0.5]} scale={[0.005, def.scale[1] * 0.8, def.scale[2] * 0.3]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color.clone().multiplyScalar(0.8)} roughness={roughness + 0.1} metalness={0.05} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/* ====== J-shaped Stomach with pyloric region ====== */

function StomachMesh({
  def,
  organState,
  selected,
  onClick,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const groupRef = useRef<THREE.Group>(null!);

  const { decay } = organState;
  const color = useMemo(() => organColor("stomach", decay), [decay]);
  const emissive = useMemo(() => organEmissive("stomach", decay), [decay]);
  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  const roughness = 0.2 + decay * 0.5;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (!groupRef.current) return;
    if (decay > 0.3) {
      const pulse = 1 + Math.sin(t * 2) * decay * 0.03;
      groupRef.current.scale.set(pulse, pulse, pulse);
    }
    if (selected || hover) {
      groupRef.current.rotation.y = Math.sin(t * 2) * 0.08;
    }
  });

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.10}
      wireframe={hover && !selected}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
    />
  );

  return (
    <group
      ref={groupRef}
      position={def.position}
      rotation={def.rotation || [0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    >
      {/* Fundus (upper curve) */}
      <mesh position={[0, def.scale[1] * 0.3, 0]} scale={[def.scale[0] * 0.9, def.scale[1] * 0.55, def.scale[2]]}>
        <sphereGeometry args={[1, 18, 14]} />
        {mat}
      </mesh>
      {/* Body (main J curve) */}
      <mesh position={[def.scale[0] * 0.1, 0, 0]} scale={[def.scale[0] * 0.8, def.scale[1] * 0.7, def.scale[2]]} rotation={[0, 0, -0.15]}>
        <sphereGeometry args={[1, 18, 14]} />
        {mat}
      </mesh>
      {/* Antrum / Pyloric region (lower curve) */}
      <mesh position={[def.scale[0] * 0.25, -def.scale[1] * 0.35, 0]} scale={[def.scale[0] * 0.5, def.scale[1] * 0.3, def.scale[2] * 0.8]}>
        <sphereGeometry args={[1, 14, 12]} />
        {mat}
      </mesh>
      {/* Pyloric canal (exit) */}
      <mesh position={[def.scale[0] * 0.35, -def.scale[1] * 0.5, 0]} scale={[def.scale[0] * 0.12, def.scale[1] * 0.2, def.scale[2] * 0.4]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.4, 0.3, 1, 8]} />
        {mat}
      </mesh>
      {/* Cardiac notch / esophageal connection */}
      <mesh position={[-def.scale[0] * 0.15, def.scale[1] * 0.5, 0]} scale={[def.scale[0] * 0.15, def.scale[1] * 0.15, def.scale[2] * 0.4]}>
        <cylinderGeometry args={[0.5, 0.35, 1, 8]} />
        {mat}
      </mesh>
      {/* Greater curvature (outer curve) */}
      <mesh position={[-def.scale[0] * 0.1, -def.scale[1] * 0.1, 0]} scale={[def.scale[0] * 0.45, def.scale[1] * 0.45, def.scale[2] * 0.5]} rotation={[0, 0, 0.2]}>
        <sphereGeometry args={[1, 12, 10]} />
        {mat}
      </mesh>
      {/* Rugae (stomach folds) - subtle surface detail */}
      {[-0.1, 0, 0.1].map((fy, i) => (
        <mesh key={`rugae-${i}`} position={[0, def.scale[1] * fy, def.scale[2] * 0.3]} scale={[def.scale[0] * 0.6, 0.003, def.scale[2] * 0.25]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color.clone().multiplyScalar(0.8)} roughness={roughness + 0.1} metalness={0.05} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/* ====== Paired kidneys with renal hilum ====== */

function KidneysMesh({
  def,
  organState,
  selected,
  onClick,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  const { decay } = organState;
  const color = useMemo(() => organColor("kidneys", decay), [decay]);
  const emissive = useMemo(() => organEmissive("kidneys", decay), [decay]);
  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  const roughness = 0.2 + decay * 0.5;

  const kidneyScale: [number, number, number] = [def.scale[0], def.scale[1] * 1.4, def.scale[2]];

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.10}
      wireframe={hover && !selected}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
    />
  );

  // Hilum indent color (slightly darker)
  const hilumMat = (
    <meshStandardMaterial
      color={color.clone().multiplyScalar(0.75)}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity * 0.5}
      roughness={roughness + 0.15}
      metalness={0.08}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 0.8}
    />
  );

  return (
    <group>
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[def.position[0] + s * 0.10, def.position[1], def.position[2]]}>
          {/* Main kidney body */}
          <mesh
            scale={kidneyScale}
            rotation={[0, 0, s * 0.15]}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
          >
            <capsuleGeometry args={[0.5, 0.8, 10, 14]} />
            {mat}
          </mesh>
          {/* Renal hilum (indent on medial side) */}
          <mesh
            position={[-s * kidneyScale[0] * 0.7, 0, kidneyScale[2] * 0.15]}
            scale={[kidneyScale[0] * 0.35, kidneyScale[1] * 0.3, kidneyScale[2] * 0.25]}
            rotation={[0, 0, s * 0.15]}
          >
            <sphereGeometry args={[1, 10, 8]} />
            {hilumMat}
          </mesh>
          {/* Renal artery suggestion */}
          <mesh
            position={[-s * kidneyScale[0] * 0.9, kidneyScale[1] * 0.05, kidneyScale[2] * 0.1]}
            scale={[kidneyScale[0] * 0.1, kidneyScale[1] * 0.3, kidneyScale[2] * 0.08]}
            rotation={[0.3, 0, s * 0.15]}
          >
            <cylinderGeometry args={[0.4, 0.3, 1, 8]} />
            {mat}
          </mesh>
          {/* Ureter suggestion */}
          <mesh
            position={[-s * kidneyScale[0] * 0.7, -kidneyScale[1] * 0.6, 0]}
            scale={[kidneyScale[0] * 0.06, kidneyScale[1] * 0.35, kidneyScale[2] * 0.06]}
            rotation={[0.1, 0, s * 0.1]}
          >
            <cylinderGeometry args={[0.35, 0.25, 1, 6]} />
            {mat}
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ====== Female reproductive (uterus + ovaries + fallopian tubes) with texture ====== */

function FemaleReproMesh({
  def,
  organState,
  selected,
  onClick,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const { decay } = organState;
  const color = useMemo(() => organColor("reproductive", decay), [decay]);
  const emissive = useMemo(() => organEmissive("reproductive", decay), [decay]);
  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  const roughness = 0.2 + decay * 0.5;

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.10}
      wireframe={hover && !selected}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
    />
  );

  // Subtle texture bumps
  const texMat = (
    <meshStandardMaterial
      color={color.clone().multiplyScalar(0.9)}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity * 0.5}
      roughness={roughness + 0.1}
      metalness={0.08}
      transparent
      opacity={0.6}
    />
  );

  return (
    <group
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    >
      {/* Uterus body */}
      <mesh position={def.position} scale={def.scale} rotation={[0.3, 0, 0]}>
        <sphereGeometry args={[1, 18, 14]} />
        {mat}
      </mesh>
      {/* Uterine fundus (top) */}
      <mesh position={[def.position[0], def.position[1] + def.scale[1] * 0.6, def.position[2] - def.scale[2] * 0.1]} scale={[def.scale[0] * 0.7, def.scale[1] * 0.3, def.scale[2] * 0.6]} rotation={[0.3, 0, 0]}>
        <sphereGeometry args={[1, 12, 10]} />
        {mat}
      </mesh>
      {/* Cervix suggestion */}
      <mesh position={[def.position[0], def.position[1] - def.scale[1] * 0.7, def.position[2] + def.scale[2] * 0.15]} scale={[def.scale[0] * 0.25, def.scale[1] * 0.2, def.scale[2] * 0.2]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.4, 1, 8]} />
        {mat}
      </mesh>
      {/* Left ovary */}
      <mesh position={[def.position[0] - 0.09, def.position[1] + 0.03, def.position[2]]} scale={[0.035, 0.025, 0.025]}>
        <sphereGeometry args={[1, 14, 14]} />
        {mat}
      </mesh>
      {/* Right ovary */}
      <mesh position={[def.position[0] + 0.09, def.position[1] + 0.03, def.position[2]]} scale={[0.035, 0.025, 0.025]}>
        <sphereGeometry args={[1, 14, 14]} />
        {mat}
      </mesh>
      {/* Ovarian surface texture bumps */}
      {[-1, 1].map((s) => (
        <group key={`ovary-tex-${s}`}>
          <mesh position={[def.position[0] + s * 0.09, def.position[1] + 0.035, def.position[2] + 0.005]} scale={[0.015, 0.012, 0.012]}>
            <sphereGeometry args={[1, 8, 8]} />
            {texMat}
          </mesh>
          <mesh position={[def.position[0] + s * 0.09, def.position[1] + 0.025, def.position[2] - 0.005]} scale={[0.012, 0.012, 0.012]}>
            <sphereGeometry args={[1, 8, 8]} />
            {texMat}
          </mesh>
        </group>
      ))}
      {/* Left fallopian tube */}
      <mesh position={[def.position[0] - 0.05, def.position[1] + 0.04, def.position[2]]} rotation={[0, 0, 0.4]} scale={[0.05, 0.008, 0.008]}>
        <capsuleGeometry args={[0.5, 0.5, 6, 8]} />
        {mat}
      </mesh>
      {/* Right fallopian tube */}
      <mesh position={[def.position[0] + 0.05, def.position[1] + 0.04, def.position[2]]} rotation={[0, 0, -0.4]} scale={[0.05, 0.008, 0.008]}>
        <capsuleGeometry args={[0.5, 0.5, 6, 8]} />
        {mat}
      </mesh>
      {/* Fimbriae suggestion at tube ends */}
      {[-1, 1].map((s) => (
        <mesh key={`fimbriae-${s}`} position={[def.position[0] + s * 0.085, def.position[1] + 0.038, def.position[2]]} scale={[0.015, 0.015, 0.012]}>
          <sphereGeometry args={[1, 8, 8]} />
          {texMat}
        </mesh>
      ))}
    </group>
  );
}

/* ====== Male reproductive with subtle texture ====== */

function MaleReproMesh({
  def,
  organState,
  selected,
  onClick,
}: {
  def: OrganDef;
  organState: { healthScore: number; decay: number; severity: string };
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const { decay } = organState;
  const color = useMemo(() => organColor("reproductive", decay), [decay]);
  const emissive = useMemo(() => organEmissive("reproductive", decay), [decay]);
  const emissiveIntensity = selected ? 1.4 : hover ? 1.0 : 0.3 + decay * 0.6;
  const roughness = 0.2 + decay * 0.5;

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.10}
      wireframe={hover && !selected}
      transparent={decay > 0.7}
      opacity={decay > 0.7 ? 0.7 + (1 - decay) * 0.3 : 1}
    />
  );

  // Texture bumps for testes
  const texMat = (
    <meshStandardMaterial
      color={color.clone().multiplyScalar(0.92)}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity * 0.4}
      roughness={roughness + 0.1}
      metalness={0.08}
      transparent
      opacity={0.5}
    />
  );

  return (
    <group
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    >
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          {/* Testis */}
          <mesh
            position={[def.position[0] + s * 0.04, def.position[1], def.position[2]]}
            scale={[0.04, 0.055, 0.035]}
          >
            <sphereGeometry args={[1, 14, 14]} />
            {mat}
          </mesh>
          {/* Epididymis suggestion */}
          <mesh
            position={[def.position[0] + s * 0.055, def.position[1] + 0.01, def.position[2]]}
            scale={[0.012, 0.035, 0.015]}
            rotation={[0, 0, s * 0.2]}
          >
            <capsuleGeometry args={[0.3, 0.4, 6, 8]} />
            {mat}
          </mesh>
          {/* Surface texture bumps */}
          <mesh
            position={[def.position[0] + s * 0.04, def.position[1] - 0.01, def.position[2] + 0.005]}
            scale={[0.02, 0.02, 0.015]}
          >
            <sphereGeometry args={[1, 8, 8]} />
            {texMat}
          </mesh>
        </group>
      ))}
      {/* Vas deferens suggestion */}
      {[-1, 1].map((s) => (
        <mesh
          key={`vas-${s}`}
          position={[def.position[0] + s * 0.02, def.position[1] + 0.04, def.position[2]]}
          scale={[0.003, 0.04, 0.003]}
          rotation={[0, 0, s * 0.15]}
        >
          <cylinderGeometry args={[1, 0.8, 1, 6]} />
          {mat}
        </mesh>
      ))}
    </group>
  );
}

/* ====== Scene ====== */

function Scene({ state, gender, mode, selectedOrgan, onSelectOrgan }: BodyProps) {
  const defs = useMemo(() => organDefs(gender), [gender]);

  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight intensity={0.6} groundColor="#0b1220" color="#8de9ff" />
      <directionalLight position={[3, 5, 4]} intensity={1.3} color="#ffffff" />
      <directionalLight position={[-2, 3, -3]} intensity={0.4} color="#8de9ff" />
      {/* Subtle rim light for better body definition */}
      <directionalLight position={[0, 2, -4]} intensity={0.3} color="#a8d8ff" />
      {/* Subtle fill light from below for SSS effect */}
      <pointLight position={[0, 0.5, 2]} intensity={0.15} color="#ffb090" distance={3} />

      <HumanBody state={state} gender={gender} transparent={mode === "internal"} />

      {mode === "internal" && (
        <group position={[0, -0.2, 0]}>
          {defs.map((def) => {
            const organState = state.organs[def.id];
            const isSelected = selectedOrgan === def.id;
            const clickHandler = () => onSelectOrgan(def.id === selectedOrgan ? null : def.id);

            if (def.id === "brain") {
              return (
                <BrainMesh
                  key={def.id}
                  def={def}
                  organState={organState}
                  selected={isSelected}
                  onClick={clickHandler}
                />
              );
            }
            if (def.id === "heart") {
              return (
                <HeartMesh
                  key={def.id}
                  def={def}
                  organState={organState}
                  selected={isSelected}
                  onClick={clickHandler}
                />
              );
            }
            if (def.id === "lungs") {
              return (
                <LungsMesh
                  key={def.id}
                  def={def}
                  organState={organState}
                  selected={isSelected}
                  onClick={clickHandler}
                  gender={gender}
                />
              );
            }
            if (def.id === "liver") {
              return (
                <LiverMesh
                  key={def.id}
                  def={def}
                  organState={organState}
                  selected={isSelected}
                  onClick={clickHandler}
                />
              );
            }
            if (def.id === "kidneys") {
              return (
                <KidneysMesh
                  key={def.id}
                  def={def}
                  organState={organState}
                  selected={isSelected}
                  onClick={clickHandler}
                />
              );
            }
            if (def.id === "stomach") {
              return (
                <StomachMesh
                  key={def.id}
                  def={def}
                  organState={organState}
                  selected={isSelected}
                  onClick={clickHandler}
                />
              );
            }
            if (def.id === "reproductive" && gender === "female") {
              return (
                <FemaleReproMesh
                  key={def.id}
                  def={def}
                  organState={organState}
                  selected={isSelected}
                  onClick={clickHandler}
                />
              );
            }
            if (def.id === "reproductive" && gender === "male") {
              return (
                <MaleReproMesh
                  key={def.id}
                  def={def}
                  organState={organState}
                  selected={isSelected}
                  onClick={clickHandler}
                />
              );
            }

            return (
              <OrganMesh
                key={def.id}
                def={def}
                organState={organState}
                selected={isSelected}
                onClick={clickHandler}
              />
            );
          })}
        </group>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
        <ringGeometry args={[0.6, 1.4, 48]} />
        <meshBasicMaterial color="#5fe3ff" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>

      <OrbitControls
        enablePan={false}
        minDistance={1.8}
        maxDistance={6}
        target={[0, 0.8, 0]}
        autoRotate={!selectedOrgan}
        autoRotateSpeed={0.6}
      />
    </>
  );
}

function CanvasFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      3D unavailable on this device
    </div>
  );
}

export default function HumanBodyCanvas(props: BodyProps) {
  return (
    <div className="absolute inset-0 bg-transparent">
      <Canvas
        camera={{ position: [0, 0.9, 3.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "default" }}
        dpr={1}
        fallback={<CanvasFallback />}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-x-0 h-24 opacity-20"
          style={{
            background: "linear-gradient(180deg, transparent, oklch(0.82 0.16 200 / 0.6), transparent)",
            animation: "scan 6s linear infinite",
          }}
        />
      </div>
    </div>
  );
}
