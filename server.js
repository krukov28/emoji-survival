const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const players = new Map();
const world = {
    trees: [],
    stones: [], 
    blocks: []
};

// Рецепты крафта
const craftRecipes = [
    { name: '⚔️ Меч', cost: { wood: 2, stone: 3 }, result: 'sword', emoji: '⚔️' },
    { name: '🏹 Лук', cost: { wood: 3, stone: 1 }, result: 'bow', emoji: '🏹' },
    { name: '🎯 Стрелы', cost: { wood: 1, stone: 1 }, result: 'arrow', emoji: '🎯' },
    { name: '🟫 Блок', cost: { wood: 2, stone: 2 }, result: 'block', emoji: '🟫' },
    { name: '🍎 Еда', cost: { wood: 1, stone: 1 }, result: 'food', emoji: '🍎' }
];

// Генерация мира
function generateWorld() {
    // Деревья
    for (let i = 0; i < 50; i++) {
        world.trees.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.random() * 3000 - 1500,
            y: Math.random() * 3000 - 1500,
            size: 50 + Math.random() * 20,
            emoji: ['🌲', '🌳', '🎄'][Math.floor(Math.random() * 3)],
            health: 3
        });
    }
    
    // Камни  
    for (let i = 0; i < 30; i++) {
        world.stones.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.random() * 3000 - 1500,
            y: Math.random() * 3000 - 1500,
            size: 45,
            emoji: '🪨',
            health: 3
        });
    }
}

// Функция респавна ресурсов
function respawnResources() {
    const maxTrees = 50;
    const maxStones = 30;
    
    // Добавляем деревья если их мало
    if (world.trees.length < maxTrees) {
        const treesToAdd = maxTrees - world.trees.length;
        for (let i = 0; i < treesToAdd; i++) {
            world.trees.push({
                id: Math.random().toString(36).substr(2, 9),
                x: Math.random() * 3000 - 1500,
                y: Math.random() * 3000 - 1500,
                size: 50 + Math.random() * 20,
                emoji: ['🌲', '🌳', '🎄'][Math.floor(Math.random() * 3)],
                health: 3
            });
        }
        console.log(`🌳 Респавн: +${treesToAdd} деревьев`);
    }
    
    // Добавляем камни если их мало
    if (world.stones.length < maxStones) {
        const stonesToAdd = maxStones - world.stones.length;
        for (let i = 0; i < stonesToAdd; i++) {
            world.stones.push({
                id: Math.random().toString(36).substr(2, 9),
                x: Math.random() * 3000 - 1500,
                y: Math.random() * 3000 - 1500,
                size: 45,
                emoji: '🪨',
                health: 3
            });
        }
        console.log(`🪨 Респавн: +${stonesToAdd} камней`);
    }
    
    // Обновляем мир у всех игроков
    broadcast({
        type: 'worldUpdate',
        world: world
    });
}

// Статика для сайта
app.use(express.static('.'));

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Страница игры
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

// API для получения статистики
app.get('/api/stats', (req, res) => {
    res.json({
        online: players.size,
        totalPlayers: Array.from(players.values()).length,
        world: {
            trees: world.trees.length,
            stones: world.stones.length,
            blocks: world.blocks.length
        },
        serverTime: new Date().toISOString()
    });
});

// WebSocket соединение
wss.on('connection', (ws) => {
    console.log('🎮 Новый игрок подключился');
    
    const playerId = Math.random().toString(36).substr(2, 9);
    const player = {
        id: playerId,
        x: 0,
        y: 0,
        size: 40,
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
        score: 0,
        lastUpdate: Date.now()
    };
    
    players.set(playerId, player);
    
    // Отправляем новому игроку весь мир
    ws.send(JSON.stringify({
        type: 'init',
        playerId: playerId,
        players: Array.from(players.values()),
        world: world,
        recipes: craftRecipes
    }));
    
    // Сообщаем всем о новом игроке
    broadcast({
        type: 'playerJoined',
        player: player
    }, ws);
    
    // Обновляем таблицу лидеров
    updateLeaderboard();
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'move':
                    updatePlayerPosition(playerId, data);
                    break;
                case 'action':
                    handlePlayerAction(playerId, data);
                    break;
                case 'craft':
                    handleCraft(playerId, data);
                    break;
                case 'chat':
                    broadcast({
                        type: 'chat',
                        playerId: playerId,
                        message: data.message,
                        username: players.get(playerId).nickname
                    });
                    break;
                case 'playerInfo':
                    updatePlayerInfo(playerId, data);
                    break;
            }
        } catch (e) {
            console.error('❌ Ошибка:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('💨 Игрок отключился:', playerId);
        players.delete(playerId);
        broadcast({
            type: 'playerLeft',
            playerId: playerId
        });
        updateLeaderboard();
    });
});

function updatePlayerPosition(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;
    
    let newX = data.x;
    let newY = data.y;
    
    // ПРОВЕРЯЕМ КОЛЛИЗИИ С БЛОКАМИ
    let canMove = true;
    world.blocks.forEach(block => {
        const blockCenterX = block.x + 20;
        const blockCenterY = block.y + 20;
        const dx = newX - blockCenterX;
        const dy = newY - blockCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 50) { // Радиус коллизии игрока + блока
            canMove = false;
        }
    });
    
    // ЕСЛИ МОЖЕМ ДВИГАТЬСЯ - ОБНОВЛЯЕМ ПОЗИЦИЮ
    if (canMove) {
        player.x = newX;
        player.y = newY;
    } else {
        // Если есть коллизия, пытаемся сдвинуть игрока немного
        const oldX = player.x;
        const oldY = player.y;
        
        // Пробуем двигаться только по X
        let tempX = newX;
        let tempY = oldY;
        canMove = true;
        world.blocks.forEach(block => {
            const blockCenterX = block.x + 20;
            const blockCenterY = block.y + 20;
            const dx = tempX - blockCenterX;
            const dy = tempY - blockCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 50) canMove = false;
        });
        
        if (canMove) {
            player.x = tempX;
        } else {
            // Пробуем двигаться только по Y
            tempX = oldX;
            tempY = newY;
            canMove = true;
            world.blocks.forEach(block => {
                const blockCenterX = block.x + 20;
                const blockCenterY = block.y + 20;
                const dx = tempX - blockCenterX;
                const dy = tempY - blockCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 50) canMove = false;
            });
            
            if (canMove) {
                player.y = tempY;
            }
        }
    }
    
    player.emoji = data.emoji;
    player.health = data.health;
    player.hunger = data.hunger;
    player.isAttacking = data.isAttacking;
    player.lastUpdate = Date.now();
    
    broadcast({
        type: 'playerUpdate',
        player: player
    });
}

function updatePlayerInfo(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;
    
    player.nickname = data.nickname;
    player.emoji = data.emoji;
    player.deviceType = data.deviceType;
    
    broadcast({
        type: 'playerUpdate',
        player: player
    });
}

function handlePlayerAction(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;
    
    if (data.action === 'mine') {
        // Сначала проверяем клик по ресурсам (деревья/камни)
        const resource = findResourceAt(data.x, data.y, data.resourceType);
        if (resource) {
            resource.health -= 1;
            if (resource.health <= 0) {
                if (data.resourceType === 'wood') {
                    player.inventory.wood += 1;
                    player.score += 1;
                    world.trees = world.trees.filter(t => t.id !== resource.id);
                } else {
                    player.inventory.stone += 1;
                    player.score += 1;
                    world.stones = world.stones.filter(s => s.id !== resource.id);
                }
                
                broadcast({
                    type: 'worldUpdate',
                    world: world
                });
                updateLeaderboard();
            }
            
            broadcast({
                type: 'playerInventory',
                playerId: playerId,
                inventory: player.inventory
            });
        }
    }
    else if (data.action === 'attack') {
        if (player.inventory.sword > 0) {
            player.inventory.sword -= 1;
            player.isAttacking = true;
            
            let hit = false;
            players.forEach(otherPlayer => {
                if (otherPlayer.id !== playerId) {
                    const dx = otherPlayer.x - player.x;
                    const dy = otherPlayer.y - player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < player.attackRadius) {
                        otherPlayer.health -= 10;
                        player.score += 5;
                        hit = true;
                        
                        if (otherPlayer.health <= 0) {
                            player.score += 20;
                            otherPlayer.health = 100;
                            otherPlayer.x = 0;
                            otherPlayer.y = 0;
                        }
                        
                        broadcast({
                            type: 'playerUpdate',
                            player: otherPlayer
                        });
                    }
                }
            });
            
            if (hit) {
                updateLeaderboard();
            }
            
            broadcast({
                type: 'playerInventory',
                playerId: playerId,
                inventory: player.inventory
            });
        }
    }
    else if (data.action === 'placeBlock') {
        if (player.inventory.block > 0) {
            const blockX = data.blockX;
            const blockY = data.blockY;
            
            // ПРОВЕРЯЕМ КОЛЛИЗИИ С ИГРОКАМИ
            let canPlace = true;
            players.forEach(p => {
                const dx = p.x - (blockX + 20);
                const dy = p.y - (blockY + 20);
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 50) { // Радиус коллизии
                    canPlace = false;
                }
            });
            
            // ПРОВЕРЯЕМ ЧТО БЛОК УЖЕ НЕ СУЩЕСТВУЕТ
            const existingBlock = world.blocks.find(b => b.x === blockX && b.y === blockY);
            if (existingBlock) {
                canPlace = false;
            }
            
            if (canPlace) {
                world.blocks.push({
                    id: Math.random().toString(36).substr(2, 9),
                    x: blockX,
                    y: blockY
                });
                player.inventory.block -= 1;
                player.score += 2;
                
                broadcast({
                    type: 'worldUpdate',
                    world: world
                });
                
                broadcast({
                    type: 'playerInventory',
                    playerId: playerId,
                    inventory: player.inventory
                });
                
                updateLeaderboard();
            }
        }
    }
    else if (data.action === 'removeBlock') {
        // УДАЛЕНИЕ БЛОКА ОТДЕЛЬНЫМ ДЕЙСТВИЕМ
        const blockX = data.blockX;
        const blockY = data.blockY;
        
        const blockToRemove = world.blocks.find(b => b.x === blockX && b.y === blockY);
        if (blockToRemove) {
            // Удаляем блок и возвращаем ресурс
            world.blocks = world.blocks.filter(b => b.id !== blockToRemove.id);
            player.inventory.block += 1;
            player.score -= 1;
            
            broadcast({
                type: 'worldUpdate',
                world: world
            });
            
            broadcast({
                type: 'playerInventory',
                playerId: playerId,
                inventory: player.inventory
            });
            
            updateLeaderboard();
        }
    }
    else if (data.action === 'useFood') {
        if (player.inventory.food > 0) {
            player.inventory.food -= 1;
            player.hunger = Math.min(100, player.hunger + 25);
            
            broadcast({
                type: 'playerInventory',
                playerId: playerId,
                inventory: player.inventory
            });
            
            broadcast({
                type: 'playerUpdate',
                player: player
            });
        }
    }
}

function handleCraft(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;
    
    const recipe = craftRecipes[data.recipeIndex];
    let canCraft = true;
    
    // Проверяем ресурсы
    for (const resource in recipe.cost) {
        if (player.inventory[resource] < recipe.cost[resource]) {
            canCraft = false;
            break;
        }
    }
    
    if (canCraft) {
        // Тратим ресурсы
        for (const resource in recipe.cost) {
            player.inventory[resource] -= recipe.cost[resource];
        }
        
        // Даем результат
        if (recipe.result === 'food') {
            player.inventory.food += 2;
        } else if (recipe.result === 'block') {
            player.inventory.block += 4;
        } else if (recipe.result === 'sword') {
            player.inventory.sword += 1;
        } else if (recipe.result === 'bow') {
            player.inventory.bow += 1;
            player.bowDurability = player.maxBowDurability;
        } else if (recipe.result === 'arrow') {
            player.inventory.arrow += 8;
        }
        
        player.score += 3;
        
        broadcast({
            type: 'playerInventory',
            playerId: playerId,
            inventory: player.inventory
        });
        
        broadcast({
            type: 'playerUpdate',
            player: player
        });
        
        updateLeaderboard();
    }
}

function findResourceAt(x, y, type) {
    if (type === 'wood') {
        return world.trees.find(tree => {
            const distance = Math.sqrt((tree.x - x)**2 + (tree.y - y)**2);
            return distance < 80;
        });
    } else {
        return world.stones.find(stone => {
            const distance = Math.sqrt((stone.x - x)**2 + (stone.y - y)**2);
            return distance < 70;
        });
    }
}

function updateLeaderboard() {
    const leaderboard = Array.from(players.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(p => ({ nickname: p.nickname, score: Math.round(p.score) }));
    
    broadcast({
        type: 'leaderboard',
        leaderboard: leaderboard
    });
}

function broadcast(data, excludeWs = null) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Генерируем мир при запуске
generateWorld();

// Обновление голода и здоровья
setInterval(() => {
    players.forEach(player => {
        player.hunger = Math.max(0, player.hunger - 0.1);
        if (player.hunger < 20) {
            player.health = Math.max(0, player.health - 0.1);
        }
        if (player.hunger > 70 && player.health < 100) {
            player.health = Math.min(100, player.health + 0.1);
        }
        
        if (player.attackCooldown > 0) {
            player.attackCooldown--;
        } else {
            player.isAttacking = false;
        }
        
        broadcast({
            type: 'playerUpdate',
            player: player
        });
    });
}, 1000);

// Респавн ресурсов каждые 30 секунд
setInterval(() => {
    respawnResources();
}, 30000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log('🎮 СЕРВЕР ЗАПУЩЕН!');
    console.log('🌐 Сайт: http://localhost:' + PORT);
    console.log('🎮 Игра: http://localhost:' + PORT + '/game');
    console.log('📊 API Статистики: http://localhost:' + PORT + '/api/stats');
    console.log('👥 Игроков онлайн: 0');
    console.log('🌳 Деревьев: ' + world.trees.length);
    console.log('🪨 Камней: ' + world.stones.length);
    console.log('🔄 Респавн ресурсов: каждые 30 секунд');
    console.log('🚧 Коллизии блоков: ВКЛЮЧЕНЫ');
    console.log('🗑️ Удаление блоков: ПРАВАЯ КНОПКА МЫШИ');
});