import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';

var label = document.getElementById("label")

var container = document.getElementById("container");
const fov = 75;
const aspect = container.clientWidth / container.clientHeight;
const near = 0.1;
const far = 1000;

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x253238 );
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far); 

const renderer = new THREE.WebGLRenderer();
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

var wordList = []
var wordidx = 0;
var frameidx=0;

var textForm = document.getElementById("inputForm");
textForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var message = document.getElementById("message").value;
    wordList = message.split(" ");
    frameidx = 0;
    wordidx = 0;
    console.log(wordList);
});

fetch('static/json/reference.json') //fetches json data (very slow)
    .then(response => response.json())
    .then(data => { 
        function drawPoint(x, y, z){
            const pointRadius = 0.25;
            const geometry = new THREE.SphereGeometry( pointRadius, 32, 16 );
            const material = new THREE.MeshBasicMaterial( { color: 0xD0F0C0 } );
            const sphere = new THREE.Mesh( geometry, material ); scene.add(sphere);
            sphere.position.x = x;
            sphere.position.y = y;
            sphere.position.z = z;
        }

        function drawLine(x1, y1, z1, x2, y2, z2){
            const points = [];
            points.push (new THREE.Vector3(x1, y1, z1));
            points.push (new THREE.Vector3(x2, y2, z2));
            const geometry = new THREE.BufferGeometry().setFromPoints( points );
            const material = new THREE.LineBasicMaterial( { color: 0xFFFFFF } );
            const line = new THREE.Line( geometry, material );
            scene.add(line);
        }

        function redistributeElements(left, right) { //fixes the problem where more than 21 nodes are identified as left and lets the lines be drawn properly 
            if (left.length > 21) {
                const redistributedElements = left.splice(21);
                right.push(...redistributedElements);
            } else if (right.length > 21) {
                const redistributedElements = right.splice(21);
                left.push(...redistributedElements);
            }
        }

        function connectLines(frameidx){
            const edgeList = [[0,1],[1,2], [2,3], [3,4], [0,5], [5,6], [6,7], [7,8], [5,9], [9,10], [10,11], [11,12], [9,13], [13,14], [14,15], [15,16], [13,17], [17,18], [18,19], [19,20], [0,17]];
            var left = data[wordList[wordidx]][frameidx]['Left Hand Coordinates'];
            var right = data[wordList[wordidx]][frameidx]['Right Hand Coordinates'];

            redistributeElements(left, right);
            
            edgeList.forEach(function(edge){
                const u = edge[0];
                const v = edge[1];
                if (left[u] && left[v]){
                    const l1 = left[u]['Coordinates'];
                    const l2 = left[v]['Coordinates'];
                    drawLine(l1[0]*50, l1[1]*-50, l1[2]*50, l2[0]*50, l2[1]*-50, l2[2]*50);
                }
                if (right[u] && right[v]){
                    const r1 = right[u]['Coordinates'];
                    const r2 = right[v]['Coordinates'];
                    drawLine(r1[0]*50, r1[1]*-50, r1[2]*50, r2[0]*50, r2[1]*-50, r2[2]*50);
                }
            })
        } 

        let clock = new THREE.Clock();
        let delta = 0;
        let interval = 1 / 45;

        function render() {
            requestAnimationFrame(render);
            delta += clock.getDelta();
            
            if (delta > interval){
                delta = delta % interval;

                if(wordList.length > 0 && wordidx < wordList.length){

                label.innerHTML = wordList[wordidx].toUpperCase();

                var left = data[wordList[wordidx]][frameidx]['Left Hand Coordinates'];
                var right = data[wordList[wordidx]][frameidx]['Right Hand Coordinates'];

                left.forEach(function(joint) { 
                    drawPoint(joint['Coordinates'][0]*50, joint['Coordinates'][1]*-50, joint['Coordinates'][2]*50);
                })
                right.forEach(function(joint) {
                    drawPoint(joint['Coordinates'][0]*50, joint['Coordinates'][1]*-50, joint['Coordinates'][2]*50);
                })
                connectLines(frameidx);

                frameidx++;
                if(frameidx >= data[wordList[wordidx]].length){
                    frameidx = 0;
                    wordidx++;
                    label.innerHTML = wordList[wordidx].toUpperCase();
                }
                }
                else{
                    label.innerHTML = "N/A";
                }
                renderer.render(scene, camera);
                scene.remove.apply(scene, scene.children);
            }
        }   
        
        render();
    })

camera.position.set(27.5, -30, 25);

// Initialize speech recognition
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.interimResults = false;

document.getElementById('startVoiceRecognition').addEventListener('click', function() {
    recognition.start();
});

recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    const spacedTranscript = transcript
        .split(' ')                            // Split into words
        .map(word => word.split('').join(' ')) // Add space between characters in each word
        .join('   ');                          // Add extra spaces between words
    document.getElementById('inputText').value = spacedTranscript;
};

recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
};

// New code for handwriting capture and OCR
let videoStream = null;

async function startWebcam() {
    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.style.display = 'none';
    document.body.appendChild(video);

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = videoStream;
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });
        return video;
    } catch (err) {
        console.error('Error accessing webcam:', err);
        alert('Could not access webcam.');
        return null;
    }
}

async function captureImage(video) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

document.getElementById('startHandwritingCapture').addEventListener('click', async () => {
    const video = await startWebcam();
    if (!video) return;

    alert('Webcam started. Click OK and then click on the video to capture handwriting.');

    video.style.display = 'block';
    video.style.position = 'fixed';
    video.style.top = '50%';
    video.style.left = '50%';
    video.style.transform = 'translate(-50%, -50%)';
    video.style.zIndex = '1000';
    video.style.border = '2px solid black';
    video.style.cursor = 'pointer';

    video.addEventListener('click', async () => {
        const imageBlob = await captureImage(video);
        videoStream.getTracks().forEach(track => track.stop());
        video.remove();

        const formData = new FormData();
        formData.append('image', imageBlob, 'handwriting.png');

        fetch('/handwriting-ocr', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.recognized_text) {
                document.getElementById('handwritingText').value = data.recognized_text;
            } else if (data.error) {
                alert('Error: ' + data.error);
            }
        })
        .catch(err => {
            console.error('Error sending image:', err);
            alert('Error sending image for OCR.');
        });
    }, { once: true });
});
