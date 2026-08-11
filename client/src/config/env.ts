// doc 05-06-07 §4.1: "config/ | env access in one file | import.meta.env
// reads + defaults | Never: secrets (VITE_* vars ship to the public
// bundle!)." Read once here — nothing else in the app touches
// import.meta.env directly.
const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error('VITE_API_URL is not set — copy client/.env.example to client/.env');
}

export const env = Object.freeze({
  apiUrl,
});
