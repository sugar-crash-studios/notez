# PowerShell script to test authentication API

$baseUrl = "http://localhost:3000/api"

Write-Host "=== Testing Authentication System ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check if setup is needed
Write-Host "1. Checking if setup is needed..." -ForegroundColor Yellow
$setupNeeded = Invoke-RestMethod -Uri "$baseUrl/auth/setup-needed" -Method Get
Write-Host "Setup needed: $($setupNeeded.setupNeeded)" -ForegroundColor Green
Write-Host ""

# 2. Create admin user
Write-Host "2. Creating admin user..." -ForegroundColor Yellow
$setupBody = @{
    username = "admin"
    email = "admin@notez.local"
    password = "Admin123!@#"
} | ConvertTo-Json

try {
    $setupResponse = Invoke-RestMethod -Uri "$baseUrl/auth/setup" -Method Post -Body $setupBody -ContentType "application/json" -SessionVariable session
    $token = $setupResponse.accessToken
    Write-Host "Admin user created successfully!" -ForegroundColor Green
    Write-Host "Username: $($setupResponse.user.username)" -ForegroundColor White
    Write-Host "Role: $($setupResponse.user.role)" -ForegroundColor White
    Write-Host "Token: $($token.Substring(0, [Math]::Min(50, $token.Length)))..." -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
}

# 3. Get current user info
Write-Host "3. Getting current user info..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    $meResponse = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers $headers
    Write-Host "Current user: $($meResponse.user.username)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
}

# 4. Create a test user
Write-Host "4. Creating test user..." -ForegroundColor Yellow
$userBody = @{
    username = "testuser"
    email = "test@notez.local"
    password = "Test123!@#"
    role = "user"
} | ConvertTo-Json

try {
    $userResponse = Invoke-RestMethod -Uri "$baseUrl/users" -Method Post -Body $userBody -ContentType "application/json" -Headers $headers
    Write-Host "Test user created successfully!" -ForegroundColor Green
    Write-Host "Username: $($userResponse.user.username)" -ForegroundColor White
    Write-Host "Must change password: $($userResponse.user.mustChangePassword)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
}

# 5. List all users
Write-Host "5. Listing all users..." -ForegroundColor Yellow
try {
    $usersResponse = Invoke-RestMethod -Uri "$baseUrl/users" -Method Get -Headers $headers
    Write-Host "Total users: $($usersResponse.total)" -ForegroundColor Green
    foreach ($user in $usersResponse.users) {
        Write-Host "  - $($user.username) ($($user.role)) - Active: $($user.isActive)" -ForegroundColor White
    }
    Write-Host ""
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
}

# 6. Get user statistics
Write-Host "6. Getting user statistics..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "$baseUrl/users/stats" -Method Get -Headers $headers
    Write-Host "Total users: $($statsResponse.totalUsers)" -ForegroundColor Green
    Write-Host "Active users: $($statsResponse.activeUsers)" -ForegroundColor Green
    Write-Host "Admin users: $($statsResponse.adminUsers)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
}

Write-Host "=== All tests completed ===" -ForegroundColor Cyan
