// Variables
let stream = null;
const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');

// 1. ID Upload Logic
const idUpload = document.getElementById('id-upload');
const previewImg = document.getElementById('preview-img');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const uploadPreview = document.getElementById('upload-preview');

if (idUpload) {
    idUpload.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                if (previewImg) previewImg.src = e.target.result;
                if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
                if (uploadPreview) uploadPreview.classList.remove('hidden');
            }
            reader.readAsDataURL(file);
        }
    });
}

// 2. Webcam Logic
async function startWebcam() {
    try {
        if (!webcamElement) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamElement.srcObject = stream;
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Could not access camera. Please allow camera permissions to verify identity.");
    }
}

function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// 3. Capture & Finish
function captureFace() {
    if (!captureBtn) return;

    // Visual Feedback
    captureBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    captureBtn.disabled = true;

    // Small delay so the user sees the spinner, then submit
    // NOTE: We do NOT stop the webcam here — the stream must stay alive
    // so captureWebcamBlob() can draw the current frame onto the canvas.
    // The webcam will be stopped inside submitRegistration() after the
    // frame has been captured.
    setTimeout(() => {
        if (typeof window.submitRegistration === 'function') {
            window.submitRegistration();
        } else {
            alert("Error: Logic file not connected.");
        }
    }, 500);
}