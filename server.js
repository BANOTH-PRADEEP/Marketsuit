const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Diagnostics
if (process.env.GROQ_API_KEY) {
    console.log("✅ Groq API Key found and loaded.");
} else {
    console.warn("⚠️ WARNING: GROQ_API_KEY is missing from environment!");
}

app.get('/api/debug-env', (req, res) => {
    res.json({
        canSeeKey: !!process.env.GROQ_API_KEY,
        keyLength: process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.length : 0,
        port: PORT
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'data', 'leads.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Helper: Read/Write Files
function readFile(file) {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeFile(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Helper: Read/Write Leads (Legacy wrappers)
function readLeads() { return readFile(DATA_FILE); }
function saveLeads(leads) { writeFile(DATA_FILE, leads); }

// --- API Routes ---

// 0. Authentication
app.post('/api/auth/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });

    const users = readFile(USERS_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "User already exists" });

    const newUser = { name, email, password }; // In production/real use, use bcrypt!
    users.push(newUser);
    writeFile(USERS_FILE, users);

    res.json({ message: "Account created successfully", user: { name, email } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const users = readFile(USERS_FILE);
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ message: "Login successful", user: { name: user.name, email: user.email } });
});

// 1. Generate Text (Proxy to Groq)
app.post('/api/generate', async (req, res) => {
    const { prompt } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!apiKey) return res.status(500).json({ error: "Server API Key not configured" });

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are an expert sales and marketing assistant." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Groq API Failed');
        }

        const data = await response.json();
        res.json({ content: data.choices[0].message.content });

    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. Scan Leads (Persisted)
app.get('/api/leads', (req, res) => {
    try {
        const leads = readLeads();
        // Recalculate Mock Scores on read (simulation) - or just return them
        const scoredLeads = leads.map(lead => {
            // Ensure label matches score if it was manually added without AI
            let label = lead.label;
            if (!label) {
                const score = lead.score || 0;
                label = score >= 80 ? "Hot Lead" : score >= 50 ? "Warm" : "Cold";
            }
            return { ...lead, label };
        });
        res.json(scoredLeads);
    } catch (err) {
        res.status(500).json({ error: "Failed to load leads" });
    }
});

// 3. Create Lead
app.post('/api/leads', (req, res) => {
    const { name, company, budget } = req.body;
    if (!name || !company) return res.status(400).json({ error: "Name and Company are required" });

    const newLead = {
        name,
        company,
        budget: budget || "Unknown",
        history: "Manual Entry via Dashboard",
        score: Math.floor(Math.random() * 60) + 40, // Random mock score for new leads
        label: "Pending Analysis"
    };

    // Update Label based on random score immediate feedback
    if (newLead.score >= 80) newLead.label = "Hot Lead";
    else if (newLead.score >= 50) newLead.label = "Warm";
    else newLead.label = "Cold";

    try {
        const leads = readLeads();
        leads.unshift(newLead); // Add to top
        saveLeads(leads);
        res.json(newLead);
    } catch (err) {
        res.status(500).json({ error: "Failed to save lead" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
