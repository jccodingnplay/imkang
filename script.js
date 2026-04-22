import GameEngine from './GameEngine.js';

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const hud = document.getElementById('hud');

    // Initialize the Game Engine
    const game = new GameEngine(canvas);

    startButton.addEventListener('click', () => {
        startScreen.classList.add('hidden');
        hud.classList.remove('hidden');
        game.start();
    });

    restartButton.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        game.start();
    });

    // Handle game over signal from engine
    window.addEventListener('gameover', (e) => {
        gameOverScreen.classList.remove('hidden');
        document.getElementById('final-score-value').textContent = e.detail.score;
    });
});
