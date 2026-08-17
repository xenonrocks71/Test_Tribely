export const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("vercel.app")) {
      return "https://tribely-backend.onrender.com";
    }
    return `http://${hostname}:8000`;
  }
  return "https://tribely-backend.onrender.com";
};

export const getWsBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("vercel.app")) {
      return "wss://tribely-backend.onrender.com";
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${hostname}:8000`;
  }
  return "wss://tribely-backend.onrender.com";
};

export const API_BASE_URL = getApiBaseUrl();
