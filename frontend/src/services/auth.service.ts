import { apiClient } from '../lib/api-client';

export interface UserRegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone_number?: string;
  username?: string;
  avatar_url?: string;
  verification_token?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  full_name: string;
}

export interface OtpSendResponse {
  status: string;
  message: string;
  expires_in: number;
}

export interface OtpVerifyResponse {
  status: string;
  verification_token: string;
  identifier: string;
  reset_token?: string;
  message?: string;
  verified?: boolean;
}

export interface UsernameCheckResponse {
  username: string;
  available: boolean;
  message: string;
}

export const AUTH_COOKIE_NAME = 'tribely_token';

export function setAuthCookie(token: string): void {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 365; // 365 days (keep logged in until explicit logout)
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getAuthCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax`;
}

/**
 * Object-Oriented Auth Service for Frontend Application.
 * Encapsulates authentication calls, token caching, and user state operations.
 */
export class AuthService {
  /**
   * Register a new user account with extended Instagram-style profile fields.
   */
  public async register(payload: UserRegisterPayload): Promise<any> {
    const response = await apiClient.post<any>('/api/auth/register', payload);
    if (response?.access_token && typeof window !== 'undefined') {
      setAuthCookie(response.access_token);
      localStorage.setItem('tribely_token', response.access_token);
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('tribely_user_id', String(response.user_id || response.id));
      localStorage.setItem('tribely_user_name', response.full_name || payload.full_name);
      localStorage.setItem('user', JSON.stringify({
        id: response.user_id || response.id,
        full_name: response.full_name || payload.full_name,
        email: payload.email,
        username: response.username || payload.username,
        phone_number: response.phone_number || payload.phone_number,
        avatar_url: response.avatar_url || payload.avatar_url,
        is_verified: response.is_verified || !!payload.verification_token
      }));
    }
    return response;
  }

  /**
   * Request a 6-digit OTP code sent to email and/or phone.
   */
  public async sendOtp(payload: { email: string; phone_number?: string; purpose?: string }): Promise<OtpSendResponse> {
    return await apiClient.post<OtpSendResponse>('/api/auth/otp/send', payload);
  }

  /**
   * Verify the 6-digit OTP code and retrieve a signed verification token.
   */
  public async verifyOtp(payload: { identifier: string; code: string; purpose?: string }): Promise<OtpVerifyResponse> {
    return await apiClient.post<OtpVerifyResponse>('/api/auth/otp/verify', payload);
  }

  /**
   * Request password reset OTP sent to user email.
   */
  public async forgotPassword(email: string): Promise<{ status: string; message: string }> {
    return await apiClient.post<{ status: string; message: string }>('/api/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    });
  }

  /**
   * Reset user password using verified reset_token.
   */
  public async resetPassword(payload: {
    email: string;
    new_password: string;
    reset_token: string;
  }): Promise<LoginResponse> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const response = await apiClient.post<LoginResponse>('/api/auth/reset-password', {
      email: cleanEmail,
      new_password: payload.new_password,
      reset_token: payload.reset_token,
    });

    if (response.access_token && typeof window !== 'undefined') {
      setAuthCookie(response.access_token);
      localStorage.setItem('tribely_token', response.access_token);
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('tribely_user_id', String(response.user_id));
      localStorage.setItem('tribely_user_name', response.full_name || '');
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: response.user_id,
          full_name: response.full_name,
          email: cleanEmail,
        })
      );
    }

    return response;
  }

  /**
   * Real-time username uniqueness & format check.
   */
  public async checkUsername(username: string): Promise<UsernameCheckResponse> {
    const clean = username.trim().toLowerCase();
    return await apiClient.get<UsernameCheckResponse>(`/api/auth/check-username?username=${encodeURIComponent(clean)}`);
  }

  /**
   * Upload user profile picture (DP) from live camera capture or file dropzone.
   */
  public async uploadAvatar(file: File | Blob, filename: string = 'avatar.jpg'): Promise<{ status: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file, filename);
    return await apiClient.post<{ status: string; url: string }>('/api/auth/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Login user with email and password.
   */
  public async login(email: string, password: string): Promise<LoginResponse> {
    const cleanEmail = email.trim();
    const response = await apiClient.post<LoginResponse>('/api/auth/login', {
      email: cleanEmail,
      username: cleanEmail,
      password: password,
    });

    if (response.access_token && typeof window !== 'undefined') {
      setAuthCookie(response.access_token);
      localStorage.setItem('tribely_token', response.access_token);
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('tribely_user_id', String(response.user_id));
      localStorage.setItem('tribely_user_name', response.full_name || '');
      localStorage.setItem('user', JSON.stringify({
        id: response.user_id,
        full_name: response.full_name,
        email: cleanEmail
      }));
    }

    return response;
  }

  /**
   * Logout user and clear local storage session token & auth cookie.
   */
  public logout(): void {
    if (typeof window !== 'undefined') {
      clearAuthCookie();
      localStorage.removeItem('tribely_token');
      localStorage.removeItem('token');
      localStorage.removeItem('tribely_user_id');
      localStorage.removeItem('tribely_user_name');
      localStorage.removeItem('user');
    }
  }

  /**
   * Check if active JWT session token exists in cookie or storage.
   */
  public isAuthenticated(): boolean {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('tribely_token') || localStorage.getItem('token') || getAuthCookie());
    }
    return false;
  }
}

// Global Singleton Instance for AuthService
export const authService = new AuthService();
