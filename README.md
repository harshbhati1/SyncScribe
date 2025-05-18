# TwinMind

TwinMind is a web application that enables real-time meeting transcription and AI-powered chat interactions with your meeting transcripts.

## Features

- Google authentication
- Dashboard to access meeting transcriptions
- Real-time audio transcription (coming soon)
- AI-powered chat with transcripts (coming soon)
- Meeting summaries (coming soon)
- Google Calendar integration (coming soon)

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Firebase project with Google authentication enabled
- Gemini API key

### Installation

1. Clone the repository
2. Install server dependencies:
   ```
   cd server
   npm install
   ```

3. Install client dependencies:
   ```
   cd client
   npm install
   ```

4. Set up environment variables:
   - Create a `.env` file in the server directory with the following variables:
     ```
     PORT=3000
     NODE_ENV=development
     FIREBASE_PROJECT_ID=your-project-id
     FIREBASE_PRIVATE_KEY="your-private-key"
     FIREBASE_CLIENT_EMAIL=your-client-email
     GEMINI_API_KEY=your-gemini-api-key
     ```

### Running the Application

You can start both the client and server together using the provided batch file:

```
start-twinmind.bat
```

Or start them separately:

1. Start the server:
   ```
   cd server
   npm start
   ```

2. In a new terminal, start the client:
   ```
   cd client
   npm start
   ```

3. Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Development Workflow

The application is structured as follows:

- `client/`: React frontend application
- `server/`: Express backend API

## License

This project is licensed under the MIT License.
