# API Testing Guide - Authentication System

## Prerequisites

1. Start the development environment:
```bash
docker compose up -d
```

2. Or run locally:
```bash
cd backend
npm run dev
```

API will be available at `http://localhost:3000`

## Test Scenarios

### 1. Check If Setup Is Needed

**Request:**
```bash
curl http://localhost:3000/api/auth/setup-needed
```

**Expected Response:**
```json
{
  "setupNeeded": true
}
```

### 2. Initial Setup (Create First Admin User)

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@notez.local",
    "password": "Admin123!@#"
  }'
```

**Expected Response:**
```json
{
  "message": "Setup completed successfully",
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@notez.local",
    "role": "admin"
  },
  "accessToken": "eyJhbGc..."
}
```

**Note:** Refresh token is set as httpOnly cookie

### 3. Login

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "usernameOrEmail": "admin",
    "password": "Admin123!@#"
  }'
```

**Expected Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@notez.local",
    "role": "admin",
    "mustChangePassword": false
  },
  "accessToken": "eyJhbGc..."
}
```

**Save the access token** for subsequent requests!

### 4. Get Current User Info

**Request:**
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "user": {
    "userId": "...",
    "username": "admin",
    "role": "admin"
  }
}
```

### 5. Create New User (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@notez.local",
    "password": "Test123!@#",
    "role": "user"
  }'
```

**Expected Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "...",
    "username": "testuser",
    "email": "test@notez.local",
    "role": "user",
    "isActive": true,
    "mustChangePassword": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 6. List All Users (Admin Only)

**Request:**
```bash
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "users": [
    {
      "id": "...",
      "username": "admin",
      "email": "admin@notez.local",
      "role": "admin",
      "isActive": true,
      "mustChangePassword": false,
      "createdAt": "...",
      "updatedAt": "..."
    },
    {
      "id": "...",
      "username": "testuser",
      "email": "test@notez.local",
      "role": "user",
      "isActive": true,
      "mustChangePassword": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "total": 2
}
```

### 7. Get User Statistics (Admin Only)

**Request:**
```bash
curl http://localhost:3000/api/users/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "totalUsers": 2,
  "activeUsers": 2,
  "inactiveUsers": 0,
  "adminUsers": 1
}
```

### 8. Update User (Admin Only)

**Request:**
```bash
curl -X PATCH http://localhost:3000/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

**Expected Response:**
```json
{
  "message": "User updated successfully",
  "user": {
    "id": "...",
    "username": "testuser",
    "isActive": false,
    ...
  }
}
```

### 9. Reset User Password (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:3000/api/users/USER_ID/reset-password \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "NewPass123!@#"
  }'
```

**Expected Response:**
```json
{
  "message": "Password reset successfully. User must change password on next login.",
  "user": {
    "id": "...",
    "mustChangePassword": true,
    ...
  }
}
```

### 10. Change Own Password

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Admin123!@#",
    "newPassword": "NewAdmin123!@#"
  }'
```

**Expected Response:**
```json
{
  "message": "Password changed successfully"
}
```

### 11. Refresh Access Token

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

**Expected Response:**
```json
{
  "message": "Token refreshed successfully",
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@notez.local",
    "role": "admin",
    "mustChangePassword": false
  },
  "accessToken": "eyJhbGc..."
}
```

### 12. Logout

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -b cookies.txt
```

**Expected Response:**
```json
{
  "message": "Logout successful"
}
```

### 13. Delete User (Admin Only)

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "message": "User deactivated successfully",
  "user": {
    "id": "...",
    "isActive": false,
    ...
  }
}
```

## Error Scenarios

### Validation Error

**Request with invalid password:**
```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@notez.local",
    "password": "weak"
  }'
```

**Response:**
```json
{
  "error": "Validation Error",
  "message": "Invalid request data",
  "details": [
    {
      "path": "password",
      "message": "Password must be at least 8 characters"
    },
    {
      "path": "password",
      "message": "Password must contain at least one uppercase letter"
    },
    {
      "path": "password",
      "message": "Password must contain at least one number"
    },
    {
      "path": "password",
      "message": "Password must contain at least one special character"
    }
  ]
}
```

### Unauthorized Access

**Request without token:**
```bash
curl http://localhost:3000/api/users
```

**Response:**
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization header"
}
```

### Forbidden Access (Non-Admin)

**User trying to access admin endpoint:**
```bash
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer USER_TOKEN"
```

**Response:**
```json
{
  "error": "Forbidden",
  "message": "Admin access required"
}
```

## Quick Test Script

Save this as `test-auth.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== Testing Authentication System ==="
echo

# 1. Check setup needed
echo "1. Checking if setup is needed..."
curl -s $BASE_URL/auth/setup-needed | jq
echo

# 2. Setup admin user
echo "2. Creating admin user..."
SETUP_RESPONSE=$(curl -s -X POST $BASE_URL/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@notez.local",
    "password": "Admin123!@#"
  }')
echo $SETUP_RESPONSE | jq

# Extract access token
TOKEN=$(echo $SETUP_RESPONSE | jq -r '.accessToken')
echo "Token: ${TOKEN:0:50}..."
echo

# 3. Get current user
echo "3. Getting current user info..."
curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
echo

# 4. Create a test user
echo "4. Creating test user..."
curl -s -X POST $BASE_URL/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@notez.local",
    "password": "Test123!@#",
    "role": "user"
  }' | jq
echo

# 5. List all users
echo "5. Listing all users..."
curl -s $BASE_URL/users \
  -H "Authorization: Bearer $TOKEN" | jq
echo

# 6. Get user stats
echo "6. Getting user statistics..."
curl -s $BASE_URL/users/stats \
  -H "Authorization: Bearer $TOKEN" | jq
echo

echo "=== All tests completed ==="
```

Make it executable and run:
```bash
chmod +x test-auth.sh
./test-auth.sh
```

## Notes

- All endpoints use JSON for request/response
- Refresh tokens are stored in httpOnly signed cookies
- Access tokens should be sent in `Authorization: Bearer TOKEN` header
- Password requirements: min 8 chars, 1 uppercase, 1 number, 1 special char
- Admin users can manage all users except they cannot delete themselves
- All admin endpoints require both authentication and admin role
