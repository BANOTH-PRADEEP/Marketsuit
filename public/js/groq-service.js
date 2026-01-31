/**
 * Groq AI Service
 * Handles API requests to Groq Cloud
 */

const GroqService = {
    async generateText(prompt) {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Backend Request Failed');
            }

            const data = await response.json();
            return data.content;

        } catch (error) {
            console.error("Groq Service Error:", error);
            // Fallback for simple testing if backend fails/is offline
            return `[Backend Error] ${error.message}`;
        }
    }
};
