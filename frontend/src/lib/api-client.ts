import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * Resolve backend URL dynamically.
 */
const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('vercel.app')) {
      return 'https://tribely-backend.onrender.com';
    }
    if (hostname.includes('trycloudflare.com') || hostname.includes('loca.lt') || hostname.includes('ngrok')) {
      return 'http://localhost:8000';
    }
    return `http://${hostname}:8000`;
  }
  return 'https://tribely-backend.onrender.com';
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
          const token = localStorage.getItem('tribely_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
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

    // Response Interceptor: Expired session cleanup
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          localStorage.removeItem('tribely_token');
          localStorage.removeItem('token');
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          const path = window.location.pathname;
          if (!path.startsWith('/login') && !path.startsWith('/register') && !path.startsWith('/forgot-password') && !path.startsWith('/reset-password')) {
            window.location.href = '/login';
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

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }
}

// Global Singleton Axios Client Instance
export const apiClient = new ApiClient();

