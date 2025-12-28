// home.js - Скрипт для главной страницы
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('phishing_active_session') || localStorage.getItem('preloaded_email')) {
        return;
    }

    console.log('Начинаем фоновую генерацию...');

    // РФ Сценарии для старта
    const startScenarios = [
        { platform: "WhatsApp", sender: "Неизвестный", topic: "Привет, это ты на фото?" },
        { platform: "SMS", sender: "Gosuslugi", topic: "Имеется задолженность" },
        { platform: "Email", sender: "Wildberries", topic: "Заказ отменен" },
        { platform: "Telegram", sender: "Избранное (фейк)", topic: "Попытка входа" },
        { platform: "Email", sender: "Бухгалтерия", topic: "Расчетный лист" }
    ];

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const scenario = pick(startScenarios);
    const emailType = Math.random() < 0.65 ? 1 : 0;
    const targetOptionCount = Math.floor(Math.random() * 3) + 5;

    const contextInstruction = `
        КОНТЕКСТ: Россия. Валюта: Рубли. 
        Если мессенджер - живой язык. Если официальное - строго.
    `;

    const common = `
        ТРЕБОВАНИЯ: Имитируй стиль платформы ${scenario.platform}.
        После текста добавь ###АНАЛИЗ###.
        ВАЖНО: Анализ должен быть ПОДРОБНЫМ (Красные флаги, Психология).
    `;
    
    const phishing = `
        После анализа добавь ###OPTIONS###. 
        Создай ровно ${targetOptionCount} вариантов признаков через '|'.
        ФОРМАТ ОПЦИЙ: "(+) Верный признак" или "(-) Ложный признак".
        (Не пиши блок ###ANSWER###).
    `;

    const prompt = emailType === 1 
        ? `ФИШИНГ. Платформа: ${scenario.platform}. Отправитель: ${scenario.sender}. Тема: ${scenario.topic}. ${contextInstruction} ${common} ${phishing}`
        : `ЛЕГИТИМНОЕ сообщение. Платформа: ${scenario.platform}. Отправитель: ${scenario.sender}. Тема: ${scenario.topic}. ${contextInstruction} ${common}`;

    fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'deepseek-reasoning',
            messages: [{ role: 'system', content: 'Ты эксперт по кибербезопасности в РФ. Используй (+) и (-).' }, { role: 'user', content: `${prompt}\n(ID: ${Math.random()})` }],
            referrer: 'https://g4f.dev/'
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.choices && data.choices[0]) {
            let content = data.choices[0].message.content;
            
            [/Support Pollinations[\s\S]*$/i, /🌸 Ad[\s\S]*$/i].forEach(r => content = content.replace(r, ''));
            content = content.trim();
            
            let analysis = "", rawOptions = [];
            
            const oRegex = /###\s*OPTIONS\s*###/i;
            const anRegex = /###\s*(?:АНАЛИЗ|ANALYSIS)\s*###/i;

            if (oRegex.test(content)) {
                const parts = content.split(oRegex);
                let opts = parts[1].trim();
                opts = opts.split(/###\s*ANSWER/i)[0];
                rawOptions = opts.split('|').map(s=>s.trim()).filter(s=>s);
                content = parts[0];
            }
            if (anRegex.test(content)) {
                const parts = content.split(anRegex);
                analysis = parts[1].trim();
                content = parts[0];
            }

            let processedOptions = [], correctIndices = [];
            
            if (emailType === 1 && rawOptions.length > 0) {
                let parsedOpts = rawOptions.map(opt => {
                    // Используем тот же улучшенный парсер с регулярками
                    const isTrue = /(\(\+\)|\[\+\]|^\+\s?)/.test(opt);
                    
                    let cleanText = opt
                        .replace(/[\(\[\{]\s*[\+\-]\s*[\)\]\}]/g, '')
                        .replace(/^[\+\-]\s?/, '')
                        .trim();
                        
                    return { text: cleanText, isCorrect: isTrue };
                });

                parsedOpts.sort(() => Math.random() - 0.5);

                if (!parsedOpts.some(o => o.isCorrect)) {
                    parsedOpts[0] = { text: "Подозрительное содержание", isCorrect: true };
                }
                
                processedOptions = parsedOpts.map(o => o.text);
                correctIndices = parsedOpts.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
            } else if (emailType === 1) {
                processedOptions = ["Подозрительно"]; correctIndices = [0];
            }

            localStorage.setItem('preloaded_email', JSON.stringify({
                content: content.trim(),
                analysis: analysis.trim(),
                isPhishing: emailType === 1,
                options: processedOptions,
                correctIndices,
                platform: scenario.platform
            }));
        }
    });
});