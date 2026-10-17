import * as THREE from 'three';

// Height-aware haze: three's FogExp2, thickened in low ground (the river
// valley, the fields) and thinning with altitude, so distant hills stand
// out of a dusty valley haze. World height is recovered from the view-space
// position, which every fogged built-in shader (sprites included) has.
const FOG_BASE = '0.0', FOG_FALLOFF = '0.055';
THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
	varying float vFogDepth;
	varying float vFogWorldY;
#endif
`;
THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWorldY = dot( viewMatrix[ 1 ].xyz, mvPosition.xyz - viewMatrix[ 3 ].xyz );
#endif
`;
THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying float vFogWorldY;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
`;
THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogH = exp( - max( vFogWorldY - ${FOG_BASE}, 0.0 ) * ${FOG_FALLOFF} );
		float fogD = fogDensity * vFogDepth;
		float fogFactor = 1.0 - exp( - fogD * fogD * ( 0.55 + 0.75 * fogH ) );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;

/**
 * Creates the WebGL renderer + scene + fog backbone.
 * HDR, physically based lighting; tone mapping happens in the post composite.
 */
export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  // PCF with a Vogel-disk radius (light.shadow.radius) gives soft sun shadows
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Town geometry and the key light are slow-moving. Refresh the shadow atlas
  // at a modest cadence for people/cloth/balloon rather than at 60Hz.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  // tone mapping lives in the composite pass, not the renderer
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = null; // the sky dome is the background
  scene.fog = new THREE.FogExp2(0xb8b4a8, 0.0036);

  const onResize = (camera, composer) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  };

  return { renderer, scene, onResize };
}
