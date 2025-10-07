class PhishingEmailGenerator {
    constructor() {
        this.selectedScenario = null;
        this.lastGeneratedEmail = null;
        this.scenarios = {
            banking: {
                name: "Банковское мошенничество",
                prompt: "Создай реалистичное, но безопасное тренинговое фишинговое письмо от имени банка. Письмо должно содержать срочное предупреждение о подозрительной активности на счете и просить подтвердить данные. Включи: поддельный адрес отправителя, логотип банка (текстом), срочность, ссылку для 'подтверждения' (НЕ реальную), угрозы блокировки. В конце добавь [ТРЕНИНГОВОЕ ПИСЬМО - НЕ РЕАГИРОВАТЬ]"
            },
            social: {
                name: "Социальные сети", 
                prompt: "Создай реалистичное, но безопасное тренинговое фишинговое письмо от имени популярной социальной сети. Письмо должно уведомлять о подозрительном входе в аккаунт и просить подтвердить личность. Включи: логотип соцсети (текстом), информацию о 'подозрительном' входе, кнопку для 'восстановления доступа', предупреждение о блокировке аккаунта. В конце добавь [ТРЕНИНГОВОЕ ПИСЬМО - НЕ РЕАГИРОВАТЬ]"
            },
            work: {
                name: "Корпоративный фишинг",
                prompt: "Создай реалистичное, но безопасное тренинговое фишинговое письмо от имени IT-отдела компании. Письмо должно требовать срочного обновления пароля по 'новым требованиям безопасности'. Включи: фирменный стиль IT-отдела, ссылку на 'внутренний портал' для смены пароля (НЕ реальную), угрозы отключения доступа, технические детали. В конце добавь [ТРЕНИНГОВОЕ ПИСЬМО - НЕ РЕАГИРОВАТЬ]"
            },
            delivery: {
                name: "Доставка посылок",
                prompt: "Создай реалистичное, но безопасное тренинговое фишинговое письмо от имени службы доставки. Письмо должно уведомлять о проблеме с доставкой посылки и просить доплатить за доставку. Включи: логотип службы доставки (текстом), номер отслеживания, проблему с адресом/оплатой, ссылку для 'решения проблемы' (НЕ реальную), ограничение по времени. В конце добавь [ТРЕНИНГОВОЕ ПИСЬМО - НЕ РЕАГИРОВАТЬ]"
            },
            tech: {
                name: "IT поддержка",
                prompt: "Создай реалистичное, но безопасное тренинговое фишинговое письмо от имени технической поддержки популярного сервиса. Письмо должно предупреждать об обнаруженной уязвимости и просить срочно обновить данные. Включи: логотип техподдержки (текстом), детали 'уязвимости', инструкции по 'защите аккаунта', ссылку на 'безопасное обновление' (НЕ реальную). В конце добавь [ТРЕНИНГОВОЕ ПИСЬМО - НЕ РЕАГИРОВАТЬ]"
            },
            prize: {
                name: "Выигрыш приза",
                prompt: "Создай реалистичное, но безопасное тренинговое фишинговое письмо о выигрыше в лотерее или конкурсе. Письмо должно поздравлять с выигрышем крупной суммы и просить подтвердить данные для получения приза. Включи: поздравления, сумму выигрыша, номер лотерейного билета, требование предоставить данные, ссылку для 'получения приза' (НЕ реальную), ограничение по времени. В конце добавь [ТРЕНИНГОВОЕ ПИСЬМО - НЕ РЕАГИРОВАТЬ]"
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
    this.showLoading(true);
    try {
        let prompt;
        if (this.selectedScenario === 'custom') {
            const customPrompt = document.getElementById('customPrompt').value.trim();
            prompt = `Создай реалистичное, но безопасное тренинговое фишинговое письмо на основе следующего сценария: \"${customPrompt}\". Письмо должно быть образовательным и включать типичные элементы фишинга (поддельные ссылки, срочность, запрос данных), но быть безопасным для использования в тренингах. В конце добавь [ТРЕНИНГОВОЕ ПИСЬМО - НЕ РЕАГИРОВАТЬ]`;
        } else {
            prompt = this.scenarios[this.selectedScenario].prompt;
        }
        // Генерируем случайное число
        const rnd = Math.floor(Math.random() * 999999999);
        const url = `https://text.pollinations.ai/openai?rnd=${rnd}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'Ты эксперт по кибербезопасности, создающий образовательные материалы для тренингов. Создавай реалистичные, но безопасные фишинговые письма для обучения сотрудников. Всегда добавляй предупреждение о том, что это тренинговое письмо. Если в сообщении или запросе содержится параметр rnd со случайным числом, полностью игнорируй его как служебный для обхода ограничений CORS.'
                    },
                    { role: 'user', content: prompt }
                ],
                referrer: 'https://g4f.dev/'
            }),
        });
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        const result = await response.json();
        const generatedEmail = result.choices[0].message.content;
        this.displayEmail(generatedEmail);
        this.lastGeneratedEmail = generatedEmail;
        this.enableActionButtons(true);
    } catch (error) {
        this.displayError(`Ошибка при генерации: ${error.message}`);
    } finally {
        this.showLoading(false);
    }
}

    displayEmail(email) {
        const resultDiv = document.getElementById('emailResult');
        resultDiv.innerHTML = '';
        resultDiv.className = 'email-display has-content';

        // Создаем заголовок письма
        const emailHeader = document.createElement('div');
        emailHeader.className = 'email-header';
        emailHeader.innerHTML = `
            <div style="border-bottom: 2px solid #e0e0e0; padding-bottom: 15px; margin-bottom: 20px;">
                <div style="color: #666; font-size: 12px; margin-bottom: 10px;">
                    <strong>От:</strong> [Адрес определяется сценарием]<br>
                    <strong>Кому:</strong> training@example.com<br>
                    <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}<br>
                    <strong>Тема:</strong> [Определяется содержанием письма]
                </div>
            </div>
        `;

        // Добавляем содержимое письма
        const emailContent = document.createElement('div');
        emailContent.style.whiteSpace = 'pre-wrap';
        emailContent.style.lineHeight = '1.6';
        emailContent.textContent = email;

        resultDiv.appendChild(emailHeader);
        resultDiv.appendChild(emailContent);
    }

    displayError(message) {
        const resultDiv = document.getElementById('emailResult');
        resultDiv.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon">❌</div>
                <p style="color: #dc3545;">${message}</p>
            </div>
        `;
        resultDiv.className = 'email-display';
        this.enableActionButtons(false);
    }

    enableActionButtons(enabled) {
        document.getElementById('copyBtn').disabled = !enabled;
        document.getElementById('regenerateBtn').disabled = !enabled;
        document.getElementById('saveBtn').disabled = !enabled;
    }

    async copyToClipboard() {
        if (!this.lastGeneratedEmail) return;

        try {
            await navigator.clipboard.writeText(this.lastGeneratedEmail);

            // Показываем уведомление
            const copyBtn = document.getElementById('copyBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Скопировано!';
            copyBtn.style.background = '#28a745';
            copyBtn.style.color = 'white';

            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
                copyBtn.style.color = '';
            }, 2000);

        } catch (error) {
            alert('Не удалось скопировать в буфер обмена');
        }
    }

    saveEmail() {
        if (!this.lastGeneratedEmail) return;

        const scenarioName = this.selectedScenario === 'custom' 
            ? 'Пользовательский сценарий'
            : this.scenarios[this.selectedScenario].name;

        const content = `Тренинговое фишинговое письмо
Сценарий: ${scenarioName}
Дата создания: ${new Date().toLocaleString('ru-RU')}

==========================================

${this.lastGeneratedEmail}

==========================================

ВАЖНО: Данное письмо создано исключительно для образовательных целей 
и тренингов по кибербезопасности. Не используйте в злонамеренных целях!`;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `phishing_training_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Показываем уведомление
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✅ Сохранено!';
        saveBtn.style.background = '#28a745';
        saveBtn.style.color = 'white';

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
            saveBtn.style.color = '';
        }, 2000);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
            document.getElementById('generateBtn').disabled = true;
        } else {
            overlay.classList.remove('show');
            document.getElementById('generateBtn').disabled = false;
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new PhishingEmailGenerator();

    // Добавляем предупреждение при загрузке страницы
    setTimeout(() => {
        if (confirm('Данный инструмент предназначен исключительно для образовательных целей и тренингов по кибербезопасности.\n\nВы подтверждаете, что будете использовать его только в законных целях?')) {
            document.body.style.filter = 'none';
        } else {
            window.location.href = 'about:blank';
        }
    }, 1000);

    // Добавляем размытие до подтверждения
    document.body.style.filter = 'blur(3px)';
});
