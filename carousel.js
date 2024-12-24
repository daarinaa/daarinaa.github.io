let currentRotation = 0;
let currentIndex = 0;

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

function moveLeft() {
    const track = document.querySelector('.carousel-track');
    const items = document.querySelectorAll('.work-item');
    currentIndex = (currentIndex === 0) ? items.length - 1 : currentIndex - 1;
    updateCarousel(track, currentIndex);
}

function moveRight() {
    const track = document.querySelector('.carousel-track');
    const items = document.querySelectorAll('.work-item');
    currentIndex = (currentIndex === items.length - 1) ? 0 : currentIndex + 1;
    updateCarousel(track, currentIndex);
}

function updateCarousel(track, index) {
    const width = track.clientWidth;
    track.style.transform = `translateX(${-width * index}px)`;
}
