// home.js - Скрипт для главной страницы
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('phishing_active_session') || localStorage.getItem('preloaded_email')) {
        return;
    }

    console.log('Начинаем фоновую генерацию...');

    // Обновленные стартовые сценарии (без денег)
    const startScenarios = [
        { platform: "WhatsApp", sender: "Неизвестный", topic: "Привет, это ты на фото?" },
        { platform: "SMS", sender: "Gosuslugi", topic: "Учетная запись будет удалена" },
        { platform: "Email", sender: "Wildberries", topic: "Заказ отменен" },
        { platform: "Telegram", sender: "Избранное (фейк)", topic: "Попытка входа" },
        { platform: "Email", sender: "Google Drive", topic: "Нет места на диске" }
    ];

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const scenario = pick(startScenarios);
    const emailType = Math.random() < 0.65 ? 1 : 0;

    const contextInstruction = `
        КОНТЕКСТ: Россия. Валюта: Рубли.
        ВАЖНО: Пиши текст ГРАМОТНО. Не используй опечатки как признак.
        В блоке ###АНАЛИЗ### ЗАПРЕЩЕНО упоминать "2025 год" или "промпт". 
    `;

    const common = `
        ТРЕБОВАНИЯ: 
        1. В начале: "От кого:" и "Тема:".
        2. После текста добавь ###АНАЛИЗ###.
    `;

    const phishingParts = `
        ИНСТРУКЦИЯ ДЛЯ АНАЛИЗА (ФИШИНГ):
        Напиши подробный разбор (Флаги, Психология, Совет).

        3. После анализа добавь раздел ###TRUE_LIST###.
        Напиши 3 реальных признака фишинга из текста (НЕ ИСПОЛЬЗУЙ ОПЕЧАТКИ).
        
        4. После этого добавь раздел ###FALSE_LIST###.
        Напиши 3 выдуманных признака (которых НЕТ).
    `;

    const legitimParts = `
        ИНСТРУКЦИЯ ДЛЯ АНАЛИЗА (ЛЕГИТИМ):
        Объясни, почему это безопасно.
        ✅ **Признаки подлинности:**
        ℹ️ **Отличие от фишинга:**
    `;

    const prompt = emailType === 1 
        ? `ФИШИНГ. Платформа: ${scenario.platform}. Отправитель: ${scenario.sender}. Тема: ${scenario.topic}. ${contextInstruction} ${common} ${phishingParts}`
        : `ЛЕГИТИМНОЕ сообщение. Платформа: ${scenario.platform}. Отправитель: ${scenario.sender}. Тема: ${scenario.topic}. ${contextInstruction} ${common} ${legitimParts}`;

    // Функция для fetch с retry
    const fetchWithRetry = (url, options, retries = 0) => {
        return fetch(url, options).then(res => {
            if (res.status === 429 && retries < 3) {
                return new Promise(r => setTimeout(r, 2000 * (retries + 1))).then(() => fetchWithRetry(url, options, retries + 1));
            }
            return res;
        });
    };

    fetchWithRetry('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'deepseek-reasoning',
            messages: [{ role: 'system', content: 'Ты эксперт по кибербезопасности. Не используй "опечатки" как признак.' }, { role: 'user', content: `${prompt}\n(ID: ${Math.random()})` }],
            referrer: 'https://g4f.dev/'
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.choices && data.choices[0]) {
            let content = data.choices[0].message.content;
            
            [/Support Pollinations[\s\S]*$/i, /🌸 Ad[\s\S]*$/i, /Powered by[\s\S]*$/i].forEach(r => content = content.replace(r, ''));
            content = content.trim();
            
            let analysis = "", processedOptions = [], correctIndices = [];
            
            const analysisMatch = content.split(/###\s*(?:АНАЛИЗ|ANALYSIS)\s*###/i);
            
            if (analysisMatch.length > 1) {
                content = analysisMatch[0].trim();
                let analysisAndLists = analysisMatch[1].trim();

                if (emailType === 1) {
                    const trueSplit = analysisAndLists.split(/###\s*TRUE_LIST\s*###/i);
                    if (trueSplit.length > 1) {
                        analysis = trueSplit[0].trim();
                        const listsPart = trueSplit[1];
                        const falseSplit = listsPart.split(/###\s*FALSE_LIST\s*###/i);
                        
                        const clean = i => i.replace(/^[\d\-\*\.]+\s*/, '').trim();
                        let trueItems = falseSplit[0].trim().split('\n').map(clean).filter(i=>i);
                        let falseItems = falseSplit.length > 1 ? falseSplit[1].trim().split('\n').map(clean).filter(i=>i) : [];

                        let combined = [];
                        trueItems.forEach(t => combined.push({text: t, isCorrect: true}));
                        falseItems.forEach(f => combined.push({text: f, isCorrect: false}));
                        
                        combined.sort(() => Math.random() - 0.5);
                        if (!combined.length) combined.push({text: "Подозрительно", isCorrect: true});

                        processedOptions = combined.map(o => o.text);
                        correctIndices = combined.map((o, i) => o.isCorrect ? i : -1).filter(i=>i!==-1);
                    } else {
                        analysis = analysisAndLists;
                        processedOptions = ["Подозрительно"]; correctIndices = [0];
                    }
                } else {
                    analysis = analysisAndLists;
                    processedOptions = ["Подозрительно"]; correctIndices = [0];
                }
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
    })
    .catch(err => console.log('Ошибка предзагрузки:', err));
});