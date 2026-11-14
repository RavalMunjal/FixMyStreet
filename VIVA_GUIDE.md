# FixMyStreet – College Viva Preparation & Architecture Guide

This guide contains simple, clear, point-by-point explanations for your college project viva presentation and code walkthrough.

---

## 1. How the React Native Frontend Works
- **Framework**: Built with **React Native** and **Expo Router** using functional components and hooks (`useState`, `useEffect`, `useCallback`).
- **Single Page Architecture**: Screens are organized using file-based routing inside `app/`.
  - `(auth)`: Login and Registration screens.
  - `(citizen)`: Home dashboard, All issues, Report form, GPS map, My reports, and Profile.
  - `(admin)`: Management dashboard, Review & resolution, and Registered user directory.
- **Role-Based Navigation**: When the app starts, `_layout.jsx` checks the stored token via `AuthContext`. If the user has `role: 'admin'`, they are directed to the Admin portal. If `role: 'citizen'`, they enter the Citizen app.

---

## 2. How Axios Calls the Backend
- Centralized in `services/api.js`.
- An **Axios instance** (`api`) is configured with `baseURL` pointing to the backend (`/api`).
- **Request Interceptor**: Before any HTTP request is sent over the network, Axios intercepts it, reads the stored JWT token from `tokenStorage` (`expo-secure-store`), and automatically attaches it as an `Authorization: Bearer <token>` header.
- **Response Interceptor**: Catches HTTP response errors (like 401 Session Expired, 403 Forbidden, 404 Not Found, 500 Server Error) and translates them into clean, human-readable error messages for the UI.

---

## 3. How Express Routes & Controllers Work
- In `backend/server.js`, Express mounts modular routers:
  - `/api/auth` -> User registration, login, session verification (`authController.js`)
  - `/api/issues` -> Issue reporting, fetching all/nearby/my issues (`issueController.js`)
  - `/api/users` -> Profile view & update (`userController.js`)
  - `/api/admin` -> Dashboard metrics, complaint review, resolving issues, viewing users (`adminController.js`)
  - `/api/uploads` -> Multipart photo upload handling (`uploadController.js`)
- **Middleware**:
  - `protect` (`middleware/auth.js`): Verifies JWT signature and extracts user ID.
  - `requireAdmin` (`middleware/admin.js`): Ensures `req.user.role === 'admin'`. Citizens are rejected with HTTP 403 Forbidden.
  - `errorHandler` (`middleware/errorHandler.js`): Formats errors into `{ success: false, message: ... }`.

---

## 4. How JWT Authentication Works
1. When a citizen registers or logs in with their email and password, the backend verifies credentials against MongoDB.
2. The user's password is encrypted using **bcrypt** (salted hash) and never stored as plain text.
3. The server signs a **JSON Web Token (JWT)** containing `{ id: user._id, role: user.role }` using a secret key (`JWT_SECRET`).
4. The React Native app receives this token and saves it in `expo-secure-store` on Android (encrypted mobile keychain).
5. On subsequent app launches, `tokenStorage.getToken()` restores the session, and `/api/auth/me` validates whether the token is still active.

---

## 5. How MongoDB Stores Complaints
- Mongoose schema defined in `backend/models/Issue.js`:
  - `title`, `description`, `category` (Pothole, Broken Streetlight, Garbage, etc.)
  - `imageUrl` (hosted photo URL)
  - `latitude`, `longitude`, and human-readable `address`
  - `status`: `'Pending' | 'In Progress' | 'Resolved'`
  - `reportedBy`: ObjectId referencing the `User` who filed the complaint.
  - `adminNote`: Notes provided by municipal administrators during review.
  - `resolutionImageUrl`: Resolution proof photo uploaded after repair.
  - `statusHistory`: Array tracking who changed the status, at what time, and why.
- High-performance indexes are created on `status`, `category`, and `[latitude, longitude]` for fast geolocation lookups.

---

## 6. How Photo Upload Works
1. The user taps "Take Photo" or "Choose from Gallery" in the mobile app using `expo-image-picker`.
2. The image file is sent to `POST /api/uploads/image` as `multipart/form-data`.
3. In `backend/middleware/upload.js`, **Multer** validates file type (JPEG, PNG, WEBP) and limits size to 5MB.
4. In `backend/controllers/uploadController.js`, the image stream is uploaded directly to **Cloudinary CDN**.
5. Cloudinary returns a permanent HTTPS URL (`secure_url`).
6. The backend saves this URL in MongoDB under the complaint record. The image stays accessible forever across app restarts.

---

## 7. How GPS and Maps Work
- **GPS Location**: Handled by `expo-location`. The app requests device foreground location permissions. When granted, `Location.getCurrentPositionAsync()` fetches the exact `latitude` and `longitude`.
- **Reverse Geocoding**: `Location.reverseGeocodeAsync()` translates coordinates into a readable street, area, and city address.
- **Map Display**: Uses `react-native-maps` (`MapView`, `Marker`, `Callout`).
- Coordinates fetched from MongoDB are plotted as custom colored markers:
  - 🟠 **Orange / Amber**: Pending review
  - 🔵 **Blue**: Under active repair (In Progress)
  - 🟢 **Green**: Fixed & Resolved
- Tapping a pin displays the complaint details preview.

---

## 8. How Admin Status Updates Work
1. When an administrator reviews a complaint in the Admin Portal, they can change the status from **Pending** to **In Progress** or **Resolved**.
2. They enter an administrative note and optionally upload a resolution proof photo.
3. The request hits `PATCH /api/admin/issues/:id/status` or `POST /api/admin/issues/:id/resolve`.
4. The backend verifies the admin role via `requireAdmin` middleware.
5. An audit entry is appended into `statusHistory` with the admin's ID, timestamp, and explanation.
6. The update is saved in MongoDB and immediately reflects on the citizen dashboard and complaint tracking screen.

---

## 9. How the Android APK Connects to the Online Backend
- In local development (`__DEV__`), the app can point to your local machine IP.
- For the standalone Android APK, `frontend/constants/config.js` uses `PRODUCTION_API_URL` pointing to your hosted Node.js server (e.g. Render / Railway) via HTTPS:
  ```js
  export const PRODUCTION_API_URL = 'https://fixmystreet-backend.onrender.com/api';
  ```
- All mobile network calls use encrypted HTTPS traffic supported by Android network security configuration.
