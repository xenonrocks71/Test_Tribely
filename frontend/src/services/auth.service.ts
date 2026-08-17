import { apiClient } from '../lib/api-client';

export interface UserRegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  full_name: string;
}

/**
 * Object-Oriented Auth Service for Frontend Application.
 * Encapsulates authentication calls, token caching, and user state operations.
 */
export class AuthService {
  /**
   * Register a new user account.
   */
  public async register(payload: UserRegisterPayload): Promise<any> {
    const response = await apiClient.post<any>('/api/auth/register', payload);
    if (response?.access_token && typeof window !== 'undefined') {
      localStorage.setItem('tribely_token', response.access_token);
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('tribely_user_id', String(response.user_id || response.id));
      localStorage.setItem('tribely_user_name', response.full_name || payload.full_name);
      localStorage.setItem('user', JSON.stringify({
        id: response.user_id || response.id,
        full_name: response.full_name || payload.full_name,
        email: payload.email
      }));
    }
    return response;
  }

  /**
   * Login user with email and password via OAuth2 form payload.
   */
  public async login(email: string, password: string): Promise<LoginResponse> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await apiClient.post<LoginResponse>('/api/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.access_token && typeof window !== 'undefined') {
      localStorage.setItem('tribely_token', response.access_token);
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('tribely_user_id', response.user_id.toString());
      localStorage.setItem('tribely_user_name', response.full_name);
      localStorage.setItem('user', JSON.stringify({
        id: response.user_id,
        full_name: response.full_name,
        email: email
      }));
    }

    return response;
  }

  /**
   * Logout user and clear local storage session token.
   */
  public logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  /**
   * Check if active JWT session token exists.
   */
  public isAuthenticated(): boolean {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('token');
    }
    return false;
  }
}

// Global Singleton Instance for AuthService
export const authService = new AuthService();
