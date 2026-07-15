-- Create submissions table
create table public.submissions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  type text check (type in ('photo', 'message')) not null,
  content text not null,
  author text,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending' not null
);

-- Enable RLS
alter table public.submissions enable row level security;

-- Create policies
create policy "Allow public insert access"
  on public.submissions for insert
  with check (true);

create policy "Allow public read access for approved content"
  on public.submissions for select
  using (status = 'approved');

create policy "Allow admin full access"
  on public.submissions for all
  using (auth.role() = 'authenticated'); -- Assuming admin uses Supabase Auth

-- Create storage bucket for photos
insert into storage.buckets (id, name, public) 
values ('photos', 'photos', true);

-- Storage policies
create policy "Allow public upload"
  on storage.objects for insert
  with check ( bucket_id = 'photos' );

create policy "Allow public read"
  on storage.objects for select
  using ( bucket_id = 'photos' );
