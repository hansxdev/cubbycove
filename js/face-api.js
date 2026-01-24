// Variables
let currentStep = 1;
const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
let stream = null;

// 1. Navigation Logic
function nextStep(step) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    
    // Show requested step
    document.getElementById(`step-${step}`).classList.remove('hidden');
    currentStep = step;

    // Update Progress Sidebar (Visuals)
    updateProgressUI(step);

    // If Step 3 (Face ID), start camera
    if (step === 3) {
        startWebcam();
    } else {
        stopWebcam();
    }
}

function updateProgressUI(step) {
    const steps = document.querySelectorAll('.step-item');
    steps.forEach((el, index) => {
        const stepNum = index + 1;
        const circle = el.querySelector('div');
        
        if (stepNum === step) {
            // Active
            el.classList.add('text-cubby-blue', 'font-bold');
            el.classList.remove('text-gray-400');
            circle.classList.add('bg-cubby-blue', 'text-white');
            circle.classList.remove('bg-gray-200');
        } else if (stepNum < step) {
            // Completed
            el.classList.add('text-green-500', 'font-bold');
            el.classList.remove('text-gray-400');
            circle.classList.add('bg-green-500', 'text-white');
            circle.classList.remove('bg-gray-200', 'bg-cubby-blue');
            circle.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else {
            // Pending
            el.classList.remove('text-cubby-blue', 'font-bold', 'text-green-500');
            el.classList.add('text-gray-400');
            circle.classList.remove('bg-cubby-blue', 'text-white', 'bg-green-500');
            circle.classList.add('bg-gray-200');
            circle.innerHTML = stepNum;
        }
    });
}

// 2. ID Upload Preview
const idUpload = document.getElementById('id-upload');
const previewImg = document.getElementById('preview-img');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const uploadPreview = document.getElementById('upload-preview');

if (idUpload) {
    idUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImg.src = e.target.result;
                uploadPlaceholder.classList.add('hidden');
                uploadPreview.classList.remove('hidden');
            }
            reader.readAsDataURL(file);
        }
    });
}

// 3. Webcam Logic (Face ID)
async function startWebcam() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamElement.srcObject = stream;
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Could not access camera. Please allow camera permissions.");
    }
}

function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// 4. Capture & Submit
function captureFace() {
    // Draw video frame to canvas
    canvasElement.width = webcamElement.videoWidth;
    canvasElement.height = webcamElement.videoHeight;
    const ctx = canvasElement.getContext('2d');
    ctx.drawImage(webcamElement, 0, 0);

    // Convert to image (base64) - In a real app, send this to Luxand API
    const imageDataUrl = canvasElement.toDataURL('image/png');
    
    // Simulate Loading/Processing
    captureBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    captureBtn.disabled = true;

    setTimeout(() => {
        stopWebcam();
        document.getElementById('step-3').classList.add('hidden');
        document.getElementById('success-state').classList.remove('hidden');
        document.getElementById('success-state').classList.add('flex');
    }, 1500); // Fake 1.5s delay for "AI processing"
}