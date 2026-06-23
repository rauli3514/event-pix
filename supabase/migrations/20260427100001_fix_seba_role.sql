-- Fix role for sebadj@eventpix.com to ensure he is 'provider' and NOT 'super_admin'
UPDATE profiles
SET role = 'provider'
WHERE email = 'sebadj@eventpix.com';
