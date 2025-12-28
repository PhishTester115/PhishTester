class PhishingDetector {
    constructor() {
        this.currentEmail = null;
        this.selectedReasonIndices = new Set();
        this.stats = {
            correct: 0,
            total: 0
        };
        
        this.emailQueue = []; 
        this.queueSize = 2; 
        this.historyBuffer = []; 
        this.MAX_HISTORY = 10; 

        this.scenariosBank = [
            // --- РАБОТА / КОРПОРАТИВ ---
            { platform: "Email (Corp)", sender: "Бухгалтерия 1С", topic: "Расчетный лист за месяц (корректировка)", type: "attachment" },
            { platform: "Email (Corp)", sender: "Битрикс24", topic: "Новая задача от руководителя: Срочно ознакомиться", type: "link" },
            { platform: "Telegram", sender: "Гендиректор (фейк)", topic: "Я на встрече, срочно оплати счет поставщику", type: "money" },
            { platform: "Email (Corp)", sender: "Отдел кадров", topic: "График отпусков на следующий год (Заполнить)", type: "link" },
            { platform: "Email (Corp)", sender: "IT-Support", topic: "Истекает пароль доменной учетной записи", type: "login" },
            { platform: "Email (Corp)", sender: "СБ (Безопасность)", topic: "Вход в ваш аккаунт с неизвестного IP (Китай)", type: "login" },
            
            // --- ГОСУДАРСТВО / БАНКИ ---
            { platform: "SMS", sender: "Gosuslugi", topic: "Имеется судебная задолженность. Срочно оплатите", type: "money" },
            { platform: "Email", sender: "ФНС России", topic: "Требование об уплате налога (недоимка)", type: "attachment" },
            { platform: "SMS", sender: "Sberbank", topic: "Списание 14500р. Если не вы - звоните", type: "call_scam" },
            { platform: "WhatsApp", sender: "Менеджер ВТБ", topic: "Ваш личный кабинет взломан, переводим на безопасный счет", type: "money" },
            { platform: "Email", sender: "Почта России", topic: "Посылка ожидает доставки. Оплатите пошлину", type: "link" },
            
            // --- ЛИЧНОЕ / СЕРВИСЫ ---
            { platform: "WhatsApp", sender: "Знакомый", topic: "Привет, проголосуй за племянницу в конкурсе (ссылка)", type: "link" },
            { platform: "Email", sender: "Wildberries", topic: "Ваш заказ отменен. Оформите возврат средств", type: "scam_link" },
            { platform: "Email", sender: "Ozon", topic: "Выигрыш в розыгрыше призов 11.11", type: "fee" },
            { platform: "Telegram", sender: "Избранное (Фейк)", topic: "Сохранено сообщение: Ваш аккаунт будет удален", type: "login" },
            { platform: "ВКонтакте", sender: "Друг (взломан)", topic: "Слушай, займи 3000 до завтра? Карта привязана", type: "money" },
            { platform: "Email", sender: "Яндекс Плюс", topic: "Не удалось списать оплату за подписку", type: "data" },
            { platform: "SMS", sender: "MCHS", topic: "Штормовое предупреждение (ссылка на фейк)", type: "link" },
            { platform: "Авито", sender: "Покупатель", topic: "Я оплатил доставку, вот ссылка на получение денег", type: "scam_link" }
        ];

        this.init();
    }

    init() {
        this.loadStats();
        this.updateStatsUI();
        this.initializeEventListeners();
        
        // Восстановление сессии
        const activeSession = localStorage.getItem('phishing_active_session');
        if (activeSession) {
            try {
                const data = JSON.parse(activeSession);
                if (data.isCompleted) {
                    localStorage.removeItem('phishing_active_session');
                } else {
                    this.displayEmailData(data); 
                    this.refillQueue(); 
                    return; 
                }
            } catch (e) {
                localStorage.removeItem('phishing_active_session');
            }
        }

        // Предзагрузка
        const preloadedJson = localStorage.getItem('preloaded_email');
        if (preloadedJson) {
            try {
                const data = JSON.parse(preloadedJson);
                localStorage.removeItem('preloaded_email');
                if (!data.content) throw new Error("Пустые данные");
                
                this.displayEmailData(data);
                this.refillQueue();
            } catch (e) {
                console.error("Ошибка парсинга", e);
                this.refillQueue();
                this.processNextEmail();
            }
        } else {
            this.refillQueue();
            this.processNextEmail();
        }
    }

    // ... (Методы loadStats, saveStats, resetStats, initializeEventListeners, refillQueue, processNextEmail, getUniqueScenario, updateStatsUI, showMainLoader, handleError - ОСТАВЛЯЕМ БЕЗ ИЗМЕНЕНИЙ ИЗ ПРОШЛОГО КОДА)
    loadStats() {
        const savedStats = localStorage.getItem('phishing_detector_stats');
        if (savedStats) { try { this.stats = JSON.parse(savedStats); } catch (e) { this.stats = { correct: 0, total: 0 }; } }
    }
    saveStats() { localStorage.setItem('phishing_detector_stats', JSON.stringify(this.stats)); }
    resetStats() { if(confirm('Сбросить статистику?')) { this.stats = { correct: 0, total: 0 }; this.saveStats(); this.updateStatsUI(); } }
    
    initializeEventListeners() {
        document.getElementById('phishingBtn').addEventListener('click', () => this.handlePhishingSelection());
        document.getElementById('legitimateBtn').addEventListener('click', () => this.handleLegitimateSelection());
        document.getElementById('confirmReasonBtn').addEventListener('click', () => this.submitPhishingReason());
        document.getElementById('nextBtn').addEventListener('click', () => this.processNextEmail());
        const resetBtn = document.getElementById('resetStatsBtn');
        if(resetBtn) resetBtn.addEventListener('click', () => this.resetStats());
    }

    refillQueue() {
        while (this.emailQueue.length < this.queueSize) {
            const promise = this.fetchEmailData().catch(err => {
                console.warn("Фоновая загрузка не удалась:", err);
                return null;
            });
            this.emailQueue.push(promise);
        }
    }

    async processNextEmail() {
        localStorage.removeItem('phishing_active_session');
        document.getElementById('emailSection').style.display = 'none';
        this.currentEmail = null;
        this.selectedReasonIndices.clear();
        this.showMainLoader(true);

        try {
            if (this.emailQueue.length === 0) this.refillQueue();
            let data = await this.emailQueue.shift();
            if (!data) data = await this.fetchEmailData();
            this.refillQueue(); 
            this.displayEmailData(data);
        } catch (error) {
            this.handleError(error);
        }
    }

    getUniqueScenario() {
        const availableIndices = this.scenariosBank
            .map((_, index) => index)
            .filter(index => !this.historyBuffer.includes(index));

        let selectedIndex;
        if (availableIndices.length === 0) {
            this.historyBuffer = [];
            selectedIndex = Math.floor(Math.random() * this.scenariosBank.length);
        } else {
            const randomPointer = Math.floor(Math.random() * availableIndices.length);
            selectedIndex = availableIndices[randomPointer];
        }

        this.historyBuffer.push(selectedIndex);
        if (this.historyBuffer.length > this.MAX_HISTORY) {
            this.historyBuffer.shift();
        }

        return this.scenariosBank[selectedIndex];
    }

    updateStatsUI() {
        const t = this.stats.total;
        const c = this.stats.correct;
        document.getElementById('correctCount').textContent = c;
        document.getElementById('totalCount').textContent = t;
        document.getElementById('percentCount').textContent = (t > 0 ? Math.round((c/t)*100) : 0) + '%';
    }

    showMainLoader(show) {
        document.getElementById('initialLoader').style.display = show ? 'flex' : 'none';
    }

    handleError(e) {
        console.error(e);
        this.showMainLoader(false);
        setTimeout(() => this.processNextEmail(), 3000);
    }

    // --- ОБНОВЛЕННАЯ ГЕНЕРАЦИЯ ---
    async fetchEmailData() {
        const emailType = Math.random() < 0.6 ? 1 : 0; 
        const scenario = this.getUniqueScenario();
        const sophistication = Math.random() < 0.5 ? "Low" : "High";
        
        const targetOptionCount = Math.floor(Math.random() * 3) + 5;

        const contextInstruction = `
            КОНТЕКСТ: Россия, 2025. Валюта: Рубли. 
            Если официальное (Госуслуги, Банк) - строгий стиль. Если мессенджер - живой.
        `;

        const commonInstruction = `
            ТРЕБОВАНИЯ:
            1. Создай текст сообщения/письма.
            2. После текста добавь ###АНАЛИЗ###.
            ВАЖНО: Анализ должен быть ПОДРОБНЫМ (разбор ссылок, имен, психологии).
        `;

        // ИСПРАВЛЕННЫЙ ПРОМПТ ДЛЯ ВАРИАНТОВ
        const phishingInstruction = `
            3. После анализа добавь ###OPTIONS###. 
            Создай ровно ${targetOptionCount} вариантов признаков через '|'.
            
            КРИТИЧЕСКИ ВАЖНО:
            Используй метку (+), если это РЕАЛЬНЫЙ ПРИЗНАК МОШЕННИЧЕСТВА, присутствующий в тексте (например: "(+) Скрытая ссылка", "(+) Срочность").
            Используй метку (-), если это ЛОЖЬ или ОТСУТСТВУЮЩИЙ признак (например: "(-) Орфографические ошибки" - если текст написан грамотно).
            
            Должно быть 2-3 варианта с (+). Остальные с (-).
            (Не пиши блок ###ANSWER###).
        `;

        let prompt;
        if (emailType === 1) {
            let nuance = "";
            if (scenario.type === "money") nuance = "Цель: деньги.";
            if (scenario.type === "login") nuance = "Цель: украсть пароль.";
            if (scenario.type === "attachment") nuance = "Цель: вирус.";
            if (scenario.type === "scam_link") nuance = "Цель: данные карты по ссылке.";
            if (scenario.type === "call_scam") nuance = "Цель: заставить позвонить.";
            
            prompt = `
                РОЛЬ: Мошенник.
                СЦЕНАРИЙ: ${scenario.topic}
                ПЛАТФОРМА: ${scenario.platform}
                ОТПРАВИТЕЛЬ: ${scenario.sender}
                СЛОЖНОСТЬ: ${sophistication}
                ${nuance}
                
                ${contextInstruction}
                ${commonInstruction}
                ${phishingInstruction}
            `;
        } else {
            prompt = `
                РОЛЬ: Честный сервис.
                ЗАДАЧА: Безопасное сообщение (НЕ фишинг).
                СЦЕНАРИЙ: ${scenario.topic}
                ПЛАТФОРМА: ${scenario.platform}
                
                ${contextInstruction}
                ${commonInstruction}
                В анализе объясни, почему сообщение безопасно.
            `;
        }

        const randomId = Math.random().toString(36).substring(7);
        const finalPrompt = `${prompt}\n(Unique ID: ${randomId})`;

        const response = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-reasoning',
                messages: [
                    { role: 'system', content: 'Ты эксперт. Используй (+) для верных признаков фишинга и (-) для неверных.' },
                    { role: 'user', content: finalPrompt }
                ],
                referrer: 'https://g4f.dev/'
            })
        });

        if (!response.ok) throw new Error('Ошибка сети');
        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            const fullText = data.choices[0].message.content;
            return this.parseResponse(fullText, emailType === 1, scenario.platform);
        } else {
            throw new Error('API Error');
        }
    }

    parseResponse(text, isPhishing, platformName) {
        let content = text;
        
        [/Support Pollinations[\s\S]*$/i, /🌸 Ad[\s\S]*$/i, /Powered by[\s\S]*$/i].forEach(r => content = content.replace(r, ''));
        content = content.trim();

        let analysis = "Анализ отсутствует.";
        let rawOptions = [];

        const optionsRegex = /###\s*OPTIONS\s*###/i;
        const analysisRegex = /###\s*(?:АНАЛИЗ|ANALYSIS)\s*###/i;

        if (optionsRegex.test(content)) {
            const parts = content.split(optionsRegex);
            const optionsPart = parts[1].trim();
            const cleanOptionsPart = optionsPart.split(/###\s*ANSWER/i)[0]; // Убираем ANSWER если он есть
            
            rawOptions = cleanOptionsPart.split('|')
                .map(o => o.trim())
                .filter(o => o.length > 0);
            
            content = parts[0]; 
        }

        if (analysisRegex.test(content)) {
            const parts = content.split(analysisRegex);
            analysis = parts[1].trim();
            content = parts[0]; 
        }

        content = content.trim();
        
        let processedOptions = [];
        let correctIndices = [];

        if (isPhishing) {
            if (rawOptions.length > 0) {
                // Превращаем в объекты и чистим текст
                let parsedOpts = rawOptions.map(opt => {
                    // Более надежный поиск плюса/минуса
                    // Ищем (+) или [+] или просто + в начале
                    const isTrue = /(\(\+\)|\[\+\]|^\+\s?)/.test(opt);
                    
                    // Чистим текст от всех видов маркеров
                    let cleanText = opt
                        .replace(/[\(\[\{]\s*[\+\-]\s*[\)\]\}]/g, '') // Удаляет (+), [-], {+}
                        .replace(/^[\+\-]\s?/, '') // Удаляет + или - в начале
                        .trim();
                        
                    return { text: cleanText, isCorrect: isTrue };
                });

                // Перемешиваем
                parsedOpts.sort(() => Math.random() - 0.5);

                // Защита: Если нет верных (нейросеть ошиблась), делаем первый верным искусственно
                if (!parsedOpts.some(o => o.isCorrect)) {
                    parsedOpts[0] = { text: "Подозрительное содержание", isCorrect: true };
                }

                // Формируем финальные массивы
                processedOptions = parsedOpts.map(o => o.text);
                correctIndices = parsedOpts
                    .map((o, idx) => o.isCorrect ? idx : -1)
                    .filter(idx => idx !== -1);

            } else {
                // Фолбэк если парсинг сломался
                processedOptions = ["Подозрительная ссылка", "Срочность", "Ошибки", "Просьба данных"];
                correctIndices = [0, 1];
            }
        }

        return {
            content: content,
            analysis: analysis,
            isPhishing: isPhishing,
            options: processedOptions,
            correctIndices: correctIndices,
            platform: platformName
        };
    }

    displayEmailData(data) {
        localStorage.setItem('phishing_active_session', JSON.stringify({ ...data, isCompleted: false }));

        this.currentEmail = data;
        const emailDisplay = document.getElementById('emailContent');
        emailDisplay.innerHTML = '';

        const platformBadge = document.createElement('div');
        let badgeColor = '#666'; let badgeIcon = '📩';
        const p = (data.platform || 'Email').toLowerCase();

        if (p.includes('telegram')) { badgeColor = '#24A1DE'; badgeIcon = '✈️'; }
        else if (p.includes('whatsapp')) { badgeColor = '#25D366'; badgeIcon = '💬'; }
        else if (p.includes('sms')) { badgeColor = '#34C759'; badgeIcon = '📱'; }
        else if (p.includes('slack') || p.includes('битрикс')) { badgeColor = '#00ADEF'; badgeIcon = '🏢'; }
        else if (p.includes('авито')) { badgeColor = '#FF6163'; badgeIcon = '🏷️'; }
        else if (p.includes('vk') || p.includes('вконтакте')) { badgeColor = '#0077FF'; badgeIcon = '🔵'; }
        else if (p.includes('email')) { badgeColor = '#EA4335'; badgeIcon = '📧'; }

        platformBadge.style.cssText = `display: inline-block; background-color: ${badgeColor}; color: white; padding: 5px 12px; border-radius: 15px; font-size: 0.9rem; font-weight: bold; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);`;
        platformBadge.innerHTML = `${badgeIcon} ${data.platform || 'Email'}`;
        emailDisplay.appendChild(platformBadge);

        const emailText = document.createElement('div');
        emailText.style.cssText = 'line-height: 1.6; font-family: Arial, sans-serif; white-space: pre-wrap; word-wrap: break-word; font-size: 16px;';
        emailText.innerHTML = this.parseMarkdown(data.content);
        emailDisplay.appendChild(emailText);
        
        this.showMainLoader(false);
        document.getElementById('emailSection').style.display = 'block';
        document.getElementById('analysisResult').style.display = 'none';
        document.getElementById('reasonSelector').style.display = 'none';
        document.getElementById('confirmReasonBtn').style.display = 'block';
        
        const phishingBtn = document.getElementById('phishingBtn');
        const legitimateBtn = document.getElementById('legitimateBtn');
        phishingBtn.disabled = false; legitimateBtn.disabled = false;
        phishingBtn.style.opacity = '1'; legitimateBtn.style.opacity = '1';

        if (window.innerWidth < 768) document.querySelector('.detector-header').scrollIntoView({ behavior: 'smooth' });
    }

    handleLegitimateSelection() {
        document.getElementById('phishingBtn').disabled = true;
        document.getElementById('legitimateBtn').disabled = true;
        if (this.currentEmail.isPhishing) this.finalizeResult(false, 'Это <strong>ФИШИНГ</strong>.', true);
        else this.finalizeResult(true, 'Верно! Это легитимное сообщение.', true);
    }

    handlePhishingSelection() {
        document.getElementById('phishingBtn').disabled = true;
        document.getElementById('legitimateBtn').disabled = true;
        document.getElementById('legitimateBtn').style.opacity = '0.5';
        if (!this.currentEmail.isPhishing) this.finalizeResult(false, 'Это <strong>БЕЗОПАСНОЕ</strong> сообщение.', true);
        else this.showReasonSelector();
    }

    showReasonSelector() {
        const selector = document.getElementById('reasonSelector');
        const optionsContainer = document.getElementById('reasonOptions');
        const confirmBtn = document.getElementById('confirmReasonBtn');
        selector.querySelector('h3').innerHTML = "Выберите <u>ВСЕ</u> признаки обмана:";

        optionsContainer.innerHTML = '';
        confirmBtn.disabled = true;
        this.selectedReasonIndices.clear();

        let displayOptions = this.currentEmail.options;
        if (!displayOptions || displayOptions.length === 0) {
            displayOptions = ["Подозрительность", "Срочность"];
            this.currentEmail.correctIndices = [0];
        }

        displayOptions.forEach((opt, index) => {
            const div = document.createElement('div');
            div.className = 'reason-option';
            div.textContent = opt; 
            div.onclick = () => {
                if (div.classList.contains('locked')) return;
                if (this.selectedReasonIndices.has(index)) {
                    this.selectedReasonIndices.delete(index);
                    div.classList.remove('selected');
                } else {
                    this.selectedReasonIndices.add(index);
                    div.classList.add('selected');
                }
                confirmBtn.disabled = this.selectedReasonIndices.size === 0;
            };
            optionsContainer.appendChild(div);
        });

        selector.className = 'reason-selector show';
        selector.style.display = 'block';
        selector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    submitPhishingReason() {
        document.getElementById('confirmReasonBtn').style.display = 'none';
        const correctSet = new Set(this.currentEmail.correctIndices);
        const userSet = this.selectedReasonIndices;
        let mistakes = false, missed = false;

        Array.from(document.getElementById('reasonOptions').children).forEach((div, i) => {
            div.classList.add('locked');
            if (correctSet.has(i)) {
                div.classList.add('correct-answer');
                if (!userSet.has(i)) {
                    div.style.border = "2px dashed #28a745";
                    div.innerHTML += " <span style='font-size:0.8em'>(пропущено)</span>";
                    missed = true;
                }
            }
            if (userSet.has(i) && !correctSet.has(i)) {
                div.classList.add('wrong-choice');
                mistakes = true;
            }
        });
        
        let title = mistakes ? "Ошибка: вы выбрали признак, которого нет в тексте." : (missed ? "Неплохо, но есть пропуски." : "Идеально! Все верно.");
        this.finalizeResult(!mistakes, title, true);
    }

    finalizeResult(isSuccess, title, showAnalysis) {
        localStorage.removeItem('phishing_active_session');

        this.stats.total++;
        if (isSuccess) this.stats.correct++;
        this.saveStats();
        this.updateStatsUI();

        const resDiv = document.getElementById('analysisResult');
        const contentDiv = document.getElementById('resultAnalysis');
        
        document.getElementById('resultTitle').innerHTML = (isSuccess ? '✓ ' : '✗ ') + title;
        resDiv.className = `analysis-result show ${isSuccess ? 'result-correct' : 'result-incorrect'}`;
        
        contentDiv.innerHTML = showAnalysis ? 
            `<div style="border-top:1px solid rgba(0,0,0,0.1);padding-top:10px;">
                <strong>Подробный разбор:</strong><br>
                ${this.parseMarkdown(this.currentEmail.analysis)}
             </div>` : "";
        
        resDiv.style.display = 'block';
        setTimeout(() => resDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }

    parseMarkdown(text) {
        if (!text) return '';
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                   .replace(/__(.*?)__/g, '<strong>$1</strong>')
                   .replace(/\n/g, '<br>');
    }

    updateStatsUI() {
        const t = this.stats.total;
        const c = this.stats.correct;
        document.getElementById('correctCount').textContent = c;
        document.getElementById('totalCount').textContent = t;
        document.getElementById('percentCount').textContent = (t > 0 ? Math.round((c/t)*100) : 0) + '%';
    }

    showMainLoader(show) {
        document.getElementById('initialLoader').style.display = show ? 'flex' : 'none';
    }

    handleError(e) {
        console.error(e);
        this.showMainLoader(false);
        setTimeout(() => this.processNextEmail(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => new PhishingDetector());