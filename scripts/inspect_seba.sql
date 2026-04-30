
-- Find user ID and Role
SELECT au.email, ur.role, au.id
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email = 'sebadj@eventpix.com';

-- Check RLS Policy on Events (Just referencing logic here, can't query policy directly easily in result)
-- But we can simulate visibility later.
