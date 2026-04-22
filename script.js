import GameEngine from './GameEngine.js';

window.addEventListener('load', () => {
    const canvas          = document.getElementById('gameCanvas');
    const startScreen     = document.getElementById('start-screen');
    const gameOverScreen  = document.getElementById('game-over-screen');
    const hud             = document.getElementById('hud');
    const startButton     = document.getElementById('start-button');
    const restartButton   = document.getElementById('restart-button');
    const finalScore      = document.getElementById('final-score-value');
    const finalLevel      = document.getElementById('final-level-value');

    const game = new GameEngine(canvas);

    function startGame() {
        game.sound.resume();
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        hud.classList.remove('hidden');
        game.start();
    }

    startButton.addEventListener('click',   startGame);
    restartButton.addEventListener('click', startGame);

    window.addEventListener('gameover', (e) => {
        gameOverScreen.classList.remove('hidden');
        finalScore.textContent = e.detail.score.toString().padStart(6, '0');
        finalLevel.textContent = game.level;
    });
});
