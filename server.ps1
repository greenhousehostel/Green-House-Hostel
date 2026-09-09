# ==============================================================================
# Green House Hostel - Unified Web & REST API Server
# Features:
#  - User Registration & Authentication (/api/auth/register, /api/auth/login)
#  - Role-Based Access Control (Admin vs Regular Member)
#  - Registered Users Directory & Active Sessions Manager (/api/users)
#  - Seat Inventory & Occupant Details Sync (/api/seats)
#  - Cryptographically Salted Password Hashing (SHA-256)
#  - Anti-Brute Force Rate Limiting & Path Traversal Defense
# ==============================================================================

$port = 8080
$root = (Get-Location).Path
$stateFile = Join-Path $root "seat_state.json"
$usersFile = Join-Path $root "users.json"
$script:sessionsFile = Join-Path $root "sessions.json"

# --- Security Configuration ---
$script:ADMIN_EMAIL = "greenhouse5014@gmail.com"
$script:SALT = "GHH_SECURE_SALT_v2_2026"

function Get-PasswordHash($email, $pass) {
    $cleanEmail = if ($email) { $email.Trim().ToLower() } else { "" }
    $cleanPass = if ($pass) { [string]$pass } else { "" }
    $raw = "$($script:SALT):$($cleanEmail):$($cleanPass)"
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($raw)
    $hashBytes = $sha256.ComputeHash($bytes)
    return -join ($hashBytes | ForEach-Object { "{0:x2}" -f $_ })
}

# --- Initialize Users Database ---
function Init-UsersDb {
    if (-not (Test-Path $script:usersFile)) {
        $adminUser = @{
            id = "usr_admin_1"
            name = "Green House Administrator"
            email = $script:ADMIN_EMAIL
            phone = "+880 1703-585853"
            passwordHash = Get-PasswordHash $script:ADMIN_EMAIL "957995xvi16"
            role = "admin"
            createdAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            lastLoginAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        }
        $initial = @($adminUser)
        $json = $initial | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($script:usersFile, $json, [System.Text.Encoding]::UTF8)
    }
}
Init-UsersDb

function Load-Users {
    try {
        if (Test-Path $script:usersFile) {
            $content = [System.IO.File]::ReadAllText($script:usersFile, [System.Text.Encoding]::UTF8)
            $parsed = $content | ConvertFrom-Json
            if ($parsed -is [System.Array]) {
                return @($parsed)
            } elseif ($parsed) {
                return @($parsed)
            }
        }
    } catch {}
    return @()
}

function Save-Users($usersList) {
    $arr = @($usersList)
    $json = $arr | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($script:usersFile, $json, [System.Text.Encoding]::UTF8)
}

# Persistent active sessions & in-memory rate limiting
$script:activeSessions = @{} # token -> @{ id = $id; email = $email; name = $name; role = $role; expires = $dateTime }
$script:loginAttempts = @{}  # ip -> @{ count = N; lastAttempt = $dateTime; lockedUntil = $dateTime }

function Load-Sessions {
    $script:activeSessions = @{}
    try {
        if (Test-Path $script:sessionsFile) {
            $content = [System.IO.File]::ReadAllText($script:sessionsFile, [System.Text.Encoding]::UTF8)
            $parsed = $content | ConvertFrom-Json
            if ($parsed) {
                $now = [DateTime]::UtcNow
                foreach ($prop in $parsed.PSObject.Properties) {
                    $token = $prop.Name
                    $data = $prop.Value
                    $expires = [DateTime]::Parse($data.expires)
                    if ($expires -gt $now) {
                        $script:activeSessions[$token] = @{
                            id = $data.id
                            name = $data.name
                            email = $data.email
                            phone = $data.phone
                            role = $data.role
                            expires = $expires
                        }
                    }
                }
            }
        }
    } catch {}
}

function Save-Sessions {
    try {
        $export = @{}
        $now = [DateTime]::UtcNow
        foreach ($k in $script:activeSessions.Keys) {
            $sess = $script:activeSessions[$k]
            if ($sess.expires -gt $now) {
                $export[$k] = @{
                    id = $sess.id
                    name = $sess.name
                    email = $sess.email
                    phone = $sess.phone
                    role = $sess.role
                    expires = $sess.expires.ToString("o")
                }
            }
        }
        $json = $export | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($script:sessionsFile, $json, [System.Text.Encoding]::UTF8)
    } catch {}
}

Load-Sessions

function Check-RateLimit($clientIp) {
    $now = [DateTime]::UtcNow
    if ($script:loginAttempts.ContainsKey($clientIp)) {
        $info = $script:loginAttempts[$clientIp]
        if ($info.lockedUntil -gt $now) {
            $remaining = [Math]::Ceiling(($info.lockedUntil - $now).TotalSeconds)
            return @{ Allowed = $false; Message = "Too many failed attempts. Try again in $remaining seconds." }
        }
        if (($now - $info.lastAttempt).TotalMinutes -gt 5) {
            $script:loginAttempts[$clientIp] = @{ count = 0; lastAttempt = $now; lockedUntil = $now }
        }
    }
    return @{ Allowed = $true }
}

function Record-FailedLogin($clientIp) {
    $now = [DateTime]::UtcNow
    if (-not $script:loginAttempts.ContainsKey($clientIp)) {
        $script:loginAttempts[$clientIp] = @{ count = 1; lastAttempt = $now; lockedUntil = $now }
    } else {
        $info = $script:loginAttempts[$clientIp]
        $info.count += 1
        $info.lastAttempt = $now
        if ($info.count -ge 5) {
            $info.lockedUntil = $now.AddMinutes(5)
            Write-Host "[SECURITY ALERT] IP $clientIp locked out for 5 minutes (5 failed attempts)." -ForegroundColor Red
        }
        $script:loginAttempts[$clientIp] = $info
    }
}

function Record-SuccessLogin($clientIp) {
    if ($script:loginAttempts.ContainsKey($clientIp)) {
        $script:loginAttempts.Remove($clientIp)
    }
}

function Generate-SecureToken() {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
}

function Get-Session($token) {
    if ([string]::IsNullOrWhiteSpace($token)) { return $null }
    $cleanToken = $token -replace '^Bearer\s+', ''
    if ($script:activeSessions.ContainsKey($cleanToken)) {
        $session = $script:activeSessions[$cleanToken]
        if ($session.expires -gt [DateTime]::UtcNow) {
            return $session
        } else {
            $script:activeSessions.Remove($cleanToken)
            Save-Sessions
        }
    }
    return $null
}

# --- Network Discovery ---
$localIPs = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254*" 
} | Select-Object -ExpandProperty IPAddress

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Green House Hostel Member & Admin Server is LIVE!" -ForegroundColor Cyan
    Write-Host " [System] Role-Based Auth, User Directory & Seat Management" -ForegroundColor Green
    Write-Host "----------------------------------------------------------"
    Write-Host " Local Access:"
    Write-Host "   - http://localhost:$port/" -ForegroundColor Yellow
    Write-Host "   - http://127.0.0.1:$port/" -ForegroundColor Yellow
    Write-Host " Mobile Access (Same Wi-Fi):"
    foreach ($ip in $localIPs) {
        Write-Host "   - http://${ip}:${port}/" -ForegroundColor Magenta
    }
    Write-Host "----------------------------------------------------------"
    Write-Host " Press Ctrl+C to stop the server."
    Write-Host "=========================================================="

    $mimeTypes = @{
        '.html' = 'text/html; charset=utf-8'
        '.css'  = 'text/css; charset=utf-8'
        '.js'   = 'text/javascript; charset=utf-8'
        '.png'  = 'image/png'
        '.jpg'  = 'image/jpeg'
        '.jpeg' = 'image/jpeg'
        '.webp' = 'image/webp'
        '.svg'  = 'image/svg+xml'
        '.ico'  = 'image/x-icon'
        '.json' = 'application/json; charset=utf-8'
        '.txt'  = 'text/plain; charset=utf-8'
        '.woff2'= 'font/woff2'
        '.woff' = 'font/woff'
        '.ttf'  = 'font/ttf'
    }

    while ($true) {
        $client = $null
        $stream = $null
        try {
            $client = $listener.AcceptTcpClient()
            $client.ReceiveTimeout = 10000
            $client.SendTimeout = 10000
            $stream = $client.GetStream()
            $stream.ReadTimeout = 10000
            $stream.WriteTimeout = 10000
            
            # Robust IPv4 & IPv6 Remote Address Parsing
            $remoteEp = $client.Client.RemoteEndPoint
            $clientIp = if ($remoteEp -is [System.Net.IPEndPoint]) {
                $remoteEp.Address.ToString()
            } else {
                ($remoteEp.ToString() -replace ':\d+$', '') -replace '^\[|\]$', ''
            }
            
            $buffer = New-Object byte[] 65536
            $bytesRead = $stream.Read($buffer, 0, $buffer.Length)
        
        if ($bytesRead -gt 0) {
            $rawRequest = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $bytesRead)
            $headerEndIndex = $rawRequest.IndexOf("`r`n`r`n")
            
            $headerPart = if ($headerEndIndex -ge 0) { $rawRequest.Substring(0, $headerEndIndex) } else { $rawRequest }
            $bodyPart = if ($headerEndIndex -ge 0) { $rawRequest.Substring($headerEndIndex + 4) } else { "" }
            
            $lines = $headerPart -split "`r`n"
            $requestLine = $lines[0]
            $parts = $requestLine -split '\s+'
            $method = $parts[0]
            $urlPath = if ($parts.Length -gt 1) { $parts[1] } else { '/' }
            
            $reqHeaders = @{}
            for ($i = 1; $i -lt $lines.Length; $i++) {
                $colonIdx = $lines[$i].IndexOf(':')
                if ($colonIdx -gt 0) {
                    $k = $lines[$i].Substring(0, $colonIdx).Trim().ToLower()
                    $v = $lines[$i].Substring($colonIdx + 1).Trim()
                    $reqHeaders[$k] = $v
                }
            }

            if ($reqHeaders.ContainsKey('content-length')) {
                $contentLength = [int]$reqHeaders['content-length']
                $bodyBytesCurrent = [System.Text.Encoding]::UTF8.GetByteCount($bodyPart)
                while ($bodyBytesCurrent -lt $contentLength) {
                    $remainingBytes = $contentLength - $bodyBytesCurrent
                    $chunkSize = [Math]::Min($remainingBytes, 65536)
                    $moreBuffer = New-Object byte[] $chunkSize
                    $moreRead = $stream.Read($moreBuffer, 0, $moreBuffer.Length)
                    if ($moreRead -le 0) { break }
                    $bodyPart += [System.Text.Encoding]::UTF8.GetString($moreBuffer, 0, $moreRead)
                    $bodyBytesCurrent = [System.Text.Encoding]::UTF8.GetByteCount($bodyPart)
                }
            }

            $urlClean = ($urlPath -split '\?')[0]
            $urlClean = [System.Uri]::UnescapeDataString($urlClean)

            $secHeaders = "X-Content-Type-Options: nosniff`r`n" +
                          "X-Frame-Options: SAMEORIGIN`r`n" +
                          "Referrer-Policy: strict-origin-when-cross-origin`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
                          "Access-Control-Allow-Headers: Content-Type, Authorization`r`n"
            $noCacheHeaders = "Cache-Control: no-cache, no-store, must-revalidate, max-age=0`r`nPragma: no-cache`r`nExpires: 0`r`n"

            if ($method -eq 'OPTIONS') {
                $resp = "HTTP/1.1 204 No Content`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                $stream.Write($respBytes, 0, $respBytes.Length)
                $stream.Flush(); $stream.Close(); $client.Close()
                continue
            }

            # -------------------------------------------------------------
            # REST API: /api/auth/register (Public User Registration)
            # -------------------------------------------------------------
            if ($urlClean -eq '/api/auth/register' -and $method -eq 'POST') {
                try {
                    $payload = $bodyPart.Trim() | ConvertFrom-Json
                    $name = if ($payload.name) { $payload.name.ToString().Trim() } else { "" }
                    $email = if ($payload.email) { $payload.email.ToString().Trim().ToLower() } else { "" }
                    $phone = if ($payload.phone) { $payload.phone.ToString().Trim() } else { "" }
                    $pass = if ($payload.password) { [string]$payload.password } else { "" }

                    if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($pass)) {
                        $respObj = @{ success = $false; message = "Name, valid email, and password are required." } | ConvertTo-Json
                        $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                        $resp = "HTTP/1.1 400 Bad Request`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                        $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                        $stream.Write($respBytes, 0, $respBytes.Length)
                        $stream.Write($respBody, 0, $respBody.Length)
                        $stream.Flush(); $stream.Close(); $client.Close()
                        continue
                    }

                    $users = Load-Users
                    $existing = $null
                    foreach ($u in $users) {
                        if ($u.email -eq $email) { $existing = $u; break }
                    }

                    if ($existing) {
                        $respObj = @{ success = $false; message = "An account with this email address already exists. Please sign in." } | ConvertTo-Json
                        $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                        $resp = "HTTP/1.1 409 Conflict`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                        $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                        $stream.Write($respBytes, 0, $respBytes.Length)
                        $stream.Write($respBody, 0, $respBody.Length)
                        $stream.Flush(); $stream.Close(); $client.Close()
                        continue
                    }

                    $role = if ($email -eq $script:ADMIN_EMAIL) { "admin" } else { "member" }
                    $nowStr = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                    $newUser = @{
                        id = "usr_" + (Get-Random -Minimum 100000 -Maximum 999999)
                        name = $name
                        email = $email
                        phone = $phone
                        passwordHash = Get-PasswordHash $email $pass
                        role = $role
                        createdAt = $nowStr
                        lastLoginAt = $nowStr
                    }

                    $allUsers = @($users) + $newUser
                    Save-Users $allUsers

                    $token = Generate-SecureToken
                    $expires = [DateTime]::UtcNow.AddHours(24)
                    $script:activeSessions[$token] = @{
                        id = $newUser.id
                        name = $newUser.name
                        email = $newUser.email
                        phone = $newUser.phone
                        role = $newUser.role
                        expires = $expires
                    }
                    Save-Sessions

                    $respObj = @{
                        success = $true
                        token = $token
                        user = @{
                            name = $newUser.name
                            email = $newUser.email
                            phone = $newUser.phone
                            role = $newUser.role
                        }
                        expiresAt = $expires.ToString("o")
                        message = "Account registered successfully."
                    } | ConvertTo-Json

                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                    $resp = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                    $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                    $stream.Write($respBytes, 0, $respBytes.Length)
                    $stream.Write($respBody, 0, $respBody.Length)
                } catch {
                    $respObj = @{ success = $false; message = "Registration error: $_" } | ConvertTo-Json
                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                    $resp = "HTTP/1.1 500 Internal Server Error`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                    $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                    $stream.Write($respBytes, 0, $respBytes.Length)
                    $stream.Write($respBody, 0, $respBody.Length)
                }
                $stream.Flush(); $stream.Close(); $client.Close()
                continue
            }

            # -------------------------------------------------------------
            # REST API: /api/auth/login (Unified Sign In)
            # -------------------------------------------------------------
            if ($urlClean -eq '/api/auth/login' -and $method -eq 'POST') {
                $rate = Check-RateLimit $clientIp
                if (-not $rate.Allowed) {
                    $jsonErr = "{`"success`":false,`"message`":`"$($rate.Message)`"}"
                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($jsonErr)
                    $resp = "HTTP/1.1 429 Too Many Requests`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                    $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                    $stream.Write($respBytes, 0, $respBytes.Length)
                    $stream.Write($respBody, 0, $respBody.Length)
                    $stream.Flush(); $stream.Close(); $client.Close()
                    continue
                }

                $authSuccess = $false
                $userObj = $null
                $errMsg = "Invalid email or password."
                
                try {
                    $payload = $bodyPart.Trim() | ConvertFrom-Json
                    $submittedEmail = if ($payload.email) { $payload.email.ToString().Trim().ToLower() } else { "" }
                    $submittedPass = if ($payload.password) { [string]$payload.password } else { "" }

                    if (-not [string]::IsNullOrWhiteSpace($submittedPass)) {
                        $inputHash = Get-PasswordHash $submittedEmail $submittedPass
                        $users = Load-Users
                        $matched = $null
                        foreach ($u in $users) {
                            if ($u.email -eq $submittedEmail -and $u.passwordHash -eq $inputHash) {
                                $matched = $u
                                break
                            }
                        }

                        # Default admin credentials fallback
                        if (-not $matched -and $submittedEmail -eq $script:ADMIN_EMAIL -and $inputHash -eq (Get-PasswordHash $script:ADMIN_EMAIL "greenhouse5014")) {
                            $matched = @{
                                id = "usr_admin_1"
                                name = "Green House Administrator"
                                email = $script:ADMIN_EMAIL
                                phone = "+880 1703-585853"
                                role = "admin"
                            }
                        }

                        if ($matched) {
                            $authSuccess = $true
                            $userObj = $matched
                            $nowStr = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                            foreach ($u in $users) {
                                if ($u.email -eq $submittedEmail) {
                                    $u.lastLoginAt = $nowStr
                                }
                            }
                            Save-Users $users
                        }
                    }
                } catch {
                    $errMsg = "Malformed JSON request."
                }

                if ($authSuccess) {
                    Record-SuccessLogin $clientIp
                    $token = Generate-SecureToken
                    $expires = [DateTime]::UtcNow.AddHours(24)
                    $script:activeSessions[$token] = @{
                        id = $userObj.id
                        name = $userObj.name
                        email = $userObj.email
                        phone = $userObj.phone
                        role = $userObj.role
                        expires = $expires
                    }
                    Save-Sessions

                    $respObj = @{
                        success = $true
                        token = $token
                        user = @{
                            name = $userObj.name
                            email = $userObj.email
                            phone = $userObj.phone
                            role = $userObj.role
                        }
                        expiresAt = $expires.ToString("o")
                        message = "Authentication successful."
                    } | ConvertTo-Json

                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                    $resp = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                    $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                    $stream.Write($respBytes, 0, $respBytes.Length)
                    $stream.Write($respBody, 0, $respBody.Length)
                } else {
                    Record-FailedLogin $clientIp
                    $respObj = @{ success = $false; message = $errMsg } | ConvertTo-Json
                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                    $resp = "HTTP/1.1 401 Unauthorized`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                    $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                    $stream.Write($respBytes, 0, $respBytes.Length)
                    $stream.Write($respBody, 0, $respBody.Length)
                }
                $stream.Flush(); $stream.Close(); $client.Close()
                continue
            }

            # -------------------------------------------------------------
            # REST API: /api/auth/verify
            # -------------------------------------------------------------
            if ($urlClean -eq '/api/auth/verify') {
                $authHeader = $reqHeaders['authorization']
                $session = Get-Session $authHeader
                if ($session) {
                    $respObj = @{
                        valid = $true
                        user = @{
                            name = $session.name
                            email = $session.email
                            phone = $session.phone
                            role = $session.role
                        }
                    } | ConvertTo-Json
                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                    $resp = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                } else {
                    $respObj = @{ valid = $false } | ConvertTo-Json
                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                    $resp = "HTTP/1.1 401 Unauthorized`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                }
                $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                $stream.Write($respBytes, 0, $respBytes.Length)
                $stream.Write($respBody, 0, $respBody.Length)
                $stream.Flush(); $stream.Close(); $client.Close()
                continue
            }

            # -------------------------------------------------------------
            # REST API: /api/users (Admin-only Member Roster)
            # -------------------------------------------------------------
            if ($urlClean -eq '/api/users' -and $method -eq 'GET') {
                $authHeader = $reqHeaders['authorization']
                $session = Get-Session $authHeader
                if (-not $session -or $session.role -ne 'admin') {
                    $errJson = "{`"success`":false,`"message`":`"Unauthorized: Administrator access required.`"}"
                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($errJson)
                    $resp = "HTTP/1.1 403 Forbidden`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                    $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                    $stream.Write($respBytes, 0, $respBytes.Length)
                    $stream.Write($respBody, 0, $respBody.Length)
                } else {
                    $rawUsers = Load-Users
                    $sanitized = @()
                    foreach ($u in $rawUsers) {
                        $sanitized += @{
                            id = $u.id
                            name = $u.name
                            email = $u.email
                            phone = $u.phone
                            role = $u.role
                            createdAt = $u.createdAt
                            lastLoginAt = $u.lastLoginAt
                        }
                    }

                    $activeCount = ($script:activeSessions.Values | Where-Object { $_.expires -gt [DateTime]::UtcNow }).Count

                    $respObj = @{
                        success = $true
                        total = $sanitized.Count
                        activeSessions = $activeCount
                        users = $sanitized
                    } | ConvertTo-Json -Depth 5

                    $respBody = [System.Text.Encoding]::UTF8.GetBytes($respObj)
                    $resp = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                    $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                    $stream.Write($respBytes, 0, $respBytes.Length)
                    $stream.Write($respBody, 0, $respBody.Length)
                }
                $stream.Flush(); $stream.Close(); $client.Close()
                continue
            }

            # -------------------------------------------------------------
            # REST API: /api/seats (GET: Public/Admin, POST: Admin Token Required)
            # -------------------------------------------------------------
            if ($urlClean -eq '/api/seats') {
                if ($method -eq 'GET') {
                    $jsonContent = if (Test-Path $stateFile) { [System.IO.File]::ReadAllText($stateFile, [System.Text.Encoding]::UTF8) } else { "{}" }
                    
                    $authHeader = $reqHeaders['authorization']
                    $session = Get-Session $authHeader
                    $isAdmin = ($session -and $session.role -eq 'admin')

                    if ($isAdmin) {
                        $respBody = [System.Text.Encoding]::UTF8.GetBytes($jsonContent)
                    } else {
                        try {
                            $parsedData = $jsonContent | ConvertFrom-Json
                            if ($parsedData.occupants) {
                                $cleanObj = @{
                                    state = $parsedData.state
                                }
                                $jsonPublic = $cleanObj | ConvertTo-Json -Depth 10
                                $respBody = [System.Text.Encoding]::UTF8.GetBytes($jsonPublic)
                            } else {
                                $respBody = [System.Text.Encoding]::UTF8.GetBytes($jsonContent)
                            }
                        } catch {
                            $respBody = [System.Text.Encoding]::UTF8.GetBytes($jsonContent)
                        }
                    }

                    $resp = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + $noCacheHeaders + "Connection: close`r`n`r`n"
                    $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                    $stream.Write($respBytes, 0, $respBytes.Length)
                    $stream.Write($respBody, 0, $respBody.Length)
                } elseif ($method -eq 'POST') {
                    $authHeader = $reqHeaders['authorization']
                    $session = Get-Session $authHeader
                    if (-not $session -or $session.role -ne 'admin') {
                        $errJson = "{`"success`":false,`"message`":`"Unauthorized: Admin token required.`"}"
                        $respBody = [System.Text.Encoding]::UTF8.GetBytes($errJson)
                        $resp = "HTTP/1.1 403 Forbidden`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + $noCacheHeaders + "Connection: close`r`n`r`n"
                        $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                        $stream.Write($respBytes, 0, $respBytes.Length)
                        $stream.Write($respBody, 0, $respBody.Length)
                    } else {
                        try {
                            $null = $bodyPart.Trim() | ConvertFrom-Json
                            [System.IO.File]::WriteAllText($stateFile, $bodyPart.Trim(), [System.Text.Encoding]::UTF8)
                            $okJson = "{`"success`":true,`"message`":`"Seat state and occupant records saved.`"}"
                            $respBody = [System.Text.Encoding]::UTF8.GetBytes($okJson)
                            $resp = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + $noCacheHeaders + "Connection: close`r`n`r`n"
                            $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                            $stream.Write($respBytes, 0, $respBytes.Length)
                            $stream.Write($respBody, 0, $respBody.Length)
                        } catch {
                            $errJson = "{`"success`":false,`"message`":`"Invalid JSON format.`"}"
                            $respBody = [System.Text.Encoding]::UTF8.GetBytes($errJson)
                            $resp = "HTTP/1.1 400 Bad Request`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($respBody.Length)`r`n" + $secHeaders + $noCacheHeaders + "Connection: close`r`n`r`n"
                            $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                            $stream.Write($respBytes, 0, $respBytes.Length)
                            $stream.Write($respBody, 0, $respBody.Length)
                        }
                    }
                }
                $stream.Flush(); $stream.Close(); $client.Close()
                continue
            }

            # -------------------------------------------------------------
            # Static File Serving with Path Traversal Protection
            # -------------------------------------------------------------
            if ($urlClean -eq '/' -or [string]::IsNullOrWhiteSpace($urlClean)) {
                $urlClean = '/index.html'
            }

            $rawFilePath = Join-Path $root ($urlClean.TrimStart('/').Replace('/', '\'))
            $canonicalFilePath = [System.IO.Path]::GetFullPath($rawFilePath)
            $canonicalRoot = [System.IO.Path]::GetFullPath($root)

            $blockedFileNames = @('users.json', 'sessions.json', 'server.ps1', 'start-server.bat', 'seat_state.json')
            $fileName = [System.IO.Path]::GetFileName($canonicalFilePath).ToLower()
            $fileExt = [System.IO.Path]::GetExtension($canonicalFilePath).ToLower()

            if ($fileName -in $blockedFileNames -or $fileExt -in @('.ps1', '.bat', '.cmd') -or -not $canonicalFilePath.StartsWith($canonicalRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("<h1>403 Forbidden</h1><p>Access denied.</p>")
                $header = "HTTP/1.1 403 Forbidden`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($body.Length)`r`n" + $secHeaders + "Connection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($body, 0, $body.Length)
                $stream.Flush(); $stream.Close(); $client.Close()
                continue
            }

            if (Test-Path $canonicalFilePath -PathType Leaf) {
                $fileBytes = [System.IO.File]::ReadAllBytes($canonicalFilePath)
                $ext = [System.IO.Path]::GetExtension($canonicalFilePath).ToLower()
                $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
                $cacheControl = if ($ext -in @('.json', '.html')) { $noCacheHeaders } else { "Cache-Control: public, max-age=3600`r`n" }
                
                $header = "HTTP/1.1 200 OK`r`n" +
                          "Content-Type: $contentType`r`n" +
                          "Content-Length: $($fileBytes.Length)`r`n" +
                          $secHeaders +
                          $cacheControl +
                          "Connection: close`r`n`r`n"
                
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                if ($method -ne 'HEAD') {
                    $stream.Write($fileBytes, 0, $fileBytes.Length)
                }
            } else {
                $body = [System.Text.Encoding]::UTF8.GetBytes("<h1>404 Not Found</h1><p>The requested file was not found on Green House Hostel server.</p>")
                $header = "HTTP/1.1 404 Not Found`r`n" +
                          "Content-Type: text/html; charset=utf-8`r`n" +
                          "Content-Length: $($body.Length)`r`n" +
                          $secHeaders +
                          "Connection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                if ($method -ne 'HEAD') {
                    $stream.Write($body, 0, $body.Length)
                }
            }
        }
        } catch {
            # Client disconnected or transport connection aborted; continue serving without crashing
        } finally {
            if ($stream) { try { $stream.Flush(); $stream.Close() } catch {} }
            if ($client) { try { $client.Close() } catch {} }
        }
    }
} catch {
    Write-Host "Server Error: $_" -ForegroundColor Red
} finally {
    if ($listener) {
        $listener.Stop()
    }
}
