const form = document.getElementById('formLookup');
const formUrl = document.getElementById('formUrl');
const statusText = document.getElementById('status');
const resultPanel = document.getElementById('resultPanel');
const questions = document.getElementById('questions');
const jsonOutput = document.getElementById('jsonOutput');
const copyJson = document.getElementById('copyJson');
const copySummary = document.getElementById('copySummary');
const sampleBtn = document.getElementById('sampleBtn');

let lastResult = null;

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusText.textContent = 'Form okunuyor...';
    resultPanel.hidden = true;

    try {
        const response = await fetch('/api/parse-form', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: formUrl.value.trim() })
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error('Parser fonksiyonuna ulaşılamadı. Netlify deploy ayarında Functions açık mı ve site Netlify üzerinden mi açıldı?');
        }

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Form okunamadı.');
        }

        lastResult = payload;
        renderResult(payload);
        statusText.textContent = `${payload.questions.length} soru bulundu. JSON'u direkt Telegram botuna gönderebilirsin.`;
    } catch (error) {
        statusText.textContent = error.message;
    }
});

copyJson.addEventListener('click', async () => {
    await navigator.clipboard.writeText(jsonOutput.value);
    statusText.textContent = 'JSON kopyalandı.';
});

copySummary.addEventListener('click', async () => {
    if (!lastResult) return;
    const summary = lastResult.questions
        .map((item, index) => `${index + 1}. ${item.label} | ${entryLabel(item.entry)} | ${item.kind}`)
        .join('\n');
    await navigator.clipboard.writeText(summary);
    statusText.textContent = 'Soru özeti kopyalandı.';
});

sampleBtn.addEventListener('click', () => {
    const sample = {
        action: 'https://docs.google.com/forms/d/e/FORM_ID/formResponse',
        questions: [
            {
                name: 'q_123456',
                label: 'İsim ve Soy İsim',
                entry: 'entry.123456',
                kind: 'text',
                required: true,
                options: []
            },
            {
                name: 'q_789012',
                label: 'Komite Tercihi',
                entry: 'entry.789012',
                kind: 'select',
                required: true,
                options: ['Genel Kurul', 'Kriz Komitesi']
            }
        ]
    };
    jsonOutput.value = JSON.stringify(sample, null, 2);
    resultPanel.hidden = false;
    questions.innerHTML = '';
    statusText.textContent = 'Örnek JSON gösterildi.';
});

function renderResult(payload) {
    questions.innerHTML = payload.questions.map((item, index) => `
        <article class="question-card">
            <h3>${escapeHtml(index + 1)}. ${escapeHtml(item.label)}</h3>
            <p>Entry: <code>${escapeHtml(entryLabel(item.entry))}</code></p>
            <p>Tip: <code>${escapeHtml(item.kind)}</code>${item.required ? ' | Zorunlu' : ''}</p>
            ${item.options?.length ? `<p>Seçenekler: ${escapeHtml(item.options.join(', '))}</p>` : ''}
        </article>
    `).join('');
    jsonOutput.value = JSON.stringify({
        action: payload.action,
        questions: payload.questions
    }, null, 2);
    resultPanel.hidden = false;
}

function entryLabel(entry) {
    if (typeof entry === 'string') return entry;
    return Object.entries(entry || {})
        .map(([key, value]) => `${key}:${value}`)
        .join(', ');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
