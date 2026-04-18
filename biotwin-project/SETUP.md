# BioTwin — AI Digital Twin Simulator

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Add your Gemini API key (optional - app works without it using local fallback)
# Edit .env.local and replace the placeholder:
# GEMINI_API_KEY=your_actual_gemini_api_key_here

# 3. Run the development server
npm run dev

# 4. Open http://localhost:3000
```

## Features

- **3D Digital Twin**: Interactive 3D human body with external/internal view modes
- **Lifestyle Simulation**: Configure age, gender, diet, sleep, exercise, smoking, alcohol, stress
- **60-Day Timeline**: Watch how lifestyle choices affect organ health over time
- **Organ Health Scoring**: 7 organs with detailed decay reasons and medical terminology
- **Treatment Simulator**: 18 treatments across 4 categories (medication, lifestyle, therapy, supplement)
- **Disease Tendency Prediction**: AI-powered prediction of 10+ diseases based on your profile
- **AI Health Report**: Generate AI-powered personalized health recommendations
- **AI Chat**: Context-aware chatbot that knows your simulation data (Gemini API with rate limiting)
- **Dark Circles**: Dynamically rendered based on sleep deficit, fatigue, and stress
- **Dynamic 3D Model**: Eyes, skin, posture, breathing all respond to simulation state
- **Fullscreen Mode**: Press the fullscreen button for immersive view

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- React Three Fiber + Three.js (3D rendering)
- Recharts (data visualization)
- Tailwind CSS 4 + shadcn/ui
- Google Gemini 2.0 Flash API (AI features)
- Rate-limited API endpoints

## Environment Variables

| Variable | File | Description |
|----------|------|-------------|
| `GEMINI_API_KEY` | `.env.local` | Your Google Gemini API key for AI features |

The app works without a Gemini API key — it uses local fallback recommendations and the z-ai-web-dev-sdk as a secondary fallback.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main application page
│   ├── layout.tsx                  # Root layout with fonts
│   ├── globals.css                 # Dark futuristic theme
│   └── api/
│       ├── ai-chat/route.ts        # AI chatbot endpoint
│       └── ai-recommendations/route.ts  # AI recommendations endpoint
├── components/
│   ├── twin/
│   │   ├── HumanBodyCanvas.tsx     # 3D body model + organs
│   │   ├── InputPanel.tsx          # Lifestyle configuration
│   │   ├── OrganDetailsPanel.tsx   # Organ diagnostics + disease tendencies
│   │   ├── TreatmentPanel.tsx      # Treatment simulator
│   │   ├── MetricsCharts.tsx       # Weight/fatigue/health charts
│   │   ├── TimelineSlider.tsx      # 60-day simulation timeline
│   │   ├── AIRecommendationsPanel.tsx  # AI health report display
│   │   └── AIChatBox.tsx           # Floating AI chat widget
│   └── ui/                         # shadcn/ui components
└── lib/
    ├── twin-engine.ts              # Core simulation engine
    ├── twin-types.ts               # TypeScript types + treatment definitions
    └── utils.ts                    # Utility functions
```

## Build for Production

```bash
npm run build
npm start
```
