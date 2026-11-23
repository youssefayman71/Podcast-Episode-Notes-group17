# Podcast Episode Notes — Phase 2

Cloud Computing Project — Group 17

**Team members:**
- Youssef — Episode Discovery
- Steven — Notes Management
- Anas — Library and Authentication

## Project Overview

Podcast Episode Notes is a web application where users can search for podcast episodes, save them to their library, and create timestamped notes while listening.

Users can also organize notes using tags, track their listening progress, and search their saved notes. An administrator can approve or block imported episodes.

## Technologies Used

- Node.js and Express — Backend API
- HTML, CSS, JavaScript — Frontend
- Docker and Floci — Local AWS environment
- AWS Lambda — Backend functions
- Amazon API Gateway — API routing
- Amazon DynamoDB — Database
- Amazon S3 — Frontend hosting
- AWS IAM — Access permissions
- Amazon CloudWatch — Logging
- iTunes Search API — Podcast discovery

## Project Structure

- `backend/` — Backend API, authentication, and Lambda code
- `frontend/` — Website files
- `infra/` — Infrastructure scripts and configuration

## Local Setup

1. Install Node.js, npm, Docker Desktop, and Floci.
2. Open the project in VS Code.
3. Open a terminal inside `backend/`.
4. Run `npm install`.
5. Copy `.env.example` to `.env`.
6. Set a secure `AUTH_SECRET` in `.env`.
7. Run `npm start` to start the local backend.

For the local frontend, run this command from the project root:

```bash
npx http-server frontend -p 8080
```

Open `http://localhost:8080` in your browser.

The local backend uses SQLite by default. The Floci deployment uses DynamoDB.

## Floci Deployment

The application was deployed and tested using Floci, a local AWS emulator running through Docker.

The deployment includes three Lambda functions:

- `podcast-discovery-lambda` — Episode search, import, and moderation
- `podcast-notes-lambda` — Timestamped notes and review status
- `podcast-library-lambda` — Authentication, library, tags, and listening progress

API Gateway connects the frontend to these functions. DynamoDB stores the application data, and CloudWatch records API activity.

The frontend is hosted in the S3 bucket `podcast-notes-web`.

**Frontend URL:**

http://localhost:4566/podcast-notes-web/index.html

**Floci Dashboard:**

http://localhost:4500

Docker and Floci must be running to access these local URLs. They are not public internet addresses.

Additional deployment instructions are in `docs/DEPLOY_FLOCI.md`.

## Features Tested

- User registration and login
- Search for episodes using iTunes
- Import and save episodes
- View and manage saved episodes
- Create, search, update, and delete timestamped notes
- Mark notes as reviewed
- Create and delete tags
- Track listening progress
- Administrator approval and blocking of episodes
- Authentication and user access restrictions

## Security

The application uses password hashing and signed authentication tokens. User data is protected by backend authorization checks, and administrator actions require an administrator account.

The three Lambda functions have separate IAM roles and policies.

Environment files containing secrets are excluded from Git.

## Limitations

The deployment runs locally using Floci and is not publicly hosted. The application also uses a basic DynamoDB data model and a custom token-based authentication system intended for this project.

The iTunes search feature requires an internet connection.
