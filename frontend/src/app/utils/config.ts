export const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.includes("trycloudflare.com") ||
      hostname.includes("loca.lt") ||
      hostname.includes("ngrok")
    ) {
      return `http://${hostname}:8000`;
    }
    return "https://tribely-backend.onrender.com";
  }
  return "https://tribely-backend.onrender.com";
};

export const getWsBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.includes("trycloudflare.com") ||
      hostname.includes("loca.lt") ||
      hostname.includes("ngrok")
    ) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${hostname}:8000`;
    }
    return "wss://tribely-backend.onrender.com";
  }
  return "wss://tribely-backend.onrender.com";
};

export const API_BASE_URL = getApiBaseUrl();
