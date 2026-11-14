# FixMyStreet – Community Civic Issue Reporting Mobile Application

[![React Native](https://img.shields.io/badge/React%20Native-0.76-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-52-black.svg)](https://expo.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B-green.svg)](https://nodejs.org/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)](https://www.mongodb.com/cloud/atlas)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Image%20Uploads-blueviolet.svg)](https://cloudinary.com/)

**FixMyStreet** is a full-stack civic issue-reporting mobile application developed with **React Native (Expo)** and **Node.js Express + MongoDB Atlas**. Citizens can report local public infrastructure problems (such as potholes, broken streetlights, garbage overflow, water leakage, and damaged roads) with photos, descriptions, and GPS locations. Authorized administrators can review complaints, update their status (**Pending → In Progress → Resolved**), attach administrative notes, and upload resolution proof photos.

---

## 📱 Features

### 👤 Citizen Application
- **User Authentication**: Secure registration and login using JWT & bcrypt password hashing.
- **Home Dashboard**: Real-time MongoDB counts of total, pending, in-progress, and resolved complaints, along with quick actions.
- **Report an Issue**:
  - Live photo capture via camera or gallery picker (`expo-image-picker`).
  - GPS coordinate capture and street address reverse geocoding (`expo-location`).
  - Category selection (Pothole, Broken Streetlight, Garbage, Water Leakage, Drainage, Road Damage, Other).
  - Instant image upload to Cloudinary CDN with Cloudinary URL stored in MongoDB.
- **All Issues Board**: Filter by category, search by title or landmark, filter by status, and pull-to-refresh.
- **Nearby Map**: Interactive GPS map (`react-native-maps`) with custom color-coded status pins:
  - 🟠 **Orange / Amber**: Pending review
  - 🔵 **Blue**: In Progress / Under repair
  - 🟢 **Green**: Fixed & Resolved
- **My Complaints**: Private timeline of all complaints filed by the authenticated citizen.
- **Complaint Details**: Full-screen photo, GPS coordinates, address, and live audit history timeline.
- **Citizen Profile**: View complaint statistics, edit profile name/email/password, and sign out.

### 🛡️ Administrator Portal (Inside Same APK)
- **Role-Based Routing**: Authenticated administrators are automatically navigated to the Admin Control Center.
- **Admin Dashboard**: Real-time system metrics (total reports, pending, in progress, resolved, registered citizens).
- **Complaint Management**: Filter complaints by status or category, inspect reports, and view citizen details.
- **Status Updates & Resolution**:
  - Transition status: `Pending → In Progress → Resolved`.
  - Add administrative notes to update citizens.
  - Upload photographic proof of resolution.
- **Citizen Directory**: Review registered citizens and their complaint counts.

---

## 🗂️ Project Structure

```
FixMyStreet/
├── frontend/                     # React Native Expo Mobile App
│   ├── app/                      # Expo Router File-Based Routing
│   │   ├── (auth)/               # Login & Registration Screens
│   │   │   ├── _layout.jsx
│   │   │   ├── login.jsx
│   │   │   └── register.jsx
│   │   ├── (citizen)/            # Citizen Screens & Bottom Tabs
│   │   │   ├── _layout.jsx
│   │   │   ├── home.jsx
│   │   │   ├── report.jsx
│   │   │   ├── map.jsx
│   │   │   ├── my-complaints.jsx
│   │   │   ├── profile.jsx
│   │   │   └── issues/
│   │   │       ├── index.jsx
│   │   │       └── [id].jsx
│   │   ├── (admin)/              # Administrator Control Center
│   │   │   ├── _layout.jsx
│   │   │   ├── dashboard.jsx
│   │   │   ├── issues/
│   │   │   │   ├── index.jsx
│   │   │   │   └── [id].jsx
│   │   │   ├── users.jsx
│   │   │   └── profile.jsx
│   │   ├── _layout.jsx           # Root Navigation & Auth Session Guard
│   │   └── index.jsx             # Splash Screen
│   ├── components/               # Reusable UI Components
│   │   ├── Badge.jsx
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── EmptyState.jsx
│   │   ├── Header.jsx
│   │   ├── Input.jsx
│   │   └── Loading.jsx
│   ├── constants/                # Colors, Theme, Categories & API Config
│   │   ├── categories.js
│   │   ├── config.js
│   │   └── theme.js
│   ├── context/                  # AuthContext & Session Management
│   │   └── AuthContext.js
│   ├── services/                 # Centralized Axios API & Token Storage
│   │   ├── api.js
│   │   └── storage.js
│   ├── app.json                  # Expo Configuration & Android Permissions
│   ├── eas.json                  # EAS Build Configuration for Android APK
│   └── package.json
├── backend/                      # Node.js + Express.js REST API
│   ├── config/                   # Database (Mongoose) & Cloudinary Configs
│   │   ├── cloudinary.js
│   │   └── db.js
│   ├── controllers/              # Business Logic & Request Handlers
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── issueController.js
│   │   ├── uploadController.js
│   │   └── userController.js
│   ├── middleware/               # Auth, Admin Guard, Upload & Error Handlers
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── upload.js
│   ├── models/                   # Mongoose Schemas (User, Issue)
│   │   ├── Issue.js
│   │   └── User.js
│   ├── routes/                   # Express API Endpoints
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── issueRoutes.js
│   │   ├── uploadRoutes.js
│   │   └── userRoutes.js
│   ├── test/                     # Automated API Test Suite
│   │   └── api.test.js
│   ├── utils/                    # Admin Provisioning Seeder
│   │   └── seedAdmin.js
│   ├── render.yaml               # Render Deployment Blueprint
│   ├── Procfile                  # Production Process File
│   ├── server.js                 # API Entry Point
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Mobile Frontend** | React Native, Expo (SDK 52), Expo Router, React Native Maps, Expo Location, Expo Image Picker, Expo SecureStore, Axios |
| **Backend API** | Node.js, Express.js, JWT, BcryptJS, Multer, Express Rate Limit, CORS, Dotenv |
| **Database** | MongoDB Atlas (Cloud Database), Mongoose ORM |
| **Media Storage** | Cloudinary Cloud Media CDN |
| **Build & Deploy** | Expo EAS Build (Android APK), Render (Node.js API Hosting), GitHub |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo Go app on your physical Android phone (or Android Studio emulator)
- Free MongoDB Atlas cluster
- Free Cloudinary account

---

### Step 1: Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd FixMyStreet/backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Configure your `.env` credentials:
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/fixmystreet?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=7d

   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret

   ADMIN_EMAIL=admin@fixmystreet.com
   ADMIN_PASSWORD=Admin@123456
   ADMIN_NAME=Super Administrator
   ```
5. Provision the default Admin account:
   ```bash
   npm run seed:admin
   ```
6. Run the automated API verification test suite:
   ```bash
   npm test
   ```
7. Start the backend development server:
   ```bash
   npm start
   ```

---

### Step 2: Mobile Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd FixMyStreet/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your backend IP / URL in `frontend/constants/config.js`:
   - For Android Emulator: `http://10.0.2.2:5000/api`
   - For Physical Phone on same Wi-Fi: `http://<YOUR_PC_LOCAL_IP>:5000/api` (e.g. `http://192.168.1.100:5000/api`)
   - For Hosted Production: `https://<your-render-app>.onrender.com/api`
4. Start the Expo development server:
   ```bash
   npm start
   ```
5. Scan the QR code using the **Expo Go** app on your Android device.

---

## 📡 REST API Documentation

All responses follow a consistent JSON format:
```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... }
}
```

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Backend health check |
| `POST` | `/api/auth/register` | Public | Register a new citizen account |
| `POST` | `/api/auth/login` | Public | Authenticate user & return JWT |
| `GET` | `/api/auth/me` | Private | Verify token & get current user profile |
| `GET` | `/api/issues` | Public | List complaints with category/status/search filters |
| `POST` | `/api/issues` | Citizen | Report a new street issue with photo & GPS |
| `GET` | `/api/issues/my` | Citizen | List complaints submitted by logged-in user |
| `GET` | `/api/issues/nearby` | Public | Query issues near GPS latitude & longitude |
| `GET` | `/api/issues/:id` | Public | View full complaint details & audit history |
| `GET` | `/api/users/me` | Private | Get profile information and reporting metrics |
| `PATCH` | `/api/users/me` | Private | Update name, email, or password |
| `GET` | `/api/admin/dashboard` | Admin | Real-time counts for complaints and users |
| `GET` | `/api/admin/issues` | Admin | List all complaints for administrative review |
| `PATCH` | `/api/admin/issues/:id/status`| Admin | Change status & append admin audit note |
| `POST` | `/api/admin/issues/:id/resolve`| Admin | Mark resolved & attach resolution photo |
| `GET` | `/api/admin/users` | Admin | List registered citizens with complaint counts |
| `POST` | `/api/uploads/image` | Private | Upload image file (max 5MB) to Cloudinary |

---

## 🌐 Production Backend Deployment (Render)

1. Create a free account on [Render](https://render.com/).
2. Click **New +** → **Web Service** and connect this GitHub repository (`https://github.com/RavalMunjal/FixMyStreet.git`).
3. Set **Root Directory** to `FixMyStreet/backend` (or select the `render.yaml` blueprint).
4. Configure Environment Variables on Render:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: Your MongoDB Atlas connection URI.
   - `JWT_SECRET`: A secure random secret string.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
5. Deploy service. Once live, test `https://<your-app>.onrender.com/api/health`.

> ℹ️ *Note for Free Tier Hosting*: Free Render instances spin down after 15 minutes of inactivity and take ~30-50 seconds to respond on cold starts.

---

## 📦 Android APK Generation (Expo EAS Build)

To build a standalone installable Android APK:

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Log in to your Expo account:
   ```bash
   eas login
   ```
3. Update `frontend/constants/config.js` with your live backend HTTPS URL:
   ```js
   export const PRODUCTION_API_URL = 'https://<your-render-app>.onrender.com/api';
   ```
4. Build the standalone preview APK:
   ```bash
   cd FixMyStreet/frontend
   eas build -p android --profile preview
   ```
5. When the build finishes on the Expo cloud, download the `.apk` file and upload it to Google Drive.

---

## 📄 Submission Checklist
- [x] Complete React Native mobile app with Expo Router.
- [x] Full Node.js + Express.js backend with MongoDB Atlas.
- [x] Real JWT authentication with Citizen and Admin role isolation.
- [x] Cloudinary photographic uploads with Multer validation.
- [x] GPS location capture and interactive React Native Maps with status markers.
- [x] Full Admin Review & Resolution workflow with audit history.
- [x] Automated test suite passing with 100% success.
- [x] Render deployment blueprint (`render.yaml`).
- [x] Standalone Android APK build configuration (`eas.json`).
- [x] Complete source code on GitHub.
