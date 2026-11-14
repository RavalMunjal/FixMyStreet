# FixMyStreet - Community Issue Reporting System

FixMyStreet is a full-stack mobile and web-connected application designed for citizens to report local civic issues (e.g., potholes, broken streetlights, garbage overflow, water leakages) with real photos, descriptions, and GPS locations. Authorized administrators can review complaints, update their status (Pending, In Progress, Resolved), and attach resolution proof.

## Project Structure

```
FixMyStreet/
├── frontend/             # React Native (Expo Router) Mobile App
│   ├── app/              # Expo Router screens and navigation
│   ├── components/       # Reusable UI components
│   ├── services/         # Axios API client & endpoints
│   ├── context/          # Auth & App context providers
│   ├── constants/        # Theme colors, config, category definitions
│   ├── assets/           # App icons, splash screens, images
│   ├── package.json
│   ├── app.json
│   └── eas.json
├── backend/              # Node.js + Express.js REST API
│   ├── config/           # Database, Cloudinary, & JWT configs
│   ├── controllers/      # Auth, Issue, User, Admin controllers
│   ├── models/           # Mongoose schemas (User, Issue)
│   ├── routes/           # Express API routes
│   ├── middleware/       # Auth, Admin validation, Upload middleware
│   ├── utils/            # Admin seeder, helpers
│   ├── server.js         # API entry point
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

## Tech Stack

- **Frontend**: React Native, Expo (SDK 52+), Expo Router, React Native Maps, Expo Location, Expo Image Picker, Expo SecureStore, Axios
- **Backend**: Node.js, Express.js, MongoDB Atlas (Mongoose), JWT, Bcrypt, Multer, Cloudinary, CORS, Dotenv
- **Architecture**: Role-based access control (Citizen & Admin)

## Submission Details
- **Project**: FixMyStreet Final React Native Project
- **Deadline**: 22 November 2026
