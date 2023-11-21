let svg = document.getElementById("svgCanvas");
let group = document.getElementById("canvasGroup");
let isDrawing = false, isPanning = false;
let currentPath, startPoint, endPoint;
let viewBox = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);

var brushSizeInput = document.getElementById('brushSize');
var brushColorInput = document.getElementById('brushColor');
var brushSize = brushSizeInput.value;
var brushColor = brushColorInput.value;

brushSizeInput.addEventListener('input', function() {
    brushSize = brushSizeInput.value;
});

brushColorInput.addEventListener('input', function() {
    brushColor = brushColorInput.value;
});

var isEraserActive = false;
var toggleEraserButton = document.getElementById('toggleEraser');

toggleEraserButton.addEventListener('click', function() {
    isEraserActive = !isEraserActive;
    if (isEraserActive) {
        toggleEraserButton.textContent = 'Eraser Mode';
    } else {
        toggleEraserButton.textContent = 'Drawing Mode';
    }
});

function startDrawing(evt) {
    if (evt.button !== 0) return; // Only draw on left-click (button 0)

    isDrawing = true;

    if (!isEraserActive) {
        currentPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        currentPath.setAttribute("fill", "none");
        currentPath.setAttribute("stroke-width", brushSize);
        currentPath.setAttribute("stroke", brushColor);
        group.appendChild(currentPath);
        let coords = getSVGCoords(evt);
        currentPath.setAttribute("d", "M" + coords.x + " " + coords.y);
    }
}

function erasePath(eraserSegment) {
    console.log(`erase from (${eraserSegment.start.x}, ${eraserSegment.start.y}) to (${eraserSegment.end.x}, ${eraserSegment.end.y})`);

    let paths = document.querySelectorAll('#canvasGroup path');

    paths.forEach(path => {
        let bbox = path.getBBox();
        if (isSegmentIntersectingRect(eraserSegment, bbox)) {
            for (let segment of pathToLineSegments(path)) {
                if (doSegmentsIntersect(eraserSegment, segment)) {
                    path.remove();
                    break;
                }
            }
        }
    });
}

function isSegmentIntersectingRect(segment, rect) {
    // Define the four sides of the rectangle as segments
    let top = { start: { x: rect.x, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y } };
    let bottom = { start: { x: rect.x, y: rect.y + rect.height }, end: { x: rect.x + rect.width, y: rect.y + rect.height } };
    let left = { start: { x: rect.x, y: rect.y }, end: { x: rect.x, y: rect.y + rect.height } };
    let right = { start: { x: rect.x + rect.width, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y + rect.height } };

    // Check if the segment intersects any of the rectangle's sides
    return (
        isPointInRectangle(segment.end, rect)
        || doSegmentsIntersect(segment, top)
        || doSegmentsIntersect(segment, bottom)
        || doSegmentsIntersect(segment, left)
        || doSegmentsIntersect(segment, right)
    );
}

function doSegmentsIntersect(seg1, seg2) {
    let d1 = {x: seg1.end.x - seg1.start.x, y: seg1.end.y - seg1.start.y};
    let d2 = {x: seg2.end.x - seg2.start.x, y: seg2.end.y - seg2.start.y};

    let start_diff = {x: seg2.start.x - seg1.start.x, y: seg2.start.y - seg1.start.y}

    // seg1.start + s * d1 = seg2.start + t * d2
    // at precisely the point that lines intersect
    //
    // => s * d1 - t * d2 = seg2.start - seg1.start (= start_diff)
    //
    // => s * d1.x - t * d2.x = start_diff.x
    //    s * d1.y - t * d2.y = start_diff.y
    //
    // => [ d1.x d2.x ] [  s ]   [ start_diff.x ]
    //    [ d1.y d2.y ] [ -t ] = [ start_diff.y ]
    //
    // => [  s ]   [ d1.x d2.x ]^-1 [ start_diff.x ]
    //    [ -t ] = [ d1.y d2.y ]    [ start_diff.y ]
    //
    // => [  s ]    ______________1______________ [  d2.y -d2.x ] [ start_diff.x ]
    //    [ -t ] =  (d1.x * d2.y) - (d2.x * d1.y) [ -d1.y  d1.x ] [ start_diff.y ]
    //
    // => [  s ]    ______________1______________ [  d2.y * start_diff.x + -d2.x * start_diff.y ]
    //    [ -t ] =  (d1.x * d2.y) - (d2.x * d1.y) [ -d1.y * start_diff.x +  d1.x * start_diff.y ]

    let det = (d1.x * d2.y) - (d2.x * d1.y);
    if (det === 0) {
        return false;
    }

    let s = (d2.y * start_diff.x + -d2.x * start_diff.y) / det;
    let t = -( (-d1.y * start_diff.x +  d1.x * start_diff.y) / det );

    return (0 <= s && s <= 1) && (0 <= t && t <= 1);
};

function* pathToLineSegments(path) {
    let dAttr = path.getAttribute('d');
    let commands = dAttr.split(/(?=[LM])/);
    let lastPoint = null;

    for (let command of commands) {
        let type = command[0];
        let [x, y] = command.substring(1).trim().split(/\s+/).map(Number);

        if (type === 'M') {
            lastPoint = { x, y };
        } else if (type === 'L' && lastPoint) {
            yield { start: lastPoint, end: { x, y } };
            lastPoint = { x, y };
        }
    }
}

function isPointInRectangle(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.width &&
           point.y >= rect.y && point.y <= rect.y + rect.height;
}

function draw(evt) {
    let coords = getSVGCoords(evt);

    if (!isDrawing) return;

    if (isEraserActive) {
        let previousCoords = { x: coords.x - evt.movementX, y: coords.y - evt.movementY };
        let eraserSegment = { start: previousCoords, end: coords };
        erasePath(eraserSegment);
    } else {
        let d = currentPath.getAttribute("d");
        currentPath.setAttribute("d", d + " L" + coords.x + " " + coords.y);
    }
}

function stopDrawing(evt) {
    if (evt.button !== 0) return;
    isDrawing = false;
}

function startPanning(evt) {
    if (evt.button !== 2) return; // Only pan on right-click (button 2)
    isPanning = true;
    startPoint = { x: evt.clientX, y: evt.clientY };
}

function pan(evt) {
    if (isPanning) {
        endPoint = { x: evt.clientX, y: evt.clientY };

        let dx = (startPoint.x - endPoint.x) * (viewBox.width / svg.clientWidth);
        let dy = (startPoint.y - endPoint.y) * (viewBox.height / svg.clientHeight);

        viewBox.x += dx;
        viewBox.y += dy;
        svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
        startPoint = endPoint;
    }
}

function stopPanning(evt) {
    if (evt.button !== 2) return;
    isPanning = false;
}

function zoom(evt) {
    let scale = evt.deltaY > 0 ? 1.1 : 0.9;
    let cursor = getSVGCoords(evt);

    viewBox.x -= (cursor.x - viewBox.x) * (1 - 1/scale);
    viewBox.y -= (cursor.y - viewBox.y) * (1 - 1/scale);
    viewBox.width *= scale;
    viewBox.height *= scale;

    svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    evt.preventDefault();
}

function getSVGCoords(evt) {
    let pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

svg.addEventListener("mousedown", startDrawing);
svg.addEventListener("mousemove", draw);
svg.addEventListener("mouseup", stopDrawing);
svg.addEventListener("mouseleave", stopDrawing);

svg.addEventListener("wheel", zoom, { passive: false });

svg.addEventListener("mousedown", startPanning);
svg.addEventListener("mousemove", pan);
svg.addEventListener("mouseup", stopPanning);
svg.addEventListener("mouseleave", stopPanning);

svg.addEventListener("contextmenu", function(evt) {
    evt.preventDefault();
});

// function runEraserTest() {
// 	// Create a segment that intersects the test path
// 	let eraserSegment = { start: { x: 50, y: 250 }, end: { x: 250, y: 50 } };

// 	// Call erasePath with this segment
// 	erasePath(eraserSegment);

// 	// Check if the path has been removed
// 	let path = document.getElementById('testPath');
// 	if (!path) {
// 		console.log("Test passed: Path erased successfully.");
// 	} else {
// 		console.log("Test failed: Path still exists.");
// 	}
// }

// // Run the test
// runEraserTest();