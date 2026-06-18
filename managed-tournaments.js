(async function loadManagedTournaments() {
    const grid = document.getElementById('collectionsGrid');
    if (!grid) return;

    let payload;
    try {
        const response = await fetch('data/tournaments.json', { cache: 'no-store' });
        if (!response.ok) return;
        payload = await response.json();
    } catch (error) {
        return;
    }

    const tournaments = Array.isArray(payload.tournaments) ? payload.tournaments : [];
    tournaments.slice().reverse().forEach((item) => {
        const slug = item.slug;
        if (!slug || document.querySelector(`[data-managed-tournament="${slug}"]`)) return;

        const card = document.createElement('div');
        const isOpen = item.status !== 'closed';
        card.className = `collection-card ${isOpen ? 'has-cta' : 'no-cta'}`;
        card.dataset.category = 'turnuva';
        card.dataset.managedTournament = slug;

        const firstHash = getFirstApplicationHash(item);
        const statusText = isOpen ? (item.statusText || 'Başvurular Açık') : (item.closedDate ? `Kapandı: ${item.closedDate}` : 'Tamamlandı');
        const action = isOpen && firstHash
            ? `<a href="${encodeURIComponent(slug)}/${firstHash}" class="apply-btn">Başvuru Yap</a>`
            : '';

        card.innerHTML = `
            <div class="collection-thumbnail">
                <img src="${escapeAttribute(item.image || 'images/retorik-logo.png')}" alt="${escapeAttribute(item.name || 'Konferans')}" />
            </div>
            <div class="card-content">
                <span class="card-badge">RETORİK</span>
                <h3 class="card-title">${escapeHtml(item.name || 'Konferans')}</h3>
                <p class="card-subtitle">${escapeHtml(item.description || '')}</p>
                <p class="card-status"><b>${escapeHtml(statusText)}</b></p>
                ${action}
            </div>
        `;

        grid.prepend(card);
    });
})();

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('`', '&#096;');
}

function hasJsonForm(config) {
    return Boolean(config?.action && Array.isArray(config?.questions) && config.questions.length);
}

function getFirstApplicationHash(item) {
    if (hasJsonForm(item.forms?.delegate)) return '#delege';
    if (hasJsonForm(item.forms?.organization)) return '#orga';
    return '';
}
