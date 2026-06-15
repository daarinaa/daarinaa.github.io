const ticket1 = document.querySelector('.ticket1');
const ticket2 = document.querySelector('#ticket2');

function addAnimation() {
    ticket2.style.transform = 'rotate(-20deg) translateX(100px) translateY(-20px)';
}

function removeAnimation() {
    ticket2.style.transform = 'rotate(0deg) translateX(0) translateY(0)';
}

ticket1.addEventListener('mouseenter', addAnimation);
ticket1.addEventListener('mouseleave', removeAnimation);