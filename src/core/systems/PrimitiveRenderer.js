import * as THREE from '../extras/three'

/**
 * PrimitiveRenderer handles all rendering logic specific to primitives
 * including instance colors and GPU-based color animations
 */
export class PrimitiveRenderer {
  constructor(model) {
    this.model = model
    this.instanceColors = null
    this.instancePhases = null
    this.animationUniforms = null
    this.animationEnabled = true
    
    this.setup()
  }
  
  setup() {
    const initialSize = 10 // Match initial instance count
    
    // Setup instance color buffer
    const colors = new Float32Array(initialSize * 3) // RGB for each instance
    colors.fill(1) // Default to white
    this.instanceColors = colors
    const instanceColorAttribute = new THREE.InstancedBufferAttribute(colors, 3)
    this.model.iMesh.geometry.setAttribute('instanceColor', instanceColorAttribute)
    
    // Setup phase offset for each instance (for GPU animation)
    const phases = new Float32Array(initialSize) // One phase per instance
    for (let i = 0; i < phases.length; i++) {
      phases[i] = Math.random() * Math.PI * 2
    }
    this.instancePhases = phases
    const instancePhaseAttribute = new THREE.InstancedBufferAttribute(phases, 1)
    this.model.iMesh.geometry.setAttribute('instancePhase', instancePhaseAttribute)
    
    // Setup emissive flags (0 or 1 for each instance)
    const emissiveFlags = new Float32Array(initialSize)
    emissiveFlags.fill(1) // Default to emissive
    this.instanceEmissiveFlags = emissiveFlags
    const instanceEmissiveFlagAttribute = new THREE.InstancedBufferAttribute(emissiveFlags, 1)
    this.model.iMesh.geometry.setAttribute('instanceEmissiveFlag', instanceEmissiveFlagAttribute)
    
    // Modify material to support instance colors with GPU animation
    this.setupShader()
  }
  
  setupShader() {
    const material = this.model.material.raw
    const originalOnBeforeCompile = material.onBeforeCompile
    
    material.onBeforeCompile = (shader) => {
      // Store shader reference for uniform updates
      this.animationUniforms = shader.uniforms
      
      // Add animation uniforms
      shader.uniforms.uTime = { value: 0 }
      shader.uniforms.uColorSpeed = { value: 0.5 }
      shader.uniforms.uWaveSpeed = { value: 0.3 }
      shader.uniforms.uHueShift = { value: 0.1 } // 0.1 = 36 degrees
      shader.uniforms.uEnableAnimation = { value: this.animationEnabled ? 1.0 : 0.0 }
      shader.uniforms.uEmissiveIntensity = { value: 0.5 }
      shader.uniforms.uEmissivePulse = { value: 0.3 }
      
      // Call original onBeforeCompile if it exists
      if (originalOnBeforeCompile) {
        originalOnBeforeCompile(shader)
      }
      
      // Inject instance color and animation code
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        attribute vec3 instanceColor;
        attribute float instancePhase;
        attribute float instanceEmissiveFlag;
        varying vec3 vInstanceColor;
        varying vec3 vEmissiveColor;
        varying float vEmissiveFlag;
        uniform float uTime;
        uniform float uColorSpeed;
        uniform float uWaveSpeed;
        uniform float uHueShift;
        uniform float uEnableAnimation;
        uniform float uEmissiveIntensity;
        uniform float uEmissivePulse;
        
        // HSL to RGB conversion
        vec3 hsl2rgb(vec3 hsl) {
          float h = hsl.x;
          float s = hsl.y;
          float l = hsl.z;
          
          float c = (1.0 - abs(2.0 * l - 1.0)) * s;
          float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
          float m = l - c * 0.5;
          
          vec3 rgb;
          if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
          else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
          else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
          else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
          else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
          else rgb = vec3(c, 0.0, x);
          
          return rgb + m;
        }
        
        // RGB to HSL conversion
        vec3 rgb2hsl(vec3 rgb) {
          float maxVal = max(max(rgb.r, rgb.g), rgb.b);
          float minVal = min(min(rgb.r, rgb.g), rgb.b);
          float delta = maxVal - minVal;
          
          float l = (maxVal + minVal) * 0.5;
          float s = 0.0;
          float h = 0.0;
          
          if (delta > 0.001) {
            s = l > 0.5 ? delta / (2.0 - maxVal - minVal) : delta / (maxVal + minVal);
            
            if (maxVal == rgb.r) {
              h = mod((rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6.0 : 0.0), 6.0) / 6.0;
            } else if (maxVal == rgb.g) {
              h = ((rgb.b - rgb.r) / delta + 2.0) / 6.0;
            } else {
              h = ((rgb.r - rgb.g) / delta + 4.0) / 6.0;
            }
          }
          
          return vec3(h, s, l);
        }`
      )
      
      // Animate colors in vertex shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        
        // Start with instance color
        vec3 animatedColor = instanceColor;
        
        if (uEnableAnimation > 0.5) {
          // Convert to HSL for animation
          vec3 hsl = rgb2hsl(instanceColor);
          
          // Animate hue with phase offset
          float hueAnimation = sin(uTime * uColorSpeed + instancePhase) * uHueShift;
          
          // Add wave effect based on instance ID
          float waveOffset = float(gl_InstanceID) / 1000.0 * 3.14159;
          float waveIntensity = sin(uTime * uWaveSpeed + waveOffset) * 0.5 + 0.5;
          hueAnimation += waveIntensity * 0.05; // Subtle wave effect
          
          // Apply hue animation
          hsl.x = fract(hsl.x + hueAnimation);
          
          // Subtle saturation and lightness pulse
          hsl.y = clamp(hsl.y + sin(uTime * uColorSpeed * 1.5 + instancePhase) * 0.1, 0.0, 1.0);
          hsl.z = clamp(hsl.z + sin(uTime * uColorSpeed * 0.7 + instancePhase) * 0.05, 0.0, 1.0);
          
          // Convert back to RGB
          animatedColor = hsl2rgb(hsl);
        }
        
        vInstanceColor = animatedColor;
        vEmissiveFlag = instanceEmissiveFlag;
        
        // Calculate emissive color only if this instance is emissive
        // Brighter objects emit more light
        float brightness = dot(animatedColor, vec3(0.299, 0.587, 0.114));
        float emissivePulse = sin(uTime * uColorSpeed * 2.0 + instancePhase * 2.0) * uEmissivePulse + uEmissivePulse;
        vEmissiveColor = animatedColor * brightness * uEmissiveIntensity * (1.0 + emissivePulse) * instanceEmissiveFlag;`
      )
      
      // Apply instance color in fragment shader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vInstanceColor;
        varying vec3 vEmissiveColor;`
      )
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= vInstanceColor;`
      )
      
      // Add emissive color
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vEmissiveColor;`
      )
    }
  }
  
  setInstanceColor(index, color) {
    if (!color) return
    
    const idx3 = index * 3
    this.instanceColors[idx3] = color.r
    this.instanceColors[idx3 + 1] = color.g
    this.instanceColors[idx3 + 2] = color.b
    this.model.iMesh.geometry.attributes.instanceColor.needsUpdate = true
  }
  
  setInstanceEmissive(index, isEmissive) {
    this.instanceEmissiveFlags[index] = isEmissive ? 1.0 : 0.0
    this.model.iMesh.geometry.attributes.instanceEmissiveFlag.needsUpdate = true
  }
  
  onResize(newSize) {
    // Resize instance color buffer
    const newColors = new Float32Array(newSize * 3)
    newColors.set(this.instanceColors)
    newColors.fill(1, this.instanceColors.length) // Fill new slots with white
    this.instanceColors = newColors
    const instanceColorAttribute = new THREE.InstancedBufferAttribute(newColors, 3)
    this.model.iMesh.geometry.setAttribute('instanceColor', instanceColorAttribute)
    
    // Resize phase buffer
    const newPhases = new Float32Array(newSize)
    newPhases.set(this.instancePhases)
    // Fill new phases with random values
    for (let i = this.instancePhases.length; i < newSize; i++) {
      newPhases[i] = Math.random() * Math.PI * 2
    }
    this.instancePhases = newPhases
    const instancePhaseAttribute = new THREE.InstancedBufferAttribute(newPhases, 1)
    this.model.iMesh.geometry.setAttribute('instancePhase', instancePhaseAttribute)
    
    // Resize emissive flags buffer
    const newEmissiveFlags = new Float32Array(newSize)
    newEmissiveFlags.set(this.instanceEmissiveFlags)
    newEmissiveFlags.fill(1, this.instanceEmissiveFlags.length) // Default new ones to emissive
    this.instanceEmissiveFlags = newEmissiveFlags
    const instanceEmissiveFlagAttribute = new THREE.InstancedBufferAttribute(newEmissiveFlags, 1)
    this.model.iMesh.geometry.setAttribute('instanceEmissiveFlag', instanceEmissiveFlagAttribute)
  }
  
  updateAnimationUniforms(time) {
    if (this.animationUniforms) {
      this.animationUniforms.uTime.value = time
    }
  }
  
  setAnimationEnabled(enabled) {
    this.animationEnabled = enabled
    if (this.animationUniforms) {
      this.animationUniforms.uEnableAnimation.value = enabled ? 1.0 : 0.0
    }
  }
}