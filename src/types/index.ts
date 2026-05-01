export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'super_admin' | 'provider';

export interface Submission {
    id: string;
    type: 'photo' | 'message' | 'audio';
    content: string;
    author?: string;
    status: SubmissionStatus;
    in_album?: boolean;
    event_id?: string;
    created_at: string;
    moderated_by?: string;
    moderated_at?: string;
    uploaded_by_ip?: string;
}

export interface Profile {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
    user_type?: 'client' | 'provider' | 'admin';
    is_active?: boolean;
    created_at: string;
    updated_at: string;
}

export interface Event {
    id: string;
    name: string;
    slug: string;
    date?: string;
    location?: string;
    is_active: boolean;
    created_by?: string;
    created_at: string;
    updated_at?: string;
}

export interface EventProvider {
    id: string;
    event_id: string;
    provider_id: string;
    assigned_at: string;
    assigned_by?: string;
}

export interface EventWithProvider extends Event {
    providers?: Profile[];
}

// ---- Trivia Types ----
export type TriviaOption = 'a' | 'b' | 'c' | 'd';

export interface TriviaGame {
    id: string;
    event_id: string;
    title: string;
    status: 'setup' | 'lobby' | 'active' | 'results' | 'finished';
    current_question_id?: string | null;
    question_started_at?: string | null;
    question_duration_seconds?: number;
    created_at: string;
    updated_at: string;
}

export interface TriviaQuestion {
    id: string;
    game_id: string;
    event_id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: TriviaOption;
    points: number;
    order_index: number;
    created_at: string;
}

export interface TriviaPlayer {
    id: string;
    game_id: string;
    event_id: string;
    player_name: string;
    score: number;
    answers_correct: number;
    answers_total: number;
    is_eliminated: boolean;
    created_at: string;
}

export interface TriviaAnswer {
    id: string;
    game_id: string;
    question_id: string;
    player_id: string;
    selected_option: TriviaOption;
    is_correct: boolean;
    points_earned: number;
    speed_bonus: number;
    created_at: string;
}

export interface PhotoVoteSession {
    id: string;
    event_id: string;
    status: 'inactive' | 'active' | 'finished';
    winner_submission_id?: string | null;
    selected_submission_ids?: string[];
    created_at: string;
    updated_at: string;
}

export interface PhotoVoteRanking {
    submission_id: string;
    vote_count: number;
    content: string;
    author?: string;
}
