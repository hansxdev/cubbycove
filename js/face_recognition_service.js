/**
 * CUBBYCOVE FACE RECOGNITION SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses face-api.js (TensorFlow.js) for 100% client-side liveness detection.
 *
 * HOW IT WORKS:
 * ─ Loads lightweight models from CDN (no local model files needed)
 * ─ Detects 68 facial landmarks from webcam frames
 * ─ Measures EAR (Eye Aspect Ratio) for blink detection
 * ─ Measures nose-to-eye yaw offset for left/right head turn
 * ─ Measures nose-to-forehead pitch offset for looking up/down
 *
 * USAGE:
 *   import { FaceRecognitionService } from './face_recognition_service.js';
 *   Or use FaceRecognitionService directly (auto-attached to window).
 *
 * LIVENESS CHECK STEPS:
 *   1. Blink once
 *   2. Look to your right
 *   3. Look to your left
 *   4. Look up
 *
 * ENROLLMENT:
 *   Captures a 128-dimension face descriptor from a photo/video frame.
 *   The descriptor (not the raw image) is stored in Appwrite.
 */

const FaceRecognitionService = (() => {

    // ── State ──────────────────────────────────────────────────────────────────
    let _modelsLoaded = false;
    let _modelsLoading = false;
    let _videoEl = null;
    let _canvasEl = null;
    let _animFrame = null;
    let _livenessCallback = null;
    let _currentStep = 0;
    let _stepPassed = [];
    let _onComplete = null;
    let _onError = null;
    let _enrollmentDescriptor = null;

    // Liveness steps definition
    const LIVENESS_STEPS = [
        { key: 'blink',      icon: '👁️',  label: 'Please blink once!',         color: '#8A51FC' },
        { key: 'look_right', icon: '👉',  label: 'Now look to your right!',    color: '#06D6A0' },
        { key: 'look_left',  icon: '👈',  label: 'Now look to your left!',     color: '#4F8AEE' },
        { key: 'look_up',    icon: '☝️',  label: 'Finally, look up!',          color: '#FFD166' },
    ];

    // Thresholds (tweaked for realism)
    const EAR_BLINK_THRESHOLD  = 0.28;   // Below this = eyes closed
    const YAW_THRESHOLD        = 0.12;   // Nose horizontal offset ratio
    const PITCH_UP_THRESHOLD   = 0.08;   // Nose vertical "look up" offset ratio
    const BLINK_COOLDOWN_MS    = 500;    // Prevent multi-counting
    const DETECTION_FPS        = 30;     // Target frames-per-second for landmark detection

    let _lastBlinkTime = 0;
    let _eyesWereClosed = false;

    // ── CDN Model URL ──────────────────────────────────────────────────────────
    // Uses face-api.js tiny models (fast, lightweight, ~3MB total)
    const MODEL_BASE_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Loads the required face-api.js models.
     * Call this early (e.g. on page load) to warm up the models.
     * Returns a Promise that resolves when models are ready.
     */
    async function loadModels() {
        if (_modelsLoaded) return true;
        if (_modelsLoading) {
            // Wait for the in-progress load to finish
            return new Promise(resolve => {
                const check = setInterval(() => {
                    if (_modelsLoaded) { clearInterval(check); resolve(true); }
                }, 200);
            });
        }
        _modelsLoading = true;
        try {
            if (!window.faceapi) {
                throw new Error('face-api.js is not loaded. Include the CDN script first.');
            }
            console.log('[FaceRS] Loading models from CDN...');
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_BASE_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE_URL),
            ]);
            _modelsLoaded = true;
            console.log('[FaceRS] ✅ Models loaded.');
            return true;
        } catch (err) {
            _modelsLoading = false;
            console.error('[FaceRS] ❌ Failed to load models:', err);
            throw err;
        }
    }

    // ── Geometry Helpers ───────────────────────────────────────────────────────

    /** Euclidean distance between two face-api.js landmark points */
    function _dist(p1, p2) {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    }

    /**
     * Eye Aspect Ratio (EAR) — Soukupová & Čech (2016)
     * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
     * p = the 6 eye landmark points in order
     */
    function _calcEAR(eyePts) {
        const A = _dist(eyePts[1], eyePts[5]);
        const B = _dist(eyePts[2], eyePts[4]);
        const C = _dist(eyePts[0], eyePts[3]);
        return (A + B) / (2.0 * C);
    }

    /**
     * Returns a horizontal yaw offset normalized to face width.
     * Positive = nose is to the right side of face = looking LEFT
     * Negative = nose is to the left side of face = looking RIGHT
     */
    function _calcYaw(landmarks) {
        const pts = landmarks.positions;
        // Nose tip = pt 30, Left eye outer = 36, Right eye outer = 45
        const noseTip = pts[30];
        const leftEye  = pts[36];
        const rightEye = pts[45];
        const faceWidth = _dist(leftEye, rightEye);
        const faceCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
        return (noseTip.x - faceCenter.x) / faceWidth; // normalized
    }

    /**
     * Returns a vertical pitch offset normalized to face height.
     * Positive = nose is above face center = looking DOWN (camera perspective)
     * Negative = nose is below face center = looking UP
     */
    function _calcPitch(landmarks) {
        const pts = landmarks.positions;
        // Nose tip = 30, chin = 8, forehead midpoint estimated from brow = 27
        const noseTip = pts[30];
        const chin     = pts[8];
        const brow     = pts[27]; // lower nose bridge, approximation
        const faceHeight = _dist(brow, chin);
        const faceCenter = { x: (brow.x + chin.x) / 2, y: (brow.y + chin.y) / 2 };
        return (faceCenter.y - noseTip.y) / faceHeight; // normalized
    }

    // ── Liveness Detection ─────────────────────────────────────────────────────

    /**
     * Checks whether the current animation frame passes the given step.
     * Returns a liveness event object or null.
     */
    function _checkLivenessStep(landmarks, stepKey) {
        const pts = landmarks.positions;

        if (stepKey === 'blink') {
            // Eye landmark indices (left 36-41, right 42-47)
            const leftEye  = [pts[36], pts[37], pts[38], pts[39], pts[40], pts[41]];
            const rightEye = [pts[42], pts[43], pts[44], pts[45], pts[46], pts[47]];
            const ear = (_calcEAR(leftEye) + _calcEAR(rightEye)) / 2;
            const now = Date.now();
            if (ear < EAR_BLINK_THRESHOLD) {
                _eyesWereClosed = true;
            } else if (_eyesWereClosed && (now - _lastBlinkTime) > BLINK_COOLDOWN_MS) {
                // Eyes opened after being closed = completed blink
                _eyesWereClosed = false;
                _lastBlinkTime = now;
                return { passed: true, event: 'blink' };
            }
        }

        if (stepKey === 'look_right') {
            const yaw = _calcYaw(landmarks);
            // Negative yaw = nose shifted left = person looking right from their POV
            if (yaw < -YAW_THRESHOLD) return { passed: true, event: 'look_right' };
        }

        if (stepKey === 'look_left') {
            const yaw = _calcYaw(landmarks);
            // Positive yaw = nose shifted right = person looking left from their POV
            if (yaw > YAW_THRESHOLD) return { passed: true, event: 'look_left' };
        }

        if (stepKey === 'look_up') {
            const pitch = _calcPitch(landmarks);
            // When looking up, nose moves UP the face (lower Y coordinate).
            // So faceCenter.y (e.g. 50) - nose.y (e.g. 30) = +20. Pitch is POSITIVE.
            if (pitch > PITCH_UP_THRESHOLD) return { passed: true, event: 'look_up' };
        }

        return null;
    }

    // ── Frame Loop ─────────────────────────────────────────────────────────────

    let _lastDetectionTime = 0;
    const DETECTION_INTERVAL_MS = 1000 / DETECTION_FPS;

    async function _detectionLoop(uiCallbacks) {
        if (!_videoEl || !_currentStep || _currentStep > LIVENESS_STEPS.length) return;

        const now = performance.now();
        if (now - _lastDetectionTime < DETECTION_INTERVAL_MS) {
            _animFrame = requestAnimationFrame(() => _detectionLoop(uiCallbacks));
            return;
        }
        _lastDetectionTime = now;

        try {
            const detection = await faceapi
                .detectSingleFace(_videoEl, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks(true);

            if (!detection) {
                uiCallbacks?.onNoFace?.();
                _animFrame = requestAnimationFrame(() => _detectionLoop(uiCallbacks));
                return;
            }

            uiCallbacks?.onFaceDetected?.();
            const landmarks = detection.landmarks;
            const stepDef = LIVENESS_STEPS[_currentStep - 1];
            const result = _checkLivenessStep(landmarks, stepDef.key);

            if (result?.passed) {
                _stepPassed.push(stepDef.key);
                uiCallbacks?.onStepPassed?.(stepDef, _currentStep, LIVENESS_STEPS.length);

                if (_currentStep >= LIVENESS_STEPS.length) {
                    // All steps complete!
                    _stopLoop();
                    // Capture enrollment descriptor if not already done
                    if (!_enrollmentDescriptor) {
                        _enrollmentDescriptor = detection.descriptor;
                    }
                    _onComplete?.(_enrollmentDescriptor);
                    return;
                }
                _currentStep++;
                const nextStep = LIVENESS_STEPS[_currentStep - 1];
                uiCallbacks?.onNextStep?.(nextStep, _currentStep, LIVENESS_STEPS.length);
            }
        } catch (err) {
            console.warn('[FaceRS] Detection error:', err.message);
        }

        _animFrame = requestAnimationFrame(() => _detectionLoop(uiCallbacks));
    }

    function _stopLoop() {
        if (_animFrame) {
            cancelAnimationFrame(_animFrame);
            _animFrame = null;
        }
    }

    // ── Main Entry Points ──────────────────────────────────────────────────────

    /**
     * Runs a full liveness check on the given video element.
     *
     * @param {HTMLVideoElement} videoEl - Live webcam element
     * @param {object} uiCallbacks - Hooks to update the UI
     *   - onNoFace()
     *   - onFaceDetected()
     *   - onStepPassed(stepDef, stepNum, totalSteps)
     *   - onNextStep(stepDef, stepNum, totalSteps)
     * @returns {Promise<Float32Array>} Resolves with the face descriptor on success
     */
    function startLivenessCheck(videoEl, uiCallbacks = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                await loadModels();
                _videoEl = videoEl;
                _currentStep = 1;
                _stepPassed = [];
                _enrollmentDescriptor = null;
                _eyesWereClosed = false;
                _lastBlinkTime = 0;
                _onComplete = resolve;
                _onError = reject;

                const firstStep = LIVENESS_STEPS[0];
                uiCallbacks?.onNextStep?.(firstStep, 1, LIVENESS_STEPS.length);

                _detectionLoop(uiCallbacks);
            } catch (err) {
                reject(err);
            }
        });
    }

    /** Stops any running liveness detection loop. */
    function stopLivenessCheck() {
        _stopLoop();
        _currentStep = 0;
    }

    /**
     * Captures a face descriptor from a still image or video element.
     * Used during enrollment (registration).
     * Returns a Float32Array (128-dim descriptor) or null.
     */
    async function captureDescriptor(mediaEl) {
        await loadModels();
        try {
            const detection = await faceapi
                .detectSingleFace(mediaEl, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks(true)
                .withFaceDescriptor();
            if (!detection) return null;
            return detection.descriptor; // Float32Array[128]
        } catch (err) {
            console.warn('[FaceRS] captureDescriptor error:', err.message);
            return null;
        }
    }

    /**
     * Compares two face descriptors.
     * Returns a { match: bool, distance: float } result.
     * Threshold 0.5 is Euclidean distance — lower = more similar.
     */
    function compareDescriptors(d1, d2, threshold = 0.5) {
        if (!d1 || !d2) return { match: false, distance: Infinity };
        const distance = faceapi.euclideanDistance(d1, d2);
        return { match: distance <= threshold, distance };
    }

    /**
     * Serializes a Float32Array descriptor to a base64 string (for storage in Appwrite).
     */
    function descriptorToBase64(descriptor) {
        if (!descriptor) return null;
        const bytes = new Uint8Array(descriptor.buffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
    }

    /**
     * Deserializes a base64 string back into a Float32Array descriptor.
     */
    function descriptorFromBase64(b64) {
        if (!b64) return null;
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Float32Array(bytes.buffer);
    }

    // ── Public interface ───────────────────────────────────────────────────────
    return {
        LIVENESS_STEPS,
        loadModels,
        startLivenessCheck,
        stopLivenessCheck,
        captureDescriptor,
        compareDescriptors,
        descriptorToBase64,
        descriptorFromBase64,
    };

})();

// Attach to window so any page can use it
window.FaceRecognitionService = FaceRecognitionService;
