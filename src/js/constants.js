
// Constants
const textSize = 0.1;


// MATERIALS
// Ground material
const groundMaterial = new THREE.MeshPhongMaterial({
    //color: 0x98FB98,
    color: 	0xECECEC,
    shininess: 0.1,
    opacity: 1
});

// FloorPlan Materials
const floorMaterial = new THREE.MeshPhongMaterial({
    color: 0x6083c2,
    side: THREE.DoubleSide,
    wireframe: false
});

// Wall Material
const wallMaterial = new THREE.MeshPhongMaterial({
    color: 0x6083c2,
    side: THREE.DoubleSide,
    wireframe: false
});
wallMaterial.transparent = true;
wallMaterial.opacity = 0.5;

// Door Material
const doorMaterial = new THREE.MeshPhongMaterial({
    color: 0xF5DEB3,
    side: THREE.DoubleSide,
    wireframe: false,
    transparent: true,
    opacity: 0.5
});

// Window Material
const windowMaterial = new THREE.MeshPhongMaterial({
    color: 0xC0C0C0,
    side: THREE.DoubleSide,
    wireframe: false,
    transparent: true,
    opacity: 0.2,
    shininess: 100
});

// Object Materials
const objectMaterial = new THREE.MeshPhongMaterial({
    color: 0xB0E0E6,
    side: THREE.DoubleSide,
    wireframe: false
});
