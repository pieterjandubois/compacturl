# Redis Manager Script for CompactURL
# Usage: .\scripts\redis-manager.ps1 [start|stop|status|logs|test]

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'status', 'logs', 'test', 'restart', 'clean')]
    [string]$Action = 'status'
)

$ContainerName = "compacturl-redis"
$RedisImage = "redis:alpine"
$RedisPort = 6379

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Test-DockerRunning {
    try {
        docker ps > $null 2>&1
        return $true
    } catch {
        return $false
    }
}

function Start-Redis {
    Write-ColorOutput Yellow "Starting Redis container..."
    
    if (-not (Test-DockerRunning)) {
        Write-ColorOutput Red "❌ Docker is not running. Please start Docker Desktop first."
        exit 1
    }

    # Check if container exists
    $exists = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
    
    if ($exists) {
        Write-ColorOutput Yellow "Container exists. Starting..."
        docker start $ContainerName
    } else {
        Write-ColorOutput Yellow "Creating new Redis container..."
        docker run -d -p ${RedisPort}:6379 --name $ContainerName $RedisImage
    }
    
    Start-Sleep -Seconds 2
    
    # Verify it's running
    $running = docker ps --filter "name=$ContainerName" --format "{{.Names}}"
    if ($running) {
        Write-ColorOutput Green "✅ Redis is running on port $RedisPort"
        Test-RedisConnection
    } else {
        Write-ColorOutput Red "❌ Failed to start Redis"
        docker logs $ContainerName
    }
}

function Stop-Redis {
    Write-ColorOutput Yellow "Stopping Redis container..."
    docker stop $ContainerName
    Write-ColorOutput Green "✅ Redis stopped"
}

function Get-RedisStatus {
    if (-not (Test-DockerRunning)) {
        Write-ColorOutput Red "❌ Docker is not running"
        return
    }

    $running = docker ps --filter "name=$ContainerName" --format "{{.Names}}"
    $exists = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
    
    if ($running) {
        Write-ColorOutput Green "✅ Redis is running"
        
        # Get container info
        $info = docker inspect $ContainerName | ConvertFrom-Json
        $uptime = $info[0].State.StartedAt
        
        Write-Output ""
        Write-Output "Container: $ContainerName"
        Write-Output "Image: $RedisImage"
        Write-Output "Port: $RedisPort"
        Write-Output "Started: $uptime"
        
        Test-RedisConnection
    } elseif ($exists) {
        Write-ColorOutput Yellow "⚠️  Redis container exists but is not running"
        Write-Output "Run: .\scripts\redis-manager.ps1 start"
    } else {
        Write-ColorOutput Red "❌ Redis container does not exist"
        Write-Output "Run: .\scripts\redis-manager.ps1 start"
    }
}

function Get-RedisLogs {
    Write-ColorOutput Yellow "Fetching Redis logs..."
    docker logs $ContainerName --tail 50
}

function Test-RedisConnection {
    Write-Output ""
    Write-ColorOutput Yellow "Testing Redis connection..."
    
    try {
        $result = docker exec $ContainerName redis-cli ping 2>&1
        if ($result -eq "PONG") {
            Write-ColorOutput Green "✅ Redis connection successful (PONG)"
        } else {
            Write-ColorOutput Red "❌ Redis connection failed: $result"
        }
    } catch {
        Write-ColorOutput Red "❌ Could not connect to Redis: $_"
    }
}

function Restart-Redis {
    Write-ColorOutput Yellow "Restarting Redis..."
    docker restart $ContainerName
    Start-Sleep -Seconds 2
    Get-RedisStatus
}

function Clean-Redis {
    Write-ColorOutput Yellow "Cleaning up Redis container and data..."
    
    $confirm = Read-Host "This will delete the Redis container and all data. Continue? (y/N)"
    if ($confirm -ne 'y') {
        Write-Output "Cancelled."
        return
    }
    
    docker stop $ContainerName 2>$null
    docker rm $ContainerName 2>$null
    
    Write-ColorOutput Green "✅ Redis container removed"
    Write-Output "Run 'start' to create a fresh Redis instance"
}

# Main script logic
Write-Output ""
Write-Output "=== CompactURL Redis Manager ==="
Write-Output ""

switch ($Action) {
    'start' { Start-Redis }
    'stop' { Stop-Redis }
    'status' { Get-RedisStatus }
    'logs' { Get-RedisLogs }
    'test' { Test-RedisConnection }
    'restart' { Restart-Redis }
    'clean' { Clean-Redis }
}

Write-Output ""
