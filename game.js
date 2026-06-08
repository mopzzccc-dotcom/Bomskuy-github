const MAP_WIDTH = 15;
const MAP_HEIGHT = 9;
const TILE_SIZE = 100 / MAP_WIDTH; // percentage based

// Game State
let playerName = "";
let subject = "";
let currentLevel = 1;
let unlockedLevel = 1; // Handled per-subject
let lives = 3;
let score = 0;

let map = []; // 0=empty, 1=wall, 2=brick
let player = {x: 0, y: 0};
let enemies = [];
let bombs = [];
let explosions = [];

let gameInterval = null;
let isPlaying = false;
let quizUsed = false;
let lastMoveTime = 0;

// Direction class for animation
let currentPlayerClass = 'player-idle';
let playerIdleTimeout = null;

// Match Timer
let matchDurationSeconds = 0;
let matchTimerInterval = null;

const SUBJECT_NAMES = {
    pai: "Pendidikan Agama Islam",
    sejarah: "Sejarah",
    pkn: "Pendidikan Kewarganegaraan"
};

// Elements
const elApp = document.getElementById('app');
const elBoard = document.getElementById('game-board');

// Quiz Data
const QUIZ_DATA = {
    pai: [
        { q: "Apa nama malaikat yang bertugas menyampaikan wahyu?", options: ["Jibril", "Mikail", "Israfil", "Izrail"], a: 0 },
        { q: "Kitab suci yang diturunkan kepada Nabi Daud AS adalah?", options: ["Taurat", "Zabur", "Injil", "Al-Quran"], a: 1 },
        { q: "Puasa wajib dilakukan pada bulan?", options: ["Rajab", "Syaban", "Ramadhan", "Syawal"], a: 2 },
        { q: "Nabi yang memiliki mukjizat bisa membelah lautan Merah adalah?", options: ["Nabi Ibrahim AS", "Nabi Musa AS", "Nabi Isa AS", "Nabi Nuh AS"], a: 1 },
        { q: "Shalat fardhu yang dikerjakan pada saat terbit fajar adalah?", options: ["Dzuhur", "Ashar", "Maghrib", "Subuh"], a: 3 }
    ],
    sejarah: [
        { q: "Siapakah proklamator kemerdekaan Indonesia?", options: ["Soekarno-Hatta", "Soeharto", "BJ Habibie", "Gus Dur"], a: 0 },
        { q: "Kerajaan Islam pertama di Indonesia adalah?", options: ["Demak", "Samudera Pasai", "Mataram", "Banten"], a: 1 },
        { q: "Kapan Indonesia merdeka?", options: ["17 Agustus 1945", "1 Juni 1945", "20 Mei 1908", "28 Oktober 1928"], a: 0 },
        { q: "Candi Borobudur dibangun pada masa dinasti?", options: ["Sanjaya", "Syailendra", "Majapahit", "Kediri"], a: 1 },
        { q: "Patih terkenal dari Kerajaan Majapahit yang bersumpah Palapa adalah?", options: ["Hayam Wuruk", "Gajah Mada", "Raden Wijaya", "Ken Arok"], a: 1 }
    ],
    pkn: [
        { q: "Dasar negara Indonesia adalah?", options: ["UUD 1945", "Pancasila", "Bhinneka Tunggal Ika", "Tap MPR"], a: 1 },
        { q: "Sila pertama Pancasila dilambangkan dengan?", options: ["Padi dan Kapas", "Rantai", "Beringin", "Bintang"], a: 3 },
        { q: "Lembaga negara yang bertugas membuat undang-undang adalah?", options: ["Presiden", "DPR", "MA", "MK"], a: 1 },
        { q: "Bhinneka Tunggal Ika artinya?", options: ["Bersatu kita teguh", "Berbeda-beda tetapi tetap satu jua", "Keadilan sosial bagi seluruh rakyat", "Kemanusiaan yang adil dan beradab"], a: 1 },
        { q: "UUD 1945 disahkan pada tanggal?", options: ["17 Agustus 1945", "18 Agustus 1945", "1 Juni 1945", "27 Desember 1949"], a: 1 }
    ]
};

// UI Functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    // Manage mobile controls visibility logic
    const mobCtrl = document.getElementById('mobile-controls');
    if (screenId === 'game-screen') {
        mobCtrl.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    } else {
        mobCtrl.style.display = 'none';
    }
}

// Ensure resize updates mobile control correctly if in game screen
window.addEventListener('resize', () => {
    const mobCtrl = document.getElementById('mobile-controls');
    if (document.getElementById('game-screen').classList.contains('active')) {
        mobCtrl.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    }
});

function selectSubject(sub) {
    const nameInput = document.getElementById('player-name').value.trim();
    if (!nameInput) {
        alert("Please enter your name!");
        return;
    }
    playerName = nameInput;
    subject = sub;
    
    // Fetch subject specific progress
    const storageKey = 'bomskuy_level_' + sub.toLowerCase();
    unlockedLevel = localStorage.getItem(storageKey) ? parseInt(localStorage.getItem(storageKey)) : 1;
    
    // Update theme
    elApp.className = 'theme-' + sub;
    document.getElementById('display-subject').innerText = SUBJECT_NAMES[sub].toUpperCase();
    
    updateLevelButtons();
    showScreen('level-screen');
}

function updateLevelButtons() {
    for (let i = 1; i <= 5; i++) {
        let btn = document.getElementById('btn-lv-' + i);
        if (i <= unlockedLevel) {
            btn.classList.remove('locked');
        } else {
            btn.classList.add('locked');
        }
    }
}

function startLevel(lvl) {
    if (lvl > unlockedLevel) return;
    currentLevel = lvl;
    lives = 3;
    score = 0;
    quizUsed = false;
    currentPlayerClass = 'player-idle';
    
    initGame();
    showScreen('game-screen');
}

function nextLevel() {
    if (currentLevel < 5) {
        currentLevel++;
        initGame();
        showScreen('game-screen');
    } else {
        returnToLobby();
    }
}

function returnToLobby() {
    isPlaying = false;
    stopGameLoop();
    stopMatchTimer();
    showScreen('lobby-screen');
}

function updateHUD() {
    document.getElementById('hud-name').innerText = playerName.toUpperCase().substring(0,10);
    document.getElementById('hud-subject').innerText = subject.toUpperCase().substring(0,3);
    document.getElementById('hud-level').innerText = currentLevel;
    document.getElementById('hud-lives').innerText = lives;
    document.getElementById('hud-score').innerText = score;
    document.getElementById('hud-timer').innerText = formatDuration(matchDurationSeconds);
}

// Timer helpers
function startMatchTimer() {
    stopMatchTimer();
    matchDurationSeconds = 0;
    matchTimerInterval = setInterval(() => {
        if (isPlaying) {
            matchDurationSeconds++;
            updateHUD();
        }
    }, 1000);
}

function stopMatchTimer() {
    if (matchTimerInterval) {
        clearInterval(matchTimerInterval);
        matchTimerInterval = null;
    }
}

function formatDuration(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Match History Functionality
function showMatchHistory() {
    const modal = document.getElementById('history-modal');
    const rowsContainer = document.getElementById('history-rows');
    rowsContainer.innerHTML = '';
    
    let history = [];
    try {
        const stored = localStorage.getItem('bomskuy_history');
        if (stored) {
            history = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load history", e);
    }
    
    if (history.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align: center; color: #888; padding: 20px 0;">NO MATCH HISTORY YET</td>`;
        rowsContainer.appendChild(tr);
    } else {
        // Show newest matches first
        history.reverse().forEach(match => {
            const tr = document.createElement('tr');
            const statusClass = match.status === 'Win' ? 'history-status-win' : 'history-status-loss';
            const statusText = match.status === 'Win' ? 'WIN' : 'LOSS';
            
            tr.innerHTML = `
                <td>${match.date}</td>
                <td>${match.time}</td>
                <td>${match.subject}</td>
                <td>${match.level}</td>
                <td class="${statusClass}">${statusText}</td>
                <td>${match.duration}</td>
            `;
            rowsContainer.appendChild(tr);
        });
    }
    modal.classList.add('active');
}

function closeMatchHistory() {
    const modal = document.getElementById('history-modal');
    modal.classList.remove('active');
}

function saveMatchToHistory(status) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const dateStr = `${day}/${month}/${year}`;
    const timeStr = `${hours}:${minutes}`;
    
    const subjectName = SUBJECT_NAMES[subject] || subject.toUpperCase();
    const durationStr = formatDuration(matchDurationSeconds);
    
    const matchData = {
        date: dateStr,
        time: timeStr,
        subject: subjectName,
        level: currentLevel,
        status: status,
        duration: durationStr
    };
    
    let history = [];
    try {
        const stored = localStorage.getItem('bomskuy_history');
        if (stored) {
            history = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load history", e);
    }
    
    history.push(matchData);
    localStorage.setItem('bomskuy_history', JSON.stringify(history));
}

// Game Core
function initGame() {
    stopGameLoop();
    stopMatchTimer();
    bombs = [];
    explosions = [];
    
    generateMap();
    player = {x: 0, y: 0}; // Top-left corner
    spawnEnemies();
    
    updateHUD();
    renderBoard();
    
    isPlaying = true;
    startMatchTimer();
    startGameLoop();
}

// Generate map: walls on odd coords, bricks randomly
function generateMap() {
    map = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill(0));
    
    for (let y = 1; y < MAP_HEIGHT; y += 2) {
        for (let x = 1; x < MAP_WIDTH; x += 2) {
            map[y][x] = 1; // Unbreakable wall
        }
    }
    
    // Level scaling: 30% to 70% brick chance
    let brickChance = 0.2 + (currentLevel * 0.1); 
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (map[y][x] === 0) {
                // Keep spawn clear (0,0), (1,0), (0,1)
                if ((x < 2 && y === 0) || (x === 0 && y < 2)) continue;
                if (Math.random() < brickChance) {
                    map[y][x] = 2; // Destructible brick
                }
            }
        }
    }
}

// Pathfinder BFS that clears bricks to ensure player can reach the enemy (Anti-trapping)
function carvePath(startX, startY, targetX, targetY) {
    let queue = [[{x: startX, y: startY}]];
    let visited = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill(false));
    visited[startY][startX] = true;
    
    let path = null;
    while (queue.length > 0) {
        let currPath = queue.shift();
        let curr = currPath[currPath.length - 1];
        if (curr.x === targetX && curr.y === targetY) {
            path = currPath;
            break;
        }
        
        const dirs = [
            {x: 1, y: 0},
            {x: -1, y: 0},
            {x: 0, y: 1},
            {x: 0, y: -1}
        ];
        for (let d of dirs) {
            let nx = curr.x + d.x;
            let ny = curr.y + d.y;
            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
                // Ignore bricks, but respect indestructible walls (1)
                if (map[ny][nx] !== 1 && !visited[ny][nx]) {
                    visited[ny][nx] = true;
                    queue.push([...currPath, {x: nx, y: ny}]);
                }
            }
        }
    }
    
    // Clear bricks along path to ensure reachability
    if (path) {
        path.forEach(cell => {
            if (map[cell.y][cell.x] === 2) {
                map[cell.y][cell.x] = 0;
            }
        });
    }
}

function spawnEnemies() {
    enemies = [];
    // Level scaling: 1 + currentLevel enemies (Level 1: 2, Level 5: 6)
    let count = 1 + currentLevel;
    for (let i = 0; i < count; i++) {
        let ex, ey;
        let attempts = 0;
        do {
            ex = Math.floor(Math.random() * MAP_WIDTH);
            ey = Math.floor(Math.random() * MAP_HEIGHT);
            attempts++;
        } while (
            (map[ey][ex] !== 0 || (ex < 4 && ey < 4)) && 
            attempts < 200
        );
        
        // Fallback search if attempts fail
        if (map[ey][ex] !== 0 || (ex < 4 && ey < 4)) {
            let found = false;
            for (let y = 0; y < MAP_HEIGHT; y++) {
                for (let x = 0; x < MAP_WIDTH; x++) {
                    if (map[y][x] !== 1 && (x >= 4 || y >= 4)) {
                        ex = x;
                        ey = y;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }
        
        map[ey][ex] = 0; // Clear spot
        enemies.push({ x: ex, y: ey, id: Math.random(), dirClass: 'enemy-idle' });
        
        // Guarantee player at (0,0) can reach this enemy
        carvePath(0, 0, ex, ey);
    }
}

// Rendering
function renderBoard() {
    elBoard.innerHTML = '';
    
    // Draw map
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (map[y][x] !== 0) {
                let div = document.createElement('div');
                div.className = 'cell ' + (map[y][x] === 1 ? 'wall' : 'brick');
                div.style.left = (x * TILE_SIZE) + '%';
                div.style.top = (y * (100/MAP_HEIGHT)) + '%';
                div.style.width = TILE_SIZE + '%';
                div.style.height = (100/MAP_HEIGHT) + '%';
                elBoard.appendChild(div);
            }
        }
    }
    
    // Draw Bombs
    bombs.forEach(b => {
        let div = document.createElement('div');
        div.className = 'cell bomb';
        div.style.left = (b.x * TILE_SIZE) + '%';
        div.style.top = (b.y * (100/MAP_HEIGHT)) + '%';
        div.style.width = TILE_SIZE + '%';
        div.style.height = (100/MAP_HEIGHT) + '%';
        elBoard.appendChild(div);
    });
    
    // Draw Explosions
    explosions.forEach(exp => {
        exp.cells.forEach(c => {
            let div = document.createElement('div');
            div.className = 'cell explosion';
            div.style.left = (c.x * TILE_SIZE) + '%';
            div.style.top = (c.y * (100/MAP_HEIGHT)) + '%';
            div.style.width = TILE_SIZE + '%';
            div.style.height = (100/MAP_HEIGHT) + '%';
            elBoard.appendChild(div);
        });
    });

    // Draw Player
    let pDiv = document.createElement('div');
    pDiv.className = 'cell player ' + currentPlayerClass;
    pDiv.style.left = (player.x * TILE_SIZE) + '%';
    pDiv.style.top = (player.y * (100/MAP_HEIGHT)) + '%';
    pDiv.style.width = TILE_SIZE + '%';
    pDiv.style.height = (100/MAP_HEIGHT) + '%';
    elBoard.appendChild(pDiv);

    // Draw Enemies
    enemies.forEach(e => {
        let eDiv = document.createElement('div');
        eDiv.className = 'cell enemy ' + (e.dirClass || 'enemy-idle');
        eDiv.style.left = (e.x * TILE_SIZE) + '%';
        eDiv.style.top = (e.y * (100/MAP_HEIGHT)) + '%';
        eDiv.style.width = TILE_SIZE + '%';
        eDiv.style.height = (100/MAP_HEIGHT) + '%';
        elBoard.appendChild(eDiv);
    });
}

// Input Handling
window.addEventListener('keydown', (e) => {
    // CRITICAL: Prevent scrolling
    if(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
    }
    
    if (!isPlaying) return;
    
    let now = Date.now();
    if (now - lastMoveTime < 150) return; // Cooldown throttle
    
    let moved = false;
    if (e.code === 'ArrowUp') moved = attemptMove(0, -1);
    if (e.code === 'ArrowDown') moved = attemptMove(0, 1);
    if (e.code === 'ArrowLeft') moved = attemptMove(-1, 0);
    if (e.code === 'ArrowRight') moved = attemptMove(1, 0);
    
    if (moved) {
        lastMoveTime = now;
        checkCollisions();
        renderBoard();
    }
    
    if (e.code === 'Space') {
        placeBomb();
    }
}, { passive: false });

// Mobile controls binding
document.getElementById('btn-up').addEventListener('pointerdown', (e) => { 
    e.preventDefault(); 
    if(!isPlaying) return;
    let now = Date.now();
    if (now - lastMoveTime < 150) return;
    if(attemptMove(0,-1)){ lastMoveTime = now; renderBoard(); checkCollisions(); } 
});
document.getElementById('btn-down').addEventListener('pointerdown', (e) => { 
    e.preventDefault(); 
    if(!isPlaying) return;
    let now = Date.now();
    if (now - lastMoveTime < 150) return;
    if(attemptMove(0,1)){ lastMoveTime = now; renderBoard(); checkCollisions(); } 
});
document.getElementById('btn-left').addEventListener('pointerdown', (e) => { 
    e.preventDefault(); 
    if(!isPlaying) return;
    let now = Date.now();
    if (now - lastMoveTime < 150) return;
    if(attemptMove(-1,0)){ lastMoveTime = now; renderBoard(); checkCollisions(); } 
});
document.getElementById('btn-right').addEventListener('pointerdown', (e) => { 
    e.preventDefault(); 
    if(!isPlaying) return;
    let now = Date.now();
    if (now - lastMoveTime < 150) return;
    if(attemptMove(1,0)){ lastMoveTime = now; renderBoard(); checkCollisions(); } 
});
document.getElementById('btn-bomb').addEventListener('pointerdown', (e) => { 
    e.preventDefault(); 
    if(!isPlaying) return;
    placeBomb(); 
});

function attemptMove(dx, dy) {
    let nx = player.x + dx;
    let ny = player.y + dy;
    
    if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
        if (map[ny][nx] === 0) {
            // Can't walk ONTO a bomb (but can walk off)
            if (!bombs.some(b => b.x === nx && b.y === ny)) {
                player.x = nx;
                player.y = ny;
                
                // Swap direction classes for animation
                if (dx === 0 && dy === -1) currentPlayerClass = 'player-up';
                else if (dx === 0 && dy === 1) currentPlayerClass = 'player-down';
                else if (dx === -1 && dy === 0) currentPlayerClass = 'player-left';
                else if (dx === 1 && dy === 0) currentPlayerClass = 'player-right';
                
                // Set stationary/idle timer
                clearTimeout(playerIdleTimeout);
                playerIdleTimeout = setTimeout(() => {
                    currentPlayerClass = 'player-idle';
                    if (isPlaying) renderBoard();
                }, 200);
                
                return true;
            }
        }
    }
    return false;
}

function placeBomb() {
    if (bombs.length >= 2) return;
    if (bombs.some(b => b.x === player.x && b.y === player.y)) return;
    
    let bomb = {x: player.x, y: player.y};
    bombs.push(bomb);
    renderBoard();
    
    setTimeout(() => {
        explodeBomb(bomb);
    }, 2500);
}

function explodeBomb(bomb) {
    if(!isPlaying) return;
    bombs = bombs.filter(b => b !== bomb);
    
    let explodeCells = [{x: bomb.x, y: bomb.y}];
    const dirs = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
    const strength = 2; // Flame length
    
    for (let d of dirs) {
        for (let i = 1; i <= strength; i++) {
            let nx = bomb.x + d.x * i;
            let ny = bomb.y + d.y * i;
            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
                if (map[ny][nx] === 1) break; // Wall stops explosion
                
                explodeCells.push({x: nx, y: ny});
                
                if (map[ny][nx] === 2) {
                    map[ny][nx] = 0; // Destroy brick
                    score += 10;
                    break;
                }
            } else {
                break;
            }
        }
    }
    
    explosions.push({cells: explodeCells, time: Date.now()});
    renderBoard();
    
    setTimeout(() => {
        explosions.shift();
        if(isPlaying) renderBoard();
    }, 500);
    
    // Check hits
    let playerHit = false;
    let enemyHitCount = 0;
    
    explodeCells.forEach(c => {
        if (player.x === c.x && player.y === c.y) playerHit = true;
        
        let initialLen = enemies.length;
        enemies = enemies.filter(e => e.x !== c.x || e.y !== c.y);
        enemyHitCount += (initialLen - enemies.length);
    });
    
    score += enemyHitCount * 50;
    updateHUD();
    
    if (playerHit) {
        handleDeath();
    } else {
        checkWinCondition();
    }
}

// AI and Loop
function startGameLoop() {
    // AI speed scaling: Level 1: 700ms, Level 5: 300ms
    let tickRate = Math.max(300, 800 - (currentLevel * 100)); 
    gameInterval = setInterval(() => {
        if (!isPlaying) return;
        moveEnemies();
    }, tickRate);
}

function stopGameLoop() {
    if (gameInterval) clearInterval(gameInterval);
}

function moveEnemies() {
    enemies.forEach(enemy => {
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        
        // Preferred moves in order
        let preferredMoves = [];
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx !== 0) preferredMoves.push({x: Math.sign(dx), y: 0});
            if (dy !== 0) preferredMoves.push({x: 0, y: Math.sign(dy)});
        } else {
            if (dy !== 0) preferredMoves.push({x: 0, y: Math.sign(dy)});
            if (dx !== 0) preferredMoves.push({x: Math.sign(dx), y: 0});
        }
        
        let moved = false;
        let moveX = 0;
        let moveY = 0;
        
        // Try direct chase
        for (let m of preferredMoves) {
            let nx = enemy.x + m.x;
            let ny = enemy.y + m.y;
            if (isValidEnemyMove(nx, ny)) {
                enemy.x = nx;
                enemy.y = ny;
                moved = true;
                moveX = m.x;
                moveY = m.y;
                break;
            }
        }
        
        // Bypass if blocked (obstacle avoidance)
        if (!moved) {
            let altMoves = [
                {x: 1, y: 0},
                {x: -1, y: 0},
                {x: 0, y: 1},
                {x: 0, y: -1}
            ].sort(() => Math.random() - 0.5);
            
            for (let m of altMoves) {
                let nx = enemy.x + m.x;
                let ny = enemy.y + m.y;
                if (isValidEnemyMove(nx, ny)) {
                    enemy.x = nx;
                    enemy.y = ny;
                    moved = true;
                    moveX = m.x;
                    moveY = m.y;
                    break;
                }
            }
        }

        // Set direction class based on movement
        if (moved) {
            if (moveX === 0 && moveY === -1) enemy.dirClass = 'enemy-up';
            else if (moveX === 0 && moveY === 1) enemy.dirClass = 'enemy-down';
            else if (moveX === -1 && moveY === 0) enemy.dirClass = 'enemy-left';
            else if (moveX === 1 && moveY === 0) enemy.dirClass = 'enemy-right';
        } else {
            enemy.dirClass = 'enemy-idle';
        }
    });
    
    checkCollisions();
    renderBoard();
}

function isValidEnemyMove(nx, ny) {
    return (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && 
            map[ny][nx] === 0 && !bombs.some(b => b.x === nx && b.y === ny));
}

function checkCollisions() {
    let hit = enemies.some(e => e.x === player.x && e.y === player.y);
    if (hit) handleDeath();
}

function checkWinCondition() {
    if (enemies.length === 0) {
        isPlaying = false;
        stopGameLoop();
        stopMatchTimer();
        
        // Save match history
        saveMatchToHistory("Win");
        
        // Unlock next level for specific subject
        if (currentLevel === unlockedLevel && unlockedLevel < 5) {
            unlockedLevel++;
            const storageKey = 'bomskuy_level_' + subject.toLowerCase();
            localStorage.setItem(storageKey, unlockedLevel);
        }
        
        document.getElementById('result-title').innerText = "LEVEL CLEARED!";
        document.getElementById('result-title').style.color = "#4ade80";
        document.getElementById('result-score').innerText = score;
        
        let nextBtn = document.getElementById('btn-next-level');
        if (currentLevel < 5) {
            nextBtn.style.display = 'block';
        } else {
            nextBtn.style.display = 'none'; // Game Finished
            document.getElementById('result-title').innerText = "YOU BEAT THE GAME!";
        }
        
        setTimeout(() => showScreen('result-screen'), 500);
    }
}

function handleDeath() {
    isPlaying = false;
    lives--;
    updateHUD();
    renderBoard(); // Show collision state
    
    if (lives <= 0) {
        stopGameLoop();
        stopMatchTimer();
    }
    
    setTimeout(() => {
        if (lives > 0) {
            // Respawn
            player.x = 0; player.y = 0;
            isPlaying = true;
            renderBoard();
        } else if (!quizUsed) {
            triggerQuiz();
        } else {
            showGameOver();
        }
    }, 1000);
}

// Second Chance Quiz
function triggerQuiz() {
    quizUsed = true;
    let questions = QUIZ_DATA[subject];
    let q = questions[Math.floor(Math.random() * questions.length)];
    
    document.getElementById('quiz-question').innerText = q.q;
    let optsDiv = document.getElementById('quiz-options');
    optsDiv.innerHTML = '';
    
    q.options.forEach((opt, idx) => {
        let btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerText = opt;
        btn.onclick = () => {
            document.getElementById('quiz-modal').classList.remove('active');
            if (idx === q.a) {
                // Correct: regain 1 life and respawn safely
                lives = 1;
                updateHUD();
                
                player.x = 0;
                player.y = 0;
                // Clear any hazards at spawn
                map[0][0] = 0;
                map[0][1] = 0;
                map[1][0] = 0;
                
                // Reposition any enemies near spawn
                enemies.forEach(enemy => {
                    if (enemy.x < 3 && enemy.y < 3) {
                        enemy.x = MAP_WIDTH - 2;
                        enemy.y = MAP_HEIGHT - 2;
                    }
                });
                
                isPlaying = true;
                startMatchTimer();
                startGameLoop();
                renderBoard();
            } else {
                // Incorrect
                showGameOver();
            }
        };
        optsDiv.appendChild(btn);
    });
    
    document.getElementById('quiz-modal').classList.add('active');
}

function showGameOver() {
    isPlaying = false;
    stopGameLoop();
    stopMatchTimer();
    
    saveMatchToHistory("Loss");
    
    document.getElementById('result-title').innerText = "GAME OVER";
    document.getElementById('result-title').style.color = "#ef4444";
    document.getElementById('result-score').innerText = score;
    document.getElementById('btn-next-level').style.display = 'none';
    showScreen('result-screen');
}
