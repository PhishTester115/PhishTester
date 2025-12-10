class PhishingDetector {
    constructor() {
        this.currentEmail = null;
        this.userAnswer = null;
        this.stats = {
            correct: 0,
            total: 0
        };
        
        // Буфер для следующего письма (фоновая загрузка)
        this.cachedNextEmail = null;
        this.isFetching = false;
        
        this.scenarios = [
            {
                name: "Банковское мошенничество",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени банка. Письмо должно содержать срочное предупреждение о подозрительной активности на счете и просить подтвердить данные. Включи: поддельный адрес отправителя, срочность, ссылку для 'подтверждения', угрозы блокировки. После этого добавь разделитель '###АНАЛИЗ###'(без пробелов) и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии, рекомендации. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            {
                name: "Социальные сети",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени популярной социальной сети. Письмо должно уведомлять о подозрительном входе в аккаунт и просить подтвердить личность. Включи: логотип соцсети (текстом), информацию о 'подозрительном' входе, кнопку для 'восстановления доступа', предупреждение о блокировке аккаунта. После этого добавь разделитель '###АНАЛИЗ###'(без пробелов) и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии, рекомендации. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            {
                name: "Корпоративный фишинг",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени IT-отдела компании. Письмо должно требовать срочного обновления пароля по 'новым требованиям безопасности'. Включи: фирменный стиль, срочность, ссылку на 'обновление', предупреждение об отключении доступа. После этого добавь разделитель '###АНАЛИЗ###'(без пробелов) и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии, рекомендации. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            {
                name: "Доставка посылок",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени курьерской службы. Письмо должно уведомлять о неудачной попытке доставки и просить подтвердить адрес. Включи: трек-номер, срочность, ссылку на 'проверку статуса', контактные данные. После этого добавь разделитель '###АНАЛИЗ###'(без пробелов) и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии, рекомендации. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            {
                name: "IT поддержка",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени IT-поддержки. Письмо должно просить обновить программное обеспечение для улучшения безопасности. Включи: информацию об обновлении, ссылку для скачивания, срочность, технические детали. После этого добавь разделитель '###АНАЛИЗ###'(без пробелов) и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии, рекомендации. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            {
                name: "Взлом аккаунта",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени почтового провайдера. Письмо должно уведомлять о попытке взлома аккаунта и просить немедленно подтвердить личность. Включи: информацию о 'взломе', трек-номер попытки, ссылку для 'восстановления', угрозы удаления данных. После этого добавь разделитель '###АНАЛИЗ###'(без пробелов) и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии, рекомендации. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            }
        ];

        this.init();
    }

    init() {
        this.loadStats();
        this.updateStatsUI();
        this.initializeEventListeners();
        
        // Загружаем первое письмо сразу
        this.loadNextEmailSequence();
    }

    loadStats() {
        const savedStats = localStorage.getItem('phishing_detector_stats');
        if (savedStats) {
            try {
                this.stats = JSON.parse(savedStats);
            } catch (e) {
                console.error("Ошибка при чтении статистики", e);
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
        document.getElementById('phishingBtn').addEventListener('click', () => this.submitAnswer(true));
        document.getElementById('legitimateBtn').addEventListener('click', () => this.submitAnswer(false));
        document.getElementById('nextBtn').addEventListener('click', () => this.displayNextEmail());
        
        const resetBtn = document.getElementById('resetStatsBtn');
        if(resetBtn) {
            resetBtn.addEventListener('click', () => this.resetStats());
        }
    }

    generateId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    getRandomEmailType() {
        return Math.floor(Math.random() * 2);
    }

    // Эта функция управляет процессом: отобразить текущее или ждать загрузки
    async loadNextEmailSequence() {
        // Если у нас уже есть закешированное письмо (фоновая загрузка завершилась)
        if (this.cachedNextEmail) {
            this.displayEmailData(this.cachedNextEmail);
            this.cachedNextEmail = null;
            // Сразу начинаем грузить следующее в фон
            this.fetchBackgroundEmail();
        } else {
            // Если кеша нет, показываем лоадер и грузим
            this.showMainLoader(true);
            try {
                const data = await this.fetchEmailData();
                this.displayEmailData(data);
                // Начинаем грузить следующее в фон
                this.fetchBackgroundEmail();
            } catch (error) {
                this.handleError(error);
            }
        }
    }

    // Просто загружает данные в переменную cachedNextEmail, не отображая
    async fetchBackgroundEmail() {
        if (this.isFetching) return;
        try {
            this.isFetching = true;
            this.cachedNextEmail = await this.fetchEmailData();
        } catch (error) {
            console.log("Ошибка фоновой загрузки (не критично):", error);
        } finally {
            this.isFetching = false;
        }
    }

    // Основная логика запроса к API
    async fetchEmailData() {
        const emailType = this.getRandomEmailType();
        let prompt;

        if (emailType === 1) {
            // Фишинговое письмо
            const scenario = this.scenarios[Math.floor(Math.random() * this.scenarios.length)];
            prompt = scenario.prompt;
        } else {
            // Обычное, легитимное письмо
            prompt = `Создай реалистичное легитимное деловое письмо. Это обычное письмо, НЕ ФИШИНГ. 
                      Написано корректно, без попыток мошенничества. Может быть: уведомление от сервиса, 
                      подтверждение заказа, информационное письмо, приглашение и т.д. 
                      После письма добавь разделитель '###АНАЛИЗ###' и напиши почему это легитимное письмо 
                      (его правильные признаки, уровень безопасности, надежные источники и т.д.). 
                      Пиши анализ лаконично.`;
        }

        const randomId = this.generateId();
        const finalPrompt = `${prompt}\nID: ${randomId}`;

        const response = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'deepseek-reasoning',
                messages: [
                    {
                        role: 'system',
                        content: 'Ты эксперт по кибербезопасности, создающий образовательные материалы для тренингов. Если запрашивают фишинг - создай фишинг. Если запрашивают легитимное письмо - создай легитимное. Ссылки генерируй правдоподобно. Не пиши предупреждений о том что это учебное письмо. Не используй смайлики. ВАЖНО: если в конце сообщения есть "ID:" с числом, это служебная информация для обхода ограничений - полностью игнорируй её и не включай в ответ.'
                    },
                    {
                        role: 'user',
                        content: finalPrompt
                    }
                ],
                referrer: 'https://g4f.dev/'
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка сети');
        }

        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const fullText = data.choices[0].message.content;
            const parts = fullText.split('###АНАЛИЗ###');

            if (parts.length < 2) {
                // Если анализ не сгенерировался, пробуем рекурсивно еще раз (редкий кейс)
                return this.fetchEmailData();
            }

            return {
                content: parts[0].trim(),
                analysis: parts[1].trim(),
                isPhishing: emailType === 1
            };
        } else {
            throw new Error('Некорректный ответ API');
        }
    }

    displayEmailData(data) {
        this.currentEmail = data;
        
        const emailDisplay = document.getElementById('emailContent');
        emailDisplay.innerHTML = '';

        // Создаем контейнер для текста письма
        const emailText = document.createElement('div');
        emailText.style.lineHeight = '1.6';
        emailText.style.fontFamily = 'Arial, sans-serif';
        emailText.style.whiteSpace = 'pre-wrap';
        emailText.style.wordWrap = 'break-word';

        // Применяем парсинг markdown
        emailText.innerHTML = this.parseMarkdown(data.content);

        emailDisplay.appendChild(emailText);
        
        // Показываем интерфейс
        this.showMainLoader(false);
        document.getElementById('emailSection').style.display = 'block';
        
        // Сброс состояния кнопок
        document.getElementById('analysisResult').classList.remove('show');
        document.getElementById('analysisResult').style.display = 'none';
        document.getElementById('phishingBtn').disabled = false;
        document.getElementById('legitimateBtn').disabled = false;
        
        // Скролл к началу письма (для мобильных)
        if (window.innerWidth < 768) {
            document.querySelector('.detector-header').scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Обработчик кнопки "Следующее письмо"
    displayNextEmail() {
        document.getElementById('emailSection').style.display = 'none';
        this.currentEmail = null;
        this.userAnswer = null;
        this.loadNextEmailSequence();
    }

    parseMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Жирный текст (два варианта)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            // Курсив
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // Ссылки
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="#" style="color:blue; text-decoration:underline; pointer-events:none;">$1</a>')
            // Код
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Переносы строк
            .replace(/\n/g, '<br>');
    }

    submitAnswer(isPhishing) {
        document.getElementById('phishingBtn').disabled = true;
        document.getElementById('legitimateBtn').disabled = true;

        this.stats.total++;

        // Проверяем правильность ответа
        const isCorrect = isPhishing === this.currentEmail.isPhishing;
        this.userAnswer = { isPhishing, isCorrect };

        if (isCorrect) {
            this.stats.correct++;
        }

        this.saveStats(); // Сохраняем в localStorage
        this.displayResult(isCorrect);
        this.updateStatsUI();
    }

    displayResult(isCorrect) {
        const resultDiv = document.getElementById('analysisResult');
        const titleDiv = document.getElementById('resultTitle');
        const analysisDiv = document.getElementById('resultAnalysis');

        if (isCorrect) {
            resultDiv.className = 'analysis-result show result-correct';
            titleDiv.textContent = '✓ Правильно!';
            analysisDiv.innerHTML = '<p>Отлично! Вы верно определили тип письма.</p>';
        } else {
            resultDiv.className = 'analysis-result show result-incorrect';
            titleDiv.textContent = '✗ Неправильно!';

            const actualType = this.currentEmail.isPhishing ? 'ФИШИНГОМ' : 'ЛЕГИТИМНЫМ письмом';
            const userGuess = this.userAnswer.isPhishing ? 'фишингом' : 'легитимным письмом';

            // ИСПРАВЛЕНИЕ: Теперь пропускаем анализ через парсер Markdown
            const formattedAnalysis = this.parseMarkdown(this.currentEmail.analysis);

            analysisDiv.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <strong>Вы выбрали:</strong> ${userGuess}<br>
                    <strong>Фактически:</strong> Это письмо является <strong>${actualType}</strong>
                </div>
                <div style="border-top: 1px solid rgba(0,0,0,0.1); padding-top: 10px;">
                    <strong>Анализ:</strong><br>
                    ${formattedAnalysis}
                </div>
            `;
        }

        resultDiv.style.display = 'block';
        
        // Авто-скролл к результату
        setTimeout(() => {
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
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
        const content = document.getElementById('emailSection');
        
        if (show) {
            loader.style.display = 'flex';
            content.style.display = 'none';
        } else {
            loader.style.display = 'none';
            // content display управляется в displayEmailData
        }
    }

    handleError(error) {
        console.error('Ошибка:', error);
        this.showMainLoader(false);
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = 'Произошла ошибка при загрузке. Попробуем снова через 3 секунды...';
        errorDiv.classList.add('show');
        
        // Авто-ретрай через 3 секунды
        setTimeout(() => {
            errorDiv.classList.remove('show');
            this.loadNextEmailSequence();
        }, 3000);
    }
}

// Инициализируем при загрузке
document.addEventListener('DOMContentLoaded', () => {
    new PhishingDetector();
});