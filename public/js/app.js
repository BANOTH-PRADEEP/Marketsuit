/**
 * MarketAI Suite - Application Logic
 */

/* --- State Management --- */
const AppState = {
    currentView: 'dashboard',
    chartInstance: null
};

/* --- Navigation & UI --- */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if (target) navigateTo(target);
        });
    });

    // 2. Setup Listeners
    setupFormListeners();
    setupModalListeners();

    // 3. Initial Load
    loadLeads();
    initChart();
});

function navigateTo(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById(viewId).classList.add('active');

    const navLink = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if (navLink) navLink.classList.add('active');

    const titleMap = {
        'dashboard': 'Dashboard',
        'campaigns': 'Campaign Generator',
        'pitches': 'Smart Pitch',
        'leads': 'Lead Scoring',
        'settings': 'Settings'
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'Dashboard';
    AppState.currentView = viewId;
}

/* --- Features: Forms --- */
function setupFormListeners() {
    // Campaign
    document.getElementById('campaign-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const product = document.getElementById('product-name').value;
        const audience = document.getElementById('target-audience').value;
        const benefits = document.getElementById('key-benefits').value;
        const tone = document.getElementById('campaign-tone').value;

        if (!product) return showToast("Product name is required", "error");

        const outputContainer = document.getElementById('campaign-output');
        setLoadingState(outputContainer);

        const prompt = `Act as an expert marketing strategist. Create a comprehensive marketing campaign strategy for:
        Product: ${product}, Audience: ${audience}, Benefits: ${benefits}, Tone: ${tone}.
        Output: Slogan, 3 Messaging Pillars, Social Channels, Ad Copy (FB/LinkedIn)`;

        try {
            const result = await GroqService.generateText(prompt);
            renderOutput(outputContainer, result);
            showToast("Strategy generated successfully!", "success");
        } catch (error) {
            renderError(outputContainer, error);
            showToast("Failed to generate strategy", "error");
        }
    });

    // Pitch
    document.getElementById('pitch-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const recipient = document.getElementById('recipient-role').value;
        const painPoints = document.getElementById('pain-points').value;
        const solution = document.getElementById('solution-desc').value;

        if (!recipient) return showToast("Recipient is required", "error");

        const outputContainer = document.getElementById('pitch-output');
        setLoadingState(outputContainer);

        const prompt = `Write a sales email pitch. Recipient: ${recipient}, Pain: ${painPoints}, Solution: ${solution}. Concise, professional.`;

        try {
            const result = await GroqService.generateText(prompt);
            renderOutput(outputContainer, result);
            showToast("Pitch drafted successfully!", "success");
        } catch (error) {
            renderError(outputContainer, error);
        }
    });

    // Refresh Leads
    document.getElementById('analyze-leads-btn').addEventListener('click', () => {
        loadLeads();
        showToast("Leads refreshed from backend", "success");
    });
}

/* --- Modal Logic --- */
function setupModalListeners() {
    const modal = document.getElementById('lead-modal');
    const openBtn = document.getElementById('open-lead-modal');
    const closeBtn = document.querySelector('.close-modal');
    const form = document.getElementById('new-lead-form');

    // Button might not exist if dashboard loaded first, checking existence
    if (openBtn) openBtn.addEventListener('click', () => modal.classList.add('open'));
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });

    // Add Lead Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('lead-name').value;
        const company = document.getElementById('lead-company').value;
        const budget = document.getElementById('lead-budget').value;

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, company, budget })
            });

            if (!response.ok) throw new Error("Failed to save lead");

            await loadLeads(); // Refresh table
            modal.classList.remove('open');
            form.reset();
            showToast("New lead added successfully!", "success");

        } catch (error) {
            console.error(error);
            showToast("Error adding lead", "error");
        }
    });
}

/* --- Data & Visuals --- */
async function loadLeads() {
    const tbody = document.getElementById('leads-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Loading details...</td></tr>';

    try {
        const response = await fetch('/api/leads');
        const leads = await response.json();

        tbody.innerHTML = leads.map(lead => {
            let colorObj = getScoreColor(lead.score);
            return `
            <tr>
                <td style="font-weight: 500;">${lead.name}</td>
                <td>${lead.company}</td>
                <td style="color: var(--text-muted); font-size: 0.9em;">${lead.history}</td>
                <td>${lead.budget}</td>
                <td style="font-weight:bold; color: ${colorObj.color}">${lead.score}/100</td>
                <td><span style="padding: 4px 10px; border-radius: 12px; background: ${colorObj.bg}; color: ${colorObj.color}; font-size: 0.75rem; font-weight: 600;">${lead.label}</span></td>
            </tr>
        `}).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="color: var(--danger); text-align:center;">Failed to connect to backend.</td></tr>`;
    }
}

function initChart() {
    const canvas = document.getElementById('analyticsChart');
    if (!canvas) return; // Guard clause

    const ctx = canvas.getContext('2d');

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Indigo
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    AppState.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Campaign Engagement',
                data: [12, 19, 15, 25, 22, 30, 45],
                borderColor: '#6366f1',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4, // Smooth curves
                pointBackgroundColor: '#ec4899',
                pointBorderColor: '#fff',
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

/* --- Helpers --- */
function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}" style="font-size: 1.5rem; color: ${type === 'success' ? 'var(--success)' : 'var(--danger)'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function setLoadingState(container) {
    container.innerHTML = `
        <div class="placeholder-state">
            <i class="ph ph-spinner ph-spin" style="color: var(--primary); font-size: 3rem;"></i>
            <p style="margin-top:1rem;">AI Intelligence Active...</p>
        </div>
    `;
}

function renderOutput(container, text) {
    const formatted = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    container.innerHTML = `<div style="text-align: left; animation: fadeIn 0.5s ease;">${formatted}</div>`;
}

function renderError(container, error) {
    container.innerHTML = `
        <div class="placeholder-state" style="color: var(--danger)">
            <i class="ph ph-warning"></i>
            <p>Error: ${error.message}</p>
        </div>
    `;
}

function getScoreColor(score) {
    if (score >= 80) return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
    if (score >= 50) return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
}
