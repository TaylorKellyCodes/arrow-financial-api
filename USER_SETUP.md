# User Management Setup Guide

## Initial User Setup

To create the initial users (admin, taylor, and dad), run the setup script:

```bash
cd backend
node scripts/setup-users.js
```

The script will:
1. Connect to your database
2. Prompt you to set passwords for each user:
   - `admin@arrowfinancial.com` (admin role)
   - `taylor@arrowfinancial.com` (taylor role)
   - `dad@arrowfinancial.com` (dad role)
3. If users already exist, you can choose to update their passwords

**Note:** Make sure your `.env` file has `MONGODB_URI` set before running the script.

## User Roles and Permissions

### Admin
- ✅ Full access to all features
- ✅ Can create, edit, and **delete** transactions
- ✅ Can edit both confirmation checkboxes (Taylor and Dad)
- ✅ Can view audit logs
- ✅ Can create, update, and delete users
- ✅ Can reorder transactions

### Taylor
- ✅ Can view all transactions
- ✅ Can create new transactions
- ✅ Can edit transactions (date, type, amount, notes)
- ✅ Can edit only the "Taylor" confirmation checkbox
- ✅ Can reorder transactions
- ❌ **Cannot delete transactions** (admin only)
- ❌ Cannot edit "Dad" confirmation checkbox
- ❌ Cannot view audit logs
- ❌ Cannot manage users

### Dad
- ✅ Can view all transactions
- ✅ Can create new transactions
- ✅ Can edit transactions (date, type, amount, notes)
- ✅ Can edit only the "Dad" confirmation checkbox
- ✅ Can reorder transactions
- ❌ **Cannot delete transactions** (admin only)
- ❌ Cannot edit "Taylor" confirmation checkbox
- ❌ Cannot view audit logs
- ❌ Cannot manage users

## Managing Users (Admin Only)

Once logged in as admin, you can manage users via the API:

### Get All Users
```bash
GET /users
```

### Get Single User
```bash
GET /users/:id
```

### Create New User
```bash
POST /users
Content-Type: application/json
X-CSRF-Token: <your-csrf-token>

{
  "email": "newuser@example.com",
  "password": "securepassword",
  "role": "taylor"  // or "dad" or "admin"
}
```

### Update User
```bash
PUT /users/:id
Content-Type: application/json
X-CSRF-Token: <your-csrf-token>

{
  "email": "updated@example.com",  // optional
  "password": "newpassword",        // optional
  "role": "dad"                     // optional
}
```

### Delete User
```bash
DELETE /users/:id
X-CSRF-Token: <your-csrf-token>
```

**Note:** Admins cannot delete their own account.

## Password Requirements

- Minimum 6 characters
- No maximum length
- No complexity requirements (can be enhanced later if needed)

## Email Requirements

- Must be a valid email format
- Must be unique (case-insensitive)
- Stored in lowercase

## Security Notes

- All passwords are hashed using bcrypt (10 rounds)
- Passwords are never returned in API responses
- All user management endpoints require admin authentication
- CSRF protection is enabled for all user management endpoints
- All user actions are logged in the audit log

