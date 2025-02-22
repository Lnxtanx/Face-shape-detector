// Load face-api.js models
async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
}
loadModels();

// Handle image upload
const input = document.getElementById('imageUpload');
const uploadedImage = document.getElementById('uploadedImage');
const checkButton = document.getElementById('checkButton');
const canvas = document.getElementById('canvas');
const result = document.getElementById('result');

input.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Display the uploaded image
  uploadedImage.src = URL.createObjectURL(file);
  uploadedImage.style.display = 'block';
  checkButton.style.display = 'block';
  canvas.style.display = 'none'; // Hide canvas until check
  result.innerHTML = ''; // Clear previous result
});

// Handle check button click
checkButton.addEventListener('click', async () => {
  const img = uploadedImage;

  // Resize image if too large for better performance
  let resizedImg = img;
  if (img.width > 800 || img.height > 800) {
    const maxSize = 800;
    const aspectRatio = img.width / img.height;
    if (img.width > img.height) {
      resizedImg.width = maxSize;
      resizedImg.height = maxSize / aspectRatio;
    } else {
      resizedImg.height = maxSize;
      resizedImg.width = maxSize * aspectRatio;
    }
    // Update the displayed image size
    uploadedImage.style.width = `${resizedImg.width}px`;
    uploadedImage.style.height = `${resizedImg.height}px`;
  }

  // Set up canvas over the image
  canvas.width = resizedImg.width;
  canvas.height = resizedImg.height;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  ctx.drawImage(resizedImg, 0, 0);

  // Detect face and landmarks
  console.log('Starting face detection...');
  const detections = await faceapi.detectAllFaces(resizedImg).withFaceLandmarks();
  console.log('Detections:', detections);

  if (detections.length === 0) {
    alert('No face detected. Please upload a clear, frontal photo with good lighting.');
    return;
  }
  if (detections.length > 1) {
    alert('Multiple faces detected. Please upload an image with only one face.');
    return;
  }

  const landmarks = detections[0].landmarks;
  faceapi.draw.drawFaceLandmarks(canvas, detections); // Overlay landmarks

  // Calculate measurements with detailed logging
  const positions = landmarks.positions;
  console.log('Landmark Positions:', positions);

  const yTop = Math.min(...positions.slice(17, 27).map(p => p.y)); // Top from eyebrows
  const yChin = positions[8].y; // Chin point
  const H = yChin - yTop;
  const FW = Math.hypot(positions[17].x - positions[26].x, positions[17].y - positions[26].y); // Forehead width
  const jawPoints = positions.slice(0, 17); // Jawline outline (0-16)
  const CW = Math.max(...jawPoints.map((p, i) => i <= 8 ? positions[16 - i].x - p.x : 0)); // Cheekbone width
  const JW = Math.hypot(positions[4].x - positions[12].x, positions[4].y - positions[12].y); // Jawline width

  console.log('Raw Measurements:', { H, FW, CW, JW });

  // Compute ratios
  const AR = H / CW; // Aspect ratio
  const FWR = FW / CW; // Forehead to cheekbone ratio
  const JWR = JW / CW; // Jawline to cheekbone ratio
  console.log('Ratios:', { AR, FWR, JWR });

  // Classify face shape with adjusted thresholds
  let faceShape = '';
  if (AR > 1.3 && Math.abs(FWR - 1) < 0.2 && Math.abs(JWR - 1) < 0.2) {
    faceShape = 'Oval';
  } else if (AR < 1.1 && FWR > 1.1) {
    faceShape = 'Heart';
  } else if (AR > 1.2 && FWR < 0.9 && JWR < 0.9) {
    faceShape = 'Diamond';
  } else if (AR < 1.2 && Math.abs(FWR - 1) < 0.2 && Math.abs(JWR - 1) < 0.2) {
    faceShape = 'Round or Square';
  } else {
    faceShape = 'Uncertain (try another photo or adjust lighting/angle)';
  }

  // Display result
  result.innerHTML = `Your face shape is likely: <strong>${faceShape}</strong>`;
});