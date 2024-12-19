
let currentRotation = 0;

function rotateLeft() {
const carouselImage = document.getElementById('carouselImage');
currentRotation += 47;
carouselImage.style.transform = `rotate(${currentRotation}deg)`;
}

function rotateRight() {
const carouselImage = document.getElementById('carouselImage');
currentRotation -= 47;
carouselImage.style.transform = `rotate(${currentRotation}deg)`;
}
