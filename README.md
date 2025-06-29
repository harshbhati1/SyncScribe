# SyncScribe 🧠✨

SyncScribe is an intelligent web application designed to revolutionize your meeting productivity. It offers seamless, AI-driven real-time meeting transcription, allows you to chat interactively with your meeting transcripts, and generates smart, structured summaries. SyncScribe bridges the gap between live meetings, calendar events, and actionable insights, all within a modern, user-friendly interface.

**Live Demo:**
* **Access Link:** [https://syncscribe.me](https://syncscribe.me)

## 🚀 Key Features

SyncScribe isn't just a meeting recorder—it’s a smart, AI-powered productivity tool. Here’s what sets it apart:

1.  **Seamless AI-Driven Meeting Experience:**
    * **Live Transcription:** Record meetings and get real-time, AI-powered transcriptions.
    * **AI Summarization:** After recording, the app generates a smart, structured summary using advanced AI (Google Gemini).
    * **AI Chat:** Ask questions and get context-aware answers by chatting directly with an AI about your meeting transcript.

2.  **Deep Google Calendar Integration:**
    * **Secure OAuth2 Flow:** Connects to Google Calendar using industry-standard OAuth2.
    * **Event-Driven Meeting Creation:** Create new SyncScribe meetings directly from calendar events, automatically using the event’s title.
    * **Unified Dashboard:** Access calendar events and recorded meetings from a single, modern dashboard.

3.  **Advanced Audio Handling & Visualization:**
    * **Browser-Native Recording:** Utilizes the **Web Audio API** for capturing microphone input and real-time audio stream processing, and the **MediaRecorder API** for browser-based recording and chunking audio into blobs.
    * **`ffmpeg.wasm` Re-encoding:** A standout feature where each audio blob is re-encoded in-browser using `ffmpeg.wasm`. This normalizes the audio format (e.g., WAV/MP3), allows parameter adjustments for optimal transcription accuracy with Gemini, and guarantees consistent, high-quality audio input.
    * **Chunked Uploads:** Audio is sent to the backend in 30-second (configurable) chunks, enabling near real-time transcription and reducing client-side memory usage.
    * **Live Audio Visualization:** The **Web Audio API (AnalyserNode)** is used to extract frequency/volume data in real-time, displayed via custom React components (e.g., animated bars) to give users immediate feedback on microphone activity.
    * **Why this is Special:** This combination provides real-time feedback, efficient handling of long recordings, relies on modern browser APIs (no plugins), and ensures a smooth, professional recording experience.

4.  **Robust Title & State Management:**
    * **Smart Title Logic:** Preserves user-customized or calendar event titles, only defaulting to "New Meeting" when truly blank, without being overwritten by summaries unless desired.
    * **LocalStorage Sync:** Persists meeting state, titles, and tokens using `localStorage` for a smooth UX across navigation and reloads.

5.  **Shareable AI Summaries:**
    * **One-Click Sharing:** Generate a public, shareable link for any meeting summary.
    * **Client-Side Routing:** Deep links for shared summaries (e.g., `/summary/shared/abc123`) work seamlessly due to a robust static hosting setup with `_redirects`.

6.  **Modern, Responsive UI:**
    * Built with **Material-UI (MUI)** for a clean, accessible, and mobile-friendly design.
    * Enhanced with custom components for chat, notifications, and empty states for a polished user experience.

7.  **Full-Stack Best Practices & Developer Experience:**
    * **Clean Architecture:** Clear separation of concerns between the React frontend and Node.js/Express backend.
    * **Secure Authentication:** Firebase Auth with backend token verification for all sensitive operations.
    * **Cloud-Native Deployment:** Deployed on Render, utilizing environment variables for configuration and secrets.
    * **Maintainable Code:** Clear commit history with atomic changes and robust error handling.

## 🛠️ Tech Stack

* **Frontend:** React (with React Router), Material-UI (MUI), React Hooks, localStorage, `react-big-calendar`, Google Calendar API (OAuth2), `date-fns`, `marked` (for Markdown).
* **Backend:** Node.js, Express.js, Firebase Authentication, Firestore (Database), Google Gemini API.
* **Audio Processing:** Web Audio API, MediaRecorder API, `ffmpeg.wasm`.
* **Deployment:** Render (for both frontend static site and backend web service).
* [View Project Report](https://github.com/harshbhati1/SyncScribe/blob/main/Project_Report.pdf)

## 🏁 Getting Started

### Prerequisites

* Node.js (v14 or later recommended)
* npm or yarn
* A Firebase project with:
    * Firestore enabled
    * Google Sign-In authentication enabled
* A Google Gemini API key.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/harshbhati1/SyncScribe.git](https://github.com/harshbhati1/SyncScribe.git)
    cd SyncScribe
    ```

2.  **Install Server Dependencies:**
    ```bash
    cd server
    npm install
    ```

3.  **Install Client Dependencies:**
    ```bash
    cd ../client
    npm install
    ```

4.  **Set Up Environment Variables:**
    * In the `server` directory, create a `.env` file.
    * Add the following variables, replacing the placeholder values with your actual credentials:
        ```env
        PORT=3001 # Or your preferred port for the backend
        NODE_ENV=development

        # Firebase Admin SDK Configuration
        # Option 1: Provide individual fields (ensure your private key is properly formatted as a string)
        FIREBASE_PROJECT_ID=your-project-id
        FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
        FIREBASE_CLIENT_EMAIL=your-firebase-client-email@your-project-id.iam.gserviceaccount.com

        # Option 2 (Alternative): Path to your Firebase service account JSON file
        # GOOGLE_APPLICATION_CREDENTIALS=./path/to/your/serviceAccountKey.json

        # Google Gemini API Key
        GEMINI_API_KEY=your-gemini-api-key

        # Google OAuth Client Credentials (for Calendar API - obtained from Google Cloud Console)
        GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
        GOOGLE_CLIENT_SECRET=your-google-client-secret
        GOOGLE_REDIRECT_URI=http://localhost:3000/calendar/callback # Or your frontend callback URL for production
        ```
    * In the `client` directory, create a `.env` file.
    * Add your Firebase Web SDK configuration:
        ```env
        REACT_APP_FIREBASE_API_KEY="your-firebase-web-api-key"
        REACT_APP_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
        REACT_APP_FIREBASE_PROJECT_ID="your-project-id"
        REACT_APP_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
        REACT_APP_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
        REACT_APP_FIREBASE_APP_ID="your-firebase-web-app-id"
        REACT_APP_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com" # For Google Sign-In on client
        REACT_APP_API_BASE_URL=http://localhost:3001 # Backend API URL
        ```
        *(Note: For production, update `REACT_APP_API_BASE_URL` and `GOOGLE_REDIRECT_URI` accordingly).*

### Running the Application

You can start both the client and server together using the `start-SyncScribe.bat` script (on Windows) or run them separately:

1.  **Start the Backend Server:**
    ```bash
    cd server
    npm start
    ```
    The server will typically run on `http://localhost:3001` (or the `PORT` you defined).

2.  **In a new terminal, start the Frontend Client:**
    ```bash
    cd client
    npm start
    ```
    The client will typically run on `http://localhost:3000`.

3.  Open your browser and navigate to `http://localhost:3000`.

## 🏗️ Project Structure

The application is organized into two main directories:
* `client/`: Contains the React frontend application.
* `server/`: Contains the Node.js/Express backend API.

## 💡 Future Enhancements

With additional time, I plan to explore these areas:

* **Audio Processing:**
    * Optimize `ffmpeg.wasm` performance (e.g., using Web Workers for UI responsiveness, exploring streaming encoding for lower latency).
    * Modernize the audio pipeline (e.g., with `AudioWorkletNode`), experiment with efficient codecs (e.g., Opus), and implement resumable uploads for robustness.
* **System & AI Capabilities:**
    * Enhance chat by integrating Firebase Genkit for streamlined session state/history management and real-time persistence.
    * Boost frontend performance by reducing bundle size via code splitting (`React.lazy`) and vigilant dependency optimization through bundle analysis.
## 🌟 Inspiration

This project was developed as a part of a full-stack interview assignment. The original iOS application concept and features that served as the primary inspiration can be found at [TwinMind](https://twinmind.com/).
