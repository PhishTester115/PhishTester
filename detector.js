class PhishingDetector {
    constructor() {
        this.currentEmail = null;
        this.selectedReasonIndices = new Set();
        this.stats = {
            correct: 0,
            total: 0
        };
        
        this.emailQueue = []; 
        this.queueSize = 3; 

        const commonInstruction = `
            ТРЕБОВАНИЯ:
            1. Письмо должно быть детализированным (минимум 100-150 слов), с подписью.
            2. После письма добавь ###АНАЛИЗ###.
            3. После анализа добавь ###OPTIONS###. Создай 5-6 вариантов ответа (признаков), разделенных символом '|'. 
               Смешай РЕАЛЬНЫЕ признаки (которые есть в тексте) и ЛОЖНЫЕ.
            4. Добавь ###ANSWER### и перечисли через запятую индексы (0-5) ВСЕХ вариантов, которые являются ПРАВДОЙ.
        `;

        this.scenarios = [
            {
                name: "Банковское мошенничество",
                prompt: `Сценарий: Сложное письмо от банка о "блокировке перевода". ${commonInstruction}`
            },
            {
                name: "Корпоративный HR",
                prompt: `Сценарий: Письмо от HR-директора о "новом графике". ${commonInstruction}`
            },
            {
                name: "Облачное хранилище",
                prompt: `Сценарий: Google Drive/Dropbox. "Хранилище заполнено". ${commonInstruction}`
            },
            {
                name: "Неоплаченный счет",
                prompt: `Сценарий: Сервис подписки. "Неудачное списание средств". ${commonInstruction}`
            },
            {
                name: "Документы на подпись",
                prompt: `Сценарий: DocuSign. "Вам отправлен документ". ${commonInstruction}`
            },
            {
                name: "Госуслуги/Налоги",
                prompt: `Сценарий: Уведомление о задолженности. ${commonInstruction}`
            }
        ];

        this.init();
    }

    init() {
        this.loadStats();
        this.updateStatsUI();
        this.initializeEventListeners();
        
        const preloadedJson = localStorage.getItem('preloaded_email');
        
        if (preloadedJson) {
            try {
                const data = JSON.parse(preloadedJson);
                localStorage.removeItem('preloaded_email');
                
                if (!data.content || (data.isPhishing && (!data.options || data.options.length === 0))) {
                    throw new Error("Некорректные данные");
                }
                
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
        if (savedStats) {
            try {
                this.stats = JSON.parse(savedStats);
            } catch (e) {
                this.stats = { correct: 0, total: 0 };
            }
        }
    }

    saveStats() {
        localStorage.setItem('phishing_detector_stats', JSON.stringify(this.stats));
    }
    
    resetStats() {
        if(confirm('Вы уверены, что хотите сбросить статистику?')) {
            this.stats = { correct: 0, total: 0 };
            this.saveStats();
            this.updateStatsUI();
        }
    }

    initializeEventListeners() {
        document.getElementById('phishingBtn').addEventListener('click', () => this.handlePhishingSelection());
        document.getElementById('legitimateBtn').addEventListener('click', () => this.handleLegitimateSelection());
        document.getElementById('confirmReasonBtn').addEventListener('click', () => this.submitPhishingReason());
        document.getElementById('nextBtn').addEventListener('click', () => this.processNextEmail());
        
        const resetBtn = document.getElementById('resetStatsBtn');
        if(resetBtn) {
            resetBtn.addEventListener('click', () => this.resetStats());
        }
    }

    refillQueue() {
        while (this.emailQueue.length < this.queueSize) {
            const emailPromise = this.fetchEmailData();
            this.emailQueue.push(emailPromise);
        }
    }

    async processNextEmail() {
        document.getElementById('emailSection').style.display = 'none';
        this.currentEmail = null;
        this.selectedReasonIndices.clear();
        this.showMainLoader(true);

        try {
            if (this.emailQueue.length === 0) {
                this.refillQueue();
            }

            const nextEmailPromise = this.emailQueue.shift();
            this.refillQueue();

            const data = await nextEmailPromise;
            this.displayEmailData(data);

        } catch (error) {
            this.handleError(error);
        }
    }

    generateId() {
        return Math.random().toString(36).substring(2, 15);
    }

    getRandomEmailType() {
        return Math.random() < 0.65 ? 1 : 0;
    }

    async fetchEmailData() {
        const emailType = this.getRandomEmailType();
        let prompt;

        if (emailType === 1) {
            const scenario = this.scenarios[Math.floor(Math.random() * this.scenarios.length)];
            prompt = scenario.prompt;
        } else {
            prompt = `Задача: Создай ДЕТАЛИЗИРОВАННОЕ, длинное, полностью ЛЕГИТИМНОЕ деловое письмо (НЕ фишинг). 
            Сценарий: Подтверждение заказа, ответ от коллеги, или рассылка.
            СТРУКТУРА ОТВЕТА СТРОГО ТАКАЯ: [Текст письма] ###АНАЛИЗ### [Текст анализа почему это безопасно]`;
        }

        const randomId = this.generateId();
        const finalPrompt = `${prompt}\n(Ignore ID: ${randomId})`;

        const response = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-reasoning',
                messages: [
                    {
                        role: 'system',
                        content: 'Ты эксперт по кибербезопасности.'
                    },
                    { role: 'user', content: finalPrompt }
                ],
                referrer: 'https://g4f.dev/'
            })
        });

        if (!response.ok) throw new Error('Ошибка сети');
        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            const fullText = data.choices[0].message.content;
            return this.parseResponse(fullText, emailType === 1);
        } else {
            throw new Error('Некорректный ответ API');
        }
    }

    // --- ФУНКЦИЯ ПАРСИНГА С УДАЛЕНИЕМ РЕКЛАМЫ ---
    parseResponse(text, isPhishing) {
        let content = text;
        
        // 1. УДАЛЕНИЕ РЕКЛАМЫ POLLINATIONS
        // Удаляем всё, начиная с фраз-маркеров рекламы до конца строки
        const adPatterns = [
            /Support Pollinations\.AI[\s\S]*$/i,
            /🌸 Ad 🌸[\s\S]*$/i,
            /Powered by Pollinations\.AI[\s\S]*$/i
        ];
        
        adPatterns.forEach(regex => {
            content = content.replace(regex, '');
        });
        
        content = content.trim();

        let analysis = "Анализ отсутствует.";
        let options = [];
        let correctIndices = [];

        const answerRegex = /###\s*ANSWER\s*###/i;
        const optionsRegex = /###\s*OPTIONS\s*###/i;
        const analysisRegex = /###\s*(?:АНАЛИЗ|ANALYSIS)\s*###/i;

        // 2. Извлекаем ###ANSWER###
        if (answerRegex.test(content)) {
            const parts = content.split(answerRegex);
            const answerPart = parts[1].trim(); 
            
            const matches = answerPart.match(/\d+/g);
            if (matches) {
                correctIndices = matches.map(n => parseInt(n));
            }
            content = parts[0]; 
        }

        // 3. Извлекаем ###OPTIONS###
        if (optionsRegex.test(content)) {
            const parts = content.split(optionsRegex);
            const optionsPart = parts[1].trim();
            
            options = optionsPart.split('|')
                .map(o => o.trim())
                .filter(o => o.length > 0);
            
            content = parts[0]; 
        }

        // 4. Извлекаем ###АНАЛИЗ###
        if (analysisRegex.test(content)) {
            const parts = content.split(analysisRegex);
            analysis = parts[1].trim();
            content = parts[0]; 
        }

        content = content.trim();
        
        if (isPhishing && options.length === 0) {
            options = ["Подозрительный отправитель", "Срочность", "Ошибки", "Просьба данных"];
            correctIndices = [0, 1];
        }

        return {
            content: content,
            analysis: analysis,
            isPhishing: isPhishing,
            options: options,
            correctIndices: correctIndices
        };
    }

    displayEmailData(data) {
        this.currentEmail = data;
        
        const emailDisplay = document.getElementById('emailContent');
        emailDisplay.innerHTML = '';

        const emailText = document.createElement('div');
        emailText.style.lineHeight = '1.6';
        emailText.style.fontFamily = 'Arial, sans-serif';
        emailText.style.whiteSpace = 'pre-wrap';
        emailText.style.wordWrap = 'break-word';
        emailText.style.fontSize = '15px'; 
        emailText.innerHTML = this.parseMarkdown(data.content);
        emailDisplay.appendChild(emailText);
        
        this.showMainLoader(false);
        document.getElementById('emailSection').style.display = 'block';
        
        document.getElementById('analysisResult').classList.remove('show');
        document.getElementById('analysisResult').style.display = 'none';
        document.getElementById('reasonSelector').classList.remove('show');
        document.getElementById('reasonSelector').style.display = 'none';
        document.getElementById('confirmReasonBtn').style.display = 'block';
        
        const phishingBtn = document.getElementById('phishingBtn');
        const legitimateBtn = document.getElementById('legitimateBtn');
        phishingBtn.disabled = false;
        legitimateBtn.disabled = false;
        phishingBtn.style.opacity = '1';
        legitimateBtn.style.opacity = '1';

        if (window.innerWidth < 768) {
            document.querySelector('.detector-header').scrollIntoView({ behavior: 'smooth' });
        }
    }

    handleLegitimateSelection() {
        document.getElementById('phishingBtn').disabled = true;
        document.getElementById('legitimateBtn').disabled = true;

        if (this.currentEmail.isPhishing) {
            // ИСПРАВЛЕНО: true в конце означает "Показать анализ"
            this.finalizeResult(false, 'Вы посчитали это письмо нормальным, но это <strong>ФИШИНГ</strong>.', true);
        } else {
            // Верно легитимное - показываем анализ (почему это безопасно)
            this.finalizeResult(true, 'Верно! Это легитимное письмо.', true);
        }
    }

    handlePhishingSelection() {
        document.getElementById('phishingBtn').disabled = true;
        document.getElementById('legitimateBtn').disabled = true;
        document.getElementById('legitimateBtn').style.opacity = '0.5';

        if (!this.currentEmail.isPhishing) {
            // ИСПРАВЛЕНО: Показываем анализ, чтобы пользователь понял, почему это НЕ фишинг
            this.finalizeResult(false, 'Вы перестраховались. Это на самом деле <strong>ЛЕГИТИМНОЕ</strong> письмо.', true);
        } else {
            this.showReasonSelector();
        }
    }

    showReasonSelector() {
        const selector = document.getElementById('reasonSelector');
        const optionsContainer = document.getElementById('reasonOptions');
        const confirmBtn = document.getElementById('confirmReasonBtn');
        const title = selector.querySelector('h3');
        
        title.innerHTML = "Выберите <u>ВСЕ</u> подозрительные признаки:<br><span style='font-size: 0.9rem; font-weight: normal; color: #666;'>(Их может быть несколько)</span>";

        optionsContainer.innerHTML = '';
        confirmBtn.disabled = true;
        this.selectedReasonIndices.clear();

        let displayOptions = this.currentEmail.options;
        if (!displayOptions || displayOptions.length === 0) {
            displayOptions = ["Подозрительная ссылка", "Срочность", "Ошибки"];
            this.currentEmail.correctIndices = [0];
        }

        displayOptions.forEach((opt, index) => {
            const div = document.createElement('div');
            div.className = 'reason-option';
            div.textContent = opt.replace(/^\d+[.)]\s*/, '').trim();
            
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

        selector.classList.add('show');
        selector.style.display = 'block';
        selector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    submitPhishingReason() {
        document.getElementById('confirmReasonBtn').style.display = 'none';

        const correctSet = new Set(this.currentEmail.correctIndices);
        const userSet = this.selectedReasonIndices;
        
        let mistakesMade = false;
        let missedCorrect = false;

        const optionsDivs = document.getElementById('reasonOptions').children;
        
        for (let i = 0; i < optionsDivs.length; i++) {
            const div = optionsDivs[i];
            div.classList.add('locked');

            const isCorrect = correctSet.has(i);
            const isSelected = userSet.has(i);

            if (isCorrect) {
                div.classList.add('correct-answer');
                if (!isSelected) {
                    div.style.border = "2px dashed #28a745";
                    div.innerHTML += " <span style='font-size:0.8em'>(пропущено)</span>";
                    missedCorrect = true;
                }
            }
            
            if (isSelected && !isCorrect) {
                div.classList.add('wrong-choice');
                mistakesMade = true;
            }
        }
        
        let resultTitle = "";
        let isSuccess = false;

        if (mistakesMade) {
            resultTitle = "Ошибка: Вы выбрали несуществующие признаки.";
            isSuccess = false;
        } else if (missedCorrect) {
            resultTitle = "Неплохо! Вы нашли главные признаки, но некоторые упустили.";
            isSuccess = true; 
        } else {
            resultTitle = "Идеально! Вы нашли абсолютно все признаки фишинга.";
            isSuccess = true;
        }

        this.finalizeResult(isSuccess, resultTitle, true);
    }

    finalizeResult(isSuccess, messageTitle, showAnalysis) {
        this.stats.total++;
        if (isSuccess) this.stats.correct++;
        
        this.saveStats();
        this.updateStatsUI();

        const resultDiv = document.getElementById('analysisResult');
        const titleDiv = document.getElementById('resultTitle');
        const analysisDiv = document.getElementById('resultAnalysis');

        if (isSuccess) {
            resultDiv.className = 'analysis-result show result-correct';
            titleDiv.innerHTML = '✓ ' + (messageTitle || 'Отлично!');
        } else {
            resultDiv.className = 'analysis-result show result-incorrect';
            titleDiv.innerHTML = '✗ ' + (messageTitle || 'Ошибка');
        }

        if (showAnalysis) {
             const formattedAnalysis = this.parseMarkdown(this.currentEmail.analysis);
             analysisDiv.innerHTML = `
                <div style="border-top: 1px solid rgba(0,0,0,0.1); padding-top: 10px;">
                    <strong>Анализ эксперта:</strong><br>
                    ${formattedAnalysis}
                </div>
            `;
        } else {
             analysisDiv.innerHTML = "";
        }

        resultDiv.style.display = 'block';
        setTimeout(() => {
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    parseMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="#" style="color:blue; text-decoration:underline; pointer-events:none;">$1</a>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    updateStatsUI() {
        const total = this.stats.total;
        const correct = this.stats.correct;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        document.getElementById('correctCount').textContent = correct;
        document.getElementById('totalCount').textContent = total;
        document.getElementById('percentCount').textContent = percent + '%';
    }

    showMainLoader(show) {
        const loader = document.getElementById('initialLoader');
        if (show) loader.style.display = 'flex';
        else loader.style.display = 'none';
    }

    handleError(error) {
        console.error('Ошибка:', error);
        this.showMainLoader(false);
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = 'Ошибка загрузки. Попробуем снова...';
        errorDiv.classList.add('show');
        setTimeout(() => {
            errorDiv.classList.remove('show');
            this.processNextEmail();
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PhishingDetector();
});