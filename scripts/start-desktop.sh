#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$HOME/.vnc" "$HOME/Desktop" "$LOG_DIR"

VNC_GEOMETRY="${VNC_GEOMETRY:-1280x800}"

if [[ -z "${VNC_PASSWORD:-}" ]]; then
  if [[ -f "$HOME/.vnc/generated-password" ]]; then
    VNC_PASSWORD="$(cat "$HOME/.vnc/generated-password")"
  else
    set +o pipefail
    VNC_PASSWORD="$(tr -dc A-Za-z0-9 </dev/urandom | head -c 16)"
    set -o pipefail
    printf "%s" "$VNC_PASSWORD" > "$HOME/.vnc/generated-password"
    chmod 600 "$HOME/.vnc/generated-password"
  fi
fi

printf "%s\n" "$VNC_PASSWORD" | vncpasswd -f > "$HOME/.vnc/passwd"
chmod 600 "$HOME/.vnc/passwd"

cat > "$HOME/.vnc/xstartup" <<'EOF'
#!/usr/bin/env bash
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_SESSION_TYPE=x11
xrdb "$HOME/.Xresources" >/dev/null 2>&1 || true
dbus-launch --exit-with-session startxfce4
EOF
chmod +x "$HOME/.vnc/xstartup"

cat > "$HOME/Desktop/Chromium.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Chromium
Exec=chromium --no-sandbox --disable-dev-shm-usage
Icon=chromium
Terminal=false
EOF

cat > "$HOME/Desktop/File Explorer.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=File Explorer
Exec=thunar ${HOME}
Icon=system-file-manager
Terminal=false
EOF

cat > "$HOME/Desktop/Terminal.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Terminal
Exec=xfce4-terminal
Icon=utilities-terminal
Terminal=false
EOF

chmod +x "$HOME/Desktop/"*.desktop

if ! vncserver -list | grep -q ":1"; then
  vncserver :1 -geometry "$VNC_GEOMETRY" -depth 24 -localhost yes > "$LOG_DIR/vnc.log" 2>&1
fi

if ! pgrep -f "websockify.*6080" >/dev/null; then
  nohup websockify --web=/usr/share/novnc 6080 localhost:5901 > "$LOG_DIR/novnc.log" 2>&1 &
fi

cat <<EOF
Linux desktop started.
noVNC port: 6080
VNC password: $VNC_PASSWORD
If you forget it, run: cat ~/.vnc/generated-password
EOF
