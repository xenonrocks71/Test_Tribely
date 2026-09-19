import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * Resolve backend URL dynamically.
 */
export const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Local development hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')
    ) {
      return `http://${hostname}:8000`;
    }
    // Tunnels used for webhook / device testing
    if (hostname.includes('trycloudflare.com') || hostname.includes('loca.lt') || hostname.includes('ngrok')) {
      return 'http://localhost:8000';
    }
    // All deployed production domains (including tribely.mayurkpatil.in, vercel.app)
    return 'https://tribely-backend.onrender.com';
  }
  return 'https://tribely-backend.onrender.com';
};

/**
 * Ensures any relative uploaded proof media path (e.g. '/static/uploads/proof_123.jpg')
 * is reliably resolved to an absolute backend URL in production, staging, and local environments.
 *
 * Special handling for local dev: If a URL contains '/static/uploads/' pointing to any host,
 * it is rewritten as a relative path so the Next.js proxy rewrite (/static/uploads/* → backend)
 * can serve it correctly. This fixes the case where old DB records stored absolute localhost:8000 URLs
 * that wouldn't load when the browser makes cross-port requests.
 */
export const resolveBackendUrl = (url?: string): string => {
  if (!url) return '';
  const trimmed = url.trim();

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // If already an absolute HTTP/HTTPS URL:
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      // If pointing to localhost/127.0.0.1 and running in non-local production environment, rewrite to production backend
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0') {
          const base = getBaseUrl().replace(/\/+$/, '');
          return `${base}${parsed.pathname}${parsed.search}`;
        }
      }
      // If pointing to cloud storage, CDN, or Render backend, keep absolute!
      return trimmed;
    } catch {
      // URL parsing failed, fall through to relative path logic
    }
  }

  // Relative path (e.g. '/static/uploads/...', '/uploads/...', 'uploads/...')
  const base = getBaseUrl().replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  return `${base}${path}`;
};

/**
 * Production HTTP API Client Singleton.
 * Configured with automatic JWT auth header injection, base URL resolution,
 * request/response interceptors, and typed response handling.
 */
class ApiClient {
  public instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: getBaseUrl(),
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    this.initializeInterceptors();
  }

  /**
   * Configure Axios request and response interceptors.
   */
  private initializeInterceptors(): void {
    // Request Interceptor: Attach JWT Bearer token from localStorage (checking all token key variants)
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (typeof window !== 'undefined') {
          let token = localStorage.getItem('tribely_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
          if (!token && typeof document !== 'undefined') {
            const match = document.cookie.match(/(?:^|;\s*)tribely_token=([^;]*)/);
            if (match) {
              token = decodeURIComponent(match[1]);
              try {
                localStorage.setItem('tribely_token', token);
                localStorage.setItem('token', token);
              } catch {}
            }
          }
          if (token && config.headers) {
            if (typeof config.headers.set === 'function') {
              config.headers.set('Authorization', `Bearer ${token}`);
            } else {
              config.headers['Authorization'] = `Bearer ${token}`;
            }
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response Interceptor: Session cleanup only on confirmed token expiration
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          const reqUrl = error.config?.url || '';
          // Do not wipe credentials or redirect if the 401 came from login, register, or otp flows
          if (
            reqUrl.includes('/api/auth/login') ||
            reqUrl.includes('/api/auth/register') ||
            reqUrl.includes('/api/auth/otp') ||
            reqUrl.includes('/api/auth/forgot-password') ||
            reqUrl.includes('/api/auth/reset-password')
          ) {
            return Promise.reject(error);
          }

          // Check if JWT token has expired or is absent
          const token = localStorage.getItem('tribely_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
          let isExpired = true;
          if (token) {
            try {
              const payloadBase64 = token.split('.')[1];
              if (payloadBase64) {
                const payload = JSON.parse(atob(payloadBase64));
                if (payload.exp && payload.exp * 1000 > Date.now()) {
                  isExpired = false;
                }
              }
            } catch {}
          }

          // Only wipe device session if the token has actually expired
          if (isExpired) {
            localStorage.removeItem('tribely_token');
            localStorage.removeItem('token');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            const path = window.location.pathname;
            if (
              !path.startsWith('/login') &&
              !path.startsWith('/register') &&
              !path.startsWith('/forgot-password') &&
              !path.startsWith('/reset-password')
            ) {
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }
}

// Global Singleton Axios Client Instance
export const apiClient = new ApiClient();

