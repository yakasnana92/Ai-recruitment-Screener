<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8e238da8-87ea-4443-bac5-1b7fa6a65feb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` in the project root and add:
   `VITE_GROQ_API_KEY="YOUR_GROQ_API_KEY"`
   Optional: `VITE_GROQ_MODEL="openai/gpt-oss-20b"`
3. Run the app:
   `npm run dev`

## Architecture Note

AI screening requests are made directly from the Vite frontend (`src/services/aiService.ts`) to Groq.
Because of this, the key is read from `import.meta.env.VITE_GROQ_API_KEY` and is exposed to the browser at runtime.
