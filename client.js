const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Элементы интерфейса
const mainMenu = document.getElementById('mainMenu');
const gameContainer = document.getElementById('gameContainer');
const nicknameInput = document.getElementById('nicknameInput');
const skinDisplay = document.getElementById('skinDisplay');
const skinLeft = document.getElementById('skinLeft');
const skinRight = document.getElementById('skinRight');
const startBtn = document.getElementById('startBtn');
const deviceBtns = document.querySelectorAll('.device-btn');
const mobileControls = document.getElementById('mobileControls');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const leaderboardList = document.getElementById('leaderboardList');

// Элементы инвентаря
const inventory = document.getElementById('inventory');
const inventoryWood = document.getElementById('inventoryWood');
const inventoryStone = document.getElementById('inventoryStone');
const inventoryFood = document.getElementById('inventoryFood');
const inventoryBlock = document.getElementById('inventoryBlock');
const inventorySword = document.getElementById('inventorySword');
const inventoryBow = document.getElementById('inventoryBow');
const inventoryArrow = document.getElementById('inventoryArrow');
const inventoryBowDurability = document.getElementById('inventoryBowDurability');
const craftRecipesDiv = document.getElementById('craftRecipes');
const craftPrev = document.getElementById('craftPrev');
const craftNext = document.getElementById('craftNext');
const craftPageInfo = document.getElementById('craftPageInfo');
const closeInventory = document.getElementById('closeInventory');

// Доступные скины
const availableSkins = ['😎', '😊', '🐱', '👾', '🤖', '👻', '💀', '❤️', '⭐', '🎮'];
let selectedSkinIndex = 0;
let deviceType = 'desktop';

// WebSocket соединение
let ws = null;
let playerId = null;
let players = new Map();
let world = { trees: [], stones: [], blocks: [] };
let craftRecipes = [];
let leaderboard = [];

// Игрок
const player = {
    x: 0,
    y: 0,
    size: 40,
    speed: 5,
    emoji: '😎',
    nickname: 'Игрок',
    health: 100,
    hunger: 100,
    isAttacking: false,
    attackCooldown: 0,
    attackRadius: 80,
    bowDurability: 0,
    maxBowDurability: 10,
    deviceType: 'desktop',
    inventory: {
        wood: 0,
        stone: 0,
        food: 0,
        block: 0,
        sword: 0,
        bow: 0,
        arrow: 0
    },
    score: 0
};

// Состояние игры
const gameState = {
    inMenu: true,
    inGame: false,
    inInventory: false,
    inBuildMode: false,
    bowMode: false,
    craftPage: 0,
    recipesPerPage: 3
};

// Камера
const camera = {
    x: 0,
    y: 0
};

// Управление
const keys = {};

// ===== МЕНЮ =====
skinDisplay.textContent = availableSkins[selectedSkinIndex];

skinLeft.addEventListener('click', () => {
    selectedSkinIndex = (selectedSkinIndex - 1 + availableSkins.length) % availableSkins.length;
    skinDisplay.textContent = availableSkins[selectedSkinIndex];
});

skinRight.addEventListener('click', () => {
    selectedSkinIndex = (selectedSkinIndex + 1) % availableSkins.length;
    skinDisplay.textContent = availableSkins[selectedSkinIndex];
});

deviceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        deviceBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        deviceType = btn.dataset.device;
    });
});

nicknameInput.addEventListener('input', () => {
    startBtn.disabled = nicknameInput.value.trim() === '';
});

startBtn.addEventListener('click', startGame);

function startGame() {
    if (nicknameInput.value.trim() === '') return;
    
    player.nickname = nicknameInput.value.trim();
    player.emoji = availableSkins[selectedSkinIndex];
    player.deviceType = deviceType;
    
    mainMenu.style.display = 'none';
    gameContainer.style.display = 'block';
    gameState.inMenu = false;
    gameState.inGame = true;
    
    if (deviceType === 'mobile') {
        mobileControls.style.display = 'flex';
    }
    
    connectToServer();
    gameLoop();
}

// ===== WEB SOCKET =====
function connectToServer() {
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('✅ Подключено к серверу!');
        // Отправляем информацию об игроке
        ws.send(JSON.stringify({
            type: 'playerInfo',
            nickname: player.nickname,
            emoji: player.emoji,
            deviceType: player.deviceType
        }));
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };
}

function handleServerMessage(data) {
    switch(data.type) {
        case 'init':
            playerId = data.playerId;
            players = new Map(data.players.map(p => [p.id, p]));
            world = data.world;
            craftRecipes = data.recipes;
            updateCraftRecipes();
            console.log('🌳 Деревьев:', world.trees.length);
            console.log('🪨 Камней:', world.stones.length);
            console.log('👥 Игроков:', players.size);
            break;
            
        case 'playerJoined':
            players.set(data.player.id, data.player);
            addChatMessage('⚡', `${data.player.nickname} присоединился`);
            break;
            
        case 'playerLeft':
            const leftPlayer = players.get(data.playerId);
            if (leftPlayer) {
                addChatMessage('💨', `${leftPlayer.nickname} вышел`);
                players.delete(data.playerId);
            }
            break;
            
        case 'playerUpdate':
            if (data.player.id !== playerId) {
                players.set(data.player.id, data.player);
            } else {
                Object.assign(player, data.player);
                updateInventoryDisplay();
            }
            break;
            
        case 'playerInventory':
            if (data.playerId === playerId) {
                player.inventory = data.inventory;
                updateInventoryDisplay();
                updateCraftRecipes();
            }
            break;
            
        case 'worldUpdate':
            world = data.world;
            break;
            
        case 'chat':
            addChatMessage('💬', `${data.username}: ${data.message}`);
            break;
            
        case 'leaderboard':
            leaderboard = data.leaderboard;
            updateLeaderboardDisplay();
            break;
    }
}

// ===== ИНВЕНТАРЬ =====
function updateInventoryDisplay() {
    inventoryWood.textContent = `🪵 Дерево: ${player.inventory.wood}`;
    inventoryStone.textContent = `🪨 Камень: ${player.inventory.stone}`;
    inventoryFood.textContent = `🍎 Еда: ${player.inventory.food}`;
    inventoryBlock.textContent = `🟫 Блоки: ${player.inventory.block}`;
    inventorySword.textContent = `⚔️ Мечи: ${player.inventory.sword}`;
    inventoryBow.textContent = `🏹 Луки: ${player.inventory.bow}`;
    inventoryArrow.textContent = `🎯 Стрелы: ${player.inventory.arrow}`;
    inventoryBowDurability.textContent = `Прочность лука: ${player.bowDurability}/${player.maxBowDurability}`;
}

function updateCraftRecipes() {
    const totalPages = Math.ceil(craftRecipes.length / gameState.recipesPerPage);
    const startIndex = gameState.craftPage * gameState.recipesPerPage;
    const endIndex = Math.min(startIndex + gameState.recipesPerPage, craftRecipes.length);
    
    craftPageInfo.textContent = `Страница ${gameState.craftPage + 1}/${totalPages}`;
    craftPrev.disabled = gameState.craftPage === 0;
    craftNext.disabled = gameState.craftPage >= totalPages - 1;
    
    craftRecipesDiv.innerHTML = '';
    
    for (let i = startIndex; i < endIndex; i++) {
        const recipe = craftRecipes[i];
        const canCraft = canCraftRecipe(recipe);
        
        const button = document.createElement('button');
        button.className = 'craft-btn';
        button.disabled = !canCraft;
        button.innerHTML = `${recipe.emoji} ${recipe.name} (🪵${recipe.cost.wood} 🪨${recipe.cost.stone})`;
        
        button.addEventListener('click', () => {
            if (canCraft) {
                sendCraft(i);
            }
        });
        
        craftRecipesDiv.appendChild(button);
    }
}

function canCraftRecipe(recipe) {
    for (const resource in recipe.cost) {
        if (player.inventory[resource] < recipe.cost[resource]) {
            return false;
        }
    }
    return true;
}

// ===== ОТПРАВКА ДАННЫХ =====
function sendPlayerUpdate() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'move',
            x: player.x,
            y: player.y,
            emoji: player.emoji,
            health: player.health,
            hunger: player.hunger,
            isAttacking: player.isAttacking
        }));
    }
}

function sendAction(action, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'action',
            action: action,
            ...data
        }));
    }
}

function sendCraft(recipeIndex) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'craft',
            recipeIndex: recipeIndex
        }));
    }
}

// ===== УПРАВЛЕНИЕ =====
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (gameState.inGame) {
        if (e.key === 'e' || e.key === 'у') {
            toggleInventory();
        }
        if ((e.key === 'b' || e.key === 'и') && !gameState.inInventory) {
            gameState.inBuildMode = !gameState.inBuildMode;
        }
        if ((e.key === 'f' || e.key === 'а') && !gameState.inInventory && !gameState.inBuildMode) {
            mineResource();
        }
        if ((e.key === ' ' || e.key === 'Space') && !gameState.inInventory && !gameState.inBuildMode) {
            if (player.inventory.sword > 0 && player.attackCooldown <= 0) {
                player.isAttacking = true;
                player.attackCooldown = 20;
                sendAction('attack');
            }
        }
        if ((e.key === 'q' || e.key === 'й') && !gameState.inInventory && !gameState.inBuildMode) {
            if (player.inventory.food > 0) {
                sendAction('useFood');
            }
        }
    }
    
    if (gameState.inInventory) {
        if (e.key === 'Escape') {
            toggleInventory();
        }
    }
    
    if (gameState.inBuildMode) {
        if (e.key === 'Escape') {
            gameState.inBuildMode = false;
        }
    }
    
    // Чат
    if (e.key === 'Enter' && chatInput !== document.activeElement) {
        chatInput.focus();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Мобильное управление - КРЕСТОВИНА
document.getElementById('btnUp').addEventListener('touchstart', () => keys['w'] = true);
document.getElementById('btnUp').addEventListener('touchend', () => keys['w'] = false);
document.getElementById('btnDown').addEventListener('touchstart', () => keys['s'] = true);
document.getElementById('btnDown').addEventListener('touchend', () => keys['s'] = false);
document.getElementById('btnLeft').addEventListener('touchstart', () => keys['a'] = true);
document.getElementById('btnLeft').addEventListener('touchend', () => keys['a'] = false);
document.getElementById('btnRight').addEventListener('touchstart', () => keys['d'] = true);
document.getElementById('btnRight').addEventListener('touchend', () => keys['d'] = false);

// Убираем центральную кнопку
document.getElementById('btnCenter').style.display = 'none';

document.getElementById('btnInventory').addEventListener('click', () => {
    toggleInventory();
});

document.getElementById('btnAction').addEventListener('click', () => {
    if (!gameState.inInventory && !gameState.inBuildMode) {
        mineResource();
    }
});

document.getElementById('btnBuild').addEventListener('click', () => {
    if (!gameState.inInventory) {
        gameState.inBuildMode = !gameState.inBuildMode;
    }
});

document.getElementById('btnEat').addEventListener('click', () => {
    if (!gameState.inInventory && !gameState.inBuildMode && player.inventory.food > 0) {
        sendAction('useFood');
    }
});

// Управление инвентарем
function toggleInventory() {
    gameState.inInventory = !gameState.inInventory;
    if (gameState.inInventory) {
        inventory.style.display = 'block';
        updateInventoryDisplay();
        updateCraftRecipes();
    } else {
        inventory.style.display = 'none';
    }
}

closeInventory.addEventListener('click', toggleInventory);

craftPrev.addEventListener('click', () => {
    if (gameState.craftPage > 0) {
        gameState.craftPage--;
        updateCraftRecipes();
    }
});

craftNext.addEventListener('click', () => {
    const totalPages = Math.ceil(craftRecipes.length / gameState.recipesPerPage);
    if (gameState.craftPage < totalPages - 1) {
        gameState.craftPage++;
        updateCraftRecipes();
    }
});

// Чат
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && ws) {
        const message = chatInput.value.trim();
        if (message) {
            ws.send(JSON.stringify({
                type: 'chat',
                message: message
            }));
            chatInput.value = '';
        }
    }
});

// ===== ИГРОВАЯ ЛОГИКА =====
function mineResource() {
    const nearbyTree = world.trees.find(tree => {
        const distance = Math.sqrt((tree.x - player.x)**2 + (tree.y - player.y)**2);
        return distance < 80;
    });
    
    const nearbyStone = world.stones.find(stone => {
        const distance = Math.sqrt((stone.x - player.x)**2 + (stone.y - player.y)**2);
        return distance < 70;
    });
    
    if (nearbyTree) {
        sendAction('mine', { x: player.x, y: player.y, resourceType: 'wood' });
    } else if (nearbyStone) {
        sendAction('mine', { x: player.x, y: player.y, resourceType: 'stone' });
    }
}

// Клик для строительства/удаления блоков
canvas.addEventListener('click', (e) => {
    if (!gameState.inGame || gameState.inInventory) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Если режим строительства - СТАВИМ БЛОК
    if (gameState.inBuildMode) {
        const worldX = x + camera.x;
        const worldY = y + camera.y;
        const blockX = Math.round(worldX / 40) * 40;
        const blockY = Math.round(worldY / 40) * 40;
        const distance = Math.sqrt((blockX - player.x)**2 + (blockY - player.y)**2);
        
        if (distance > 60) {
            sendAction('placeBlock', { blockX, blockY });
        }
    } else {
        // Обычный клик - добыча ресурсов
        mineResource();
    }
});

// ПРАВАЯ КНОПКА МЫШИ - УДАЛЕНИЕ БЛОКОВ
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // Отключаем контекстное меню
    
    if (!gameState.inGame || gameState.inInventory) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const worldX = x + camera.x;
    const worldY = y + camera.y;
    const blockX = Math.round(worldX / 40) * 40;
    const blockY = Math.round(worldY / 40) * 40;
    
    // УДАЛЯЕМ БЛОК ПРАВОЙ КНОПКОЙ
    sendAction('removeBlock', { blockX, blockY });
});

// ===== ОТРИСОВКА =====
function gameLoop() {
    if (!gameState.inGame) return;
    
    // Очистка
    ctx.fillStyle = '#27AE60';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Обновление камеры
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    
    // Движение
    if (keys['w'] || keys['ц']) player.y -= player.speed;
    if (keys['s'] || keys['ы']) player.y += player.speed;
    if (keys['a'] || keys['ф']) player.x -= player.speed;
    if (keys['d'] || keys['в']) player.x += player.speed;
    
    // Границы мира
    player.x = Math.max(-1500, Math.min(1500, player.x));
    player.y = Math.max(-1500, Math.min(1500, player.y));
    
    // Отправка на сервер
    sendPlayerUpdate();
    
    // Отрисовка
    drawWorld();
    drawOtherPlayers();
    drawPlayer();
    
    if (!gameState.inInventory && !gameState.inBuildMode) {
        drawHUD();
        drawMinimap();
    }
    
    if (gameState.inBuildMode) {
        drawBuildMode();
    }
    
    requestAnimationFrame(gameLoop);
}

function drawWorld() {
    // Деревья
    world.trees.forEach(tree => {
        const screenX = tree.x - camera.x;
        const screenY = tree.y - camera.y;
        
        // Проверяем видимость
        if (screenX > -100 && screenX < canvas.width + 100 && 
            screenY > -100 && screenY < canvas.height + 100) {
            ctx.font = `${tree.size}px Arial`;
            ctx.fillText(tree.emoji, screenX, screenY);
        }
    });
    
    // Камни
    world.stones.forEach(stone => {
        const screenX = stone.x - camera.x;
        const screenY = stone.y - camera.y;
        
        if (screenX > -50 && screenX < canvas.width + 50 && 
            screenY > -50 && screenY < canvas.height + 50) {
            ctx.font = `${stone.size}px Arial`;
            ctx.fillText(stone.emoji, screenX, screenY);
        }
    });
    
    // Блоки
    world.blocks.forEach(block => {
        const screenX = block.x - camera.x;
        const screenY = block.y - camera.y;
        
        if (screenX > -40 && screenX < canvas.width + 40 && 
            screenY > -40 && screenY < canvas.height + 40) {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(screenX, screenY, 40, 40);
            ctx.strokeStyle = '#654321';
            ctx.strokeRect(screenX, screenY, 40, 40);
            ctx.font = '30px Arial';
            ctx.fillStyle = 'white';
            ctx.fillText('🟫', screenX + 5, screenY + 30);
        }
    });
}

function drawOtherPlayers() {
    players.forEach(otherPlayer => {
        if (otherPlayer.id !== playerId) {
            const screenX = otherPlayer.x - camera.x;
            const screenY = otherPlayer.y - camera.y;
            
            // Проверяем видимость
            if (screenX > -50 && screenX < canvas.width + 50 && 
                screenY > -50 && screenY < canvas.height + 50) {
                
                // Игрок
                ctx.font = `${otherPlayer.size}px Arial`;
                ctx.fillText(otherPlayer.emoji, screenX, screenY);
                
                // Имя
                ctx.fillStyle = 'white';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(otherPlayer.nickname, screenX, screenY - 30);
                
                // Полоска здоровья
                const barWidth = 40;
                const barHeight = 6;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(screenX - barWidth/2, screenY - 50, barWidth, barHeight);
                ctx.fillStyle = otherPlayer.health > 50 ? '#2ecc71' : otherPlayer.health > 25 ? '#f39c12' : '#e74c3c';
                ctx.fillRect(screenX - barWidth/2, screenY - 50, barWidth * (otherPlayer.health / 100), barHeight);
            }
        }
    });
}

function drawPlayer() {
    // Мой игрок (в центре)
    const screenX = canvas.width/2;
    const screenY = canvas.height/2;
    
    ctx.font = `${player.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(player.emoji, screenX, screenY + player.size/3);
    
    // Радиус атаки
    if (player.isAttacking) {
        ctx.strokeStyle = 'rgba(255,0,0,0.6)';
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(screenX, screenY, player.attackRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawHUD() {
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    ctx.fillText(`Ник: ${player.nickname} ${player.emoji}`, 10, 20);
    ctx.fillText(`Координаты: ${Math.round(player.x)}, ${Math.round(player.y)}`, 10, 40);
    ctx.fillText(`🪵:${player.inventory.wood} 🪨:${player.inventory.stone} 🍎:${player.inventory.food} 🟫:${player.inventory.block}`, 10, 60);
    
    if (deviceType === 'desktop') {
        ctx.fillText(`E-инвентарь | B-строительство | F-добыча | ПРОБЕЛ-атака | Q-есть`, 10, 80);
        ctx.fillText(`Игроков онлайн: ${players.size}`, 10, 100);
        
        // Полоски HP и голода
        const barWidth = 200;
        const barHeight = 20;
        
        // HP
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(10, 110, (player.health / 100) * barWidth, barHeight);
        ctx.strokeStyle = '#C0392B';
        ctx.strokeRect(10, 110, barWidth, barHeight);
        ctx.fillStyle = 'white';
        ctx.fillText(`❤️ HP: ${Math.round(player.health)}%`, 15, 125);
        
        // Голод
        ctx.fillStyle = '#F39C12';
        ctx.fillRect(10, 140, (player.hunger / 100) * barWidth, barHeight);
        ctx.strokeStyle = '#E67E22';
        ctx.strokeRect(10, 140, barWidth, barHeight);
        ctx.fillStyle = 'white';
        ctx.fillText(`🍗 Голод: ${Math.round(player.hunger)}%`, 15, 155);
        
        // Информация о мече и луке
        if (player.inventory.sword <= 0) {
            ctx.fillStyle = '#E74C3C';
            ctx.fillText(`⚔️ НЕТ МЕЧА! Скрафтите в инвентаре (E)`, 10, 180);
        } else {
            ctx.fillStyle = '#2ECC71';
            ctx.fillText(`⚔️ Мечей: ${player.inventory.sword} (ПРОБЕЛ для атаки)`, 10, 180);
        }
        
        if (player.inventory.bow > 0 && player.bowDurability > 0 && player.inventory.arrow > 0) {
            ctx.fillStyle = '#3498DB';
            ctx.fillText(`🏹 Лук: ${player.bowDurability}/${player.maxBowDurability} | 🎯 Стрел: ${player.inventory.arrow}`, 10, 200);
        }
    } else {
        // Мобильная версия HUD
        ctx.fillText(`❤️${Math.round(player.health)}% 🍗${Math.round(player.hunger)}%`, 10, 80);
        ctx.fillText(`👥${players.size}`, 10, 100);
        
        if (player.inventory.sword <= 0) {
            ctx.fillStyle = '#E74C3C';
            ctx.fillText(`⚔️НЕТ!`, 10, 120);
        }
    }
}

// МИНИКАРТА
function drawMinimap() {
    const minimapSize = 150;
    const minimapX = canvas.width - minimapSize - 10;
    const minimapY = 10;
    
    // Фон миникарты
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
    
    // Масштаб для миникарты (3000x3000 мир -> 150x150 миникарта)
    const scale = minimapSize / 3000;
    
    // Игроки на миникарте
    players.forEach(p => {
        const mapX = minimapX + (p.x + 1500) * scale;
        const mapY = minimapY + (p.y + 1500) * scale;
        
        if (p.id === playerId) {
            // Главный игрок - зеленый
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(mapX - 2, mapY - 2, 4, 4);
        } else {
            // Другие игроки - красные
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(mapX - 1, mapY - 1, 2, 2);
        }
    });
    
    // Ресурсы на миникарте
    world.trees.forEach(tree => {
        const mapX = minimapX + (tree.x + 1500) * scale;
        const mapY = minimapY + (tree.y + 1500) * scale;
        ctx.fillStyle = '#00AA00';
        ctx.fillRect(mapX, mapY, 1, 1);
    });
    
    world.stones.forEach(stone => {
        const mapX = minimapX + (stone.x + 1500) * scale;
        const mapY = minimapY + (stone.y + 1500) * scale;
        ctx.fillStyle = '#888888';
        ctx.fillRect(mapX, mapY, 1, 1);
    });
    
    // Блоки на миникарте
    world.blocks.forEach(block => {
        const mapX = minimapX + (block.x + 1500) * scale;
        const mapY = minimapY + (block.y + 1500) * scale;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(mapX, mapY, 2, 2);
    });
    
    // Название миникарты
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('МИНИКАРТА', minimapX + minimapSize/2, minimapY - 5);
}

function drawBuildMode() {
    // Фон
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ECF0F1';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('РЕЖИМ СТРОИТЕЛЬСТВА', canvas.width/2, 30);
    ctx.fillText(`🟫 Блоков: ${player.inventory.block}`, canvas.width/2, 60);
    ctx.fillText('ЛКМ - поставить блок | ПКМ - удалить блок', canvas.width/2, 90);
    
    // СЕТКА НА ВЕСЬ МИР (не следует за камерой)
    const gridSize = 40;
    const startX = Math.floor((-1500 - camera.x) / gridSize) * gridSize;
    const startY = Math.floor((-1500 - camera.y) / gridSize) * gridSize;
    const endX = Math.ceil((1500 - camera.x) / gridSize) * gridSize;
    const endY = Math.ceil((1500 - camera.y) / gridSize) * gridSize;
    
    for (let x = startX; x <= endX; x += gridSize) {
        for (let y = startY; y <= endY; y += gridSize) {
            const screenX = x + camera.x;
            const screenY = y + camera.y;
            
            if (screenX >= 0 && screenX <= canvas.width && screenY >= 0 && screenY <= canvas.height) {
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(screenX, screenY, gridSize, gridSize);
            }
        }
    }
    
    // Существующие блоки
    world.blocks.forEach(block => {
        const screenX = block.x - camera.x;
        const screenY = block.y - camera.y;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX, screenY, gridSize, gridSize);
        ctx.strokeStyle = '#654321';
        ctx.strokeRect(screenX, screenY, gridSize, gridSize);
    });
    
    // Предпросмотр нового блока под курсором
    const mouseX = canvas.width / 2;
    const mouseY = canvas.height / 2;
    const worldX = mouseX + camera.x;
    const worldY = mouseY + camera.y;
    const blockX = Math.round(worldX / gridSize) * gridSize;
    const blockY = Math.round(worldY / gridSize) * gridSize;
    const screenX = blockX - camera.x;
    const screenY = blockY - camera.y;
    
    // Проверяем можно ли поставить блок здесь
    const existingBlock = world.blocks.find(b => b.x === blockX && b.y === blockY);
    const distance = Math.sqrt((blockX - player.x)**2 + (blockY - player.y)**2);
    const canPlace = !existingBlock && distance > 60;
    
    // Отрисовываем предпросмотр
    if (canPlace) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    } else {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    }
    ctx.fillRect(screenX, screenY, gridSize, gridSize);
    ctx.strokeStyle = canPlace ? '#00FF00' : '#FF0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(screenX, screenY, gridSize, gridSize);
}

function addChatMessage(emoji, message) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<strong>${emoji}</strong> ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateLeaderboardDisplay() {
    leaderboardList.innerHTML = '';
    leaderboard.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'leader-item';
        div.innerHTML = `
            <span>${index + 1}. ${item.nickname}</span>
            <span>${item.score}</span>
        `;
        leaderboardList.appendChild(div);
    });
}

// Обновление HUD
function updateHUD() {
    document.getElementById('playerName').textContent = player.nickname;
    document.getElementById('coordinates').textContent = `${Math.round(player.x)}, ${Math.round(player.y)}`;
    document.getElementById('health').textContent = Math.round(player.health);
    document.getElementById('hunger').textContent = Math.round(player.hunger);
}

// Запуск обновления HUD
setInterval(updateHUD, 100);