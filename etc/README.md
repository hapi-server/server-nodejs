# OS-X

Execute from same dir as this file

```
sudo rm -f /Library/LaunchDaemons/hapi-server.plist
rm -f ../log/hapi-server.stdout
rm -f ../log/hapi-server.stderr
```

```
sudo cp hapi-server.plist /Library/LaunchDaemons
sudo launchctl unload /Library/LaunchDaemons/hapi-server.plist 
sudo launchctl load -w /Library/LaunchDaemons/hapi-server.plist
sudo launchctl stop hapi-server.plist
sudo launchctl start hapi-server.plist
sleep 1
tail /var/log/system.log
tail ../log/hapi-server.stderr
tail ../log/hapi-server.stdout
```

# Linux

```
sudo cp hapi-server-dev.service /lib/systemd/system
sudo chmod 644 /lib/systemd/system/hapi-server-dev.service
sudo systemctl enable hapi-server-dev
sudo systemctl start hapi-server-dev
sudo systemctl status hapi-server-dev
```

After edits to `.service` file

```
sudo cp hapi-server-dev.service /lib/systemd/system
sudo systemctl daemon-reload
```

