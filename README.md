# React + Vite

This  hu hu huh uhuhutemplate provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Authentication

GreenMove now has a real authentication flow (email/password + Google Sign-In) backed by the
Spring Boot API. See `.env.example` for the required configuration:

- `JWT_SECRET` / `JWT_EXPIRATION_MS` - backend JWT signing secret and token lifetime. **Change
  `JWT_SECRET` before deploying to production.**
- `VITE_GOOGLE_CLIENT_ID` (frontend) and `GOOGLE_CLIENT_ID` (backend) - OAuth 2.0 Web Client ID
  from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Both must
  match. Until these are set, the "Continue with Google" button is shown in a disabled state and
  email/password sign-in/sign-up continue to work normally.

New endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/google`,
`GET /api/v1/auth/me`. Dashboard and other in-app routes now require a signed-in user; visiting
them while signed out redirects to `/signin`.
