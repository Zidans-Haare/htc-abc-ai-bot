#!/bin/bash

# Define PM2 path
PM2=/www/htdocs/w01fd8d6/dev.olomek.com/node/lib/node_modules/pm2/bin/pm2

# Check if PM2 daemon is running and start if not running
$PM2 ping 

# PM2 daemon is running, check if 'server' app is online
if ! $PM2 list | grep server | grep online >/dev/null; then
    # 'server' app is not online, start it
    cd /www/htdocs/w01fd8d6/dev.olomek.com
    $PM2 start server.cjs --name server
fi
