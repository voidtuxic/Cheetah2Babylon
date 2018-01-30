let meshes = [];
let cameras = [];
let lights = [];
let materials = [];

class BabylonMesh {
  constructor(obj) {
    let core = obj.core();
    if (core == null) {
      this.notMesh = true;
      return;
    }

    if (obj.materialTags() && obj.materialTags().length > 0) {
      let matId = obj.materialTags()[0].linkedToMaterial();
      this.materialId = materials[matId].id;
      if (materials[matId].diffuseTexture) {
        let vec2 = obj.materialTags()[0].getParameter('UVOffset');
        materials[matId].diffuseTexture.uOffset = vec2.x;
        materials[matId].diffuseTexture.vOffset = vec2.y;
        vec2 = obj.materialTags()[0].getParameter('UVScale');
        materials[matId].diffuseTexture.uScale = vec2.x;
        materials[matId].diffuseTexture.vScale = vec2.y;
        let vec3 = obj.materialTags()[0].getParameter('shadingRotation');
        materials[matId].diffuseTexture.uAng = vec3.x;
        materials[matId].diffuseTexture.vAng = vec3.y;
        materials[matId].diffuseTexture.wAng = vec3.z;
      }
    } else {
      this.materialId = '';
    }

    this.name = obj.getParameter('name');
    this.id = obj.getParameter('name');
    let vec3 = obj.getParameter('position');
    this.position = [vec3.x, vec3.y, vec3.z];
    vec3 = obj.getParameter('rotation');
    this.rotation = [vec3.y * Math.PI / 180, -vec3.x * Math.PI / 180, -vec3.z * Math.PI / 180];

    // this.rotation = [vec3.x, vec3.y, vec3.z];

    vec3 = obj.getParameter('scale');
    this.scaling = [vec3.x, vec3.y, vec3.z];
    this.isVisible = true;
    this.isEnabled = true;
    this.checkCollisions = false;
    this.billboardMode = 0;
    this.receiveShadows = true;

    this.positions = [];
    this.indices = [];
    this.uvs = [];
    this.uvs2 = [];
    this.normals = [];
    let tmpnormals = [];
    let tmpuv = [];

    for (let v = 0; v < core.vertexCount(); v++) {
      let vertex = core.vertex(v);
      this.positions.push(vertex.x);
      this.positions.push(vertex.y);
      this.positions.push(vertex.z);
    }

    for (let p = 0; p < core.polygonCount(); p++) {
      for (let t = 0; t < core.polygonSize(p) - 2; t++) {
        let triangle = core.triangle(p, t);
        for (let i = 0; i < 3; i++) {
          this.indices.push(core.vertexIndex(p, triangle[i]));
          if (!tmpnormals[core.vertexIndex(p, triangle[i])])
            tmpnormals[core.vertexIndex(p, triangle[i])] = [];
          tmpnormals[core.vertexIndex(p, triangle[i])].push(core.normal(p));
          // textcoord0 is [x,y], textcoord1 is [z,w]. Awesome doc work btw Cheetah3D
          tmpuv[core.vertexIndex(p, triangle[i])] = core.uvCoord(p, triangle[i]);
        }
      }
    }

    for (let n = 0; n < tmpnormals.length; n++) {
      let normal = tmpnormals[n];
      let fn = new Vec3D(0, 0, 0);
      for (let nb in normal) {
        fn = add(fn, normal[nb]);
      }
      let nrm = norm(fn);
      fn = mult(fn, 1 / nrm);
      this.normals.push(fn.x);
      this.normals.push(fn.y);
      this.normals.push(fn.z);
    }

    for (let n = 0; n < tmpuv.length; n++) {
      let uvCoords = tmpuv[n];
      if (uvCoords == null) // sometimes normals get randomly nulled, wth cheetah3d
      {
        uvCoords = {};
        uvCoords.x = 0;
        uvCoords.y = 0;
        uvCoords.z = 0;
        uvCoords.w = 0;
      }
      this.uvs.push(1 - uvCoords.x);
      this.uvs.push(1 - uvCoords.y);
      this.uvs2.push(1 - uvCoords.z);
      this.uvs2.push(1 - uvCoords.w);
    }

    // no multiple submesh for now
    this.subMeshes = [
      {
        'materialIndex': 0,
        'verticesStart': 0,
        'verticesCount': core.vertexCount(),
        'indexStart':    0,
        'indexCount':    core.triangleCount() * 3
      }
    ];

  }
}

class BabylonCamera {
  constructor(cheetahCam) {
    this.name = cheetahCam.getParameter('name');
    this.id = cheetahCam.getParameter('name');
    let vec3 = cheetahCam.getParameter('position');
    this.position = [-vec3.x, vec3.y, vec3.z];
    this.fov = cheetahCam.getParameter('fieldOfView') * Math.PI / 180;
    this.minZ = cheetahCam.getParameter('clipNear');
    this.maxZ = cheetahCam.getParameter('clipFar');
    // default values until we can find if cheetah3d has such data
    vec3 = cheetahCam.getParameter('rotation');
    let angles = [vec3.y * Math.PI / 180, -vec3.x * Math.PI / 180, -vec3.z * Math.PI / 180];
    // shamefully copied from http://www.euclideanspace.com/maths/geometry/rotations/conversions/eulerToQuaternion/
    // using quaternion x vector multiplication from http://molecularmusings.wordpress.com/2013/05/24/a-faster-quaternion-vector-multiplication/
    let c1 = Math.cos(angles[1]);
    let s1 = Math.sin(angles[1]);
    let c2 = Math.cos(angles[2]);
    let s2 = Math.sin(angles[2]);
    let c3 = Math.cos(angles[0]);
    let s3 = Math.sin(angles[0]);
    let w = Math.sqrt(1.0 + c1 * c2 + c1 * c3 - s1 * s2 * s3 + c2 * c3) / 2.0;
    let w4 = (4.0 * w);
    let x = (c2 * s3 + c1 * s3 + s1 * s2 * c3) / w4;
    let y = (s1 * c2 + s1 * c3 + c1 * s2 * s3) / w4;
    let z = (-s1 * s3 + c1 * s2 * c3 + s2) / w4;
    let qv = new Vec3D(x, y, z);
    let up = new Vec3D(0, 1, 0);
    let t = qv.cross(up).multiply(2);
    let vf = up.add(t.multiply(w).add(qv.cross(t)));
    this.target = [-vf.x, -vf.y, -vf.z];
    this.speed = 1;
    this.inertia = 0.9;
    this.checkCollisions = false;
    this.applyGravity = false;
    this.ellipsoid = [
      0.2,
      0.9,
      0.2
    ];
  };
}

class BabylonLight {
  constructor (cheetahLight, type) {
    let vec3 = cheetahLight.getParameter('position');
    vec3 = cheetahLight.getParameter('rotation');

    let angles = [vec3.y * Math.PI / 180, -vec3.x * Math.PI / 180, -vec3.z * Math.PI / 180];
    // shamefully copied from http://www.euclideanspace.com/maths/geometry/rotations/conversions/eulerToQuaternion/
    // using quaternion x vector multiplication from http://molecularmusings.wordpress.com/2013/05/24/a-faster-quaternion-vector-multiplication/
    let c1 = Math.cos(angles[1]);
    let s1 = Math.sin(angles[1]);
    let c2 = Math.cos(angles[2]);
    let s2 = Math.sin(angles[2]);
    let c3 = Math.cos(angles[0]);
    let s3 = Math.sin(angles[0]);
    let w = Math.sqrt(1.0 + c1 * c2 + c1 * c3 - s1 * s2 * s3 + c2 * c3) / 2.0;
    let w4 = (4.0 * w);
    let x = (c2 * s3 + c1 * s3 + s1 * s2 * c3) / w4;
    let y = (s1 * c2 + s1 * c3 + c1 * s2 * s3) / w4;
    let z = (-s1 * s3 + c1 * s2 * c3 + s2) / w4;
    let qv = new Vec3D(x, y, z);
    let up = new Vec3D(0, 1, 0);
    let t = qv.cross(up).multiply(2);
    let vf = up.add(t.multiply(w).add(qv.cross(t)));
    let color4 = cheetahLight.getParameter('color');

    Object.assign(this, {
      name:                  cheetahLight.getParameter('name'),
      id:                    cheetahLight.getParameter('name'),
      tags:                  '',
      type:                  type, // int (0 for point light, 1 for directional, 2 for spot and 3 for hemispheric),
      position:              [vec3.x, vec3.y, vec3.z],
      direction:             [-vf.x, -vf.y, -vf.z],
      angle:                 type === 2 ? cheetahLight.getParameter('cutOffAngle') * Math.PI / 180 : 0,
      exponent:              type === 2 ? cheetahLight.getParameter('cutOffAttenuation') : 1,
      groundColor:           [color4.x, color4.y, color4.z],
      intensity:             cheetahLight.getParameter('intensity'),
      range:                 1,
      diffuse:               [color4.x, color4.y, color4.z],
      specular:              [1, 1, 1],
      excludedMeshesIds:     [],
      includedOnlyMeshesIds: [],
      animations:            [],
      autoAnimate:           false,
      autoAnimateFrom:       0,
      autoAnimateTo:         0,
      autoAnimateLoop:       false,
      autoAnimateSpeed:      1
    });
  };
}

class BabylonTexture {
  constructor(filename = '', texture = '') {
    Object.assign(this, {
      name:             filename,
      level:            1,
      hasAlpha:         false,
      getAlphaFromRGB:  false,
      coordinatesMode:  0, // int (0 = explicit, 1 spherical, 2 = planar, 3 = cubic, 4 = projection, 5 = skybox)
      uOffset:          texture.position.x,
      vOffset:          texture.position.x,
      uScale:           texture.scale.x,
      vScale:           texture.scale.y,
      uAng:             0,
      vAng:             0,
      wAng:             0,
      wrapU:            !!texture.tileU,
      wrapV:            !!texture.tileV,
      coordinatesIndex: 0,
      animations:       [],
      base64String:     ''
    });
  }
}

class BabylonColor3 {
  constructor(r = 1, g = 1, b = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  export() {
    return [this.r, this.g, this.b];
  }
}

class BabylonColor4 extends BabylonColor3 {
  constructor(r = 1, g = 1, b = 1, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}

class BabylonFresnel {
  constructor() {
    this.isEnabled = false;
    this.leftColor = new BabylonColor3(1, 1, 1, 1);
    this.rightColor = new BabylonColor3(1, 1, 1, 1);
    this.bias = 1.0;
    this.power = 1;
  }
}

const MATERIAL_TAGS = '';
const MATERIAL_DISABLE_DEPTH_WRITE = false;
const MATERIAL_CHECK_READY_ONLY_ONCE = true;
const MATERIAL_USE_EMISSIVE_AS_ILLUMINATION = false;

function getFunctions(obj) {
  let functions = [];

  for (var f in obj) {
    if (typeof obj[f] === 'function') {
      functions.push(f);
    }
  }

  return functions.sort();
}

function getParameters(obj) {
  let count = obj.parameterCount();
  let params = {};
  for (let i = 0; i < count; i++) {
    let param = obj.parameterAtIndex(i);
    params[param.name()] = obj.getParameter(param.name());
  }

  return params;
}

class BabylonMaterial {
  constructor(material) {
    let rootnode = material.rootNode();            // get the root node of the material
    let textures = {};
    for (let j = 0; j < rootnode.inputCount(); j++) {
      let param = rootnode.inputAtIndex(j);
      if (param.connected() !== true) continue;    // if the parameter is not connected, exit
      let nodeID = param.connectedWithID();        // Get the ID of the node this texture is connected with
      let node = material.nodeWithID(nodeID);      // get the node with ID from the material
      if (node === null) continue;                 // skip if node is null
      if (node.nodeType() !== 'image') continue;   // skip if node is not an image
      Object.assign(textures, {
        [param.name()]: getParameters(node)
      });
    }

    let name = material.getParameter('name');
    let diffuse = material.color();
    let specular = material.specular();
    let emission = material.emission();

    Object.assign(this, {
      name:              name,
      id:                name,
      tags:              MATERIAL_TAGS,
      disableDepthWrite: MATERIAL_DISABLE_DEPTH_WRITE,
      ambient:           new BabylonColor3(diffuse.x, diffuse.y, diffuse.z).export(),
      diffuse:           new BabylonColor3(diffuse.x, diffuse.y, diffuse.z).export(),
      specular:          new BabylonColor3(specular.x, specular.y, specular.z).export(),
      specularPower:     material.shininess(),
      emissive:          new BabylonColor3(emission.x, emission.y, emission.z).export(),
      alpha:             1.0,
      backFaceCulling:   true,
      wireframe:         false,
      /* diffuseTexture:                   new BabylonTexture(),
         ambientTexture:                   new BabylonTexture(),
         opacityTexture:                   new BabylonTexture(),
         reflectionTexture:                new BabylonTexture(),
         refractionTexture:                new BabylonTexture(),
         indexOfRefraction:                1.0,
         emissiveTexture:                  new BabylonTexture(),
         specularTexture:                  new BabylonTexture(),
         bumpTexture:                      new BabylonTexture(),
         lightmapTexture:                  new BabylonTexture(),
         useLightmapAsShadowmap:           false,
         checkReadyOnlyOnce:               MATERIAL_CHECK_READY_ONLY_ONCE,
         useReflectionFresnelFromSpecular: false,
         useEmissiveAsIllumination:        false,
         diffuseFresnelParameters:         null,
         opacityFresnelParameters:         null,
         reflectionFresnelParameters:      null,
         refractionFresnelParameters:      null,
         emissiveFresnelParameters:        null */
    });

    let channelMappings = {
      diffColor:  'diffuseTexture',
      specColor:  'specularTexture',
      emisColor:  'emissiveTexture',
      bump:       'bumpTexture',
      reflColor:  'reflectionTexture',
      transColor: 'opacityTexture'
    };

    for (const cheetahChannel of Object.keys(channelMappings)) {
      let babylonChannel = channelMappings[cheetahChannel];
      if (!textures.hasOwnProperty(cheetahChannel)) continue;
      let texture = textures[cheetahChannel];
      let parts = texture.texture.split('/');
      let filename = parts[parts.length - 1];
      this[babylonChannel] = new BabylonTexture(filename, texture);
    }
    print(JSON.stringify(this, null, 2));
  };
}

/**
 *
 * @param obj
 * @param parentId
 */
function getChildren(obj, parentId) {
  for (let i = 0; i < obj.childCount(); i++) {
    let child = obj.childAtIndex(i);
    let name = obj.getParameter('name');
    let type = child.type();
    print(`${name}: type=${type}`);

    switch (child.type()) {
      case LIGHT: {
        let lightType = child.getParameter('lightType');
        print(`${name} (${type}), lightType=${lightType}`);

        // cheetah    babylon
        // ambient 0  3 (hemispheric)
        // area    1  3 (hemispheric)
        // distant 2  1 (directional)
        // point   3  0 (point)
        // spot    4  2 (spot)

        switch (lightType) {
          case 0: // ambient
            lights.push(new BabylonLight(child, 3)); // hemispheric
            break;
          case 1: // area
            lights.push(new BabylonLight(child, 0)); // hemispheric
            break;
          case 2: // distant
            lights.push(new BabylonLight(child, 1)); // directional
            break;
          case 3: // point
            lights.push(new BabylonLight(child, 0)); // point
            break;
          case 4: // spot
            lights.push(new BabylonLight(child, 2)); // spot
            break;
          default:
            lights.push(new BabylonLight(child, 0)); // point
            break;
        }
      } break;

      case CAMERA: {
        let camera = new BabylonCamera(child);
        cameras.push(camera);
      } break;

      default: {
        let mesh = new BabylonMesh(child);
        if (parentId) {
          mesh.parentId = parentId;
        }
        // parentId = mesh.id;
        if (!mesh.notMesh) {
          meshes.push(mesh);
        }
      } break;
    }

    if (child.childCount() > 0) {
      getChildren(child, child.id);
    }
  }
}

function describeScene(obj, level = 0) {
  if (level === 0) {
    print('root');
  }

  let padding = new Array(level * 2).join(' ');

  for (let i = 0; i < obj.childCount(); i++) {
    let child = obj.childAtIndex(i);
    let name = child.getParameter('name');
    let type = child.type();
    print(`${padding}+ ${name} (${type})`);

    if (child.childCount() > 0) {
      describeScene(child, level + 1);
    }
  }
}

/**
 * Main script entry-point.
 * @param {Object} doc The Cheetah3D document object.
 */
function main(doc) {
  clearConsole();

  let path = `/Users/peter/Development/galactikore/public/src/media/scenes/testScene.babylon`;

  let start = Date.now();
  let exportFile = path;

  let obj = doc.root();

  describeScene(obj);

  for (let i = 0; i < doc.materialCount(); i++) {
    let mat = doc.materialAtIndex(i);
    materials.push(new BabylonMaterial(mat));
  }

  getChildren(obj, 0);

  let scene = {
    autoClear:        true,
    clearColor:       [0.3, 0.3, 0.3],
    ambientColor:     [1, 1, 1],
    gravity:          [0, -9.8, 0],
    cameras:          cameras,
    activeCamera:     cameras[0].id,
    lights:           lights,
    materials:        materials,
    meshes:           meshes,
    multiMaterials:   [],
    shadowGenerators: [],
    skeletons:        [],
  };

  /*let path = OS.runSavePanel('babylon');
  if (path == null) {
    return;
  }
*/
  //open file
  let file = new File(path);
  file.open(WRITE_MODE);
  file.write(JSON.stringify(scene, null, 2));
  file.close();

  // print(materials.length + ' materials');
  // print(meshes.length + ' meshes');
  // print(cameras.length + ' cameras');
  // print(lights.length + ' lights');

  let end = Date.now();

  print(`\nExported to ${exportFile} (${end - start} ms)`);

  print('\n\n');
}

/**
 * Add any number of vectors.
 * @return {Vec3D}
 */
function add() {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < arguments.length; i++) {
    x += arguments[i].x;
    y += arguments[i].y;
    z += arguments[i].z;
  }
  return new Vec3D(x, y, z);
}

/**
 * Multiply two vectors.
 * @param a
 * @param s
 * @return {Vec3D}
 */
function mult(a, s) {
  return new Vec3D(a.x * s, a.y * s, a.z * s);
}

/**
 * Compute the dot-product of two vectors.
 * @param a
 * @param b
 * @return {number}
 */
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Compute a vector's normal.
 * @param a
 * @return {number}
 */
function norm(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

/**
 * Compute the cross-product of two vectors.
 * @param a
 * @param b
 * @return {Vec3D}
 */
function cross(a, b) {
  return new Vec3D(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}