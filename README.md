# Mini Project Quiz App

A simple online quiz application built with Node.js, Express, and MongoDB. It serves a frontend from the `public` directory and exposes REST API routes for domains, questions, and quiz operations.

## Features

- Quiz app backend with Express
- MongoDB database integration
- Auto-seeding of quiz data on first run
- Health check endpoint
- Static frontend served from `public`
- Development mode with `nodemon`

## Tech Stack

- Node.js >= 18
- Express
- MongoDB
- Mongoose
- CORS
- Dotenv

## Project Structure

```bash
.
├── controllers/
├── models/
├── public/
├── routes/
├── seeds/
├── services/
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Prerequisites

Before running the project, make sure you have:

- Node.js 18 or newer
- MongoDB installed locally, or a MongoDB connection string
- npm or yarn

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Sankar7567/mini_project_quiz_app.git
cd mini_project_quiz_app
```

2. Install dependencies:

```bash
npm install
```

3. Create your environment file:

```bash
cp .env.example .env
```

4. Update the environment variables in `.env` if needed:

```env
MONGODB_URI=mongodb://localhost:27017/quizapp
PORT=3000
NODE_ENV=development
```

## Running the App

### Start in production mode

```bash
npm start
```

### Start in development mode

```bash
npm run dev
```

The app will run on:

```text
http://localhost:3000
```

## Seed Data

The app automatically seeds sample quiz data into MongoDB when the database is empty. You can also seed manually:

```bash
npm run seed
```

## API Endpoints

The server exposes the following base routes:

- `GET /api/health` — checks server and database status
- `GET /api/domains`
- `GET /api/questions`
- `GET /api/quiz`

## Notes

- If MongoDB is not available, the app will still start in offline mode and log a warning, but database-dependent API calls may fail.
- The application serves the frontend from the `public` folder, so the main UI opens at the root URL.

## License

This project is licensed under the MIT License.
