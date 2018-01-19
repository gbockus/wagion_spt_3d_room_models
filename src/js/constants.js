
angular.module("roomModelViewer", []);

angular.module("roomModelViewer").constant("constant", {
    textFont: 'js/fonts/helvetiker_regular.typeface.json',
    textSize:  0.1,
    groundMaterial:new THREE.MeshPhongMaterial({
        //color: 0x98FB98,
        color: 	0xECECEC,
        shininess: 0.1,
        opacity: 1
    }),
    floorMaterial: new THREE.MeshPhongMaterial({
        color: 0x6083c2,
        //color: 0x30C4BD,
        side: THREE.DoubleSide,
        wireframe: false
    }),
    wallMaterial: new THREE.MeshPhongMaterial({
        color: 0x6083c2,
        //color: 0x30C4BD,
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,
        opacity: 0.5
    }),
    doorMaterial: new THREE.MeshPhongMaterial({
        color: 0xF5DEB3,
        //color: 0x8F5EC0,
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,
        opacity: 0.5
    }),
    windowMaterial: new THREE.MeshPhongMaterial({
        color: 0xC0C0C0,
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,
        opacity: 0.2,
        shininess: 100
    }),
    objectMaterial: new THREE.MeshPhongMaterial({
        color: 0xB0E0E6,
        //color: 0xEAD615,
        side: THREE.DoubleSide,
        wireframe: false
    }),
    textMaterial: new THREE.MeshStandardMaterial({
        color: 0x000000
    })
});



