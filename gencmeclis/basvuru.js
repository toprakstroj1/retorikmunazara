const GOOGLE_FORM_CONFIG = {
    delegate: {
        action: 'https://docs.google.com/forms/u/1/d/e/1FAIpQLSenLngQ8a3vLKpFSeVIQRRuxkUPMdW-tIOC-bjeiHbFPSjHgg/formResponse',
        fields: {
            fullName: 'entry.57742765',
            phone: 'entry.422803556',
            email: 'entry.575033634',
            school: 'entry.390389414',
            experiences: 'entry.776591440',
            reference: 'entry.2037145325',
            notes: 'entry.718651676',
            birthDate: {
                year: 'entry.457521081_year',
                month: 'entry.457521081_month',
                day: 'entry.457521081_day'
            },
            city: 'entry.520640593',
            committee: 'entry.1920623885',
            committee2: 'entry.1945868912',
            rules: 'entry.28563211'
        }
    },
    organization: {
        action: 'https://docs.google.com/forms/u/0/d/e/1FAIpQLSc0Cp66f96yw3vJNTToFjuSONbHOutN-PTkzR3GeGRj2f13sw/formResponse',
        fields: {
            fullName: 'entry.57742765',
            phone: 'entry.422803556',
            email: 'entry.575033634',
            school: 'entry.221161498',
            experiences: 'entry.776591440',
            reference: 'entry.321007518',
            notes: 'entry.718651676',
            birthDate: {
                year: 'entry.457521081_year',
                month: 'entry.457521081_month',
                day: 'entry.457521081_day'
            },
            city: 'entry.1857483133',
            team: 'entry.2100449394',
            rules: 'entry.194954692'
        }
    }
};

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
    if (field.type === 'checkbox') {
        return field.checked ? field.value : '';
    }

    return field.value.trim();
}

function appendGoogleField(proxyForm, googleEntryName, value) {
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

function createHiddenField(name, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    return input;
}

function postToGoogleForm(form, config) {
    return new Promise((resolve) => {
        const frameName = `gencmeclis-google-form-${Date.now()}`;
        const iframe = document.createElement('iframe');
        const proxyForm = document.createElement('form');

        iframe.name = frameName;
        iframe.hidden = true;
        proxyForm.hidden = true;
        proxyForm.method = 'POST';
        proxyForm.action = config.action;
        proxyForm.target = frameName;

        Object.entries(config.fields).forEach(([fieldName, googleEntryName]) => {
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

function syncCommitteeOptions() {
    const first = document.getElementById('committee-first');
    const second = document.getElementById('committee-second');
    if (!first || !second) return;

    const update = () => {
        Array.from(second.options).forEach((option) => {
            option.disabled = Boolean(option.value && option.value === first.value);
        });

        if (second.value && second.selectedOptions[0]?.disabled) {
            second.value = '';
        }
    };

    first.addEventListener('change', update);
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

        const config = GOOGLE_FORM_CONFIG[form.dataset.googleForm];
        const submitButton = form.querySelector('.form-submit');
        const status = form.querySelector('.form-status');
        const originalText = submitButton.textContent;

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

if (window.location.hash === '#vekil' || window.location.hash === '#delege') {
    openApplicationPanel('delegate');
}

if (window.location.hash === '#orga' || window.location.hash === '#organizasyon') {
    openApplicationPanel('organization');
}

syncCommitteeOptions();
