(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['angular'], factory);
    } else if (typeof module !== 'undefined' && typeof module.exports === 'object') {
        // CommonJS support (for us webpack/browserify/ComponentJS folks)
        module.exports = factory(require('angular'));
    } else {
        // in the case of no module loading system
        // then don't worry about creating a global
        // variable like you would in normal UMD.
        // It's not really helpful... Just call your factory
        return factory(root.angular);
    }
}(this, function (angular) {
    'use strict';

    var moduleName = 'roomModelViewer';
    angular.module(moduleName).controller("roomModelViewController", ["roomModel", "constant", "$scope", function(roomModel, constant, $scope) {

        var scene = roomModel.scene;

        /////// Show labels
        $scope.showLabels = true

        $scope.$watch('[showLabels]', function(){
            scene.traverse(function(object) {
                if(object.geometry != undefined && object.geometry.type == "TextGeometry") {
                    object.visible = $scope.showLabels
                }
            })
        }, true );

        /////// GLTF Export
        $scope.exportGLTF = function() {
            var exporter = new THREE.GLTFExporter();

            // Parse the input and generate the glTF output
            var options = {binary: false}
            exporter.parse(scene, function (gltf) {
                var output = JSON.stringify(gltf, null, 1);
                saveString(output, 'scene.gltf');
            }, options);
        }

        /////// OBJ Export
        $scope.exportOBJ = function() {
            var exporter = new THREE.OBJExporter();
            var result = exporter.parse(scene);
            saveString(result, 'scene.obj');
        }

        // Support
        var link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link); // Firefox workaround, see #6594

        // Savstring Function
        function saveString(text, filename) {
            save(new Blob([text], {type: 'text/plain'}), filename);
        }

        function save(blob, filename) {
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }

    }]);

    angular.module(moduleName).directive("roomModelView", ["constant", "roomModel", function(constant, roomModel) {


        return {
            restrict: "A",
            link: function (scope, element, attrs) {

                var scene = roomModel.scene;

                // Renderer
                const renderer = new THREE.WebGLRenderer({antialias: true});
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.setClearColor(0x20252f);
                renderer.setPixelRatio(window.devicePixelRatio);
                document.body.appendChild(renderer.domElement);

                function render() {
                    renderer.render(scene, camera);
                }

                // Camera
                const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
                camera.position.set(0, 0, 15);
                scene.add(camera);

                // Controls
                const controls = new THREE.TrackballControls(camera);
                controls.rotateSpeed = 5.0;
                controls.zoomSpeed = 20.2;
                controls.panSpeed = 3.0;
                controls.noZoom = false;
                controls.noPan = false;
                controls.staticMoving = true;
                controls.dynamicDampingFactor = 0.3;
                controls.keys = [65, 83, 68];
                controls.addEventListener('change', render);

                // light
                var ambientLight = new THREE.AmbientLight(0x666666)
                scene.add(ambientLight);
                var light = new THREE.PointLight(0xffffff, 0.8);
                camera.add(light);


                // Animate
                animate();

                function animate() {
                    requestAnimationFrame(animate);
                    controls.update();
                    render();
                }

                // Zoom handler
                function onResize() {
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(window.innerWidth, window.innerHeight);
                    controls.handleResize();
                    render();
                };

                $(document).ready(function () {
                    onResize();
                    window.addEventListener('resize', onResize);
                });
            }
        }
    }]);

    angular.module(moduleName).factory("roomModel", ["constant", function(constant) {

        var roomModel = {}

        // Preprocessing - Static JSON
        var roomData = JSON.parse(DJTest.rooms);
        if (roomData.length == 0) exit(); // Bail if no rooms

        // Preprocessing - Live JSON

        // Scene
        roomModel.scene = new THREE.Scene();

        // ** Scene Construction **
        var loader = new THREE.FontLoader();
        loader.load(
            constant.textFont,
            function (response) {
                roomModel.font = response;
                for (const room of roomData) {
                    if (room.roomObjects.length == 0) exit(); // Bail if no objects

                    // Create objects and add to scene
                    var ceilingHeight = room.ceilingHeight;
                    var roomObjects = preprocessObjects(room.roomObjects);
                    var floorPlan = buildFloorPlan(roomObjects); // Mesh
                    var walls = buildWalls(roomObjects, ceilingHeight); // Mesh
                    var objects = buildObjects(roomObjects); // Mesh

                    addBackgroundToScene(roomModel.scene)
                    addFloorplanToScene(roomModel.scene, floorPlan);
                    addWallsToScene(roomModel.scene, walls)
                    addObjectsToScene(roomModel.scene, objects)

                    roomModel.ceilingHeight = ceilingHeight;
                    roomModel.roomObjects = roomObjects;
                    roomModel.floorPlan = floorPlan;
                    roomModel.walls = walls;
                    roomModel.objects = objects;
                }
            },
            function (xhr) {
                console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
            },
            function (xhr) {
                console.log("error")
            }
        )


        // Preprocessing
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
            for (var i = 0; i < roomObjects.length; i++) {
                for (var j = 0; j < roomObjects[i].segments.length; j++) {
                    roomObjects[i].segments[j].z0 -= elevation;
                    roomObjects[i].segments[j].z1 -= elevation
                }
            }
            return roomObjects
        }

        // Floorplan
        function buildFloorPlan(roomObjects) {
            for (const object of roomObjects) {
                if (object.typeIdentifier == "floorPlan") {
                    var floorPlan = parseSegmentsToFloorplan(object.segments);
                    return floorPlan
                }
            }
        }

        // Openings
        // NOTE: Need to adapt to app data
        function getOpenings(roomObjects) {
            var openings = [];
            for (const object of roomObjects) {
                if (object.typeIdentifier == "door" || object.typeIdentifier == "opening" || object.typeIdentifier == "window") {
                    openings.push(object)
                }
            }
            return openings
        }

        // Walls
        function buildWalls(roomObjects, ceilingHeight) {
            var walls = [];
            var openings = getOpenings(roomObjects); // Objects
            for (const object of roomObjects) {
                if (object.typeIdentifier == "ceiling") { // Building walls from ceiling segments
                    var walls = parseSegmentsToWalls(object.segments, ceilingHeight, openings);
                }
            }
            return walls
        }

        // Objects
        function buildObjects(roomObjects) {
            var objectMeshes = [];
            for (const object of roomObjects) {
                if (!(object.typeIdentifier == "door"
                        || object.typeIdentifier == "opening"
                        || object.typeIdentifier == "window"
                        || object.typeIdentifier == "floorPlan"
                        || object.typeIdentifier == "ceiling")) {
                    var objectMesh;
                    if (object.orientationIdentifier == "horizontal") {
                        objectMesh = parseHorizontalObject(object)
                    } else if (object.orientationIdentifier == "vertical") {
                        objectMesh = parseVerticalObject(object)
                    }
                    objectMeshes.push(objectMesh)
                }
            }
            return objectMeshes
        }

        // Object building + Labeling - Horizontal
        function parseHorizontalObject(object) {
            var objectGroup = new THREE.Group(),
                positions = [],
                xMed = 0, yMed = 0, zMed = 0, counter = 0,
                segment, index;
            for ([index, segment] of object.segments.entries()) {
                if (segment.positionIdentifier == "base") {
                    positions.push(new THREE.Vector2(-segment.x1, segment.y1))
                    xMed += segment.x0;
                    yMed += segment.y0;
                    counter++;
                }
            }
            zMed = (object.height == undefined) ? 0.001 : object.height
            var shape = new THREE.Shape(positions);
            shape.closed = true;
            var extrudeSettings = {
                amount: (object.height == undefined) ? 0.001 : object.height,
                steps: 1,
                bevelEnabled: false
            };
            var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            var mesh = new THREE.Mesh(geometry, constant.objectMaterial)
            objectGroup.add(mesh)
            // Label
            var tag = (object.name == undefined) ? object.typeIdentifier : object.name;
            if (tag != undefined) {
                var tangentVector = new THREE.Vector3(1, 0, 0)
                var normalVector = new THREE.Vector3(0, 0, 1)
                var textMesh = createText(tag)
                textMesh.geometry.computeBoundingBox()
                var height = textMesh.geometry.boundingBox.max.y - textMesh.geometry.boundingBox.min.y
                var width = textMesh.geometry.boundingBox.max.x - textMesh.geometry.boundingBox.min.x
                textMesh.position.x = -(xMed / counter + width / 2);
                textMesh.position.y = yMed / counter;
                textMesh.position.z = zMed + 0.001;
                objectGroup.add(textMesh)
            }
            return objectGroup;
        }

        // Object building + Labeling - Vertical
        function parseVerticalObject(object) {
            var objectGroup = new THREE.Group();
            // Rotation
            segments = getSegmentsVerticalObject(object)
            const tangentVector = new THREE.Vector3(segments.max.x1 - segments.min.x0, segments.max.y1 - segments.min.y0, 0);
            const angle = -Math.sign(tangentVector.y) * tangentVector.angleTo(new THREE.Vector3(1, 0, 0));
            // Shape
            var positions = [];
            var xMed = 0, yMed = 0, zMed = 0, counter = 0;
            for ([index, segment] of object.segments.entries()) {
                if (segment.positionIdentifier == "base") {
                    if (index == 0) {
                        var x0 = Math.cos(angle) * (segment.x0 - segments.min.x0) - Math.sin(angle) * (segment.y0 - segments.min.y0);
                        var y0 = segment.z0 - segments.min.z0
                        positions.push(new THREE.Vector2(x0, y0));
                        xMed += segment.x0;
                        yMed += segment.y0;
                        zMed += segment.z0;
                        counter++;
                    }
                    var x1 = Math.cos(angle) * (segment.x1 - segments.min.x0) - Math.sin(angle) * (segment.y1 - segments.min.y0);
                    var y1 = segment.z1 - segments.min.z0
                    positions.push(new THREE.Vector2(x1, y1));
                    xMed += segment.x1;
                    yMed += segment.y1;
                    zMed += segment.z1;
                    counter++;
                }
            }
            var shape = new THREE.Shape(positions);
            shape.closed = true;
            var extrudeSettings = {
                amount: -0.001,
                steps: 1,
                bevelEnabled: false
            };
            //Geometry
            var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            // Mesh
            var mesh = new THREE.Mesh(geometry, constant.objectMaterial)
            mesh.rotation.x = Math.PI / 2;
            mesh.rotation.y = angle + Math.PI;
            mesh.position.x = -segments.min.x0; // Note X flip
            mesh.position.y = segments.min.y0;
            mesh.position.z = segments.min.z0;
            objectGroup.add(mesh)
            // Label
            var tag = (object.name == undefined) ? object.typeIdentifier : object.name;
            if (tag != undefined) {
                tangentVector.normalize()
                var normalVector = tangentVector.clone();
                normalVector.cross(new THREE.Vector3(0, 0, 1))
                var textMesh = createText(tag)
                textMesh.geometry.computeBoundingBox()
                var height = textMesh.geometry.boundingBox.max.y - textMesh.geometry.boundingBox.min.y
                var width = textMesh.geometry.boundingBox.max.x - textMesh.geometry.boundingBox.min.x
                textMesh.rotation.x = Math.PI / 2;
                textMesh.rotation.y = angle + Math.PI;
                textMesh.position.x = -(xMed / counter - tangentVector.x * width / 2 - normalVector.x * 0.01);
                textMesh.position.y = yMed / counter - tangentVector.y * width / 2 - normalVector.y * 0.01;
                textMesh.position.z = zMed / counter - height
                objectGroup.add(textMesh)
            }
            return objectGroup
        }


        // Find Segments for Vertical Objects
        function getSegmentsVerticalObject(object) {
            var segmentMin, segmentMax;
            var distance = 0;
            for ([index, segment] of object.segments.entries()) {
                if (segment.positionIdentifier == "base") {
                    if (index == 0) {
                        segmentMin = segment
                    }
                    var segmentVector = new THREE.Vector3(segment.x1 - segmentMin.x0, segment.y1 - segmentMin.y0, 0);
                    var testDistance = segmentVector.distanceTo(new THREE.Vector3());
                    if (testDistance > distance) {
                        distance = testDistance;
                        segmentMax = segment
                    }
                }
            }
            return {
                min: segmentMin,
                max: segmentMax
            }
        }

        // NOT used ..
        function getSegmentForObject(object) {
            var objectMinX = Math.min(segment.x0, segment.x1);
            var objectMaxX = Math.max(segment.x0, segment.x1);
            var objectMinY = Math.min(segment.y0, segment.y1);
            var objectMaxY = Math.max(segment.y0, segment.y1);
            for (const opening of openings) {
                var openingInWall = true;
                for (const openingSegments of opening.segments) {
                    if (!((openingSegments.x0 >= segmentMinX && openingSegments.x0 <= segmentMaxX)
                            && (openingSegments.x1 >= segmentMinX && openingSegments.x1 <= segmentMaxX)
                            && (openingSegments.y0 >= segmentMinY && openingSegments.y0 <= segmentMaxY)
                            && (openingSegments.y1 >= segmentMinY && openingSegments.y1 <= segmentMaxY))) {
                        openingInWall = false
                    }
                }
                if (openingInWall) {
                    segmentOpenings.push(opening)
                }
            }
            return segmentOpenings
        }


        function parseSegmentsToFloorplan(segments) {
            var floorPlanGroup = new THREE.Group();

            // Floorplan
            var positions = [];
            for (const segment of segments) {
                positions.push(new THREE.Vector2(-segment.x1, segment.y1)) // Note flip
            }
            var shape = new THREE.Shape(positions);
            shape.closed = true;
            var geometry = new THREE.ShapeGeometry(shape);
            var floorPlan = new THREE.Mesh(geometry, constant.floorMaterial);
            floorPlanGroup.add(floorPlan)

            // Labels
            for (const segment of segments) {
                if (segment.distanceTag != undefined) {
                    var textMesh = createText(segment.distanceTag)
                    textMesh.geometry.computeBoundingBox()
                    var height = textMesh.geometry.boundingBox.max.y - textMesh.geometry.boundingBox.min.y
                    var width = textMesh.geometry.boundingBox.max.x - textMesh.geometry.boundingBox.min.x
                    var segmentVector = new THREE.Vector3(segment.x1 - segment.x0, segment.y1 - segment.y0, 0);
                    segmentVector.normalize();
                    var angle = -Math.sign(segmentVector.y) * segmentVector.angleTo(new THREE.Vector3(1, 0, 0));
                    textMesh.rotation.z = angle + Math.PI;
                    var normalVector = segmentVector.clone();
                    normalVector.cross(new THREE.Vector3(0, 0, 1))
                    textMesh.position.x = -((segment.x0 + segment.x1 - segmentVector.x * width) / 2 - normalVector.x * 1.5 * height);
                    textMesh.position.y = (segment.y0 + segment.y1 - segmentVector.y * width) / 2 - normalVector.y * 1.5 * height;
                    textMesh.position.z = floorPlan.position.z + 0.001;
                    floorPlanGroup.add(textMesh)
                }
            }

            return floorPlanGroup
        }

        function parseSegmentsToWalls(segments, ceilingHeight, openings) {
            var walls = [];
            for (const segment of segments) {
                var segmentOpenings = getOpeningsForSegment(segment, ceilingHeight, openings);
                var wall = buildWallFromSegment(segment, ceilingHeight, segmentOpenings);
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
                            && (openingSegments.y1 >= segmentMinY && openingSegments.y1 <= segmentMaxY))) {
                        openingInWall = false
                    }
                }
                if (openingInWall) {
                    segmentOpenings.push(opening)
                }
            }
            return segmentOpenings
        }

        function buildWallFromSegment(segment, ceilingHeight, openings) {
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
            wallGroup.position.x = -(segment.x0 + segment.x1) / 2;
            wallGroup.position.y = (segment.y0 + segment.y1) / 2;
            wallGroup.position.z = ceilingHeight / 2;
            // Rotation
            var angle = -Math.sign(segmentVector.y) * segmentVector.angleTo(new THREE.Vector3(1, 0, 0));
            wallGroup.rotation.x = Math.PI / 2;
            wallGroup.rotation.y = angle + Math.PI;

            return wallGroup
        }

        function buildWallMesh(segment, openings) {
            // Create geometry
            var wallShape = {
                geometry: new THREE.BoxGeometry(segment.width, segment.height, 0.002),
                offsetX: 0,
                offsetY: 0
            }
            for (var opening of openings) {
                wallShape = addHoleToShape(wallShape, segment, opening);
            }
            // Create mesh
            var wall = new THREE.Mesh(wallShape.geometry, constant.wallMaterial);
            return wall
        }

        function buildDoorMeshes(segment, openings) {
            var doorGroup = new THREE.Group(),
                opening;
            for (opening of openings) {
                if (opening.typeIdentifier == "door") {
                    var doorGeometry = getEmbeddedObjectGeometry(opening, segment, 0.05)
                    var doorOpenings = getOpeningsForDoor(opening, openings)
                    for (doorOpening of doorOpenings) {
                        doorGeometry = addHoleToShape(doorGeometry, segment, doorOpening)
                    }
                    var door = new THREE.Mesh(doorGeometry.geometry, constant.doorMaterial);
                    door.position.x = -segment.width / 2 + doorGeometry.offsetX
                    door.position.y = -segment.height / 2 + doorGeometry.offsetY
                    door.position.z = -0.025;
                    doorGroup.add(door);
                    // Label
                    var tag = (opening.name == undefined) ? opening.typeIdentifier : opening.name;
                    if (tag != undefined) {
                        var textMesh = createText(tag);
                        textMesh.geometry.computeBoundingBox()
                        var height = textMesh.geometry.boundingBox.max.y - textMesh.geometry.boundingBox.min.y
                        var width = textMesh.geometry.boundingBox.max.x - textMesh.geometry.boundingBox.min.x
                        textMesh.position.x = -segment.width / 2 + doorGeometry.offsetX + doorGeometry.width / 2 - width / 2;
                        textMesh.position.y = -segment.height / 2 + doorGeometry.offsetY + doorGeometry.height / 2 - height / 2;
                        textMesh.position.z = 0.05
                        doorGroup.add(textMesh)
                    }
                }
            }
            return doorGroup
        }

        // NOTE: Need to bring segmentID in from APP to make this more robust
        function getOpeningsForDoor(door, openings) {
            var segmentMinX = door.segments[0].x0;
            var segmentMaxX = door.segments[0].x0;
            var segmentMinY = door.segments[0].y0;
            var segmentMaxY = door.segments[0].y0;
            var doorSegment;
            for (doorSegment of door.segments) {
                segmentMinX = Math.min(segmentMinX, doorSegment.x1);
                segmentMaxX = Math.max(segmentMaxX, doorSegment.x1);
                segmentMinY = Math.min(segmentMinY, doorSegment.y1);
                segmentMaxY = Math.max(segmentMaxY, doorSegment.y1);
            }

            var doorOpenings = [];
            for (const opening of openings) {
                if (opening.typeIdentifier == "window") {
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
            var windowGroup = new THREE.Group(),
                opening;
            for (opening of openings) {
                if (opening.typeIdentifier == "window") {
                    var windowGeometry = getEmbeddedObjectGeometry(opening, segment, 0.05)
                    var window = new THREE.Mesh(windowGeometry.geometry, constant.windowMaterial);
                    window.position.x = -segment.width / 2 + windowGeometry.offsetX
                    window.position.y = -segment.height / 2 + windowGeometry.offsetY
                    window.position.z = -0.025;
                    windowGroup.add(window)
                    // Label
                    var tag = (opening.name == undefined) ? opening.typeIdentifier : opening.name;
                    if (tag != undefined) {
                        var textMesh = createText(tag);
                        textMesh.geometry.computeBoundingBox()
                        var height = textMesh.geometry.boundingBox.max.y - textMesh.geometry.boundingBox.min.y
                        var width = textMesh.geometry.boundingBox.max.x - textMesh.geometry.boundingBox.min.x
                        textMesh.position.x = -segment.width / 2 + windowGeometry.offsetX + windowGeometry.width / 2 - width / 2;
                        textMesh.position.y = -segment.height / 2 + windowGeometry.offsetY + windowGeometry.height / 2 - height / 2;
                        textMesh.position.z = 0.05
                        windowGroup.add(textMesh)
                    }
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
            // Rotation
            var segmentVector = new THREE.Vector3(segment.x1 - segment.x0, segment.y1 - segment.y0, 0);
            var angle = -Math.sign(segmentVector.y) * segmentVector.angleTo(new THREE.Vector3(1, 0, 0));
            // Offsets
            const baseX = object.segments[0].x0;
            const baseY = object.segments[0].y0;
            const baseZ = object.segments[0].z0;
            var width, height;
            // Create shape
            var positions = [],
                index, objectSegment;
            for ([index, objectSegment] of object.segments.entries()) {
                if (index == 0) {
                    var x0 = (new THREE.Vector2(objectSegment.x0 - baseX, objectSegment.y0 - baseY)).distanceTo(new THREE.Vector2());
                    var y0 = objectSegment.z0 - baseZ
                    positions.push(new THREE.Vector2(x0, y0));
                }
                var x1 = Math.cos(angle) * (objectSegment.x1 - baseX) - Math.sin(angle) * (objectSegment.y1 - baseY);
                var y1 = objectSegment.z1 - baseZ
                if (index == 1) {
                    width = x1;
                    height = y1;
                }
                positions.push(new THREE.Vector2(x1, y1));
            }
            // Create geometry
            var objectShape = new THREE.Shape(positions);
            objectShape.closed = true;
            var extrudeSettings = {
                amount: thickness,
                steps: 1,
                bevelEnabled: false
            };
            var objectGeometry = new THREE.ExtrudeGeometry(objectShape, extrudeSettings);
            // Get offset position
            var offsetX = Math.cos(angle) * (baseX - segment.x0) - Math.sin(angle) * (baseY - segment.y0);
            var offsetY = baseZ;
            // Return
            return {
                geometry: objectGeometry,
                offsetX: offsetX,
                offsetY: offsetY,
                width: width,
                height: height
            }
        }

        function addBackgroundToScene(scene) {
            var geometry = new THREE.PlaneBufferGeometry(35, 35);
            var ground = new THREE.Mesh(geometry, constant.groundMaterial);
            ground.position.set(0, 0, -0.01);
            //ground.rotation.x = - Math.PI / 2;
            //scene.add(ground);
            scene.fog = new THREE.Fog(0xffffff, 0, 1000);
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

        // Text
        function createText(text) {
            const textGeometry = createTextGeometry(text, roomModel.font);
            const textMesh = new THREE.Mesh(textGeometry, constant.textMaterial)
            return textMesh;
        }

        function createTextGeometry(text, font) {
            var textGeometry = new THREE.TextGeometry(text, {
                font: font,
                size: constant.textSize,
                height: 0
            });
            return textGeometry
        }

        return roomModel;
    }]);

    return moduleName; // the name of your module
}));





