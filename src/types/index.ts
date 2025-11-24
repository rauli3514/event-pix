export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
    id: string;
    type: 'photo' | 'message';
    content: string;
    author?: string;
    status: SubmissionStatus;
    in_album?: boolean;
    created_at: string;
}
