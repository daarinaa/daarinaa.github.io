var button = document.getElementById('myButton');
var close = document.getElementById('myClose');
var modal = document.getElementById('myModal'); // ID модального окна

button.onclick = function() {
    modal.style.display = "block"; // Показываем модальное окно
};

close.onclick = function() {
    modal.style.display = "none"; // Закрываем модальное окно
};

var ticket = document.getElementById('myTicket');

ticket.addEventListener('mouseover', function() {
    ticket.style.backgroundColor = "yellow"; // Пример действия
});

const track = document.querySelector('.carousel-track');
const prevBtn = document.querySelector('.prev');
const nextBtn = document.querySelector('.next');

let position = 0;

prevBtn.addEventListener('click', () => {
    position += 320; // Двигаемся назад
    track.style.transform = `translateX(${position}px)`;
});

nextBtn.addEventListener('click', () => {
    position -= 320; // Двигаемся вперед
    track.style.transform = `translateX(${position}px)`;
});
