const CONSTANTS = {
    BLOCK_SIZE: 0.5,
    MIN_ELLIPSE_SIZE: 3,
    MIN_INNER_SIZE: 1,
    MIN_HEIGHT: 4,
    MAX_HEIGHT: 100,
    MIN_ROTATION: 45,
    MAX_ROTATION: 720,
    MIN_STARTING_ANGLE: 0,
    MAX_STARTING_ANGLE: 315,
    CAMERA_MOVE_SPEED: 0.2,
    OPACITY: {
        INNER_RING: 0.15,
        ELLIPSE_OUTLINE: 0.3,
        EDGE: 0.5,
    },
};

const state = {
    ellipse: {
        width: 32,
        height: 32,
        innerWidth: 20,
        innerHeight: 20,
        outerMirrored: true,
        innerMirrored: true,
    },
    staircase: {
        currentStep: 0,
        totalHeight: 20,
        rotationDegrees: 360,
        verticalDirection: 1,
        rotationDirection: 1,
        showSingleStep: false,
        startingAngle: 0,
    },
    canvas: {
        width: 100,
        height: 100,
        scale: [0, 0, 1, 1],
    },
    viewMode: "3d",
    builderMode: false,
    view3D: {
        scene: null,
        camera: null,
        renderer: null,
        cameraTarget: null,
        keys: {},
        needsRender: false,
        animationId: null,
    },
};

const utils = {
    isDarkTheme() {
        return document.documentElement.getAttribute("data-theme") === "dark";
    },

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    inside(x, y, cx, cy, rx, ry) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        return nx * nx + ny * ny <= 1.0;
    },

    boundary(x, y, cx, cy, rx, ry) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const z = nx * nx + ny * ny;
        return (
            this.inside(x, y, cx, cy, rx, ry) &&
            !(
                this.inside(x + 1, y, cx, cy, rx, ry) &&
                this.inside(x - 1, y, cx, cy, rx, ry) &&
                this.inside(x, y + 1, cx, cy, rx, ry) &&
                this.inside(x, y - 1, cx, cy, rx, ry)
            )
        );
    },

    normalizeAngle(a) {
        let angle = a % (2 * Math.PI);
        return angle < 0 ? angle + 2 * Math.PI : angle;
    },
};

const controls = {
    adjustValue(config, delta) {
        const element = document.getElementById(config.id);
        let value = config.getter() + delta;
        value = utils.clamp(value, config.min, config.max);

        if (config.snap) {
            value = Math.round(value / config.snap) * config.snap;
        }

        config.setter(value);
        element.value = value;

        if (config.mirrorId && config.mirrorGetter()) {
            const mirrorElement = document.getElementById(config.mirrorId);
            config.mirrorSetter(value);
            mirrorElement.value = value;
        }

        this.updateView();
    },

    getValue(config) {
        const element = document.getElementById(config.id);
        let value = parseFloat(element.value);

        if (isNaN(value) || value < config.min) {
            value = config.min;
        } else if (value > config.max) {
            value = config.max;
        }

        if (config.snap) {
            value = Math.round(value / config.snap) * config.snap;
        }

        config.setter(value);
        element.value = value;

        if (config.mirrorId && config.mirrorGetter()) {
            const mirrorElement = document.getElementById(config.mirrorId);
            config.mirrorSetter(value);
            mirrorElement.value = value;
        }

        this.updateView();
    },

    updateView() {
        if (state.viewMode === "3d") {
            render3D.generateStaircase();
        } else {
            resizeCanvas();
        }
    },

    updateMirrorButton(buttonId, mirrored) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const icon = button.querySelector(".material-icons");
        if (!icon) return;

        if (mirrored) {
            button.classList.add("active");
            icon.textContent = "sync";
            button.title = "Mirrored (click to separate)";
        } else {
            button.classList.remove("active");
            icon.textContent = "sync_disabled";
            button.title = "Separate (click to mirror)";
        }
    },
};

const controlConfigs = {
    outerWidth: {
        id: "ellw",
        getter: () => state.ellipse.width,
        setter: (v) => (state.ellipse.width = v),
        mirrorId: "ellh",
        mirrorGetter: () => state.ellipse.outerMirrored,
        mirrorSetter: (v) => (state.ellipse.height = v),
        min: CONSTANTS.MIN_ELLIPSE_SIZE,
        max: Infinity,
    },
    outerHeight: {
        id: "ellh",
        getter: () => state.ellipse.height,
        setter: (v) => (state.ellipse.height = v),
        mirrorId: "ellw",
        mirrorGetter: () => state.ellipse.outerMirrored,
        mirrorSetter: (v) => (state.ellipse.width = v),
        min: CONSTANTS.MIN_ELLIPSE_SIZE,
        max: Infinity,
    },
    innerWidth: {
        id: "innerellw",
        getter: () => state.ellipse.innerWidth,
        setter: (v) => (state.ellipse.innerWidth = v),
        mirrorId: "innerellh",
        mirrorGetter: () => state.ellipse.innerMirrored,
        mirrorSetter: (v) => (state.ellipse.innerHeight = v),
        min: CONSTANTS.MIN_INNER_SIZE,
        max: Infinity,
    },
    innerHeight: {
        id: "innerellh",
        getter: () => state.ellipse.innerHeight,
        setter: (v) => (state.ellipse.innerHeight = v),
        mirrorId: "innerellw",
        mirrorGetter: () => state.ellipse.innerMirrored,
        mirrorSetter: (v) => (state.ellipse.innerWidth = v),
        min: CONSTANTS.MIN_INNER_SIZE,
        max: Infinity,
    },
    totalHeight: {
        id: "totalheight",
        getter: () => state.staircase.totalHeight,
        setter: (v) => (state.staircase.totalHeight = v),
        min: CONSTANTS.MIN_HEIGHT,
        max: CONSTANTS.MAX_HEIGHT,
    },
    rotation: {
        id: "rotation",
        getter: () => state.staircase.rotationDegrees,
        setter: (v) => (state.staircase.rotationDegrees = v),
        min: CONSTANTS.MIN_ROTATION,
        max: CONSTANTS.MAX_ROTATION,
        snap: 1,
    },
    startAngle: {
        id: "startangle",
        getter: () => state.staircase.startingAngle,
        setter: (v) => (state.staircase.startingAngle = v),
        min: CONSTANTS.MIN_STARTING_ANGLE,
        max: CONSTANTS.MAX_STARTING_ANGLE,
        snap: 1,
    },
};

class Render2D {
    constructor(ctx) {
        this.ctx = ctx;
    }

    paintGrid() {
        this.ctx.beginPath();
        this.ctx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue("--grid-color")
            .trim();
        this.ctx.lineWidth = 1;

        const { width, height } = state.ellipse;
        const { width: canWidth, height: canHeight, scale } = state.canvas;

        for (let i = 0; i <= width; i++) {
            let x = (i * canWidth) / width;
            if (x >= canWidth) x = canWidth - 1;
            this.ctx.moveTo(x + 0.5 + scale[0], scale[1]);
            this.ctx.lineTo(x + 0.5 + scale[0], canHeight + scale[1]);
        }

        for (let i = 0; i <= height; i++) {
            let y = (i * canHeight) / height;
            if (y >= canHeight) y = canHeight - 1;
            this.ctx.moveTo(scale[0], y + 0.5 + scale[1]);
            this.ctx.lineTo(canWidth + scale[0], y + 0.5 + scale[1]);
        }

        this.ctx.stroke();
    }

    drawBlock(x, y) {
        const { width, height } = state.ellipse;
        const { width: canWidth, height: canHeight, scale } = state.canvas;

        const x1 = (x * canWidth) / width;
        const y1 = (y * canHeight) / height;
        const x2 = ((x + 1) * canWidth) / width;
        const y2 = ((y + 1) * canHeight) / height;
        const w = x2 - x1 + 0.75;
        const h = y2 - y1 + 0.75;

        this.ctx.fillRect(x1 + scale[0], y1 + scale[1], w, h);
    }

    getStepData(stepIndex) {
        const {
            width: ew,
            height: eh,
            innerWidth: inner_ew,
            innerHeight: inner_eh,
        } = state.ellipse;
        const {
            startingAngle,
            totalHeight,
            rotationDegrees,
            rotationDirection,
        } = state.staircase;

        const cx = ew / 2.0 - 0.5;
        const cy = eh / 2.0 - 0.5;
        const rx = ew / 2.0;
        const ry = eh / 2.0;
        const inner_rx = inner_ew / 2.0;
        const inner_ry = inner_eh / 2.0;

        const arr_final = Array.from({ length: eh }, () =>
            Array(ew).fill(false),
        );

        for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
                if (utils.boundary(i, j, cx, cy, rx, ry)) {
                    arr_final[j][i] = true;
                }
            }
        }

        const stepAngleDegrees = rotationDegrees / totalHeight;
        const angleStep = (stepAngleDegrees * Math.PI) / 180;
        const startingAngleRadians = (startingAngle * Math.PI) / 180;

        let startAngle, endAngle;
        if (rotationDirection === 1) {
            startAngle = stepIndex * angleStep + startingAngleRadians;
            endAngle = startAngle + angleStep;
        } else {
            startAngle = startingAngleRadians - stepIndex * angleStep;
            endAngle = startAngle - angleStep;
        }

        let normStart = utils.normalizeAngle(startAngle);
        let normEnd = utils.normalizeAngle(endAngle);

        // Swap for clockwise rotation to get correct wedge
        if (rotationDirection === -1) {
            [normStart, normEnd] = [normEnd, normStart];
        }

        for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
                const dx = i - cx;
                const dy = j - cy;
                const angle = Math.atan2(dy, dx);
                const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

                let inAngleRange = false;
                if (normStart <= normEnd) {
                    inAngleRange =
                        normalizedAngle >= normStart &&
                        normalizedAngle <= normEnd;
                } else {
                    inAngleRange =
                        normalizedAngle >= normStart ||
                        normalizedAngle <= normEnd;
                }

                const inRing =
                    !utils.inside(i, j, cx, cy, inner_rx, inner_ry) &&
                    utils.inside(i, j, cx, cy, rx, ry);

                if (inAngleRange && inRing) {
                    arr_final[j][i] = true;
                }
            }
        }

        return {
            data: arr_final,
            width: ew,
            height: eh,
            centerX: cx,
            centerY: cy,
            radiusX: rx,
            radiusY: ry,
            innerRadiusX: inner_rx,
            innerRadiusY: inner_ry,
        };
    }

    draw() {
        const stepData = this.getStepData(state.staircase.currentStep);
        const { data: arr_final, width: ew, height: eh } = stepData;
        const rootStyles = getComputedStyle(document.documentElement);

        const colors = {
            canvasBg: rootStyles.getPropertyValue("--canvas-bg").trim(),
            blockColor: rootStyles.getPropertyValue("--block-color").trim(),
            ellipseOuter: rootStyles.getPropertyValue("--ellipse-outer").trim(),
            ellipseInner: rootStyles.getPropertyValue("--ellipse-inner").trim(),
        };

        const { width: canWidth, height: canHeight, scale } = state.canvas;

        this.ctx.fillStyle = colors.canvasBg;
        this.ctx.fillRect(scale[0], scale[1], canWidth, canHeight);

        this.ctx.fillStyle = colors.blockColor;
        for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
                if (arr_final[j] && arr_final[j][i]) {
                    this.drawBlock(i, j);
                }
            }
        }

        const scaleX = canWidth / ew;
        const scaleY = canHeight / eh;

        this.ctx.beginPath();
        this.ctx.strokeStyle = colors.ellipseOuter;
        this.ctx.lineWidth = 2;
        this.ctx.ellipse(
            (stepData.centerX + 0.5) * scaleX + scale[0],
            (stepData.centerY + 0.5) * scaleY + scale[1],
            stepData.radiusX * scaleX,
            stepData.radiusY * scaleY,
            0,
            0,
            2 * Math.PI,
        );
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.strokeStyle = colors.ellipseInner;
        this.ctx.lineWidth = 2;
        this.ctx.ellipse(
            (stepData.centerX + 0.5) * scaleX + scale[0],
            (stepData.centerY + 0.5) * scaleY + scale[1],
            stepData.innerRadiusX * scaleX,
            stepData.innerRadiusY * scaleY,
            0,
            0,
            2 * Math.PI,
        );
        this.ctx.stroke();

        this.paintGrid();
    }
}

const render2D = {
    paintGrid(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue("--grid-color")
            .trim();
        ctx.lineWidth = 1;

        const { width, height } = state.ellipse;
        const { width: canWidth, height: canHeight, scale } = state.canvas;

        for (let i = 0; i <= width; i++) {
            let x = (i * canWidth) / width;
            if (x >= canWidth) x = canWidth - 1;
            ctx.moveTo(x + 0.5 + scale[0], scale[1]);
            ctx.lineTo(x + 0.5 + scale[0], canHeight + scale[1]);
        }

        for (let i = 0; i <= height; i++) {
            let y = (i * canHeight) / height;
            if (y >= canHeight) y = canHeight - 1;
            ctx.moveTo(scale[0], y + 0.5 + scale[1]);
            ctx.lineTo(canWidth + scale[0], y + 0.5 + scale[1]);
        }

        ctx.stroke();
    },

    drawBlock(ctx, x, y) {
        const { width, height } = state.ellipse;
        const { width: canWidth, height: canHeight, scale } = state.canvas;

        const x1 = (x * canWidth) / width;
        const y1 = (y * canHeight) / height;
        const x2 = ((x + 1) * canWidth) / width;
        const y2 = ((y + 1) * canHeight) / height;
        const w = x2 - x1 + 0.75;
        const h = y2 - y1 + 0.75;

        ctx.fillRect(x1 + scale[0], y1 + scale[1], w, h);
    },

    getStepData(stepIndex) {
        const {
            width: ew,
            height: eh,
            innerWidth: inner_ew,
            innerHeight: inner_eh,
        } = state.ellipse;
        const {
            startingAngle,
            totalHeight,
            rotationDegrees,
            rotationDirection,
        } = state.staircase;

        const cx = ew / 2.0 - 0.5;
        const cy = eh / 2.0 - 0.5;
        const rx = ew / 2.0;
        const ry = eh / 2.0;
        const inner_rx = inner_ew / 2.0;
        const inner_ry = inner_eh / 2.0;

        const arr_final = Array.from({ length: eh }, () =>
            Array(ew).fill(false),
        );

        for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
                if (utils.boundary(i, j, cx, cy, rx, ry)) {
                    arr_final[j][i] = true;
                }
            }
        }

        const stepAngleDegrees = rotationDegrees / totalHeight;
        const angleStep = (stepAngleDegrees * Math.PI) / 180;
        const startingAngleRadians = (startingAngle * Math.PI) / 180;

        let startAngle, endAngle;
        if (rotationDirection === 1) {
            startAngle = stepIndex * angleStep + startingAngleRadians;
            endAngle = startAngle + angleStep;
        } else {
            startAngle = startingAngleRadians - stepIndex * angleStep;
            endAngle = startAngle - angleStep;
        }

        let normStart = utils.normalizeAngle(startAngle);
        let normEnd = utils.normalizeAngle(endAngle);

        // Swap for clockwise rotation to get correct wedge
        if (rotationDirection === -1) {
            [normStart, normEnd] = [normEnd, normStart];
        }

        for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
                const dx = i - cx;
                const dy = j - cy;
                const angle = Math.atan2(dy, dx);
                const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

                let inAngleRange = false;
                if (normStart <= normEnd) {
                    inAngleRange =
                        normalizedAngle >= normStart &&
                        normalizedAngle <= normEnd;
                } else {
                    inAngleRange =
                        normalizedAngle >= normStart ||
                        normalizedAngle <= normEnd;
                }

                const inRing =
                    !utils.inside(i, j, cx, cy, inner_rx, inner_ry) &&
                    utils.inside(i, j, cx, cy, rx, ry);

                if (inAngleRange && inRing) {
                    arr_final[j][i] = true;
                }
            }
        }

        return {
            data: arr_final,
            width: ew,
            height: eh,
            centerX: cx,
            centerY: cy,
            radiusX: rx,
            radiusY: ry,
            innerRadiusX: inner_rx,
            innerRadiusY: inner_ry,
        };
    },

    draw(ctx) {
        const stepData = this.getStepData(state.staircase.currentStep);
        const { data: arr_final, width: ew, height: eh } = stepData;
        const rootStyles = getComputedStyle(document.documentElement);

        const colors = {
            canvasBg: rootStyles.getPropertyValue("--canvas-bg").trim(),
            blockColor: rootStyles.getPropertyValue("--block-color").trim(),
            ellipseOuter: rootStyles.getPropertyValue("--ellipse-outer").trim(),
            ellipseInner: rootStyles.getPropertyValue("--ellipse-inner").trim(),
        };

        const { width: canWidth, height: canHeight, scale } = state.canvas;

        ctx.fillStyle = colors.canvasBg;
        ctx.fillRect(scale[0], scale[1], canWidth, canHeight);

        ctx.fillStyle = colors.blockColor;
        for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
                if (arr_final[j] && arr_final[j][i]) {
                    this.drawBlock(ctx, i, j);
                }
            }
        }

        const scaleX = canWidth / ew;
        const scaleY = canHeight / eh;

        ctx.beginPath();
        ctx.strokeStyle = colors.ellipseOuter;
        ctx.lineWidth = 2;
        ctx.ellipse(
            (stepData.centerX + 0.5) * scaleX + scale[0],
            (stepData.centerY + 0.5) * scaleY + scale[1],
            stepData.radiusX * scaleX,
            stepData.radiusY * scaleY,
            0,
            0,
            2 * Math.PI,
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = colors.ellipseInner;
        ctx.lineWidth = 2;
        ctx.ellipse(
            (stepData.centerX + 0.5) * scaleX + scale[0],
            (stepData.centerY + 0.5) * scaleY + scale[1],
            stepData.innerRadiusX * scaleX,
            stepData.innerRadiusY * scaleY,
            0,
            0,
            2 * Math.PI,
        );
        ctx.stroke();

        this.paintGrid(ctx);
    },
};

class Render3D {
    constructor() {
        this.keys = {};
        this.needsRender = false;
        this.animationId = null;
        this.scene = null;
        this.camera = null;
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.renderer = null;
        this.initialized = false;

        this.container = document.getElementById("scene3d");
        const rect = this.container.getBoundingClientRect();

        try {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(
                utils.isDarkTheme() ? 0x141218 : 0xfefbff,
            );

            this.camera = new THREE.PerspectiveCamera(
                75,
                rect.width / rect.height,
                0.1,
                1000,
            );
            this.camera.position.set(25, 20, 25);

            this.camera.lookAt(this.cameraTarget);

            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
            });
            this.renderer.setSize(rect.width, rect.height);
            this.renderer.shadowMap.enabled = false;

            this.container.appendChild(state.view3D.renderer.domElement);

            this.setupLighting();
            this.setupControls(container);
            this.startAnimationLoop();
            this.generateStaircase();
            this.initialized = true;
        } catch (error) {
            console.error("Failed to initialize 3D mode:", error);
            alert("3D visualization failed to initialize.");
        }
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(50, 50, 25);
        this.scene.add(directionalLight);
    }

    setupControls() {
        let mouseDown = false;
        let mouseX = 0;
        let mouseY = 0;

        const handleMouseDown = (e) => {
            mouseDown = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        const handleMouseMove = (e) => {
            if (!mouseDown) return;

            const deltaX = e.clientX - mouseX;
            const deltaY = e.clientY - mouseY;

            if (e.shiftKey) {
                const right = new THREE.Vector3();
                const up = new THREE.Vector3(0, 1, 0);
                this.camera.getWorldDirection(right);
                right.cross(up).normalize();

                const panSpeed = 0.05;
                const panX = right.clone().multiplyScalar(-deltaX * panSpeed);
                const panY = up.clone().multiplyScalar(deltaY * panSpeed);

                this.camera.position.add(panX).add(panY);
                this.cameraTarget.add(panX).add(panY);
            } else {
                const offset = new THREE.Vector3().subVectors(
                    this.camera.position,
                    this.cameraTarget,
                );
                const spherical = new THREE.Spherical().setFromVector3(offset);

                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(
                    0.1,
                    Math.min(Math.PI - 0.1, spherical.phi),
                );

                offset.setFromSpherical(spherical);
                this.camera.position.copy(this.cameraTarget).add(offset);
            }

            this.camera.lookAt(this.cameraTarget);
            mouseX = e.clientX;
            mouseY = e.clientY;
            this.needsRender = true;
        };

        const handleMouseUp = () => {
            mouseDown = false;
        };

        const handleWheel = (e) => {
            e.preventDefault();
            const offset = new THREE.Vector3().subVectors(
                this.camera.position,
                this.cameraTarget,
            );
            const distance = offset.length();
            const newDistance = utils.clamp(distance + e.deltaY * 0.01, 5, 100);

            offset.normalize().multiplyScalar(newDistance);
            this.camera.position.copy(this.cameraTarget).add(offset);
            this.camera.lookAt(this.cameraTarget);
            this.needsRender = true;
        };

        this.container.addEventListener("mousedown", handleMouseDown);
        this.container.addEventListener("mousemove", handleMouseMove);
        this.container.addEventListener("mouseup", handleMouseUp);
        this.container.addEventListener("wheel", handleWheel, {
            passive: false,
        });
    }

    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);

            let moved = false;
            const forward = new THREE.Vector3();
            const right = new THREE.Vector3();

            this.camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

            if (this.keys["w"] || this.keys["arrowup"]) {
                this.camera.position.addScaledVector(
                    forward,
                    CONSTANTS.CAMERA_MOVE_SPEED,
                );
                this.cameraTarget.addScaledVector(
                    forward,
                    CONSTANTS.CAMERA_MOVE_SPEED,
                );
                moved = true;
            }
            if (this.keys["s"] || this.keys["arrowdown"]) {
                this.camera.position.addScaledVector(
                    forward,
                    -CONSTANTS.CAMERA_MOVE_SPEED,
                );
                this.cameraTarget.addScaledVector(
                    forward,
                    -CONSTANTS.CAMERA_MOVE_SPEED,
                );
                moved = true;
            }
            if (this.keys["a"] || this.keys["arrowleft"]) {
                this.camera.position.addScaledVector(
                    right,
                    -CONSTANTS.CAMERA_MOVE_SPEED,
                );
                this.cameraTarget.addScaledVector(
                    right,
                    -CONSTANTS.CAMERA_MOVE_SPEED,
                );
                moved = true;
            }
            if (this.keys["d"] || this.keys["arrowright"]) {
                this.camera.position.addScaledVector(
                    right,
                    CONSTANTS.CAMERA_MOVE_SPEED,
                );
                this.cameraTarget.addScaledVector(
                    right,
                    CONSTANTS.CAMERA_MOVE_SPEED,
                );
                moved = true;
            }
            if (this.keys["q"]) {
                this.camera.position.y += CONSTANTS.CAMERA_MOVE_SPEED;
                this.cameraTarget.y += CONSTANTS.CAMERA_MOVE_SPEED;
                moved = true;
            }
            if (this.keys["e"]) {
                this.camera.position.y -= CONSTANTS.CAMERA_MOVE_SPEED;
                this.cameraTarget.y -= CONSTANTS.CAMERA_MOVE_SPEED;
                moved = true;
            }

            if (moved) {
                this.camera.lookAt(this.cameraTarget);
                this.needsRender = true;
            }

            if (this.needsRender) {
                this.render();
                this.needsRender = false;
            }
        };

        animate();
    }

    cleanup() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.renderer) {
            this.renderer.dispose();
            const container = document.getElementById("scene3d");
            if (
                container &&
                this.renderer.domElement.parentNode === container
            ) {
                container.removeChild(this.renderer.domElement);
            }
        }

        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach((mat) => mat.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }

    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    updateTheme() {
        if (this.scene) {
            this.scene.background = new THREE.Color(
                utils.isDarkTheme() ? 0x141218 : 0xfefbff,
            );

            const isDark = utils.isDarkTheme();
            this.scene.traverse((object) => {
                if (object.isMesh || object.isLine) {
                    if (object.userData.isBlock && object.material) {
                        if (object.material.color) {
                            object.material.color.setHex(
                                isDark ? 0xe6e0e9 : 0x1d1b20,
                            );
                        }
                    } else if (object.userData.isEllipse && object.material) {
                        const isOuter = object.userData.ellipseType === "outer";
                        object.material.color.setHex(
                            isOuter
                                ? isDark
                                    ? 0xf2b8b5
                                    : 0xd32f2f
                                : isDark
                                  ? 0xa8c7fa
                                  : 0x1565c0,
                        );
                    }
                }
            });

            this.needsRender = true;
        }
    }

    generateStaircase() {
        if (!this.scene) return;

        const existingObjects = this.scene.children.filter(
            (child) => child.userData.isBlock || child.userData.isEllipse,
        );
        existingObjects.forEach((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            this.scene.remove(obj);
        });

        const {
            width: ew,
            height: eh,
            innerWidth: inner_ew,
            innerHeight: inner_eh,
        } = state.ellipse;
        const {
            totalHeight,
            rotationDegrees,
            verticalDirection,
            rotationDirection,
            currentStep,
            showSingleStep,
            startingAngle,
        } = state.staircase;

        const cx = ew / 2.0 - 0.5;
        const cy = eh / 2.0 - 0.5;
        const rx = ew / 2.0;
        const ry = eh / 2.0;
        const inner_rx = inner_ew / 2.0;
        const inner_ry = inner_eh / 2.0;

        const isDark = utils.isDarkTheme();
        const blockMaterial = new THREE.MeshLambertMaterial({
            color: isDark ? 0xe6e0e9 : 0x1d1b20,
        });

        const stepAngleDegrees = rotationDegrees / totalHeight;
        const angleStep = (stepAngleDegrees * Math.PI) / 180;
        const startingAngleRadians = (startingAngle * Math.PI) / 180;

        const stepStart = showSingleStep ? currentStep : 0;
        const stepEnd = showSingleStep ? currentStep + 1 : totalHeight;
        const stepHeight = 0.5;

        const allPositions = [];

        for (let i = stepStart; i < stepEnd; i++) {
            const stepIndex = i % totalHeight;

            let startAngle, endAngle;
            if (rotationDirection === 1) {
                startAngle = stepIndex * angleStep + startingAngleRadians;
                endAngle = startAngle + angleStep;
            } else {
                startAngle = startingAngleRadians - stepIndex * angleStep;
                endAngle = startAngle - angleStep;
            }

            const y = i * stepHeight * verticalDirection;

            const stepPositions = this.getStepPositions(
                cx,
                cy,
                rx,
                ry,
                inner_rx,
                inner_ry,
                ew,
                eh,
                startAngle,
                endAngle,
                y,
            );
            allPositions.push(...stepPositions);
        }

        if (allPositions.length > 0) {
            const boxGeometry = new THREE.BoxGeometry(
                CONSTANTS.BLOCK_SIZE,
                CONSTANTS.BLOCK_SIZE,
                CONSTANTS.BLOCK_SIZE,
            );
            const matrix = new THREE.Matrix4();
            this.createInstancedMesh(
                boxGeometry,
                blockMaterial,
                allPositions,
                matrix,
                true,
            );
        }

        this.drawEllipseRing(
            rx * 0.5,
            ry * 0.5,
            0,
            isDark ? 0xf2b8b5 : 0xd32f2f,
            CONSTANTS.OPACITY.ELLIPSE_OUTLINE,
            "outer",
        );
        this.drawEllipseRing(
            inner_rx * 0.5,
            inner_ry * 0.5,
            0,
            isDark ? 0xa8c7fa : 0x1565c0,
            CONSTANTS.OPACITY.ELLIPSE_OUTLINE,
            "inner",
        );

        if (!showSingleStep) {
            const topY = (stepEnd - stepStart) * stepHeight * verticalDirection;
            this.drawEllipseRing(
                rx * 0.5,
                ry * 0.5,
                topY,
                isDark ? 0xf2b8b5 : 0xd32f2f,
                CONSTANTS.OPACITY.ELLIPSE_OUTLINE,
                "outer",
            );
            this.drawEllipseRing(
                inner_rx * 0.5,
                inner_ry * 0.5,
                topY,
                isDark ? 0xa8c7fa : 0x1565c0,
                CONSTANTS.OPACITY.ELLIPSE_OUTLINE,
                "inner",
            );
        }

        this.needsRender = true;
    }

    getStepPositions(
        cx,
        cy,
        rx,
        ry,
        inner_rx,
        inner_ry,
        ew,
        eh,
        startAngle,
        endAngle,
        height,
    ) {
        let normStart = utils.normalizeAngle(startAngle);
        let normEnd = utils.normalizeAngle(endAngle);

        // Swap for clockwise rotation to get correct wedge
        const rotationDirection = state.staircase.rotationDirection;
        if (rotationDirection === -1) {
            [normStart, normEnd] = [normEnd, normStart];
        }

        const scaleX = (rx * 2 * 0.5) / ew;
        const scaleZ = (ry * 2 * 0.5) / eh;

        const positions = [];

        for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
                const dx = i - cx;
                const dy = j - cy;
                const angle = Math.atan2(dy, dx);
                const normalizedAngle = utils.normalizeAngle(angle);

                const inAngleRange =
                    normStart <= normEnd
                        ? normalizedAngle >= normStart &&
                          normalizedAngle <= normEnd
                        : normalizedAngle >= normStart ||
                          normalizedAngle <= normEnd;

                const inRing =
                    !utils.inside(i, j, cx, cy, inner_rx, inner_ry) &&
                    utils.inside(i, j, cx, cy, rx, ry);

                if (inAngleRange && inRing) {
                    const x = (i - cx) * scaleX;
                    const z = (j - cy) * scaleZ;
                    positions.push({ x, y: height, z });
                }
            }
        }

        return positions;
    }

    createInstancedMesh(geometry, material, positions, matrix, withEdges) {
        if (positions.length === 0) return;

        const mesh = new THREE.InstancedMesh(
            geometry,
            material,
            positions.length,
        );
        positions.forEach((pos, i) => {
            matrix.setPosition(pos.x, pos.y, pos.z);
            mesh.setMatrixAt(i, matrix);
        });

        mesh.castShadow = false;
        mesh.receiveShadow = false;

        if (withEdges) {
            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({
                color: utils.isDarkTheme() ? 0x49454f : 0xcac4d0,
                transparent: true,
                opacity: CONSTANTS.OPACITY.EDGE,
            });
            const edgesMesh = new THREE.InstancedMesh(
                edgeGeometry,
                edgeMaterial,
                positions.length,
            );
            positions.forEach((pos, i) => {
                matrix.setPosition(pos.x, pos.y, pos.z);
                edgesMesh.setMatrixAt(i, matrix);
            });
            edgesMesh.userData.isBlock = true;
            this.scene.add(edgesMesh);
        }

        mesh.userData.isBlock = true;
        this.scene.add(mesh);
    }

    drawEllipseRing(radiusX, radiusY, height, color, opacity, type) {
        const curve = new THREE.EllipseCurve(
            0,
            0,
            radiusX,
            radiusY,
            0,
            2 * Math.PI,
            false,
            0,
        );
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
        });

        const ellipse = new THREE.Line(geometry, material);
        ellipse.rotation.x = Math.PI / 2;
        ellipse.position.y = height;
        ellipse.userData.isEllipse = true;
        ellipse.userData.ellipseType = type;

        this.scene.add(ellipse);
    }

    make_stale() {
        const rect = this.container.getBoundingClientRect();
        this.renderer.setSize(rect.width, rect.height);
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
        this.needsRender = true;
    }
}

const keyHandlers = {
    init() {
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
    },

    cleanup() {
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
    },

    handleKeyDown(e) {
        if (state.builderMode && e.key === "Escape") {
            toggleBuilderMode();
            return;
        }

        if (state.builderMode) {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                nextStep();
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                prevStep();
            }
        }

        if (state.viewMode === "3d") {
            state.view3D.keys[e.key.toLowerCase()] = true;
        }
    },

    handleKeyUp(e) {
        if (state.viewMode === "3d") {
            state.view3D.keys[e.key.toLowerCase()] = false;
        }
    },
};

function toggleOuterMirror() {
    state.ellipse.outerMirrored = !state.ellipse.outerMirrored;
    controls.updateMirrorButton("outer-mirror", state.ellipse.outerMirrored);
    if (state.ellipse.outerMirrored) {
        state.ellipse.height = state.ellipse.width;
        document.getElementById("ellh").value = state.ellipse.height;
        controls.updateView();
    }
}

function toggleInnerMirror() {
    state.ellipse.innerMirrored = !state.ellipse.innerMirrored;
    controls.updateMirrorButton("inner-mirror", state.ellipse.innerMirrored);
    if (state.ellipse.innerMirrored) {
        state.ellipse.innerHeight = state.ellipse.innerWidth;
        document.getElementById("innerellh").value = state.ellipse.innerHeight;
        controls.updateView();
    }
}

function setVerticalDirection(direction) {
    state.staircase.verticalDirection = direction;
    document
        .querySelectorAll(".direction-btn.vertical")
        .forEach((btn) => btn.classList.remove("active"));
    event.target.closest(".direction-btn").classList.add("active");
    controls.updateView();
}

function setRotationDirection(direction) {
    state.staircase.rotationDirection = direction;
    document
        .querySelectorAll(".direction-btn.rotation")
        .forEach((btn) => btn.classList.remove("active"));
    event.target.closest(".direction-btn").classList.add("active");
    controls.updateView();
}

function nextStep() {
    const { totalHeight } = state.staircase;
    state.staircase.currentStep =
        (state.staircase.currentStep + 1) % totalHeight;
    controls.updateView();
    if (state.builderMode) updateBuilderDisplay();
}

function prevStep() {
    const { totalHeight } = state.staircase;
    state.staircase.currentStep--;
    if (state.staircase.currentStep < 0)
        state.staircase.currentStep = totalHeight - 1;
    controls.updateView();
    if (state.builderMode) updateBuilderDisplay();
}

function toggleSingleStep() {
    state.staircase.showSingleStep = !state.staircase.showSingleStep;
    const button = document.getElementById("single-step-toggle");
    const stepNav = document.getElementById("step-nav-buttons");

    if (state.staircase.showSingleStep) {
        button.classList.add("active");
        button.querySelector(".material-icons").textContent = "filter_1";
        button.title = "Showing single step";
        stepNav.style.display = "flex";
    } else {
        button.classList.remove("active");
        button.querySelector(".material-icons").textContent = "view_carousel";
        button.title = "Show single step";
        stepNav.style.display = "none";
    }

    controls.updateView();
}

function toggleBuilderMode() {
    state.builderMode = !state.builderMode;

    const controlsPanel = document.querySelector(".controls-panel");
    const topBar = document.querySelector(".top-app-bar");
    const builderOverlay = document.getElementById("builder-overlay");
    const builderControls = document.getElementById("builder-controls");
    const builderInfo = document.getElementById("builder-info");

    if (state.builderMode) {
        if (state.viewMode === "3d") toggleViewMode();

        controlsPanel.style.display = "none";
        topBar.style.display = "none";
        builderOverlay.style.display = "block";
        builderControls.style.display = "flex";
        builderInfo.style.display = "block";

        updateBuilderDisplay();
        resizeCanvas();
    } else {
        controlsPanel.style.display = "flex";
        topBar.style.display = "flex";
        builderOverlay.style.display = "none";
        builderControls.style.display = "none";
        builderInfo.style.display = "none";

        resizeCanvas();
    }
}

function updateBuilderDisplay() {
    document.getElementById("builder-step-number").textContent =
        state.staircase.currentStep + 1;
    document.getElementById("builder-step-total").textContent =
        state.staircase.totalHeight;
    document.getElementById("builder-height").textContent =
        `Height: ${state.staircase.totalHeight} blocks`;
    document.getElementById("builder-rotation").textContent =
        `Rotation: ${state.staircase.rotationDegrees}°`;
    document.getElementById("builder-vertical").textContent =
        `Vertical: ${state.staircase.verticalDirection === 1 ? "Up" : "Down"}`;
    document.getElementById("builder-spiral").textContent =
        `Spiral: ${state.staircase.rotationDirection === 1 ? "CCW" : "CW"}`;
}

let renderer3D = null;

function toggleViewMode() {
    state.viewMode = state.viewMode === "2d" ? "3d" : "2d";

    const canvas2D = document.getElementById("myCanvas");
    const scene3D = document.getElementById("scene3d");
    const toggleBtn = document.getElementById("view-toggle");
    const viewModeControl = document.getElementById("view-mode-control");
    const stepNav = document.getElementById("step-nav-buttons");

    if (state.viewMode === "3d") {
        canvas2D.style.display = "none";
        scene3D.style.display = "block";
        toggleBtn.classList.add("active");
        toggleBtn.innerHTML =
            '<span class="material-icons">grid_view</span> 2D Mode';
        viewModeControl.style.display = "flex";

        if (state.staircase.showSingleStep) {
            stepNav.style.display = "flex";
        } else {
            stepNav.style.display = "none";
        }

        if (!state.view3D.scene) {
            renderer3D = new Render3D();
        } else {
            renderer3D.generateStaircase();
            renderer3D.make_stale();
        }
    } else {
        canvas2D.style.display = "block";
        scene3D.style.display = "none";
        toggleBtn.classList.remove("active");
        toggleBtn.innerHTML =
            '<span class="material-icons">view_in_ar</span> 3D Mode';
        viewModeControl.style.display = "none";
        stepNav.style.display = "flex";
        resizeCanvas();
    }
}

function resizeCanvas() {
    if (state.viewMode === "3d") return;

    const d = document.getElementById("canvas-container");
    const elHeight = d.clientHeight;
    const elWidth = d.clientWidth;

    let width = elWidth;
    let height = elHeight;
    const { width: ellipseWidth, height: ellipseHeight } = state.ellipse;
    const { scale } = state.canvas;

    const h1 = height;
    const w1 = (height * ellipseWidth) / ellipseHeight;
    const w2 = width;
    const h2 = (width * ellipseHeight) / ellipseWidth;

    if (w1 > w2) {
        width = w2;
        height = h2;
    } else {
        width = w1;
        height = h1;
    }

    width *= scale[2];
    height *= scale[3];

    const can = document.getElementById("myCanvas");
    state.canvas.width = width;
    state.canvas.height = height;
    can.width = elWidth;
    can.height = elHeight;

    const ctx = can.getContext("2d");
    new Render2D(ctx).draw();
}

function toggleTheme() {
    const currentTheme =
        document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "light" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", newTheme);
    const themeIcon = document.getElementById("theme-icon");
    if (themeIcon) {
        themeIcon.textContent =
            newTheme === "light" ? "dark_mode" : "light_mode";
    }

    if (state.viewMode === "3d") {
        render3D.updateTheme();
    } else {
        resizeCanvas();
    }
}

window.addEventListener("load", () => {
    document.getElementById("ellw").value = state.ellipse.width;
    document.getElementById("ellh").value = state.ellipse.height;
    document.getElementById("innerellw").value = state.ellipse.innerWidth;
    document.getElementById("innerellh").value = state.ellipse.innerHeight;
    document.getElementById("totalheight").value = state.staircase.totalHeight;
    document.getElementById("rotation").value = state.staircase.rotationDegrees;
    document.getElementById("startangle").value = state.staircase.startingAngle;

    controls.updateMirrorButton("outer-mirror", state.ellipse.outerMirrored);
    controls.updateMirrorButton("inner-mirror", state.ellipse.innerMirrored);

    document.documentElement.setAttribute("data-theme", "dark");
    const themeIcon = document.getElementById("theme-icon");
    if (themeIcon) {
        themeIcon.textContent = "light_mode";
    }

    keyHandlers.init();

    state.viewMode = "3d";
    render3D.init();
});

window.addEventListener("resize", () => {
    if (state.viewMode === "3d" && state.view3D.renderer) {
        const container = document.getElementById("scene3d");
        const rect = container.getBoundingClientRect();
        state.view3D.renderer.setSize(rect.width, rect.height);
        state.view3D.camera.aspect = rect.width / rect.height;
        state.view3D.camera.updateProjectionMatrix();
        state.view3D.needsRender = true;
    } else if (state.viewMode === "2d") {
        resizeCanvas();
    }
});

window.addEventListener("beforeunload", () => {
    keyHandlers.cleanup();
    if (state.viewMode === "3d") {
        render3D.cleanup();
    }
});
