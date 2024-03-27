import './style/main.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { extendMaterial } from './lib/extend-material.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
/**
 * GUI Controls
 */
import * as dat from 'dat.gui';
import {TextureLoader} from 'three';

let mesh;
const params = {
  wireframe: false,
  progress: 0,
  polar: -1,
  size: 50,
  scale: 1,
  locprog: 0.8,
  twist_self: 0,
  twist: 0
};

const gui = new dat.GUI();

gui.add(params, 'wireframe').onChange(val => {
  mesh.material.wireframe = val;
});

gui.add(params, 'progress', 0, 1, 0.001).onChange(val => {
  mesh.material.uniforms.progress.value = val;
});

gui.add(params, 'polar', -1, 1, 0.001).onChange(val => {
  mesh.material.uniforms.polar.value = val;
});

gui.add(params, 'size', 1., 50.).onChange(val => {
  mesh.material.uniforms.size.value = val;
});

gui.add(params, 'scale', 0., 1.).onChange(val => {
  mesh.material.uniforms.scale.value = val;
});

gui.add(params, 'locprog', 0., 1.).onChange(val => {
  mesh.material.uniforms.locprog.value = val;
});

gui.add(params, 'twist_self', -10., 10.).onChange(val => {
  mesh.material.uniforms.twist_self.value = val;
});

gui.add(params, 'twist', -2., 2.).onChange(val => {
  mesh.material.uniforms.twist.value = val;
});

function getRandom(geometry) {
  const len = geometry.attributes.position.count;
  const random = new Float32Array(len);
  for (let i = 0; i < len; i+= 3) {
    const r = Math.random() * 2. + 1.5;
    random.set([r, r, r], i);
  }

  return random;
}

function getCenters(geometry) {
  const len = geometry.attributes.position.count;
  const pos = geometry.attributes.position.array;
  const centers = new Float32Array(len * 3);
  for (let i = 0; i < len; i+= 3) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];

    const x1 = pos[i * 3 + 3];
    const y1 = pos[i * 3 + 4];
    const z1 = pos[i * 3 + 5];

    const x2 = pos[i * 3 + 6];
    const y2 = pos[i * 3 + 7];
    const z2 = pos[i * 3 + 8];

    const center = new THREE.Vector3(x, y, z).add(new THREE.Vector3(x1, y1, z1)).add(new THREE.Vector3(x2, y2, z2)).divideScalar(3);
    centers.set([center.x, center.y, center.z, center.x, center.y, center.z, center.x, center.y, center.z], i * 3);
  }

  return centers;
}

function getCentroid(ar, len) {
  let x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < len; i+= 3) {
    x += ar[i];
    y += ar[i + 1];
    z += ar[i + 2];
  }
  return { x: (3 * x) / len, y: (3 * y) / len, z: (3 * z) / len };
}

function getCentroids(geometry) {
  let ar = geometry.attributes.position.array;
  let len = geometry.attributes.position.count;
  let centroidVector = getCentroid(ar, len);
  let centroid = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < len * 3; i = i + 3) {
    centroid[i] = centroidVector.x;
    centroid[i + 1] = centroidVector.y;
    centroid[i + 2] = centroidVector.z;
  }
  return centroid;
}

const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene();
const loader = new THREE.CubeTextureLoader();
loader.setPath( 'Bridge2/' );
const envTexture = loader.load( [ 'posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg' ] );
envTexture.encoding = THREE.sRGBEncoding;

const texture = new TextureLoader().load('transition3.png', texture => {
  texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
});

const ambiantLight = new THREE.AmbientLight(0x222326);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(1500, 1500, 4, 4),
  new THREE.MeshStandardMaterial({
    color: 0x111111,
  })
);
floor.rotateX(-Math.PI * 0.5);
floor.translateZ(-19.5);
floor.castShadow = false;
floor.receiveShadow = true;

const material = new THREE.MeshStandardMaterial({color: 0xf7f1e1});
const extendedMaterial = new extendMaterial(THREE.MeshStandardMaterial, {
  vertexHeader: `
  uniform float progress;

  uniform float polar;
  uniform float size;
  uniform float scale;
  uniform float locprog;
  uniform float twist_self;
  uniform float twist;

  uniform sampler2D alphaMap;

  attribute vec3 centers;
  attribute vec3 centroid;
  attribute float aRandom;

  varying vec3 vPosition;

  mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
  }

  vec3 rotate(vec3 v, vec3 axis, float angle) {
    mat4 m = rotationMatrix(axis, angle);
    return (m * vec4(v, 1.0)).xyz;
  }

  `,

  vertex: {
    transformEnd: `
    vPosition = position;

    float prog = ((polar * position.y + size) / (2. * size));
    float locprog = clamp((progress - locprog * prog) / (1. - locprog), 0., 1.);
    transformed -= centers * aRandom;
    transformed = rotate(transformed, centroid, aRandom * locprog * 3.14 * sin(locprog) * twist_self);
    transformed *= 1. - locprog * (1. - scale) * normalize(aRandom);
    transformed += centers * aRandom;

    transformed = rotate(transformed + centers, vec3(0., 1., 0.), aRandom * locprog * 3.14 * sin(locprog) * twist);
    transformed -= centers;
    `
  },
  fragmentHeader: `
  uniform float progress;

  uniform float polar;
  uniform float size;
  uniform sampler2D map2;
  
  float force = 0.5;

  varying vec3 vPosition;
  `,
  fragment: {
    '#include <alphamap_fragment>':
    `
    #ifdef USE_ALPHAMAP
        vec2 uv = vUv;
        vec4 transitionTexel = texture2D(alphaMap, vec2(vUv.x * 10., vUv.y));

        float threshold = 1.0;

        float prog = ((polar * vPosition.y + size) / (2. * size));
        float locprog = clamp((progress - force * prog) / (1. - force), 0., 1.);

        float r = locprog * (1.0 + threshold * 2.0) - threshold;
        float mixf=clamp(((transitionTexel.r) - r)*(1.0/threshold), 0.0, 1.0);

        vec4 orig1 = vec4(1., 0.3, 0.3, 1.0);
        vec4 orig2 = vec4(1., 233. / 255., 174. / 255., 0.5);

        vec4 texelColor = mix(orig1, orig2, mixf);
        texelColor = mapTexelToLinear( texelColor );
        diffuseColor *= texelColor;
    #endif
    `
  },
  material: {
    fog: true,
    needsUpdate: true
  },
  uniforms: {
    alphaMap: texture,
    envMap: envTexture,
    roughness: 0.15,
    metalness: 0.0,
    progress: {
      value: 0.,
      mixed: true,
      linked: true
    },
    polar: {
      value: 1,
      mixed: true,
      linked: true
    },
    size: {
      value: 50.,
      mixed: true,
      linked: true
    },
    scale: {
      value: 0.,
      mixed: true,
      linked: true
    },
    locprog: {
      value: 0.5,
      mixed: true,
      linked: true
    },
    twist_self: {
      value: 0.5,
      mixed: true,
      linked: true
    },
    twist: {
      value: 1,
      mixed: true,
      linked: true
    }
  },
  template: material
});
extendedMaterial.side = THREE.DoubleSide;


// Create Mesh & Add To Scene
new PLYLoader().load( 'ply/binary/Lucy100k.ply', function ( geometry ) {
  geometry.scale( 0.024, 0.024, 0.024 );
  geometry.computeVertexNormals();
  const geo = geometry.toNonIndexed();

  geo.setAttribute('centers', new THREE.BufferAttribute(getCenters(geo), 3));
  geo.setAttribute('aRandom', new THREE.BufferAttribute(getRandom(geo), 1));
  geo.setAttribute('centroid', new THREE.BufferAttribute(getCentroids(geo), 3));

  mesh = new THREE.Mesh( geo, extendedMaterial );
  mesh.rotation.y = - Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = extendMaterial(THREE.MeshDepthMaterial, {template: extendedMaterial});
  mesh.customDepthMaterial.depthPacking = THREE.RGBADepthPacking;
  mesh.customDepthMaterial.alphaTest = 0.5;
  scene.add( mesh );
});

const spotLight = new THREE.SpotLight( 0xFFFFFF, 1 );
spotLight.position.set( 50, 80, 50 );
spotLight.angle = Math.PI / 8;
spotLight.penumbra = 1;
spotLight.decay = 2;
spotLight.distance = 200;
spotLight.shadow.mapSize.width = 1024 * 4;
spotLight.shadow.mapSize.height = 1024 * 4;
spotLight.shadow.focus = 1;
spotLight.shadow.radius = 5;
spotLight.shadow.bias = -0.0001;
spotLight.shadow.normalBias = 0.0001;
spotLight.shadow.blurSamples = 30;
spotLight.castShadow = true;

const lightProbe = new THREE.LightProbe();


const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  // Update camera
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.001,
  5000
);

camera.position.x = 1;
camera.position.y = 1;
camera.position.z = 40;

scene.add(lightProbe);
scene.add(spotLight);
scene.add(ambiantLight);
scene.add(floor);
scene.add(camera);
scene.background = new THREE.Color( 0x111111 );
scene.fog = new THREE.FogExp2( 0x111111, 0.01 );

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.autoRotate = true
controls.enableZoom = true
controls.enablePan = false
controls.dampingFactor = 0.05
controls.maxDistance = 300
controls.minDistance = 20
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
}
controls.target.set( 0, 10, 0 );

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  // logarithmicDepthBuffer: true // Needed for post processing effects (depth of faces well calculated with this to true)
})
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(sizes.width, sizes.height);

renderer.shadowMap.enabled = true;
renderer.shadowMap.needsUpdate = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

/**
 * Animate
 */
const clock = new THREE.Clock()
const tick = () => {
  // const elapsedTime = clock.getElapsedTime();
  spotLight.position.x = camera.position.x + 5;
  spotLight.position.y = camera.position.y + 15;
  spotLight.position.z = camera.position.z;

  mesh && (mesh.material.uniforms.progress.value = Math.abs(Math.abs(controls.getAzimuthalAngle() / Math.PI) - 0.5) * 2);

  controls.update()

  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick)
}

tick()
