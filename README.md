# Online Voting System API

A backend application designed to support secure, organized, and transparent electronic voting. The system is being developed as a group project for a backend development bootcamp.

## Project Overview

The Online Voting System provides an API for managing users, elections, positions, candidates, votes, and election results. It aims to ensure that only authenticated and authorized users can perform permitted actions and that voters cannot vote more than once for the same position in an election.

## Project Information

- **Project Name:** Online Voting System
- **Group:** Group 9
- **Project Type:** Backend API
- **Project Status:** In Development

## Team Members

| Name | Role |
|---|---|
| Godis Akachukwu | Team Leader — Project Setup and Integration |
| Islam Shehu | User Authentication and Authorization |
| Victoria Ogaga-Omokri | Election and Position Management |
| Alhassan Abdul-Aziz | Candidate Management and Voting |
| Uchendu Chigozie Emmanuel | Election Results, Testing and Documentation |

## Technology Stack

- **Node.js** — JavaScript runtime
- **Express.js** — Backend web framework
- **MongoDB** — Database
- **Mongoose** — MongoDB object modeling
- **bcryptjs** — Password hashing
- **JSON Web Token (JWT)** — Authentication
- **Postman** — API testing
- **Git and GitHub** — Version control and collaboration

## Planned Features

- User registration and login
- Secure password hashing
- JWT-based authentication
- Role-based access control for voters and administrators
- Election creation and management
- Position management within elections
- Candidate registration and management
- Vote casting with duplicate-vote prevention
- Election results and vote counting
- API testing and documentation

*Features are being implemented progressively. Not all planned features are available yet.*

## Project Structure

```text
online_voting_Platform/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   └── authController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   └── authRoutes.js
│   ├── app.js
│   └── server.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Additional folders, models, controllers, and routes will be added as development progresses.

## Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (LTS version recommended)
- npm (included with Node.js)
- A MongoDB database, either local MongoDB or MongoDB Atlas
- [Git](https://git-scm.com/)
- [Postman](https://www.postman.com/) for testing API endpoints

## Installation and Setup

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
```

Navigate into the project directory:

```bash
cd online_voting_Platform
```

Replace the repository URL with your actual GitHub repository URL. If your local folder has a different name, use that name instead.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root using `.env.example` as a guide.

Example:

```env
PORT=5500
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
```

Replace the example values with your own configuration. Do not commit your real `.env` file or share database credentials and secrets publicly.

### 4. Start the development server

If the project has the `dev` script configured in `package.json`, run:

```bash
npm run dev
```

Otherwise, start the application with:

```bash
node src/server.js
```

The terminal should show a successful database connection and a message indicating the port on which the server is running.

## API Endpoints

The following endpoints are available in the current authentication starter implementation.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API status |
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Log in a user |
| GET | `/api/auth/me` | Retrieve the authenticated user's information |

Protected endpoints require a valid JWT in the request header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

Election, position, candidate, voting, and results endpoints will be documented here as they are implemented and tested.

## Testing with Postman

1. Start the development server.
2. Send a `GET` request to `http://localhost:5500/api/health`.
3. Register a user using `POST /api/auth/register`.
4. Log in using `POST /api/auth/login`.
5. Copy the returned JWT token.
6. Use the token to test `GET /api/auth/me` with the Bearer Token authorization method.
7. Test requests with missing or invalid tokens to verify that protected routes reject unauthorized access.

Example health-check response:

```json
{
  "success": true,
  "message": "Online Voting System API is running"
}
```

## Security Considerations

- Passwords are hashed before being stored in the database.
- Authentication uses JSON Web Tokens.
- User roles determine which protected actions a user may perform.
- Voting logic is intended to prevent duplicate votes for the same position in an election.
- Database credentials and JWT secrets must be stored in environment variables.
- Administrative privileges must not be assigned through unrestricted public registration.
- Individual voting choices should not be exposed through public results endpoints.

These controls must be verified through implementation and testing before the system is considered production-ready.

## Development Workflow

To support collaboration, each team member should work on their assigned module using a separate Git branch.

```bash
git checkout -b feature/your-module
```

After completing and testing the changes:

```bash
git add .
git commit -m "Describe your changes"
git push -u origin feature/your-module
```

Open a Pull Request on GitHub so the team leader can review the changes before merging them into the main branch.

Avoid committing `.env`, `node_modules`, passwords, tokens, or other sensitive information.

## Project Goals

The project aims to demonstrate practical backend development skills, including:

- REST API design
- Database modeling and relationships
- Authentication and authorization
- Input validation and error handling
- Secure vote processing
- Collaborative software development
- API testing and technical documentation

## Future Improvements

Potential future improvements include automated tests, audit logging, stronger election lifecycle validation, deployment, and additional security controls.

## License

This project is currently an educational group project. A license can be added if the team decides to distribute or reuse the software under specific terms.
