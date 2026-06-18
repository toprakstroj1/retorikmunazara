const GOOGLE_FORM_CONFIG = window.GOOGLE_FORM_CONFIG || {};

const stage = document.querySelector('[data-application-stage]');
const panels = document.querySelectorAll('[data-application-panel]');
const successOverlay = document.querySelector('[data-success-overlay]');
let successTimer;

window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 24);
}, { passive: true });

function getFieldValue(field) {
    if (!field) return '';

    if (field instanceof RadioNodeList || field.length) {
        const fields = Array.from(field);
        const checkedValues = fields
            .filter((item) => item.checked)
            .map((item) => item.value.trim())
            .filter(Boolean);

        if (checkedValues.length) return checkedValues;
        return field.value?.trim?.() || '';
    }

    if (field.type === 'checkbox') {
        return field.checked ? field.value : '';
    }
    return field.value.trim();
}

function createHiddenField(name, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    return input;
}

function appendGoogleField(proxyForm, googleEntryName, value) {
    if (Array.isArray(value)) {
        value.forEach((item) => appendGoogleField(proxyForm, googleEntryName, item));
        return;
    }

    if (typeof googleEntryName === 'string') {
        proxyForm.appendChild(createHiddenField(googleEntryName, value));
        return;
    }

    if (googleEntryName?.year && value) {
        const [year, month, day] = value.split('-');
        proxyForm.appendChild(createHiddenField(googleEntryName.year, year || ''));
        proxyForm.appendChild(createHiddenField(googleEntryName.month, month || ''));
        proxyForm.appendChild(createHiddenField(googleEntryName.day, day || ''));
    }
}

function getConfigFieldEntries(config) {
    if (Array.isArray(config.questions)) {
        return config.questions.map((question) => [
            question.name,
            question.entry || question.entries || config.fields?.[question.name]
        ]);
    }

    return Object.entries(config.fields || {});
}

function postToGoogleForm(form, config) {
    return new Promise((resolve) => {
        const frameName = `retorik-google-form-${Date.now()}`;
        const iframe = document.createElement('iframe');
        const proxyForm = document.createElement('form');

        iframe.name = frameName;
        iframe.hidden = true;
        proxyForm.hidden = true;
        proxyForm.method = 'POST';
        proxyForm.action = config.action;
        proxyForm.target = frameName;

        getConfigFieldEntries(config).forEach(([fieldName, googleEntryName]) => {
            const field = form.elements[fieldName];
            if (!field) return;
            appendGoogleField(proxyForm, googleEntryName, getFieldValue(field));
        });

        document.body.append(iframe, proxyForm);

        let resolved = false;
        const finish = () => {
            if (resolved) return;
            resolved = true;
            proxyForm.remove();
            iframe.remove();
            resolve();
        };

        iframe.addEventListener('load', finish, { once: true });
        window.setTimeout(finish, 1600);
        proxyForm.submit();
    });
}

function openApplicationPanel(type) {
    const panel = document.querySelector(`[data-application-panel="${type}"]`);
    if (!panel || !stage) return;

    stage.hidden = false;
    panels.forEach((item) => {
        const isTarget = item === panel;
        item.hidden = !isTarget;
        item.classList.toggle('is-opening', isTarget);
    });

    window.setTimeout(() => panel.classList.remove('is-opening'), 720);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel.querySelector('input, select, textarea')?.focus({ preventScroll: true });
}

function closeApplicationPanel(button) {
    button.closest('[data-application-panel]').hidden = true;
    if (stage) stage.hidden = true;
}

function launchConfetti() {
    const colors = ['#8B1A1A', '#A52A2A', '#ffffff', '#B83333', '#f4b4b4'];
    for (let index = 0; index < 86; index += 1) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        piece.style.setProperty('--x', `${Math.random() * 100}vw`);
        piece.style.setProperty('--c', colors[index % colors.length]);
        piece.style.setProperty('--d', `${1.8 + Math.random() * 1.7}s`);
        piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 230}px`);
        document.body.appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove(), { once: true });
    }
}

function showSuccess() {
    if (!successOverlay) return;
    window.clearTimeout(successTimer);
    successOverlay.hidden = false;
    launchConfetti();

    successTimer = window.setTimeout(() => {
        successOverlay.hidden = true;
    }, 3400);
}

document.querySelectorAll('.js-application-open').forEach((button) => {
    button.addEventListener('click', () => openApplicationPanel(button.dataset.target));
});

document.querySelectorAll('[data-close-application]').forEach((button) => {
    button.addEventListener('click', () => closeApplicationPanel(button));
});

document.querySelectorAll('.gencmeclis-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const invalidGroup = Array.from(form.querySelectorAll('[data-required-group][data-required="true"]'))
            .find((group) => !group.querySelector('input[type="checkbox"]:checked'));
        if (invalidGroup) {
            invalidGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const status = form.querySelector('.form-status');
            if (status) status.textContent = 'Lütfen zorunlu çoklu seçim sorularını doldurun.';
            return;
        }

        const config = GOOGLE_FORM_CONFIG[form.dataset.googleForm];
        const submitButton = form.querySelector('.form-submit');
        const status = form.querySelector('.form-status');
        const originalText = submitButton.textContent;

        if (!config?.action) {
            if (status) status.textContent = 'Bu başvuru formu henüz Google Forms ile eşleştirilmemiş.';
            return;
        }

        form.classList.add('is-sending');
        submitButton.textContent = 'Gönderiliyor...';
        submitButton.disabled = true;
        if (status) status.textContent = 'Başvurunuz Google Forms sistemine iletiliyor...';

        await postToGoogleForm(form, config);

        form.classList.remove('is-sending');
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        if (status) status.textContent = '';
        form.reset();
        form.closest('[data-application-panel]').hidden = true;
        if (stage) stage.hidden = true;
        showSuccess();
    });
});

if (window.location.hash === '#delege') {
    openApplicationPanel('delegate');
}

if (window.location.hash === '#orga' || window.location.hash === '#organizasyon') {
    openApplicationPanel('organization');
}
