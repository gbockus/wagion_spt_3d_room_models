

// Preprocessing
// Parse room data
var roomData = JSON.parse(TXTAFoyer.rooms);
if (roomData.length == 0) exit(); // Bail if no rooms

// scene .. NOTE WILL MOVE LATER
const scene = new THREE.Scene();

for (const room of roomData) {
    if (room.roomObjects.length == 0) exit(); // Bail if no objects

    // Create objects and add to scene
    var ceilingHeight = room.ceilingHeight;
    var roomObjects = preprocessObjects(room.roomObjects);
    var floorPlan = buildFloorPlan(roomObjects); // Mesh
    var walls =  buildWalls(roomObjects, ceilingHeight); // Mesh
    var objects =  buildObjects(roomObjects); // Mesh

    addBackgroundToScene(scene)
    addFloorplanToScene(scene, floorPlan);
    addWallsToScene(scene, walls)
    addObjectsToScene(scene, objects)
}

function preprocessObjects(roomObjects) {
    // Get elevation (z)
    var elevation;
    for (const object of roomObjects) {
        if (object.typeIdentifier == "floorPlan") {
            elevation = object.segments[0].z0;
            break
        }
    }
    // Reset elevations
    for (var i=0; i < roomObjects.length; i++) {
        for (var j=0; j < roomObjects[i].segments.length; j++) {
            roomObjects[i].segments[j].z0 -= elevation;
            roomObjects[i].segments[j].z1 -= elevation
        }
    }
    return roomObjects
}

function buildFloorPlan(roomObjects) {
    for (const object of roomObjects) {
        if (object.typeIdentifier == "floorPlan") {
            var floorPlan = parseSegmentsToFloorplan(object.segments);
            return floorPlan
        }
    }
}

function getOpenings(roomObjects) {
    var openings = [];
    for (const object of roomObjects) {
        if (object.typeIdentifier == "door" || object.typeIdentifier == "opening" || object.typeIdentifier == "window") {
            openings.push(object)
        }
    }
    return openings
}

function buildWalls(roomObjects, ceilingHeight) {
    var walls = [];
    var openings = getOpenings(roomObjects); // Objects
    for (const object of roomObjects) {
        if (object.typeIdentifier == "ceiling") { // Building walls from ceiling segments
            var walls = parseSegmentsToWalls(object.segments, ceilingHeight, openings);
            return walls
        }
    }
}

function buildObjects(roomObjects) {
    var objectMeshes = [];
    for (const object of roomObjects) {
        if(!(object.typeIdentifier == "door"
                || object.typeIdentifier == "opening"
                || object.typeIdentifier == "window"
                || object.typeIdentifier == "floorPlan"
                || object.typeIdentifier == "ceiling")) {
            console.log(object.typeIdentifier)
            var objectGeometry = parseObjects(object)
            var objectMesh = new THREE.Mesh(objectGeometry, objectMaterial)
            objectMeshes.push(objectMesh)
        }
    }
    return objectMeshes
}

function parseObjects(object) {
    var positions = []
    for ([index, segment] of object.segments.entries()) {
        if(segment.positionIdentifier == "base")
        positions.push(new THREE.Vector2(-segment.x1,segment.y1))
    }
    var shape = new THREE.Shape(positions);
    shape.closed = true;
    var geometry = new THREE.ShapeGeometry(shape);
    var extrudeSettings = {
        amount			: object.height,
        steps			: 1,
        bevelEnabled	: false
    };
    var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    return geometry
}


function parseSegmentsToFloorplan(segments) {
    positions = [];
    for (const [index, value] of segments.entries()) {
        positions.push(new THREE.Vector2(-value.x1, value.y1))
    }
    var shape = new THREE.Shape(positions);
    shape.closed = true;
    var geometry = new THREE.ShapeGeometry(shape);
    var floorPlan = new THREE.Mesh(geometry, floorMaterial);
    return floorPlan
}

function parseSegmentsToWalls(segments, ceilingHeight, openings) {
    walls = [];
    for (const segment of segments) {
        var segmentOpenings = getOpeningsForSegment(segment, ceilingHeight, openings);
        var wall = buildWallFromSegment(segment, segmentOpenings);
        walls.push(wall)
    }
    return walls
}

// NOTE: Need to bring segmentID in from APP to make this more robust
function getOpeningsForSegment(segment, ceilingHeight, openings) {
    var segmentOpenings = [];
    var segmentMinX = Math.min(segment.x0, segment.x1);
    var segmentMaxX = Math.max(segment.x0, segment.x1);
    var segmentMinY = Math.min(segment.y0, segment.y1);
    var segmentMaxY = Math.max(segment.y0, segment.y1);
    for (const opening of openings) {
        var openingInWall = true;
        for (const openingSegments of opening.segments) {
            if (!((openingSegments.x0 >= segmentMinX && openingSegments.x0 <= segmentMaxX)
                && (openingSegments.x1 >= segmentMinX && openingSegments.x1 <= segmentMaxX)
                && (openingSegments.y0 >= segmentMinY && openingSegments.y0 <= segmentMaxY)
                && (openingSegments.y1 >= segmentMinY && openingSegments.y1 <= segmentMaxY))){
                    openingInWall = false
            }
        }
        if(openingInWall) {
            segmentOpenings.push(opening)
        }
    }
    return segmentOpenings
}

function buildWallFromSegment(segment, openings) {
    var wallGroup = new THREE.Group();
    // Width and Height
    var segmentVector = new THREE.Vector3(segment.x1 - segment.x0, segment.y1 - segment.y0, 0);
    segment.width = segmentVector.distanceTo(new THREE.Vector3());
    segment.height = ceilingHeight

    // Walls
    var wall = buildWallMesh(segment, openings);
    wallGroup.add(wall)

    // Doors
    var doors = buildDoorMeshes(segment, openings);
    wallGroup.add(doors)

    // Windows
    var windows = buildWindowMeshes(segment, openings);
    wallGroup.add(windows)

    // Position wall group
    wallGroup.position.x = -(segment.x0+segment.x1)/2;
    wallGroup.position.y = (segment.y0+segment.y1)/2;
    wallGroup.position.z = ceilingHeight/2;
    // Rotation
    var angle = -Math.sign(segmentVector.y) * segmentVector.angleTo(new THREE.Vector3(1, 0, 0));
    wallGroup.rotation.x = Math.PI / 2;
    wallGroup.rotation.y = angle + Math.PI;

    return wallGroup
}

function buildWallMesh(segment, openings) {
    // Create geometry
    var wallShape = {
        geometry: new THREE.BoxGeometry( segment.width, segment.height, 0.002 ),
        offsetX: 0,
        offsetY: 0
    }
    for (var opening of openings) {
        wallShape = addHoleToShape(wallShape, segment, opening);
    }
    // Create mesh
    var wall = new THREE.Mesh(wallShape.geometry, wallMaterial);
    return wall
}

function buildDoorMeshes(segment, openings) {
    var doorGroup = new THREE.Group();
    for (opening of openings) {
        if (opening.typeIdentifier == "door")  {
            var doorShape = getEmbeddedObjectGeometry(opening, segment, 0.05)
            var doorOpenings = getOpeningsForDoor(opening, openings)
            for (doorOpening of doorOpenings) {
                doorShape = addHoleToShape(doorShape, segment, doorOpening)
            }
            var door = new THREE.Mesh(doorShape.geometry, doorMaterial);
            door.position.x = -segment.width/2 + doorShape.offsetX
            door.position.y = -segment.height/2 + doorShape.offsetY
            door.position.z = -0.025;

            doorGroup.add(door)
        }
    }
    return doorGroup
}

// NOTE: Need to bring segmentID in from APP to make this more robust
function getOpeningsForDoor(door, openings) {
    var segmentMinX = door.segments[0].x0
    var segmentMaxX = door.segments[0].x0
    var segmentMinY = door.segments[0].y0
    var segmentMaxY = door.segments[0].y0
    for (doorSegment of door.segments) {
        segmentMinX = Math.min(segmentMinX, doorSegment.x1);
        segmentMaxX = Math.max(segmentMaxX, doorSegment.x1);
        segmentMinY = Math.min(segmentMinY, doorSegment.y1);
        segmentMaxY = Math.max(segmentMaxY, doorSegment.y1);
    }

    var doorOpenings = [];
    for (const opening of openings) {
        if(opening.typeIdentifier == "window") {
            var openingInDoor = true;
            for (const openingSegment of opening.segments) {
                if (!((openingSegment.x0 >= segmentMinX && openingSegment.x0 <= segmentMaxX)
                        && (openingSegment.x1 >= segmentMinX && openingSegment.x1 <= segmentMaxX)
                        && (openingSegment.y0 >= segmentMinY && openingSegment.y0 <= segmentMaxY)
                        && (openingSegment.y1 >= segmentMinY && openingSegment.y1 <= segmentMaxY))) {
                    openingInDoor = false
                }
            }
            if (openingInDoor) {
                doorOpenings.push(opening)
            }
        }
    }
    return doorOpenings
}

function buildWindowMeshes(segment, openings) {
    var windowGroup = new THREE.Group();
    for (opening of openings) {
        if (opening.typeIdentifier == "window")  {
            var windowGeometry = getEmbeddedObjectGeometry(opening, segment, 0.05)
            var window = new THREE.Mesh(windowGeometry.geometry, windowMaterial);
            window.position.x = -segment.width/2 + windowGeometry.offsetX
            window.position.y = -segment.height/2 + windowGeometry.offsetY
            window.position.z = -0.025;

            windowGroup.add(window)
        }
    }
    return windowGroup
}

function addHoleToShape(shape, segment, opening) {
    var openingGeometry = getEmbeddedObjectGeometry(opening, segment, 0.1)
    var openingMesh = new THREE.Mesh(openingGeometry.geometry);
    if (shape.geometry.type == "BoxGeometry") {
        openingMesh.position.x = -segment.width / 2 + openingGeometry.offsetX
        openingMesh.position.y = -segment.height / 2 + openingGeometry.offsetY
    } else {
        openingMesh.position.x = -shape.offsetX + openingGeometry.offsetX
        openingMesh.position.y = -shape.offsetY + openingGeometry.offsetY
    }
    openingMesh.position.z = -0.05;
    var type = shape.geometry.type
    var openingMeshBSP = new ThreeBSP(openingMesh);
    // CSG subtraction
    var mesh = new THREE.Mesh(shape.geometry);
    var meshBSP = new ThreeBSP(mesh);
    shape.geometry = meshBSP.subtract(openingMeshBSP).toGeometry()
    shape.geometry.type = type
    return shape
}

function getEmbeddedObjectGeometry(object, segment, thickness) {
    var objectSegment0 = object.segments[0];
    var objectSegment1 = object.segments[1];
    // Width
    var objectWidthVector = new THREE.Vector3(objectSegment0.x1 - objectSegment0.x0, objectSegment0.y1 - objectSegment0.y0, objectSegment0.z1 - objectSegment0.z0);
    var width = objectWidthVector.distanceTo(new THREE.Vector3());
    // Height
    var objectHeightVector = new THREE.Vector3(objectSegment1.x1 - objectSegment1.x0, objectSegment1.y1 - objectSegment1.y0, objectSegment1.z1 - objectSegment1.z0);
    var height = objectHeightVector.distanceTo(new THREE.Vector3());
    // Base position
    var objectBaseVector = new THREE.Vector2(objectSegment0.x0 - segment.x0, objectSegment0.y0 - segment.y0);
    var offsetX =  objectBaseVector.distanceTo(new THREE.Vector2());
    var offsetY = Math.min(objectSegment0.z0, objectSegment1.z1);
    var positions = [];
    positions.push(new THREE.Vector2(0,0));
    positions.push(new THREE.Vector2(width, 0));
    positions.push(new THREE.Vector2(width, height));
    positions.push(new THREE.Vector2(0, height));
    // Create shape + geometry
    var objectShape = new THREE.Shape(positions);
    objectShape.closed = true;
    var extrudeSettings = {
        amount			: thickness,
        steps			: 1,
        bevelEnabled	: false
    };
    return {
        geometry: new THREE.ExtrudeGeometry(objectShape, extrudeSettings),
        offsetX: offsetX,
        offsetY: offsetY
    }
}

function addBackgroundToScene(scene) {
    var geometry = new THREE.PlaneBufferGeometry( 15, 15 );
    var ground = new THREE.Mesh( geometry, groundMaterial );
    ground.position.set( 0, 0, -0.01 );
    //ground.rotation.x = - Math.PI / 2;
    scene.add( ground );
    scene.fog = new THREE.Fog( 0xffffff, 0, 1000 );
    scene.background = new THREE.Color(0xcce0ff);
}

function addFloorplanToScene(scene, floorPlan) {
    scene.add(floorPlan)
}

function addWallsToScene(scene, walls) {
    for (const wall of walls) {
        scene.add(wall)
    }
}

function addObjectsToScene(scene, objects) {
    for (const object of objects) {
        scene.add(object)
    }
}

// camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 0, 15);
scene.add(camera);

// light
var ambientLight = new THREE.AmbientLight( 0x666666 )
scene.add( ambientLight);
var light = new THREE.PointLight(0xffffff, 0.8);
camera.add(light);

// renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x20252f);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);

// Animate
animate();

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    renderer.render(scene, camera);
}

// Handle zoom
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
};

$( document ).ready(function(){
    onResize();
    window.addEventListener('resize', onResize);
});


////////////////////////////// EXPORT ///////////////////////////////////////////////////////////
//Instantiate exporter
var exporter = new THREE.GLTFExporter();

// Parse the input and generate the glTF output
var options={}
exporter.parse( scene, function ( gltf ) {
    var output = JSON.stringify( gltf, null, 2 );
    saveString( output, 'scene.gltf' );
}, options );

// Savstring Function
function saveString( text, filename ) {
    save( new Blob( [ text ], { type: 'text/plain' } ), filename );
}

// Support
var link = document.createElement( 'a' );
link.style.display = 'none';
document.body.appendChild( link ); // Firefox workaround, see #6594

function save( blob, filename ) {
    link.href = URL.createObjectURL( blob );
    link.download = filename;
    link.click();
}

