import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export type Event = {
    id: string;
    slug: string;
    name: string;
    date: string;
    status: 'active' | 'closed';
};

type EventContextType = {
    event: Event | null;
    isLoading: boolean;
    error: string | null;
    isAdmin: boolean;
};

const EventContext = createContext<EventContextType>({
    event: null,
    isLoading: true,
    error: null,
    isAdmin: false,
});

export const useEvent = () => useContext(EventContext);

export const EventProvider = ({ children }: { children: React.ReactNode }) => {
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const params = useParams<{ slug?: string }>();
    const location = useLocation();

    // Check if we are in admin routes
    const isAdmin = location.pathname.startsWith('/admin');

    useEffect(() => {
        const fetchEvent = async () => {
            // If we are at root or generic admin, we might not have a slug yet
            // But if the route is /:slug/..., we need to fetch that event
            const slug = params.slug;

            if (!slug) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const { data, error } = await supabase
                    .from('events')
                    .select('*')
                    .ilike('slug', slug)
                    .maybeSingle();

                if (error) throw error;
                if (!data) throw new Error('Evento no encontrado');

                setEvent(data);
                setError(null);
            } catch (err) {
                console.error('Error fetching event:', err);
                setError('Evento no encontrado');
                setEvent(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvent();
    }, [params.slug, location.pathname]);

    return (
        <EventContext.Provider value={{ event, isLoading, error, isAdmin }}>
            {children}
        </EventContext.Provider>
    );
};
