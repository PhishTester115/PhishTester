// home.js - Скрипт для главной страницы
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('preloaded_email')) {
        console.log('Письмо уже предзагружено, пропускаем.');
        return;
    }

    console.log('Начинаем фоновую генерацию для детектора...');

    const commonInstruction = `
        ТРЕБОВАНИЯ:
        1. Создай ДЛИННОЕ, детализированное письмо (100+ слов).
        2. После письма добавь ###АНАЛИЗ###.
        3. После анализа добавь ###OPTIONS###. Создай 5-6 вариантов ответа (признаков), разделенных символом '|'. 
           Смешай РЕАЛЬНЫЕ признаки и ЛОЖНЫЕ.
        4. Добавь ###ANSWER### и перечисли через запятую индексы (0-5) ВСЕХ вариантов, которые являются ПРАВДОЙ.
    `;

    const scenarios = [
        { prompt: `Сценарий: Банк, блокировка счета. Сложное оформление. ${commonInstruction}` },
        { prompt: `Сценарий: HR-отдел, график отпусков. Официальный стиль. ${commonInstruction}` },
        { prompt: `Сценарий: Облачное хранилище, место переполнено. ${commonInstruction}` }
    ];

    const emailType = Math.random() < 0.65 ? 1 : 0;
    let prompt;

    if (emailType === 1) {
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        prompt = scenario.prompt;
    } else {
        prompt = `Задача: Создай ДЛИННОЕ, реалистичное ЛЕГИТИМНОЕ деловое письмо (НЕ фишинг). СТРУКТУРА ОТВЕТА СТРОГО ТАКАЯ: [Текст письма] ###АНАЛИЗ### [Текст анализа почему это безопасно]`;
    }

    const randomId = Math.random().toString(36).substring(7);
    const finalPrompt = `${prompt}\n(Ignore ID: ${randomId})`;

    fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'deepseek-reasoning',
            messages: [
                { role: 'system', content: 'Ты эксперт по кибербезопасности.' },
                { role: 'user', content: finalPrompt }
            ],
            referrer: 'https://g4f.dev/'
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.choices && data.choices[0]) {
            const fullText = data.choices[0].message.content;
            
            let content = fullText;
            
            // Удаление рекламы (Ad removal)
            const adPatterns = [
                /Support Pollinations\.AI[\s\S]*$/i,
                /🌸 Ad 🌸[\s\S]*$/i,
                /Powered by Pollinations\.AI[\s\S]*$/i
            ];
            adPatterns.forEach(regex => {
                content = content.replace(regex, '');
            });
            content = content.trim();

            let analysis = "";
            let options = [];
            let correctIndices = [];

            const answerRegex = /###\s*ANSWER\s*###/i;
            const optionsRegex = /###\s*OPTIONS\s*###/i;
            const analysisRegex = /###\s*(?:АНАЛИЗ|ANALYSIS)\s*###/i;

            if (answerRegex.test(content)) {
                const parts = content.split(answerRegex);
                const matches = parts[1].trim().match(/\d+/g);
                if (matches) correctIndices = matches.map(n => parseInt(n));
                content = parts[0];
            }

            if (optionsRegex.test(content)) {
                const parts = content.split(optionsRegex);
                options = parts[1].trim().split('|').map(o => o.trim()).filter(o => o.length > 0);
                content = parts[0];
            }

            if (analysisRegex.test(content)) {
                const parts = content.split(analysisRegex);
                analysis = parts[1].trim();
                content = parts[0];
            }
            
            content = content.trim();

            if (emailType === 1 && options.length === 0) {
                options = ["Подозрительный адрес", "Срочность", "Ошибки", "Просьба данных"];
                correctIndices = [0, 1];
            }

            const emailData = {
                content: content,
                analysis: analysis,
                isPhishing: emailType === 1,
                options: options,
                correctIndices: correctIndices
            };
            
            localStorage.setItem('preloaded_email', JSON.stringify(emailData));
            console.log('Письмо успешно предзагружено в фон.');
        }
    })
    .catch(err => console.log('Ошибка предзагрузки:', err));
});