# Plan: Google and Facebook OAuth Login

## Overview
Add "Continue with Google" and "Continue with Facebook" buttons to Login and Register pages. Uses token-based verification (frontend gets OAuth token from provider SDK, sends to backend for verification, backend returns JWT).

## Dependencies to Install

**Backend:**
```bash
npm install google-auth-library
```

**Frontend:**
```bash
npm install @react-oauth/google
```

## Environment Variables

**Backend `.env`:**
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

**Frontend `.env`:**
```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_FACEBOOK_APP_ID=your-facebook-app-id
```

## Changes

### 1. Backend — User Model (`backend/models/User.js`)
- Add fields: `googleId`, `facebookId` (sparse indexed), `authProvider` (enum: local/google/facebook), `avatar`
- Make `password` conditionally required (not required if googleId or facebookId exists)
- Update pre-save hook to skip hashing when no password
- Update `comparePassword` to return false when no password

### 2. Backend — Auth Routes (`backend/routes/auth.js`)
- Extract `generateAuthResponse(user)` helper for JWT generation
- Add `POST /auth/google` — verify Google ID token via `google-auth-library`, find/create user, return JWT
- Add `POST /auth/facebook` — verify access token via Facebook Graph API, find/create user, return JWT
- Both routes handle account linking (if email exists, link social ID)

### 3. Frontend — Auth Service (`frontend/src/services/authService.js`)
- Add `googleLogin(credential)` method
- Add `facebookLogin(accessToken)` method

### 4. Frontend — Auth Store (`frontend/src/store/authStore.js`)
- Add `googleLogin` action
- Add `facebookLogin` action

### 5. Frontend — New Components
- `frontend/src/components/auth/GoogleLoginButton.jsx` — uses `@react-oauth/google`
- `frontend/src/components/auth/FacebookLoginButton.jsx` — loads FB SDK dynamically, custom styled button
- `frontend/src/components/auth/SocialDivider.jsx` — "or" divider

### 6. Frontend — App Entry (`frontend/src/main.jsx`)
- Wrap app with `<GoogleOAuthProvider clientId={...}>`

### 7. Frontend — Login Page (`frontend/src/pages/Login.jsx`)
- Add Google and Facebook buttons above the form
- Add SocialDivider between social buttons and form
- Handle social success (navigate) and error (show message)

### 8. Frontend — Register Page (`frontend/src/pages/Register.jsx`)
- Same as Login: add social buttons, divider
- Social registration = instant login, navigate to home

## File Summary

**Modify (10 files):**
1. `backend/models/User.js`
2. `backend/routes/auth.js`
3. `backend/package.json`
4. `frontend/package.json`
5. `frontend/src/main.jsx`
6. `frontend/src/services/authService.js`
7. `frontend/src/store/authStore.js`
8. `frontend/src/pages/Login.jsx`
9. `frontend/src/pages/Register.jsx`

**Create (3 files):**
1. `frontend/src/components/auth/GoogleLoginButton.jsx`
2. `frontend/src/components/auth/FacebookLoginButton.jsx`
3. `frontend/src/components/auth/SocialDivider.jsx`
