import { apiClient } from '../lib/api-client';

export interface ArenaCreatePayload {
  name: string;
  description?: string;
  proof_type: 'image' | 'link' | 'text';
  penalty_amount: number;
  deadline_time: string;
  is_private: boolean;
}

export interface ApiSuccessResponse<T = any> {
  status: string;
  data: T;
}

/**
 * Object-Oriented Arena Service for Frontend Application.
 * Encapsulates arena discovery feeds, room joins, leave logic, and member queries.
 */
export class ArenaService {
  /**
   * Fetch all arenas joined by the logged-in user.
   */
  public async getMyArenas(): Promise<ApiSuccessResponse> {
    return apiClient.get('/api/arenas/');
  }

  /**
   * Fetch public discovery list of all arenas.
   */
  public async getPublicDiscoveryList(): Promise<ApiSuccessResponse> {
    return apiClient.get('/api/arenas/discovery/list');
  }

  /**
   * Create a new micro-arena.
   */
  public async createArena(payload: ArenaCreatePayload): Promise<ApiSuccessResponse> {
    return apiClient.post('/api/arenas/', payload);
  }

  /**
   * Join an arena via public gatekeeper request.
   */
  public async requestDiscoveryJoin(arenaId: number): Promise<any> {
    return apiClient.post('/api/arenas/discovery/join', { arena_id: arenaId });
  }

  /**
   * Join an arena using a 6-character invite code.
   */
  public async joinByInviteCode(inviteCode: string): Promise<ApiSuccessResponse> {
    return apiClient.post('/api/arenas/join-by-code', { invite_code: inviteCode });
  }

  /**
   * Fetch active approved members inside an arena room.
   */
  public async getArenaMembers(arenaId: number): Promise<ApiSuccessResponse> {
    return apiClient.get(`/api/arenas/${arenaId}/members`);
  }

  /**
   * Leave an arena room.
   */
  public async leaveArena(arenaId: number): Promise<any> {
    return apiClient.post(`/api/arenas/${arenaId}/leave`);
  }
}

// Global Singleton Instance for ArenaService
export const arenaService = new ArenaService();
