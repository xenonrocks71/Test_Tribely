import { apiClient } from '../lib/api-client';
import { ApiSuccessResponse } from './arena.service';

export interface ProofSubmissionPayload {
  arena_id: number;
  proof_url: string;
  client_submitted_at?: string;
}

export interface VotePayload {
  vote_type: 'upvote' | 'downvote' | 'up' | 'down';
}

/**
 * Object-Oriented Activity & Timeline Service.
 * Encapsulates daily habit proof posting, peer voting, timeline fetching, and message posting.
 */
export class ActivityService {
  /**
   * Submit daily habit proof for an arena.
   */
  public async submitProof(payload: ProofSubmissionPayload): Promise<ApiSuccessResponse> {
    return apiClient.post('/api/activity/submit', payload);
  }

  /**
   * Cast an upvote or downvote on a submission.
   */
  public async voteOnSubmission(submissionId: number, voteType: 'upvote' | 'downvote'): Promise<any> {
    return apiClient.post(`/api/activity/submission/${submissionId}/vote`, { vote_type: voteType });
  }

  /**
   * Fetch room timeline history (combined submissions and chat messages).
   */
  public async getArenaHistory(arenaId: number): Promise<ApiSuccessResponse> {
    return apiClient.get(`/api/activity/arena/${arenaId}/history`);
  }

  /**
   * Post a chat message into an arena room.
   */
  public async sendArenaMessage(arenaId: number, content: string, messageType: string = 'text'): Promise<ApiSuccessResponse> {
    return apiClient.post(`/api/activity/arena/${arenaId}/message`, {
      content,
      message_type: messageType,
    });
  }
}

// Global Singleton Instance for ActivityService
export const activityService = new ActivityService();
