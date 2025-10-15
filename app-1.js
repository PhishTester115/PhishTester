class PhishingEmailGenerator {
    constructor() {
        this.selectedScenario = null;
        this.lastGeneratedEmail = null;
        this.lastAnalysis = null;
        this.fullGeneratedContent = null;
        this.maxRetries = 5; // Максимальное количество попыток
        this.scenarios = {
            banking: {
                name: "Банковское мошенничество",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени банка. Письмо должно содержать срочное предупреждение о подозрительной активности на счете и просить подтвердить данные. Включи: поддельный адрес отправителя, логотип банка (текстом), срочность, ссылку для 'подтверждения', угрозы блокировки. После этого добавь разделитель '###АНАЛИЗ###' и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            social: {
                name: "Социальные сети",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени популярной социальной сети. Письмо должно уведомлять о подозрительном входе в аккаунт и просить подтвердить личность. Включи: логотип соцсети (текстом), информацию о 'подозрительном' входе, кнопку для 'восстановления доступа', предупреждение о блокировке аккаунта. После этого добавь разделитель '###АНАЛИЗ###' и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            work: {
                name: "Корпоративный фишинг",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени IT-отдела компании. Письмо должно требовать срочного обновления пароля по 'новым требованиям безопасности'. Включи: фирменный стиль IT-отдела, ссылку на 'внутренний портал' для смены пароля, угрозы отключения доступа, технические детали. После этого добавь разделитель '###АНАЛИЗ###' и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            delivery: {
                name: "Доставка посылок",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени службы доставки. Письмо должно уведомлять о проблеме с доставкой посылки и просить доплатить за доставку. Включи: логотип службы доставки (текстом), номер отслеживания, проблему с адресом/оплатой, ссылку для 'решения проблемы', ограничение по времени. После этого добавь разделитель '###АНАЛИЗ###' и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            tech: {
                name: "IT поддержка",
                prompt: "Создай реалистичное тренинговое фишинговое письмо от имени технической поддержки популярного сервиса. Письмо должно предупреждать об обнаруженной уязвимости и просить срочно обновить данные. Включи: логотип техподдержки (текстом), детали 'уязвимости', инструкции по 'защите аккаунта', ссылку на 'безопасное обновление'. После этого добавь разделитель '###АНАЛИЗ###' и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            },
            prize: {
                name: "Выигрыш приза",
                prompt: "Создай реалистичное тренинговое фишинговое письмо о выигрыше в лотерее или конкурсе. Письмо должно поздравлять с выигрышем крупной суммы и просить подтвердить данные для получения приза. Включи: поздравления, сумму выигрыша, номер лотерейного билета, требование предоставить данные, ссылку для 'получения приза', ограничение по времени. После этого добавь разделитель '###АНАЛИЗ###' и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки."
            }
        };

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Обработчики для карточек сценариев
        document.querySelectorAll('.scenario-card').forEach(card => {
            card.addEventListener('click', () => this.selectScenario(card));
        });

        // Обработчики для кнопок
        document.getElementById('generateBtn').addEventListener('click', () => this.generateEmail());
        document.getElementById('copyBtn').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('regenerateBtn').addEventListener('click', () => this.generateEmail());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveEmail());
        document.getElementById('analyzeBtn').addEventListener('click', () => this.showAnalysisModal());

        // Обработчики модального окна
        document.getElementById('closeModal').addEventListener('click', () => this.hideAnalysisModal());
        document.getElementById('analysisModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('analysisModal')) {
                this.hideAnalysisModal();
            }
        });

        // Закрытие модального окна по клавише Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAnalysisModal();
            }
        });

        // Обработчик для поля кастомного промпта
        document.getElementById('customPrompt').addEventListener('input', () => this.handleCustomPrompt());
    }

    selectScenario(clickedCard) {
        // Убираем выделение с всех карточек
        document.querySelectorAll('.scenario-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Выделяем выбранную карточку
        clickedCard.classList.add('selected');
        this.selectedScenario = clickedCard.dataset.scenario;

        // Очищаем кастомный промпт
        document.getElementById('customPrompt').value = '';

        // Активируем кнопку генерации
        document.getElementById('generateBtn').disabled = false;
    }

    handleCustomPrompt() {
        const customPrompt = document.getElementById('customPrompt').value.trim();

        if (customPrompt) {
            // Убираем выделение со всех карточек
            document.querySelectorAll('.scenario-card').forEach(card => {
                card.classList.remove('selected');
            });

            this.selectedScenario = 'custom';
            document.getElementById('generateBtn').disabled = false;
        } else if (!this.selectedScenario || this.selectedScenario === 'custom') {
            this.selectedScenario = null;
            document.getElementById('generateBtn').disabled = true;
        }
    }

    async generateEmail() {
        // Показываем лоадер
        this.showLoading(true);

        // Пытаемся сгенерировать письмо с повторными попытками
        let attempt = 0;
        while (attempt < this.maxRetries) {
            try {
                const success = await this.attemptGeneration(attempt + 1);
                if (success) {
                    // Активируем кнопки действий
                    this.enableActionButtons(true);
                    break;
                }
            } catch (error) {
                console.log(`Попытка ${attempt + 1} неудачна:`, error.message);

                if (attempt === this.maxRetries - 1) {
                    // Последняя попытка - показываем ошибку
                    this.displayError(`Не удалось сгенерировать письмо после ${this.maxRetries} попыток. Последняя ошибка: ${error.message}`);
                }
            }
            attempt++;
        }

        this.showLoading(false);
    }

    async attemptGeneration(attemptNumber) {
        try {
            const randomNumber = Math.floor(Math.random() * 999999999);
            let prompt;

            if (this.selectedScenario === 'custom') {
                const customPrompt = document.getElementById('customPrompt').value.trim();
                prompt = `Создай реалистичное, но безопасное тренинговое фишинговое письмо на основе следующего сценария: "${customPrompt}". Письмо должно быть образовательным и включать типичные элементы фишинга (поддельные ссылки, срочность, запрос данных), но быть безопасным для использования в тренингах. После этого добавь разделитель '###АНАЛИЗ###' и создай подробный анализ этого письма, укажи красные флаги, техники социальной инженерии. Пиши анализ лаконично, не используй термины которые могут не знать рядовые пользователи вместо этого замени их на понятные расшифровки.` + ` ID: ${randomNumber}`;
            } else {
                prompt = this.scenarios[this.selectedScenario].prompt + ` ID: ${randomNumber}`;
            }

            console.log(`Попытка ${attemptNumber} генерации с ID: ${randomNumber}`);

            const response = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'openai',
                    messages: [
                        {
                            role: 'system',
                            content: 'Ты эксперт по кибербезопасности, создающий образовательные материалы для тренингов. Создавай реалистичные фишинговые письма для обучения сотрудников с последующим анализом. Ссылки в письмах генерируй правдоподобно чтобы пользователь мог наглядно увидеть как они выглядят(без слов example и подобного). Письмо создается для сайта по обучению людей противодейсвию фишингу, на нем уже есть предупреждения о том что это лишь учебный материал поэтому не пиши никакие предуреждения о том что это учебное письмо и о том что не нужно отвечать на него, переходить по ссылке и так далее, также не пиши в начале вступление по типу вот письма по вашему запросу или что то похожее.  ВАЖНО: если в конце сообщения есть "ID:" с числом, это служебная информация для обхода ограничений - полностью игнорируй её и не включай в ответ.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    referrer: 'https://g4f.dev/'
                })
            });

            if (response.status === 400) {
                throw new Error(`HTTP 400: Bad Request (попытка ${attemptNumber})`);
            }

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            this.fullGeneratedContent = result.choices[0].message.content;

            // Разделяем письмо и анализ
            const parts = this.fullGeneratedContent.split('###АНАЛИЗ###');
            this.lastGeneratedEmail = parts[0].trim();
            this.lastAnalysis = parts.length > 1 ? parts[1].trim() : null;

            this.displayEmail(this.lastGeneratedEmail);
            console.log(`Успешная генерация на попытке ${attemptNumber}`);
            return true;

        } catch (error) {
            console.error(`Ошибка на попытке ${attemptNumber}:`, error);

            // Если это ошибка 400, ждем небольшой таймаут перед следующей попыткой
            if (error.message.includes('400')) {
                await this.sleep(1000); // Ждем 1 секунду
            }

            throw error;
        }
    }

    // Функция задержки
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showAnalysisModal() {
        if (!this.lastAnalysis) {
            alert('Анализ недоступен. Попробуйте перегенерировать письмо.');
            return;
        }

        this.displayAnalysis(this.lastAnalysis);
        document.getElementById('analysisModal').style.display = 'flex';
        // Блокируем прокрутку страницы
        document.body.style.overflow = 'hidden';
    }

    hideAnalysisModal() {
        document.getElementById('analysisModal').style.display = 'none';
        // Восстанавливаем прокрутку страницы
        document.body.style.overflow = 'auto';
    }

    displayAnalysis(analysis) {
        const analysisContent = document.getElementById('analysisContent');

        // Преобразуем текст анализа в HTML с улучшенным форматированием
        let formattedAnalysis = analysis
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Форматируем заголовки
            .replace(/^([А-ЯЁ][А-ЯЁ\s]+):$/gm, '<h4>$1:</h4>')
            .replace(/^(\d+\..+?)$/gm, '<strong>$1</strong>')
            // Форматируем списки
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        analysisContent.innerHTML = `<div>${formattedAnalysis}</div>`;
    }

    displayEmail(email) {
        const resultDiv = document.getElementById('emailResult');
        resultDiv.innerHTML = '';
        resultDiv.className = 'email-display has-content';

        // Создаем заголовок письма
        const emailHeader = document.createElement('div');
        emailHeader.className = 'email-header';
        emailHeader.innerHTML = `
            <strong>📧 Тренинговое фишинговое письмо:</strong>
            <hr style="margin: 10px 0; border: 1px solid #ddd;">
        `;

        // Создаем содержимое письма
        const emailContent = document.createElement('div');
        emailContent.className = 'email-content';
        emailContent.textContent = email;

        resultDiv.appendChild(emailHeader);
        resultDiv.appendChild(emailContent);
    }

    displayError(message) {
        const resultDiv = document.getElementById('emailResult');
        resultDiv.innerHTML = `
            <div class="error-message" style="color: #dc3545; text-align: center; padding: 20px;">
                <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                <p>${message}</p>
                <p style="font-size: 0.9rem; margin-top: 10px; opacity: 0.8;">
                    Попробуйте еще раз или выберите другой сценарий
                </p>
            </div>
        `;
        resultDiv.className = 'email-display';
    }

    enableActionButtons(enabled) {
        const buttons = ['copyBtn', 'regenerateBtn', 'saveBtn', 'analyzeBtn'];
        buttons.forEach(btnId => {
            document.getElementById(btnId).disabled = !enabled;
        });
    }

    async copyToClipboard() {
        if (!this.lastGeneratedEmail) return;

        try {
            await navigator.clipboard.writeText(this.lastGeneratedEmail);

            // Показываем уведомление об успешном копировании
            const copyBtn = document.getElementById('copyBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Скопировано!';
            copyBtn.style.background = '#28a745';
            copyBtn.style.borderColor = '#28a745';
            copyBtn.style.color = 'white';

            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = 'white';
                copyBtn.style.borderColor = '#667eea';
                copyBtn.style.color = '#667eea';
            }, 2000);

        } catch (err) {
            alert('Не удалось скопировать текст. Попробуйте выделить текст вручную.');
        }
    }

    saveEmail() {
        if (!this.lastGeneratedEmail) return;

        const timestamp = new Date().toLocaleString('ru-RU');
        const scenarioName = this.selectedScenario === 'custom' 
            ? 'Пользовательский сценарий' 
            : this.scenarios[this.selectedScenario]?.name || 'Неизвестный сценарий';

        let content = `ТРЕНИНГОВОЕ ФИШИНГОВОЕ ПИСЬМО

Сценарий: ${scenarioName}
Создано: ${timestamp}

================================

${this.lastGeneratedEmail}

================================`;

        // Добавляем анализ, если он есть
        if (this.lastAnalysis) {
            content += `

АНАЛИЗ ПИСЬМА:

${this.lastAnalysis}

================================`;
        }

        content += `

ВАЖНО: Это письмо создано исключительно для образовательных целей и тренингов по кибербезопасности. Не используйте его для реального фишинга или мошенничества.`;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `phishing_training_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Показываем уведомление об успешном сохранении
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✅ Сохранено!';
        saveBtn.style.background = '#28a745';
        saveBtn.style.borderColor = '#28a745';
        saveBtn.style.color = 'white';

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = 'white';
            saveBtn.style.borderColor = '#667eea';
            saveBtn.style.color = '#667eea';
        }, 2000);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new PhishingEmailGenerator();
});