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
