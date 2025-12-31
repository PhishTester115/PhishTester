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
        this.MAX_HISTORY = 20; 

        this.scenariosBank = [
            // --- КОРПОРАТИВНЫЕ / РАБОЧИЕ ПРОЦЕССЫ ---
            { platform: "Email (Corp)", sender: "Microsoft 365", topic: "Действие пароля истекает сегодня. Сохраните текущий пароль", type: "login" },
            { platform: "Email (Corp)", sender: "Kyocera Scanner", topic: "Scan from KM-4050: Doc_2025.pdf", type: "attachment" },
            { platform: "Email (Corp)", sender: "IT-Helpdesk", topic: "Плановое обновление VPN-клиента. Скачайте инструкцию", type: "attachment" },
            { platform: "Email (Corp)", sender: "SharePoint", topic: "Вам предоставлен доступ к файлу 'Бонусы_Отдел_Продаж.xlsx'", type: "link" },
            { platform: "Email (Corp)", sender: "HR-Portal", topic: "Требуется подпись: Изменения в трудовом распорядке", type: "link" },
            { platform: "Teams/Slack", sender: "Admin", topic: "Мы обнаружили подозрительную активность в вашей учетной записи", type: "login" },
            { platform: "Email (Corp)", sender: "Zoom", topic: "Вы пропустили запланированную конференцию с руководством", type: "link" },
            { platform: "Email (Corp)", sender: "Битрикс24", topic: "Новая задача: Сверка контрагентов (Срочно)", type: "link" },
            { platform: "Email (Corp)", sender: "Гендиректор", topic: "Отправляю реквизиты для договора, посмотри срочно, я с телефона", type: "attachment" },
            { platform: "Email (Corp)", sender: "DLP System", topic: "Уведомление о нарушении политики безопасности (Инцидент #492)", type: "link" },

            // --- СЕРВИСЫ И АККАУНТЫ ---
            { platform: "SMS", sender: "Gosuslugi", topic: "Ваша учетная запись заблокирована из-за подозрительной активности", type: "login" },
            { platform: "Telegram", sender: "Telegram Support", topic: "Ваш аккаунт будет удален через 24 часа. Отмените заявку", type: "login" },
            { platform: "Email", sender: "Yandex ID", topic: "Вход в аккаунт с нового устройства (Linux, Netherlands)", type: "login" },
            { platform: "Email", sender: "Google Photos", topic: "Ваше хранилище заполнено. Фотографии будут удалены завтра", type: "data" },
            { platform: "WhatsApp", sender: "Менеджер МТС/Билайн", topic: "Истекает срок действия договора на номер. Продлите через Госуслуги", type: "code" },
            { platform: "Email", sender: "Apple ID", topic: "Ваш Apple ID был использован для покупки (iPhone 15 Pro). Отменить?", type: "scam_link" },
            { platform: "Email", sender: "Кинопоиск/Netflix", topic: "Проблема с продлением подписки. Обновите способ оплаты", type: "data" },

            // --- СОЦИАЛЬНАЯ ИНЖЕНЕРИЯ ---
            { platform: "WhatsApp", sender: "Неизвестный", topic: "Привет! Слушай, нашел твои фотки на этом сайте, это жесть...", type: "link" },
            { platform: "Telegram", sender: "HR (Рекрутер)", topic: "Рассматриваем ваше резюме на HeadHunter. Посмотрите описание вакансии", type: "attachment" },
            { platform: "Email", sender: "СДЭК/Почта", topic: "Не удалось доставить посылку. Адрес указан неверно", type: "link" },
            { platform: "SMS", sender: "Суд.Приставы", topic: "Возбуждено исполнительное производство №99231. Ссылка на дело", type: "link" },
            { platform: "ВКонтакте", sender: "Администрация", topic: "На вашу страницу поступило много жалоб. Проверьте статус", type: "login" },
            
            // --- РЕДКИЕ ДЕНЕЖНЫЕ ---
            { platform: "Email", sender: "ФНС (Налоги)", topic: "Вам начислен налоговый вычет (возврат средств)", type: "scam_link" },
            { platform: "Авито", sender: "Покупатель", topic: "У меня не проходит оплата доставки, техподдержка скинула ссылку на возврат", type: "scam_link" }
        ];

        this.init();
    }

    init() {
        this.loadStats();
        this.updateStatsUI();
        this.initializeEventListeners();
        
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
        // Добавляем небольшую задержку между добавлением задач, чтобы не спамить
        let delay = 0;
        while (this.emailQueue.length < this.queueSize) {
            const promise = new Promise(resolve => setTimeout(resolve, delay))
                .then(() => this.fetchEmailData());
                
            // Обработка ошибок внутри очереди, чтобы она не "застревала"
            const safePromise = promise.catch(err => {
                console.warn("Фоновая загрузка не удалась:", err);
                return null;
            });
            
            this.emailQueue.push(safePromise);
            delay += 1000; // Разносим запросы на 1 секунду друг от друга
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

    // --- ОБНОВЛЕННАЯ ФУНКЦИЯ С RETRY LOGIC (ИСПРАВЛЕНИЕ 429) ---
    async fetchEmailData(retryCount = 0) {
        // Если это повторная попытка, ждем с экспоненциальной задержкой
        if (retryCount > 0) {
            const waitTime = 2000 * retryCount; // 2с, 4с, 6с...
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const emailType = Math.random() < 0.6 ? 1 : 0; 
        const scenario = this.getUniqueScenario();
        const sophistication = "High"; 
        
        const contextInstruction = `
            ГЕНЕРАЦИЯ: Используй контекст РФ.
            ВАЖНО: Пиши текст ГРАМОТНО. Не используй опечатки как признак.
            ЗАПРЕЩЕНО: Упоминать "2025 год" или "промпт" в анализе.
        `;

        const commonInstruction = `
            ТРЕБОВАНИЯ К ТЕКСТУ:
            1. В самом начале ОБЯЗАТЕЛЬНО напиши две строчки:
               От кого: [Придумай Email или Номер]
               Тема: [Тема сообщения]
            2. Только потом пиши тело сообщения.
            3. Если это фишинг и ты хочешь указать на "подозрительный адрес", ты ОБЯЗАН написать этот подозрительный адрес в строке "От кого".
            4. После текста добавь ###АНАЛИЗ###.
        `;

        const phishingInstruction = `
            5. После анализа добавь раздел ###TRUE_LIST###.
            Напиши 3 реальных признака фишинга, которые ЕСТЬ в тексте (например, "Странный домен в поле От кого", "Скрытая ссылка").
            
            6. После этого добавь раздел ###FALSE_LIST###.
            Напиши 3 выдуманных признака, которых НЕТ в тексте.
        `;

        let prompt;
        if (emailType === 1) {
            let nuance = "";
            if (scenario.type === "login") nuance = "Цель: украсть пароль.";
            if (scenario.type === "attachment") nuance = "Цель: заставить скачать вредоносный файл.";
            if (scenario.type === "link") nuance = "Цель: переход по ссылке.";
            if (scenario.type === "data") nuance = "Цель: сбор данных.";
            if (scenario.type === "scam_link") nuance = "Цель: ввод данных карты.";
            if (scenario.type === "code") nuance = "Цель: украсть код из смс.";
            
            prompt = `
                РОЛЬ: Профессиональный хакер.
                СЦЕНАРИЙ: ${scenario.topic}
                ПЛАТФОРМА: ${scenario.platform}
                ОТПРАВИТЕЛЬ: ${scenario.sender}
                СЛОЖНОСТЬ: ${sophistication}
                ${nuance}
                
                ${contextInstruction}
                ${commonInstruction}
                ${phishingInstruction}
                
                ИНСТРУКЦИЯ ДЛЯ АНАЛИЗА (ФИШИНГ):
                Напиши подробный разбор.
                🚩 **Что выдает подделку:** (разбери адрес отправителя, который ты придумал, ссылки).
                🧠 **Психология:** (давление на эмоции).
                🛡️ **Совет:** (как проверить).
            `;
        } else {
            prompt = `
                РОЛЬ: Официальный представитель сервиса.
                ЗАДАЧА: Безопасное сообщение (НЕ фишинг).
                СЦЕНАРИЙ: ${scenario.topic}
                ПЛАТФОРМА: ${scenario.platform}
                
                ${contextInstruction}
                ${commonInstruction}
                
                ИНСТРУКЦИЯ ДЛЯ АНАЛИЗА (ЛЕГИТИМ):
                Объясни, почему это сообщение безопасно.
                ✅ **Признаки подлинности:** (правильный домен в поле "От кого", отсутствие ссылок).
            `;
        }

        const randomId = Math.random().toString(36).substring(7);
        const finalPrompt = `${prompt}\n(Unique ID: ${randomId})`;

        try {
            const response = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'deepseek-reasoning',
                    messages: [
                        { role: 'system', content: 'Ты эксперт. Всегда пиши заголовок "От кого:" в начале сообщения.' },
                        { role: 'user', content: finalPrompt }
                    ],
                    referrer: 'https://g4f.dev/'
                })
            });

            // ОБРАБОТКА ОШИБКИ 429
            if (response.status === 429) {
                console.warn(`Rate limit hit (429). Retry attempt ${retryCount + 1}...`);
                if (retryCount < 3) { // Максимум 3 повтора
                    return this.fetchEmailData(retryCount + 1);
                } else {
                    throw new Error('Server busy (429). Try again later.');
                }
            }

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();
            
            if (data.choices && data.choices[0]) {
                const fullText = data.choices[0].message.content;
                return this.parseResponse(fullText, emailType === 1, scenario.platform);
            } else {
                throw new Error('API Error');
            }
        } catch (err) {
            console.error("Fetch error:", err);
            // Если ошибка сети, тоже можно попробовать разок повторить
            if (retryCount < 1) return this.fetchEmailData(retryCount + 1);
            throw err;
        }
    }

    parseResponse(text, isPhishing, platformName) {
        let content = text;
        
        [/Support Pollinations[\s\S]*$/i, /🌸 Ad[\s\S]*$/i, /Powered by[\s\S]*$/i].forEach(r => content = content.replace(r, ''));
        content = content.trim();

        let analysis = "Анализ отсутствует.";
        let processedOptions = [];
        let correctIndices = [];

        const analysisMatch = content.split(/###\s*(?:АНАЛИЗ|ANALYSIS)\s*###/i);
        if (analysisMatch.length > 1) {
            content = analysisMatch[0].trim();
            let analysisAndLists = analysisMatch[1].trim();
            
            if (isPhishing) {
                const trueSplit = analysisAndLists.split(/###\s*TRUE_LIST\s*###/i);
                
                if (trueSplit.length > 1) {
                    analysis = trueSplit[0].trim();
                    const listsPart = trueSplit[1];
                    const falseSplit = listsPart.split(/###\s*FALSE_LIST\s*###/i);
                    
                    const clean = i => i.replace(/^[\d\-\*\.]+\s*/, '').trim();
                    
                    let trueItems = falseSplit[0].trim().split('\n').map(clean).filter(i => i.length > 0);
                    let falseItems = [];
                    if (falseSplit.length > 1) {
                        falseItems = falseSplit[1].trim().split('\n').map(clean).filter(i => i.length > 0);
                    }

                    let combined = [];
                    trueItems.forEach(t => combined.push({text: t, isCorrect: true}));
                    falseItems.forEach(f => combined.push({text: f, isCorrect: false}));
                    
                    combined.sort(() => Math.random() - 0.5);
                    
                    if (combined.length === 0) combined.push({text: "Подозрительное содержание", isCorrect: true});

                    processedOptions = combined.map(o => o.text);
                    correctIndices = combined.map((o, i) => o.isCorrect ? i : -1).filter(i=>i!==-1);
                } else {
                    analysis = analysisAndLists;
                    processedOptions = ["Подозрительная ссылка", "Срочность", "Запрос данных"];
                    correctIndices = [0, 1];
                }
            } else {
                analysis = analysisAndLists;
                processedOptions = ["Подозрительно"]; 
                correctIndices = [0];
            }
        } else {
            if (isPhishing) {
                processedOptions = ["Подозрительная ссылка", "Срочность"];
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
        
        let title = mistakes ? "Ошибка: выбран неверный признак." : (missed ? "Неплохо, но есть пропуски." : "Идеально! Все верно.");
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